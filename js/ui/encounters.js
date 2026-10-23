// Encounters klaarzetten (tab in het Monster-paneel) en XP-moeilijkheid. Regels puur in js/rules/encounters.js.
// UI-toestand (concept, menu, uitleg) staat in `ui` (render.js); de encounters zelf in app.encounters (IndexedDB, niet in undo).
import { APP } from "../version.js";
import { $, esc, toast, toastHtml, closeToast } from "./util.js";
import { app, because, addWhy, logAs, commit, saveEncounters, saveLairs, saveLibrary } from "../state.js";
import { render, ui, monListHtml } from "./render.js";
import { addMonsters, scrollToCard, newLair, CLEAR_UI } from "./actions.js";
import { wantSB } from "./statblock.js";
import { clearMonsters } from "../rules/turns.js";
import { findMon, allMonsters, filterMonsters, sanitizeOwn } from "../data/monsters.js";
import * as E from "../rules/encounters.js";
import { addEnc, encName } from "../rules/fight.js";

const fmt = (n) => Math.round(n).toLocaleString("nl-NL");
const multTxt = (m) => String(m).replace(".", ",");
const plural = (n, one, more) => `${n} ${n === 1 ? one : more}`;
const dateTxt = (t) => new Date(t).toLocaleDateString("nl-NL", { day: "numeric", month: "short", ...(new Date(t).getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) });
const monCount = (L) => L.filter((c) => c.kind === "monster").length;
const hasLair = (L) => L.some((c) => c.kind === "lair");

/* ---------- moeilijkheid ---------- */
const partyNow = () => E.partyFor(app.S.list, app.party);
export const diffList = () => E.difficulty(E.listMons(app.S.list, findMon), partyNow().who, !!app.S.allMon);
const diffEnc = (enc) => E.difficulty(E.encMons(enc, findMon), partyNow().who, !!enc.all);

/** Korte tekst voor de chip: "Hard", "level onbekend", "geen party" */
const chipLbl = (r) => E.ratingName(r.rating) || E.noRating(r);
const chipCls = (r) => (r.rating == null ? "unk" : `r${r.rating + 1}`);

/** Uitleg: ruwe XP × multiplier = aangepaste XP, party, drempels */
function diffWhy(r, lair, tog, mons) {
  const P = partyNow();
  const tip = r.rating === 3 && mons ? E.deadlyTip(mons, P.who, r.all) : null; // AF8: eerste regel bij Deadly
  const cnt = r.nm < r.n ? `${r.nm} van ${r.n} monsters tellen` : plural(r.n, "monster", "monsters");
  const lines = [`${fmt(r.xp)} XP × ${multTxt(r.mult)} (${cnt}${r.pcs ? `, ${plural(r.pcs, "speler", "spelers")}` : ""}) = <b>${fmt(r.adj)} XP</b>`];
  if (!r.pcs) lines.push("Geen spelers: zet de party aan tafel of voeg partyleden toe.");
  else lines.push(`${P.src === "list" ? "Aan tafel" : "Vaste party"}: level ${P.who.map((p) => p.lvl || "?").join(", ")}`);
  if (r.th) lines.push(E.RATINGS.map((k, i) => `${k} ${fmt(r.th[i])}`).join(" · "));
  if (r.noXp.length) lines.push(`Zonder CR (telt niet mee): ${esc(r.noXp.join(", "))}`);
  if (r.pcs && (r.pcs < 3 || r.pcs >= 6)) lines.push(r.pcs < 3 ? "Kleine party: multiplier een stap hoger." : "Grote party: multiplier een stap lager.");
  if (lair) lines.push("Lair telt niet mee.");
  return `<div class="dwhy">${tip ? `<p class="dtip">${esc(deadlyText(tip))}</p>` : ""}${lvlRows(P.who)}${lines.map((l) => `<p>${l}</p>`).join("")}${weakRow(r, tog)}</div>`;
}

/** AF8: één zin bij Deadly, met advies */
export function deadlyText(t) {
  const head = "Deadly: een speler kan sterven.";
  if (t.one) return `${head} Kies een lagere CR voor Hard.`;
  if (t.stays) return `${head} Ook met 1 monster minder blijft het Deadly.`;
  return `${head} Met 1 ${t.name} minder wordt het ${E.ratingName(t.rating)}.`;
}

