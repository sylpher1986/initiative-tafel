// Tekent de encounter (compacte kaarten, één tegelijk open), de beurtbalk, het schade-paneel,
// de party en het logboek. Render past de data niet aan.
import { MAC } from "./keys.js";
import { ico, chev, dsMini } from "./icons.js";
import { paintSetStat } from "./settings.js";
import { $, esc, n0, spellLink, tb } from "./util.js";
import { t, tr } from "../i18n/boot.js";
import { app, commit, canUndo } from "../state.js";
import { findMon, allMonsters, filterMonsters } from "../data/monsters.js";
import { SYN } from "../data/syn.js";
import { sortOrder, CONDS, DURS, durText, durLabel, isOut, parseInit, initPcs, groupOf, isSurprised, reactUsed, reactTag, canToggleSurprise, nextUp, freshRoll, initPlan, initText, durShort } from "../rules/turns.js";
import { PRESETS as PRESETS_14, presetsFor, effAc, effText, effNote, acBreakdown, baseMax, saveMods, modsText, isWarn, effName, isRage, rageOf, rageRes, barbLevel, rageDmg } from "../rules/effects.js";
import { isExh, exhLevel, exhSummary, SUR, condName } from "../rules/conditions.js";
import { term } from "../i18n/term.js";
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
import { anonName } from "../playerview.js";
import { paintEnc, encBanner, encStrip } from "./encounters.js";
import { paintEnd, endBanner } from "./einde.js";
import { PAS, passives, pasText, sheetPassives, percList } from "../rules/passives.js";
import { pcReact } from "./pcreact.js";
import { clsLevel } from "../rules/encounters.js";
import { oldMons, oldText } from "../rules/fight.js";
import { logRound, logMsg, logWhy } from "../log.js";
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
  return [round && S.round ? `<span>${tb("init.fight.round", {}, S.round)}</span>` : "",
    pcs.length ? `<span>${tb("init.fight.party", {}, `${pcs.filter((c) => !c.max || c.hp > 0).length}/${pcs.length}`)}</span>` : "",
    mons.length ? `<span>${tb("init.fight.foes", {}, `${mons.filter((c) => c.hp > 0).length}/${mons.length}`)}</span>` : ""].filter(Boolean).join(sep);
}

const PEN = ico("pen", "big"), PLUS = ico("plus", "big"); // WP17: uit icons/ui.svg

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
    ? `<div class="fhead"><button type="button" class="ft" id="logopen" aria-haspopup="dialog"><span class="l">${esc(t("init.fight.head"))} · <span class="lk">${esc(t("init.fight.log"))} ${chev(false)}</span></span><span class="rn">${esc(t("init.fight.roundN", { n: n0(S.round) }))}</span><span class="fsum">${sumHtml(S, false, " · ")}</span></button>
      <button type="button" class="fb" data-setmode="prep" aria-label="${esc(t("init.fight.prepAria"))}"><span class="fi">${PEN}</span><span class="fl">${esc(t("init.fight.prep"))}</span></button>
      <button type="button" class="fb ic" id="qadd" aria-label="${esc(t("init.fight.qadd"))}" title="${esc(t("init.fight.qadd"))}">${PLUS}</button></div>`
    : S.round
      ? `<p class="runbar" role="status">${esc(t("init.prep.runbar", { n: n0(S.round) }))}</p>`
      : `<p class="phase" aria-label="${esc(t("init.prep.phase"))}"><span class="st on"><span class="dot" aria-hidden="true">1</span>${esc(t("init.prep.phase1"))}</span><span class="ln" aria-hidden="true"></span><span class="st"><span class="dot" aria-hidden="true">2</span>${esc(t("init.prep.phase2"))}</span></p>`;
  if (m !== "prep") ui.prep = null;
}

