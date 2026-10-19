// Tekent de encounter (compacte kaarten, één tegelijk open), de beurtbalk, het schade-paneel,
// de party en het logboek. Render past de data niet aan.
import { $, esc, n0 } from "./util.js";
import { app, commit, canUndo } from "../state.js";
import { findMon, allMonsters, filterMonsters } from "../data/monsters.js";
import { sortOrder, CONDS, DURS, durText, durLabel, isOut, parseInit, initPcs } from "../rules/turns.js";
import { PRESETS, effAc, effText, acBreakdown, baseMax, saveMods, modsText, isWarn } from "../rules/effects.js";
import * as R from "../rules/combat.js";
import { ORD, pickList } from "../rules/spells.js";
import { DTYPES, ABS, MODE_LBL, clampDmg, pickFor, aoeOutcome, rollText, saveBonus } from "../rules/aoe.js";
import { diceify, syncSB } from "./statblock.js";
import { monsterActions, dmgKey, useful, isSaveAoe, rcIndex, atkResult, partText, atkDamage, atkAdv, withAdv } from "../rules/attacks.js";
import { sgn } from "../rules/dice.js";
import { laList, laStatus, laOptions, NO_ACT } from "../rules/legendary.js";
import { openSaves } from "../rules/saves.js";
import { avatar } from "./avatar.js";

/** UI-toestand die niet in de encounter (en dus niet in undo/opslag) hoort */
export const ui = {
  open: null,          // id van de open kaart; null = volg wie aan de beurt is; "" = geen
  panel: null,         // "conds" of "more" binnen de open kaart
  sheet: null,         // { id, kind: "dmg"|"heal"|"thp", val: "", mode: 1|0.5|2 }
  condOpt: {}, openCast: new Set(), castPick: null, confirmReset: false, confirmDel: null,
  logOpen: false, editLog: null, partyInit: {},
  mode: null,          // "prep" | "fight"; null = volg het gevecht (loopt → Gevecht, anders Voorbereiden)
  qadd: null,          // { q, sel, n, init: "roll"|"fixed", fix } = snel-toevoegen-paneel open
  aoe: null,           // { dmg, type, ab, dc, t: { [id]: { sel, save, mode|null, roll, lr } } } = AoE-paneel open
  aoeLast: { type: "", ab: "DEX", dc: "" }, // laatst gebruikte type/save/DC (bijv. dezelfde breath weapon)
  atk: null,           // { by, n, label, bo, key, adv, tid, r, parts, modes, force } = aanvalspaneel open (to-hit-knop)
  atkAdv: null,        // { by, v }: advantage/disadvantage blijft staan voor de volgende aanval van dezelfde aanvaller
  initDraft: null,     // { v: { id: tekst }, act: id, fresh, rolls: { id: tekst } } = initiative-paneel bij Start gevecht
  atkPrev: null,       // { by, id }: vorige doel van deze aanvaller (bovenaan in de lijst)
  edit: null,          // { id, name, ac, max, init } = concept in het bewerkpaneel (⋯)
  effWho: null,        // { id, i } = preset met concentratie wacht op "Wie cast?"
  effJoin: null,       // { id, p, by, cast } = laatste "nieuwe cast" (Bless), voor "Hoort erbij" in de melding
  effCustom: false, effForm: {}, // eigen effect: formulier open + concept
  atkOpen: null,       // id: aanvallen uitgeklapt (ander monster) of alle regels (monster aan de beurt)
  atkRx: null,         // id: reactions/legendary uitgeklapt bij het monster aan de beurt
  la: null,            // id of "*" = legendary-paneel open (één monster of alle)
  laPulse: false,      // net Volgende getikt: legendary-knoppen lichten één keer op
  sv: false,           // paneel met alle open saves (bij 3 of meer)
  svRetry: null,       // { sid, id, step } = laatst gerolde monster-save, voor "Legendary Resistance" / "Advantage" in de melding
};
export const openId = () => (ui.open === null ? app.S.active : ui.open);
export const mode = () => ui.mode || (app.S.round ? "fight" : "prep");

/** Na elke render (bijv. het spelersscherm bijwerken); render zelf blijft zonder bijwerkingen op de data */
let afterRender = () => {};
export const setAfterRender = (fn) => { afterRender = fn; };

export function render() {
  commit();
  paintMode();
  paintEncounter();
  paintDock();
  paintSheet();
  paintQadd();
  paintAoe();
  paintAtk();
  paintInit();
  paintLa();
  paintSv();
  paintParty();
  paintLog();
  syncSB(app.S, openId(), sbChips);
  afterRender();
}