/**
 * DMG 2014: monsters met een veel lagere CR tellen niet mee voor de multiplier (hun XP wel), tenzij ze flink bijdragen.
 * Regel met wie het zijn en de schakelaar "Toch meetellen" (lijst: S.allMon, encounter: e.all). Zonder lage CR: niets.
 */
function weakRow(r, tog) {
  if (!r.weak.length) return "";
  const who = esc(r.weak.map((w) => `${w.n}× ${w.name}`).join(", "));
  return `<p>${r.all ? `Telt mee voor ×, ook met veel lagere CR: ${who}` : `Niet meegeteld voor ×: ${who} (XP onder 1/10 van het sterkste monster)`}</p>
    ${tog ? `<button type="button" class="btn small dall" ${tog} aria-pressed="${r.all}">${r.all ? "✓ " : ""}Toch meetellen</button>` : ""}`;
}

/**
 * VB1: wie geen level heeft, krijgt hier direct een veld (opslaan bij verlaten via onChange → saveLevel; render na focusout in
 * main.js). Partylid → in de party, anders bij de speler. Leeg als iedereen een level heeft.
 */
function lvlRows(who) {
  const lost = who.filter((p) => !p.lvl && !p.cid && !p.pid); // oude/rare data zonder verwijzing: dan in elk geval de naam
  const note = lost.length ? `<p>Level onbekend: ${esc(lost.map((p) => p.name).join(", "))} (vul in onder Party).</p>` : "";
  const miss = who.filter((p) => !p.lvl && (p.cid || p.pid));
  if (!miss.length) return note;
  const inParty = miss.filter((p) => p.pid).length;
  const where = inParty === miss.length ? "Bewaard in de party." : inParty ? "Partyleden: bewaard in de party." : "Bewaard bij de speler.";
  return `<p class="dlvlh"><b>Vul het level in.</b> ${where}</p><div class="dlvls">${miss.map((p, i) => `<label class="dlvl"><span>${esc(p.name)}</span><input data-dlvl type="number" min="1" max="20" inputmode="numeric" placeholder="?" enterkeyhint="${i < miss.length - 1 ? "next" : "done"}"${p.cid ? ` data-cid="${esc(p.cid)}"` : ""}${p.pid ? ` data-pid="${esc(p.pid)}"` : ""} aria-label="${esc(`Level ${p.name}`)}"></label>`).join("")}</div>${note}`;
}

/**
 * Na het openklappen van de uitleg: focus op het eerste levelveld (de tik op "level onbekend" is om dat in te vullen).
 * Direct in de tik, niet uitgesteld: iOS opent het toetsenbord alleen bij focus binnen de tik zelf.
 */
function focusLvl(sel, center) {
  const f = document.querySelector(`${sel} [data-dlvl]`);
  if (!f) return;
  f.focus({ preventScroll: true });
  f.scrollIntoView({ block: center ? "center" : "nearest" });
}

/**
 * Strook bovenaan de lijst in Voorbereiden: live moeilijkheid (met monsters), of "Geen monsters · Encounter inladen"
 * (spelers aan tafel, encounters klaar). Alleen weergave.
 */
export function encBanner(S, prep) {
  if (!prep) return "";
  const n = monCount(S.list);
  if (!n) return S.list.length && !hasLair(S.list) && app.encounters.length
    ? `<li class="sbanner encb"><span>Geen monsters</span><button type="button" class="btn small primary" data-prep="enc">Encounter inladen</button></li>` : "";
  const r = diffList();
  return `<li class="dbanner"><button type="button" class="dbtn" data-enc="difftog" aria-expanded="${!!ui.diffOpen}">Moeilijkheid <b class="dchip ${chipCls(r)}">${esc(chipLbl(r))}</b> · ${fmt(r.adj)} XP <span aria-hidden="true">${ui.diffOpen ? "▾" : "▸"}</span></button>${ui.diffOpen ? diffWhy(r, hasLair(S.list), `data-enc="allmon"`, E.listMons(app.S.list, findMon)) : ""}</li>`;
}

/**
 * VB2: naam van de ingeladen encounter boven de lijst, met de notitie (tactiek) ingeklapt. Voorbereiden: altijd de naam;
 * Gevecht: alleen als er een notitie is. Nooit op het spelersscherm (S.enc zit niet in de snapshot).
 */