/* ---------- Voorbereiden: één paneel met de bestaande formulieren (statisch in index.html, alleen hidden wisselt) ---------- */
const PREP = { pc: "init.prep.tPc", mon: "init.prep.tMon", custom: "init.prep.tMon", enc: "init.add.enc", party: "init.prep.tParty", data: "init.dock.settings" }; // sleutels: vertaald bij het tekenen
const MONTABS = ["mon", "custom", "enc"];
/** Instellingen → Opslag: "Laatste export: …" (DA1) */
export const paintExpLast = () => { $("#exp-last").textContent = lastExportText(nudgeState().exp); paintSetStat(); }; // ook de kop van Opslag (AF5)
export function paintPrep() {
  const el = $("#psheet"), p = PREP[ui.prep] ? ui.prep : null;
  el.hidden = !p;
  if (!p) return;
  $("#p-title").textContent = t(PREP[p]);
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
const hpBtn = (c) => `<button type="button" class="khp hpw" data-a="sheet-open" data-kind="dmg" aria-label="${esc(t(c.temp ? "init.card.hpBtnT" : "init.card.hpBtn", { name: c.name, hp: n0(c.hp), max: n0(c.max), temp: n0(c.temp) }))}">${hpIn(c)}</button>`;

/**
 * Conditie-chips. interactive = open kaart: Concentrating met ✕ (beëindigen), de rest tikbaar voor uitleg (RE10).
 * info = alleen uitleg (live-blok op de tablet): ook Concentrating niet weghalen. Dicht: alleen tekst.
 */
function condChips(c, S, interactive, info = interactive) {
  return c.cond.map((x) => {
    const dt = durText(c, x, S.list);
    const dl = dt ? ` · ${esc(dt)}` : "";
    if (x === "Concentrating") {
      const label = `${esc(term("cond", "Concentrating"))}${c.concSpell ? ` · ${esc(c.concSpell)}` : ""}${dl}`;
      return interactive ? `<button class="bd cc cbtn" data-a="dropconc" title="${esc(t("init.card.concEnd"))}">${label} ${ico("x")}<span class="vh">${esc(t("init.card.end"))}</span></button>` : `<span class="bd cc">${label}</span>`;
    }
    const nm = esc(term("cond", x));
    return info ? cinfoBtn(c, x, `${nm}${dl}`) : `<span class="bd cc">${nm}${dl}</span>`;
  }).join("");
}
/** RE10: tikbare chip voor de uitleg (stippel eronder, geen ✕) */
const cinfoBtn = (c, key, html, cls = "bd cc") => `<button type="button" class="${cls} cinf" data-cinfo="${esc(key)}" data-cid="${esc(c.id)}" aria-label="${esc(t("init.card.explain", { name: condName(key) }))}">${html}</button>`;

/** Samenvatting voor een gesloten kaart */
/** AC in de kop (AF13): schildje met het effectieve getal, gestippeld op een verzonken vlak als effecten hem veranderen (WP14) */
function acMeta(c) {
  const ac = effAc(c);
  return ac ? `<span class="acv${ac !== c.ac ? " acx" : ""}" title="Armor Class"><span class="vh">AC </span>${n0(ac)}</span>` : "";
}

/** Effect-chips: in de open kaart knoppen om weg te halen, dicht alleen tekst (korte duur) */
function effChips(c, S, interactive, info = interactive) {
  const E = c.eff || [];
  return [...E.filter(isWarn), ...E.filter((e) => !isWarn(e))].map((e) => {
    // RE11: Exhaustion is een conditie met niveau: uitleg in plaats van ✕ (niveau wijzigen via Conditie)
    if (isExh(e)) return info ? cinfoBtn(c, "Exhaustion", esc(effName(e)), "bd w") : `<span class="bd w">${esc(effName(e))}</span>`;
    if (isRage(e)) return rageChip(c, e, S, interactive);
    const w = isWarn(e), cls = w ? "bd w" : "bd ef";
    const by = e.by && e.by !== c.id ? S.list.find((x) => x.id === e.by) : null;
    const dur = e.d ? durLabel(e.d, S.list, !interactive) : e.lr ? "long rest" : "";
    const tx = [`${e.n}${e.st ? " " + effText(e) : ""}`, w ? effNote(e) : "", dur, by ? by.name : ""].filter(Boolean).map(esc).join(" · ");
    return interactive ? `<button class="${cls} cbtn" data-a="effdel" data-e="${esc(e.id)}" title="${esc(t("init.card.effDel"))}">${tx} ${ico("x")}<span class="vh">${esc(t("init.card.remove"))}</span></button>`
      : `<span class="${cls}">${tx}</span>`;
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
  const tx = [`Rage ${rageBonus(c)}`, e.d ? durLabel(e.d, S.list, !interactive) : "", e.bear ? "Bear" : "", e.frz ? "Frenzy" : ""].filter(Boolean).map(esc).join(" · ");
  return interactive ? `<button class="bd ef cbtn" data-a="effdel" data-e="${esc(e.id)}" title="${esc(t("init.card.rageEnd"))}">${tx} ${ico("x")}<span class="vh">${esc(t("init.card.end"))}</span></button>` : `<span class="bd ef">${tx}</span>`;
}

/** Conditie- en effect-chips voor de speler-sheet in het zijpaneel (condities tikbaar voor uitleg, RE10) */
const sbChips = (c) => condChips(c, app.S, false, true) + effChips(c, app.S, false, true) + reactChip(c, app.S);
/** GV12: reaction gebruikt tot hij terug is (begin eigen beurt); dichte kaart en live-blok */
const reactChip = (c, S) => (reactUsed(c, S, pcReact()) ? `<span class="bd">${esc(reactTag())}</span>` : "");

const hidBadge = (c) => (c.hidden ? `<span class="bd hid" title="${esc(t("init.card.hiddenTip"))}">${esc(t("init.card.hidden"))}</span>` : "")
  + (c.kind === "monster" && c.anon ? `<span class="bd hid" title="${esc(t("init.card.anonTip", { name: anonName(c, app.S.list) }))}">${esc(t("init.card.anon"))}</span>` : "");
const surBadge = (c, S, info = false) => (!isSurprised(c, S) ? "" : info ? cinfoBtn(c, SUR, esc(t("init.card.sur")), "bd cc sur")
  : `<span class="bd cc sur" title="${esc(t("init.card.surTip"))}">${esc(t("init.card.sur"))}</span>`);

function badges(c, S) {
  const out = [surBadge(c, S), hidBadge(c), condChips(c, S, false), effChips(c, S, false)];
  if (c.kind === "pc" && c.max && c.hp <= 0) {
    const d = c.ds || R.newDs();
    out.push(d.dead ? `<span class="bd r">${esc(t("init.card.dead"))}</span>` : d.stable ? `<span class="bd g">${esc(t("init.card.stable"))}</span>` : `<span class="bd r">${dsMini(d.s, d.f)}</span>`);
  }
  if (c.casting && (c.casting.slots.length || c.casting.pact)) out.push(`<span class="bd b">Slots ${slotSum(c.casting, "·")}</span>`);
  else if (c.casting && c.casting.daily.length) out.push(`<span class="bd b">Spells</span>`);
  (c.res || []).forEach((r) => out.push(`<span class="bd b">${esc(r.n)} ${n0(r.left)}/${n0(r.max)}</span>`));
  (c.rc || []).forEach((r) => out.push(`<span class="bd ${r.ready ? "g" : ""}">${esc(r.n)} ${esc(t(r.ready ? "init.card.rcReady" : "init.card.rcUsed"))}</span>`));
  if (c.la) out.push(`<span class="bd b">LA ${n0(c.la.left)}</span>`);
  if (c.lr) out.push(`<span class="bd b">${esc(t("init.card.lrDay", { n: n0(c.lr.left) }))}</span>`);
  out.push(reactChip(c, S));
  const html = out.join("");
  return html ? `<div class="badges">${html}</div>` : "";
}

/** AF12: "1st-level slot 1 van 4, beschikbaar"; geen aria-pressed (CSS stijlt op data-used) */
const pipState = (label, i, o) => `data-used="${i >= o.left}" aria-label="${esc(t(i >= o.left ? "init.card.pipUsed" : "init.card.pipFree", { label, i: i + 1, n: n0(o.max) }))}"`;

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
  const parts = [["init.card.defVuln", "Damage Vulnerabilities"], ["init.card.defRes", "Damage Resistances"], ["init.card.defImm", "Damage Immunities"]]
    .map(([n, l]) => (get(l) ? `${esc(t(n))}: <b>${esc(get(l))}</b>` : "")).filter(Boolean);
  return parts.length ? `<div class="defl">${parts.join(" · ")}</div>` : "";
}

function dsBlock(c) {
  if (c.kind !== "pc" || !c.max || c.hp > 0) return "";
  const d = c.ds || R.newDs();
  // AF12: toestand in het label (geen aria-pressed: "aangevinkt, ingedrukt" spreekt elkaar tegen); CSS stijlt op data-on
  const p = (k, n, l) => Array.from({ length: 3 }, (_, i) => `<button class="dsp ${k}" data-ds="${k}" data-i="${i}" data-on="${i < n}" aria-label="${esc(t(i < n ? "init.card.dsOn" : "init.card.dsOff", { label: l, i: i + 1 }))}"></button>`).join("");
  const pad = ui.dsPad && ui.dsPad.id === c.id;
  const st = d.dead ? `<span class="st dead">${esc(t("init.card.dead"))}</span>` : d.stable ? `<span class="st ok">${esc(t("init.card.stable"))}</span>`
    : `<button class="btn small primary" data-a="ds-roll">${esc(t("init.card.dsRoll"))}</button><button class="btn small" data-a="ds-own" aria-expanded="${pad}">${esc(t("init.card.dsOwn"))}</button><button class="link" data-a="ds-crit">${esc(t("init.card.dsCrit"))}</button>`;
  return `<div class="ds"><span class="lbl">Death saves</span>
    <span class="dsg">${esc(t("init.card.dsS"))} ${p("s", d.s, t("init.card.dsS"))}</span><span class="dsg">${esc(t("init.card.dsF"))} ${p("f", d.f, t("init.card.dsF"))}</span>${st}</div>${pad && !d.dead && !d.stable ? dsPadHtml(c) : ""}`;
}

/** RE15: cijferpad voor de worp van de speler. Alleen cijfers die nog tot 1–20 kunnen leiden; 3–9 gaat meteen door. */
function dsPadHtml(c) {
  const v = ui.dsPad.v, ok = (n) => (v === "" ? n > 0 : v === "1" || (v === "2" && n === 0));
  const dg = (n) => `<button type="button" data-a="ds-k" data-v="${n}" ${ok(n) ? "" : "disabled"}>${n}</button>`;
  return `<div class="dspad" role="group" aria-label="${esc(t("init.card.dsPadAria", { name: c.name }))}">
    <p class="dsv"><span>${esc(t("init.card.dsPadRoll", { name: c.name }))}</span><b>${v || "—"}</b></p>
    <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(dg).join("")}<button type="button" data-a="ds-k" data-v="back" aria-label="${esc(t("init.card.padBack"))}" ${v ? "" : "disabled"}>⌫</button>${dg(0)}<button type="button" class="ok" data-a="ds-k" data-v="ok" ${v === "1" || v === "2" ? "" : "disabled"}>OK</button></div>
    <p class="hint">${esc(t("init.card.dsPadHint"))}</p>
    <button type="button" class="link" data-a="ds-own">${esc(t("common.cancel"))}</button></div>`;
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
    ? `<div class="pick"><span class="hint">${esc(t("init.card.pick"))}</span>${pickList(c, x.lvl, rulesEd()).map((sp) =>
      `<button class="btn small ${sp.conc ? "conc" : ""}" data-pickspell="${esc(sp.n)}" data-conc="${sp.conc ? 1 : ""}">${esc(sp.n)}${sp.lv < x.lvl ? ` ${t("init.card.upcast", { lv: ORD[sp.lv] || sp.lv })}` : ""}${sp.conc ? ` · ${t("init.card.concShort")}` : ""}</button>`).join("")}<button class="link" data-pickspell="">${esc(t("init.card.pickSkip"))}</button></div>` : "";
  return `<details class="cast" data-cast ${ui.openCast.has(c.id) || ui.castPick?.id === c.id ? "open" : ""}><summary class="link strong">Spells <span style="font-weight:400">(${sum})</span></summary>
    <div class="castbox">${rageOf(c) ? `<p class="hint">${esc(t("init.card.rageNoSpells"))}</p>` : ""}
      ${k.pact ? `<div class="slotrow"><span class="lv">Pact ${ORD[k.pact.lvl] || ""}</span><span class="pp">${pp(k.pact, `data-slot="p"`, t("init.card.pactSlot", { lv: ORD[k.pact.lvl] || "" }))}</span><span class="sp">${spLinks(k.pact.spells || "", c)}</span></div>${pick(k.pact, true)}` : ""}
      ${k.slots.map((x, i) => `<div class="slotrow"><span class="lv">${ORD[x.lvl] || ""}</span><span class="pp">${pp(x, `data-slot="${i}"`, t("init.card.slotLv", { lv: ORD[x.lvl] || "" }))}</span><span class="sp">${spLinks(x.spells, c)}</span></div>${pick(x)}`).join("")}
      ${k.daily.map((g, gi) => g.items.map((it, ii) => `<div class="slotrow"><span class="lv">${esc(g.label.split(" ")[0])}</span><span class="pp">${pp(it, `data-daily="${gi}.${ii}"`, it.n)}</span><span class="sp">${spLinks(it.n, c)}</span></div>`).join("")).join("")}
      <div><button class="link" data-a="cast-reset">${esc(t("init.card.castReset"))}</button></div>
    </div></details>`;
}

function resBlock(c) {
  if (!c.res || !c.res.length) return "";
  return `<div class="castbox">${c.res.map((o, i) => `<div class="resrow"><span class="rn">${esc(o.n)}</span>
    <span class="pp">${o.max <= 10 ? Array.from({ length: n0(o.max) }, (_, j) => `<button class="pip" data-res="${i}" data-i="${j}" ${pipState(o.n, j, o)}></button>`).join("")
      : `<button class="btn small" data-res="${i}" data-step="-1">−</button><b style="font-variant-numeric:tabular-nums;padding:0 6px">${n0(o.left)}/${n0(o.max)}</b><button class="btn small" data-res="${i}" data-step="1">+</button>`}</span>
    <span class="sp">${o.max <= 10 ? `${n0(o.left)}/${n0(o.max)} · ` : ""}${esc(t(o.rest === "Short Rest" ? "init.card.perSr" : "init.card.perLr"))}</span></div>`).join("")}</div>`;
}

function condPanel(c) {
  const opt = ui.condOpt[c.id] || {};
  return `<div class="kpanel">
    <div class="durrow">
      <label>${esc(t("init.cond.dur"))}<select data-f="cdur">${DURS.map(([v, l]) => `<option value="${v}" ${(opt.dur || "inf") === v ? "selected" : ""}>${esc(t(l))}</option>`).join("")}</select></label>
      <label>${esc(t("init.cond.save"))}<span style="display:flex;gap:4px"><select data-f="cab"><option value="">${esc(t("init.card.none"))}</option>${["STR", "DEX", "CON", "INT", "WIS", "CHA"].map((a) => `<option ${opt.ab === a ? "selected" : ""}>${a}</option>`).join("")}</select><input data-f="cdc" type="number" inputmode="numeric" placeholder="DC" value="${esc(opt.dc || "")}" style="width:64px"></span></label>
    </div>
    <div class="condgrid">${CONDS.map((x) => `<button type="button" data-cond="${x}" aria-pressed="${c.cond.includes(x)}">${esc(term("cond", x))}</button>`).join("")}<button type="button" data-a="exh-open" aria-pressed="${exhLevel(c) > 0}" aria-expanded="${!!ui.exhOpen}">${esc(term("cond", "Exhaustion"))}${exhLevel(c) ? ` ${exhLevel(c)}` : ""}</button></div>
    ${ui.exhOpen ? exhRow(c) : ""}</div>`;
}

/** RE11: niveau 0–6 met − en +; wat er bij dit niveau geldt (opgeteld). Dood: − uit (Ongedaan is de weg terug) */
function exhRow(c) {
  const x = exhLevel(c), dead = c.kind === "pc" ? !!(c.ds && c.ds.dead) : c.max > 0 && c.hp <= 0;
  return `<div class="exhrow"><button type="button" class="btn" data-a="exh" data-v="-1" ${x && !dead ? "" : "disabled"} aria-label="${esc(t("init.cond.exhDown"))}">−</button>
    <b aria-live="polite">${esc(term("cond", "Exhaustion"))} ${x}</b><button type="button" class="btn" data-a="exh" data-v="1" ${x >= 6 ? "disabled" : ""} aria-label="${esc(t("init.cond.exhUp"))}">+</button></div>
    <p class="hint exhtxt">${esc(tr(exhSummary(x)))}. ${esc(t(dead && x ? "init.cond.exhBack" : "init.cond.exhLr"))}</p>`;
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
  if ((c.eff || []).some((e) => e.st === "ac")) parts.push(t("init.card.edBaseAc", { ac: effAc({ ...c, ac: Number.isFinite(ac) ? ac : c.ac }) }));
  const ini = parseInit(ed.init);
  if (ini !== null && ini !== c.init && (!ed.keys || ed.keys.includes("init"))) { // RE9: wat de nieuwe initiative deze ronde betekent
    const it = tr(initText(initPlan(app.S, c, ini), ini, (app.S.list.find((x) => x.id === app.S.active) || {}).name));
    if (it) parts.push(`<b class="warn">${esc(it[0].toUpperCase() + it.slice(1))}</b>`);
  }
  if (c.pid) parts.push(t("init.card.edParty"));
  if (!String(ed.name).trim()) parts.push(`<b class="bad">${esc(t("init.card.edNoName"))}</b>`);
  else if (app.S.list.some((x) => x !== c && x.name.toLowerCase() === String(ed.name).trim().toLowerCase())) parts.push(t("init.card.edDup"));
  return parts.map((x) => (x.startsWith("<b") ? x : esc(x))).join(" · ");
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
    max: `<label>Max HP${hpd ? ` <small>${esc(t("init.card.effDelta", { d: (hpd > 0 ? "+" : "−") + Math.abs(hpd) }))}</small>` : ""}<input data-f="ed-max" type="number" inputmode="numeric" min="1" value="${esc(ed.max)}"></label>`,
    init: `<label>Initiative<input data-f="ed-init" type="number" inputmode="numeric" value="${esc(ed.init)}"></label>`,
  };
  return `<div class="kpanel more">
    <div class="edit">
      <label>${esc(t("init.pc.name"))}<input data-f="ed-name" value="${esc(ed.name)}" autocomplete="off" maxlength="120"></label>
      ${row.length ? `<div class="ed3">${row.map((k) => fld[k]).join("")}</div>` : ""}${keys.includes("pas") ? pasFields(c, ed) : ""}
      <p class="hint edprev" aria-live="polite">${editPreview(c)}</p>
      <div class="bar"><button class="btn tap" data-a="ed-cancel">${esc(t("common.cancel"))}</button><button class="btn primary tap" data-a="ed-save">${esc(t("common.save"))}</button></div>
    </div>${c.kind === "pc" ? drBox(c) : ""}
    <div class="bar">${c.kind === "pc" && !c.pid ? `<button class="btn small" data-a="topty">${esc(t("init.card.toParty"))}</button>` : ""}
    ${canToggleSurprise(c, app.S) ? `<button class="btn small" data-a="sur" aria-pressed="${c.sur === true}">${esc(t("init.card.sur"))}${c.sur === true ? " " + ico("check") : ""}</button>` : ""}
    ${c.kind === "monster" ? `${prep ? "" : `<button class="btn small" data-a="hide" aria-pressed="${!!c.hidden}">${esc(t(c.hidden ? "init.card.show" : "init.card.hide"))}</button>`}
      <button class="btn small" data-a="anon" aria-pressed="${!!c.anon}">${esc(t(c.anon ? "init.card.nameShow" : "init.card.nameHide"))}</button>` : ""}
    <button class="btn small danger" data-a="del">${esc(t(app.S.round ? "init.card.delFight" : "init.card.del"))}</button></div></div>`;
}

/** SP5: eigen passives in ⋯ (opslaan met Opslaan); placeholder = waarde uit de sheet */
function pasFields(c, ed) {
  const sh = sheetPassives(c.sheet), any = PAS.some(([k]) => sh[k] != null);
  return `<p class="vlbl edpasl">Passive</p><div class="ed3 edpas">${PAS.map(([k, l, sh3]) => `<label>${sh3}<input data-f="ed-${k}" type="number" inputmode="numeric" min="1" max="40" value="${esc(ed[k] ?? "")}" placeholder="${sh[k] ?? ""}" aria-label="${esc(`Passive ${l} ${c.name}`)}"></label>`).join("")}</div>${any ? `<p class="hint">${esc(t("init.card.pasHint"))}</p>` : ""}`;
}

/**
 * SP2: resistances van een speler in ⋯ (beide modi). Samenvatting met "Wijzig ▸"; open: soort (Resist | Immuun | Kwetsb.)
 * en 13 type-knoppen. Tik = direct vastgelegd (undo-stap), zoals de velden op de kaart; een type staat in één soort.
 */
function drBox(c) {
  const open = ui.drOpen === c.id, k = ui.drKind;
  const sum = drText(c.dr);
  const body = !open ? "" : `<div class="seg2 sm" role="group" aria-label="${esc(t("init.card.drKind"))}">${Object.entries(DR_LBL).map(([v, l]) => `<button type="button" data-a="dr-kind" data-v="${v}" aria-pressed="${k === v}">${esc(t(l))}</button>`).join("")}</div>
    <div class="drgrid">${DTYPES.map((ty) => { const at = drKind(c.dr, ty); return `<button type="button" class="drt${at && at !== k ? " other" : ""}" data-a="dr-t" data-t="${ty}" aria-pressed="${at === k}"${at && at !== k ? ` aria-label="${esc(t("init.card.drNow", { type: ty, kind: t(DR_LBL[at]) }))}"` : ""}>${ty}${at && at !== k ? `<small aria-hidden="true">${{ r: "R", i: "I", v: "V" }[at]}</small>` : ""}</button>`; }).join("")}</div>
    <p class="hint">${esc([t("init.card.drHint", { kind: t(DR_LBL[k]) }), c.sheet && c.sheet.dr ? t("init.card.drDdb") : "", c.pid ? t("init.card.drParty") : ""].filter(Boolean).join(" "))}</p>`;
  return `<div class="drbox"><div class="drhead"><span><span class="qlbl">Resistances</span> ${sum ? esc(sum) : esc(t("init.card.none"))}</span>
    <button type="button" class="link tap" data-a="dr-open" aria-expanded="${open}">${esc(t(open ? "init.card.drDone" : "init.card.drEdit"))} ${chev(open)}</button></div>${body}</div>`;
}

/** AF15: het teken zit in de keuze, de waarde is altijd positief (iOS-cijferpad heeft geen minteken) */
export const EFF_OPS = [["ac+", "init.eff.acPlus"], ["ac-", "init.eff.acMinus"], ["ac=", "init.eff.acSet"], ["acmin", "init.eff.acMin"], ["max", "init.eff.maxPlus"], ["max-", "init.eff.maxMinus"], ["txt", "init.eff.txt"]]; // sleutels: vertaald bij het tekenen

/** Effectpaneel: presets (1 tik), "Wie cast?" voor concentratie zonder beurt, of een eigen effect */
function effPanel(c) {
  const S = app.S;
  if (ui.effWho && ui.effWho.id === c.id) {
    const p = PRESETS_14[ui.effWho.i];
    return `<div class="kpanel"><p class="hint">${tb("init.eff.who", {}, p.n)}</p>
      <div class="effgrid">${spellTargets(S.list).map((x) => `<button class="btn tap" data-a="effby" data-by="${esc(x.id)}">${esc(x.name)}</button>`).join("")}</div>
      <button class="link" data-a="effwho-no">${esc(t("common.cancel"))}</button></div>`;
  }
  if (ui.rage && ui.rage.id === c.id) return rageBox(c);
  const act = S.list.find((x) => x.id === S.active);
  const f = ui.effForm;
  const custom = ui.effCustom ? `<div class="effform">
      <label>${esc(t("init.pc.name"))}<input data-f="ef-n" value="${esc(f.n || "")}" placeholder="${esc(t("init.eff.namePh"))}" maxlength="60"></label>
      <div class="ed3">
        <label>${esc(t("init.eff.on"))}<select data-f="ef-k">${EFF_OPS.map(([v, l]) => `<option value="${v}" ${(f.k || "ac+") === v ? "selected" : ""}>${esc(t(l))}</option>`).join("")}</select></label>
        <label>${esc(t("init.eff.value"))}<input data-f="ef-v" type="number" inputmode="numeric" min="0" autocomplete="off" value="${esc(f.v ?? "")}"></label>
        <label>${esc(t("init.eff.dur"))}<select data-f="ef-dur">${[...DURS, ["lr", "init.eff.durLr"]].map(([v, l]) => `<option value="${v}" ${(f.dur || "inf") === v ? "selected" : ""}>${esc(t(l))}</option>`).join("")}</select></label>
      </div>
      <label>${esc(t("init.eff.note"))}<input data-f="ef-txt" value="${esc(f.txt || "")}" placeholder="${esc(t("init.eff.notePh"))}" maxlength="120"></label>
      <label>${esc(t("init.eff.concBy"))}<select data-f="ef-by"><option value="">${esc(t("init.card.none"))}</option>${S.list.filter((x) => x.id === f.by || spellTargets([x]).length).map((x) => `<option value="${esc(x.id)}" ${f.by === x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>
      <button class="btn primary tap" data-a="eff-add">${esc(t("init.eff.add"))}</button></div>` : "";
  return `<div class="kpanel">
    <div class="effgrid">${presetOrder(c).map((i) => {
      const p0 = PRESETS_14[i], p = presetsFor(presetEd(act, p0.n))[i], tag = edTag(act, p0.n, p); // caster = wie aan de beurt is
      const off = p.st === "ac" && p.op === "+" && !c.ac;
      return `<button class="btn tap" data-a="effp" data-i="${i}" ${off ? `disabled title="${esc(t("init.eff.acFirst"))}"` : ""}><span>${esc(p.n)}${tag ? ` <span class="tag">${esc(tag)}</span>` : ""}</span><small>${esc(p.dex ? "AC 13 + Dex" : p.st ? effText(p) : p.sh || effText(p))}${p.conc ? " · conc" : ""}</small></button>`;
    }).join("")}<button class="btn tap" data-a="effcustom" aria-pressed="${ui.effCustom}">${esc(t("init.eff.custom"))}</button></div>
    ${!c.ac ? `<p class="hint">${esc(t("init.eff.noAc"))}</p>` : ""}
    <p class="hint">${act ? tb("init.eff.hintTurn", {}, act.name) : esc(t("init.eff.hintPick"))}</p>
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
  const res = r ? t("init.rage.left", { name: r.n, n: n0(r.left), max: n0(r.max) }) : t("init.rage.noRes");
  const conc = c.cond.includes("Concentrating") ? `<p class="hint rgwarn">${ico("alert")} ${esc(c.concSpell ? t("init.rage.concOn", { spell: c.concSpell }) : t("init.rage.conc"))}</p>` : "";
  const tg = (k, l) => `<button type="button" class="btn tap" data-a="rage-opt" data-k="${k}" aria-pressed="${!!o[k]}">${l}</button>`;
  return `<div class="kpanel rgbox">
    <p class="rghead"><b>Rage · ${esc(c.name)}</b>${lvl ? ` <span class="hint">(${c.sheet && c.sheet.cls ? "barbarian" : "level"} ${n0(lvl)})</span>` : ""}</p>
    <p class="hint">${esc(t("init.rage.sum", { b: b ? `+${b}` : "+2/+3/+4", res: o.bear ? t("init.rage.allBut") : "B/P/S" }))}</p>
    <p class="hint">${esc(res)}</p>${conc}
    <div class="effgrid rgopt">${tg("bear", "Bear Totem")}${tg("frz", "Frenzy")}</div>
    ${o.frz ? `<p class="hint">${esc(t("init.rage.frenzy"))}</p>` : ""}
    ${on ? `<p class="hint rgwarn">${esc(t("init.rage.on"))}</p>` : ""}
    <div class="bar"><button type="button" class="btn tap" data-a="rage-no">${esc(t("common.cancel"))}</button><button type="button" class="btn primary tap" data-a="rage-go" ${on ? "disabled" : ""}>${esc(t(r && r.left <= 0 ? "init.rage.start0" : "init.rage.start"))}</button></div></div>`;
}

function actionsBlock(c) {
  const more = `<button data-a="panel" data-p="more" aria-pressed="${ui.panel === "more"}" aria-label="${esc(t("init.card.more"))}">${ico("more")}</button>`;
  const sideBtn = c.ref ? sbBtn() : c.sheet ? `<button data-a="sheet">Sheet</button>` : more;
  const gone = (c.ds && c.ds.dead) || (c.kind === "monster" && isOut(c));
  const react = c.kind !== "pc" || pcReact(); // GV4: spelers houden hun reaction zelf bij (instelling); Heal neemt de plek over
  return `<div class="acts">
    ${c.max ? `<button class="dmg2 wide" data-a="sheet-open" data-kind="dmg">${esc(t("init.card.dmg"))}</button><button class="heal2${react ? "" : " wide"}" data-a="sheet-open" data-kind="heal">${esc(t("init.card.heal"))}</button>` : ""}
    ${!react ? "" : isSurprised(c, app.S) ? `<button disabled title="${esc(t("init.card.surReact"))}">${esc(t("init.card.sur"))}</button>` : `<button data-a="react" aria-pressed="${!!c.reaction}"${c.reaction ? ` title="${esc(t("init.card.reactTip"))}"` : ""}>${esc(c.reaction ? reactTag() : "Reaction")}</button>`}
    <button data-a="panel" data-p="conds" aria-pressed="${ui.panel === "conds"}">${esc(t("init.prep.cond"))}</button>
    <button data-a="panel" data-p="eff" aria-pressed="${ui.panel === "eff"}" ${gone ? "disabled" : ""}>${esc(t("init.prep.eff"))}</button>
    ${sideBtn}
    ${c.ref || c.sheet ? more : ""}
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
  const hpd = (c.max || 0) - baseMax(c), eff = hpd ? ` <small>${esc(t("init.prep.effDelta", { d: (hpd > 0 ? "+" : "−") + Math.abs(hpd) }))}</small>` : "";
  if (c.kind === "monster") {
    const hd = c.ref && findMon(c.ref)?.hd;
    const now = c.max && c.hp < c.max ? `<p class="hint pnow">${esc(t("init.prep.hpNow", { hp: n0(c.hp), max: n0(c.max) }))}</p>` : "";
    return `<div class="pfs two">${fld("init", "Init", c.init, { aria: "Initiative" })}${fld("max", `Max HP${hd ? ` <small class="nocase">${esc(hd)}</small>` : ""}${eff}`, c.max ? baseMax(c) : "", { ph: "?", aria: "Max HP" })}</div>${now}`;
  }
  const m = c.pid && app.party.find((x) => x.pid === c.pid);
  const lv = sheetLvl(c, m) ? "" : fld("lvl", "Level", (m ? m.lvl : c.lvl) ?? "", { ph: "?" });
  const hp = c.max ? fld("hp", `HP${eff}`, n0(c.hp), { of: n0(c.max), aria: t("init.prep.hpAria") }) : fld("max", "Max HP", "", { ph: "?" });
  const pt = pasText(passives(c)); // SP5: alleen lezen; invullen onder ⋯
  return `<div class="pfs${lv ? "" : " two"}">${hp}${(() => { const l = (c.eff || []).some((e) => e.st === "ac") ? t("init.prep.baseAc") : "AC"; return fld("ac", esc(l), c.ac || "", { ph: "?", aria: l }); })()}${lv}</div>${pt ? `<p class="hint ppas">Passive ${esc(pt)}</p>` : ""}`;
}

/** TA18 (UX-agent): korte tekst in de actierij (EN "Stats" past op 320 px), volle term als tooltip */
const sbBtn = () => `<button data-a="sb" title="${esc(t("init.prep.sb"))}">${esc(t("init.prep.sbShort"))}</button>`; // geen aria-label: de naam moet de zichtbare tekst bevatten (WCAG 2.5.3)
function prepActions(c) {
  const b = c.kind === "monster"
    ? [`<button data-a="hide" aria-pressed="${!!c.hidden}" title="${esc(t("init.prep.hideTip"))}">${esc(t(c.hidden ? "init.prep.hidden" : "init.prep.hide"))}</button>`]
    : [];
  b.push(`<button data-a="panel" data-p="conds" aria-pressed="${ui.panel === "conds"}">${esc(t("init.prep.cond"))}</button>`,
    `<button data-a="panel" data-p="eff" aria-pressed="${ui.panel === "eff"}">${esc(t("init.prep.eff"))}</button>`);
  if (c.ref) b.push(sbBtn()); else if (c.sheet) b.push(`<button data-a="sheet">Sheet</button>`);
  b.push(`<button data-a="panel" data-p="more" aria-pressed="${ui.panel === "more"}" aria-label="${esc(t(c.kind === "pc" ? "init.prep.morePc" : "init.prep.moreMon"))}">${ico("more")}</button>`);
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
  const hit = a.hit !== null && cid ? `<button class="d hit" data-atk="${esc(a.an || a.n)}" data-cid="${esc(cid)}" data-label="${esc(lab)}"${la != null ? ` data-la-i="${la}"` : ""} aria-label="${esc(t("init.atk.hitPick", { label: lab, hit: sgn(a.hit) }))}">${sgn(a.hit)}</button>`
    : a.hit !== null ? `<button class="d hit" data-roll="1d20${sgn(a.hit)}" data-hit="1" data-label="${esc(lab)}" aria-label="${esc(t("init.atk.hit", { label: lab, hit: sgn(a.hit) }))}">${sgn(a.hit)}</button>`
    : isSaveAoe(a) && cid ? `<button class="d dcb" data-aoe="${esc(a.n)}" data-cid="${esc(cid)}" aria-label="${esc(t("init.atk.aoeOpen", { label: lab, dc: a.dc.n, ab: a.dc.ab }))}">DC ${a.dc.n} ${a.dc.ab}<small>AoE ${chev(false)}</small></button>`
    : a.dc ? `<span class="dc">DC ${a.dc.n} ${a.dc.ab}</span>` : "<span></span>";
  const dmg = key ? `<button class="d dm" data-dmg="${esc(key)}" data-label="${esc(lab)}" aria-label="${esc(t("init.atk.dmgRoll", { label: lab }))}">${esc(a.dmg.map((x) => x.e || x.flat).join(" + "))}<small>${esc(a.dmg.map((x) => SHORT[x.type] || x.type).join(" + "))}</small></button>`
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
  if (!turn && !all) return `<button class="atkfold" data-a="atk-open" aria-expanded="false">${esc(n ? t("init.atk.foldN", { n }) : t("init.atk.fold"))} ${chev(false)}</button>`;
  const room = turn && !all ? Math.max(1, MAIN_MAX - (A.multi ? 1 : 0)) : A.main.length;
  const hidden = A.main.length - room;
  const rx = !turn || ui.atkRx === c.id;
  const multi = A.multi ? `<p class="multi"><b>Multiattack:</b> ${esc(A.multi.text)}</p>` : "";
  const other = !A.other.length ? "" : rx
    ? `${turn ? `<button class="atkfold sub" data-a="atk-rx" aria-expanded="true">Reactions · Legendary ${chev(true)}</button>` : ""}${A.other.map(row).join("")}`
    : `<button class="atkfold sub" data-a="atk-rx" aria-expanded="false">Reactions · Legendary (${A.other.length}) ${chev(false)}</button>`;
  return `<div class="atk">
    ${!turn ? `<button class="atkfold" data-a="atk-close" aria-expanded="true">${esc(t("init.atk.fold"))} ${chev(true)}</button>` : ""}
    ${multi}${main.slice(0, room).map(row).join("")}
    ${hidden > 0 ? `<div class="atkmore"><button class="link" data-a="atk-open">${esc(t("init.atk.more", { n: hidden }))}</button></div>` : ""}
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
  return `<li class="c k lair ${c.id === S.active ? "turn" : ""}" data-id="${esc(c.id)}"${c.id === S.active ? ' aria-current="true"' : ""}>
    <div class="i">${n0(c.init)}${c.id === S.active ? `<span class="tri">${ico("turn")}</span>` : ""}</div>
    <div class="n"><select class="lairsel" data-f="lairkey" aria-label="${esc(t("init.lair.which"))}">${keys.map((k) => `<option ${k === c.key ? "selected" : ""}>${esc(k)}</option>`).join("")}</select></div>
    <div class="meta">lair</div>
    ${c.hidden ? `<div class="badges">${hidBadge(c)}</div>` : ""}
    <div class="kbody">
    <div class="lacts">${acts.length ? acts.map((a, i) => `<div class="lact ${c.last === a.n ? "used" : ""}">
        <p><b>${esc(a.n)}.</b> ${diceify(a.t)}</p>
        <div class="bar">${c.last === a.n ? `<span class="hint">${esc(t("init.lair.used"))}</span>` : `<button class="btn small" data-a="lair-use" data-i="${i}">${esc(t("init.lair.use"))}</button>`}
        <button class="link" data-a="lair-del" data-i="${i}">${esc(t("init.lair.del"))}</button></div></div>`).join("")
      : `<p class="hint">${esc(t("init.lair.none"))}</p>`}</div>
    <details class="conds" ${acts.length ? "" : "open"}><summary class="link">${esc(t("init.lair.add"))}</summary>
      <div class="form" style="margin-top:8px">
        <label>${esc(t("init.pc.name"))}<input data-f="la-n" placeholder="${esc(t("init.lair.namePh"))}"></label>
        <label>${esc(t("init.lair.effect"))}<textarea data-f="la-t" style="min-height:80px" placeholder="Magma erupts from a point... DC 15 Dexterity saving throw or take 21 (6d6) fire damage."></textarea></label>
        <button class="btn small primary" data-a="lair-add">${esc(t("common.save"))}</button></div></details>
    <div class="bar"><button class="btn small" data-a="hide" aria-pressed="${!!c.hidden}">${esc(t(c.hidden ? "init.card.show" : "init.card.hide"))}</button></div>
    <div class="row3"><span class="hint">${esc(t("init.lair.init"))}</span><button class="link" data-a="del">${esc(t("init.lair.remove"))}</button></div></div></li>`;
}

function row(c, S, down = false) {
  if (c.kind === "lair") return lairRow(c, S);
  const open = openId() === c.id, prep = mode() === "prep";
  const turn = c.id === S.active, hp = c.max && !down, fhp = hp && !prep;
  return `<li class="c k ${c.kind === "pc" ? "pc" : "mon"} ${open ? "open" : ""} ${turn ? "turn" : ""} ${isOut(c) ? "out" : ""}${down ? " down" : ""}${fhp ? " fhp" : ""}" data-id="${esc(c.id)}"${down ? ` data-down="1"` : ""}>
    <button class="khead" data-a="open" aria-expanded="${open}"${turn ? ` aria-current="true"` : ""} aria-label="${esc([c.name, t(c.kind === "pc" ? "init.card.kindPc" : "init.card.kindMon"), effAc(c) && !(isOut(c) && c.kind === "monster") ? `AC ${n0(effAc(c))}` : "", t(open ? "init.card.close" : "init.card.open")].filter(Boolean).join(", "))}">
      <span class="i">${c.init == null ? "–" : n0(c.init)}${turn ? `<span class="tri">${ico("turn")}</span>` : ""}</span>
      <span class="n">${avatar(c, c.ref ? findMon(c.ref)?.meta : "")}<span class="nm">${esc(c.name)}</span></span>
      <span class="meta">${isOut(c) && c.kind === "monster" ? esc(t("init.card.down")) : acMeta(c)}</span>
      ${hp && prep ? hpBar(c) : ""}
    </button>${fhp ? hpBtn(c) : ""}
    ${open ? `<div class="kbody">
      ${c.hidden || c.anon || c.cond.length || (c.eff || []).length || isSurprised(c, S) ? `<div class="badges">${surBadge(c, S, true)}${hidBadge(c)}${condChips(c, S, true)}${effChips(c, S, true)}</div>` : ""}
      ${acBreakdown(c) ? `<p class="hint acb">AC ${n0(effAc(c))} = ${esc(acBreakdown(c))}</p>` : ""}
      ${defLine(c)}
      ${dsBlock(c)}
      ${prep ? `${prepFields(c)}${prepActions(c)}` : `${atkBlock(c, S)}
      ${c.rc && c.rc.length ? `<div class="rcs">${c.rc.map((r, i) => `<button class="rc" data-rc="${i}" aria-pressed="${!!r.ready}" title="${esc(t("init.card.rcTip"))}">${esc(r.n)} · ${esc(r.ready ? t("init.card.rcReady") : r.rest ? t("init.card.rcRest") : `recharge ${n0(r.min)}–6`)}</button>`).join("")}</div>` : ""}
      ${pips(c.la, "la", "Legendary actions")}${pips(c.lr, "lr", t("init.card.lrPer"))}
      ${actionsBlock(c)}`}
      ${castBlock(c)}
      ${resBlock(c)}
    </div>` : badges(c, S)}
  </li>`;
}

/** DA1: alleen in Voorbereiden zonder gevecht; nooit aan tafel tijdens een gevecht. Geen melding of stip (stip op ⚙ = kamer) */
const expBanner = (calm) => calm && exportDue(nudgeState())
  ? `<li class="sbanner expb"><span>${esc(t("init.exp.banner"))}</span><span class="sbtns"><button type="button" class="btn small primary" id="exp-now">${esc(t("init.exp.now"))}</button><button type="button" class="btn small" id="exp-later">${esc(t("init.exp.later"))}</button></span></li>` : "";

function paintEncounter() {
  const S = app.S;
  const L = sortOrder(S.list);
  $("#sum").innerHTML = L.length ? sumHtml(S, true) : "";
  const prep = mode() === "prep", calm = prep && !S.round; // tijdens een gevecht geen Begin leeg en geen moeilijkheid
  $("#order").innerHTML = L.length
    ? (S.sample && calm ? `<li class="sbanner"><span>${esc(t("init.prep.sample"))}</span><button type="button" class="btn small" id="sample-clear">${esc(t("init.welcome.empty"))}</button></li>` : "") + endBanner(S, calm) + encStrip(S, prep) + encBanner(S, calm) + expBanner(calm) + listHtml(S, L, prep)
    : expBanner(calm) + emptyState(S, prep);
  $("#resetbar").innerHTML = ui.confirmReset
    ? S.list.some((c) => c.kind !== "pc")
      ? `<div class="confirm">${esc(t("init.prep.wipeWhat"))}<button class="btn small primary" id="reset-mons">${esc(t("init.prep.wipeMons"))}</button><button class="btn small ghost" id="reset-yes">${esc(t("init.prep.wipeAll"))}</button><button class="btn small" id="reset-no">${esc(t("common.cancel"))}</button></div>`
      : `<div class="confirm">${esc(t("init.prep.wipeAllQ"))}<button class="btn small primary" id="reset-yes">${esc(t("init.prep.wipeYes"))}</button><button class="btn small" id="reset-no">${esc(t("common.cancel"))}</button></div>`
    : `${S.list.length ? `<button class="btn small ghost" id="reset">${esc(t("init.prep.wipe"))}</button>` : ""}${S.round ? `<button class="btn small ghost" id="stop">${esc(t("init.prep.end"))}</button>` : ""}`;
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
    + `<li class="downblk"><button type="button" class="downbtn" id="down-tog" aria-expanded="${ui.downOpen}">${esc(t("init.fight.down", { n: down.length }))} ${chev(ui.downOpen)}</button></li>`
    + (ui.downOpen ? down.map((c) => row(c, S, true)).join("") : "");
}

/** Lege lijst: welkomstkaart (echt de eerste keer), knop voor de party, of een korte hint */
function emptyState(S, prep) {
  const T = (k) => esc(t(k));
  if (!prep) return `<li class="welcome"><p>${T("init.empty.none")}</p><div class="wbtns"><button type="button" class="btn primary tap" data-setmode="prep">${T("init.empty.toPrep")}</button></div></li>`;
  const encBtn = (cls) => `<button type="button" class="btn${cls} tap" data-prep="enc">${T("init.empty.loadEnc")}</button>`;
  const enc = app.encounters.length > 0;
  if (app.party.length) return `<li class="welcome"><p>${T("init.empty.partyReady")}</p><div class="wbtns"><button type="button" class="btn primary tap" data-prep="party">${T("init.party.seat")}</button>${enc ? encBtn("") : ""}</div></li>`;
  if (enc) return `<li class="welcome"><p>${T("init.empty.nobody")}</p><div class="wbtns">${encBtn(" primary")}</div><p class="hint">${T("init.empty.pcHint")}</p></li>`;
  if (ui.welcome) return `<li class="welcome"><h2>${T("init.welcome.title")}</h2>
    <p>${T("init.welcome.text")}</p>
    <div class="wbtns"><button type="button" class="btn primary tap" id="welcome-sample">${T("init.welcome.sample")}</button><button type="button" class="btn tap" id="welcome-empty">${T("init.welcome.empty")}</button></div>
    <button type="button" class="link wimp" data-impw="1">${T("init.welcome.import")}</button>
    <p class="hint">${T("init.welcome.hint")}</p></li>`;
  return `<li class="empty">${T("init.empty.hint")}</li>`;
}

const GEAR = ico("gear", "big");

/** GV7: vraag boven Start als er monsters uit het vorige gevecht staan (ui.startAsk na een tik op Start) */
function oldAsk(S) {
  const L = ui.startAsk ? oldMons(S) : []; // render muteert niets: start/undo/old-* zetten startAsk
  if (!L.length) return "";
  const onlyOld = !S.list.some((c) => c.kind === "monster" && !L.includes(c));
  return `<div class="confirmbox oldask" role="group" aria-label="${esc(t("init.old.aria"))}"><p>${esc(oldText(L))}</p>
    <div class="bar">${onlyOld ? `<button type="button" class="btn primary tap" id="old-wipe">${esc(t("init.old.wipe"))}</button>` : `<button type="button" class="btn primary tap" id="old-start">${esc(t("init.old.start"))}</button>`}<button type="button" class="btn tap" id="old-go">${esc(t("init.old.go"))}</button><button type="button" class="link" id="old-no">${esc(t("common.cancel"))}</button></div></div>`;
}

function paintDock() {
  const S = app.S;
  const L = sortOrder(S.list);
  const undoBtn = `<button id="undo" ${canUndo() ? "" : "disabled"} aria-label="${esc(t("init.dock.undo"))}" title="${esc(t("init.dock.undoTip", { key: MAC ? "⌘Z" : "Ctrl+Z" }))}" aria-keyshortcuts="Meta+Z Control+Z">${ico("undo")}</button>`;
  const pb = (k, l, al) => `<button type="button" data-prep="${k}" aria-pressed="${ui.prep === k || (k === "mon" && MONTABS.includes(ui.prep))}"${al ? ` aria-label="${al}" title="${al}"` : ""}>${l}</button>`;
  const prepRow = mode() === "prep" ? `<div class="prow">${pb("mon", `<span class="pp">+&nbsp;</span>Monster`, "")}${pb("pc", `<span class="pp">+&nbsp;</span>${esc(t("init.dock.pc"))}`, "")}${pb("party", esc(t("init.prep.tParty")), "")}${pb("data", GEAR, esc(t("init.dock.settings")))}</div>` : "";
  if (!S.round) {
    $("#dock").innerHTML = `${prepRow}${svBar(S)}${oldAsk(S)}<div class="row one">${undoBtn}<button class="nx" id="start" ${L.length ? "" : `disabled aria-describedby="start-why"`}>${esc(t("init.dock.start"))}</button></div>
      ${L.length ? "" : `<p class="why" id="start-why">${esc(t("init.dock.startWhy"))}</p>`}`;
    return;
  }
  if (prepRow) { // Voorbereiden tijdens een gevecht: geen beurtbalk, één knop terug (IN5: dock niet twee rijen hoog)
    $("#dock").innerHTML = `${prepRow}${svBar(S)}<div class="row one">${undoBtn}<button class="nx" data-setmode="fight">${esc(t("init.dock.back", { n: n0(S.round) }))}</button></div>`;
    return;
  }
  const i = L.findIndex((c) => c.id === S.active);
  const act = L[i];
  const nxt = nextUp(S, L, S.active); // slaat neer en (ronde 1) verrast over
  const g = act ? groupOf(L, act.id, S.round) : null; // groepsbeurt: "Bugbear 2 · 2/3"
  $("#dock").innerHTML = `<div class="who"><span><span class="l">${esc(t("init.fight.now"))}</span><br><b>${act ? esc(act.name) : "–"}</b>${g ? ` <span class="gk" title="${esc(t("init.fight.grpTip", { k: g.k, n: g.live.length }))}">· ${g.k}/${g.live.length}</span>` : ""}</span><span class="r">${nxt ? esc(t("init.fight.next", { name: nxt.name })) : ""}</span></div>
    ${svBar(S)}${allDown(S) ? `<div class="svbar"><div class="svrow endrow"><span>${esc(t("init.fight.allDown"))}</span><button type="button" id="fin">${esc(t("init.prep.end"))}</button></div></div>` : ""}${laBar(S, L)}<div class="row">${undoBtn}<button id="prev" class="pv" aria-label="${esc(t("init.fight.prevAria"))}" title="${esc(t("init.fight.prevTip"))}" aria-keyshortcuts="Shift+N"><span aria-hidden="true">‹</span><span class="pvl" aria-hidden="true">${esc(t("init.fight.prev"))}</span></button><button class="aoeb" id="aoe" aria-label="${esc(t("init.fight.aoeAria"))}" ${spellTargets(app.S.list).length ? "" : "disabled"}>AoE</button><button class="nx" id="next" title="${esc(t("init.fight.nextTip"))}" aria-keyshortcuts="N Space">${esc(t("init.fight.nextBtn"))}<span class="nb"> ${esc(t("init.fight.nextTurn"))}</span> ›</button></div>`;
}

/* ---------- open saves: regels in de beurtbalk (max 2) of één knop met paneel ---------- */
/** Bonus voor de knop "Rol": statblock-save of ability-modifier (Bless/Bane en cover tellen bij het rollen mee) */
export const svBonus = (c, ab) => saveBonus(c.ref ? findMon(c.ref) : null, ab);
/** RE7: monster zonder bekende savebonus (geen statblock/ability score): de DM rolt zelf, de app gokt geen +0 */
export const selfRoll = (c, ab) => c.kind === "monster" && !saveKnown(c.ref ? findMon(c.ref) : null, ab);
const SELF = () => ` <span class="tag">${esc(t("init.sv.self"))}</span>`;

/** Eén open save. full = in het paneel "Open saves" (met "einde beurt"); in de beurtbalk kort (RE12: past op 320 px naast Geslaagd/Gefaald) */
function svRow(S, s, full = false) {
  const c = S.list.find((x) => x.id === s.id);
  const what = s.kind === "conc" ? `${t("init.sv.conc")}${c.concSpell ? ` · ${c.concSpell}` : ""}`
    : s.kind === "rider" ? `${s.n} · ${s.rd.conds.length ? t("init.sv.or", { what: s.rd.conds.join(" + ") }) : s.rd.dmg ? `${s.rd.roll ? s.rd.roll.total : s.rd.dmg.e} ${s.rd.dmg.type}${s.rd.dmg.half ? `, ${t("init.sv.half")}` : ""}` : t("init.sv.seeSb")}`
    : `${s.n}${full ? ` · ${t("init.sv.endTurn")}` : ""}`;
  const self = selfRoll(c, s.ab), end = lastTurn(s);
  const btns = c.kind === "monster" && !self
    ? `<button type="button" class="svroll" data-svroll="${esc(s.sid)}" aria-label="${esc(t("init.sv.rollAria", { name: c.name, ab: s.ab, dc: s.dc }))}">${esc(t("init.sv.roll", { b: sgn(svBonus(c, s.ab)) }))}</button>`
    : `<button type="button" class="svok" data-svok="${esc(s.sid)}" data-v="1" aria-label="${esc(t("init.sv.okAria", { name: c.name, ab: s.ab }))}">${esc(t("init.sv.ok"))}</button><button type="button" class="svok bad" data-svok="${esc(s.sid)}" data-v="0" aria-label="${esc(t("init.sv.failAria", { name: c.name, ab: s.ab }))}">${esc(t("init.sv.fail"))}</button>`;
  const av = saveAdv(c, s.ab), adv = av.v ? ` · ${av.v > 0 ? "adv" : "dis"} (${av.why})` : ""; // RE11/RE16
  return `<div class="svrow${end ? " svend" : ""}"><span class="svn"><b>${esc(c.name)}</b><small>${esc(`${s.ab} ${s.dc} · ${what}${adv}${self ? ` · ${t("init.sv.self")}` : ""}`)}</small>${end ? `<small class="svx">${esc(t("init.sv.expires"))}</small>` : ""}</span>${btns}</div>`;
}

/**
 * RE16: "Rage loopt door?" tijdens de beurt van een barbarian in rage die sinds zijn vorige beurt geen schade nam.
 * Doorgaan is het normale geval (0 tikken); de app weet niet of hij aanviel, dus alleen een knop Voorbij.
 */
function rageRow(S) {
  const c = S.round ? S.list.find((x) => x.id === S.active) : null, e = c && rageOf(c);
  if (!e || e.hit) return "";
  return `<div class="svrow rgrow"><span class="svn"><b>${esc(c.name)}</b><small>${esc(t("init.sv.rage"))}</small></span><button type="button" class="svok bad" data-rgend="${esc(c.id)}" aria-label="${esc(t("init.sv.rageEndAria", { name: c.name }))}">${esc(t("init.sv.rageEnd"))}</button></div>`;
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
  if (rg) return `<div class="svbar">${rg}<button type="button" class="svall" data-svsheet="1">${esc(t("init.sv.open", { n: O.length }))} ${chev(false)}</button></div>`;
  const C = O.filter((s) => s.kind === "conc"), btn = (x) => `<button type="button" class="svall" data-svsheet="1">${esc(x)} ${chev(false)}</button>`;
  if (!C.length || C.length > 2) return `<div class="svbar">${btn(C.length ? t("init.sv.openConc", { n: O.length, k: C.length }) : t("init.sv.open", { n: O.length }))}</div>`;
  return `<div class="svbar">${C.map((s) => svRow(S, s)).join("")}${btn(t("init.sv.openOther", { n: O.length - C.length }))}</div>`;
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
      <div class="shead"><h3 id="s-title">${esc(t("init.sv.title"))}</h3><button type="button" class="link" data-svsheet="0">${esc(t("common.close"))}</button></div>
      <div class="svbar">${O.map((s) => svRow(app.S, s, true)).join("")}</div>
      ${mons > 1 ? `<button type="button" class="btn primary qgo" data-svrollall="1">${esc(t("init.sv.rollAll", { n: mons }))}</button>` : ""}
      ${self.length ? `<p class="hint">${esc(t("init.sv.selfList", { names: self }))}</p>` : ""}
      <p class="hint">${esc(t("init.sv.hint"))}</p>
    </div>`;
  el.hidden = false;
  el.querySelector(".ssheet").scrollTop = top;
}

/* ---------- legendary actions: vaste regel in de beurtbalk + paneel ---------- */
// sleutels per laStatus: kort (chip) en uitleg (tooltip); vertaald bij het tekenen
const LA_K = { own: ["init.la.whyOwn", "init.la.tipOwn"], empty: ["init.la.whyEmpty", "init.la.tipEmpty"], inc: ["init.la.whyInc", "init.la.tipInc"], sur: ["init.la.whySur", "init.la.tipSur"] };
const LA_WHY = (st) => t(LA_K[st][0]);
const LA_TITLE = (st) => t(LA_K[st][1]);
const dots = (o) => { const m = Math.max(0, n0(o.max)), l = Math.min(m, Math.max(0, n0(o.left))); return "●".repeat(l) + "○".repeat(m - l); };

/** Zolang een levend monster met legendary actions meedoet staat de regel er (dus geen verspringende beurtbalk); uit = gedimd */
function laBar(S, L) {
  const M = laList(S, L);
  if (!M.length) return "";
  const pulse = (ok) => (ok && ui.laPulse ? " pulse" : "");
  if (M.length > 2) {
    const ok = M.some((c) => laStatus(c, S) === "ok");
    return `<div class="larow"><button class="lachip${ok ? "" : " off"}${pulse(ok)}" data-la="*" aria-label="${esc(t("init.la.allAria", { n: M.length }))}">
      <span class="ln">${esc(t("init.la.all", { n: M.length }))}</span>${chev(false)}</button></div>`;
  }
  return `<div class="larow">${M.map((c) => {
    const st = laStatus(c, S), ok = st === "ok";
    return `<button class="lachip${ok ? "" : " off"}${pulse(ok)}" data-la="${esc(c.id)}" ${ok ? "" : "disabled"} title="${ok ? "Legendary actions" : esc(LA_TITLE(st))}"
      aria-label="${esc(t("init.la.chipAria", { name: c.name, n: n0(c.la.left), max: n0(c.la.max) }) + (ok ? "" : ", " + LA_TITLE(st)))}">
      <span class="ln">${esc(c.name)}</span><span class="ld">${ok ? dots(c.la) : esc(LA_WHY(st))}</span>${chev(false)}</button>`;
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
    const rows = o.act ? [{ ...o.act, n: t("init.la.roll"), an: o.act.n, label: o.n }] : o.refs;
    const can = ok && o.cost <= n0(c.la.left);
    return `<div class="lao">
      <div class="lah"><span class="an">${esc(o.n)}<small>${o.cost} LA</small></span>
        <button type="button" class="btn small${can ? " primary" : ""}" data-lause="${esc(c.id)}" data-i="${i}" ${can ? "" : "disabled"}
          aria-label="${esc(t("init.la.useAria", { name: o.n, n: o.cost }))}">${esc(t("init.lair.use"))}</button></div>
      ${rows.map((a) => atkRow({ ...a, tag: "" }, c.id, i)).join("")}
      ${!rows.length && o.text ? `<p class="latxt">${esc(o.text)}</p>` : ""}</div>`;
  }).join("");
  return `<section class="lamon"><div class="lamh"><b>${esc(c.name)}</b><span class="ld">${dots(c.la)} <small>${esc(t("init.la.left", { n: n0(c.la.left), max: n0(c.la.max) }))}</small></span></div>
    ${ok ? "" : `<p class="hint">${esc(LA_TITLE(st))}.</p>`}${opts}</section>`;
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
      <div class="shead"><h3 id="l-title">Legendary actions</h3><button type="button" class="link" data-lsh="close">${esc(t("common.close"))}</button></div>
      <p class="hint">${esc(t("init.la.hint"))}</p>
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
    preview = `${esc(hp(c))} → <b>${esc(hp(sim))} HP</b>`;
    if (s.kind === "dmg") {
      const dealt = Math.floor(v * s.mode);
      if (s.mode !== 1) preview += ` · ${esc(t("init.dmg.after", { n: dealt, mode: t({ 0.5: "init.dmg.mResist", 2: "init.dmg.mVuln", 0: "init.dmg.mImm" }[s.mode]) }))}`;
      if (sim.ds && sim.ds.dead && !(c.ds && c.ds.dead)) preview += ` · <b class="bad">${esc(t("init.dmg.dies"))}</b>`;
      else if (sim.hp === 0 && c.hp > 0 && c.kind === "monster" && hasUF(m)) { // RE13: het schadepaneel kent het type niet: de DM zegt het
        preview += s.ufx ? ` · <b class="bad">${esc(t("init.card.down"))}</b> · ${esc(t("init.dmg.noUf"))}` : ` · ${esc(t("init.dmg.uf", { dc: ufDc(dealt) }))}`;
        ufBtn = `<div class="xrow"><button type="button" class="btn small" data-sk="ufx" aria-pressed="${!!s.ufx}">${esc(t("init.dmg.ufx"))}</button><span class="hint">${esc(t("init.dmg.ufxHint"))}</span></div>`;
      }
      else if (sim.hp === 0 && c.hp > 0) preview += ` · <b class="bad">${esc(t(c.kind === "pc" ? "init.dmg.unc" : "init.card.down"))}</b>`;
      else if (c.cond.includes("Concentrating") && sim.hp > 0 && dealt > 0) preview += ` · concentration save <b>DC ${Math.max(10, Math.floor(dealt / 2))}</b>`;
    }
  } else preview = esc(t(c.temp ? "init.dmg.nowT" : "init.dmg.now", { hp: n0(c.hp), max: n0(c.max), temp: n0(c.temp) }));
  // RE13: Parry (reaction) van een monster: de aanval van de speler mist als hij met +N niet zou raken
  const pn = s.kind === "dmg" && app.S.round && c.kind === "monster" ? parryOf(m) : 0, ac = effAc(c);
  const parry = pn && canParry(c, app.S.round) ? `<div class="xrow"><button type="button" class="btn small" data-sk="parry">${esc(t("init.dmg.parry", { n: pn }))}</button><span class="hint">${esc(t("init.dmg.parryHint", { ac: ac ? `AC ${ac}${pn > 1 ? `–${ac + pn - 1}` : ""}` : `AC +${pn}` }))}</span></div>` : "";
  const kinds = [["dmg", t("init.dmg.kDmg")], ["heal", "Heal"], ["thp", "Temp HP"]];
  const label = t({ dmg: "init.dmg.goDmg", heal: "init.dmg.goHeal", thp: "init.dmg.goThp" }[s.kind], { n: v || "" }).replace(/\s+/g, " ").trim();
  el.hidden = false;
  el.innerHTML = `<div class="dim" data-sk="close"></div>
    <div class="sheet" tabindex="-1" role="dialog" aria-modal="true" aria-label="${esc(`${c.name}: ${kinds.find((k) => k[0] === s.kind)[1]}`)}">
      <div class="grab" aria-hidden="true"></div>
      <div class="shead"><h3>${esc(c.name)}</h3><button class="link" data-sk="close">${esc(t("common.cancel"))}</button></div>
      <div class="seg2">${kinds.map(([k, l]) => `<button data-sk="kind" data-v="${k}" aria-pressed="${s.kind === k}">${esc(l)}</button>`).join("")}</div>
      ${s.kind === "dmg" ? `<div class="seg2 sm">${[[1, "init.dmg.normal"], [0.5, "init.dmg.resist"], [2, "init.dmg.vuln"], [0, "init.dmg.imm"]].map(([m, l]) => `<button data-sk="mode" data-v="${m}" aria-pressed="${s.mode === m}">${esc(t(l))}</button>`).join("")}</div>${c.kind === "pc" && c.dr ? `<p class="hint drhint">${esc(drText(c.dr))}</p>` : ""}${rageOf(c) ? `<p class="hint drhint">${esc(t("init.dmg.rage", { res: rageOf(c).bear ? t("init.rage.allBut") : "B/P/S" }))}</p>` : ""}${parry}` : ""}
      <div class="disp" aria-live="polite">${esc(s.val || "0")}</div>
      <div class="preview">${preview}</div>${ufBtn}
      <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-sk="d" data-v="${n}">${n}</button>`).join("")}<button data-sk="back" aria-label="${esc(t("init.card.padBack"))}">⌫</button><button data-sk="d" data-v="0">0</button><button data-sk="clear" aria-label="${esc(t("init.dmg.clear"))}">C</button>
        <button class="go go-${s.kind}" data-sk="apply" ${v ? "" : "disabled"}>${esc(label)}</button></div>
    </div>`;
}

/* ---------- monsterlijst (Monster-paneel en snel toevoegen) ---------- */
/** Lijst + kopregel + lege/foutmelding. attr = data-attribuut van de rijknoppen; none = tekst als er zonder filter niets is */
export function monListHtml(f, sel, attr, none) {
  const rows = f.L.map((m) => `<button type="button" ${attr}="${esc(m.n)}" aria-pressed="${m.n === sel}"><span>${icon("m-" + monType(m.meta), "mi")}${esc(m.n)}${m.custom ? ` · ${esc(t("init.mon.own"))}` : ""}</span><span class="cr">CR ${esc(m.cr || "?")} · AC ${parseInt(m.ac) || "?"} · ${n0(m.hp) || "?"} HP</span></button>`).join("");
  const empty = f.label ? esc(t("init.mon.none", { q: f.label })) : esc(none);
  return rows || `<p class="hint" style="padding:10px">${empty}</p>`;
}
/** Kopregel boven de lijst: "Undead · CR 2–4 · 6 monsters", of uitleg bij een onleesbaar CR-woord; "" = verbergen */
export const monLabel = (f) => (f.bad ? t("init.mon.badCr")
  : f.label ? t("init.mon.found", { label: f.label, n: f.L.length }) : "");
/** Preview van de keuze: telefoon met knop naar het volledige statblock, tablet/desktop zonder (zijkolom toont het) */
export const monPrev = (m, full, side) => (m ? monCard(m, full, !side || isPhone()) : "");

/** Knoptekst bij monsters toevoegen: "2× Goblin verborgen toevoegen" (verborgen staat in de knop, zodat je het niet mist) */
export const addLabel = (n, name, hid, anon) => {
  const what = `${n > 1 ? `${n}× ` : ""}${name}`, flags = [hid && t("init.mon.flagHid"), anon && t("init.mon.flagAnon")].filter(Boolean);
  return t("init.mon.addBtn", { what: flags.length ? t("init.mon.flags", { what, flags: flags.join(", ") }) : what });
};
export const hidHint = () => t("init.mon.hidHint");
export const anonHint = () => t("init.mon.anonHint", { anon: t("player.anon") }); // naam = die op het spelersscherm (WP28)

/* ---------- één bedieningsblok voor monsters toevoegen (IN4): Monster-paneel en snel toevoegen ---------- */
/**
 * st = { n, fixOn, fix } per paneel; HP en Per monster/Groep komen uit ui.addOpts (onthouden), Invullen geldt één keer.
 * Rollen staat uit zonder hit dice. pre = id-voorvoegsel ("mon" of "q"). Knoppen dragen data-ab, het getalveld data-ab="fix".
 */
export const INIT_OPTS = [["each", "init.mon.initEach"], ["group", "init.mon.initGroup"], ["fixed", "init.mon.initFixed"]]; // [waarde, sleutel]
export const addInit = (st) => (st.fixOn ? "fixed" : ui.addOpts.init);
export const addHp = (m) => (ui.addOpts.hp === "roll" && m && m.hd ? "roll" : "avg");
export function addHint(st, m) {
  const n = st.n, v = parseInit(st.fix), init = addInit(st);
  const k = init === "fixed" ? (n > 1 ? (v == null ? "init.mon.hintFixedN0" : "init.mon.hintFixedN") : v == null ? "init.mon.hintFixed10" : "init.mon.hintFixed1")
    : init === "group" ? (n > 1 ? "init.mon.hintGroupN" : "init.mon.hintGroup1")
    : n > 1 ? "init.mon.hintEachN" : "init.mon.hintEach1";
  return [t(k, { n, v }), ui.addOpts.hp === "roll" && m && !m.hd && t("init.mon.hintNoHd"), app.S.round && t("init.mon.hintLate")].filter(Boolean).join(" ");
}
export function addBlockHtml(pre, st, m) {
  const init = addInit(st), seg = (k, opts, cur, dis) => opts.map(([v, l]) => `<button type="button" data-ab="${k}" data-v="${v}" aria-pressed="${cur === v}"${dis && dis(v) ? " disabled" : ""}>${esc(t(l))}</button>`).join("");
  return `<div class="qrow">
      <div class="qcol"><span class="qlbl" id="${pre}-nl">${esc(t("init.mon.qty"))}</span>
        <div class="stepper" role="group" aria-labelledby="${pre}-nl"><button type="button" data-ab="n" data-v="-1" aria-label="${esc(t("init.mon.less"))}" ${st.n <= 1 ? "disabled" : ""}>−</button><output aria-live="polite">${st.n}</output><button type="button" data-ab="n" data-v="1" aria-label="${esc(t("init.mon.more"))}" ${st.n >= 20 ? "disabled" : ""}>+</button></div></div>
      <div class="qcol"><span class="qlbl" id="${pre}-hl">HP</span>
        <div class="seg2" role="group" aria-labelledby="${pre}-hl">${seg("hp", [["avg", "init.mon.hpAvg"], ["roll", "init.mon.hpRoll"]], m && !m.hd ? "avg" : ui.addOpts.hp, (v) => v === "roll" && m && !m.hd)}</div></div>
    </div>
    <div class="qcol"><span class="qlbl" id="${pre}-il">Initiative</span>
      <div class="seg2 init3" role="group" aria-labelledby="${pre}-il">${seg("init", INIT_OPTS, init)}</div></div>
    ${init === "fixed" ? `<label>${esc(st.n > 1 ? t("init.mon.fixAll", { n: st.n }) : t("init.mon.fix"))}<input id="${pre}-fix" data-ab="fix" type="number" inputmode="numeric" enterkeyhint="done" placeholder="${esc(t("init.mon.fixPh"))}" value="${esc(st.fix)}"></label>` : ""}
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
      <div class="shead"><h3 id="q-title">${esc(t("init.qadd.title"))}</h3><button type="button" class="link" data-q="close">${esc(t("common.cancel"))}</button></div>
      <label>${esc(t("init.mon.search"))}<input id="q-q" placeholder="${esc(t("init.mon.searchPh"))}" autocomplete="off" enterkeyhint="search"></label>
      <p class="mlbl" id="q-lbl" aria-live="polite" hidden></p>
      <div class="mlist qlist" id="q-list"></div>
      <div id="q-prev"></div>
      <div class="addblk" id="q-blk"></div>
      <label class="chk"><input type="checkbox" data-q="hid" id="q-hid"> ${esc(t("init.mon.hidden"))}</label>
      <p class="hint" id="q-hidh" hidden>${esc(hidHint())}</p>
      <label class="chk"><input type="checkbox" data-q="anon" id="q-anon"> ${esc(t("init.mon.anon"))}</label>
      <p class="hint" id="q-anonh" hidden>${esc(anonHint())}</p>
      <div class="sfoot"><button type="button" class="btn primary qgo" data-q="go"></button></div>
    </div>`;
    el.hidden = false;
  }
  const f = filterMonsters(allMonsters(), q.q, q.sel, !!q.typed, SYN);
  if (f.sel !== q.sel) q.full = false; // andere keuze: preview weer kort
  q.sel = f.sel; // UI-toestand: de selectie volgt wat zichtbaar is (zoals in de Monster-tab)
  const lbl = monLabel(f);
  $("#q-lbl").hidden = !lbl; $("#q-lbl").textContent = lbl;
  $("#q-list").innerHTML = monListHtml(f, q.sel, "data-qpick", t("init.qadd.none"));
  $("#q-prev").innerHTML = monPrev(q.sel && findMon(q.sel), q.full, false); // snel toevoegen: geen zijkolom (die volgt de beurt)
  if (!q.typing) $("#q-blk").innerHTML = addBlockHtml("q", q, q.sel && findMon(q.sel)); // tijdens typen in het getalveld niet vervangen (focus)
  else $("#q-addh").textContent = addHint(q, q.sel && findMon(q.sel));
  const go = el.querySelector(".qgo");
  go.disabled = !q.sel || (q.fixOn && parseInit(q.fix) === null);
  go.textContent = q.sel ? addLabel(q.n, q.sel, q.hid, q.anon) : t("init.mon.pick");
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

// [waarde, sleutel]: vertaald bij het tekenen
const MODES = [[1, "init.dmg.normal"], [0.5, "init.aoe.mResist"], [2, "init.aoe.mVuln"], [0, "init.dmg.imm"]];
const SAVES = [["fail", "init.sv.fail"], ["half", "init.aoe.okHalf"], ["none", "init.aoe.zero"]];
const SAVES0 = [["fail", "init.sv.fail"], ["none", "init.aoe.ok0"]]; // save-actie zonder halve schade (Wing Attack)
/** Uitkomst van een geslaagde save in dit paneel */
export const okSave = (a) => (a && a.half === false ? "none" : "half");

/** RE11/RE16: "adv (Rage)" / "dis (Exhaustion 3)" bij een save, vóór het rollen (spelers rollen zelf) */
const advHint = (c, ab) => { const v = saveAdv(c, ab); return v.v ? `${v.v > 0 ? "adv" : "dis"} (${esc(v.why)})` : ""; };

function aoeRow(a, c, p, o, n) {
  const id = esc(c.id), nm = esc(c.name), dc = parseInt(a.dc);
  const end = !n ? "" : o.res ? ` · <b class="bad">${esc(o.res)}</b>` : c.hp > 0 ? ` · ${n0(c.hp)} → ${n0(o.hp)} HP` : "";
  const mods = p.roll ? [] : saveMods(c, a.ab);
  const info = [
    p.roll ? `${esc(a.ab)} save ${esc(rollText(p.roll, dc))}` : mods.length ? esc(t("init.aoe.mods", { mods: modsText(mods) })) : "",
    p.roll ? "" : advHint(c, a.ab),
    p.auto && p.mode !== 1 && a.type ? esc(`${t(MODE_LBL[p.mode])} (${p.def && p.def.eff ? "Rage" : c.kind === "pc" ? t("init.aoe.saved") : t("init.aoe.sb")})`) : "",
    p.auto && p.def.cond ? esc(t("init.aoe.note", { what: p.def.cond })) : "",
  ].filter(Boolean).join(" · ");
  const lrLeft = c.lr ? n0(c.lr.left) : 0;
  const lrBtn = p.lr ? `<span class="hint">${esc(t("init.aoe.lrOk"))}</span>`
    : p.save === "fail" && lrLeft > 0 ? `<button type="button" class="link" data-ao="lr" data-id="${id}">${esc(t("init.aoe.lrUse", { n: lrLeft }))}</button>` : "";
  return `<div class="at ${p.sel ? "" : "off"}">
    <label class="atop"><input type="checkbox" data-ao="sel" data-id="${id}" ${p.sel ? "checked" : ""}>
      <span class="atn"><span>${nm}</span> <span class="tag ${c.kind === "pc" ? "" : "m"}">${esc(t(c.kind === "pc" ? "init.card.kindPc" : "init.card.kindMon"))}</span>${p.sel && !p.roll && a.ab && selfRoll(c, a.ab) ? SELF() : ""}<small>${n0(c.hp)}/${n0(c.max)} HP${c.temp ? ` +${n0(c.temp)}` : ""}</small></span>
      ${p.sel && n ? `<b class="adealt ${o.dealt ? "" : "zero"}">−${o.dealt}</b>` : ""}</label>
    ${p.sel ? `<div class="seg2 sm" role="group" aria-label="Save ${nm}">${(a.half === false ? SAVES0 : SAVES).map(([v, l]) => `<button type="button" data-ao="save" data-id="${id}" data-v="${v}" aria-pressed="${p.save === v}"${v === "none" && a.half !== false ? ` aria-label="${esc(t("init.aoe.evasion"))}" title="${esc(t("init.aoe.evasion"))}"` : ""}>${esc(t(l))}</button>`).join("")}</div>
      <div class="seg2 sm" role="group" aria-label="${esc(t("init.aoe.resAria", { name: c.name }))}">${MODES.map(([v, l]) => `<button type="button" data-ao="mode" data-id="${id}" data-v="${v}" aria-pressed="${p.mode === v}">${esc(t(l))}</button>`).join("")}</div>
      <div class="acalc">${n ? o.steps.join(" → ") + end : esc(t("init.aoe.fill"))}${info ? `<br>${info}` : ""}</div>${lrBtn}` : ""}
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
  return `<div class="aslot"><span class="qlbl">Slot</span><div class="seg2 sm" role="group" aria-label="${esc(t("init.slot.aria", { name: c.name }))}">${opts.map((o) => `<button type="button" data-ao="${ao}" data-v="${o.k}" aria-pressed="${k === o.k}" aria-label="${esc(t("init.slot.left", { slot: o.k === "p" ? slotName(c, "p") : o.k[0] === "d" ? o.l : t("init.card.slotLv", { lv: o.l }), n: o.left }))}">${esc(o.l)} <small>·${o.left}</small></button>`).join("")}<button type="button" data-ao="${ao}" data-v="self" aria-pressed="${k === "self"}" title="${esc(t("init.slot.selfTip", { name: c.name }))}">${esc(t("init.slot.self"))}</button></div></div>
    ${empty ? `<p class="hint">${tb("init.slot.empty", {}, t("init.slot.emptyB", { slot: slotName(c, k) }), "bad")}</p>` : k === "run" ? `<p class="hint">${esc(t("init.slot.run", { spell: n }))}</p>` : k === "self" ? `<p class="hint">${esc(t("init.slot.selfHint", { name: c.name }))}</p>` : ""}`;
}

