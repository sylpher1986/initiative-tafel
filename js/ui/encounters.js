// Encounters klaarzetten (tab in het Monster-paneel) en XP-moeilijkheid. Regels puur in js/rules/encounters.js.
// UI-toestand (concept, menu, uitleg) staat in `ui` (render.js); de encounters zelf in app.encounters (IndexedDB, niet in undo).
import { M } from "../i18n/msg.js";
import { APP } from "../version.js";
import { ico, chev } from "./icons.js";
import { $, esc, toast, toastHtml, closeToast, toastBad, undoBtn } from "./util.js";
import { t, i18n } from "../i18n/boot.js";
import { app, because, addWhy, logAs, commit, saveEncounters, saveLairs, saveLibrary } from "../state.js";
import { render, ui, monListHtml } from "./render.js";
import { addMonsters, scrollToCard, newLair, CLEAR_UI } from "./actions.js";
import { wantSB } from "./statblock.js";
import { clearMonsters } from "../rules/turns.js";
import { findMon, allMonsters, filterMonsters, sanitizeOwn } from "../data/monsters.js";
import * as E from "../rules/encounters.js";
import { addEnc, encName } from "../rules/fight.js";

const fmt = (n) => i18n().num(Math.round(n)); // 1.950 (nl) / 1,950 (en)
const multTxt = (m) => i18n().num(m); // 1,5 (nl) / 1.5 (en)
const dateTxt = (ms) => i18n().date(ms, { day: "numeric", month: "short", ...(new Date(ms).getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) });
const monsN = (n) => t("init.diff.mons", { n }); // "3 monsters" / "1 monster"
const monCount = (L) => L.filter((c) => c.kind === "monster").length;
const hasLair = (L) => L.some((c) => c.kind === "lair");

/* ---------- moeilijkheid ---------- */
const partyNow = () => E.partyFor(app.S.list, app.party);
export const diffList = () => E.difficulty(E.listMons(app.S.list, findMon), partyNow().who, !!app.S.allMon);
const diffEnc = (enc) => E.difficulty(E.encMons(enc, findMon), partyNow().who, !!enc.all);

/** Korte tekst voor de chip: "Hard", "level onbekend", "geen party" */
const NO_RATING = { party: "init.diff.noParty", lvl: "init.diff.noLvl", cr: "init.diff.noCr" };
const chipLbl = (r) => E.ratingName(r.rating) || t(NO_RATING[E.noRatingCode(r)]);
const chipCls = (r) => (r.rating == null ? "unk" : `r${r.rating + 1}`);

/** Uitleg: ruwe XP × multiplier = aangepaste XP, party, drempels */
function diffWhy(r, lair, tog, mons) {
  const P = partyNow();
  const tip = r.rating === 3 && mons ? E.deadlyTip(mons, P.who, r.all) : null; // AF8: eerste regel bij Deadly
  const T = (k, p) => esc(t(k, p)); // regels hieronder zijn HTML
  const cnt = r.nm < r.n ? t("init.diff.counted", { nm: r.nm, n: r.n }) : t("init.diff.mons", { n: r.n });
  const lines = [`${fmt(r.xp)} XP × ${multTxt(r.mult)} (${esc(cnt)}${r.pcs ? `, ${T("init.diff.pcs", { n: r.pcs })}` : ""}) = <b>${fmt(r.adj)} XP</b>`];
  if (!r.pcs) lines.push(T("init.diff.noPcs"));
  else lines.push(T(P.src === "list" ? "init.diff.atTable" : "init.diff.saved", { lv: P.who.map((p) => p.lvl || "?").join(", ") }));
  if (r.th) lines.push(E.RATINGS.map((k, i) => `${k} ${fmt(r.th[i])}`).join(" · "));
  if (r.noXp.length) lines.push(T("init.diff.withoutCr", { names: r.noXp.join(", ") }));
  if (r.pcs && (r.pcs < 3 || r.pcs >= 6)) lines.push(T(r.pcs < 3 ? "init.diff.small" : "init.diff.big"));
  if (lair) lines.push(T("init.diff.lair"));
  return `<div class="dwhy">${tip ? `<p class="dtip">${esc(deadlyText(tip))}</p>` : ""}${lvlRows(P.who)}${lines.map((l) => `<p>${l}</p>`).join("")}${weakRow(r, tog)}</div>`;
}