export function encStrip(S, prep) {
  const E2 = S.enc || [], notes = E2.filter((e) => e.notes.trim());
  if (!E2.length || (!prep && !notes.length)) return "";
  const name = `<b class="ennm">${esc(encName(S))}</b>`;
  if (!notes.length) return `<li class="encn"><span class="encnb">${name}</span></li>`;
  const open = !!ui.encOpen;
  return `<li class="encn"><button type="button" class="encnb" data-enc="notes" aria-expanded="${open}">${name}<span class="entac">Tactiek <span aria-hidden="true">${open ? "▾" : "▸"}</span></span></button>${open
    ? `<div class="entxt">${notes.map((e) => `${E2.length > 1 ? `<p class="enh">${esc(e.name)}</p>` : ""}<p>${esc(e.notes.trim())}</p>`).join("")}</div>` : ""}</li>`;
}

/* ---------- paneel ---------- */
const encSummary = (e) => `${e.monsters.length ? plural(E.total(e), "monster", "monsters") : "geen monsters"}${e.lair ? " + lair" : ""}`;

export function paintEnc() {
  const el = $("#enc-panel");
  if (ui.prep !== "enc") return;
  el.innerHTML = ui.encEdit ? editHtml() : listHtml();
  if (ui.encEdit) paintEditList();
}

function listHtml() {
  const L = app.S.list, n = monCount(L), lair = hasLair(L);
  const what = `${n ? plural(n, "monster", "monsters") : ""}${n && lair ? " + " : ""}${lair ? "lair" : ""}`;
  const d = ui.encDraft;
  const save = d
    ? `<div class="encform"><label>Naam<input id="enc-name" maxlength="80" placeholder="bijv. Goblin-hinderlaag" value="${esc(d.name)}" autocomplete="off"></label>
        <label>Notitie <span class="opt">(optioneel)</span><textarea id="enc-notes" maxlength="2000" placeholder="bijv. hinderlaag bij de brug, 2 goblins verstopt">${esc(d.notes)}</textarea></label>
        <p class="hint">Bewaart ${esc(what)}. Spelers gaan niet mee; HP en initiative kies je bij het inladen.</p>
        <div class="bar"><button type="button" class="btn small" data-enc="save-no">Annuleer</button><button type="button" class="btn primary" data-enc="save-go">Opslaan</button></div></div>`
    : `${n || lair ? `<button type="button" class="btn tap encsave" data-enc="save-open">+ Huidige lijst opslaan (${esc(what)})</button>` : ""}
      <button type="button" class="btn tap encsave" data-enc="new">+ Nieuwe encounter</button>${n || lair ? "" : `<p class="hint">Of zet monsters in de lijst en sla die op. Spelers gaan niet mee.</p>`}`; // VB5
  const imp = ui.encImp ? (() => {
    const had = app.encounters.find((e) => e.id === ui.encImp.enc.id);
    return `<div class="confirmbox"><p style="margin:0">"${esc(ui.encImp.enc.name)}" staat er al${had ? ` (gewijzigd ${esc(dateTxt(had.updatedAt))})` : ""}.</p>
      <div class="bar"><button type="button" class="btn primary" data-enc="imp-replace">Vervangen</button><button type="button" class="btn" data-enc="imp-copy">Als kopie</button><button type="button" class="btn small" data-enc="imp-no">Annuleer</button></div></div>`;
  })() : "";
  const rows = E.sorted(app.encounters).map(rowHtml).join("");
  return `${save}${imp}<div class="enclist">${rows || `<p class="hint">Nog geen encounters. Tik op "+ Nieuwe encounter" of sla de huidige lijst op.</p>`}</div>
    <div class="bar encimp"><button type="button" class="btn tap" data-file="enc-file">Encounterbestand importeren…</button><input id="enc-file" type="file" accept=".json,application/json" hidden></div>
    <p class="hint">Delen maakt een bestand met de encounter en de eigen monsters erin, voor een ander apparaat of een co-DM.</p>`;
}