/** Suggestieknoppen (zoeken of de spells van de caster) */
const dmgBtns = (L) => L.map((s) => `<button type="button" class="btn small" data-ao="dsp" data-v="${esc(s.n)}">${esc(s.n)}<small>${s.lv ? ORD[s.lv] : "cantrip"}</small></button>`).join("");
/** Alleen de suggesties opnieuw (tijdens typen: het zoekveld houdt focus) */
export function paintDmgSugg(a) {
  const el = $("#a-sugg"); if (!el) return;
  const L = findDmgSpells(DMG_SPELLS, a.dq);
  el.innerHTML = a.dq && !L.length ? `<p class="hint">${esc(t("init.aoe.notListed"))}</p>` : dmgBtns(L);
}

/** Caster, spell en slot bovenaan de tab Schade */
function dmgCastHtml(a) {
  const c = aoeCaster(a), sp = dmgSp(a), cs = spellTargets(app.S.list);
  const casterSel = `<label class="scast">Caster<select id="a-by"><option value="">${esc(t("init.aoe.noCaster"))}</option>${cs.map((x) => `<option value="${esc(x.id)}" ${x.id === a.by ? "selected" : ""}>${esc(x.id === app.S.active ? t("init.aoe.curTurn", { name: x.name }) : x.name)}</option>`).join("")}</select></label>`;
  if (!sp) {
    const own = ownDmgSpells(c, DMG_SPELLS);
    return `${casterSel}<div class="aspell">${own.length ? `<div class="dchips">${dmgBtns(own)}</div>` : ""}
      <label class="dq">${esc(t("init.aoe.dmgSpell"))}<input id="a-q" type="search" value="${esc(a.dq || "")}" placeholder="${esc(t("init.aoe.dmgSpellPh"))}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"></label>
      <div class="dchips" id="a-sugg"></div></div>`;
  }
  const lvl = casterLevel(c, c && c.ref ? findMon(c.ref) : null);
  const meta = [sp.lv ? ORD[dmgLevel(a, c, sp)] : "cantrip", `${sp.ab} ${sp.half ? "½" : "0"}`, sp.type].join(" · ");
  const cant = !sp.lv && sp.cant ? `<p class="hint">${esc(lvl ? t("init.aoe.cantrip", { lvl, dice: dmgDice(a, c, sp) }) : t("init.aoe.cantrip0", { dice: sp.dice }))}</p>` : "";
  const lose = c && sp.conc && c.cond.includes("Concentrating") && c.concSpell && c.concSpell !== sp.n ? c.concSpell : ""; // zoals in de tab Spell
  return `${casterSel}<div class="aspell"><div class="dsel"><span><b>${esc(sp.n)}</b> · ${esc(meta)}${sp.conc ? " · conc" : ""}</span><button type="button" class="link" data-ao="dspx" aria-label="${esc(t("init.aoe.otherSpell"))}">${ico("x")}</button></div>${cant}
    ${lose ? `<p class="hint"><b class="bad">${esc(t("init.aoe.lose", { name: c.name, spell: lose }))}</b></p>` : ""}
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
      <div class="shead"><h3 id="a-title">${esc(a.title || t("init.aoe.title"))}</h3><button type="button" class="link" data-ao="close">${esc(t("common.cancel"))}</button></div>
      ${aoeTabs(a)}
      ${a.src ? "" : `<div class="acast">${dmgCastHtml(a)}</div>
      <div class="adice"><label>${esc(t("init.aoe.dice"))}<input id="a-dice" value="${esc(a.dice || "")}" placeholder="${esc(t("init.aoe.dicePh"))}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"></label><button type="button" class="btn" data-ao="droll">${esc(t("init.pc.roll"))}</button></div>`}
      <div class="arow">
        <label>${esc(t("init.dmg.kDmg"))}<input id="a-dmg" type="number" inputmode="numeric" min="0" max="999" placeholder="28" enterkeyhint="done"></label>
        <label>Damage type<select id="a-type"><option value="">${esc(t("init.aoe.typeNone"))}</option>${DTYPES.map((ty) => `<option value="${ty}">${ty[0].toUpperCase() + ty.slice(1)}</option>`).join("")}</select></label>
      </div>
      <div class="asrc hint" id="a-src" aria-live="polite"></div>
      <div class="asave"><span class="qlbl">Save</span>
        <select id="a-ab" aria-label="Save-ability">${ABS.map((x) => `<option>${x}</option>`).join("")}</select>
        <input id="a-dc" type="number" inputmode="numeric" placeholder="DC" aria-label="DC" min="1" max="40">
        <button type="button" class="btn small" data-ao="roll">${esc(t("init.aoe.rollMons"))}</button></div>
      <div class="asel"><span class="qlbl" id="a-cnt"></span><span><button type="button" class="link" data-ao="all" data-v="monster">${esc(t("init.aoe.selMons"))}</button><button type="button" class="link" data-ao="all" data-v="pc">${esc(t("init.aoe.selPcs"))}</button><button type="button" class="link" data-ao="all" data-v="">${esc(t("init.aoe.selNone"))}</button></span></div>
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
  const edited = a.rtot != null && clampDmg(a.dmg) !== a.rtot ? ` · ${t("init.aoe.edited", { n: a.rtot })}` : "";
  if (a.roll) src.innerHTML = `${esc(a.roll + edited)} <button type="button" class="link" data-ao="reroll">${esc(t("init.aoe.reroll"))}</button>${a.extra ? `<br>${esc(t("init.aoe.extra", { what: a.extra }))}` : ""}${a.alt ? `<br>${esc(t("init.aoe.alt", { type: a.alt }))}` : ""}${a.used ? `<br><b class="bad">${esc(t("init.aoe.notRc", { name: a.act }))}</b>` : ""}`;
  const L = aoeTargets(a.src), n = clampDmg(a.dmg);
  const rows = L.map((c) => { const p = aoePick(a, c); return { c, p, o: p.sel && n ? aoeOutcome(c, p, n) : { dealt: 0, steps: [], res: "", hp: c.hp } }; });
  const sel = rows.filter((x) => x.p.sel);
  $("#a-list").innerHTML = rows.map((x) => aoeRow(a, x.c, x.p, x.o, n)).join("") || `<p class="hint">${esc(t("init.aoe.nobody"))}</p>`;
  $("#a-cnt").textContent = t("init.aoe.cnt", { n: sel.length });
  const total = sel.reduce((s, x) => s + x.o.dealt, 0), down = sel.filter((x) => x.o.down).length;
  $("#a-sum").textContent = n && sel.length ? t(down ? "init.aoe.totalDown" : "init.aoe.total", { n: total, k: down }) : "";
  const go = el.querySelector(".ago");
  go.disabled = !n || !sel.length;
  const sp = !a.src && dmgSp(a), c = sp && aoeCaster(a), k = sp ? dmgSlot(a, c, sp) : "";
  const slotT = slotName(c, k) ? ` · ${slotName(c, k)}` : "";
  go.textContent = !n ? t("init.aoe.fill") : !sel.length ? t("init.aoe.pickT") : t("init.aoe.go", { dmg: `${n}${a.type ? " " + a.type : ""}`, n: sel.length }) + slotT;
}

/* ---------- Spell op doelen (tab in het AoE-paneel): Bless, Hold Person e.d. op meerdere doelen ---------- */
/** Tabs Schade | Spell; niet bij een save-actie van een monster (die is altijd schade) */
const aoeTabs = (a) => (a.src ? "" : `<div class="seg2 atabs" role="group" aria-label="${esc(t("init.aoe.tabsAria"))}">${[["dmg", t("init.dmg.kDmg")], ["spell", "Spell"]].map(([v, l]) => `<button type="button" data-ao="tab" data-v="${v}" aria-pressed="${(a.tab || "dmg") === v}">${esc(l)}</button>`).join("")}</div>`);

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
const durName = durShort; // WP27: "1 minuut" i.p.v. "1 minuut (10 rondes)", uit de catalogus

/** Keuze per doel: wat de DM tikte, anders de standaard (kant van de caster, immuniteit, humanoid) */
export function spellPick(a, sp, caster, c) {
  const m = c.ref ? findMon(c.ref) : null, def = spellDefault(sp, caster, c, m), o = a.s[c.id] || {};
  return { ...def, m, sel: o.sel ?? def.sel, ok: !!o.ok, roll: o.roll || null, lr: !!o.lr };
}

function spellRow(a, sp, caster, c, p) {
  const id = esc(c.id), nm = esc(c.name), dc = parseInt(a.sdc);
  const res = !p.sel ? "" : p.immune ? `<b class="sres zero">${esc(t("init.sp.immune"))}</b>` : p.ok || p.lr ? `<b class="sres zero">${esc(t("init.sp.noEff"))}</b>`
    : `<b class="sres">${esc(sp.eff || sp.conds.join(" + "))}</b>`;
  const mods = p.roll ? [] : sp.ab ? saveMods(c, sp.ab) : [];
  const info = p.roll ? `${esc(sp.ab)} save ${esc(rollText(p.roll, dc))}` : [mods.length ? esc(t("init.aoe.mods", { mods: modsText(mods) })) : "", sp.ab ? advHint(c, sp.ab) : ""].filter(Boolean).join(" · ");
  const lrLeft = c.lr ? n0(c.lr.left) : 0;
  const lrBtn = p.lr ? `<span class="hint">${esc(t("init.aoe.lrOk"))}</span>`
    : sp.ab && !p.ok && !p.immune && lrLeft > 0 ? `<button type="button" class="link" data-ao="slr" data-id="${id}">${esc(t("init.aoe.lrUse", { n: lrLeft }))}</button>` : "";
  return `<div class="at ${p.sel ? "" : "off"}">
    <label class="atop"><input type="checkbox" data-ao="ssel" data-id="${id}" ${p.sel ? "checked" : ""}>
      <span class="atn"><span>${nm}</span> <span class="tag ${c.kind === "pc" ? "" : "m"}">${esc(t(c.kind === "pc" ? "init.card.kindPc" : "init.card.kindMon"))}</span>${p.tags.map((x) => ` <span class="tag">${esc(x)}</span>`).join("")}${p.sel && !p.roll && !p.immune && sp.ab && selfRoll(c, sp.ab) ? SELF() : ""}<small>${c.max ? `${n0(c.hp)}/${n0(c.max)} HP` : esc(t("init.sp.hpUnknown"))}</small></span>
      ${res}</label>
    ${p.sel && sp.ab && !p.immune ? `<div class="seg2 sm" role="group" aria-label="Save ${nm}">${[["0", "init.sv.fail"], ["1", "init.sv.ok"]].map(([v, l]) => `<button type="button" data-ao="ssave" data-id="${id}" data-v="${v}" aria-pressed="${(p.ok || p.lr) === (v === "1")}">${esc(t(l))}</button>`).join("")}</div>
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
        <label>${esc(t("init.pc.name"))}<input id="s-n" value="${esc(cf.n || "")}" placeholder="${esc(t("init.sp.namePh"))}" maxlength="60" autocomplete="off"></label>
        <div class="ed3">
          <label>${esc(t("init.prep.cond"))}<select id="s-cond">${SPELL_CONDS.map((k) => `<option ${(cf.cond || "Frightened") === k ? "selected" : ""}>${k}</option>`).join("")}</select></label>
          <label>Save<select id="s-ab"><option value="">${esc(t("init.card.none"))}</option>${ABS.map((x) => `<option ${cf.ab === x ? "selected" : ""}>${x}</option>`).join("")}</select></label>
          <label>${esc(t("init.eff.dur"))}<select id="s-dur">${DURS.map(([v, l]) => `<option value="${v}" ${(cf.dur || "r10") === v ? "selected" : ""}>${esc(t(l))}</option>`).join("")}</select></label>
        </div>
        <div class="schk"><label><input type="checkbox" id="s-rep" ${cf.rep ? "checked" : ""}> ${esc(t("init.cond.save"))}</label><label><input type="checkbox" id="s-conc" ${cf.conc === false ? "" : "checked"}> ${esc(t("init.sp.conc"))}</label></div>
      </div>` : "";
    el.innerHTML = `<div class="dim" data-ao="close"></div>
    <div class="sheet qsheet asheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="a-title">
      <div class="grab" aria-hidden="true"></div>
      <div class="shead"><h3 id="a-title">${esc(t("init.sp.title"))}</h3><button type="button" class="link" data-ao="close">${esc(t("common.cancel"))}</button></div>
      ${aoeTabs(a)}
      <div class="effgrid spgrid">${SPELLS.map((x, i) => (spellFor(x, presetEd(caster, x.n)) ? `<button type="button" class="btn tap" data-ao="sp" data-v="${i}" aria-pressed="${a.sp === i}"><span>${esc(x.n)}${edTag(caster, x.n, x) ? ` <span class="tag">${esc(edTag(caster, x.n, x))}</span>` : ""}</span><small>${esc(x.sk ? t(x.sk) : x.sub)}</small></button>` : "")).join("")}<button type="button" class="btn tap" data-ao="todmg">${esc(t("init.aoe.dmgSpell"))}<small>Fireball, Sacred Flame …</small></button><button type="button" class="btn tap" data-ao="sp" data-v="own" aria-pressed="${a.sp === "own"}">${esc(t("init.sp.own"))}<small>${esc(t("init.sp.ownSub"))}</small></button></div>
      <label class="scast">Caster<select id="s-by"><option value="">${esc(t("init.sp.pickCaster"))}</option>${cs.map((x) => `<option value="${esc(x.id)}" ${x.id === a.by ? "selected" : ""}>${esc(x.id === S.active ? t("init.aoe.curTurn", { name: x.name }) : x.name)}</option>`).join("")}</select></label>
      <div id="s-slot"></div>
      ${own}
      ${sp && sp.ab ? `<div class="asave"><span class="qlbl">Save</span><b>${esc(sp.ab)}</b>
        <input id="s-dc" type="number" inputmode="numeric" placeholder="DC" aria-label="DC" min="1" max="40" value="${esc(a.sdc || "")}">
        <button type="button" class="btn small" data-ao="sroll">${esc(t("init.aoe.rollMons"))}</button></div>` : ""}
      <p class="hint" id="s-info" aria-live="polite"></p>
      <div class="asel"><span class="qlbl" id="a-cnt"></span><span><button type="button" class="link" data-ao="sall" data-v="monster">${esc(t("init.aoe.selMons"))}</button><button type="button" class="link" data-ao="sall" data-v="pc">${esc(t("init.aoe.selPcs"))}</button><button type="button" class="link" data-ao="sall" data-v="">${esc(t("init.aoe.selNone"))}</button></span></div>
      <div class="alist" id="a-list"></div>
      <div class="afoot"><span class="hint" id="a-sum" aria-live="polite"></span><button type="button" class="btn primary qgo ago" data-ao="sgo"></button></div>
    </div>`;
    el.hidden = false;
  }
  const L = sortOrder(spellTargets(S.list));
  const go = el.querySelector(".ago");
  if (!sp) {
    const gone = typeof a.sp === "number" && SPELLS[a.sp]; // preset bestaat niet voor de editie van deze caster (Sleep 2014)
    $("#s-info").textContent = gone ? t(gone.n === "Sleep" ? "init.sp.noPresetHp" : "init.sp.noPreset", { spell: `${gone.n} ${presetEd(caster, gone.n)}` }) : t("init.sp.pickDot");
    $("#a-list").innerHTML = ""; $("#a-cnt").textContent = ""; $("#a-sum").textContent = "";
    go.disabled = true; go.textContent = t("init.sp.pick");
    return;
  }
  const rows = L.map((c) => ({ c, p: spellPick(a, sp, caster, c) })), sel = rows.filter((x) => x.p.sel);
  // uitleg: wat een gefaalde save doet, duur, concentratie, herhaalsave, en of de caster een andere concentratie verliest
  const what = sp.eff ? effText(presetsFor(presetEd(caster, sp.n)).find((p) => p.n === sp.eff)) || "" : sp.conds.join(" + ");
  const bits = [what, sp.dur === "inf" && sp.conc ? t("init.sp.whileConc") : durName(sp.eff ? "r10" : sp.dur), sp.conc ? "conc" : "", sp.rep ? t("init.sp.rep", { ab: sp.ab }) : "", sp.nk ? t(sp.nk) : ""].filter(Boolean);
  const lose = caster && sp.conc && caster.cond.includes("Concentrating") && caster.concSpell && caster.concSpell !== sp.n ? caster.concSpell : "";
  $("#s-info").innerHTML = `${esc(bits.join(" · "))}${lose ? `<br><b class="bad">${esc(t("init.aoe.lose", { name: caster.name, spell: lose }))}</b>` : ""}${a.redc ? `<br>${esc(t("init.sp.redc", { dc: a.redc }))}` : ""}`;
  $("#a-list").innerHTML = rows.map((x) => spellRow(a, sp, caster, x.c, x.p)).join("") || `<p class="hint">${esc(t("init.sp.nobody"))}</p>`;
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
    cnt.textContent = mx ? t("init.sp.cntOf", { n: sel.length, max: mx }) + (k !== "self" ? ` · ${ORD[L]}` : "") : t("init.sp.cnt", { n: sel.length });
    slot = k !== "self" ? slotName(caster, k) : "";
  } else {
    const need = slotFor(sp, sel.length);
    slot = need ? (need > 9 ? t("init.sp.over9") : t("init.card.slotLv", { lv: ORD[need] })) : "";
    over = !!slot;
    cnt.textContent = sp.max && !sp.custom ? t("init.sp.cntOf", { n: sel.length, max: sp.max }) + (slot ? ` · ${slot}` : "") : t("init.sp.cnt", { n: sel.length });
  }
  cnt.classList.toggle("over", over);
  const hit = sel.filter((x) => !x.p.immune && !x.p.ok && !x.p.lr).length, ok = sel.length - hit;
  $("#a-sum").textContent = sp.ab && sel.length ? `${hit} ${sp.eff ? t("init.sp.hit") : sp.conds[0]}${ok ? ` · ${t("init.sp.okN", { n: ok })}` : ""}` : "";
  go.disabled = !caster || !sel.length;
  go.textContent = !caster ? t("init.sp.pickCasterBtn") : !sel.length ? t("init.sp.pickT") : t("init.sp.go", { spell: sp.n, n: sel.length }) + (slot ? ` · ${slot}` : "");
}