/** AF8: één zin bij Deadly, met advies */
export function deadlyText(d) {
  const tail = d.one ? t("init.diff.deadlyOne") : d.stays ? t("init.diff.deadlyStays") : t("init.diff.deadlyLess", { name: d.name, rating: E.ratingName(d.rating) });
  return `${t("init.diff.deadly")} ${tail}`;
}

/**
 * DMG 2014: monsters met een veel lagere CR tellen niet mee voor de multiplier (hun XP wel), tenzij ze flink bijdragen.
 * Regel met wie het zijn en de schakelaar "Toch meetellen" (lijst: S.allMon, encounter: e.all). Zonder lage CR: niets.
 */
function weakRow(r, tog) {
  if (!r.weak.length) return "";
  const who = r.weak.map((w) => `${w.n}× ${w.name}`).join(", ");
  return `<p>${esc(t(r.all ? "init.diff.weakAll" : "init.diff.weakNot", { who }))}</p>
    ${tog ? `<button type="button" class="btn small dall" ${tog} aria-pressed="${r.all}">${r.all ? ico("check") + " " : ""}${esc(t("init.diff.countAnyway"))}</button>` : ""}`;
}

/**
 * VB1: wie geen level heeft, krijgt hier direct een veld (opslaan bij verlaten via onChange → saveLevel; render na focusout in
 * main.js). Partylid → in de party, anders bij de speler. Leeg als iedereen een level heeft.
 */
function lvlRows(who) {
  const lost = who.filter((p) => !p.lvl && !p.cid && !p.pid); // oude/rare data zonder verwijzing: dan in elk geval de naam
  const note = lost.length ? `<p>${esc(t("init.diff.lvlLost", { names: lost.map((p) => p.name).join(", ") }))}</p>` : "";
  const miss = who.filter((p) => !p.lvl && (p.cid || p.pid));
  if (!miss.length) return note;
  const inParty = miss.filter((p) => p.pid).length;
  const where = t(inParty === miss.length ? "init.diff.lvlParty" : inParty ? "init.diff.lvlMixed" : "init.diff.lvlPc");
  return `<p class="dlvlh"><b>${esc(t("init.diff.lvlFill"))}</b> ${esc(where)}</p><div class="dlvls">${miss.map((p, i) => `<label class="dlvl"><span>${esc(p.name)}</span><input data-dlvl type="number" min="1" max="20" inputmode="numeric" placeholder="?" enterkeyhint="${i < miss.length - 1 ? "next" : "done"}"${p.cid ? ` data-cid="${esc(p.cid)}"` : ""}${p.pid ? ` data-pid="${esc(p.pid)}"` : ""} aria-label="${esc(`Level ${p.name}`)}"></label>`).join("")}</div>${note}`;
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
    ? `<li class="sbanner encb"><span>${esc(t("init.diff.noMons"))}</span><button type="button" class="btn small primary" data-prep="enc">${esc(t("init.empty.loadEnc"))}</button></li>` : "";
  const r = diffList();
  return `<li class="dbanner"><button type="button" class="dbtn" data-enc="difftog" aria-expanded="${!!ui.diffOpen}">${esc(t("init.diff.title"))} <b class="dchip ${chipCls(r)}">${esc(chipLbl(r))}</b> · ${fmt(r.adj)} XP ${chev(ui.diffOpen)}</button>${ui.diffOpen ? diffWhy(r, hasLair(S.list), `data-enc="allmon"`, E.listMons(app.S.list, findMon)) : ""}</li>`;
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
  return `<li class="encn"><button type="button" class="encnb" data-enc="notes" aria-expanded="${open}">${name}<span class="entac">${esc(t("init.enc.tactics"))} ${chev(open)}</span></button>${open
    ? `<div class="entxt">${notes.map((e) => `${E2.length > 1 ? `<p class="enh">${esc(e.name)}</p>` : ""}<p>${esc(e.notes.trim())}</p>`).join("")}</div>` : ""}</li>`;
}

/* ---------- paneel ---------- */
const encSummary = (e) => `${e.monsters.length ? monsN(E.total(e)) : t("init.enc.noMons")}${e.lair ? " + lair" : ""}`;

export function paintEnc() {
  const el = $("#enc-panel");
  if (ui.prep !== "enc") return;
  el.innerHTML = ui.encEdit ? editHtml() : listHtml();
  if (ui.encEdit) paintEditList();
}