function rowHtml(e) {
  const r = diffEnc(e), id = esc(e.id), n = monCount(app.S.list);
  const ask = ui.encAsk === e.id
    ? `<div class="confirm encask">${esc(`Al in de lijst: ${[n && plural(n, "monster", "monsters"), hasLair(app.S.list) && "lair"].filter(Boolean).join(" + ")}.`)}${app.S.round ? " Vervangen stopt het gevecht." : ""}
        <button type="button" class="btn small primary" data-enc="load-replace" data-id="${id}">Vervangen</button><button type="button" class="btn small" data-enc="load-add" data-id="${id}">Toevoegen</button><button type="button" class="btn small" data-enc="ask-no">Annuleer</button></div>` : "";
  const menu = ui.encMenu === e.id
    ? `<div class="encmenu"><button type="button" class="btn small" data-enc="edit" data-id="${id}">Bewerken</button><button type="button" class="btn small" data-enc="dup" data-id="${id}">Dupliceren</button><button type="button" class="btn small" data-enc="share" data-id="${id}">Delen</button><button type="button" class="btn small ghost" data-enc="del" data-id="${id}">Verwijderen</button></div>` : "";
  return `<div class="encrow">
    <div class="ehead"><div class="einfo"><b>${esc(e.name)}</b><small>${esc(encSummary(e))} · ${esc(dateTxt(e.updatedAt))}</small>${e.notes ? `<small class="enote">${esc(e.notes)}</small>` : ""}</div>
      ${e.monsters.length ? `<button type="button" class="dchip ${chipCls(r)}" data-enc="why" data-id="${id}" aria-expanded="${ui.encWhy === e.id}" aria-label="Moeilijkheid ${esc(chipLbl(r))}, ${fmt(r.adj)} XP: uitleg">${esc(chipLbl(r))}</button>` : ""}</div>
    ${ui.encWhy === e.id ? diffWhy(r, !!e.lair, `data-enc="encall" data-id="${id}"`, E.encMons(e, findMon)) : ""}${ask}
    <div class="ebtns"><button type="button" class="btn primary" data-enc="load" data-id="${id}">Inladen</button><button type="button" class="btn emore" data-enc="menu" data-id="${id}" aria-expanded="${ui.encMenu === e.id}" aria-label="Meer acties voor ${esc(e.name)}">⋯</button></div>
    ${menu}</div>`;
}

/** Lair in Bewerken: die van de encounter, anders (VB5) de eerste met legendary actions ("Lair: Adult Red Dragon") */
function lairKeyOf(x) {
  if ((x.lair && x.lair.key) || x.lairKey) return (x.lair && x.lair.key) || x.lairKey;
  const m = x.monsters.find((y) => { const sb = findMon(y.ref); return sb && sb.l && sb.l.length; });
  return m ? `Lair: ${m.ref}` : "";
}

function editHtml() {
  const x = ui.encEdit, lk = lairKeyOf(x);
  const r = E.difficulty(E.encMons(x, findMon), partyNow().who, !!x.all);
  const rows = x.monsters.map((m, i) => {
    const s = findMon(m.ref);
    const tags = [m.hidden && "verborgen", m.anon && "onbekend", m.grp && "groep", !s && "niet op dit apparaat"].filter(Boolean).join(" · ");
    return `<div class="erow"><span class="en"><b>${esc(m.ref)}</b><small>${s ? `CR ${esc(s.cr || "?")}` : ""}${tags ? `${s ? " · " : ""}${esc(tags)}` : ""}</small></span>
      <span class="step"><button type="button" class="btn" data-enc="n" data-i="${i}" data-v="-1" aria-label="${m.n === 1 ? `${esc(m.ref)} weghalen` : `Eén ${esc(m.ref)} minder`}">−</button><input class="encnum" data-encn="${i}" type="number" inputmode="numeric" min="1" max="${E.MAX_N}" enterkeyhint="done" value="${m.n}" aria-label="${esc(`Aantal ${m.ref}`)}"><button type="button" class="btn" data-enc="n" data-i="${i}" data-v="1" aria-label="Eén ${esc(m.ref)} meer" ${E.total(x) >= E.MAX_TOTAL || m.n >= E.MAX_N ? "disabled" : ""}>+</button></span></div>`;
  }).join("");
  return `<button type="button" class="link eback" data-enc="edit-no">‹ Encounters</button>
    <label>Naam<input id="ee-name" maxlength="80" value="${esc(x.name)}" autocomplete="off"></label>
    <label>Notitie <span class="opt">(optioneel)</span><textarea id="ee-notes" maxlength="2000">${esc(x.notes)}</textarea></label>
    <p class="vlbl">Monsters${x.monsters.length ? ` · <span class="dchip ${chipCls(r)}">${esc(chipLbl(r))}</span> ${fmt(r.adj)} XP` : ""}</p>
    <div class="erows">${rows || `<p class="hint">Nog geen monsters.</p>`}</div>
    ${lk ? `<label class="chk"><input type="checkbox" id="ee-lair" ${x.lair ? "checked" : ""}> Lair actions (${esc(lk.replace(/^Lair: /, ""))})</label>` : ""}
    <label>+ Monster<input id="ee-q" placeholder="naam, type of CR" autocomplete="off" enterkeyhint="search" value="${esc(x.q)}"></label>
    <div class="mlist" id="ee-list"></div>
    <div class="bar"><button type="button" class="btn small" data-enc="edit-no">Annuleer</button><button type="button" class="btn primary" data-enc="edit-go">Opslaan</button></div>`;
}
/** Alleen de zoekresultaten (zoekveld houdt focus) */
function paintEditList() {
  const x = ui.encEdit, box = $("#ee-list");
  if (!x || !box) return;
  const f = filterMonsters(allMonsters(), x.q, null);
  box.hidden = !x.q.trim();
  box.innerHTML = x.q.trim() ? monListHtml({ ...f, L: f.L.slice(0, 40) }, null, "data-eepick", `Niets gevonden. Eigen monsters maak je onder "Eigen".`) : "";
}