/* ---------- aanval op één doel (to-hit-knop op de monsterkaart) ---------- */
// [waarde, sleutel]: vertaald bij het tekenen
const ADVS = [["a", "init.atk.auto"], [1, "init.atk.adv"], [-1, "init.atk.dis"], [0, "init.dmg.normal"]];
const ADV_W = (v) => (v > 0 ? "Advantage" : v < 0 ? "Disadvantage" : t("init.dmg.normal"));
const XMODES = [[1, "init.dmg.normal"], [0.5, "init.dmg.resist"], [2, "init.dmg.vuln"], [0, "init.dmg.imm"]];
const AUTO_CRIT = ["Paralyzed", "Unconscious"];

/** Wie een aanval kan krijgen: niet de aanvaller, geen lair, geen dode speler of monster op 0 HP (spelers op 0 HP wel) */
export const atkTargets = (by) => sortOrder(app.S.list).filter((c) => c.kind !== "lair" && c.id !== by && !isOut(c));

/** Knoptekst bij een treffer: "7 schade + Prone toepassen", "7 schade toepassen · save in beurtbalk" (RE13) */
function goLabel(dealt, ri, x) {
  const base = dealt ? t("init.atk.dmgN", { n: dealt }) : "";
  if (!ri || !ri.act || ri.choice === "na") return dealt ? t("init.atk.apply", { what: base }) : t("init.atk.noDmg");
  const rd = ri.rd, ch = ri.choice;
  if (!ch) return t("init.atk.applySave", { what: base || t("init.atk.nothing") });
  const extra = [];
  if (rd.dmg && x.rroll) { const v = ch === "fail" ? x.rroll.total : rd.dmg.half ? Math.floor(x.rroll.total / 2) : 0; if (v) extra.push(`${v} ${rd.dmg.type}`); }
  if (ch === "fail" && rd.conds.length) extra.push(rd.conds.join(" + "));
  const all = [base, ...extra].filter(Boolean);
  return all.length ? t("init.atk.apply", { what: all.join(" + ") }) : t("init.atk.applyNone");
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
  const rd = ri.rd, head = esc(t("init.atk.then", { ab: rd.ab, dc: rd.dc, what: riderWhat(rd) }));
  const only = rd.only ? `<p class="hint">${esc(t("init.atk.only", { what: rd.only }))}</p>` : "";
  if (ri.immune) return `<div class="xrider"><p class="hint">${head} <span class="tag">${esc(t("init.sp.immune"))}</span></p></div>`;
  if (!ri.act) return `<div class="xrider"><p class="hint">${esc(t("init.atk.note", { ab: rd.ab, dc: rd.dc, what: rd.note }))}</p>${only}</div>`;
  const roll = x.rroll ? `<p class="hint">${esc(x.rroll.txt)}${rd.dmg.half ? `, ${esc(t("init.atk.half", { n: Math.floor(x.rroll.total / 2) }))}` : ""}</p>` : "";
  if (ri.auto) return `<div class="xrider"><p class="qlbl">${head}</p>${roll}<p class="hint"><span class="tag">${esc(t("init.atk.autoFail"))}</span></p></div>`;
  const canRoll = c.kind === "monster" && !selfRoll(c, rd.ab);
  return `<div class="xrider"><p class="qlbl">${head}</p>${roll}
    <div class="xrow">${canRoll ? `<button type="button" class="btn small" data-xa="rroll" aria-label="${esc(t("init.sv.rollAria", { name: c.name, ab: rd.ab, dc: rd.dc }))}">${esc(t("init.sv.roll", { b: sgn(svBonus(c, rd.ab)) }))}</button>` : ""}
    <div class="seg2 sm" role="group" aria-label="Save ${esc(c.name)}">${[["fail", "init.sv.fail"], ["ok", "init.sv.ok"], ...(rd.only ? [["na", "init.atk.notApp"]] : [])].map(([v, l]) => `<button type="button" data-xa="rs" data-v="${v}" aria-pressed="${x.rs === v}">${esc(t(l))}</button>`).join("")}</div></div>
    ${x.rx ? `<p class="hint">${esc(`${rd.ab} ${rollText(x.rx, rd.dc)}`)}</p>` : ""}${only}</div>`;
}