/** Voorbereiden: alles. Gevecht: alleen lijst + beurtbalk (CSS verbergt de rest via body[data-mode]) */
function paintMode() {
  const m = mode();
  document.body.dataset.mode = m;
  document.querySelectorAll("[data-setmode]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.setmode === m));
  $("#qadd").hidden = m !== "fight";
}

/* ---------- onderdelen van een kaart ---------- */
const hpBar = (c) => {
  const pct = c.max ? Math.max(0, c.hp) / c.max : 1;
  const cls = pct <= 0.25 ? "low" : pct <= 0.5 ? "mid" : "";
  return `<div class="hpw"><div class="bar" aria-hidden="true"><i class="${cls}" style="width:${pct * 100}%"></i></div>
    <span class="hpn">${n0(c.hp)}/${n0(c.max)}${c.temp ? ` <span class="thp">+${n0(c.temp)}</span>` : ""}</span></div>`;
};

function condChips(c, S, interactive) {
  return c.cond.map((x) => {
    const dt = durText(c, x, S.list);
    const dl = dt ? ` · ${esc(dt)}` : "";
    if (x === "Concentrating") {
      const label = `Concentrating${c.concSpell ? ` · ${esc(c.concSpell)}` : ""}${dl}`;
      return interactive ? `<button class="bd cc cbtn" data-a="dropconc" title="Concentratie beëindigen">${label} <span aria-hidden="true">✕</span><span class="vh">beëindigen</span></button>` : `<span class="bd cc">${label}</span>`;
    }
    return `<span class="bd cc">${x}${dl}</span>`;
  }).join("");
}

/** Samenvatting voor een gesloten kaart */
/** AC in de kop: effectief, in accentkleur als effecten hem veranderen */
function acMeta(c) {
  const ac = effAc(c);
  return ac ? `AC <b class="${ac !== c.ac ? "acx" : ""}">${n0(ac)}</b>` : "";
}

/** Effect-chips: in de open kaart knoppen om weg te halen, dicht alleen tekst (korte duur) */
function effChips(c, S, interactive) {
  const E = c.eff || [];
  return [...E.filter(isWarn), ...E.filter((e) => !isWarn(e))].map((e) => {
    const w = isWarn(e), cls = w ? "bd r" : "bd ef";
    const by = e.by && e.by !== c.id ? S.list.find((x) => x.id === e.by) : null;
    const dur = e.d ? durLabel(e.d, S.list, !interactive) : e.lr ? "long rest" : "";
    const t = [`${e.n}${e.st ? " " + effText(e) : ""}`, w ? e.txt : "", dur, by ? by.name : ""].filter(Boolean).map(esc).join(" · ");
    return interactive ? `<button class="${cls} cbtn" data-a="effdel" data-e="${esc(e.id)}" title="Effect weghalen">${t} <span aria-hidden="true">✕</span><span class="vh">weghalen</span></button>`
      : `<span class="${cls}">${t}</span>`;
  }).join("");
}

/** Conditie- en effect-chips (alleen tekst) voor de speler-sheet in het zijpaneel */
const sbChips = (c) => condChips(c, app.S, false) + effChips(c, app.S, false);

const hidBadge = (c) => (c.hidden ? `<span class="bd hid" title="Spelers zien deze deelnemer niet">verborgen</span>` : "");

function badges(c, S) {
  const out = [hidBadge(c), condChips(c, S, false), effChips(c, S, false)];
  if (c.kind === "pc" && c.max && c.hp <= 0) {
    const d = c.ds || R.newDs();
    out.push(d.dead ? `<span class="bd r">Dood</span>` : d.stable ? `<span class="bd g">Stabiel</span>` : `<span class="bd r">Death saves ✓${d.s} ✗${d.f}</span>`);
  }
  if (c.casting && c.casting.slots.length) out.push(`<span class="bd b">Slots ${c.casting.slots.map((x) => n0(x.left)).join("·")}</span>`);
  else if (c.casting && c.casting.daily.length) out.push(`<span class="bd b">Spells</span>`);
  (c.res || []).forEach((r) => out.push(`<span class="bd b">${esc(r.n)} ${n0(r.left)}/${n0(r.max)}</span>`));
  (c.rc || []).forEach((r) => out.push(`<span class="bd ${r.ready ? "g" : ""}">${esc(r.n)} ${r.ready ? "klaar" : "op"}</span>`));
  if (c.la) out.push(`<span class="bd r">LA ${n0(c.la.left)}</span>`);
  if (c.lr) out.push(`<span class="bd r">LR ${n0(c.lr.left)}/dag</span>`);
  if (c.reaction) out.push(`<span class="bd">Reaction gebruikt</span>`);
  const html = out.join("");
  return html ? `<div class="badges">${html}</div>` : "";
}

function pips(o, key, label) {
  if (!o) return "";
  return `<div class="pips"><span class="lbl">${label} ${n0(o.left)}/${n0(o.max)}</span>${Array.from({ length: n0(o.max) }, (_, i) =>
    `<button class="pip ${key}" data-pip="${key}" data-i="${i}" aria-pressed="${i >= o.left}" aria-label="${label} ${i + 1}"></button>`).join("")}</div>`;
}

function defLine(c) {
  if (!c.ref) return "";
  const m = findMon(c.ref);
  if (!m || !m.x) return "";
  const get = (l) => (m.x.find((x) => x[0] === l) || [])[1];
  const parts = [["Kwetsbaar", "Damage Vulnerabilities"], ["Resist", "Damage Resistances"], ["Immuun", "Damage Immunities"]]
    .map(([n, l]) => (get(l) ? `${n}: <b>${esc(get(l))}</b>` : "")).filter(Boolean);
  return parts.length ? `<div class="defl">${parts.join(" · ")}</div>` : "";
}

function dsBlock(c) {
  if (c.kind !== "pc" || !c.max || c.hp > 0) return "";
  const d = c.ds || R.newDs();
  const p = (k, n, l) => Array.from({ length: 3 }, (_, i) => `<button class="dsp ${k}" data-ds="${k}" data-i="${i}" aria-pressed="${i < n}" aria-label="${l} ${i + 1}"></button>`).join("");
  const st = d.dead ? `<span class="st dead">Dood</span>` : d.stable ? `<span class="st ok">Stabiel</span>`
    : `<button class="btn small primary" data-a="ds-roll">Rol death save</button><button class="link" data-a="ds-crit">Kritiek geraakt (+2)</button>`;
  return `<div class="ds"><span class="lbl">Death saves</span>
    <span class="dsg">Success ${p("s", d.s, "Success")}</span><span class="dsg">Failure ${p("f", d.f, "Failure")}</span>${st}</div>`;
}

function castBlock(c) {
  const k = c.casting;
  if (!k || (!k.slots.length && !k.daily.length)) return "";
  const pp = (o, attr) => Array.from({ length: n0(o.max) }, (_, i) => `<button class="pip" ${attr} data-i="${i}" aria-pressed="${i >= o.left}" aria-label="slot ${i + 1}"></button>`).join("");
  const sum = k.slots.length ? k.slots.map((x) => `${x.lvl}:${n0(x.left)}`).join(" · ") : k.daily.map((g) => esc(g.label)).join(", ");
  const pick = (x) => ui.castPick && ui.castPick.id === c.id && ui.castPick.lvl === x.lvl
    ? `<div class="pick"><span class="hint">Welke spell?</span>${pickList(c, x.lvl).map((sp) =>
      `<button class="btn small ${sp.conc ? "conc" : ""}" data-pickspell="${esc(sp.n)}" data-conc="${sp.conc ? 1 : ""}">${esc(sp.n)}${sp.lv < x.lvl ? ` (${sp.lv}e, upcast)` : ""}${sp.conc ? " · conc." : ""}</button>`).join("")}<button class="link" data-pickspell="">Andere / overslaan</button></div>` : "";
  return `<details class="cast" data-cast ${ui.openCast.has(c.id) || ui.castPick?.id === c.id ? "open" : ""}><summary class="link strong">Spells <span style="font-weight:400">(${sum})</span></summary>
    <div class="castbox">
      ${k.slots.map((x, i) => `<div class="slotrow"><span class="lv">${ORD[x.lvl] || ""}</span><span class="pp">${pp(x, `data-slot="${i}"`)}</span><span class="sp">${esc(x.spells)}</span></div>${pick(x)}`).join("")}
      ${k.daily.map((g, gi) => g.items.map((it, ii) => `<div class="slotrow"><span class="lv">${esc(g.label.split(" ")[0])}</span><span class="pp">${pp(it, `data-daily="${gi}.${ii}"`)}</span><span class="sp">${esc(it.n)}</span></div>`).join("")).join("")}
      <div><button class="link" data-a="cast-reset">Alles herstellen (long rest)</button></div>
    </div></details>`;
}

function resBlock(c) {
  if (!c.res || !c.res.length) return "";
  return `<div class="castbox">${c.res.map((o, i) => `<div class="resrow"><span class="rn">${esc(o.n)}</span>
    <span class="pp">${o.max <= 10 ? Array.from({ length: n0(o.max) }, (_, j) => `<button class="pip" data-res="${i}" data-i="${j}" aria-pressed="${j >= o.left}" aria-label="${esc(o.n)} ${j + 1}"></button>`).join("")
      : `<button class="btn small" data-res="${i}" data-step="-1">−</button><b style="font-variant-numeric:tabular-nums;padding:0 6px">${n0(o.left)}/${n0(o.max)}</b><button class="btn small" data-res="${i}" data-step="1">+</button>`}</span>
    <span class="sp">${o.max <= 10 ? `${n0(o.left)}/${n0(o.max)} · ` : ""}per ${o.rest === "Short Rest" ? "short rest" : "long rest"}</span></div>`).join("")}</div>`;
}

function condPanel(c) {
  const opt = ui.condOpt[c.id] || {};
  return `<div class="kpanel">
    <div class="durrow">
      <label>Duur bij aanzetten<select data-f="cdur">${DURS.map(([v, l]) => `<option value="${v}" ${(opt.dur || "inf") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label>Save aan einde beurt<span style="display:flex;gap:4px"><select data-f="cab"><option value="">geen</option>${["STR", "DEX", "CON", "INT", "WIS", "CHA"].map((a) => `<option ${opt.ab === a ? "selected" : ""}>${a}</option>`).join("")}</select><input data-f="cdc" type="number" inputmode="numeric" placeholder="DC" value="${esc(opt.dc || "")}" style="width:64px"></span></label>
    </div>
    <div class="condgrid">${CONDS.map((x) => `<button type="button" data-cond="${x}" aria-pressed="${c.cond.includes(x)}">${x}</button>`).join("")}</div></div>`;
}


/** Voorbeeld van het effect van Opslaan op de HP */
export function editPreview(c) {
  const ed = ui.edit;
  if (!ed || ed.id !== c.id) return "";
  const parts = [];
  const nm = String(ed.max).trim() === "" ? null : parseInt(ed.max);
  if (nm != null && nm > 0 && nm !== baseMax(c)) {
    const sim = { ...c }; R.setMax(sim, nm + (c.max - baseMax(c)));
    parts.push(`HP ${n0(c.hp)}/${n0(c.max)} → ${n0(sim.hp)}/${n0(sim.max)}`);
  }
  const ac = parseInt(ed.ac);
  if ((c.eff || []).some((e) => e.st === "ac")) parts.push(`basis-AC; nu ${effAc({ ...c, ac: Number.isFinite(ac) ? ac : c.ac })} met effecten`);
  if (c.pid) parts.push("wijzigt ook de vaste party");
  if (!String(ed.name).trim()) parts.push(`<b class="bad">naam mag niet leeg zijn</b>`);
  else if (app.S.list.some((x) => x !== c && x.name.toLowerCase() === String(ed.name).trim().toLowerCase())) parts.push("let op: deze naam bestaat al");
  return parts.map((t) => (t.startsWith("<b") ? t : esc(t))).join(" · ");
}

function morePanel(c) {
  const del = ui.confirmDel === c.id;
  const ed = ui.edit && ui.edit.id === c.id ? ui.edit : { name: c.name, ac: c.ac || "", max: baseMax(c) || "", init: c.init };
  const hpd = (c.max || 0) - baseMax(c);
  return `<div class="kpanel more">
    <div class="edit">
      <label>Naam<input data-f="ed-name" value="${esc(ed.name)}" autocomplete="off" maxlength="120"></label>
      <div class="ed3">
        <label>AC<input data-f="ed-ac" type="number" inputmode="numeric" min="0" max="40" value="${esc(ed.ac)}"></label>
        <label>Max HP${hpd ? ` <small>(${hpd > 0 ? "+" : "−"}${Math.abs(hpd)} effect)</small>` : ""}<input data-f="ed-max" type="number" inputmode="numeric" min="1" value="${esc(ed.max)}"></label>
        <label>Initiative<input data-f="ed-init" type="number" inputmode="numeric" value="${esc(ed.init)}"></label>
      </div>
      <p class="hint edprev" aria-live="polite">${editPreview(c)}</p>
      <div class="bar"><button class="btn tap" data-a="ed-cancel">Annuleer</button><button class="btn primary tap" data-a="ed-save">Opslaan</button></div>
    </div>
    <div class="bar">${c.kind === "pc" && !c.pid ? `<button class="btn small" data-a="topty">Naar vaste party</button>` : ""}
    ${c.kind === "monster" ? `<button class="btn small" data-a="hide" aria-pressed="${!!c.hidden}">${c.hidden ? "Tonen aan spelers" : "Verbergen voor spelers"}</button>` : ""}
    <button class="btn small danger" data-a="del">${del ? "Zeker? Tik nogmaals" : "Verwijder uit gevecht"}</button></div></div>`;
}

/** Effectpaneel: presets (1 tik), "Wie cast?" voor concentratie zonder beurt, of een eigen effect */
function effPanel(c) {
  const S = app.S;
  if (ui.effWho && ui.effWho.id === c.id) {
    const p = PRESETS[ui.effWho.i];
    return `<div class="kpanel"><p class="hint">Wie cast <b>${esc(p.n)}</b>? (concentratie)</p>
      <div class="effgrid">${S.list.filter((x) => x.kind !== "lair").map((x) => `<button class="btn tap" data-a="effby" data-by="${esc(x.id)}">${esc(x.name)}</button>`).join("")}</div>
      <button class="link" data-a="effwho-no">Annuleer</button></div>`;
  }
  const act = S.list.find((x) => x.id === S.active);
  const f = ui.effForm;
  const custom = ui.effCustom ? `<div class="effform">
      <label>Naam<input data-f="ef-n" value="${esc(f.n || "")}" placeholder="bijv. Life Drain" maxlength="60"></label>
      <div class="ed3">
        <label>Op<select data-f="ef-k">${[["ac+", "AC +/−"], ["ac=", "AC wordt"], ["acmin", "AC minimaal"], ["max", "Max HP +/−"], ["txt", "Alleen tekst"]].map(([v, l]) => `<option value="${v}" ${(f.k || "ac+") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label>Waarde<input data-f="ef-v" type="number" inputmode="numeric" value="${esc(f.v ?? "")}"></label>
        <label>Duur<select data-f="ef-dur">${[...DURS, ["lr", "Tot long rest"]].map(([v, l]) => `<option value="${v}" ${(f.dur || "inf") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      </div>
      <label>Notitie<input data-f="ef-txt" value="${esc(f.txt || "")}" placeholder="bijv. +1d4 op saves" maxlength="120"></label>
      <label>Concentratie van<select data-f="ef-by"><option value="">geen</option>${S.list.filter((x) => x.kind !== "lair").map((x) => `<option value="${esc(x.id)}" ${f.by === x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>
      <button class="btn primary tap" data-a="eff-add">Toevoegen</button></div>` : "";
  return `<div class="kpanel">
    <div class="effgrid">${PRESETS.map((p, i) => {
      const off = p.st === "ac" && p.op === "+" && !c.ac;
      return `<button class="btn tap" data-a="effp" data-i="${i}" ${off ? `disabled title="Vul eerst AC in (⋯)"` : ""}>${esc(p.n)}<small>${esc(p.dex ? "AC 13 + Dex" : p.st ? effText(p) : p.txt.split(" op ")[0])}${p.conc ? " · conc" : ""}</small></button>`;
    }).join("")}<button class="btn tap" data-a="effcustom" aria-pressed="${ui.effCustom}">+ Eigen effect</button></div>
    ${!c.ac ? `<p class="hint">Geen AC bekend: AC + is uit. Vul AC in via ⋯.</p>` : ""}
    <p class="hint">Concentratie-spells: caster is ${act ? `<b>${esc(act.name)}</b> (aan de beurt)` : "je kiest zelf"}. Zelfde effect opnieuw = vernieuwen.</p>
    ${custom}</div>`;
}

function actionsBlock(c) {
  const sideBtn = c.ref ? `<button data-a="sb">Statblock</button>` : c.sheet ? `<button data-a="sheet">Sheet</button>` : `<button data-a="panel" data-p="more" aria-pressed="${ui.panel === "more"}">⋯</button>`;
  const gone = (c.ds && c.ds.dead) || (c.kind === "monster" && isOut(c));
  return `<div class="acts">
    ${c.max ? `<button class="dmg2 wide" data-a="sheet-open" data-kind="dmg">− Schade</button><button class="heal2" data-a="sheet-open" data-kind="heal">+ Heal</button>` : ""}
    <button data-a="react" aria-pressed="${!!c.reaction}">${c.reaction ? "Reaction ✓" : "Reaction"}</button>
    <button data-a="panel" data-p="conds" aria-pressed="${ui.panel === "conds"}">Conditie</button>
    <button data-a="panel" data-p="eff" aria-pressed="${ui.panel === "eff"}" ${gone ? "disabled" : ""}>Effect</button>
    ${sideBtn}
    ${c.ref || c.sheet ? `<button data-a="panel" data-p="more" aria-pressed="${ui.panel === "more"}" aria-label="Meer">⋯</button>` : ""}
  </div>
  ${ui.panel === "conds" ? condPanel(c) : ui.panel === "more" ? morePanel(c) : ui.panel === "eff" && !gone ? effPanel(c) : ""}`;
}

/* ---------- aanvallen op de monsterkaart ---------- */
const SHORT = { piercing: "pierc.", bludgeoning: "bludg.", slashing: "slash." };
const MAIN_MAX = 4; // regels bij het monster aan de beurt (Multiattack telt mee), daarna "+N meer"

function atkRow(a, cid, la) {
  // zonder worp of DC (Detect, Parry): korte tekst eronder, de rest staat in het statblock
  const sub = [a.tag, a.reach, a.hit !== null && a.dc ? `DC ${a.dc.n} ${a.dc.ab}` : "", useful(a) ? "" : a.text].filter(Boolean).join(" · ");
  const lab = a.label || a.n; // label in de rolmelding (legendary: naam van de optie)
  const key = dmgKey(a.dmg), flat = a.dmg.filter((x) => !x.e);
  const hit = a.hit !== null && cid ? `<button class="d hit" data-atk="${esc(a.an || a.n)}" data-cid="${esc(cid)}" data-label="${esc(lab)}"${la != null ? ` data-la-i="${la}"` : ""} aria-label="${esc(lab)}: aanval ${sgn(a.hit)} to hit, doel kiezen">${sgn(a.hit)}</button>`
    : a.hit !== null ? `<button class="d hit" data-roll="1d20${sgn(a.hit)}" data-hit="1" data-label="${esc(lab)}" aria-label="${esc(lab)}: aanval ${sgn(a.hit)} to hit">${sgn(a.hit)}</button>`
    : isSaveAoe(a) && cid ? `<button class="d dcb" data-aoe="${esc(a.n)}" data-cid="${esc(cid)}" aria-label="${esc(lab)}: DC ${a.dc.n} ${a.dc.ab}, AoE-paneel openen">DC ${a.dc.n} ${a.dc.ab}<small>AoE ▸</small></button>`
    : a.dc ? `<span class="dc">DC ${a.dc.n} ${a.dc.ab}</span>` : "<span></span>";
  const dmg = key ? `<button class="d dm" data-dmg="${esc(key)}" data-label="${esc(lab)}" aria-label="${esc(lab)}: damage rollen">${esc(a.dmg.map((x) => x.e || x.flat).join(" + "))}<small>${esc(a.dmg.map((x) => SHORT[x.type] || x.type).join(" + "))}</small></button>`
    : flat.length ? `<span class="dflat">${esc(flat.map((x) => `${x.flat} ${x.type}`).join(" + "))}</span>` : "<span></span>";
  return `<div class="ar"><span class="an">${esc(a.n)}${sub ? `<small>${esc(sub)}</small>` : ""}</span>${hit}${dmg}</div>`;
}

/** Monster aan de beurt: aanvallen open (max 4 regels); ander open monster: één ingeklapte regel (opportunity attack, legendary) */
function atkBlock(c, S) {
  if (c.kind !== "monster" || isOut(c)) return "";
  const A = c.ref ? monsterActions(findMon(c.ref)) : null;
  if (!A) return "";
  const turn = c.id === S.active, all = ui.atkOpen === c.id;
  const n = A.main.length + A.other.length;
  // klare recharge-actie (Acid Breath) direct na Multiattack, zodat hij niet achter "+N meer" valt
  const ready = (a) => { const i = rcIndex(c.rc, a.n); return i >= 0 && c.rc[i].ready; };
  const main = A.main.some(ready) ? [...A.main.filter(ready), ...A.main.filter((a) => !ready(a))] : A.main;
  const row = (a) => atkRow(a, c.id);
  if (!turn && !all) return `<button class="atkfold" data-a="atk-open" aria-expanded="false">Aanvallen${n ? ` (${n})` : ""} <span aria-hidden="true">▸</span></button>`;
  const room = turn && !all ? Math.max(1, MAIN_MAX - (A.multi ? 1 : 0)) : A.main.length;
  const hidden = A.main.length - room;
  const rx = !turn || ui.atkRx === c.id;
  const multi = A.multi ? `<p class="multi"><b>Multiattack:</b> ${esc(A.multi.text)}</p>` : "";
  const other = !A.other.length ? "" : rx
    ? `${turn ? `<button class="atkfold sub" data-a="atk-rx" aria-expanded="true">Reactions · Legendary <span aria-hidden="true">▾</span></button>` : ""}${A.other.map(row).join("")}`
    : `<button class="atkfold sub" data-a="atk-rx" aria-expanded="false">Reactions · Legendary (${A.other.length}) <span aria-hidden="true">▸</span></button>`;
  return `<div class="atk">
    ${!turn ? `<button class="atkfold" data-a="atk-close" aria-expanded="true">Aanvallen <span aria-hidden="true">▾</span></button>` : ""}
    ${multi}${main.slice(0, room).map(row).join("")}
    <div class="atkmore">${hidden > 0 ? `<button class="link" data-a="atk-open">+${hidden} meer</button>` : "<span></span>"}<button class="link" data-a="sb">Volledig statblock</button></div>
    ${other}</div>`;
}

function lairRow(c, S) {
  const acts = app.lairs[c.key] || [];
  const keys = [...new Set([c.key, ...Object.keys(app.lairs), ...S.list.filter((x) => x.la).map((x) => "Lair: " + x.ref)])];
  return `<li class="c k lair ${c.id === S.active ? "turn" : ""}" data-id="${esc(c.id)}">
    <div class="i">${n0(c.init)}</div>
    <div class="n"><select class="lairsel" data-f="lairkey" aria-label="Welke lair">${keys.map((k) => `<option ${k === c.key ? "selected" : ""}>${esc(k)}</option>`).join("")}</select></div>
    <div class="meta">lair</div>
    <div class="kbody">
    <div class="lacts">${acts.length ? acts.map((a, i) => `<div class="lact ${c.last === a.n ? "used" : ""}">
        <p><b>${esc(a.n)}.</b> ${diceify(a.t)}</p>
        <div class="bar">${c.last === a.n ? `<span class="hint">Vorige keer gebruikt, nu niet toegestaan</span>` : `<button class="btn small" data-a="lair-use" data-i="${i}">Gebruik</button>`}
        <button class="link" data-a="lair-del" data-i="${i}">Verwijder</button></div></div>`).join("")
      : `<p class="hint">Nog geen lair actions voor deze lair. Voeg ze hieronder toe; ze worden bewaard voor volgende keren.</p>`}</div>
    <details class="conds" ${acts.length ? "" : "open"}><summary class="link">Lair action toevoegen</summary>
      <div class="form" style="margin-top:8px">
        <label>Naam<input data-f="la-n" placeholder="bijv. Magma Eruption"></label>
        <label>Effect<textarea data-f="la-t" style="min-height:80px" placeholder="Magma erupts from a point... DC 15 Dexterity saving throw or take 21 (6d6) fire damage."></textarea></label>
        <button class="btn small primary" data-a="lair-add">Opslaan</button></div></details>
    <div class="row3"><span class="hint">Initiative 20, verliest gelijke stand.</span><button class="link" data-a="del">Lair verwijderen</button></div></div></li>`;
}

function row(c, S) {
  if (c.kind === "lair") return lairRow(c, S);
  const open = openId() === c.id;
  const turn = c.id === S.active;
  return `<li class="c k ${c.kind === "pc" ? "pc" : "mon"} ${open ? "open" : ""} ${turn ? "turn" : ""} ${isOut(c) ? "out" : ""}" data-id="${esc(c.id)}">
    <button class="khead" data-a="open" aria-expanded="${open}" aria-label="${esc(c.name)}${open ? ", sluiten" : ", openen"}">
      <span class="i">${n0(c.init)}${turn ? `<span class="tri" aria-hidden="true">▶</span>` : ""}</span>
      <span class="n">${avatar(c, c.ref ? findMon(c.ref)?.meta : "")}<span class="nm">${esc(c.name)}</span></span>
      <span class="meta">${isOut(c) && c.kind === "monster" ? "neer" : acMeta(c)}</span>
      ${c.max ? hpBar(c) : ""}
    </button>
    ${open ? `<div class="kbody">
      ${c.hidden || c.cond.length || (c.eff || []).length ? `<div class="badges">${hidBadge(c)}${condChips(c, S, true)}${effChips(c, S, true)}</div>` : ""}
      ${acBreakdown(c) ? `<p class="hint acb">AC ${n0(effAc(c))} = ${esc(acBreakdown(c))}</p>` : ""}
      ${defLine(c)}
      ${dsBlock(c)}
      ${atkBlock(c, S)}
      ${c.rc && c.rc.length ? `<div class="rcs">${c.rc.map((r, i) => `<button class="rc" data-rc="${i}" aria-pressed="${!!r.ready}" title="Tik om te markeren als gebruikt of beschikbaar">${esc(r.n)} · ${r.ready ? "klaar" : r.rest ? "na rust" : `recharge ${n0(r.min)}–6`}</button>`).join("")}</div>` : ""}
      ${pips(c.la, "la", "Legendary actions")}${pips(c.lr, "lr", "Legendary resistance per dag")}
      ${actionsBlock(c)}
      ${castBlock(c)}
      ${resBlock(c)}
    </div>` : badges(c, S)}
  </li>`;
}

function paintEncounter() {
  const S = app.S;
  const L = sortOrder(S.list);
  const pcs = S.list.filter((c) => c.kind === "pc"), mons = S.list.filter((c) => c.kind === "monster");
  $("#sum").innerHTML = L.length
    ? `${S.round ? `<span>Ronde <b>${S.round}</b></span>` : ""}${pcs.length ? `<span>Party <b>${pcs.filter((c) => !c.max || c.hp > 0).length}/${pcs.length}</b></span>` : ""}${mons.length ? `<span>Vijanden <b>${mons.filter((c) => c.hp > 0).length}/${mons.length}</b></span>` : ""}`
    : "";
  $("#order").innerHTML = L.map((c) => row(c, S)).join("")
    || `<li class="hint" style="padding:20px;text-align:center">Nog niemand aan tafel. ${mode() === "fight" ? "Voeg spelers en monsters toe onder Voorbereiden." : "Voeg hieronder spelers en monsters toe."}</li>`;
  $("#resetbar").innerHTML = ui.confirmReset
    ? S.list.some((c) => c.kind !== "pc")
      ? `<div class="confirm">Wat wissen?<button class="btn small primary" id="reset-mons">Monsters wissen, spelers houden</button><button class="btn small ghost" id="reset-yes">Alles</button><button class="btn small" id="reset-no">Annuleer</button></div>`
      : `<div class="confirm">Alles wissen?<button class="btn small primary" id="reset-yes">Ja, wis encounter</button><button class="btn small" id="reset-no">Annuleer</button></div>`
    : `${S.list.some((c) => c.kind === "lair") ? "" : `<button class="btn small" id="addlair">+ Lair actions (init 20)</button>`}${S.list.length ? `<button class="btn small ghost" id="reset">Encounter wissen</button>` : ""}${S.round ? `<button class="btn small ghost" id="stop">Gevecht stoppen</button>` : ""}
       ${S.sample ? `<p class="note">De deelnemers hierboven zijn voorbeelden. Wis ze en voeg je eigen groep toe.</p>` : ""}`;
}

function paintDock() {
  const S = app.S;
  const L = sortOrder(S.list);
  const undoBtn = `<button id="undo" ${canUndo() ? "" : "disabled"} aria-label="Ongedaan maken" title="Ongedaan maken">↶</button>`;
  if (!S.round) {
    $("#dock").innerHTML = `<div class="who"><span><span class="l">Encounter</span><br><b>${L.length} deelnemer${L.length === 1 ? "" : "s"}</b></span></div>
      ${svBar(S)}<div class="row one">${undoBtn}<button class="nx" id="start" ${L.length ? "" : "disabled"}>Start gevecht</button></div>`;
    return;
  }
  const i = L.findIndex((c) => c.id === S.active);
  const act = L[i];
  let nxt = null;
  for (let k = 1; k <= L.length; k++) { const c = L[(i + k) % L.length]; if (c && !isOut(c) && c.id !== S.active) { nxt = c; break; } }
  $("#dock").innerHTML = `<div class="who"><span><span class="l">Aan de beurt</span><br><b>${act ? esc(act.name) : "–"}</b></span><span class="r">Ronde ${S.round}${nxt ? ` · volgende: ${esc(nxt.name)}` : ""}</span></div>
    ${svBar(S)}${laBar(S, L)}<div class="row">${undoBtn}<button id="prev" aria-label="Vorige beurt">‹</button><button class="aoeb" id="aoe" aria-label="Area of effect: schade op meerdere doelen" ${aoeTargets().length ? "" : "disabled"}>AoE</button><button class="nx" id="next">Volgende<span class="nb"> beurt</span> ›</button></div>`;
}

/* ---------- open saves: regels in de beurtbalk (max 2) of één knop met paneel ---------- */
/** Bonus voor de knop "Rol": statblock-save of ability-modifier (Bless/Bane en cover tellen bij het rollen mee) */
export const svBonus = (c, ab) => saveBonus(c.ref ? findMon(c.ref) : null, ab);

function svRow(S, s) {
  const c = S.list.find((x) => x.id === s.id);
  const what = s.kind === "conc" ? `concentratie${c.concSpell ? ` · ${c.concSpell}` : ""}` : `${s.n} · einde beurt`;
  const btns = c.kind === "monster"
    ? `<button type="button" class="svroll" data-svroll="${esc(s.sid)}" aria-label="${esc(c.name)}: ${esc(s.ab)}-save rollen, DC ${s.dc}">Rol ${sgn(svBonus(c, s.ab))}</button>`
    : `<button type="button" class="svok" data-svok="${esc(s.sid)}" data-v="1" aria-label="${esc(c.name)}: ${esc(s.ab)}-save geslaagd">✓</button><button type="button" class="svok bad" data-svok="${esc(s.sid)}" data-v="0" aria-label="${esc(c.name)}: ${esc(s.ab)}-save gefaald">✗</button>`;
  return `<div class="svrow"><span class="svn"><b>${esc(c.name)}</b><small>${esc(`${s.ab} ${s.dc} · ${what}`)}</small></span>${btns}</div>`;
}

function svBar(S) {
  const O = openSaves(S);
  if (!O.length) return "";
  if (O.length > 2) return `<div class="svbar"><button type="button" class="svall" data-svsheet="1">Saves · ${O.length} open <span aria-hidden="true">▸</span></button></div>`;
  return `<div class="svbar">${O.map((s) => svRow(S, s)).join("")}</div>`;
}

export function paintSv() {
  const el = $("#ssheet");
  const O = ui.sv ? openSaves(app.S) : [];
  if (!O.length) { ui.sv = false; el.hidden = true; el.innerHTML = ""; return; }
  const mons = O.filter((s) => (app.S.list.find((x) => x.id === s.id) || {}).kind === "monster").length;
  const old = el.querySelector(".ssheet"), top = old ? old.scrollTop : 0;
  el.innerHTML = `<div class="dim" data-svsheet="0"></div>
    <div class="sheet qsheet ssheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="s-title">
      <div class="grab" aria-hidden="true"></div>
      <div class="shead"><h3 id="s-title">Open saves</h3><button type="button" class="link" data-svsheet="0">Sluit</button></div>
      <div class="svbar">${O.map((s) => svRow(app.S, s)).join("")}</div>
      ${mons > 1 ? `<button type="button" class="btn primary qgo" data-svrollall="1">Rol alle monsters (${mons})</button>` : ""}
      <p class="hint">Niet afgehandeld vervalt na de volgende beurtwissel, zonder gevolg.</p>
    </div>`;
  el.hidden = false;
  el.querySelector(".ssheet").scrollTop = top;
}

/* ---------- legendary actions: vaste regel in de beurtbalk + paneel ---------- */
const LA_WHY = { own: "herstelt nu", empty: "0 over", inc: "incapacitated" };
const LA_TITLE = { own: "Aan de beurt: legendary actions herstellen", empty: "Op: herstelt bij de eigen beurt", inc: "Incapacitated: geen legendary actions" };
const dots = (o) => { const m = Math.max(0, n0(o.max)), l = Math.min(m, Math.max(0, n0(o.left))); return "●".repeat(l) + "○".repeat(m - l); };

/** Zolang een levend monster met legendary actions meedoet staat de regel er (dus geen verspringende beurtbalk); uit = gedimd */
function laBar(S, L) {
  const M = laList(S, L);
  if (!M.length) return "";
  const pulse = (ok) => (ok && ui.laPulse ? " pulse" : "");
  if (M.length > 2) {
    const ok = M.some((c) => laStatus(c, S) === "ok");
    return `<div class="larow"><button class="lachip${ok ? "" : " off"}${pulse(ok)}" data-la="*" aria-label="Legendary actions van ${M.length} monsters">
      <span class="ln">Legendary · ${M.length} monsters</span><span aria-hidden="true">▸</span></button></div>`;
  }
  return `<div class="larow">${M.map((c) => {
    const st = laStatus(c, S), ok = st === "ok";
    return `<button class="lachip${ok ? "" : " off"}${pulse(ok)}" data-la="${esc(c.id)}" ${ok ? "" : "disabled"} title="${ok ? "Legendary actions" : LA_TITLE[st]}"
      aria-label="Legendary actions ${esc(c.name)}: ${n0(c.la.left)} van ${n0(c.la.max)} over${ok ? "" : ", " + LA_TITLE[st]}">
      <span class="ln">${esc(c.name)}</span><span class="ld">${ok ? dots(c.la) : LA_WHY[st]}</span><span aria-hidden="true">▸</span></button>`;
  }).join("")}</div>`;
}

/** Opties per monster; zonder statblock-opties één algemene optie (1 LA) */
export const laOpts = (c) => {
  const o = c.ref ? laOptions(findMon(c.ref)) : [];
  return o.length ? o : [{ n: "Legendary action", cost: 1, text: "", act: null, refs: [] }];
};

function laMon(c, S) {
  const st = laStatus(c, S), ok = st === "ok";
  const opts = laOpts(c).map((o, i) => {
    // eigen worp (Wing Attack) zonder de naam te herhalen; verwijzing (Tail Attack → Tail) met de naam van de aanval
    const rows = o.act ? [{ ...o.act, n: "Worp", an: o.act.n, label: o.n }] : o.refs;
    const can = ok && o.cost <= n0(c.la.left);
    return `<div class="lao">
      <div class="lah"><span class="an">${esc(o.n)}<small>${o.cost} LA</small></span>
        <button type="button" class="btn small${can ? " primary" : ""}" data-lause="${esc(c.id)}" data-i="${i}" ${can ? "" : "disabled"}
          aria-label="${esc(o.n)} gebruiken (${o.cost} LA)">Gebruik</button></div>
      ${rows.map((a) => atkRow({ ...a, tag: "" }, c.id, i)).join("")}
      ${!rows.length && o.text ? `<p class="latxt">${esc(o.text)}</p>` : ""}</div>`;
  }).join("");
  return `<section class="lamon"><div class="lamh"><b>${esc(c.name)}</b><span class="ld">${dots(c.la)} <small>${n0(c.la.left)}/${n0(c.la.max)} over</small></span></div>
    ${ok ? "" : `<p class="hint">${esc(LA_TITLE[st])}.</p>`}${opts}</section>`;
}

/** Paneel opnieuw opbouwen (geen invoervelden), scrollpositie bewaren */
export function paintLa() {
  const el = $("#lsheet");
  const S = app.S;
  const M = ui.la ? laList(S, sortOrder(S.list)).filter((c) => ui.la === "*" || c.id === ui.la) : [];
  if (!M.length) { ui.la = null; el.hidden = true; el.innerHTML = ""; return; }
  const old = el.querySelector(".lsheet"), top = old ? old.scrollTop : 0;
  el.innerHTML = `<div class="dim" data-lsh="close"></div>
    <div class="sheet qsheet lsheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="l-title">
      <div class="grab" aria-hidden="true"></div>
      <div class="shead"><h3 id="l-title">Legendary actions</h3><button type="button" class="link" data-lsh="close">Sluit</button></div>
      <p class="hint">Aan het einde van de beurt van een ander wezen, één tegelijk. Herstelt bij de eigen beurt.</p>
      ${M.map((c) => laMon(c, S)).join("")}
    </div>`;
  el.hidden = false;
  el.querySelector(".lsheet").scrollTop = top;
}

/* ---------- schade-paneel ---------- */
export function sheetPreview(c, kind, v, mode) {
  const sim = structuredClone(c);
  let fx;
  if (kind === "dmg") fx = R.applyDamage(sim, v, mode);
  else if (kind === "heal") fx = R.heal(sim, v);
  else fx = R.giveTemp(sim, v);
  return { sim, fx };
}

function paintSheet() {
  const el = $("#sheet");
  const s = ui.sheet;
  const c = s && app.S.list.find((x) => x.id === s.id);
  if (!c) { el.hidden = true; el.innerHTML = ""; return; }
  const v = parseInt(s.val) || 0;
  let preview = "";
  if (v) {
    const { sim } = sheetPreview(c, s.kind, v, s.mode);
    const hp = (x) => `${n0(x.hp)}${x.temp ? ` (+${n0(x.temp)} temp)` : ""}`;
    preview = `${hp(c)} → <b>${hp(sim)} HP</b>`;
    if (s.kind === "dmg") {
      const dealt = Math.floor(v * s.mode);
      if (s.mode !== 1) preview += ` · ${dealt} na ${{ 0.5: "resist", 2: "kwetsbaar", 0: "immuun" }[s.mode]}`;
      if (sim.ds && sim.ds.dead && !(c.ds && c.ds.dead)) preview += ` · <b class="bad">sterft</b>`;
      else if (sim.hp === 0 && c.hp > 0) preview += ` · <b class="bad">${c.kind === "pc" ? "bewusteloos" : "neer"}</b>`;
      else if (c.cond.includes("Concentrating") && sim.hp > 0 && dealt > 0) preview += ` · concentration save <b>DC ${Math.max(10, Math.floor(dealt / 2))}</b>`;
    }
  } else preview = `Nu ${n0(c.hp)}/${n0(c.max)} HP${c.temp ? ` (+${n0(c.temp)} temp)` : ""}`;
  const kinds = [["dmg", "Schade"], ["heal", "Heal"], ["thp", "Temp HP"]];
  const label = { dmg: `${v || ""} schade toepassen`, heal: `${v || ""} HP genezen`, thp: `${v || ""} temp HP geven` }[s.kind];
  el.hidden = false;
  el.innerHTML = `<div class="dim" data-sk="close"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(c.name)}: ${kinds.find((k) => k[0] === s.kind)[1]}">
      <div class="grab" aria-hidden="true"></div>
      <div class="shead"><h3>${esc(c.name)}</h3><button class="link" data-sk="close">Annuleer</button></div>
      <div class="seg2">${kinds.map(([k, l]) => `<button data-sk="kind" data-v="${k}" aria-pressed="${s.kind === k}">${l}</button>`).join("")}</div>
      ${s.kind === "dmg" ? `<div class="seg2 sm">${[[1, "Normaal"], [0.5, "Resist ½"], [2, "Kwetsb. ×2"], [0, "Immuun"]].map(([m, l]) => `<button data-sk="mode" data-v="${m}" aria-pressed="${s.mode === m}">${l}</button>`).join("")}</div>` : ""}
      <div class="disp" aria-live="polite">${esc(s.val || "0")}</div>
      <div class="preview">${preview}</div>
      <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-sk="d" data-v="${n}">${n}</button>`).join("")}<button data-sk="back" aria-label="Wissen">⌫</button><button data-sk="d" data-v="0">0</button><button data-sk="clear" aria-label="Alles wissen">C</button>
        <button class="go go-${s.kind}" data-sk="apply" ${v ? "" : "disabled"}>${label}</button></div>
    </div>`;
}

/* ---------- snel toevoegen tijdens het gevecht ---------- */
/** Bouwt het paneel één keer per opening en werkt daarna alleen de delen bij, zodat het zoekveld focus houdt */
export function paintQadd() {
  const el = $("#qsheet"), q = ui.qadd;
  if (!q) { el.hidden = true; el.innerHTML = ""; return; }
  if (!el.firstChild) {
    el.innerHTML = `<div class="dim" data-q="close"></div>
    <div class="sheet qsheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="q-title">
      <div class="grab" aria-hidden="true"></div>
      <div class="shead"><h3 id="q-title">Mee in het gevecht</h3><button type="button" class="link" data-q="close">Annuleer</button></div>
      <label>Zoek monster<input id="q-q" placeholder="goblin, wolf, cultist…" autocomplete="off" enterkeyhint="search"></label>
      <div class="mlist qlist" id="q-list"></div>
      <div class="qrow">
        <div class="qcol"><span class="qlbl" id="q-nl">Aantal</span>
          <div class="stepper" role="group" aria-labelledby="q-nl"><button type="button" data-q="n" data-v="-1" aria-label="Minder">−</button><output id="q-n" aria-live="polite"></output><button type="button" data-q="n" data-v="1" aria-label="Meer">+</button></div></div>
        <div class="qcol"><span class="qlbl" id="q-il">Initiative</span>
          <div class="seg2" role="group" aria-labelledby="q-il"><button type="button" data-q="init" data-v="roll">Rollen</button><button type="button" data-q="init" data-v="fixed">Invullen</button></div></div>
      </div>
      <label id="q-fixw">Initiative<input id="q-fix" type="number" inputmode="numeric" placeholder="bijv. 14"></label>
      <p class="hint">Ze komen op hun initiative in de volgorde. Zit dat vóór wie nu aan de beurt is, dan doen ze pas volgende ronde mee.</p>
      <button type="button" class="btn primary qgo" data-q="go"></button>
    </div>`;
    el.hidden = false;
  }
  const f = filterMonsters(allMonsters(), q.q, q.sel);
  q.sel = f.sel; // UI-toestand: de selectie volgt wat zichtbaar is (zoals in de Monster-tab)
  $("#q-list").innerHTML = f.L.map((m) => `<button type="button" data-qpick="${esc(m.n)}" aria-pressed="${m.n === q.sel}"><span>${esc(m.n)}${m.custom ? " · eigen" : ""}</span><span class="cr">CR ${esc(m.cr || "?")} · ${n0(m.hp) || "?"} HP</span></button>`).join("")
    || `<p class="hint" style="padding:10px">Niets gevonden. Eigen monsters maak je onder Voorbereiden.</p>`;
  $("#q-n").textContent = q.n;
  el.querySelectorAll('[data-q="init"]').forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === q.init));
  $("#q-fixw").hidden = q.init !== "fixed";
  const go = el.querySelector(".qgo");
  go.disabled = !q.sel || (q.init === "fixed" && parseInit(q.fix) === null);
  go.textContent = q.sel ? `${q.n > 1 ? `${q.n}× ` : ""}${q.sel} toevoegen` : "Kies een monster";
}

/* ---------- AoE: één schadeworp op meerdere doelen ---------- */
/** Wie geraakt kan worden: iedereen met HP die nog meedoet (spelers op 0 HP ook: dat kost een death save). ex = bron van een save-actie */
export const aoeTargets = (ex = null) => sortOrder(app.S.list).filter((c) => c.kind !== "lair" && c.max && !isOut(c) && c.id !== ex);

/** Effectieve keuze per doelwit (mode null = volg het statblock voor het gekozen damage type) */
export function aoePick(a, c) {
  const m = c.ref ? findMon(c.ref) : null;
  return pickFor(a.t[c.id], m && m.x, a.type);
}

const MODES = [[1, "Normaal"], [0.5, "Resist"], [2, "×2"], [0, "Immuun"]];
const SAVES = [["fail", "Gefaald"], ["half", "Geslaagd ½"], ["none", "0"]];
const SAVES0 = [["fail", "Gefaald"], ["none", "Geslaagd 0"]]; // save-actie zonder halve schade (Wing Attack)
/** Uitkomst van een geslaagde save in dit paneel */
export const okSave = (a) => (a && a.half === false ? "none" : "half");

function aoeRow(a, c, p, o, n) {
  const id = esc(c.id), nm = esc(c.name), dc = parseInt(a.dc);
  const end = !n ? "" : o.res ? ` · <b class="bad">${o.res}</b>` : c.hp > 0 ? ` · ${n0(c.hp)} → ${n0(o.hp)} HP` : "";
  const mods = p.roll ? [] : saveMods(c, a.ab);
  const info = [
    p.roll ? `${esc(a.ab)} save ${esc(rollText(p.roll, dc))}` : mods.length ? `Bij de save: ${esc(modsText(mods))}` : "",
    p.auto && p.mode !== 1 && a.type ? `${MODE_LBL[p.mode]} (statblock)` : "",
    p.auto && p.def.cond ? `let op: ${esc(p.def.cond)}` : "",
  ].filter(Boolean).join(" · ");
  const lrLeft = c.lr ? n0(c.lr.left) : 0;
  const lrBtn = p.lr ? `<span class="hint">Legendary resistance: save geslaagd</span>`
    : p.save === "fail" && lrLeft > 0 ? `<button type="button" class="link" data-ao="lr" data-id="${id}">Legendary resistance gebruiken (${lrLeft} over)</button>` : "";
  return `<div class="at ${p.sel ? "" : "off"}">
    <label class="atop"><input type="checkbox" data-ao="sel" data-id="${id}" ${p.sel ? "checked" : ""}>
      <span class="atn"><span>${nm}</span> <span class="tag ${c.kind === "pc" ? "" : "m"}">${c.kind === "pc" ? "speler" : "monster"}</span><small>${n0(c.hp)}/${n0(c.max)} HP${c.temp ? ` +${n0(c.temp)}` : ""}</small></span>
      ${p.sel && n ? `<b class="adealt ${o.dealt ? "" : "zero"}">−${o.dealt}</b>` : ""}</label>
    ${p.sel ? `<div class="seg2 sm" role="group" aria-label="Save ${nm}">${(a.half === false ? SAVES0 : SAVES).map(([v, l]) => `<button type="button" data-ao="save" data-id="${id}" data-v="${v}" aria-pressed="${p.save === v}"${v === "none" && a.half !== false ? ` aria-label="Geen schade (bijv. Evasion)" title="Geen schade (bijv. Evasion)"` : ""}>${l}</button>`).join("")}</div>
      <div class="seg2 sm" role="group" aria-label="Weerstand ${nm}">${MODES.map(([v, l]) => `<button type="button" data-ao="mode" data-id="${id}" data-v="${v}" aria-pressed="${p.mode === v}">${l}</button>`).join("")}</div>
      <div class="acalc">${n ? o.steps.join(" → ") + end : "Vul de schade in"}${info ? `<br>${info}` : ""}</div>${lrBtn}` : ""}
  </div>`;
}

/** Paneel één keer opbouwen; daarna alleen de lijst en de knop, zodat het schadeveld focus houdt */
export function paintAoe() {
  const el = $("#asheet"), a = ui.aoe;
  if (!a) { el.hidden = true; el.innerHTML = ""; return; }
  if (!el.firstChild) {
    el.innerHTML = `<div class="dim" data-ao="close"></div>
    <div class="sheet qsheet asheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="a-title">
      <div class="grab" aria-hidden="true"></div>
      <div class="shead"><h3 id="a-title">${a.title ? esc(a.title) : "AoE-schade"}</h3><button type="button" class="link" data-ao="close">Annuleer</button></div>
      <div class="arow">
        <label>Schade<input id="a-dmg" type="number" inputmode="numeric" min="0" max="999" placeholder="28" enterkeyhint="done"></label>
        <label>Damage type<select id="a-type"><option value="">geen / onbekend</option>${DTYPES.map((t) => `<option value="${t}">${t[0].toUpperCase() + t.slice(1)}</option>`).join("")}</select></label>
      </div>
      <div class="asrc hint" id="a-src" aria-live="polite"></div>
      <div class="asave"><span class="qlbl">Save</span>
        <select id="a-ab" aria-label="Save-ability">${ABS.map((x) => `<option>${x}</option>`).join("")}</select>
        <input id="a-dc" type="number" inputmode="numeric" placeholder="DC" aria-label="DC" min="1" max="40">
        <button type="button" class="btn small" data-ao="roll">Rol monsters</button></div>
      <div class="asel"><span class="qlbl" id="a-cnt"></span><span><button type="button" class="link" data-ao="all" data-v="monster">Monsters</button><button type="button" class="link" data-ao="all" data-v="pc">Spelers</button><button type="button" class="link" data-ao="all" data-v="">Niemand</button></span></div>
      <div class="alist" id="a-list"></div>
      <div class="afoot"><span class="hint" id="a-sum" aria-live="polite"></span><button type="button" class="btn primary qgo ago" data-ao="go"></button></div>
    </div>`;
    $("#a-dmg").value = a.dmg; $("#a-type").value = a.type; $("#a-ab").value = a.ab; $("#a-dc").value = a.dc;
    el.hidden = false;
  }
  // per paint één keer per doel: keuze (statblock-opzoeking) en uitkomst (gesimuleerd op een kopie)
  const src = $("#a-src");
  src.hidden = !a.roll;
  if (a.roll) src.innerHTML = `${esc(a.roll)} <button type="button" class="link" data-ao="reroll">Opnieuw</button>${a.extra ? `<br>${esc(a.extra)}: apart toepassen` : ""}${a.used ? `<br><b class="bad">${esc(a.act)} is nog niet herladen</b>` : ""}`;
  const L = aoeTargets(a.src), n = clampDmg(a.dmg);
  const rows = L.map((c) => { const p = aoePick(a, c); return { c, p, o: p.sel && n ? aoeOutcome(c, p, n) : { dealt: 0, steps: [], res: "", hp: c.hp } }; });
  const sel = rows.filter((x) => x.p.sel);
  $("#a-list").innerHTML = rows.map((x) => aoeRow(a, x.c, x.p, x.o, n)).join("") || `<p class="hint">Niemand om te raken.</p>`;
  $("#a-cnt").textContent = `Doelwitten · ${sel.length} gekozen`;
  const total = sel.reduce((s, x) => s + x.o.dealt, 0), down = sel.filter((x) => x.o.down).length;
  $("#a-sum").textContent = n && sel.length ? `Totaal ${total} schade${down ? ` · ${down} neer` : ""}` : "";
  const go = el.querySelector(".ago");
  go.disabled = !n || !sel.length;
  go.textContent = !n ? "Vul de schade in" : !sel.length ? "Kies doelwitten" : `${n}${a.type ? " " + a.type : ""} toepassen op ${sel.length} doel${sel.length === 1 ? "" : "en"}`;
}

/* ---------- aanval op één doel (to-hit-knop op de monsterkaart) ---------- */
const ADVS = [["a", "Auto"], [1, "Adv"], [-1, "Dis"], [0, "Normaal"]];
const ADV_W = { 1: "Advantage", "-1": "Disadvantage", 0: "Normaal" };
const XMODES = [[1, "Normaal"], [0.5, "Resist ½"], [2, "Kwetsb. ×2"], [0, "Immuun"]];
const AUTO_CRIT = ["Paralyzed", "Unconscious"];

/** Wie een aanval kan krijgen: niet de aanvaller, geen lair, geen dode speler of monster op 0 HP (spelers op 0 HP wel) */
export const atkTargets = (by) => sortOrder(app.S.list).filter((c) => c.kind !== "lair" && c.id !== by && !isOut(c));

/** Shield (reaction, +5) aanbieden: speler die kan reageren (niet op 0 HP/incapacitated), geraakt maar niet met een natuurlijke 20, en +5 AC zou missen */
export const shieldOk = (c, x, r, res) => c.kind === "pc" && c.hp > 0 && !c.cond.some((k) => NO_ACT.includes(k)) && res.hit && !x.force.hit && r.nat !== 20 && !c.reaction
  && !(c.eff || []).some((e) => e.n === "Shield") && r.tot < effAc(c) + 5;

/** Effectieve worp tegen dit doel: Auto = advantage/disadvantage uit condities (atkAdv), anders de handmatige stand */
export function atkRoll(x, by, c) {
  const au = atkAdv(by, c, x.kind);
  return { au, r: withAdv(x.r, x.adv === "a" ? au.v : x.adv) };
}
/** Reden als korte tag: "adv Prone", "dis Invisible", "adv/dis heffen op" */
const advTag = (au) => (!au.adv.length && !au.dis.length ? "" : au.v ? `${au.v > 0 ? "adv" : "dis"} ${(au.v > 0 ? au.adv : au.dis).map((t) => t.replace(/ \(.*\)$/, "").split(" ").pop()).join(", ")}` : "adv/dis heffen op");
const advWhy = (au) => (au.v > 0 ? au.adv : au.v < 0 ? au.dis : []).join(", ");

/** Kan de LA van deze aanval nu betaald worden? */
export const laCan = (x, by) => !!x.la && laStatus(by, app.S) === "ok" && x.la.cost <= n0(by.la && by.la.left);

/** Schakelaar "−2 LA" bij een aanval uit het legendary-paneel */
function laToggle(x, by) {
  const L = x.la, left = n0(by.la && by.la.left), can = laCan(x, by);
  return `<div class="xrow xla"><button type="button" class="btn small" data-xa="la" aria-pressed="${can && L.on}" ${can ? "" : "disabled"}>−${L.cost} LA</button>
    <span class="hint">${can ? `Legendary action: ${esc(L.n)}${L.on ? "" : " (niet aftrekken)"}` : laStatus(by, app.S) === "ok" ? `Te duur (${left} over)` : "Kan nu geen legendary action nemen"}</span></div>`;
}

function atkTgtRow(c, prev, x, by) {
  const ac = effAc(c), tag = advTag(atkAdv(by, c, x.kind));
  return `<button type="button" class="xt" data-xa="tgt" data-id="${esc(c.id)}">${avatar(c, c.ref ? findMon(c.ref)?.meta : "")}
    <span class="xn">${esc(c.name)}${prev ? ` <span class="tag">vorige</span>` : ""}</span>
    <span class="xi">${ac ? `AC ${n0(ac)}` : "AC ?"}${c.max ? ` · ${n0(c.hp)}/${n0(c.max)} HP` : ""}${tag ? `<b class="xadvt">${esc(tag)}</b>` : ""}</span></button>`;
}

function atkPick(x, by) {
  const L = atkTargets(by.id), prev = ui.atkPrev && ui.atkPrev.by === by.id ? L.find((c) => c.id === ui.atkPrev.id) : null;
  const rest = L.filter((c) => c !== prev), pcs = rest.filter((c) => c.kind === "pc"), mons = rest.filter((c) => c.kind !== "pc");
  return `<div class="seg2 sm xadv" role="group" aria-label="Advantage">${ADVS.map(([v, l]) => `<button type="button" data-xa="adv" data-v="${v}" aria-pressed="${x.adv === v}">${l}</button>`).join("")}</div>
    ${x.la ? laToggle(x, by) : ""}
    <div class="xlist">${prev ? atkTgtRow(prev, true, x, by) : ""}${pcs.map((c) => atkTgtRow(c, false, x, by)).join("")}
    ${mons.length ? `<p class="qlbl xsub">Monsters</p>${mons.map((c) => atkTgtRow(c, false, x, by)).join("")}` : ""}
    ${L.length ? "" : `<p class="hint">Niemand om aan te vallen.</p>`}</div>
    <div class="afoot"><button type="button" class="link" data-xa="free">Zonder doel rollen</button><span></span></div>`;
}

/** "d20 [14, <s>6</s>] +11 = 25 vs AC 16": de d20 die niet telt doorgestreept */
function atkHtml(r, ac) {
  const used = r.d.length > 1 ? r.d.indexOf(r.nat) : 0;
  const dice = r.d.map((v, i) => (i === used ? String(v) : `<s>${v}</s>`)).join(", ");
  return `d20 [${dice}] ${r.bo >= 0 ? "+" : "−"}${Math.abs(r.bo)} = ${r.tot}${ac ? ` vs AC ${ac}` : ""}`;
}

/** Welke modus en waarom: "Advantage (Ayla Prone)", "Handmatig: Advantage · auto: dis (Invisible)" */
function advLine(x, au, r) {
  if (x.adv !== "a") return `Handmatig: ${ADV_W[r.adv]}${au.v !== r.adv ? ` · auto: ${esc(advTag(au) || "normaal")}` : ""}`;
  if (au.v) return `${ADV_W[au.v]} (${esc(advWhy(au))})`;
  return au.adv.length ? "Normaal (adv en dis heffen op)" : "";
}

function atkRes(x, c, by) {
  const { au, r } = atkRoll(x, by, c);
  const ac = effAc(c) || 0, res = atkResult(r, ac, x.parts, x.modes, x.force);
  const word = res.crit ? "Kritiek!" : res.hit ? (res.natHit ? "Raak" : "Toch raak") : r.nat === 1 ? "Mis (nat 1)" : "Mis";
  const crit = c.cond.filter((k) => AUTO_CRIT.includes(k));
  const hints = [
    !ac ? "AC onbekend: vergelijk zelf" : "",
    crit.length ? `${esc(c.name)}: ${esc(crit.join(", "))} · binnen 5 ft is een treffer kritiek` : "",
    ...au.hint.map(esc),
  ].filter(Boolean);
  const how = advLine(x, au, r);
  let body = "", foot = "";
  if (res.hit) {
    const sim = structuredClone(c), was = c.hp;
    if (c.max) atkDamage(sim, res);
    const end = !c.max ? "" : sim.ds && sim.ds.dead && !(c.ds && c.ds.dead) ? ` · <b class="bad">sterft</b>`
      : was > 0 && sim.hp <= 0 ? ` · <b class="bad">${c.kind === "pc" ? "bewusteloos" : "neer"}</b>`
      : c.kind === "pc" && was <= 0 && res.dealt ? ` · <b class="bad">${res.crit ? "twee failures" : "death save failure"}</b>` : "";
    body = `${x.parts.length ? `<div class="xdmg">${x.parts.map((p) => esc(partText(p, res.crit))).join("<br>")}</div>` : `<p class="hint">Geen schade-worp in deze aanval.</p>`}
      ${res.types.map((t) => `<div class="xmode"><span class="qlbl">${esc(t.type || "schade")}</span><div class="seg2 sm" role="group" aria-label="Weerstand ${esc(t.type)}">${XMODES.map(([v, l]) => `<button type="button" data-xa="mode" data-t="${esc(t.type)}" data-v="${v}" aria-pressed="${t.mode === v}">${l}</button>`).join("")}</div></div>`).join("")}
      <div class="xrow"><button type="button" class="btn small" data-xa="crit" aria-pressed="${res.crit}">Kritiek</button>
      <span class="acalc">${c.max ? `${n0(c.hp)} → ${n0(sim.hp)} HP${end}` : "HP onbekend"}</span></div>`;
    foot = `${shieldOk(c, x, r, res) ? `<button type="button" class="btn" data-xa="shield">Shield +5</button>` : "<span></span>"}
      <button type="button" class="btn primary qgo" data-xa="go" ${c.max && res.dealt ? "" : "disabled"}>${!c.max ? "HP onbekend" : res.dealt ? `${res.dealt} schade toepassen` : "Geen schade"}</button>`;
  } else {
    const spend = x.la && x.la.on && laCan(x, by);
    foot = `<button type="button" class="link" data-xa="force">Toch raak</button><button type="button" class="btn primary qgo" data-xa="${spend ? "miss" : "close"}">${spend ? `Sluit (−${x.la.cost} LA)` : "Sluit"}</button>`;
  }
  return `<button type="button" class="link xback" data-xa="back">‹ Ander doel</button>
    <p class="xhit"><b class="${res.hit ? "ok" : "bad"}">${word}</b> ${atkHtml(r, ac)}</p>
    ${how ? `<p class="xhow">${how}</p>` : ""}
    ${hints.length ? `<p class="hint">${hints.join("<br>")}</p>` : ""}
    ${x.la ? laToggle(x, by) : ""}
    ${body}<div class="afoot">${foot}</div>`;
}

export function paintAtk() {
  const el = $("#xsheet"), x = ui.atk;
  const by = x && app.S.list.find((c) => c.id === x.by);
  const c = x && x.tid && app.S.list.find((t) => t.id === x.tid && !isOut(t)); // doel intussen dood/neer (Ongedaan): terug naar de lijst
  if (!x || !by) { el.hidden = true; el.innerHTML = ""; return; }
  el.innerHTML = `<div class="dim" data-xa="close"></div>
    <div class="sheet qsheet xsheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="x-title">
      <div class="grab" aria-hidden="true"></div>
      <div class="shead"><h3 id="x-title">${esc(x.label)} → ${c ? esc(c.name) : "doel?"}</h3><button type="button" class="link" data-xa="close">Annuleer</button></div>
      ${c ? atkRes(x, c, by) : atkPick(x, by)}
    </div>`;
  el.hidden = false;
}

/* ---------- initiative van spelers bij Start gevecht ---------- */
export function paintInit() {
  const el = $("#isheet"), x = ui.initDraft;
  if (!x) { el.hidden = true; el.innerHTML = ""; return; }
  const L = initPcs(app.S.list), mons = app.S.list.filter((c) => c.kind === "monster").length;
  const last = L.length && L[L.length - 1].id === x.act;
  el.innerHTML = `<div class="dim" data-ia="close"></div>
    <div class="sheet qsheet isheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="i-title">
      <div class="grab" aria-hidden="true"></div>
      <div class="shead"><h3 id="i-title">Initiative spelers</h3><button type="button" class="link" data-ia="close">Annuleer</button></div>
      ${mons ? `<p class="hint">Monsters: initiative al gerold (${mons}).</p>` : ""}
      <div class="ilist">${L.map((c) => `<div class="ir ${c.id === x.act ? "act" : ""}">
        <button type="button" class="irn" data-ia="sel" data-id="${esc(c.id)}" aria-pressed="${c.id === x.act}" aria-label="${esc(c.name)}: initiative ${esc(x.v[c.id] || "leeg")}"><span>${esc(c.name)}</span>${x.rolls[c.id] ? `<small>${esc(x.rolls[c.id])}</small>` : ""}</button>
        <b class="iv" aria-hidden="true">${x.v[c.id] !== "" && x.v[c.id] != null ? esc(x.v[c.id]) : "—"}</b>
        <button type="button" class="btn small" data-ia="roll" data-id="${esc(c.id)}" aria-label="Initiative rollen voor ${esc(c.name)}">Rol</button></div>`).join("")}</div>
      <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-ia="d" data-v="${n}">${n}</button>`).join("")}<button type="button" data-ia="back" aria-label="Wissen">⌫</button><button type="button" data-ia="d" data-v="0">0</button><button type="button" data-ia="clear" aria-label="Leegmaken">C</button></div>
      <div class="ifoot"><button type="button" class="btn" data-ia="next" ${last ? "disabled" : ""}>Volgende ›</button><button type="button" class="btn primary qgo" data-ia="go">Start gevecht</button></div>
    </div>`;
  el.hidden = false;
}

/* ---------- party en logboek ---------- */
export function paintParty() {
  const el = $("#party-panel");
  const at = new Set(app.S.list.filter((c) => c.pid).map((c) => c.pid));
  if (!app.party.length) {
    el.innerHTML = `<p class="hint">Nog geen vaste party. Spelers die je toevoegt met "Ook opslaan in vaste party" komen hier, inclusief geïmporteerde sheets. HP, spell slots en resources lopen dan door van gevecht naar gevecht tot een rust.</p>`;
    return;
  }
  el.innerHTML = `<div>${app.party.map((m) => {
    const sl = m.casting && m.casting.slots.length ? " · slots " + m.casting.slots.map((x) => `${n0(x.left)}/${n0(x.max)}`).join(" ") : "";
    const rs = (m.res || []).map((r) => ` · ${esc(r.n)} ${n0(r.left)}/${n0(r.max)}`).join("");
    return `<div class="pm">${avatar({ ...m, kind: "pc" })}<div><div class="pn">${esc(m.name)}</div><div class="pi">${m.sheet && m.sheet.cls ? esc(m.sheet.cls) + " · " : ""}${m.ac ? `AC ${n0(m.ac)} · ` : ""}${m.max ? `HP ${n0(m.hp)}/${n0(m.max)}${m.temp ? ` +${n0(m.temp)}` : ""}` : ""}${sl}${rs}</div></div>
      <div class="pc">${at.has(m.pid) ? `<span class="here">aan tafel</span>` : `<input data-pinit="${esc(m.pid)}" type="number" inputmode="numeric" placeholder="init" aria-label="Initiative ${esc(m.name)}" value="${esc(ui.partyInit[m.pid] ?? "")}"><button type="button" class="btn small" data-proll="${esc(m.pid)}">Rol</button>`}
        <button type="button" class="link" data-pdel="${esc(m.pid)}">Uit party</button></div></div>`;
  }).join("")}</div>
    <div class="bar"><button type="button" class="btn small" id="p-rollall">Rol voor iedereen</button><button type="button" class="btn primary" id="p-add">Party aan tafel zetten</button></div>
    <div class="bar"><button type="button" class="btn small" id="p-short">Short rest</button><button type="button" class="btn small" id="p-long">Long rest</button></div>
    <p class="hint">Rust geldt voor de hele party, ook wie aan tafel zit. Long rest: volle HP, slots en resources. Short rest: resources met "per short rest".</p>`;
}

export function paintLog() {
  const el = $("#logwrap");
  const L = app.S.log || [];
  const items = !ui.logOpen ? "" : [...L].reverse().map((e) => {
    if (e.type === "round") return `<li class="lg-round">${esc(e.msg)}</li>`;
    if (e.type === "turn") return `<li class="lg-turn">${esc(e.msg)}</li>`;
    return `<li class="lg"><span class="lg-meta">R${n0(e.r) || "–"}${e.turn ? ` · beurt ${esc(e.turn)}` : ""}</span>
      <span class="lg-msg">${esc(e.msg)}</span>
      ${e.why ? `<span class="lg-why">${esc(e.why)}</span>` : ""}
      ${ui.editLog === e.id ? `<input class="lg-in" data-lognote="${esc(e.id)}" value="${esc(e.note || "")}" placeholder="Waarom? bijv. Fireball van Wolfim" aria-label="Reden">`
        : e.note ? `<button class="lg-note" data-logedit="${esc(e.id)}">${esc(e.note)}</button>` : `<button class="link lg-add" data-logedit="${esc(e.id)}">+ reden</button>`}</li>`;
  }).join("");
  el.innerHTML = `<details class="logbox" id="logbox" ${ui.logOpen ? "open" : ""}><summary><span>Logboek</span> <span class="hint">${L.filter((e) => !e.type).length} gebeurtenissen</span></summary>
    ${L.length ? `<div class="bar" style="margin:8px 0"><button class="btn small" id="logcopy">Kopieer als tekst</button></div><ol class="lglist">${items}</ol>`
      : `<p class="hint">Nog niets gebeurd. Schade, condities, spells, death saves en beurten verschijnen hier automatisch, met ronde en oorzaak.</p>`}</details>`;
  if (ui.editLog) { const i = el.querySelector(".lg-in"); if (i) i.focus(); }
}