/* ---------- acties ---------- */
const findEnc = (id) => app.encounters.find((e) => e.id === id);
const repaint = () => paintEnc();

/** Inladen: monsters via addMonsters (HP-keuze uit ui.addOpts, initiative uit de encounter: groep per regel, anders per monster), lair erbij; één undo-stap en één logregel */
function loadEnc(enc, mode) {
  const S = app.S, plan = E.loadPlan(enc, (r) => !!findMon(r));
  const lairNew = plan.lair && (mode === "replace" || !hasLair(S.list));
  if (!plan.adds.length && !lairNew) {
    toast(plan.missing.length ? `Niets in te laden: ${plan.missing.join(", ")} staat niet op dit apparaat.` : "Er staat al een lair; deze encounter heeft verder geen monsters.");
    return;
  }
  let gone = 0;
  if (mode === "replace") {
    const r = clearMonsters(S); addWhy(r.why); gone = r.n + r.lairs;
    Object.assign(ui, CLEAR_UI);
  }
  if (S.round) because("tijdens het gevecht toegevoegd");
  // HP volgt de keuze bij monsters toevoegen (ui.addOpts); initiative volgt de encounter zelf: groep per regel, anders per monster
  const before = S.list.length, hpmode = ui.addOpts.hp;
  for (const a of plan.adds) addMonsters(a.ref, a.n, hpmode, a.init === "group" ? "group" : "each", true, null, a.hidden, a.anon);
  if (lairNew) S.list.push(newLair(plan.lair.key, plan.lair.hidden));
  if (mode === "replace" ? !!enc.all !== !!S.allMon : enc.all && !S.allMon) { if (enc.all) S.allMon = true; else delete S.allMon; } // lage CR toch meetellen volgt de encounter
  addEnc(S, enc, mode === "replace"); // naam boven de lijst, notitie (tactiek) in Gevecht (VB2); zelfde undo-stap
  const added = S.list.slice(before), nMon = added.filter((c) => c.kind === "monster").length;
  const what = `${plural(nMon, "monster", "monsters")}${lairNew ? " + lair" : ""}`;
  logAs(`Encounter "${enc.name}" ingeladen: ${what}${gone ? ` (vervangt ${gone})` : ""}`);
  because(`encounter "${enc.name}"`);
  S.sample = false;
  const last = added.filter((c) => c.kind === "monster").at(-1) || added.at(-1);
  Object.assign(ui, { prep: null, prepLast: null, encAsk: null, encMenu: null, mode: null });
  if (last) wantSB(last.id); // tablet/desktop: zijkolom toont het ingeladen monster
  render();
  if (last) scrollToCard(last.id, true);
  const miss = plan.missing.length ? `<br>${esc(`Niet op dit apparaat: ${plan.missing.join(", ")}. De rest is ingeladen.`)}` : "";
  toastHtml(`${esc(`"${enc.name}" ingeladen · ${what}${gone ? ` · ${plural(gone, "deelnemer", "deelnemers")} vervangen` : ""}`)}${miss} <button class="tundo" id="toast-undo">Ongedaan</button>`);
}