/** Effectieve worp tegen dit doel: Auto = advantage/disadvantage uit condities (atkAdv), anders de handmatige stand */
export function atkRoll(x, by, c) {
  const au = atkAdv(by, c, x.kind);
  return { au, r: withAdv(x.r, x.adv === "a" ? au.v : x.adv) };
}
/** Reden als korte tag: "adv Prone", "dis Invisible", "adv/dis heffen op" */
const advTag = (au) => (!au.adv.length && !au.dis.length ? "" : au.v ? `${au.v > 0 ? "adv" : "dis"} ${(au.v > 0 ? au.adv : au.dis).map((x) => x.replace(/ \(.*\)$/, "").split(" ").pop()).join(", ")}` : t("init.atk.cancel"));
const advWhy = (au) => (au.v > 0 ? au.adv : au.v < 0 ? au.dis : []).join(", ");

/** Kan de LA van deze aanval nu betaald worden? */
export const laCan = (x, by) => !!x.la && laStatus(by, app.S) === "ok" && x.la.cost <= n0(by.la && by.la.left);

/** Schakelaar "−2 LA" bij een aanval uit het legendary-paneel */
function laToggle(x, by) {
  const L = x.la, left = n0(by.la && by.la.left), can = laCan(x, by);
  return `<div class="xrow xla"><button type="button" class="btn small" data-xa="la" aria-pressed="${can && L.on}" ${can ? "" : "disabled"}>−${L.cost} LA</button>
    <span class="hint">${esc(can ? `Legendary action: ${L.n}${L.on ? "" : ` ${t("init.atk.laOff")}`}` : laStatus(by, app.S) === "ok" ? t("init.atk.laDear", { n: left }) : t("init.atk.laNo"))}</span></div>`;
}

