// Tekent de encounter (compacte kaarten, één tegelijk open), de beurtbalk, het schade-paneel,
// de party en het logboek. Render past de data niet aan.
import { MAC } from "./keys.js";
import { paintSetStat } from "./settings.js";
import { $, esc, n0, spellLink } from "./util.js";
import { app, commit, canUndo } from "../state.js";
import { findMon, allMonsters, filterMonsters } from "../data/monsters.js";
import { sortOrder, CONDS, DURS, durText, durLabel, isOut, parseInit, initPcs, groupOf, isSurprised, reactUsed, REACT_TAG, canToggleSurprise, nextUp, freshRoll, initPlan, initText } from "../rules/turns.js";
import { PRESETS as PRESETS_14, presetsFor, effAc, effText, acBreakdown, baseMax, saveMods, modsText, isWarn, effName, isRage, rageOf, rageRes, barbLevel, rageDmg } from "../rules/effects.js";
import { isExh, exhLevel, exhSummary } from "../rules/conditions.js";
import * as R from "../rules/combat.js";
import { ORD, pickList, splitSpells, edFor, sheetEd } from "../rules/spells.js";
import { DTYPES, ABS, MODE_LBL, clampDmg, pickFor, aoeOutcome, rollText, saveBonus, saveKnown, targetMode, drText, drKind, DR_LBL, saveAdv } from "../rules/aoe.js";
import { spellItem } from "../data/spells.js";
import { diceify, syncSB, monCard, isPhone } from "./statblock.js";
import { monsterActions, dmgKey, useful, isSaveAoe, rcIndex, atkResult, partText, atkDamage, atkAdv, withAdv } from "../rules/attacks.js";
import { sgn } from "../rules/dice.js";
import { laList, laStatus, laOptions, NO_ACT } from "../rules/legendary.js";
import { hasUF, ufDc, ufNeed, ufInfo, riderWhat, riderFor, parryOf, canParry } from "../rules/monrules.js";
import { openSaves, lastTurn } from "../rules/saves.js";
import { avatar, icon, monType } from "./avatar.js";
import { SPELLS, SPELL_CONDS, customSpell, spellTargets, spellDefault, condImmune, spellFor, rulesDiffer, slotFor } from "../rules/spellcast.js";
import { DMG_SPELLS } from "../rules/dmgtable.js";
import { spellDice, casterLevel, ownDmgSpells, findDmgSpells } from "../rules/dmgspells.js";
import { slotChoices, defaultSlot, slotLevel, slotName } from "../rules/slots.js";
import { rulesEd } from "./spellrules.js";
import { initRoll } from "./initroll.js";
import { ANON, anonName } from "../playerview.js";
import { paintEnc, encBanner, encStrip } from "./encounters.js";
import { paintEnd, endBanner } from "./einde.js";
import { PAS, passives, pasText, sheetPassives, percList } from "../rules/passives.js";
import { pcReact } from "./pcreact.js";
import { clsLevel } from "../rules/encounters.js";
import { oldMons, oldText } from "../rules/fight.js";
import { logRound } from "../log.js";
import { exportDue, nudgeState, lastExportText } from "../exportnudge.js";

/** UI-toestand die niet in de encounter (en dus niet in undo/opslag) hoort */
export const ui = {
  open: null,          // id van de open kaart; null = volg wie aan de beurt is; "" = geen
  panel: null,         // "conds" of "more" binnen de open kaart
  sheet: null,         // { id, kind: "dmg"|"heal"|"thp", val: "", mode: 1|0.5|2 }
  condOpt: {}, openCast: new Set(), castPick: null, confirmReset: false,
  exhOpen: false,      // RE11: rij met het Exhaustion-niveau in het Conditie-paneel
  rage: null,          // RE16: bevestigstap { id, bear, frz } in het Effect-paneel
  logOpen: false, editLog: null, partyInit: {},
  startAsk: false,     // GV7: vraag "Nog N monsters uit het vorige gevecht" boven Start
  oldGo: null,         // GV7: antwoord daarop tot het gevecht echt start: "drop" (oude wissen) | "keep" (toch starten)
  endPick: {},         // GV7: condities in de samenvatting die de DM aan/uit zette ({ "id|cond": bool })
  condDone: null,      // GV7: stepNo() na "Wis gekozen" (blok weg tot er een stap bij komt)
  addPid: null,        // AF9: { pid, step } van de laatst toegevoegde speler met vaste party (Ongedaan haalt ook het partylid weg)
  pUpd: null,          // SP1: Bijwerken per partylid ({ pid, st: "busy"|"ask"|"err", f, ch, kept, msg })
  mode: null,          // "prep" | "fight"; null = volg het gevecht (loopt → Gevecht, anders Voorbereiden)
  qadd: null,          // { q, sel, n, init: "roll"|"fixed", fix, full } = snel-toevoegen-paneel open (full = statblock in de preview)
  monFull: false,      // Monster-paneel: volledig statblock in de preview (telefoon); terug naar kort bij een andere keuze
  aoe: null,           // { tab, dmg, type, ab, dc, t: { [id]: { sel, save, mode|null, roll, lr } } } = AoE-paneel open
                       // tab "spell": { sp: index in SPELLS of "own", by, sdc, cf: eigen spell, s: { [id]: { sel, ok, roll, lr } } }
  aoeLast: { type: "", ab: "DEX", dc: "", tab: "dmg" }, // laatst gebruikte type/save/DC/tab (bijv. dezelfde breath weapon)
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
  prep: null,          // "pc" | "mon" | "custom" | "enc" | "party" | "data" = paneel in Voorbereiden open (knoppen in de beurtbalk)
  encDraft: null,      // { name, notes } = formulier "Huidige lijst opslaan" open
  encEdit: null,       // { id, name, notes, monsters, lair, lairKey, lairHidden, q } = encounter bewerken (concept)
  encMenu: null, encAsk: null, encWhy: null, // id: ⋯-menu open / vraag Vervangen|Toevoegen / uitleg moeilijkheid
  encImp: null,        // { enc, monsters, lairs } = import met bestaande id wacht op Vervangen | Als kopie
  diffOpen: false,     // uitleg bij de live moeilijkheid boven de lijst
  prepLast: null,      // id van de laatst toegevoegde deelnemer terwijl dat paneel open was (bij Sluit in beeld)
  addOpts: { hp: "avg", init: "each" }, // monsters toevoegen (IN4): HP- en initiativekeuze, gedeeld door Monster-paneel, snel toevoegen en encounter inladen; per sessie
  monAdd: { n: 1, fixOn: false, fix: "" }, // Monster-paneel: aantal en eenmalig ingevulde initiative
  welcome: true,       // welkomstkaart bij een lege start; "Begin leeg" zet hem uit voor deze sessie
  encOpen: false,      // notitie (tactiek) van de ingeladen encounter opengeklapt (VB2)
  end: false,          // samenvatting na Gevecht afronden open (GV2, data in app.S.endSum)
  endFlee: false,      // "Gevlucht of overgegeven?" opengeklapt in de samenvatting
  downOpen: false,     // blok "Neer (N)" onderaan de lijst (Gevecht) opengeklapt
  fromDown: null,      // id van een dood monster dat vanuit dat blok geopend is (blijft dan in het blok)
  logSheet: false,     // logboek als paneel (IN7, alleen in Gevecht; geopend via het rondeblok in de kop)
  drOpen: null,        // id van de speler waarvan de resistances in ⋯ open staan (SP2)
  drKind: "r",         // gekozen soort bij het wijzigen: "r" resist | "i" immuun | "v" kwetsbaar
  dsPad: null,         // { id, v } = cijferpad voor een eigen death save-worp open (RE15)
};
export const openId = () => (ui.open === null ? app.S.active : ui.open);
/** Modus volgt het gevecht: zonder gevecht altijd Voorbereiden; tijdens een gevecht kan de DM tussendoor naar Voorbereiden (✎) */
export const mode = () => (app.S.round && ui.mode !== "prep" ? "fight" : "prep");

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
  paintPrep();
  paintAoe();
  paintAtk();
  paintInit();
  paintLa();
  paintSv();
  paintEnd();
  paintParty();
  paintLog();
  syncSB(app.S, openId(), sbChips);
  afterRender();
}

/** Party/Vijanden (+ ronde) voor de kop */
function sumHtml(S, round, sep = "") {
  const pcs = S.list.filter((c) => c.kind === "pc"), mons = S.list.filter((c) => c.kind === "monster");
  return [round && S.round ? `<span>Ronde <b>${S.round}</b></span>` : "",
    pcs.length ? `<span>Party <b>${pcs.filter((c) => !c.max || c.hp > 0).length}/${pcs.length}</b></span>` : "",
    mons.length ? `<span>Vijanden <b>${mons.filter((c) => c.hp > 0).length}/${mons.length}</b></span>` : ""].filter(Boolean).join(sep);
}

const PEN = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
const PLUS = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;

/**
 * Modus = toestand (IN1). Voorbereiden zonder gevecht: fase-aanduiding (niet tikbaar). Gevecht: eigen kop met de ronde,
 * ✎ Voorbereiden en + (snel toevoegen), titel weg. Voorbereiden tijdens een gevecht: één amberkleurige balk, titel weg.
 * CSS verbergt de rest via body[data-mode] en body[data-run].
 */
function paintMode() {
  const S = app.S, m = mode();
  document.body.dataset.mode = m;
  if (S.round) document.body.dataset.run = "1"; else delete document.body.dataset.run;
  $("#modes").innerHTML = m === "fight"
    ? `<div class="fhead"><button type="button" class="ft" id="logopen" aria-haspopup="dialog"><span class="l">Gevecht · <span class="lk">Logboek <span aria-hidden="true">▸</span></span></span><span class="rn">Ronde ${n0(S.round)}</span><span class="fsum">${sumHtml(S, false, " · ")}</span></button>
      <button type="button" class="fb" data-setmode="prep" aria-label="Voorbereiden: lijst aanpassen"><span class="fi">${PEN}</span><span class="fl">Voorbereiden</span></button>
      <button type="button" class="fb ic" id="qadd" aria-label="Monster toevoegen aan het gevecht" title="Monster toevoegen aan het gevecht">${PLUS}</button></div>`
    : S.round
      ? `<p class="runbar" role="status">Gevecht loopt · ronde ${n0(S.round)} · je past de lijst aan</p>`
      : `<p class="phase" aria-label="Fase: Voorbereiden, daarna Gevecht"><span class="st on"><span class="dot" aria-hidden="true">1</span>Voorbereiden</span><span class="ln" aria-hidden="true"></span><span class="st"><span class="dot" aria-hidden="true">2</span>Gevecht</span></p>`;
  if (m !== "prep") ui.prep = null;
}