function saveNew() {
  const d = ui.encDraft, name = (d.name || "").trim();
  if (!name) { toast("Geef de encounter een naam."); $("#enc-name")?.focus(); return; }
  const e = E.fromList(app.S.list, { id: E.newId(), name, notes: d.notes, now: Date.now(), all: !!app.S.allMon });
  if (!e) { toast("Er staan geen monsters of lair in de lijst."); return; }
  app.encounters = [...app.encounters, e]; saveEncounters();
  ui.encDraft = null; repaint();
  const lost = monCount(app.S.list) - E.total(e); // boven de grenzen (100 monsters, 40 regels) valt de rest weg
  toast(`"${e.name}" opgeslagen · ${encSummary(e)}${lost > 0 ? `. Let op: ${lost} monsters niet bewaard (max ${E.MAX_TOTAL})` : ""}`);
}

/** VB5: lege encounter maken in hetzelfde subscherm; pas bij Opslaan in de bibliotheek */
function startNew() {
  ui.encEdit = { id: E.newId(), isNew: true, name: "", notes: "", monsters: [], lair: null, lairKey: "", lairHidden: false, all: false, q: "" };
  ui.encMenu = null; ui.encDraft = null; ui.encImp = null; repaint();
  $("#enc-panel").closest(".psheet").scrollTop = 0;
  $("#ee-name")?.focus();
}
function startEdit(e) {
  ui.encEdit = { id: e.id, name: e.name, notes: e.notes, monsters: structuredClone(e.monsters), lair: e.lair ? { ...e.lair } : null, lairKey: e.lair ? e.lair.key : "", lairHidden: !!(e.lair && e.lair.hidden), all: !!e.all, q: "" };
  ui.encMenu = null; repaint();
  $("#enc-panel").closest(".psheet").scrollTop = 0;
}
function saveEdit() {
  const x = ui.encEdit, old = findEnc(x.id);
  if (!x.name.trim() && !x.isNew) { toast("Geef de encounter een naam."); $("#ee-name")?.focus(); return; }
  const e = E.cleanEncounter({ id: x.id, name: x.name.trim() || "Nieuwe encounter", notes: x.notes, monsters: x.monsters, lair: x.lair, all: x.all, updatedAt: Date.now() });
  if (!e) { toast("Een encounter heeft minstens één monster of een lair."); return; }
  app.encounters = old ? app.encounters.map((y) => (y.id === x.id ? e : y)) : [...app.encounters, e];
  saveEncounters(); ui.encEdit = null; repaint();
  toast(`"${e.name}" ${old ? "bijgewerkt" : "opgeslagen"} · ${encSummary(e)}`);
}

let lastDel = null;
function delEnc(e) {
  lastDel = e;
  app.encounters = app.encounters.filter((y) => y.id !== e.id); saveEncounters();
  ui.encMenu = null; ui.encWhy = null; repaint();
  // eigen knop (niet toast-undo): ↶ in de beurtbalk zet een encounter niet terug
  toastHtml(`${esc(`"${e.name}" verwijderd.`)} <button class="tundo" id="toast-encundo">Ongedaan</button>`);
}

const fileName = (name) => `encounter-${String(name).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "naamloos"}.json`;
async function shareEnc(e) {
  const json = JSON.stringify(E.buildEncFile(e, { own: [...app.custom, ...app.imported], lairs: app.lairs }));
  const name = fileName(e.name);
  try {
    const f = new File([json], name, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: e.name }); return; }
  } catch (err) { if (err && err.name === "AbortError") return; } // geannuleerd: niets doen; anders downloaden
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([json], { type: "application/json" })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast("Bestand gedownload.");
}