function atkTgtRow(c, prev, x, by) {
  const ac = effAc(c), tag = advTag(atkAdv(by, c, x.kind));
  return `<button type="button" class="xt" data-xa="tgt" data-id="${esc(c.id)}">${avatar(c, c.ref ? findMon(c.ref)?.meta : "")}
    <span class="xn">${esc(c.name)}${prev ? ` <span class="tag">${esc(t("init.atk.prev"))}</span>` : ""}</span>
    <span class="xi">${ac ? `AC ${n0(ac)}` : "AC ?"}${c.max ? ` · ${n0(c.hp)}/${n0(c.max)} HP` : ""}${tag ? `<b class="xadvt">${esc(tag)}</b>` : ""}</span></button>`;
}

function atkPick(x, by) {
  const L = atkTargets(by.id), prev = ui.atkPrev && ui.atkPrev.by === by.id ? L.find((c) => c.id === ui.atkPrev.id) : null;
  const rest = L.filter((c) => c !== prev), pcs = rest.filter((c) => c.kind === "pc"), mons = rest.filter((c) => c.kind !== "pc");
  return `<div class="seg2 sm xadv" role="group" aria-label="Advantage">${ADVS.map(([v, l]) => `<button type="button" data-xa="adv" data-v="${v}" aria-pressed="${x.adv === v}">${esc(t(l))}</button>`).join("")}</div>
    ${x.la ? laToggle(x, by) : ""}
    <div class="xlist">${prev ? atkTgtRow(prev, true, x, by) : ""}${pcs.map((c) => atkTgtRow(c, false, x, by)).join("")}
    ${mons.length ? `<p class="qlbl xsub">Monsters</p>${mons.map((c) => atkTgtRow(c, false, x, by)).join("")}` : ""}
    ${L.length ? "" : `<p class="hint">${esc(t("init.atk.nobody"))}</p>`}</div>
    <div class="afoot"><button type="button" class="link" data-xa="free">${esc(t("init.atk.free"))}</button><span></span></div>`;
}