function listHtml() {
  const L = app.S.list, n = monCount(L), lair = hasLair(L);
  const what = `${n ? monsN(n) : ""}${n && lair ? " + " : ""}${lair ? "lair" : ""}`;
  const d = ui.encDraft;
  const save = d
    ? `<div class="encform"><label>${esc(t("init.pc.name"))}<input id="enc-name" maxlength="80" placeholder="${esc(t("init.enc.namePh"))}" value="${esc(d.name)}" autocomplete="off"></label>
        <label>${esc(t("init.eff.note"))} <span class="opt">${esc(t("init.pc.optional"))}</span><textarea id="enc-notes" maxlength="2000" placeholder="${esc(t("init.enc.notesPh"))}">${esc(d.notes)}</textarea></label>
        <p class="hint">${esc(t("init.enc.keeps", { what }))}</p>
        <div class="bar"><button type="button" class="btn small" data-enc="save-no">${esc(t("common.cancel"))}</button><button type="button" class="btn primary" data-enc="save-go">${esc(t("common.save"))}</button></div></div>`
    : `${n || lair ? `<button type="button" class="btn tap encsave" data-enc="save-open">${esc(t("init.enc.saveList", { what }))}</button>` : ""}
      <button type="button" class="btn tap encsave" data-enc="new">${esc(t("init.enc.new"))}</button>${n || lair ? "" : `<p class="hint">${esc(t("init.enc.newHint"))}</p>`}`; // VB5
  const imp = ui.encImp ? (() => {
    const had = app.encounters.find((e) => e.id === ui.encImp.enc.id);
    return `<div class="confirmbox"><p style="margin:0">${esc(had ? t("init.enc.impHasD", { name: ui.encImp.enc.name, date: dateTxt(had.updatedAt) }) : t("init.enc.impHas", { name: ui.encImp.enc.name }))}</p>
      <div class="bar"><button type="button" class="btn primary" data-enc="imp-replace">${esc(t("init.enc.replace"))}</button><button type="button" class="btn" data-enc="imp-copy">${esc(t("init.enc.asCopy"))}</button><button type="button" class="btn small" data-enc="imp-no">${esc(t("common.cancel"))}</button></div></div>`;
  })() : "";
  const rows = E.sorted(app.encounters).map(rowHtml).join("");
  return `${save}${imp}<div class="enclist">${rows || `<p class="empty">${esc(t("init.enc.empty"))}</p>`}</div>
    <div class="bar encimp"><button type="button" class="btn tap" data-file="enc-file">${esc(t("init.enc.import"))}</button><input id="enc-file" type="file" accept=".json,application/json" hidden></div>
    <p class="hint">${esc(t("init.enc.shareHint"))}</p>`;
}