/** Statblocks en lair actions uit een bestand: alleen wat hier nog niet bestaat (nooit iets overschrijven) */
function addLibrary(p) {
  const add = p.monsters.map(sanitizeOwn).filter((m) => m.n && !findMon(m.n));
  if (add.length) { app.imported = [...app.imported, ...add]; saveLibrary(); }
  let lairs = 0;
  for (const [k, v] of Object.entries(p.lairs)) if (!(app.lairs[k] && app.lairs[k].length) && v.length) { app.lairs[k] = v; lairs++; }
  if (lairs) saveLairs();
  return add.length;
}
function importDone(p, mode) {
  const nMon = addLibrary(p);
  app.encounters = E.mergeEnc(app.encounters, p.enc, mode, Date.now()); saveEncounters();
  ui.encImp = null; repaint();
  const miss = E.loadPlan(p.enc, (r) => !!findMon(r)).missing;
  toast(`"${p.enc.name}" geïmporteerd${nMon ? ` · ${plural(nMon, "eigen monster", "eigen monsters")} erbij` : ""}${miss.length ? `. Ontbreekt nog: ${miss.join(", ")}` : ""}.`);
}
async function importFile(file) {
  let p;
  try { p = E.parseEncFile(JSON.parse(await file.text())); }
  catch (err) { toast(err instanceof SyntaxError ? `Geen encounter-bestand van ${APP}.` : err.message); return; }
  if (findEnc(p.enc.id)) { ui.encImp = p; ui.encEdit = null; repaint(); return; } // nooit stil overschrijven
  importDone(p, "new");
}

/** VB5: aantal getypt (regels in E.clampCount) */
function setCount(x, i, t) {
  const m = x.monsters[i]; if (!m) return;
  const r = E.clampCount(x, i, t.value);
  if (r.n == null) { t.value = m.n; return; }
  if (r.msg) toast(r.msg);
  m.n = r.n; t.value = r.n;
  if (r.n < 2) delete m.grp;
}

const ACT = {
  "save-open"() { ui.encDraft = { name: "", notes: "" }; repaint(); $("#enc-name")?.focus(); },
  "save-no"() { ui.encDraft = null; repaint(); },
  "save-go": saveNew,
  new: startNew,
  load(id) {
    const e = findEnc(id); if (!e) return;
    // alleen vragen als er iets te vervangen valt
    if (monCount(app.S.list) || (hasLair(app.S.list) && e.lair)) { ui.encAsk = e.id; ui.encMenu = null; repaint(); return; }
    loadEnc(e, "add");
  },
  "load-replace"(id) { const e = findEnc(id); if (e) loadEnc(e, "replace"); },
  "load-add"(id) { const e = findEnc(id); if (e) loadEnc(e, "add"); },
  "ask-no"() { ui.encAsk = null; repaint(); },
  menu(id) { ui.encMenu = ui.encMenu === id ? null : id; ui.encAsk = null; repaint(); },
  why(id) {
    ui.encWhy = ui.encWhy === id ? null : id; repaint();
    if (ui.encWhy) focusLvl("#enc-panel .encrow .dwhy", true); // er is maar één uitleg open
  },
  edit(id) { const e = findEnc(id); if (e) startEdit(e); },
  dup(id) {
    const e = findEnc(id); if (!e) return;
    const c = E.duplicate(e, app.encounters, Date.now());
    app.encounters = [...app.encounters, c]; saveEncounters(); ui.encMenu = null; repaint();
    toast(`Kopie: "${c.name}"`);
  },
  share(id) { const e = findEnc(id); if (e) shareEnc(e); },
  del(id) { const e = findEnc(id); if (e) delEnc(e); },
  "edit-no"() { ui.encEdit = null; repaint(); },
  encall(id) { // lage CR toch meetellen voor deze encounter (bewaard in de bibliotheek, geen undo)
    const e = findEnc(id); if (!e) return;
    const n = { ...e, updatedAt: Date.now() };
    if (e.all) delete n.all; else n.all = true;
    app.encounters = app.encounters.map((y) => (y.id === e.id ? n : y)); saveEncounters(); repaint();
  },
  "edit-go": saveEdit,
  n(_, b) {
    const x = ui.encEdit, i = +b.dataset.i, m = x && x.monsters[i]; if (!m) return;
    m.n += +b.dataset.v;
    if (m.n < 1) x.monsters.splice(i, 1);
    m.n = Math.min(E.MAX_N, m.n);
    if (m.n < 2) delete m.grp;
    repaint();
  },
  "imp-replace"() { if (ui.encImp) importDone(ui.encImp, "replace"); },
  "imp-copy"() { if (ui.encImp) importDone(ui.encImp, "copy"); },
  "imp-no"() { ui.encImp = null; repaint(); },
};