/** "d20 [14, <s>6</s>] +11 = 25 vs AC 16": de d20 die niet telt doorgestreept */
function atkHtml(r, ac) {
  const used = r.d.length > 1 ? r.d.indexOf(r.nat) : 0;
  const dice = r.d.map((v, i) => (i === used ? String(v) : `<s>${v}</s>`)).join(", ");
  return `d20 [${dice}] ${r.bo >= 0 ? "+" : "−"}${Math.abs(r.bo)} = ${r.tot}${ac ? ` vs AC ${ac}` : ""}`;
}

/** Welke modus en waarom: "Advantage (Ayla Prone)", "Handmatig: Advantage · auto: dis (Invisible)" */
function advLine(x, au, r) {
  if (x.adv !== "a") return esc(`${t("init.atk.manual", { mode: ADV_W(r.adv) })}${au.v !== r.adv ? ` · auto: ${advTag(au) || t("init.atk.normal")}` : ""}`);
  if (au.v) return `${ADV_W(au.v)} (${esc(advWhy(au))})`;
  return au.adv.length ? esc(t("init.atk.normalBoth")) : "";
}

function atkRes(x, c, by) {
  const { au, r } = atkRoll(x, by, c);
  const ac = atkAc(x, c), res = atkResult(r, ac, x.parts, x.modes, x.force);
  const word = t(res.crit ? "init.atk.crit" : res.hit ? (res.natHit ? "init.atk.hitW" : "init.atk.forced") : r.nat === 1 ? "init.atk.miss1" : "init.atk.miss");
  const crit = c.cond.filter((k) => AUTO_CRIT.includes(k));
  const hints = [
    !ac ? esc(t("init.atk.noAc")) : "",
    crit.length ? esc(t("init.atk.critNear", { name: c.name, conds: crit.join(", ") })) : "",
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
    const end = !c.max ? "" : sim.ds && sim.ds.dead && !(c.ds && c.ds.dead) ? ` · <b class="bad">${esc(t("init.dmg.dies"))}</b>`
      : uf && uf.dc ? ` · ${esc(t("init.dmg.uf", { dc: uf.dc }))}`
      : was > 0 && sim.hp <= 0 ? ` · <b class="bad">${esc(t(c.kind === "pc" ? "init.dmg.unc" : "init.card.down"))}</b>${uf && uf.skip ? ` · ${esc(t("init.atk.noUf", { why: uf.skip }))}` : ""}`
      : c.kind === "pc" && was <= 0 && res.dealt ? ` · <b class="bad">${esc(res.crit ? t("init.atk.twoFail") : t("rules.aoeRes.dsf"))}</b>` : "";
    body = `${x.parts.length ? `<div class="xdmg">${x.parts.map((p) => esc(partText(p, res.crit))).join("<br>")}</div>` : `<p class="hint">${esc(t("init.atk.noRoll"))}</p>`}
      ${res.types.map((ty) => `<div class="xmode"><span class="qlbl">${esc(ty.type || t("init.atk.dmgW"))}${ty.mode !== 1 && ty.mode === targetMode(c, null, ty.type).mode ? (targetMode(c, null, ty.type).eff ? " · Rage" : c.kind === "pc" ? ` · ${esc(t("init.aoe.saved"))}` : "") : ""}</span><div class="seg2 sm" role="group" aria-label="${esc(t("init.atk.resAria", { type: ty.type }))}">${XMODES.map(([v, l]) => `<button type="button" data-xa="mode" data-t="${esc(ty.type)}" data-v="${v}" aria-pressed="${ty.mode === v}">${esc(t(l))}</button>`).join("")}</div></div>`).join("")}
      <div class="xrow"><button type="button" class="btn small" data-xa="crit" aria-pressed="${res.crit}">${esc(t("init.atk.critBtn"))}</button>
      <span class="acalc">${c.max ? `${n0(c.hp)} → ${n0(sim.hp)} HP${end}` : esc(t("init.sp.hpUnknown"))}</span></div>
      ${ri ? riderRow(x, c, ri) : ""}`;
    const can = c.max && (res.dealt || (ri && ri.act && ri.choice !== "na"));
    const left = shieldOk(c, x, r, res) ? `<button type="button" class="btn" data-xa="shield">Shield +5</button>`
      : parryOk(c, x, r, res) ? `<button type="button" class="btn" data-xa="parry">Parry +${parryOf(findMon(c.ref))}</button>` : "<span></span>";
    const nx = !can && x.sq && x.sq.left.length ? x.sq.left[0] : ""; // GV11: niets toe te passen (immuun): wel door
    foot = `${left}${nx ? `<button type="button" class="btn primary qgo" data-xa="next">${esc(t("init.atk.nextAtk", { name: nx }))} ${chev(false)}</button>`
      : `<button type="button" class="btn primary qgo" data-xa="go" ${can ? "" : "disabled"}>${esc(!c.max ? t("init.sp.hpUnknown") : goLabel(res.dealt, ri, x))}</button>`}`;
  } else {
    const spend = x.la && x.la.on && laCan(x, by);
    const nx = !spend && x.sq && x.sq.left.length ? x.sq.left[0] : ""; // GV11: door naar de volgende aanval
    foot = `<button type="button" class="link" data-xa="force">${esc(t("init.atk.force"))}</button><button type="button" class="btn primary qgo" data-xa="${spend ? "miss" : nx ? "next" : "close"}">${spend ? esc(t("init.atk.closeLa", { n: x.la.cost })) : nx ? `${esc(t("init.atk.nextAtk", { name: nx }))} ${chev(false)}` : esc(t("common.close"))}</button>`;
  }
  return `<button type="button" class="link xback" data-xa="back">${esc(t("init.atk.other"))}</button>
    <p class="xhit"><b class="${res.hit ? "ok" : "bad"}">${word}</b> ${atkHtml(r, ac)}</p>
    ${how ? `<p class="xhow">${how}</p>` : ""}
    ${hints.length ? `<p class="hint">${hints.join("<br>")}</p>` : ""}
    ${x.la ? laToggle(x, by) : ""}
    ${body}<div class="afoot">${foot}</div>`;
}