function rowHtml(e) {
  const r = diffEnc(e), id = esc(e.id), n = monCount(app.S.list);
  const ask = ui.encAsk === e.id
    ? `<div class="confirm encask">${esc(t("init.enc.already", { what: [n && monsN(n), hasLair(app.S.list) && "lair"].filter(Boolean).join(" + ") }))}${app.S.round ? ` ${esc(t("init.enc.stops"))}` : ""}
        <button type="button" class="btn small primary" data-enc="load-replace" data-id="${id}">${esc(t("init.enc.replace"))}</button><button type="button" class="btn small" data-enc="load-add" data-id="${id}">${esc(t("init.enc.add"))}</button><button type="button" class="btn small" data-enc="ask-no">${esc(t("common.cancel"))}</button></div>` : "";
  const menu = ui.encMenu === e.id
    ? `<div class="encmenu"><button type="button" class="btn small" data-enc="edit" data-id="${id}">${esc(t("init.enc.edit"))}</button><button type="button" class="btn small" data-enc="dup" data-id="${id}">${esc(t("init.enc.dup"))}</button><button type="button" class="btn small" data-enc="share" data-id="${id}">${esc(t("init.enc.share"))}</button><button type="button" class="btn small ghost" data-enc="del" data-id="${id}">${esc(t("init.enc.del"))}</button></div>` : "";
  return `<div class="encrow">
    <div class="ehead"><div class="einfo"><b>${esc(e.name)}</b><small>${esc(encSummary(e))} · ${esc(dateTxt(e.updatedAt))}</small>${e.notes ? `<small class="enote">${esc(e.notes)}</small>` : ""}</div>
      ${e.monsters.length ? `<button type="button" class="dchip ${chipCls(r)}" data-enc="why" data-id="${id}" aria-expanded="${ui.encWhy === e.id}" aria-label="${esc(t("init.enc.whyAria", { rating: chipLbl(r), xp: fmt(r.adj) }))}">${esc(chipLbl(r))}</button>` : ""}</div>
    ${ui.encWhy === e.id ? diffWhy(r, !!e.lair, `data-enc="encall" data-id="${id}"`, E.encMons(e, findMon)) : ""}${ask}
    <div class="ebtns"><button type="button" class="btn primary" data-enc="load" data-id="${id}">${esc(t("init.enc.load"))}</button><button type="button" class="btn emore" data-enc="menu" data-id="${id}" aria-expanded="${ui.encMenu === e.id}" aria-label="${esc(t("init.enc.moreAria", { name: e.name }))}">${ico("more")}</button></div>
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
    const tags = [m.hidden && t("init.card.hidden"), m.anon && t("init.card.anon"), m.grp && t("init.enc.grp"), !s && t("init.enc.notHere")].filter(Boolean).join(" · ");
    return `<div class="erow"><span class="en"><b>${esc(m.ref)}</b><small>${s ? `CR ${esc(s.cr || "?")}` : ""}${tags ? `${s ? " · " : ""}${esc(tags)}` : ""}</small></span>
      <span class="step"><button type="button" class="btn" data-enc="n" data-i="${i}" data-v="-1" aria-label="${esc(t(m.n === 1 ? "init.enc.rm" : "init.enc.less", { name: m.ref }))}">−</button><input class="encnum" data-encn="${i}" type="number" inputmode="numeric" min="1" max="${E.MAX_N}" enterkeyhint="done" value="${m.n}" aria-label="${esc(t("init.enc.count", { name: m.ref }))}"><button type="button" class="btn" data-enc="n" data-i="${i}" data-v="1" aria-label="${esc(t("init.enc.more", { name: m.ref }))}" ${E.total(x) >= E.MAX_TOTAL || m.n >= E.MAX_N ? "disabled" : ""}>+</button></span></div>`;
  }).join("");
  return `<button type="button" class="link eback" data-enc="edit-no">‹ ${esc(t("init.add.enc"))}</button>
    <label>${esc(t("init.pc.name"))}<input id="ee-name" maxlength="80" value="${esc(x.name)}" autocomplete="off"></label>
    <label>${esc(t("init.eff.note"))} <span class="opt">${esc(t("init.pc.optional"))}</span><textarea id="ee-notes" maxlength="2000">${esc(x.notes)}</textarea></label>
    <p class="vlbl">Monsters${x.monsters.length ? ` · <span class="dchip ${chipCls(r)}">${esc(chipLbl(r))}</span> ${fmt(r.adj)} XP` : ""}</p>
    <div class="erows">${rows || `<p class="hint">${esc(t("init.enc.noRows"))}</p>`}</div>
    ${lk ? `<label class="chk"><input type="checkbox" id="ee-lair" ${x.lair ? "checked" : ""}> Lair actions (${esc(lk.replace(/^Lair: /, ""))})</label>` : ""}
    <label>+ Monster<input id="ee-q" placeholder="${esc(t("init.enc.qPh"))}" autocomplete="off" enterkeyhint="search" value="${esc(x.q)}"></label>
    <div class="mlist" id="ee-list"></div>
    <div class="bar"><button type="button" class="btn small" data-enc="edit-no">${esc(t("common.cancel"))}</button><button type="button" class="btn primary" data-enc="edit-go">${esc(t("common.save"))}</button></div>`;
}
/** Alleen de zoekresultaten (zoekveld houdt focus) */
function paintEditList() {
  const x = ui.encEdit, box = $("#ee-list");
  if (!x || !box) return;
  const f = filterMonsters(allMonsters(), x.q, null);
  box.hidden = !x.q.trim();
  box.innerHTML = x.q.trim() ? monListHtml({ ...f, L: f.L.slice(0, 40) }, null, "data-eepick", t("init.enc.noneFound")) : "";
}

/* ---------- acties ---------- */
const findEnc = (id) => app.encounters.find((e) => e.id === id);
const repaint = () => paintEnc();

/** Inladen: monsters via addMonsters (HP-keuze uit ui.addOpts, initiative uit de encounter: groep per regel, anders per monster), lair erbij; één undo-stap en één logregel */
function loadEnc(enc, mode) {
  const S = app.S, plan = E.loadPlan(enc, (r) => !!findMon(r));
  const lairNew = plan.lair && (mode === "replace" || !hasLair(S.list));
  if (!plan.adds.length && !lairNew) {
    toastBad(plan.missing.length ? t("init.enc.nothing", { names: plan.missing }) : t("init.enc.lairOnly"));
    return;
  }
  let gone = 0;
  if (mode === "replace") {
    const r = clearMonsters(S); addWhy(r.why); gone = r.n + r.lairs;
    Object.assign(ui, CLEAR_UI);
  }
  if (S.round) because(M("log.w.midFight"));
  // HP volgt de keuze bij monsters toevoegen (ui.addOpts); initiative volgt de encounter zelf: groep per regel, anders per monster
  const before = S.list.length, hpmode = ui.addOpts.hp;
  for (const a of plan.adds) addMonsters(a.ref, a.n, hpmode, a.init === "group" ? "group" : "each", true, null, a.hidden, a.anon);
  if (lairNew) S.list.push(newLair(plan.lair.key, plan.lair.hidden));
  if (mode === "replace" ? !!enc.all !== !!S.allMon : enc.all && !S.allMon) { if (enc.all) S.allMon = true; else delete S.allMon; } // lage CR toch meetellen volgt de encounter
  addEnc(S, enc, mode === "replace"); // naam boven de lijst, notitie (tactiek) in Gevecht (VB2); zelfde undo-stap
  const added = S.list.slice(before), nMon = added.filter((c) => c.kind === "monster").length;
  const what = `${monsN(nMon)}${lairNew ? " + lair" : ""}`;
  logAs(M(gone ? "log.encLoadedRepl" : "log.encLoaded", { name: enc.name, n: nMon, lair: lairNew ? " + lair" : "", gone: gone || "" }));
  because(M("log.w.enc", { name: enc.name }));
  S.sample = false;
  const last = added.filter((c) => c.kind === "monster").at(-1) || added.at(-1);
  Object.assign(ui, { prep: null, prepLast: null, encAsk: null, encMenu: null, mode: null });
  if (last) wantSB(last.id); // tablet/desktop: zijkolom toont het ingeladen monster
  render();
  if (last) scrollToCard(last.id, true);
  const miss = plan.missing.length ? `<br>${esc(t("init.enc.missing", { names: plan.missing }))}` : "";
  toastHtml(`${esc(t("init.enc.loaded", { name: enc.name, what }) + (gone ? ` · ${t("init.enc.replaced", { n: gone })}` : ""))}${miss} ${undoBtn()}`);
}

function saveNew() {
  const d = ui.encDraft, name = (d.name || "").trim();
  if (!name) { toastBad(t("init.enc.errName")); $("#enc-name")?.focus(); return; }
  const e = E.fromList(app.S.list, { id: E.newId(), name, notes: d.notes, now: Date.now(), all: !!app.S.allMon });
  if (!e) { toastBad(t("init.enc.errEmpty")); return; }
  app.encounters = [...app.encounters, e]; saveEncounters();
  ui.encDraft = null; repaint();
  const lost = monCount(app.S.list) - E.total(e); // boven de grenzen (100 monsters, 40 regels) valt de rest weg
  toast(t("init.enc.saved", { name: e.name, what: encSummary(e) }) + (lost > 0 ? ` ${t("init.enc.lost", { n: lost, max: E.MAX_TOTAL })}` : ""));
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
  if (!x.name.trim() && !x.isNew) { toastBad(t("init.enc.errName")); $("#ee-name")?.focus(); return; }
  const e = E.cleanEncounter({ id: x.id, name: x.name.trim() || t("init.enc.newName"), notes: x.notes, monsters: x.monsters, lair: x.lair, all: x.all, updatedAt: Date.now() }); // standaardnaam in de actieve taal; daarna inhoud (§3.4)
  if (!e) { toastBad(t("init.enc.errMin")); return; }
  app.encounters = old ? app.encounters.map((y) => (y.id === x.id ? e : y)) : [...app.encounters, e];
  saveEncounters(); ui.encEdit = null; repaint();
  toast(t(old ? "init.enc.updated" : "init.enc.saved", { name: e.name, what: encSummary(e) }));
}

let lastDel = null;
function delEnc(e) {
  lastDel = e;
  app.encounters = app.encounters.filter((y) => y.id !== e.id); saveEncounters();
  ui.encMenu = null; ui.encWhy = null; repaint();
  // eigen knop (niet toast-undo): ↶ in de beurtbalk zet een encounter niet terug
  toastHtml(`${esc(t("init.enc.deleted", { name: e.name }))} <button class="tundo" id="toast-encundo">${esc(t("common.undo"))}</button>`);
}

const fileName = (name) => `encounter-${String(name).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || t("init.enc.untitled")}.json`;
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
  toast(t("init.enc.downloaded"));
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
  app.encounters = E.mergeEnc(app.encounters, p.enc, mode, Date.now(), t("init.enc.copyWord")); saveEncounters();
  ui.encImp = null; repaint();
  const miss = E.loadPlan(p.enc, (r) => !!findMon(r)).missing;
  toast([t("init.enc.imported", { name: p.enc.name }), nMon ? t("init.enc.impOwn", { n: nMon }) : ""].filter(Boolean).join(" · ") + (miss.length ? `. ${t("init.enc.impMiss", { names: miss })}` : "") + ".");
}
async function importFile(file) {
  let p;
  try { p = E.parseEncFile(JSON.parse(await file.text())); }
  catch (err) { toastBad(err instanceof SyntaxError ? t("init.enc.notFile", { app: APP }) : err.message); return; }
  if (findEnc(p.enc.id)) { ui.encImp = p; ui.encEdit = null; repaint(); return; } // nooit stil overschrijven
  importDone(p, "new");
}

/** VB5: aantal getypt (regels in E.clampCount) */
function setCount(x, i, inp) {
  const m = x.monsters[i]; if (!m) return;
  const r = E.clampCount(x, i, inp.value);
  if (r.n == null) { inp.value = m.n; return; }
  if (r.msg) toastBad(r.msg);
  m.n = r.n; inp.value = r.n;
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
    const c = E.duplicate(e, app.encounters, Date.now(), t("init.enc.copyWord"));
    app.encounters = [...app.encounters, c]; saveEncounters(); ui.encMenu = null; repaint();
    toast(t("init.enc.copy", { name: c.name }));
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
      if (E.total(x) >= E.MAX_TOTAL) { toastBad(t("init.enc.max", { n: E.MAX_TOTAL })); return; }
      const m = x.monsters.find((y) => y.ref === ref && !y.hidden && !y.anon);
      if (m && m.n < E.MAX_N) m.n++;
      else if (x.monsters.length < E.MAX_ROWS) x.monsters.push({ ref, n: 1 });
      x.q = ""; repaint(); $("#ee-q")?.focus();
      toast(t("init.enc.added", { name: ref }));
      return;
    }
    const b = e.target.closest("[data-enc]");
    if (b && ACT[b.dataset.enc]) ACT[b.dataset.enc](b.dataset.id, b);
  });
  el.addEventListener("input", (e) => {
    const el2 = e.target, d = ui.encDraft, x = ui.encEdit;
    if (el2.id === "enc-name" && d) d.name = el2.value;
    else if (el2.id === "enc-notes" && d) d.notes = el2.value;
    else if (el2.id === "ee-name" && x) x.name = el2.value;
    else if (el2.id === "ee-notes" && x) x.notes = el2.value;
    else if (el2.id === "ee-q" && x) { x.q = el2.value; paintEditList(); }
  });
  el.addEventListener("change", async (e) => {
    const el2 = e.target;
    if (el2.id === "ee-lair" && ui.encEdit) { const x = ui.encEdit, k = lairKeyOf(x); x.lair = el2.checked && k ? { key: k, ...(x.lairHidden ? { hidden: true } : {}) } : null; if (!el2.checked && k) x.lairKey = k; }
    if ("encn" in el2.dataset && ui.encEdit) setCount(ui.encEdit, +el2.dataset.encn, el2); // VB5: render volgt na focusout (main.js)
    if (el2.id === "enc-file" && el2.files[0]) { const f = el2.files[0]; el2.value = ""; await importFile(f); }
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
      lastDel = null; closeToast(); repaint(); toast(t("init.enc.restored"));
    }
  });
}