export function bindEnc() {
  const el = $("#enc-panel");
  el.addEventListener("click", (e) => {
    // open levelveld eerst vastleggen (blur → change), vóór een repaint van dit paneel; de algemene onClick slaat dit paneel over
    const a = document.activeElement;
    if (a && a.dataset && "dlvl" in a.dataset && !a.contains(e.target)) a.blur();
    const p = e.target.closest("[data-eepick]");
    if (p && ui.encEdit) {
      const x = ui.encEdit, ref = p.dataset.eepick;
      if (E.total(x) >= E.MAX_TOTAL) { toast(`Maximaal ${E.MAX_TOTAL} monsters per encounter.`); return; }
      const m = x.monsters.find((y) => y.ref === ref && !y.hidden && !y.anon);
      if (m && m.n < E.MAX_N) m.n++;
      else if (x.monsters.length < E.MAX_ROWS) x.monsters.push({ ref, n: 1 });
      x.q = ""; repaint(); $("#ee-q")?.focus();
      toast(`${ref} erbij.`);
      return;
    }
    const b = e.target.closest("[data-enc]");
    if (b && ACT[b.dataset.enc]) ACT[b.dataset.enc](b.dataset.id, b);
  });
  el.addEventListener("input", (e) => {
    const t = e.target, d = ui.encDraft, x = ui.encEdit;
    if (t.id === "enc-name" && d) d.name = t.value;
    else if (t.id === "enc-notes" && d) d.notes = t.value;
    else if (t.id === "ee-name" && x) x.name = t.value;
    else if (t.id === "ee-notes" && x) x.notes = t.value;
    else if (t.id === "ee-q" && x) { x.q = t.value; paintEditList(); }
  });
  el.addEventListener("change", async (e) => {
    const t = e.target;
    if (t.id === "ee-lair" && ui.encEdit) { const x = ui.encEdit, k = lairKeyOf(x); x.lair = t.checked && k ? { key: k, ...(x.lairHidden ? { hidden: true } : {}) } : null; if (!t.checked && k) x.lairKey = k; }
    if ("encn" in t.dataset && ui.encEdit) setCount(ui.encEdit, +t.dataset.encn, t); // VB5: render volgt na focusout (main.js)
    if (t.id === "enc-file" && t.files[0]) { const f = t.files[0]; t.value = ""; await importFile(f); }
  });
  el.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    if (e.target.id === "enc-name") { e.preventDefault(); saveNew(); }
    if ("encn" in e.target.dataset) { e.preventDefault(); e.target.blur(); return; }
    if (e.target.id === "ee-q") { e.preventDefault(); const f = $("#ee-list [data-eepick]"); if (f) f.click(); }
  });
  // levelvelden in de uitleg: Enter = volgende veld, op het laatste klaar (blur → opslaan → render).
  // iPhone: het cijferblok heeft geen Enter; Gereed doet blur en slaat dus ook op.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || !e.target.matches("[data-dlvl]")) return;
    e.preventDefault();
    const all = [...e.target.closest(".dlvls").querySelectorAll("[data-dlvl]")], nx = all[all.indexOf(e.target) + 1];
    if (nx) nx.focus(); else e.target.blur();
  });
  // buiten het paneel: uitleg bij de live moeilijkheid, Ongedaan na verwijderen
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.enc === "allmon") { if (app.S.allMon) delete app.S.allMon; else app.S.allMon = true; commit(); render(); return; } // undo-stap, geen logregel
    if (b.dataset.enc === "difftog") { ui.diffOpen = !ui.diffOpen; render(); if (ui.diffOpen) focusLvl(".dbanner"); return; }
    if (b.dataset.enc === "notes") { ui.encOpen = !ui.encOpen; render(); return; }
    if (b.id === "toast-encundo" && lastDel) {
      if (!findEnc(lastDel.id)) { app.encounters = [...app.encounters, lastDel]; saveEncounters(); }
      lastDel = null; closeToast(); repaint(); toast("Encounter teruggezet.");
    }
  });
}