export function paintAtk() {
  const el = $("#xsheet"), x = ui.atk;
  const by = x && app.S.list.find((c) => c.id === x.by);
  const c = x && x.tid && app.S.list.find((o) => o.id === x.tid && !isOut(o)); // doel intussen dood/neer (Ongedaan): terug naar de lijst
  if (!x || !by) { el.hidden = true; el.innerHTML = ""; return; }
  el.innerHTML = `<div class="dim" data-xa="close"></div>
    <div class="sheet qsheet xsheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="x-title">
      <div class="grab" aria-hidden="true"></div>
      <div class="shead"><h3 id="x-title">${esc(x.label)}${x.sq ? ` ${x.sq.i}/${x.sq.n}` : ""} → ${esc(c ? c.name : t("init.atk.target"))}</h3><button type="button" class="link" data-xa="close">${esc(t("common.cancel"))}</button></div>
      ${c ? atkRes(x, c, by) : atkPick(x, by)}
    </div>`;
  el.hidden = false;
}

/* ---------- initiative van spelers bij Start gevecht ---------- */
/** GV5: Monsters Houden | Opnieuw rollen (alleen met onaangeroerde worpen; ingevuld of aangepast blijft altijd) */
function monRollHtml(mons) {
  if (!mons) return "";
  const fresh = app.S.list.filter(freshRoll).length, fixed = mons - fresh;
  if (!fresh) return `<p class="hint">${esc(t("init.ini.monFixed", { n: mons }))}</p>`;
  const v = initRoll();
  return `<div class="isur"><span id="i-mon">${esc(t("init.aoe.selMons"))}</span><div class="seg2" role="group" aria-labelledby="i-mon">${[["keep", "init.ini.keep"], ["roll", "init.ini.reroll"]].map(([k, l]) => `<button type="button" data-ia="mroll" data-v="${k}" aria-pressed="${v === k}">${esc(t(l))}</button>`).join("")}</div></div>
      <p class="hint">${esc(v === "roll" ? [t("init.ini.atStart"), fixed ? t("init.ini.kept", { n: fixed }) : ""].filter(Boolean).join(" ") : t("init.ini.added"))}</p>`;
}
export function paintInit() {
  const el = $("#isheet"), x = ui.initDraft;
  if (!x) { el.hidden = true; el.innerHTML = ""; return; }
  const L = initPcs(app.S.list), mons = app.S.list.filter((c) => c.kind === "monster").length;
  const last = L.length && L[L.length - 1].id === x.act;
  el.innerHTML = `<div class="dim" data-ia="close"></div>
    <div class="sheet qsheet isheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="i-title">
      <div class="grab" aria-hidden="true"></div>
      <div class="shead"><h3 id="i-title">Initiative</h3><button type="button" class="link" data-ia="close">${esc(t("common.cancel"))}</button></div>
      ${monRollHtml(mons)}
      <div class="isur"><span id="i-sur">${esc(t("init.card.sur"))}</span><div class="seg2" role="group" aria-labelledby="i-sur">${[["none", "init.aoe.selNone"], ["mon", "init.aoe.selMons"], ["pc", "init.aoe.selPcs"]].map(([k, l]) => `<button type="button" data-ia="sur" data-v="${k}" aria-pressed="${(x.sur || "none") === k}" ${k === "mon" && !mons ? "disabled" : ""}>${esc(t(l))}</button>`).join("")}</div></div>
      <p class="hint isurh" id="i-surh">${esc(t((x.sur || "none") === "none" ? "init.ini.surNone" : "init.ini.surSome"))}</p>${percLine()}
      <div class="ilist">${L.map((c) => `<div class="ir ${c.id === x.act ? "act" : ""}">
        <button type="button" class="irn" data-ia="sel" data-id="${esc(c.id)}" aria-pressed="${c.id === x.act}" aria-label="${esc(t("init.ini.rowAria", { name: c.name, v: x.v[c.id] || t("init.ini.empty") }))}"><span>${esc(c.name)}</span>${x.rolls[c.id] ? `<small>${esc(x.rolls[c.id])}</small>` : ""}</button>
        <b class="iv" aria-hidden="true">${x.v[c.id] !== "" && x.v[c.id] != null ? esc(x.v[c.id]) : "—"}</b>
        <button type="button" class="btn small" data-ia="roll" data-id="${esc(c.id)}" aria-label="${esc(t("init.ini.rollAria", { name: c.name }))}">${esc(t("init.pc.roll"))}</button></div>`).join("")}</div>
      <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-ia="d" data-v="${n}">${n}</button>`).join("")}<button type="button" data-ia="back" aria-label="${esc(t("init.card.padBack"))}">⌫</button><button type="button" data-ia="d" data-v="0">0</button><button type="button" data-ia="clear" aria-label="${esc(t("init.ini.clear"))}">C</button></div>
      <div class="ifoot sfoot"><button type="button" class="btn" data-ia="next" ${last ? "disabled" : ""}>${esc(t("init.ini.next"))} ›</button><button type="button" class="btn primary qgo" data-ia="go">${esc(t("init.dock.start"))}</button></div>
    </div>`;
  el.hidden = false;
}

/* ---------- party en logboek ---------- */
/** VB2: wie een sessie voorbereidt zoekt bij Party; de encounters staan onder + Monster */
const encLink = () => `<button type="button" class="btn tap enclink" data-prep="enc">${esc(t("init.party.encLink"))} ${chev(false)}</button>`;
export function paintParty() {
  const el = $("#party-panel");
  const at = new Set(app.S.list.filter((c) => c.pid).map((c) => c.pid));
  const fight = !!app.S.round; // SP4: initiative pas bij Start gevecht; tijdens een gevecht meteen (het paneel opent niet meer)
  if (!app.party.length) {
    el.innerHTML = `<p class="empty">${esc(t("init.party.empty"))}</p>${encLink()}`;
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
    const upd = m.ddbId ? `<button type="button" class="link pupd" data-pupd="${esc(m.pid)}" aria-label="${esc(t("init.party.updAria", { name: m.name }))}"${busy ? ` aria-disabled="true"` : ""}${u && u.st === "busy" ? ` aria-busy="true"` : ""}>${u && u.st === "busy" ? esc(t("init.party.loading")) : ico("refresh") + " " + esc(t(u && u.st === "err" ? "init.party.retry" : "init.party.update"))}</button>` : "";
    const box = !u || u.st === "busy" ? "" : u.st === "err" ? `<p class="hint warnline pupdbox"${u.said ? "" : ` role="alert"`}>${esc(u.msg)}</p>`
      : `<div class="confirmbox pupdbox"><p style="margin:0">${tb(at.has(m.pid) ? "init.party.updQHere" : "init.party.updQ", {}, m.name)}</p>
        <p class="hint">${esc(t("init.party.updKeep", { list: [...u.ch, ...u.kept].join(" · ") }))}</p>
        <div class="bar"><button type="button" class="btn primary tap" data-pupdok="${esc(m.pid)}">${esc(t("init.party.update"))}</button><button type="button" class="btn tap" data-pupdno="${esc(m.pid)}">${esc(t("common.cancel"))}</button></div></div>`;
    return `<div class="pm">${avatar({ ...m, kind: "pc" })}<div><div class="pn">${esc(m.name)}</div><div class="pi">${m.sheet && m.sheet.cls ? esc(m.sheet.cls) + " · " : ""}${m.ac ? `AC ${n0(m.ac)} · ` : ""}${m.max ? `HP ${n0(m.hp)}/${n0(m.max)}${m.temp ? ` +${n0(m.temp)}` : ""}` : ""}${sl}${pp != null ? ` · Passive Perc ${n0(pp)}` : ""}${rs}</div>${lv}${upd}</div>
      <div class="pc">${at.has(m.pid) ? `<span class="here">${esc(t("init.party.here"))}</span>` : !fight ? "" : `<input data-pinit="${esc(m.pid)}" type="number" inputmode="numeric" placeholder="init" aria-label="Initiative ${esc(m.name)}" value="${esc(ui.partyInit[m.pid] ?? "")}"><button type="button" class="btn small" data-proll="${esc(m.pid)}">${esc(t("init.pc.roll"))}</button>`}
        <button type="button" class="link" data-pdel="${esc(m.pid)}">${esc(t("init.party.del"))}</button></div>${box}</div>`;
  }).join("")}</div>
    <div class="bar">${fight ? `<button type="button" class="btn small" id="p-rollall">${esc(t("init.party.rollAll"))}</button>` : ""}<button type="button" class="btn primary" id="p-add">${esc(t("init.party.seat"))}</button></div>
    ${fight ? "" : `<p class="hint">${esc(t("init.party.initLater"))}</p>`}
    <div class="bar"><button type="button" class="btn small" id="p-short">Short rest</button><button type="button" class="btn small" id="p-long">Long rest</button></div>
    <p class="hint">${esc(t("init.party.restHint"))}</p>${encLink()}`;
}

const logCount = (S) => (S.log || []).filter((e) => !e.type).length;
/** Regels van het logboek, nieuwste bovenaan (gedeeld door het blok onder de lijst en het paneel in Gevecht) */
function logItems(L) {
  return [...L].reverse().map((e) => {
    const msg = logMsg(e), why = logWhy(e); // WP27: descriptor in de actieve taal, oude regels als bewaarde tekst
    if (e.type === "round") return `<li class="lg-round">${esc(msg)}</li>`;
    if (e.type === "turn") return `<li class="lg-turn">${esc(msg)}</li>`;
    return `<li class="lg"><span class="lg-meta">${esc(logRound(e.r))}${e.turn ? ` · ${esc(t("init.log.turn", { name: e.turn }))}` : ""}</span>
      <button type="button" class="lg-msg" data-logedit="${esc(e.id)}" aria-label="${esc(t("init.log.whyAria", { msg }))}">${esc(msg)}</button>
      ${why ? `<span class="lg-why">${esc(why)}</span>` : ""}
      ${ui.editLog === e.id ? `<input class="lg-in" data-lognote="${esc(e.id)}" value="${esc(e.note || "")}" placeholder="${esc(t("init.log.whyPh"))}" aria-label="${esc(t("init.log.why"))}">`
        : e.note ? `<button type="button" class="lg-note" data-logedit="${esc(e.id)}">${esc(e.note)}</button>` : ""}</li>`;
  }).join("");
}
const EMPTY_LOG = () => `<p class="hint">${esc(t("init.log.empty"))}</p>`;

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
        <div class="shead"><h3 id="g-title">${esc(t("init.log.title", { n: n0(app.S.round) }))}</h3><button type="button" class="link" data-log="close">${esc(t("common.close"))}</button></div>
        ${L.length ? `<p class="hint lg-tip">${esc(t("init.log.tip"))}</p><ol class="lglist">${logItems(L)}</ol>` : EMPTY_LOG()}
        ${L.length ? `<div class="ifoot"><button type="button" class="btn" id="logcopy">${esc(t("init.log.copy"))}</button><button type="button" class="btn" data-log="close">${esc(t("common.close"))}</button></div>` : ""}
      </div>`;
    gs.hidden = false;
    const sh = gs.querySelector(".gsheet");
    sh.scrollTop = top > 0 && L.length > cnt ? top + sh.scrollHeight - h0 : top; // nieuwe regels komen bovenaan: wie omlaag las, blijft op dezelfde regel
  }
  if (fight || (!L.length && !app.S.list.length)) { el.innerHTML = ""; } // Gevecht: alleen het paneel; lege start: geen leeg logboek
  else el.innerHTML = `<details class="logbox" id="logbox" ${ui.logOpen ? "open" : ""}><summary><span>${esc(t("init.fight.log"))}</span> <span class="hint">${esc(t("init.log.count", { n: logCount(app.S) }))}</span></summary>
    ${L.length ? `<div class="bar" style="margin:8px 0"><button class="btn small" id="logcopy">${esc(t("init.log.copy"))}</button></div><p class="hint lg-tip">${esc(t("init.log.tip"))}</p><ol class="lglist">${ui.logOpen ? logItems(L) : ""}</ol>` : EMPTY_LOG()}</details>`;
  if (ui.editLog) { const i = (ui.logSheet ? gs : el).querySelector(".lg-in"); if (i) i.focus(); }
}