/* ---------- Voorbereiden: één paneel met de bestaande formulieren (statisch in index.html, alleen hidden wisselt) ---------- */
const PREP = { pc: "Speler toevoegen", mon: "Monster toevoegen", custom: "Monster toevoegen", enc: "Encounters", party: "Party", data: "Instellingen" };
const MONTABS = ["mon", "custom", "enc"];
/** Instellingen → Opslag: "Laatste export: …" (DA1) */
export const paintExpLast = () => { $("#exp-last").textContent = lastExportText(nudgeState().exp); paintSetStat(); }; // ook de kop van Opslag (AF5)
export function paintPrep() {
  const el = $("#psheet"), p = PREP[ui.prep] ? ui.prep : null;
  el.hidden = !p;
  if (!p) return;
  $("#p-title").textContent = PREP[p];
  $("#p-montabs").hidden = !MONTABS.includes(p);
  $("#p-montabs").querySelectorAll("[data-prep]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.prep === p));
  el.querySelectorAll("[data-panel]").forEach((x) => (x.hidden = x.dataset.panel !== p));
  if (p === "mon" && app.S.list.some((c) => c.kind === "lair")) $("#addlair").hidden = true;
  if (p === "data") paintExpLast();
  paintEnc();
}

/* ---------- onderdelen van een kaart ---------- */
/** Balk + "12/30 +5": in de kop (Voorbereiden) of als eigen knop onder de kop (Gevecht, GV1) */
const hpIn = (c) => {
  const pct = c.max ? Math.max(0, c.hp) / c.max : 1;
  const cls = pct <= 0.25 ? "low" : pct <= 0.5 ? "mid" : "";
  return `<span class="bar" aria-hidden="true"><i class="${cls}" style="width:${pct * 100}%"></i></span>
    <span class="hpn">${n0(c.hp)}/${n0(c.max)}${c.temp ? ` <span class="thp">+${n0(c.temp)}</span>` : ""}</span>`;
};
const hpBar = (c) => `<div class="hpw">${hpIn(c)}</div>`;
/** Gevecht: tik op de HP-rij = direct het schadepaneel (eigen knop, 44 px hoog, naast de kop die de kaart opent) */
const hpBtn = (c) => `<button type="button" class="khp hpw" data-a="sheet-open" data-kind="dmg" aria-label="${esc(c.name)}: ${n0(c.hp)} van ${n0(c.max)} HP${c.temp ? `, +${n0(c.temp)} temp` : ""}. Schade invoeren">${hpIn(c)}</button>`;

/**
 * Conditie-chips. interactive = open kaart: Concentrating met ✕ (beëindigen), de rest tikbaar voor uitleg (RE10).
 * info = alleen uitleg (live-blok op de tablet): ook Concentrating niet weghalen. Dicht: alleen tekst.
 */
function condChips(c, S, interactive, info = interactive) {
  return c.cond.map((x) => {
    const dt = durText(c, x, S.list);
    const dl = dt ? ` · ${esc(dt)}` : "";
    if (x === "Concentrating") {
      const label = `Concentrating${c.concSpell ? ` · ${esc(c.concSpell)}` : ""}${dl}`;
      return interactive ? `<button class="bd cc cbtn" data-a="dropconc" title="Concentratie beëindigen">${label} <span aria-hidden="true">✕</span><span class="vh">beëindigen</span></button>` : `<span class="bd cc">${label}</span>`;
    }
    return info ? cinfoBtn(c, x, `${esc(x)}${dl}`) : `<span class="bd cc">${x}${dl}</span>`;
  }).join("");
}
/** RE10: tikbare chip voor de uitleg (stippel eronder, geen ✕) */
const cinfoBtn = (c, key, html, cls = "bd cc") => `<button type="button" class="${cls} cinf" data-cinfo="${esc(key)}" data-cid="${esc(c.id)}" aria-label="${esc(key)}: uitleg">${html}</button>`;

/** Samenvatting voor een gesloten kaart */
/** AC in de kop (AF13): schildje met het effectieve getal, in accentkleur met vulling als effecten hem veranderen */
function acMeta(c) {
  const ac = effAc(c);
  return ac ? `<span class="acv${ac !== c.ac ? " acx" : ""}" title="Armor Class"><span class="vh">AC </span>${n0(ac)}</span>` : "";
}

/** Effect-chips: in de open kaart knoppen om weg te halen, dicht alleen tekst (korte duur) */
function effChips(c, S, interactive, info = interactive) {
  const E = c.eff || [];
  return [...E.filter(isWarn), ...E.filter((e) => !isWarn(e))].map((e) => {
    // RE11: Exhaustion is een conditie met niveau: uitleg in plaats van ✕ (niveau wijzigen via Conditie)
    if (isExh(e)) return info ? cinfoBtn(c, "Exhaustion", esc(effName(e)), "bd r") : `<span class="bd r">${esc(effName(e))}</span>`;
    if (isRage(e)) return rageChip(c, e, S, interactive);
    const w = isWarn(e), cls = w ? "bd r" : "bd ef";
    const by = e.by && e.by !== c.id ? S.list.find((x) => x.id === e.by) : null;
    const dur = e.d ? durLabel(e.d, S.list, !interactive) : e.lr ? "long rest" : "";
    const t = [`${e.n}${e.st ? " " + effText(e) : ""}`, w ? e.txt : "", dur, by ? by.name : ""].filter(Boolean).map(esc).join(" · ");
    return interactive ? `<button class="${cls} cbtn" data-a="effdel" data-e="${esc(e.id)}" title="Effect weghalen">${t} <span aria-hidden="true">✕</span><span class="vh">weghalen</span></button>`
      : `<span class="${cls}">${t}</span>`;
  }).join("");
}

/** RE16: rage damage uit het barbarian-level (klasse op de sheet, anders het level als er geen klasse bekend is) */
export function rageLvl(c) {
  const cls = c.sheet && c.sheet.cls;
  if (cls) return barbLevel(cls); // multiclass: alleen de barbarian-levels
  const m = c.pid && app.party.find((x) => x.pid === c.pid), l = Number.isInteger(c.lvl) ? c.lvl : m && Number.isInteger(m.lvl) ? m.lvl : null;
  return l; // geen klasse bekend: het level (handmatig toegevoegde barbarian)
}
const rageBonus = (c) => { const b = rageDmg(rageLvl(c)); return b ? `+${b}` : "+2/+3/+4"; };
/** "Rage +2 · 10r": daar kijkt de DM als de speler zijn schade noemt; open kaart met ✕ */
function rageChip(c, e, S, interactive) {
  const t = [`Rage ${rageBonus(c)}`, e.d ? durLabel(e.d, S.list, !interactive) : "", e.bear ? "Bear" : "", e.frz ? "Frenzy" : ""].filter(Boolean).map(esc).join(" · ");
  return interactive ? `<button class="bd ef cbtn" data-a="effdel" data-e="${esc(e.id)}" title="Rage beëindigen">${t} <span aria-hidden="true">✕</span><span class="vh">beëindigen</span></button>` : `<span class="bd ef">${t}</span>`;
}

/** Conditie- en effect-chips voor de speler-sheet in het zijpaneel (condities tikbaar voor uitleg, RE10) */
const sbChips = (c) => condChips(c, app.S, false, true) + effChips(c, app.S, false, true) + reactChip(c, app.S);
/** GV12: reaction gebruikt tot hij terug is (begin eigen beurt); dichte kaart en live-blok */
const reactChip = (c, S) => (reactUsed(c, S, pcReact()) ? `<span class="bd">${REACT_TAG}</span>` : "");

const hidBadge = (c) => (c.hidden ? `<span class="bd hid" title="Spelers zien deze deelnemer niet">verborgen</span>` : "")
  + (c.kind === "monster" && c.anon ? `<span class="bd hid" title="Spelers zien: ${esc(anonName(c, app.S.list))}">onbekend</span>` : "");
const surBadge = (c, S, info = false) => (!isSurprised(c, S) ? "" : info ? cinfoBtn(c, "Verrast", "Verrast", "bd cc sur")
  : `<span class="bd cc sur" title="Verrast: eerste beurt wordt overgeslagen, geen reaction tot die beurt voorbij is">Verrast</span>`);

function badges(c, S) {
  const out = [surBadge(c, S), hidBadge(c), condChips(c, S, false), effChips(c, S, false)];
  if (c.kind === "pc" && c.max && c.hp <= 0) {
    const d = c.ds || R.newDs();
    out.push(d.dead ? `<span class="bd r">Dood</span>` : d.stable ? `<span class="bd g">Stabiel</span>` : `<span class="bd r">Death saves ✓${d.s} ✗${d.f}</span>`);
  }
  if (c.casting && (c.casting.slots.length || c.casting.pact)) out.push(`<span class="bd b">Slots ${slotSum(c.casting, "·")}</span>`);
  else if (c.casting && c.casting.daily.length) out.push(`<span class="bd b">Spells</span>`);
  (c.res || []).forEach((r) => out.push(`<span class="bd b">${esc(r.n)} ${n0(r.left)}/${n0(r.max)}</span>`));
  (c.rc || []).forEach((r) => out.push(`<span class="bd ${r.ready ? "g" : ""}">${esc(r.n)} ${r.ready ? "klaar" : "op"}</span>`));
  if (c.la) out.push(`<span class="bd r">LA ${n0(c.la.left)}</span>`);
  if (c.lr) out.push(`<span class="bd r">LR ${n0(c.lr.left)}/dag</span>`);
  out.push(reactChip(c, S));
  const html = out.join("");
  return html ? `<div class="badges">${html}</div>` : "";
}

/** AF12: "1st-level slot 1 van 4, beschikbaar"; geen aria-pressed (CSS stijlt op data-used) */
const pipState = (label, i, o) => `data-used="${i >= o.left}" aria-label="${esc(`${label} ${i + 1} van ${n0(o.max)}, ${i >= o.left ? "gebruikt" : "beschikbaar"}`)}"`;

function pips(o, key, label) {
  if (!o) return "";
  return `<div class="pips"><span class="lbl">${label} ${n0(o.left)}/${n0(o.max)}</span><span class="pg">${Array.from({ length: n0(o.max) }, (_, i) =>
    `<button class="pip ${key}" data-pip="${key}" data-i="${i}" ${pipState(label, i, o)}></button>`).join("")}</span></div>`;
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
  // AF12: toestand in het label (geen aria-pressed: "aangevinkt, ingedrukt" spreekt elkaar tegen); CSS stijlt op data-on
  const p = (k, n, l) => Array.from({ length: 3 }, (_, i) => `<button class="dsp ${k}" data-ds="${k}" data-i="${i}" data-on="${i < n}" aria-label="${l} ${i + 1} van 3, ${i < n ? "aangevinkt" : "niet aangevinkt"}"></button>`).join("");
  const pad = ui.dsPad && ui.dsPad.id === c.id;
  const st = d.dead ? `<span class="st dead">Dood</span>` : d.stable ? `<span class="st ok">Stabiel</span>`
    : `<button class="btn small primary" data-a="ds-roll">Rol death save</button><button class="btn small" data-a="ds-own" aria-expanded="${pad}">Eigen worp</button><button class="link" data-a="ds-crit">Kritiek geraakt (+2)</button>`;
  return `<div class="ds"><span class="lbl">Death saves</span>
    <span class="dsg">Success ${p("s", d.s, "Success")}</span><span class="dsg">Failure ${p("f", d.f, "Failure")}</span>${st}</div>${pad && !d.dead && !d.stable ? dsPadHtml(c) : ""}`;
}

/** RE15: cijferpad voor de worp van de speler. Alleen cijfers die nog tot 1–20 kunnen leiden; 3–9 gaat meteen door. */
function dsPadHtml(c) {
  const v = ui.dsPad.v, ok = (n) => (v === "" ? n > 0 : v === "1" || (v === "2" && n === 0));
  const dg = (n) => `<button type="button" data-a="ds-k" data-v="${n}" ${ok(n) ? "" : "disabled"}>${n}</button>`;
  return `<div class="dspad" role="group" aria-label="${esc(`Death save van ${c.name}`)}">
    <p class="dsv"><span>Worp van ${esc(c.name)}</span><b>${v || "—"}</b></p>
    <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(dg).join("")}<button type="button" data-a="ds-k" data-v="back" aria-label="Wissen" ${v ? "" : "disabled"}>⌫</button>${dg(0)}<button type="button" class="ok" data-a="ds-k" data-v="ok" ${v === "1" || v === "2" ? "" : "disabled"}>OK</button></div>
    <p class="hint">1 = twee failures, 10+ = success, 20 = staat op met 1 HP.</p>
    <button type="button" class="link" data-a="ds-own">Annuleer</button></div>`;
}

/** Spellnamen bij een slot of x/day als tikbare namen ("cure wounds (3rd level)" → naam tikbaar, annotatie niet) */
const spLinks = (t, c) => splitSpells(String(t || "")).map((n) => {
  const [name, rest] = spellItem(n);
  return name ? spellLink(name, name, c.kind === "pc" ? c.id : "") + esc(rest) : esc(n);
}).join(", ");

/** RE3: "P3:2 · 1:4 · 2:3" (kaart-samenvatting) of "P2·4·3" (badge); Pact vooraan */
const slotSum = (k, sep) => [...(k.pact ? [sep === "·" ? `P${n0(k.pact.left)}` : `P${k.pact.lvl}:${n0(k.pact.left)}`] : []), ...k.slots.map((x) => (sep === "·" ? n0(x.left) : `${x.lvl}:${n0(x.left)}`))].join(sep);

function castBlock(c) {
  const k = c.casting;
  if (!k || (!k.slots.length && !k.daily.length && !k.pact)) return "";
  const pp = (o, attr, l) => Array.from({ length: n0(o.max) }, (_, i) => `<button class="pip" ${attr} data-i="${i}" ${pipState(l, i, o)}></button>`).join("");
  const sum = k.slots.length || k.pact ? slotSum(k, " · ") : k.daily.map((g) => esc(g.label)).join(", ");
  const pick = (x, p = false) => ui.castPick && ui.castPick.id === c.id && ui.castPick.lvl === x.lvl && !!ui.castPick.p === p
    ? `<div class="pick"><span class="hint">Welke spell?</span>${pickList(c, x.lvl, rulesEd()).map((sp) =>
      `<button class="btn small ${sp.conc ? "conc" : ""}" data-pickspell="${esc(sp.n)}" data-conc="${sp.conc ? 1 : ""}">${esc(sp.n)}${sp.lv < x.lvl ? ` (${sp.lv}e, upcast)` : ""}${sp.conc ? " · conc." : ""}</button>`).join("")}<button class="link" data-pickspell="">Andere / overslaan</button></div>` : "";
  return `<details class="cast" data-cast ${ui.openCast.has(c.id) || ui.castPick?.id === c.id ? "open" : ""}><summary class="link strong">Spells <span style="font-weight:400">(${sum})</span></summary>
    <div class="castbox">${rageOf(c) ? `<p class="hint">Rage: geen spells casten.</p>` : ""}
      ${k.pact ? `<div class="slotrow"><span class="lv">Pact ${ORD[k.pact.lvl] || ""}</span><span class="pp">${pp(k.pact, `data-slot="p"`, `Pact-slot (${ORD[k.pact.lvl] || ""})`)}</span><span class="sp">${spLinks(k.pact.spells || "", c)}</span></div>${pick(k.pact, true)}` : ""}
      ${k.slots.map((x, i) => `<div class="slotrow"><span class="lv">${ORD[x.lvl] || ""}</span><span class="pp">${pp(x, `data-slot="${i}"`, `${ORD[x.lvl] || ""}-level slot`)}</span><span class="sp">${spLinks(x.spells, c)}</span></div>${pick(x)}`).join("")}
      ${k.daily.map((g, gi) => g.items.map((it, ii) => `<div class="slotrow"><span class="lv">${esc(g.label.split(" ")[0])}</span><span class="pp">${pp(it, `data-daily="${gi}.${ii}"`, it.n)}</span><span class="sp">${spLinks(it.n, c)}</span></div>`).join("")).join("")}
      <div><button class="link" data-a="cast-reset">Alles herstellen (long rest)</button></div>
    </div></details>`;
}

function resBlock(c) {
  if (!c.res || !c.res.length) return "";
  return `<div class="castbox">${c.res.map((o, i) => `<div class="resrow"><span class="rn">${esc(o.n)}</span>
    <span class="pp">${o.max <= 10 ? Array.from({ length: n0(o.max) }, (_, j) => `<button class="pip" data-res="${i}" data-i="${j}" ${pipState(o.n, j, o)}></button>`).join("")
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
    <div class="condgrid">${CONDS.map((x) => `<button type="button" data-cond="${x}" aria-pressed="${c.cond.includes(x)}">${x}</button>`).join("")}<button type="button" data-a="exh-open" aria-pressed="${exhLevel(c) > 0}" aria-expanded="${!!ui.exhOpen}">${exhLevel(c) ? `Exhaustion ${exhLevel(c)}` : "Exhaustion"}</button></div>
    ${ui.exhOpen ? exhRow(c) : ""}</div>`;
}

/** RE11: niveau 0–6 met − en +; wat er bij dit niveau geldt (opgeteld). Dood: − uit (Ongedaan is de weg terug) */
function exhRow(c) {
  const x = exhLevel(c), dead = c.kind === "pc" ? !!(c.ds && c.ds.dead) : c.max > 0 && c.hp <= 0;
  return `<div class="exhrow"><button type="button" class="btn" data-a="exh" data-v="-1" ${x && !dead ? "" : "disabled"} aria-label="Exhaustion een niveau lager">−</button>
    <b aria-live="polite">Exhaustion ${x}</b><button type="button" class="btn" data-a="exh" data-v="1" ${x >= 6 ? "disabled" : ""} aria-label="Exhaustion een niveau hoger">+</button></div>
    <p class="hint exhtxt">${esc(exhSummary(x))}. ${dead && x ? "Terug: Ongedaan." : "Long rest: één niveau minder."}</p>`;
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
  const ini = parseInit(ed.init);
  if (ini !== null && ini !== c.init && (!ed.keys || ed.keys.includes("init"))) { // RE9: wat de nieuwe initiative deze ronde betekent
    const t = initText(initPlan(app.S, c, ini), ini, (app.S.list.find((x) => x.id === app.S.active) || {}).name);
    if (t) parts.push(`<b class="warn">${esc(t[0].toUpperCase() + t.slice(1))}</b>`);
  }
  if (c.pid) parts.push("wijzigt ook de vaste party");
  if (!String(ed.name).trim()) parts.push(`<b class="bad">naam mag niet leeg zijn</b>`);
  else if (app.S.list.some((x) => x !== c && x.name.toLowerCase() === String(ed.name).trim().toLowerCase())) parts.push("let op: deze naam bestaat al");
  return parts.map((t) => (t.startsWith("<b") ? t : esc(t))).join(" · ");
}

/** Velden in het ⋯-paneel. Voorbereiden: alleen wat niet al direct op de kaart staat (monster: naam + AC, speler: naam + max HP) */
export const editKeys = (c, prep) => [...(!prep ? ["name", "ac", "max", "init"] : c.kind === "pc" ? (c.max ? ["name", "max"] : ["name"]) : ["name", "ac"]), ...(c.kind === "pc" ? ["pas"] : [])];
/** Concept van het ⋯-formulier uit de deelnemer (SP5: eigen passives, leeg = uit de sheet) */
export const edNow = (c) => ({ name: c.name, ac: c.ac || "", max: baseMax(c) || "", init: c.init, ...Object.fromEntries(PAS.map(([k]) => [k, (c.pas && c.pas[k]) ?? ""])) });

function morePanel(c, prep) {
  const ed = ui.edit && ui.edit.id === c.id ? ui.edit : edNow(c);
  const keys = editKeys(c, prep), row = keys.slice(1).filter((k) => k !== "pas"), hpd = (c.max || 0) - baseMax(c);
  const fld = {
    ac: `<label>AC<input data-f="ed-ac" type="number" inputmode="numeric" min="0" max="40" value="${esc(ed.ac)}"></label>`,
    max: `<label>Max HP${hpd ? ` <small>(${hpd > 0 ? "+" : "−"}${Math.abs(hpd)} effect)</small>` : ""}<input data-f="ed-max" type="number" inputmode="numeric" min="1" value="${esc(ed.max)}"></label>`,
    init: `<label>Initiative<input data-f="ed-init" type="number" inputmode="numeric" value="${esc(ed.init)}"></label>`,
  };
  return `<div class="kpanel more">
    <div class="edit">
      <label>Naam<input data-f="ed-name" value="${esc(ed.name)}" autocomplete="off" maxlength="120"></label>
      ${row.length ? `<div class="ed3">${row.map((k) => fld[k]).join("")}</div>` : ""}${keys.includes("pas") ? pasFields(c, ed) : ""}
      <p class="hint edprev" aria-live="polite">${editPreview(c)}</p>
      <div class="bar"><button class="btn tap" data-a="ed-cancel">Annuleer</button><button class="btn primary tap" data-a="ed-save">Opslaan</button></div>
    </div>${c.kind === "pc" ? drBox(c) : ""}
    <div class="bar">${c.kind === "pc" && !c.pid ? `<button class="btn small" data-a="topty">Naar vaste party</button>` : ""}
    ${canToggleSurprise(c, app.S) ? `<button class="btn small" data-a="sur" aria-pressed="${c.sur === true}">${c.sur === true ? "Verrast ✓" : "Verrast"}</button>` : ""}
    ${c.kind === "monster" ? `${prep ? "" : `<button class="btn small" data-a="hide" aria-pressed="${!!c.hidden}">${c.hidden ? "Tonen aan spelers" : "Verbergen voor spelers"}</button>`}
      <button class="btn small" data-a="anon" aria-pressed="${!!c.anon}">${c.anon ? "Naam tonen aan spelers" : "Naam verbergen voor spelers"}</button>` : ""}
    <button class="btn small danger" data-a="del">${app.S.round ? "Verwijder uit gevecht" : "Verwijder"}</button></div></div>`;
}

/** SP5: eigen passives in ⋯ (opslaan met Opslaan); placeholder = waarde uit de sheet */
function pasFields(c, ed) {
  const sh = sheetPassives(c.sheet), any = PAS.some(([k]) => sh[k] != null);
  return `<p class="vlbl edpasl">Passive</p><div class="ed3 edpas">${PAS.map(([k, l, sh3]) => `<label>${sh3}<input data-f="ed-${k}" type="number" inputmode="numeric" min="1" max="40" value="${esc(ed[k] ?? "")}" placeholder="${sh[k] ?? ""}" aria-label="${esc(`Passive ${l} ${c.name}`)}"></label>`).join("")}</div>${any ? `<p class="hint">Leeg = uit de sheet.</p>` : ""}`;
}

/**
 * SP2: resistances van een speler in ⋯ (beide modi). Samenvatting met "Wijzig ▸"; open: soort (Resist | Immuun | Kwetsb.)
 * en 13 type-knoppen. Tik = direct vastgelegd (undo-stap), zoals de velden op de kaart; een type staat in één soort.
 */
function drBox(c) {
  const open = ui.drOpen === c.id, k = ui.drKind;
  const sum = drText(c.dr);
  const body = !open ? "" : `<div class="seg2 sm" role="group" aria-label="Soort">${Object.entries(DR_LBL).map(([v, l]) => `<button type="button" data-a="dr-kind" data-v="${v}" aria-pressed="${k === v}">${l}</button>`).join("")}</div>
    <div class="drgrid">${DTYPES.map((t) => { const at = drKind(c.dr, t); return `<button type="button" class="drt${at && at !== k ? " other" : ""}" data-a="dr-t" data-t="${t}" aria-pressed="${at === k}"${at && at !== k ? ` aria-label="${t}, nu ${DR_LBL[at]}"` : ""}>${t}${at && at !== k ? `<small aria-hidden="true">${{ r: "R", i: "I", v: "V" }[at]}</small>` : ""}</button>`; }).join("")}</div>
    <p class="hint">Tik zet het type bij ${DR_LBL[k]}; nog een tik zet het uit.${c.sheet && c.sheet.dr ? " Bijwerken via D&D Beyond houdt wat je hier toevoegt." : ""}${c.pid ? " Geldt ook in de vaste party." : ""}</p>`;
  return `<div class="drbox"><div class="drhead"><span><span class="qlbl">Resistances</span> ${sum ? esc(sum) : "geen"}</span>
    <button type="button" class="link tap" data-a="dr-open" aria-expanded="${open}">${open ? "Klaar ▾" : "Wijzig ▸"}</button></div>${body}</div>`;
}

/** AF15: het teken zit in de keuze, de waarde is altijd positief (iOS-cijferpad heeft geen minteken) */
export const EFF_OPS = [["ac+", "AC +"], ["ac-", "AC −"], ["ac=", "AC wordt"], ["acmin", "AC minimaal"], ["max", "Max HP +"], ["max-", "Max HP −"], ["txt", "Alleen tekst"]];

/** Effectpaneel: presets (1 tik), "Wie cast?" voor concentratie zonder beurt, of een eigen effect */
function effPanel(c) {
  const S = app.S;
  if (ui.effWho && ui.effWho.id === c.id) {
    const p = PRESETS_14[ui.effWho.i];
    return `<div class="kpanel"><p class="hint">Wie cast <b>${esc(p.n)}</b>?</p>
      <div class="effgrid">${spellTargets(S.list).map((x) => `<button class="btn tap" data-a="effby" data-by="${esc(x.id)}">${esc(x.name)}</button>`).join("")}</div>
      <button class="link" data-a="effwho-no">Annuleer</button></div>`;
  }
  if (ui.rage && ui.rage.id === c.id) return rageBox(c);
  const act = S.list.find((x) => x.id === S.active);
  const f = ui.effForm;
  const custom = ui.effCustom ? `<div class="effform">
      <label>Naam<input data-f="ef-n" value="${esc(f.n || "")}" placeholder="bijv. Life Drain" maxlength="60"></label>
      <div class="ed3">
        <label>Op<select data-f="ef-k">${EFF_OPS.map(([v, l]) => `<option value="${v}" ${(f.k || "ac+") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label>Waarde<input data-f="ef-v" type="number" inputmode="numeric" min="0" autocomplete="off" value="${esc(f.v ?? "")}"></label>
        <label>Duur<select data-f="ef-dur">${[...DURS, ["lr", "Tot long rest"]].map(([v, l]) => `<option value="${v}" ${(f.dur || "inf") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      </div>
      <label>Notitie<input data-f="ef-txt" value="${esc(f.txt || "")}" placeholder="bijv. +1d4 op saves" maxlength="120"></label>
      <label>Concentratie van<select data-f="ef-by"><option value="">geen</option>${S.list.filter((x) => x.id === f.by || spellTargets([x]).length).map((x) => `<option value="${esc(x.id)}" ${f.by === x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>
      <button class="btn primary tap" data-a="eff-add">Toevoegen</button></div>` : "";
  return `<div class="kpanel">
    <div class="effgrid">${presetOrder(c).map((i) => {
      const p0 = PRESETS_14[i], p = presetsFor(presetEd(act, p0.n))[i], tag = edTag(act, p0.n, p); // caster = wie aan de beurt is
      const off = p.st === "ac" && p.op === "+" && !c.ac;
      return `<button class="btn tap" data-a="effp" data-i="${i}" ${off ? `disabled title="Vul eerst AC in (⋯)"` : ""}><span>${esc(p.n)}${tag ? ` <span class="tag">${esc(tag)}</span>` : ""}</span><small>${esc(p.dex ? "AC 13 + Dex" : p.st ? effText(p) : p.txt.split(" op ")[0])}${p.conc ? " · conc" : ""}</small></button>`;
    }).join("")}<button class="btn tap" data-a="effcustom" aria-pressed="${ui.effCustom}">+ Eigen effect</button></div>
    ${!c.ac ? `<p class="hint">Geen AC bekend: AC + is uit. Vul AC in via ⋯.</p>` : ""}
    <p class="hint">Concentratie-spells: caster is ${act ? `<b>${esc(act.name)}</b> (aan de beurt)` : "je kiest zelf"}. Zelfde effect opnieuw = vernieuwen. Meer doelen tegelijk (Bless, Bane): AoE → Spell.</p>
    ${custom}</div>`;
}

/** RE16: Rage alleen bij spelers; bij een barbarian (klasse of Rage-teller) als eerste. Indexen blijven die van PRESETS. */
function presetOrder(c) {
  const I = PRESETS_14.map((p, i) => i).filter((i) => !PRESETS_14[i].pc || c.kind === "pc");
  const r = I.find((i) => PRESETS_14[i].rage);
  return r != null && (barbLevel(c.sheet && c.sheet.cls) || rageRes(c)) ? [r, ...I.filter((i) => i !== r)] : I;
}

/** RE16: bevestigstap vóór Rage (kost een resource, stopt concentratie): samenvatting, Bear Totem / Frenzy, Start */
function rageBox(c) {
  const o = ui.rage, r = rageRes(c), lvl = rageLvl(c), b = rageDmg(lvl), on = !!rageOf(c);
  const res = r ? `${r.n} ${n0(r.left)} van ${n0(r.max)} over` : "Geen Rage-teller op de sheet: houd het aantal zelf bij.";
  const conc = c.cond.includes("Concentrating") ? `<p class="hint rgwarn">⚠ Concentratie${c.concSpell ? ` op ${esc(c.concSpell)}` : ""} stopt.</p>` : "";
  const tg = (k, l) => `<button type="button" class="btn tap" data-a="rage-opt" data-k="${k}" aria-pressed="${!!o[k]}">${l}</button>`;
  return `<div class="kpanel rgbox">
    <p class="rghead"><b>Rage · ${esc(c.name)}</b>${lvl ? ` <span class="hint">(${c.sheet && c.sheet.cls ? "barbarian" : "level"} ${n0(lvl)})</span>` : ""}</p>
    <p class="hint">${b ? `+${b}` : "+2/+3/+4"} rage damage (melee, STR) · resistance ${o.bear ? "tegen alles behalve psychic" : "B/P/S"} · advantage op STR-checks en STR-saves · geen spells, geen concentratie · 10 rondes</p>
    <p class="hint">${esc(res)}</p>${conc}
    <div class="effgrid rgopt">${tg("bear", "Bear Totem")}${tg("frz", "Frenzy")}</div>
    ${o.frz ? `<p class="hint">Frenzy: na afloop één niveau exhaustion.</p>` : ""}
    ${on ? `<p class="hint rgwarn">Rage loopt al. Beëindigen: ✕ op de chip.</p>` : ""}
    <div class="bar"><button type="button" class="btn tap" data-a="rage-no">Annuleer</button><button type="button" class="btn primary tap" data-a="rage-go" ${on ? "disabled" : ""}>Start Rage${r && r.left <= 0 ? " (0 over)" : ""}</button></div></div>`;
}

function actionsBlock(c) {
  const sideBtn = c.ref ? `<button data-a="sb">Statblock</button>` : c.sheet ? `<button data-a="sheet">Sheet</button>` : `<button data-a="panel" data-p="more" aria-pressed="${ui.panel === "more"}">⋯</button>`;
  const gone = (c.ds && c.ds.dead) || (c.kind === "monster" && isOut(c));
  const react = c.kind !== "pc" || pcReact(); // GV4: spelers houden hun reaction zelf bij (instelling); Heal neemt de plek over
  return `<div class="acts">
    ${c.max ? `<button class="dmg2 wide" data-a="sheet-open" data-kind="dmg">− Schade</button><button class="heal2${react ? "" : " wide"}" data-a="sheet-open" data-kind="heal">+ Heal</button>` : ""}
    ${!react ? "" : isSurprised(c, app.S) ? `<button disabled title="Verrast: geen reaction tot de eigen beurt voorbij is">Verrast</button>` : `<button data-a="react" aria-pressed="${!!c.reaction}"${c.reaction ? ` title="Reaction gebruikt · tik om terug te zetten"` : ""}>${c.reaction ? REACT_TAG : "Reaction"}</button>`}
    <button data-a="panel" data-p="conds" aria-pressed="${ui.panel === "conds"}">Conditie</button>
    <button data-a="panel" data-p="eff" aria-pressed="${ui.panel === "eff"}" ${gone ? "disabled" : ""}>Effect</button>
    ${sideBtn}
    ${c.ref || c.sheet ? `<button data-a="panel" data-p="more" aria-pressed="${ui.panel === "more"}" aria-label="Meer">⋯</button>` : ""}
  </div>
  ${kPanels(c, false, gone)}`;
}

const kPanels = (c, prep, gone) => (ui.panel === "conds" ? condPanel(c) : ui.panel === "more" ? morePanel(c, prep) : ui.panel === "eff" && !gone ? effPanel(c) : "");

/* ---------- kaart in Voorbereiden (IN2): inrichten, niet vechten ---------- */
/** Level uit de sheet (party of deelnemer); anders null en dan vraagt de kaart erom */
const sheetLvl = (c, m) => clsLevel((m && m.sheet && m.sheet.cls) || (c.sheet && c.sheet.cls));

/**
 * Direct invulbare velden; opslaan bij verlaten (onChange in actions.js, één undo-stap per veld, geen Opslaan-knop).
 * Monster: initiative en max HP (hit dice erbij; AC staat onder ⋯). Speler: huidige HP, AC en level als de sheet dat niet geeft.
 */
function prepFields(c) {
  const fld = (k, lbl, val, { of = "", ph = "", aria = lbl } = {}) => `<label class="pf"><span class="pl">${lbl}</span><span class="pbox${val === "" || val == null ? " nv" : ""}">
    <input data-pf="${k}" type="number" inputmode="numeric" enterkeyhint="done" value="${esc(val ?? "")}"${ph ? ` placeholder="${ph}"` : ""} aria-label="${esc(`${aria} ${c.name}`)}">${of ? `<span class="of">/${of}</span>` : ""}</span></label>`;
  const hpd = (c.max || 0) - baseMax(c), eff = hpd ? ` <small>${hpd > 0 ? "+" : "−"}${Math.abs(hpd)} effect</small>` : "";
  if (c.kind === "monster") {
    const hd = c.ref && findMon(c.ref)?.hd;
    const now = c.max && c.hp < c.max ? `<p class="hint pnow">Nu ${n0(c.hp)} van ${n0(c.max)} HP</p>` : "";
    return `<div class="pfs two">${fld("init", "Init", c.init, { aria: "Initiative" })}${fld("max", `Max HP${hd ? ` <small>${esc(hd)}</small>` : ""}${eff}`, c.max ? baseMax(c) : "", { ph: "?", aria: "Max HP" })}</div>${now}`;
  }
  const m = c.pid && app.party.find((x) => x.pid === c.pid);
  const lv = sheetLvl(c, m) ? "" : fld("lvl", "Level", (m ? m.lvl : c.lvl) ?? "", { ph: "?" });
  const hp = c.max ? fld("hp", `HP${eff}`, n0(c.hp), { of: n0(c.max), aria: "Huidige HP" }) : fld("max", "Max HP", "", { ph: "?" });
  const pt = pasText(passives(c)); // SP5: alleen lezen; invullen onder ⋯
  return `<div class="pfs${lv ? "" : " two"}">${hp}${fld("ac", (c.eff || []).some((e) => e.st === "ac") ? "Basis-AC" : "AC", c.ac || "", { ph: "?" })}${lv}</div>${pt ? `<p class="hint ppas">Passive ${esc(pt)}</p>` : ""}`;
}

function prepActions(c) {
  const b = c.kind === "monster"
    ? [`<button data-a="hide" aria-pressed="${!!c.hidden}" title="Spelers zien dit monster niet">${c.hidden ? "Verborgen" : "Verbergen"}</button>`]
    : [];
  b.push(`<button data-a="panel" data-p="conds" aria-pressed="${ui.panel === "conds"}">Conditie</button>`,
    `<button data-a="panel" data-p="eff" aria-pressed="${ui.panel === "eff"}">Effect</button>`);
  if (c.ref) b.push(`<button data-a="sb">Statblock</button>`); else if (c.sheet) b.push(`<button data-a="sheet">Sheet</button>`);
  b.push(`<button data-a="panel" data-p="more" aria-pressed="${ui.panel === "more"}" aria-label="Meer: naam${c.kind === "pc" ? ", max HP, party" : ", AC, naam voor spelers"}, verwijderen">⋯</button>`);
  return `<div class="acts pacts n${b.length}">${b.join("")}</div>${kPanels(c, true, false)}`;
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
    ${hidden > 0 ? `<div class="atkmore"><button class="link" data-a="atk-open">+${hidden} meer</button></div>` : ""}
    ${other}</div>`;
}

/** SP5: passive Perception van de spelers aan tafel, hoogste eerst (hinderlaag); niemand bekend → niets */
function percLine() {
  const L = percList(app.S.list);
  return L.length ? `<p class="hint ipas">Passive Perception: ${esc(L.map((x) => `${x.name} ${x.v ?? "–"}`).join(" · "))}</p>` : "";
}

function lairRow(c, S) {
  const acts = app.lairs[c.key] || [];
  const keys = [...new Set([c.key, ...Object.keys(app.lairs), ...S.list.filter((x) => x.la).map((x) => "Lair: " + x.ref)])];
  return `<li class="c k lair ${c.id === S.active ? "turn" : ""}" data-id="${esc(c.id)}">
    <div class="i">${n0(c.init)}</div>
    <div class="n"><select class="lairsel" data-f="lairkey" aria-label="Welke lair">${keys.map((k) => `<option ${k === c.key ? "selected" : ""}>${esc(k)}</option>`).join("")}</select></div>
    <div class="meta">lair</div>
    ${c.hidden ? `<div class="badges">${hidBadge(c)}</div>` : ""}
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
    <div class="bar"><button class="btn small" data-a="hide" aria-pressed="${!!c.hidden}">${c.hidden ? "Tonen aan spelers" : "Verbergen voor spelers"}</button></div>
    <div class="row3"><span class="hint">Initiative 20, verliest gelijke stand.</span><button class="link" data-a="del">Lair verwijderen</button></div></div></li>`;
}

function row(c, S, down = false) {
  if (c.kind === "lair") return lairRow(c, S);
  const open = openId() === c.id, prep = mode() === "prep";
  const turn = c.id === S.active, hp = c.max && !down, fhp = hp && !prep;
  return `<li class="c k ${c.kind === "pc" ? "pc" : "mon"} ${open ? "open" : ""} ${turn ? "turn" : ""} ${isOut(c) ? "out" : ""}${down ? " down" : ""}${fhp ? " fhp" : ""}" data-id="${esc(c.id)}"${down ? ` data-down="1"` : ""}>
    <button class="khead" data-a="open" aria-expanded="${open}"${turn ? ` aria-current="true"` : ""} aria-label="${esc(c.name)}, ${c.kind === "pc" ? "speler" : "monster"}${effAc(c) && !(isOut(c) && c.kind === "monster") ? `, AC ${n0(effAc(c))}` : ""}${open ? ", sluiten" : ", openen"}">
      <span class="i">${c.init == null ? "–" : n0(c.init)}${turn ? `<span class="tri" aria-hidden="true">▶</span>` : ""}</span>
      <span class="n">${avatar(c, c.ref ? findMon(c.ref)?.meta : "")}<span class="nm">${esc(c.name)}</span></span>
      <span class="meta">${isOut(c) && c.kind === "monster" ? "neer" : acMeta(c)}</span>
      ${hp && prep ? hpBar(c) : ""}
    </button>${fhp ? hpBtn(c) : ""}
    ${open ? `<div class="kbody">
      ${c.hidden || c.anon || c.cond.length || (c.eff || []).length || isSurprised(c, S) ? `<div class="badges">${surBadge(c, S, true)}${hidBadge(c)}${condChips(c, S, true)}${effChips(c, S, true)}</div>` : ""}
      ${acBreakdown(c) ? `<p class="hint acb">AC ${n0(effAc(c))} = ${esc(acBreakdown(c))}</p>` : ""}
      ${defLine(c)}
      ${dsBlock(c)}
      ${prep ? `${prepFields(c)}${prepActions(c)}` : `${atkBlock(c, S)}
      ${c.rc && c.rc.length ? `<div class="rcs">${c.rc.map((r, i) => `<button class="rc" data-rc="${i}" aria-pressed="${!!r.ready}" title="Tik om te markeren als gebruikt of beschikbaar">${esc(r.n)} · ${r.ready ? "klaar" : r.rest ? "na rust" : `recharge ${n0(r.min)}–6`}</button>`).join("")}</div>` : ""}
      ${pips(c.la, "la", "Legendary actions")}${pips(c.lr, "lr", "Legendary resistance per dag")}
      ${actionsBlock(c)}`}
      ${castBlock(c)}
      ${resBlock(c)}
    </div>` : badges(c, S)}
  </li>`;
}

/** DA1: alleen in Voorbereiden zonder gevecht; nooit aan tafel tijdens een gevecht. Geen melding of stip (stip op ⚙ = kamer) */
const expBanner = (calm) => calm && exportDue(nudgeState())
  ? `<li class="sbanner expb"><span>Geen recente export · je data staat alleen op dit apparaat</span><span class="sbtns"><button type="button" class="btn small primary" id="exp-now">Exporteer</button><button type="button" class="btn small" id="exp-later">Later</button></span></li>` : "";

function paintEncounter() {
  const S = app.S;
  const L = sortOrder(S.list);
  $("#sum").innerHTML = L.length ? sumHtml(S, true) : "";
  const prep = mode() === "prep", calm = prep && !S.round; // tijdens een gevecht geen Begin leeg en geen moeilijkheid
  $("#order").innerHTML = L.length
    ? (S.sample && calm ? `<li class="sbanner"><span>Voorbeeld-encounter</span><button type="button" class="btn small" id="sample-clear">Begin leeg</button></li>` : "") + endBanner(S, calm) + encStrip(S, prep) + encBanner(S, calm) + expBanner(calm) + listHtml(S, L, prep)
    : expBanner(calm) + emptyState(S, prep);
  $("#resetbar").innerHTML = ui.confirmReset
    ? S.list.some((c) => c.kind !== "pc")
      ? `<div class="confirm">Wat wissen?<button class="btn small primary" id="reset-mons">Monsters wissen, spelers houden</button><button class="btn small ghost" id="reset-yes">Alles</button><button class="btn small" id="reset-no">Annuleer</button></div>`
      : `<div class="confirm">Alles wissen?<button class="btn small primary" id="reset-yes">Ja, wis encounter</button><button class="btn small" id="reset-no">Annuleer</button></div>`
    : `${S.list.length ? `<button class="btn small ghost" id="reset">Encounter wissen</button>` : ""}${S.round ? `<button class="btn small ghost" id="stop">Gevecht afronden</button>` : ""}`;
}

/**
 * Gevecht: dode monsters (0 HP) staan onderaan in een ingeklapt blok "Neer (N)"; heal of Ongedaan zet ze vanzelf terug.
 * Wie net neerging en open staat, blijft op zijn plek tot de kaart dicht gaat of de beurt wisselt (te veel schade? direct Heal).
 * Voorbereiden: alles op zijn plek. Dode spelers blijven altijd staan.
 */
export const downSplit = (L, prep, openCid, fromDown) => {
  if (prep) return { up: L, down: [] };
  const isDown = (c) => c.kind === "monster" && isOut(c) && (c.id !== openCid || fromDown === c.id);
  return { up: L.filter((c) => !isDown(c)), down: L.filter(isDown) };
};

function listHtml(S, L, prep) {
  const { up, down } = downSplit(L, prep, openId(), ui.fromDown);
  if (!down.length) return up.map((c) => row(c, S)).join("");
  return up.map((c) => row(c, S)).join("")
    + `<li class="downblk"><button type="button" class="downbtn" id="down-tog" aria-expanded="${ui.downOpen}">Neer (${down.length}) <span aria-hidden="true">${ui.downOpen ? "▾" : "▸"}</span></button></li>`
    + (ui.downOpen ? down.map((c) => row(c, S, true)).join("") : "");
}

/** Lege lijst: welkomstkaart (echt de eerste keer), knop voor de party, of een korte hint */
function emptyState(S, prep) {
  if (!prep) return `<li class="welcome"><p>Er staat niemand meer in de lijst.</p><div class="wbtns"><button type="button" class="btn primary tap" data-setmode="prep">Naar Voorbereiden</button></div></li>`;
  const encBtn = app.encounters.length ? `<button type="button" class="btn tap" data-prep="enc">Encounter inladen</button>` : "";
  if (app.party.length) return `<li class="welcome"><p>Nog niemand aan tafel. Je party staat klaar.</p><div class="wbtns"><button type="button" class="btn primary tap" data-prep="party">Party aan tafel zetten</button>${encBtn}</div></li>`;
  if (encBtn) return `<li class="welcome"><p>Nog niemand aan tafel.</p><div class="wbtns">${encBtn.replace('class="btn tap"', 'class="btn primary tap"')}</div><p class="hint">Spelers voeg je toe met + Speler onderaan.</p></li>`;
  if (ui.welcome) return `<li class="welcome"><h2>Welkom aan tafel</h2>
    <p>Houd initiative, HP, condities en spell slots bij voor D&amp;D 5e (2014). Alles blijft op dit apparaat en werkt ook offline.</p>
    <div class="wbtns"><button type="button" class="btn primary tap" id="welcome-sample">Start met voorbeeld</button><button type="button" class="btn tap" id="welcome-empty">Begin leeg</button></div>
    <button type="button" class="link wimp" data-impw="1">Heb je een export? Importeren…</button>
    <p class="hint">Voorbeeld: 2 spelers, 2 Goblins en een Hobgoblin. Probeer daarna Start gevecht. Encounters zet je klaar onder + Monster.</p></li>`;
  return `<li class="hint empty">Nog niemand aan tafel. Voeg spelers en monsters toe met de knoppen onderaan.</li>`;
}

const GEAR = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`;

/** GV7: vraag boven Start als er monsters uit het vorige gevecht staan (ui.startAsk na een tik op Start) */
function oldAsk(S) {
  const L = ui.startAsk ? oldMons(S) : []; // render muteert niets: start/undo/old-* zetten startAsk
  if (!L.length) return "";
  const onlyOld = !S.list.some((c) => c.kind === "monster" && !L.includes(c));
  return `<div class="confirmbox oldask" role="group" aria-label="Monsters uit het vorige gevecht"><p>${esc(oldText(L))}</p>
    <div class="bar">${onlyOld ? `<button type="button" class="btn primary tap" id="old-wipe">Oude monsters wissen</button>` : `<button type="button" class="btn primary tap" id="old-start">Oude wissen en starten</button>`}<button type="button" class="btn tap" id="old-go">Toch starten</button><button type="button" class="link" id="old-no">Annuleer</button></div></div>`;
}

function paintDock() {
  const S = app.S;
  const L = sortOrder(S.list);
  const undoBtn = `<button id="undo" ${canUndo() ? "" : "disabled"} aria-label="Ongedaan maken" title="Ongedaan maken (${MAC ? "⌘Z" : "Ctrl+Z"})" aria-keyshortcuts="Meta+Z Control+Z">↶</button>`;
  const pb = (k, l, al) => `<button type="button" data-prep="${k}" aria-pressed="${ui.prep === k || (k === "mon" && MONTABS.includes(ui.prep))}"${al ? ` aria-label="${al}" title="${al}"` : ""}>${l}</button>`;
  const prepRow = mode() === "prep" ? `<div class="prow">${pb("mon", `<span class="pp">+&nbsp;</span>Monster`, "")}${pb("pc", `<span class="pp">+&nbsp;</span>Speler`, "")}${pb("party", "Party", "")}${pb("data", GEAR, "Instellingen")}</div>` : "";
  if (!S.round) {
    $("#dock").innerHTML = `${prepRow}${svBar(S)}${oldAsk(S)}<div class="row one">${undoBtn}<button class="nx" id="start" ${L.length ? "" : `disabled aria-describedby="start-why"`}>Start gevecht</button></div>
      ${L.length ? "" : `<p class="why" id="start-why">Voeg eerst iemand toe</p>`}`;
    return;
  }
  if (prepRow) { // Voorbereiden tijdens een gevecht: geen beurtbalk, één knop terug (IN5: dock niet twee rijen hoog)
    $("#dock").innerHTML = `${prepRow}${svBar(S)}<div class="row one">${undoBtn}<button class="nx" data-setmode="fight">Terug naar gevecht · ronde ${n0(S.round)}</button></div>`;
    return;
  }
  const i = L.findIndex((c) => c.id === S.active);
  const act = L[i];
  const nxt = nextUp(S, L, S.active); // slaat neer en (ronde 1) verrast over
  const g = act ? groupOf(L, act.id, S.round) : null; // groepsbeurt: "Bugbear 2 · 2/3"
  $("#dock").innerHTML = `<div class="who"><span><span class="l">Aan de beurt</span><br><b>${act ? esc(act.name) : "–"}</b>${g ? ` <span class="gk" title="Groepsbeurt: lid ${g.k} van ${g.live.length}">· ${g.k}/${g.live.length}</span>` : ""}</span><span class="r">${nxt ? `volgende: ${esc(nxt.name)}` : ""}</span></div>
    ${svBar(S)}${allDown(S) ? `<div class="svbar"><div class="svrow endrow"><span>Alle monsters neer</span><button type="button" id="fin">Gevecht afronden</button></div></div>` : ""}${laBar(S, L)}<div class="row">${undoBtn}<button id="prev" class="pv" aria-label="Vorige beurt" title="Vorige beurt (Shift+N)" aria-keyshortcuts="Shift+N"><span aria-hidden="true">‹</span><span class="pvl" aria-hidden="true">Vorige</span></button><button class="aoeb" id="aoe" aria-label="Area of effect: schade of een spell op meerdere doelen" ${spellTargets(app.S.list).length ? "" : "disabled"}>AoE</button><button class="nx" id="next" title="Volgende beurt (N of spatie)" aria-keyshortcuts="N Space">Volgende<span class="nb"> beurt</span> ›</button></div>`;
}

/* ---------- open saves: regels in de beurtbalk (max 2) of één knop met paneel ---------- */
/** Bonus voor de knop "Rol": statblock-save of ability-modifier (Bless/Bane en cover tellen bij het rollen mee) */
export const svBonus = (c, ab) => saveBonus(c.ref ? findMon(c.ref) : null, ab);
/** RE7: monster zonder bekende savebonus (geen statblock/ability score): de DM rolt zelf, de app gokt geen +0 */
export const selfRoll = (c, ab) => c.kind === "monster" && !saveKnown(c.ref ? findMon(c.ref) : null, ab);
const SELF = ` <span class="tag">zelf rollen</span>`;

/** Eén open save. full = in het paneel "Open saves" (met "einde beurt"); in de beurtbalk kort (RE12: past op 320 px naast Geslaagd/Gefaald) */
function svRow(S, s, full = false) {
  const c = S.list.find((x) => x.id === s.id);
  const what = s.kind === "conc" ? `concentratie${c.concSpell ? ` · ${c.concSpell}` : ""}`
    : s.kind === "rider" ? `${s.n} · ${s.rd.conds.length ? `of ${s.rd.conds.join(" + ")}` : s.rd.dmg ? `${s.rd.roll ? s.rd.roll.total : s.rd.dmg.e} ${s.rd.dmg.type}${s.rd.dmg.half ? ", half" : ""}` : "zie statblock"}`
    : `${s.n}${full ? " · einde beurt" : ""}`;
  const self = selfRoll(c, s.ab), end = lastTurn(s);
  const btns = c.kind === "monster" && !self
    ? `<button type="button" class="svroll" data-svroll="${esc(s.sid)}" aria-label="${esc(c.name)}: ${esc(s.ab)}-save rollen, DC ${s.dc}">Rol ${sgn(svBonus(c, s.ab))}</button>`
    : `<button type="button" class="svok" data-svok="${esc(s.sid)}" data-v="1" aria-label="${esc(c.name)}: ${esc(s.ab)}-save geslaagd">Geslaagd</button><button type="button" class="svok bad" data-svok="${esc(s.sid)}" data-v="0" aria-label="${esc(c.name)}: ${esc(s.ab)}-save gefaald">Gefaald</button>`;
  const av = saveAdv(c, s.ab), adv = av.v ? ` · ${av.v > 0 ? "adv" : "dis"} (${av.why})` : ""; // RE11/RE16
  return `<div class="svrow${end ? " svend" : ""}"><span class="svn"><b>${esc(c.name)}</b><small>${esc(`${s.ab} ${s.dc} · ${what}${adv}${self ? " · zelf rollen" : ""}`)}</small>${end ? `<small class="svx">vervalt bij Volgende</small>` : ""}</span>${btns}</div>`;
}

/**
 * RE16: "Rage loopt door?" tijdens de beurt van een barbarian in rage die sinds zijn vorige beurt geen schade nam.
 * Doorgaan is het normale geval (0 tikken); de app weet niet of hij aanviel, dus alleen een knop Voorbij.
 */
function rageRow(S) {
  const c = S.round ? S.list.find((x) => x.id === S.active) : null, e = c && rageOf(c);
  if (!e || e.hit) return "";
  return `<div class="svrow rgrow"><span class="svn"><b>${esc(c.name)}</b><small>Rage loopt door? geen schade sinds vorige beurt</small></span><button type="button" class="svok bad" data-rgend="${esc(c.id)}" aria-label="Rage van ${esc(c.name)} voorbij">Voorbij</button></div>`;
}

/** GV2: alle monsters op 0 HP (minstens één; lair telt niet): regel in de beurtbalk, de DM rondt zelf af */
const allDown = (S) => { const M = S.list.filter((c) => c.kind === "monster"); return M.length > 0 && M.every(isOut); };

/**
 * Beurtbalk: ≤ 2 open saves als regels. Meer: concentratie-saves (RE17: komen uit de schade, de DM moet ze meteen zien)
 * blijven regels (max 2) en de rest zit achter één knop; 3+ concentratie-saves: alles achter de knop.
 * Ook in Voorbereiden tijdens een gevecht (paintDock), zodat een save uit de schade nooit onzichtbaar is.
 */
function svBar(S) {
  const O = openSaves(S), rg = rageRow(S), lim = rg ? 1 : 2; // de Rage-regel telt mee in de grens van 2 regels
  if (!O.length) return rg ? `<div class="svbar">${rg}</div>` : "";
  if (O.length <= lim) return `<div class="svbar">${rg}${O.map((s) => svRow(S, s)).join("")}</div>`;
  if (rg) return `<div class="svbar">${rg}<button type="button" class="svall" data-svsheet="1">Saves · ${O.length} open <span aria-hidden="true">▸</span></button></div>`;
  const C = O.filter((s) => s.kind === "conc"), btn = (t) => `<button type="button" class="svall" data-svsheet="1">${t} <span aria-hidden="true">▸</span></button>`;
  if (!C.length || C.length > 2) return `<div class="svbar">${btn(`Saves · ${O.length} open${C.length ? ` · ${C.length} concentratie` : ""}`)}</div>`;
  return `<div class="svbar">${C.map((s) => svRow(S, s)).join("")}${btn(`Saves · ${O.length - C.length} andere open`)}</div>`;
}

export function paintSv() {
  const el = $("#ssheet");
  const O = ui.sv ? openSaves(app.S) : [];
  if (!O.length) { ui.sv = false; el.hidden = true; el.innerHTML = ""; return; }
  const M = O.map((s) => [s, app.S.list.find((x) => x.id === s.id)]).filter(([, c]) => c && c.kind === "monster");
  const mons = M.filter(([s, c]) => !selfRoll(c, s.ab)).length, self = [...new Set(M.filter(([s, c]) => selfRoll(c, s.ab)).map(([, c]) => c.name))];
  const old = el.querySelector(".ssheet"), top = old ? old.scrollTop : 0;
  el.innerHTML = `<div class="dim" data-svsheet="0"></div>
    <div class="sheet qsheet ssheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="s-title">
      <div class="grab" aria-hidden="true"></div>
      <div class="shead"><h3 id="s-title">Open saves</h3><button type="button" class="link" data-svsheet="0">Sluit</button></div>
      <div class="svbar">${O.map((s) => svRow(app.S, s, true)).join("")}</div>
      ${mons > 1 ? `<button type="button" class="btn primary qgo" data-svrollall="1">Rol alle monsters (${mons})</button>` : ""}
      ${self.length ? `<p class="hint">Zelf rollen (geen save bekend): ${esc(self.join(", "))}.</p>` : ""}
      <p class="hint">Niet afgehandeld vervalt na de volgende beurtwissel, zonder gevolg.</p>
    </div>`;
  el.hidden = false;
  el.querySelector(".ssheet").scrollTop = top;
}

/* ---------- legendary actions: vaste regel in de beurtbalk + paneel ---------- */
const LA_WHY = { own: "herstelt nu", empty: "0 over", inc: "incapacitated", sur: "verrast" };
const LA_TITLE = { own: "Aan de beurt: legendary actions herstellen", empty: "Op: herstelt bij de eigen beurt", inc: "Incapacitated: geen legendary actions", sur: "Verrast: geen legendary actions tot de eigen beurt voorbij is" };
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
  let preview = "", ufBtn = "";
  const m = c.ref ? findMon(c.ref) : null;
  if (v) {
    const { sim } = sheetPreview(c, s.kind, v, s.mode);
    const hp = (x) => `${n0(x.hp)}${x.temp ? ` (+${n0(x.temp)} temp)` : ""}`;
    preview = `${hp(c)} → <b>${hp(sim)} HP</b>`;
    if (s.kind === "dmg") {
      const dealt = Math.floor(v * s.mode);
      if (s.mode !== 1) preview += ` · ${dealt} na ${{ 0.5: "resist", 2: "kwetsbaar", 0: "immuun" }[s.mode]}`;
      if (sim.ds && sim.ds.dead && !(c.ds && c.ds.dead)) preview += ` · <b class="bad">sterft</b>`;
      else if (sim.hp === 0 && c.hp > 0 && c.kind === "monster" && hasUF(m)) { // RE13: het schadepaneel kent het type niet: de DM zegt het
        preview += s.ufx ? ` · <b class="bad">neer</b> · geen Undead Fortitude` : ` · Undead Fortitude CON DC ${ufDc(dealt)} (rolt bij toepassen)`;
        ufBtn = `<div class="xrow"><button type="button" class="btn small" data-sk="ufx" aria-pressed="${!!s.ufx}">Radiant of kritiek</button><span class="hint">dan geen Undead Fortitude</span></div>`;
      }
      else if (sim.hp === 0 && c.hp > 0) preview += ` · <b class="bad">${c.kind === "pc" ? "bewusteloos" : "neer"}</b>`;
      else if (c.cond.includes("Concentrating") && sim.hp > 0 && dealt > 0) preview += ` · concentration save <b>DC ${Math.max(10, Math.floor(dealt / 2))}</b>`;
    }
  } else preview = `Nu ${n0(c.hp)}/${n0(c.max)} HP${c.temp ? ` (+${n0(c.temp)} temp)` : ""}`;
  // RE13: Parry (reaction) van een monster: de aanval van de speler mist als hij met +N niet zou raken
  const pn = s.kind === "dmg" && app.S.round && c.kind === "monster" ? parryOf(m) : 0, ac = effAc(c);
  const parry = pn && canParry(c, app.S.round) ? `<div class="xrow"><button type="button" class="btn small" data-sk="parry">Parry +${pn} → mis</button><span class="hint">Melee · raak met ${ac ? `AC ${ac}${pn > 1 ? `–${ac + pn - 1}` : ""}` : `AC +${pn}`}? dan mis</span></div>` : "";
  const kinds = [["dmg", "Schade"], ["heal", "Heal"], ["thp", "Temp HP"]];
  const label = { dmg: `${v || ""} schade toepassen`, heal: `${v || ""} HP genezen`, thp: `${v || ""} temp HP geven` }[s.kind];
  el.hidden = false;
  el.innerHTML = `<div class="dim" data-sk="close"></div>
    <div class="sheet" tabindex="-1" role="dialog" aria-modal="true" aria-label="${esc(c.name)}: ${kinds.find((k) => k[0] === s.kind)[1]}">
      <div class="grab" aria-hidden="true"></div>
      <div class="shead"><h3>${esc(c.name)}</h3><button class="link" data-sk="close">Annuleer</button></div>
      <div class="seg2">${kinds.map(([k, l]) => `<button data-sk="kind" data-v="${k}" aria-pressed="${s.kind === k}">${l}</button>`).join("")}</div>
      ${s.kind === "dmg" ? `<div class="seg2 sm">${[[1, "Normaal"], [0.5, "Resist ½"], [2, "Kwetsb. ×2"], [0, "Immuun"]].map(([m, l]) => `<button data-sk="mode" data-v="${m}" aria-pressed="${s.mode === m}">${l}</button>`).join("")}</div>${c.kind === "pc" && c.dr ? `<p class="hint drhint">${esc(drText(c.dr))}</p>` : ""}${rageOf(c) ? `<p class="hint drhint">Rage: resistance ${rageOf(c).bear ? "tegen alles behalve psychic" : "B/P/S"}, halveer.</p>` : ""}${parry}` : ""}
      <div class="disp" aria-live="polite">${esc(s.val || "0")}</div>
      <div class="preview">${preview}</div>${ufBtn}
      <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-sk="d" data-v="${n}">${n}</button>`).join("")}<button data-sk="back" aria-label="Wissen">⌫</button><button data-sk="d" data-v="0">0</button><button data-sk="clear" aria-label="Alles wissen">C</button>
        <button class="go go-${s.kind}" data-sk="apply" ${v ? "" : "disabled"}>${label}</button></div>
    </div>`;
}

/* ---------- monsterlijst (Monster-paneel en snel toevoegen) ---------- */
/** Lijst + kopregel + lege/foutmelding. attr = data-attribuut van de rijknoppen; none = tekst als er zonder filter niets is */
export function monListHtml(f, sel, attr, none) {
  const rows = f.L.map((m) => `<button type="button" ${attr}="${esc(m.n)}" aria-pressed="${m.n === sel}"><span>${icon("m-" + monType(m.meta), "mi")}${esc(m.n)}${m.custom ? " · eigen" : ""}</span><span class="cr">CR ${esc(m.cr || "?")} · AC ${parseInt(m.ac) || "?"} · ${n0(m.hp) || "?"} HP</span></button>`).join("");
  const empty = f.label ? `Niets gevonden voor ${esc(f.label)}. Probeer een ruimer bereik (bijv. cr 1-6) of een ander type.` : none;
  return rows || `<p class="hint" style="padding:10px">${empty}</p>`;
}
/** Kopregel boven de lijst: "Undead · CR 2–4 · 6 monsters", of uitleg bij een onleesbaar CR-woord; "" = verbergen */
export const monLabel = (f) => (f.bad ? "CR niet herkend. Gebruik bijv. cr 5, cr 1/2 of cr 2-4."
  : f.label ? `${f.label} · ${f.L.length} ${f.L.length === 1 ? "monster" : "monsters"}` : "");
/** Preview van de keuze: telefoon met knop naar het volledige statblock, tablet/desktop zonder (zijkolom toont het) */
export const monPrev = (m, full, side) => (m ? monCard(m, full, !side || isPhone()) : "");

/** Knoptekst bij monsters toevoegen: "2× Goblin verborgen toevoegen" (verborgen staat in de knop, zodat je het niet mist) */
export const addLabel = (n, name, hid, anon) => `${n > 1 ? `${n}× ` : ""}${name}${[hid && " verborgen", anon && " onbekend"].filter(Boolean).join(",")} toevoegen`;
export const HID_HINT = "Spelers zien ze niet, ook hun beurt niet. Later tonen via ⋯ → Tonen aan spelers.";
export const ANON_HINT = `Spelers zien "${ANON}" met een algemeen icoon. Later tonen via ⋯ → Naam tonen aan spelers.`;

/* ---------- één bedieningsblok voor monsters toevoegen (IN4): Monster-paneel en snel toevoegen ---------- */
/**
 * st = { n, fixOn, fix } per paneel; HP en Per monster/Groep komen uit ui.addOpts (onthouden), Invullen geldt één keer.
 * Rollen staat uit zonder hit dice. pre = id-voorvoegsel ("mon" of "q"). Knoppen dragen data-ab, het getalveld data-ab="fix".
 */
export const INIT_OPTS = [["each", "Per monster"], ["group", "Groep"], ["fixed", "Invullen"]];
export const addInit = (st) => (st.fixOn ? "fixed" : ui.addOpts.init);
export const addHp = (m) => (ui.addOpts.hp === "roll" && m && m.hd ? "roll" : "avg");
export function addHint(st, m) {
  const n = st.n, v = parseInit(st.fix), init = addInit(st);
  const t = init === "fixed" ? (n > 1 ? `Alle ${n} op ${v ?? "dit getal"} · één groepsbeurt.` : `Initiative ${v ?? "invullen"}.`)
    : init === "group" ? (n > 1 ? `Eén d20 voor alle ${n} · één groepsbeurt.` : "Eén d20 (een groep vanaf 2 monsters).")
    : n > 1 ? "Elk monster een eigen d20." : "d20 + Dex.";
  const hd = ui.addOpts.hp === "roll" && m && !m.hd ? " Geen hit dice: HP gemiddeld." : "";
  const late = app.S.round ? " Zit dat vóór wie nu aan de beurt is, dan doen ze pas volgende ronde mee." : "";
  return t + hd + late;
}
export function addBlockHtml(pre, st, m) {
  const init = addInit(st), seg = (k, opts, cur, dis) => opts.map(([v, l]) => `<button type="button" data-ab="${k}" data-v="${v}" aria-pressed="${cur === v}"${dis && dis(v) ? " disabled" : ""}>${l}</button>`).join("");
  return `<div class="qrow">
      <div class="qcol"><span class="qlbl" id="${pre}-nl">Aantal</span>
        <div class="stepper" role="group" aria-labelledby="${pre}-nl"><button type="button" data-ab="n" data-v="-1" aria-label="Minder" ${st.n <= 1 ? "disabled" : ""}>−</button><output aria-live="polite">${st.n}</output><button type="button" data-ab="n" data-v="1" aria-label="Meer" ${st.n >= 20 ? "disabled" : ""}>+</button></div></div>
      <div class="qcol"><span class="qlbl" id="${pre}-hl">HP</span>
        <div class="seg2" role="group" aria-labelledby="${pre}-hl">${seg("hp", [["avg", "Gemiddeld"], ["roll", "Rollen"]], m && !m.hd ? "avg" : ui.addOpts.hp, (v) => v === "roll" && m && !m.hd)}</div></div>
    </div>
    <div class="qcol"><span class="qlbl" id="${pre}-il">Initiative</span>
      <div class="seg2 init3" role="group" aria-labelledby="${pre}-il">${seg("init", INIT_OPTS, init)}</div></div>
    ${init === "fixed" ? `<label>${st.n > 1 ? `Getal voor alle ${st.n}` : "Getal"}<input id="${pre}-fix" data-ab="fix" type="number" inputmode="numeric" enterkeyhint="done" placeholder="bijv. 14" value="${esc(st.fix)}"></label>` : ""}
    <p class="hint addh" id="${pre}-addh">${esc(addHint(st, m))}</p>`;
}
/** Tik in het blok: past st of ui.addOpts aan; geeft "fix" terug als het getalveld de focus moet krijgen */
export function addBlockTap(st, b) {
  const k = b.dataset.ab, v = b.dataset.v;
  if (k === "n") st.n = Math.min(20, Math.max(1, st.n + +v));
  else if (k === "hp") ui.addOpts.hp = v;
  else if (k === "init") {
    if (v === "fixed") { st.fixOn = true; return "fix"; }
    st.fixOn = false; ui.addOpts.init = v;
  }
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
      <label>Zoek monster<input id="q-q" placeholder="naam, type of CR: undead cr 2-4" autocomplete="off" enterkeyhint="search"></label>
      <p class="mlbl" id="q-lbl" aria-live="polite" hidden></p>
      <div class="mlist qlist" id="q-list"></div>
      <div id="q-prev"></div>
      <div class="addblk" id="q-blk"></div>
      <label class="chk"><input type="checkbox" data-q="hid" id="q-hid"> Verborgen voor spelers</label>
      <p class="hint" id="q-hidh" hidden>${HID_HINT}</p>
      <label class="chk"><input type="checkbox" data-q="anon" id="q-anon"> Naam onbekend voor spelers</label>
      <p class="hint" id="q-anonh" hidden>${ANON_HINT}</p>
      <div class="sfoot"><button type="button" class="btn primary qgo" data-q="go"></button></div>
    </div>`;
    el.hidden = false;
  }
  const f = filterMonsters(allMonsters(), q.q, q.sel, !!q.typed);
  if (f.sel !== q.sel) q.full = false; // andere keuze: preview weer kort
  q.sel = f.sel; // UI-toestand: de selectie volgt wat zichtbaar is (zoals in de Monster-tab)
  const lbl = monLabel(f);
  $("#q-lbl").hidden = !lbl; $("#q-lbl").textContent = lbl;
  $("#q-list").innerHTML = monListHtml(f, q.sel, "data-qpick", "Niets gevonden. Eigen monsters maak je onder Voorbereiden → + Monster → Eigen.");
  $("#q-prev").innerHTML = monPrev(q.sel && findMon(q.sel), q.full, false); // snel toevoegen: geen zijkolom (die volgt de beurt)
  if (!q.typing) $("#q-blk").innerHTML = addBlockHtml("q", q, q.sel && findMon(q.sel)); // tijdens typen in het getalveld niet vervangen (focus)
  else $("#q-addh").textContent = addHint(q, q.sel && findMon(q.sel));
  const go = el.querySelector(".qgo");
  go.disabled = !q.sel || (q.fixOn && parseInit(q.fix) === null);
  go.textContent = q.sel ? addLabel(q.n, q.sel, q.hid, q.anon) : "Kies een monster";
  $("#q-anon").checked = q.anon; $("#q-anonh").hidden = !q.anon;
  $("#q-hid").checked = q.hid; $("#q-hidh").hidden = !q.hid;
}

/* ---------- AoE: één schadeworp op meerdere doelen ---------- */
/** Wie geraakt kan worden: iedereen met HP die nog meedoet (spelers op 0 HP ook: dat kost een death save). ex = bron van een save-actie */
export const aoeTargets = (ex = null) => sortOrder(app.S.list).filter((c) => c.kind !== "lair" && c.max && !isOut(c) && c.id !== ex);

/** Effectieve keuze per doelwit (mode null = volg het statblock voor het gekozen damage type) */
export function aoePick(a, c) {
  const m = c.ref ? findMon(c.ref) : null;
  return pickFor(a.t[c.id], targetMode(c, m, a.type));
}

const MODES = [[1, "Normaal"], [0.5, "Resist"], [2, "×2"], [0, "Immuun"]];
const SAVES = [["fail", "Gefaald"], ["half", "Geslaagd ½"], ["none", "0"]];
const SAVES0 = [["fail", "Gefaald"], ["none", "Geslaagd 0"]]; // save-actie zonder halve schade (Wing Attack)
/** Uitkomst van een geslaagde save in dit paneel */
export const okSave = (a) => (a && a.half === false ? "none" : "half");

/** RE11/RE16: "adv (Rage)" / "dis (Exhaustion 3)" bij een save, vóór het rollen (spelers rollen zelf) */
const advHint = (c, ab) => { const v = saveAdv(c, ab); return v.v ? `${v.v > 0 ? "adv" : "dis"} (${esc(v.why)})` : ""; };

function aoeRow(a, c, p, o, n) {
  const id = esc(c.id), nm = esc(c.name), dc = parseInt(a.dc);
  const end = !n ? "" : o.res ? ` · <b class="bad">${o.res}</b>` : c.hp > 0 ? ` · ${n0(c.hp)} → ${n0(o.hp)} HP` : "";
  const mods = p.roll ? [] : saveMods(c, a.ab);
  const info = [
    p.roll ? `${esc(a.ab)} save ${esc(rollText(p.roll, dc))}` : mods.length ? `Bij de save: ${esc(modsText(mods))}` : "",
    p.roll ? "" : advHint(c, a.ab),
    p.auto && p.mode !== 1 && a.type ? `${MODE_LBL[p.mode]} (${p.def && p.def.eff ? "Rage" : c.kind === "pc" ? "opgeslagen" : "statblock"})` : "",
    p.auto && p.def.cond ? `let op: ${esc(p.def.cond)}` : "",
  ].filter(Boolean).join(" · ");
  const lrLeft = c.lr ? n0(c.lr.left) : 0;
  const lrBtn = p.lr ? `<span class="hint">Legendary resistance: save geslaagd</span>`
    : p.save === "fail" && lrLeft > 0 ? `<button type="button" class="link" data-ao="lr" data-id="${id}">Legendary resistance gebruiken (${lrLeft} over)</button>` : "";
  return `<div class="at ${p.sel ? "" : "off"}">
    <label class="atop"><input type="checkbox" data-ao="sel" data-id="${id}" ${p.sel ? "checked" : ""}>
      <span class="atn"><span>${nm}</span> <span class="tag ${c.kind === "pc" ? "" : "m"}">${c.kind === "pc" ? "speler" : "monster"}</span>${p.sel && !p.roll && a.ab && selfRoll(c, a.ab) ? SELF : ""}<small>${n0(c.hp)}/${n0(c.max)} HP${c.temp ? ` +${n0(c.temp)}` : ""}</small></span>
      ${p.sel && n ? `<b class="adealt ${o.dealt ? "" : "zero"}">−${o.dealt}</b>` : ""}</label>
    ${p.sel ? `<div class="seg2 sm" role="group" aria-label="Save ${nm}">${(a.half === false ? SAVES0 : SAVES).map(([v, l]) => `<button type="button" data-ao="save" data-id="${id}" data-v="${v}" aria-pressed="${p.save === v}"${v === "none" && a.half !== false ? ` aria-label="Geen schade (bijv. Evasion)" title="Geen schade (bijv. Evasion)"` : ""}>${l}</button>`).join("")}</div>
      <div class="seg2 sm" role="group" aria-label="Weerstand ${nm}">${MODES.map(([v, l]) => `<button type="button" data-ao="mode" data-id="${id}" data-v="${v}" aria-pressed="${p.mode === v}">${l}</button>`).join("")}</div>
      <div class="acalc">${n ? o.steps.join(" → ") + end : "Vul de schade in"}${info ? `<br>${info}` : ""}</div>${lrBtn}` : ""}
  </div>`;
}

/* ---------- RE18/RE1: schade-spell, caster, slot en dobbelstenen (tab Schade, niet bij een save-actie van de kaart) ---------- */
/** Gekozen schade-spell (tabel) of null */
export const dmgSp = (a) => (a && a.dsp ? DMG_SPELLS.find((s) => s.n === a.dsp) || null : null);
/** Caster in het AoE-paneel (geen lair) of null */
export const aoeCaster = (a) => app.S.list.find((x) => x.id === a.by && x.kind !== "lair") || null;
/** Concentratie-spell die al loopt (Moonbeam in een latere beurt): schade zonder nieuw slot */
export const dmgRuns = (c, sp) => !!(c && sp && sp.conc && c.cond.includes("Concentrating") && c.concSpell === sp.n);
/**
 * Slotkeuze: wat de DM tikte, anders "run" (concentratie loopt al: geen slot) of de standaard.
 * "" = niets te kiezen: geen caster, geen slots, cantrip.
 */
export const dmgSlot = (a, c, sp) => (!sp || !c || !sp.lv || !slotChoices(c, sp.lv, sp.n).length ? "" : a.slot || (dmgRuns(c, sp) ? "run" : defaultSlot(c, sp.lv, sp.n)));
/** Slot-level van deze cast: bij "run" het level waarop hij gecast werd (c.concLvl), anders uit de keuze */
export const dmgLevel = (a, c, sp) => { const k = dmgSlot(a, c, sp); return k === "run" ? Math.max(sp.lv, c.concLvl | 0) : slotLevel(c, k, sp.lv); };
/** Dobbelstenen voor de gekozen spell, caster en slot */
export const dmgDice = (a, c, sp) => spellDice(sp, dmgLevel(a, c, sp), casterLevel(c, c && c.ref ? findMon(c.ref) : null));

/** Segment "Slot: 3rd ·2 | 4th ·1 | Pact ·2 | Zelf" (gedeeld met de tab Spell); ao = data-ao van de knoppen */
function slotSeg(c, lv, n, k, ao) {
  const opts = slotChoices(c, lv, n);
  if (!opts.length) return "";
  const cur = opts.find((o) => o.k === k), empty = cur && !(cur.left > 0);
  return `<div class="aslot"><span class="qlbl">Slot</span><div class="seg2 sm" role="group" aria-label="Slot van ${esc(c.name)}">${opts.map((o) => `<button type="button" data-ao="${ao}" data-v="${o.k}" aria-pressed="${k === o.k}" aria-label="${esc(o.k === "p" ? slotName(c, "p") : o.k[0] === "d" ? o.l : `${o.l}-level slot`)}, ${o.left} over">${esc(o.l)} <small>·${o.left}</small></button>`).join("")}<button type="button" data-ao="${ao}" data-v="self" aria-pressed="${k === "self"}" title="Slots zelf bijhouden (onthouden voor ${esc(c.name)})">Zelf</button></div></div>
    ${empty ? `<p class="hint"><b class="bad">Geen ${esc(slotName(c, k))} meer over</b>: er wordt niets afgeschreven.</p>` : k === "run" ? `<p class="hint">${esc(`${n} loopt al (concentratie): geen slot. Tik een slot voor een nieuwe cast.`)}</p>` : k === "self" ? `<p class="hint">${esc(c.name)} houdt de slots zelf bij: er wordt niets afgeschreven.</p>` : ""}`;
}

/** Suggestieknoppen (zoeken of de spells van de caster) */
const dmgBtns = (L) => L.map((s) => `<button type="button" class="btn small" data-ao="dsp" data-v="${esc(s.n)}">${esc(s.n)}<small>${s.lv ? ORD[s.lv] : "cantrip"}</small></button>`).join("");
/** Alleen de suggesties opnieuw (tijdens typen: het zoekveld houdt focus) */
export function paintDmgSugg(a) {
  const el = $("#a-sugg"); if (!el) return;
  const L = findDmgSpells(DMG_SPELLS, a.dq);
  el.innerHTML = a.dq && !L.length ? `<p class="hint">Niet in de lijst: vul de dobbelstenen hieronder zelf in.</p>` : dmgBtns(L);
}

/** Caster, spell en slot bovenaan de tab Schade */
function dmgCastHtml(a) {
  const c = aoeCaster(a), sp = dmgSp(a), cs = spellTargets(app.S.list);
  const casterSel = `<label class="scast">Caster<select id="a-by"><option value="">geen caster</option>${cs.map((x) => `<option value="${esc(x.id)}" ${x.id === a.by ? "selected" : ""}>${esc(x.name)}${x.id === app.S.active ? " (aan de beurt)" : ""}</option>`).join("")}</select></label>`;
  if (!sp) {
    const own = ownDmgSpells(c, DMG_SPELLS);
    return `${casterSel}<div class="aspell">${own.length ? `<div class="dchips">${dmgBtns(own)}</div>` : ""}
      <label class="dq">Schade-spell<input id="a-q" type="search" value="${esc(a.dq || "")}" placeholder="Zoek: fireball, sacred flame…" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"></label>
      <div class="dchips" id="a-sugg"></div></div>`;
  }
  const lvl = casterLevel(c, c && c.ref ? findMon(c.ref) : null);
  const meta = [sp.lv ? ORD[dmgLevel(a, c, sp)] : "cantrip", `${sp.ab} ${sp.half ? "½" : "0"}`, sp.type].join(" · ");
  const cant = !sp.lv && sp.cant ? `<p class="hint">${lvl ? `Cantrip · level ${lvl} → ${esc(dmgDice(a, c, sp))}` : `Cantrip · level onbekend: ${esc(sp.dice)}`}</p>` : "";
  const lose = c && sp.conc && c.cond.includes("Concentrating") && c.concSpell && c.concSpell !== sp.n ? c.concSpell : ""; // zoals in de tab Spell
  return `${casterSel}<div class="aspell"><div class="dsel"><span><b>${esc(sp.n)}</b> · ${esc(meta)}${sp.conc ? " · conc" : ""}</span><button type="button" class="link" data-ao="dspx" aria-label="Andere spell kiezen">✕</button></div>${cant}
    ${lose ? `<p class="hint"><b class="bad">${esc(`${c.name} concentreert nu op ${lose}: die vervalt.`)}</b></p>` : ""}
    ${c && sp.lv ? slotSeg(c, sp.lv, sp.n, dmgSlot(a, c, sp), "slot") : ""}</div>`;
}

/** Paneel één keer opbouwen; daarna alleen de lijst en de knop, zodat het schadeveld focus houdt */
export function paintAoe() {
  const el = $("#asheet"), a = ui.aoe;
  if (!a) { el.hidden = true; el.innerHTML = ""; return; }
  if (a.tab === "spell") { paintSpell(el, a); return; }
  if (!el.firstChild) {
    el.innerHTML = `<div class="dim" data-ao="close"></div>
    <div class="sheet qsheet asheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="a-title">
      <div class="grab" aria-hidden="true"></div>
      <div class="shead"><h3 id="a-title">${a.title ? esc(a.title) : "AoE-schade"}</h3><button type="button" class="link" data-ao="close">Annuleer</button></div>
      ${aoeTabs(a)}
      ${a.src ? "" : `<div class="acast">${dmgCastHtml(a)}</div>
      <div class="adice"><label>Dobbelstenen<input id="a-dice" value="${esc(a.dice || "")}" placeholder="8d6 of 2d6+3" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"></label><button type="button" class="btn" data-ao="droll">Rol</button></div>`}
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
    if (!a.src && !a.dsp) paintDmgSugg(a);
  }
  // per paint één keer per doel: keuze (statblock-opzoeking) en uitkomst (gesimuleerd op een kopie)
  const src = $("#a-src");
  src.hidden = !a.roll;
  const edited = a.rtot != null && clampDmg(a.dmg) !== a.rtot ? ` · aangepast (worp ${a.rtot})` : "";
  if (a.roll) src.innerHTML = `${esc(a.roll + edited)} <button type="button" class="link" data-ao="reroll">Opnieuw</button>${a.extra ? `<br>${esc(a.extra)}: apart toepassen` : ""}${a.alt ? `<br>${esc(`Of ${a.alt} (naar keuze van de caster): kies het type.`)}` : ""}${a.used ? `<br><b class="bad">${esc(a.act)} is nog niet herladen</b>` : ""}`;
  const L = aoeTargets(a.src), n = clampDmg(a.dmg);
  const rows = L.map((c) => { const p = aoePick(a, c); return { c, p, o: p.sel && n ? aoeOutcome(c, p, n) : { dealt: 0, steps: [], res: "", hp: c.hp } }; });
  const sel = rows.filter((x) => x.p.sel);
  $("#a-list").innerHTML = rows.map((x) => aoeRow(a, x.c, x.p, x.o, n)).join("") || `<p class="hint">Niemand om te raken.</p>`;
  $("#a-cnt").textContent = `Doelwitten · ${sel.length} gekozen`;
  const total = sel.reduce((s, x) => s + x.o.dealt, 0), down = sel.filter((x) => x.o.down).length;
  $("#a-sum").textContent = n && sel.length ? `Totaal ${total} schade${down ? ` · ${down} neer` : ""}` : "";
  const go = el.querySelector(".ago");
  go.disabled = !n || !sel.length;
  const sp = !a.src && dmgSp(a), c = sp && aoeCaster(a), k = sp ? dmgSlot(a, c, sp) : "";
  const slotT = slotName(c, k) ? ` · ${slotName(c, k)}` : "";
  go.textContent = !n ? "Vul de schade in" : !sel.length ? "Kies doelwitten" : `${n}${a.type ? " " + a.type : ""} op ${sel.length} doel${sel.length === 1 ? "" : "en"}${slotT}`;
}

/* ---------- Spell op doelen (tab in het AoE-paneel): Bless, Hold Person e.d. op meerdere doelen ---------- */
/** Tabs Schade | Spell; niet bij een save-actie van een monster (die is altijd schade) */
const aoeTabs = (a) => (a.src ? "" : `<div class="seg2 atabs" role="group" aria-label="Soort">${[["dmg", "Schade"], ["spell", "Spell"]].map(([v, l]) => `<button type="button" data-ao="tab" data-v="${v}" aria-pressed="${(a.tab || "dmg") === v}">${l}</button>`).join("")}</div>`);

/** Gekozen spell (preset of eigen) */
/** Editie waarmee een preset rekent voor deze caster: zijn sheet, anders de instelling Spells */
export const presetEd = (caster, n) => edFor(caster, n, rulesEd());
/** Tag op een preset-knop: "2024 · sheet" als de sheet van de caster afwijkt van de instelling én de app voor die spell anders rekent, anders "2024" bij een 2024-afwijking */
const edTag = (caster, n, p) => { const e = rulesDiffer(n) ? sheetEd(caster, n) : ""; return e && e !== rulesEd() ? `${e} · sheet` : p.ed || ""; };
/** Gekozen spell (preset of eigen); Sleep alleen als de caster op 2024 uitkomt */
export const curSpell = (a) => {
  if (a.sp === "own") return customSpell(a.cf || {});
  const sp = SPELLS[a.sp], caster = app.S.list.find((x) => x.id === a.by);
  return sp && spellFor(sp, presetEd(caster, sp.n)) ? sp : null;
};
const durName = (v) => ((DURS.find((x) => x[0] === v) || [])[1] || "").replace(/ \(10 rondes\)| \(100 rondes\)/, "").toLowerCase();

/** Keuze per doel: wat de DM tikte, anders de standaard (kant van de caster, immuniteit, humanoid) */
export function spellPick(a, sp, caster, c) {
  const m = c.ref ? findMon(c.ref) : null, def = spellDefault(sp, caster, c, m), t = a.s[c.id] || {};
  return { ...def, m, sel: t.sel ?? def.sel, ok: !!t.ok, roll: t.roll || null, lr: !!t.lr };
}

function spellRow(a, sp, caster, c, p) {
  const id = esc(c.id), nm = esc(c.name), dc = parseInt(a.sdc);
  const res = !p.sel ? "" : p.immune ? `<b class="sres zero">immuun</b>` : p.ok || p.lr ? `<b class="sres zero">geen effect</b>`
    : `<b class="sres">${esc(sp.eff || sp.conds.join(" + "))}</b>`;
  const mods = p.roll ? [] : sp.ab ? saveMods(c, sp.ab) : [];
  const info = p.roll ? `${esc(sp.ab)} save ${esc(rollText(p.roll, dc))}` : [mods.length ? `Bij de save: ${esc(modsText(mods))}` : "", sp.ab ? advHint(c, sp.ab) : ""].filter(Boolean).join(" · ");
  const lrLeft = c.lr ? n0(c.lr.left) : 0;
  const lrBtn = p.lr ? `<span class="hint">Legendary resistance: save geslaagd</span>`
    : sp.ab && !p.ok && !p.immune && lrLeft > 0 ? `<button type="button" class="link" data-ao="slr" data-id="${id}">Legendary resistance gebruiken (${lrLeft} over)</button>` : "";
  return `<div class="at ${p.sel ? "" : "off"}">
    <label class="atop"><input type="checkbox" data-ao="ssel" data-id="${id}" ${p.sel ? "checked" : ""}>
      <span class="atn"><span>${nm}</span> <span class="tag ${c.kind === "pc" ? "" : "m"}">${c.kind === "pc" ? "speler" : "monster"}</span>${p.tags.map((t) => ` <span class="tag">${esc(t)}</span>`).join("")}${p.sel && !p.roll && !p.immune && sp.ab && selfRoll(c, sp.ab) ? SELF : ""}<small>${c.max ? `${n0(c.hp)}/${n0(c.max)} HP` : "HP onbekend"}</small></span>
      ${res}</label>
    ${p.sel && sp.ab && !p.immune ? `<div class="seg2 sm" role="group" aria-label="Save ${nm}">${[["0", "Gefaald"], ["1", "Geslaagd"]].map(([v, l]) => `<button type="button" data-ao="ssave" data-id="${id}" data-v="${v}" aria-pressed="${(p.ok || p.lr) === (v === "1")}">${l}</button>`).join("")}</div>
      ${info ? `<div class="acalc">${info}</div>` : ""}${lrBtn}` : ""}
  </div>`;
}

/** RE2: slot voor een spell uit de tab Spell: wat de DM tikte, anders de standaard (meer doelen = hoger slot). "" = niets te kiezen */
export function spellSlot(a, sp, caster, n) {
  if (!sp || sp.custom || !sp.lvl || !caster || !slotChoices(caster, sp.lvl, sp.n).length) return "";
  return a.sslot || defaultSlot(caster, sp.lvl, sp.n, slotFor(sp, n) || sp.lvl);
}

/** Spell-tab: opbouw één keer per tab/spell/caster (velden houden focus), daarna alleen lijst, waarschuwing en knop */
function paintSpell(el, a) {
  const S = app.S, sp = curSpell(a), caster = S.list.find((x) => x.id === a.by && x.kind !== "lair") || null;
  if (!el.firstChild) {
    const cs = spellTargets(S.list);
    const cf = a.cf || {};
    const own = a.sp === "own" ? `<div class="sform">
        <label>Naam<input id="s-n" value="${esc(cf.n || "")}" placeholder="bijv. Fear" maxlength="60" autocomplete="off"></label>
        <div class="ed3">
          <label>Conditie<select id="s-cond">${SPELL_CONDS.map((k) => `<option ${(cf.cond || "Frightened") === k ? "selected" : ""}>${k}</option>`).join("")}</select></label>
          <label>Save<select id="s-ab"><option value="">geen</option>${ABS.map((x) => `<option ${cf.ab === x ? "selected" : ""}>${x}</option>`).join("")}</select></label>
          <label>Duur<select id="s-dur">${DURS.map(([v, l]) => `<option value="${v}" ${(cf.dur || "r10") === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
        </div>
        <div class="schk"><label><input type="checkbox" id="s-rep" ${cf.rep ? "checked" : ""}> Save aan einde beurt</label><label><input type="checkbox" id="s-conc" ${cf.conc === false ? "" : "checked"}> Concentratie</label></div>
      </div>` : "";
    el.innerHTML = `<div class="dim" data-ao="close"></div>
    <div class="sheet qsheet asheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="a-title">
      <div class="grab" aria-hidden="true"></div>
      <div class="shead"><h3 id="a-title">Spell op doelen</h3><button type="button" class="link" data-ao="close">Annuleer</button></div>
      ${aoeTabs(a)}
      <div class="effgrid spgrid">${SPELLS.map((x, i) => (spellFor(x, presetEd(caster, x.n)) ? `<button type="button" class="btn tap" data-ao="sp" data-v="${i}" aria-pressed="${a.sp === i}"><span>${esc(x.n)}${edTag(caster, x.n, x) ? ` <span class="tag">${esc(edTag(caster, x.n, x))}</span>` : ""}</span><small>${esc(x.sub)}</small></button>` : "")).join("")}<button type="button" class="btn tap" data-ao="todmg">Schade-spell<small>Fireball, Sacred Flame …</small></button><button type="button" class="btn tap" data-ao="sp" data-v="own" aria-pressed="${a.sp === "own"}">+ Eigen<small>conditie + save</small></button></div>
      <label class="scast">Caster<select id="s-by"><option value="">kies wie cast</option>${cs.map((x) => `<option value="${esc(x.id)}" ${x.id === a.by ? "selected" : ""}>${esc(x.name)}${x.id === S.active ? " (aan de beurt)" : ""}</option>`).join("")}</select></label>
      <div id="s-slot"></div>
      ${own}
      ${sp && sp.ab ? `<div class="asave"><span class="qlbl">Save</span><b>${esc(sp.ab)}</b>
        <input id="s-dc" type="number" inputmode="numeric" placeholder="DC" aria-label="DC" min="1" max="40" value="${esc(a.sdc || "")}">
        <button type="button" class="btn small" data-ao="sroll">Rol monsters</button></div>` : ""}
      <p class="hint" id="s-info" aria-live="polite"></p>
      <div class="asel"><span class="qlbl" id="a-cnt"></span><span><button type="button" class="link" data-ao="sall" data-v="monster">Monsters</button><button type="button" class="link" data-ao="sall" data-v="pc">Spelers</button><button type="button" class="link" data-ao="sall" data-v="">Niemand</button></span></div>
      <div class="alist" id="a-list"></div>
      <div class="afoot"><span class="hint" id="a-sum" aria-live="polite"></span><button type="button" class="btn primary qgo ago" data-ao="sgo"></button></div>
    </div>`;
    el.hidden = false;
  }
  const L = sortOrder(spellTargets(S.list));
  const go = el.querySelector(".ago");
  if (!sp) {
    const gone = typeof a.sp === "number" && SPELLS[a.sp]; // preset bestaat niet voor de editie van deze caster (Sleep 2014)
    $("#s-info").textContent = gone ? `${gone.n} ${presetEd(caster, gone.n)} heeft geen preset${gone.n === "Sleep" ? " (HP-pool)" : ""}. Zet de conditie op de kaart of gebruik + Eigen.` : "Kies een spell.";
    $("#a-list").innerHTML = ""; $("#a-cnt").textContent = ""; $("#a-sum").textContent = "";
    go.disabled = true; go.textContent = "Kies een spell";
    return;
  }
  const rows = L.map((c) => ({ c, p: spellPick(a, sp, caster, c) })), sel = rows.filter((x) => x.p.sel);
  // uitleg: wat een gefaalde save doet, duur, concentratie, herhaalsave, en of de caster een andere concentratie verliest
  const what = sp.eff ? effText(presetsFor(presetEd(caster, sp.n)).find((p) => p.n === sp.eff)) || "" : sp.conds.join(" + ");
  const bits = [what, sp.dur === "inf" && sp.conc ? "zolang de concentratie duurt" : durName(sp.eff ? "r10" : sp.dur), sp.conc ? "conc" : "", sp.rep ? `herhaalsave ${sp.ab} einde beurt` : "", sp.note || ""].filter(Boolean);
  const lose = caster && sp.conc && caster.cond.includes("Concentrating") && caster.concSpell && caster.concSpell !== sp.n ? caster.concSpell : "";
  $("#s-info").innerHTML = `${esc(bits.join(" · "))}${lose ? `<br><b class="bad">${esc(caster.name)} concentreert nu op ${esc(lose)}: die vervalt.</b>` : ""}${a.redc ? `<br>${esc(`Gerolde saves nu tegen DC ${a.redc} (nieuwe caster).`)}` : ""}`;
  $("#a-list").innerHTML = rows.map((x) => spellRow(a, sp, caster, x.c, x.p)).join("") || `<p class="hint">Niemand om te kiezen.</p>`;
  // RE8: maximum aantal doelen (Hold Person 1, Bless/Bane 3, +1 per hoger slot); niet blokkeren.
  // RE2: heeft de caster slots, dan kiest het segment het slot (standaard schuift mee met het aantal doelen) en volgt het maximum daaruit
  const k = spellSlot(a, sp, caster, sel.length), ss = $("#s-slot");
  const html = caster && sp.lvl && !sp.custom ? slotSeg(caster, sp.lvl, sp.n, k, "sslot") : "";
  if (ss.innerHTML !== html) ss.innerHTML = html;
  const cnt = $("#a-cnt");
  let slot = "", over = false;
  if (k) {
    const L = slotLevel(caster, k, sp.lvl), mx = sp.max ? sp.max + L - sp.lvl : 0;
    over = !!mx && sel.length > mx;
    cnt.textContent = mx ? `Doelen · ${sel.length} van ${mx}${k !== "self" ? ` · ${ORD[L]}` : ""}` : `Doelen · ${sel.length} gekozen`;
    slot = k !== "self" ? slotName(caster, k) : "";
  } else {
    const need = slotFor(sp, sel.length);
    slot = need ? (need > 9 ? "meer doelen dan een 9th-level slot" : `${ORD[need]}-level slot`) : "";
    over = !!slot;
    cnt.textContent = sp.max && !sp.custom ? `Doelen · ${sel.length} van ${sp.max}${slot ? ` · ${slot}` : ""}` : `Doelen · ${sel.length} gekozen`;
  }
  cnt.classList.toggle("over", over);
  const hit = sel.filter((x) => !x.p.immune && !x.p.ok && !x.p.lr).length, ok = sel.length - hit;
  $("#a-sum").textContent = sp.ab && sel.length ? `${hit} ${sp.eff ? "geraakt" : sp.conds[0]}${ok ? ` · ${ok} geen effect` : ""}` : "";
  go.disabled = !caster || !sel.length;
  go.textContent = !caster ? "Kies wie cast" : !sel.length ? "Kies doelen" : `${sp.n} op ${sel.length} doel${sel.length === 1 ? "" : "en"}${slot ? ` · ${slot}` : ""}`;
}

/* ---------- aanval op één doel (to-hit-knop op de monsterkaart) ---------- */
const ADVS = [["a", "Auto"], [1, "Adv"], [-1, "Dis"], [0, "Normaal"]];
const ADV_W = { 1: "Advantage", "-1": "Disadvantage", 0: "Normaal" };
const XMODES = [[1, "Normaal"], [0.5, "Resist ½"], [2, "Kwetsb. ×2"], [0, "Immuun"]];
const AUTO_CRIT = ["Paralyzed", "Unconscious"];

/** Wie een aanval kan krijgen: niet de aanvaller, geen lair, geen dode speler of monster op 0 HP (spelers op 0 HP wel) */
export const atkTargets = (by) => sortOrder(app.S.list).filter((c) => c.kind !== "lair" && c.id !== by && !isOut(c));

/** Knoptekst bij een treffer: "7 schade + Prone toepassen", "7 schade toepassen · save in beurtbalk" (RE13) */
function goLabel(dealt, ri, x) {
  const base = dealt ? `${dealt} schade` : "";
  if (!ri || !ri.act || ri.choice === "na") return dealt ? `${base} toepassen` : "Geen schade";
  const rd = ri.rd, ch = ri.choice;
  if (!ch) return `${base || "Niets"} toepassen · save in beurtbalk`;
  const extra = [];
  if (rd.dmg && x.rroll) { const v = ch === "fail" ? x.rroll.total : rd.dmg.half ? Math.floor(x.rroll.total / 2) : 0; if (v) extra.push(`${v} ${rd.dmg.type}`); }
  if (ch === "fail" && rd.conds.length) extra.push(rd.conds.join(" + "));
  const all = [base, ...extra].filter(Boolean);
  return all.length ? `${all.join(" + ")} toepassen` : "Toepassen (geen gevolg)";
}

/** RE13: Parry aanbieden bij monster tegen monster: melee, raak (geen nat 20) en met +N zou het missen */
const parryOk = (c, x, r, res) => {
  const n = c.kind === "monster" && c.ref ? parryOf(findMon(c.ref)) : 0;
  return n > 0 && !(x.acp && x.acp.id === c.id && c.reaction) && x.kind !== "ranged" && res.hit && !x.force.hit && r.nat !== 20 && canParry(c, app.S.round) && r.tot < atkAc(x, c) + n;
};

/** Shield (reaction, +5) aanbieden: speler die kan reageren (niet op 0 HP/incapacitated), geraakt maar niet met een natuurlijke 20, en +5 AC zou missen */
export const shieldOk = (c, x, r, res) => c.kind === "pc" && c.hp > 0 && !c.cond.some((k) => NO_ACT.includes(k)) && res.hit && !x.force.hit && r.nat !== 20 && !c.reaction
  && !(c.eff || []).some((e) => e.n === "Shield") && r.tot < effAc(c) + 5;

/** AC van het doel voor deze aanval: effecten (Shield) plus een Parry van dít doel op deze aanval (RE13; ongedaan = weg) */
export const atkAc = (x, c) => (effAc(c) || 0) + (x.acp && x.acp.id === c.id && c.reaction ? x.acp.n : 0);

/** RE13: rider van deze aanval tegen dit doel (riderFor in monrules.js); null zonder treffer */
export function atkRider(x, c, res, sim) {
  return res.hit ? riderFor(x.rid, c, c.ref ? findMon(c.ref) : null, sim, x.rs) : null;
}

/** Rij "Daarna · STR DC 11 · of Prone" in het aanvalspaneel (alleen bij een treffer) */
function riderRow(x, c, ri) {
  const rd = ri.rd, head = `Daarna · ${rd.ab} DC ${rd.dc} · ${esc(riderWhat(rd))}`;
  const only = rd.only ? `<p class="hint">Alleen als: ${esc(rd.only)}</p>` : "";
  if (ri.immune) return `<div class="xrider"><p class="hint">${head} <span class="tag">immuun</span></p></div>`;
  if (!ri.act) return `<div class="xrider"><p class="hint">Let op: bij gefaalde ${rd.ab} ${rd.dc}: ${esc(rd.note)}</p>${only}</div>`;
  const roll = x.rroll ? `<p class="hint">${esc(x.rroll.txt)}${rd.dmg.half ? `, half ${Math.floor(x.rroll.total / 2)}` : ""}</p>` : "";
  if (ri.auto) return `<div class="xrider"><p class="qlbl">${head}</p>${roll}<p class="hint"><span class="tag">bewusteloos: faalt vanzelf</span></p></div>`;
  const canRoll = c.kind === "monster" && !selfRoll(c, rd.ab);
  return `<div class="xrider"><p class="qlbl">${head}</p>${roll}
    <div class="xrow">${canRoll ? `<button type="button" class="btn small" data-xa="rroll" aria-label="${esc(c.name)}: ${rd.ab}-save rollen, DC ${rd.dc}">Rol ${sgn(svBonus(c, rd.ab))}</button>` : ""}
    <div class="seg2 sm" role="group" aria-label="Save ${esc(c.name)}">${[["fail", "Gefaald"], ["ok", "Geslaagd"], ...(rd.only ? [["na", "n.v.t."]] : [])].map(([v, l]) => `<button type="button" data-xa="rs" data-v="${v}" aria-pressed="${x.rs === v}">${l}</button>`).join("")}</div></div>
    ${x.rx ? `<p class="hint">${esc(`${rd.ab} ${rollText(x.rx, rd.dc)}`)}</p>` : ""}${only}</div>`;
}

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
  const ac = atkAc(x, c), res = atkResult(r, ac, x.parts, x.modes, x.force);
  const word = res.crit ? "Kritiek!" : res.hit ? (res.natHit ? "Raak" : "Toch raak") : r.nat === 1 ? "Mis (nat 1)" : "Mis";
  const crit = c.cond.filter((k) => AUTO_CRIT.includes(k));
  const hints = [
    !ac ? "AC onbekend: vergelijk zelf" : "",
    crit.length ? `${esc(c.name)}: ${esc(crit.join(", "))} · binnen 5 ft is een treffer kritiek` : "",
    ...au.hint.map(esc),
  ].filter(Boolean);
  const how = advLine(x, au, r);
  let body = "", foot = "";
  if (x.acp && x.acp.id === c.id && c.reaction) hints.unshift(`Parry: AC ${ac - x.acp.n} + ${x.acp.n} = ${ac}`);
  if (res.hit) {
    const sim = structuredClone(c), was = c.hp;
    if (c.max) atkDamage(sim, res);
    const uf = c.max && ufNeed(sim, c.ref ? findMon(c.ref) : null, was, res.dealt, ufInfo(res));
    const ri = atkRider(x, c, res, sim);
    const end = !c.max ? "" : sim.ds && sim.ds.dead && !(c.ds && c.ds.dead) ? ` · <b class="bad">sterft</b>`
      : uf && uf.dc ? ` · Undead Fortitude CON DC ${uf.dc} (rolt bij toepassen)`
      : was > 0 && sim.hp <= 0 ? ` · <b class="bad">${c.kind === "pc" ? "bewusteloos" : "neer"}</b>${uf && uf.skip ? ` · geen Undead Fortitude (${uf.skip})` : ""}`
      : c.kind === "pc" && was <= 0 && res.dealt ? ` · <b class="bad">${res.crit ? "twee failures" : "death save failure"}</b>` : "";
    body = `${x.parts.length ? `<div class="xdmg">${x.parts.map((p) => esc(partText(p, res.crit))).join("<br>")}</div>` : `<p class="hint">Geen schade-worp in deze aanval.</p>`}
      ${res.types.map((t) => `<div class="xmode"><span class="qlbl">${esc(t.type || "schade")}${t.mode !== 1 && t.mode === targetMode(c, null, t.type).mode ? (targetMode(c, null, t.type).eff ? " · Rage" : c.kind === "pc" ? " · opgeslagen" : "") : ""}</span><div class="seg2 sm" role="group" aria-label="Weerstand ${esc(t.type)}">${XMODES.map(([v, l]) => `<button type="button" data-xa="mode" data-t="${esc(t.type)}" data-v="${v}" aria-pressed="${t.mode === v}">${l}</button>`).join("")}</div></div>`).join("")}
      <div class="xrow"><button type="button" class="btn small" data-xa="crit" aria-pressed="${res.crit}">Kritiek</button>
      <span class="acalc">${c.max ? `${n0(c.hp)} → ${n0(sim.hp)} HP${end}` : "HP onbekend"}</span></div>
      ${ri ? riderRow(x, c, ri) : ""}`;
    const can = c.max && (res.dealt || (ri && ri.act && ri.choice !== "na"));
    const left = shieldOk(c, x, r, res) ? `<button type="button" class="btn" data-xa="shield">Shield +5</button>`
      : parryOk(c, x, r, res) ? `<button type="button" class="btn" data-xa="parry">Parry +${parryOf(findMon(c.ref))}</button>` : "<span></span>";
    const nx = !can && x.sq && x.sq.left.length ? x.sq.left[0] : ""; // GV11: niets toe te passen (immuun): wel door
    foot = `${left}${nx ? `<button type="button" class="btn primary qgo" data-xa="next">Volgende: ${esc(nx)} <span aria-hidden="true">▸</span></button>`
      : `<button type="button" class="btn primary qgo" data-xa="go" ${can ? "" : "disabled"}>${!c.max ? "HP onbekend" : goLabel(res.dealt, ri, x)}</button>`}`;
  } else {
    const spend = x.la && x.la.on && laCan(x, by);
    const nx = !spend && x.sq && x.sq.left.length ? x.sq.left[0] : ""; // GV11: door naar de volgende aanval
    foot = `<button type="button" class="link" data-xa="force">Toch raak</button><button type="button" class="btn primary qgo" data-xa="${spend ? "miss" : nx ? "next" : "close"}">${spend ? `Sluit (−${x.la.cost} LA)` : nx ? `Volgende: ${esc(nx)} <span aria-hidden="true">▸</span>` : "Sluit"}</button>`;
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
      <div class="shead"><h3 id="x-title">${esc(x.label)}${x.sq ? ` ${x.sq.i}/${x.sq.n}` : ""} → ${c ? esc(c.name) : "doel?"}</h3><button type="button" class="link" data-xa="close">Annuleer</button></div>
      ${c ? atkRes(x, c, by) : atkPick(x, by)}
    </div>`;
  el.hidden = false;
}

/* ---------- initiative van spelers bij Start gevecht ---------- */
/** GV5: Monsters Houden | Opnieuw rollen (alleen met onaangeroerde worpen; ingevuld of aangepast blijft altijd) */
function monRollHtml(mons) {
  if (!mons) return "";
  const fresh = app.S.list.filter(freshRoll).length, fixed = mons - fresh;
  if (!fresh) return `<p class="hint">Monsters: initiative vast (${mons}).</p>`;
  const v = initRoll();
  return `<div class="isur"><span id="i-mon">Monsters</span><div class="seg2" role="group" aria-labelledby="i-mon">${[["keep", "Houden"], ["roll", "Opnieuw rollen"]].map(([k, l]) => `<button type="button" data-ia="mroll" data-v="${k}" aria-pressed="${v === k}">${l}</button>`).join("")}</div></div>
      <p class="hint">${v === "roll" ? `Rolt bij Start: d20 + Dex.${fixed ? ` Ingevuld of aangepast blijft (${fixed}).` : ""}` : "Gerold bij toevoegen."}</p>`;
}
export function paintInit() {
  const el = $("#isheet"), x = ui.initDraft;
  if (!x) { el.hidden = true; el.innerHTML = ""; return; }
  const L = initPcs(app.S.list), mons = app.S.list.filter((c) => c.kind === "monster").length;
  const last = L.length && L[L.length - 1].id === x.act;
  el.innerHTML = `<div class="dim" data-ia="close"></div>
    <div class="sheet qsheet isheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="i-title">
      <div class="grab" aria-hidden="true"></div>
      <div class="shead"><h3 id="i-title">Initiative</h3><button type="button" class="link" data-ia="close">Annuleer</button></div>
      ${monRollHtml(mons)}
      <div class="isur"><span id="i-sur">Verrast</span><div class="seg2" role="group" aria-labelledby="i-sur">${[["none", "Niemand"], ["mon", "Monsters"], ["pc", "Spelers"]].map(([k, l]) => `<button type="button" data-ia="sur" data-v="${k}" aria-pressed="${(x.sur || "none") === k}" ${k === "mon" && !mons ? "disabled" : ""}>${l}</button>`).join("")}</div></div>
      <p class="hint isurh" id="i-surh">${(x.sur || "none") === "none" ? "Verrast is wie de tegenpartij niet opmerkte toen het gevecht begon (Stealth tegen passive Perception). Losse wezens: ⋯ → Verrast." : "Verrasten slaan hun eerste beurt over en hebben tot die voorbij is geen reaction."}</p>${percLine()}
      <div class="ilist">${L.map((c) => `<div class="ir ${c.id === x.act ? "act" : ""}">
        <button type="button" class="irn" data-ia="sel" data-id="${esc(c.id)}" aria-pressed="${c.id === x.act}" aria-label="${esc(c.name)}: initiative ${esc(x.v[c.id] || "leeg")}"><span>${esc(c.name)}</span>${x.rolls[c.id] ? `<small>${esc(x.rolls[c.id])}</small>` : ""}</button>
        <b class="iv" aria-hidden="true">${x.v[c.id] !== "" && x.v[c.id] != null ? esc(x.v[c.id]) : "—"}</b>
        <button type="button" class="btn small" data-ia="roll" data-id="${esc(c.id)}" aria-label="Initiative rollen voor ${esc(c.name)}">Rol</button></div>`).join("")}</div>
      <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-ia="d" data-v="${n}">${n}</button>`).join("")}<button type="button" data-ia="back" aria-label="Wissen">⌫</button><button type="button" data-ia="d" data-v="0">0</button><button type="button" data-ia="clear" aria-label="Leegmaken">C</button></div>
      <div class="ifoot sfoot"><button type="button" class="btn" data-ia="next" ${last ? "disabled" : ""}>Volgende ›</button><button type="button" class="btn primary qgo" data-ia="go">Start gevecht</button></div>
    </div>`;
  el.hidden = false;
}

/* ---------- party en logboek ---------- */
/** VB2: wie een sessie voorbereidt zoekt bij Party; de encounters staan onder + Monster */
const ENC_LINK = `<button type="button" class="btn tap enclink" data-prep="enc">Encounters klaarzetten <span aria-hidden="true">▸</span></button>`;
export function paintParty() {
  const el = $("#party-panel");
  const at = new Set(app.S.list.filter((c) => c.pid).map((c) => c.pid));
  const fight = !!app.S.round; // SP4: initiative pas bij Start gevecht; tijdens een gevecht meteen (het paneel opent niet meer)
  if (!app.party.length) {
    el.innerHTML = `<p class="hint">Nog geen vaste party. Spelers die je toevoegt met "Ook opslaan in vaste party" komen hier, inclusief geïmporteerde sheets. HP, spell slots en resources lopen dan door van gevecht naar gevecht tot een rust.</p>${ENC_LINK}`;
    return;
  }
  el.innerHTML = `<div>${app.party.map((m) => {
    const sl = m.casting && (m.casting.slots.length || m.casting.pact) ? " · slots " + [...(m.casting.pact ? [`Pact ${n0(m.casting.pact.left)}/${n0(m.casting.pact.max)}`] : []), ...m.casting.slots.map((x) => `${n0(x.left)}/${n0(x.max)}`)].join(" ") : "";
    const rs = (m.res || []).map((r) => ` · ${esc(r.n)} ${n0(r.left)}/${n0(r.max)}`).join("");
    const pp = passives(m).per; // SP5: alleen Perception, regel blijft kort
    // level voor de moeilijkheid: uit de klasse-string van de sheet, anders zelf invullen
    const lv = m.sheet && clsLevel(m.sheet.cls) ? "" : `<label class="plvl">Level <input data-plvl="${esc(m.pid)}" type="number" min="1" max="20" inputmode="numeric" value="${esc(m.lvl ?? "")}" aria-label="Level ${esc(m.name)}"></label>`;
    // SP1: Bijwerken alleen met D&D Beyond-link; in de middenkolom, ver van "Uit party"
    const u = ui.pUpd && ui.pUpd.pid === m.pid ? ui.pUpd : null, busy = ui.pUpd && ui.pUpd.st === "busy";
    const upd = m.ddbId ? `<button type="button" class="link pupd" data-pupd="${esc(m.pid)}" aria-label="${esc(m.name)} bijwerken van D&amp;D Beyond"${busy ? ` aria-disabled="true"` : ""}${u && u.st === "busy" ? ` aria-busy="true"` : ""}>${u && u.st === "busy" ? "Ophalen…" : u && u.st === "err" ? "↻ Opnieuw" : "↻ Bijwerken"}</button>` : "";
    const box = !u || u.st === "busy" ? "" : u.st === "err" ? `<p class="hint warnline pupdbox"${u.said ? "" : ` role="alert"`}>${esc(u.msg)}</p>`
      : `<div class="confirmbox pupdbox"><p style="margin:0"><b>${esc(m.name)}</b> bijwerken van D&amp;D Beyond${at.has(m.pid) ? " (zit aan tafel)" : ""}.</p>
        <p class="hint">${esc([...u.ch, ...u.kept].join(" · "))}. Schade en verbruik blijven staan.</p>
        <div class="bar"><button type="button" class="btn primary tap" data-pupdok="${esc(m.pid)}">Bijwerken</button><button type="button" class="btn tap" data-pupdno="${esc(m.pid)}">Annuleer</button></div></div>`;
    return `<div class="pm">${avatar({ ...m, kind: "pc" })}<div><div class="pn">${esc(m.name)}</div><div class="pi">${m.sheet && m.sheet.cls ? esc(m.sheet.cls) + " · " : ""}${m.ac ? `AC ${n0(m.ac)} · ` : ""}${m.max ? `HP ${n0(m.hp)}/${n0(m.max)}${m.temp ? ` +${n0(m.temp)}` : ""}` : ""}${sl}${pp != null ? ` · Passive Perc ${n0(pp)}` : ""}${rs}</div>${lv}${upd}</div>
      <div class="pc">${at.has(m.pid) ? `<span class="here">aan tafel</span>` : !fight ? "" : `<input data-pinit="${esc(m.pid)}" type="number" inputmode="numeric" placeholder="init" aria-label="Initiative ${esc(m.name)}" value="${esc(ui.partyInit[m.pid] ?? "")}"><button type="button" class="btn small" data-proll="${esc(m.pid)}">Rol</button>`}
        <button type="button" class="link" data-pdel="${esc(m.pid)}">Uit party</button></div>${box}</div>`;
  }).join("")}</div>
    <div class="bar">${fight ? `<button type="button" class="btn small" id="p-rollall">Rol voor iedereen</button>` : ""}<button type="button" class="btn primary" id="p-add">Party aan tafel zetten</button></div>
    ${fight ? "" : `<p class="hint">Initiative vullen ze in bij Start gevecht.</p>`}
    <div class="bar"><button type="button" class="btn small" id="p-short">Short rest</button><button type="button" class="btn small" id="p-long">Long rest</button></div>
    <p class="hint">Rust geldt voor de hele party, ook wie aan tafel zit. Long rest: volle HP, slots en resources. Short rest: resources met "per short rest".</p>${ENC_LINK}`;
}

const logCount = (S) => (S.log || []).filter((e) => !e.type).length;
/** Regels van het logboek, nieuwste bovenaan (gedeeld door het blok onder de lijst en het paneel in Gevecht) */
function logItems(L) {
  return [...L].reverse().map((e) => {
    if (e.type === "round") return `<li class="lg-round">${esc(e.msg)}</li>`;
    if (e.type === "turn") return `<li class="lg-turn">${esc(e.msg)}</li>`;
    return `<li class="lg"><span class="lg-meta">${logRound(e.r)}${e.turn ? ` · beurt ${esc(e.turn)}` : ""}</span>
      <button type="button" class="lg-msg" data-logedit="${esc(e.id)}" aria-label="${esc(`Reden bij: ${e.msg}`)}">${esc(e.msg)}</button>
      ${e.why ? `<span class="lg-why">${esc(e.why)}</span>` : ""}
      ${ui.editLog === e.id ? `<input class="lg-in" data-lognote="${esc(e.id)}" value="${esc(e.note || "")}" placeholder="Waarom? bijv. Fireball van Wolfim" aria-label="Reden">`
        : e.note ? `<button type="button" class="lg-note" data-logedit="${esc(e.id)}">${esc(e.note)}</button>` : ""}</li>`;
  }).join("");
}
const EMPTY_LOG = `<p class="hint">Nog niets gebeurd. Schade, condities, spells, death saves en beurten verschijnen hier automatisch, met ronde en oorzaak.</p>`;

/**
 * Logboek: in Voorbereiden een uitklapblok onder de lijst; in Gevecht alleen als paneel #gsheet (IN7), want onder de
 * kaarten is het ver van de duim. Nooit beide tegelijk (zelfde id's).
 */
export function paintLog() {
  const el = $("#logwrap"), gs = $("#gsheet");
  const L = app.S.log || [], fight = mode() === "fight";
  if (!fight) ui.logSheet = false; // gevecht voorbij of naar Voorbereiden: paneel dicht (UI-toestand)
  if (!ui.logSheet) { if (!gs.hidden) { gs.hidden = true; gs.innerHTML = ""; } }
  else {
    const old = gs.querySelector(".gsheet"), top = old ? old.scrollTop : 0, h0 = old ? old.scrollHeight : 0, cnt = old ? +old.dataset.n : L.length;
    gs.innerHTML = `<div class="dim" data-log="close"></div>
      <div class="sheet qsheet gsheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="g-title" data-n="${L.length}">
        <div class="grab" aria-hidden="true"></div>
        <div class="shead"><h3 id="g-title">Logboek · ronde ${n0(app.S.round)}</h3><button type="button" class="link" data-log="close">Sluit</button></div>
        ${L.length ? `<p class="hint lg-tip">Tik op een regel voor een reden.</p><ol class="lglist">${logItems(L)}</ol>` : EMPTY_LOG}
        ${L.length ? `<div class="ifoot"><button type="button" class="btn" id="logcopy">Kopieer als tekst</button><button type="button" class="btn" data-log="close">Sluit</button></div>` : ""}
      </div>`;
    gs.hidden = false;
    const sh = gs.querySelector(".gsheet");
    sh.scrollTop = top > 0 && L.length > cnt ? top + sh.scrollHeight - h0 : top; // nieuwe regels komen bovenaan: wie omlaag las, blijft op dezelfde regel
  }
  if (fight || (!L.length && !app.S.list.length)) { el.innerHTML = ""; } // Gevecht: alleen het paneel; lege start: geen leeg logboek
  else el.innerHTML = `<details class="logbox" id="logbox" ${ui.logOpen ? "open" : ""}><summary><span>Logboek</span> <span class="hint">${logCount(app.S)} gebeurtenissen</span></summary>
    ${L.length ? `<div class="bar" style="margin:8px 0"><button class="btn small" id="logcopy">Kopieer als tekst</button></div><p class="hint lg-tip">Tik op een regel voor een reden.</p><ol class="lglist">${ui.logOpen ? logItems(L) : ""}</ol>` : EMPTY_LOG}</details>`;
  if (ui.editLog) { const i = (ui.logSheet ? gs : el).querySelector(".lg-in"); if (i) i.focus(); }
}
