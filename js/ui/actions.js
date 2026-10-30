// Alle gebruikersacties. Knoppen dragen data-a="naam" (rij-acties) of een id (algemene acties).
import { APP } from "../version.js";
import { chev } from "./icons.js";
import { openSettings } from "./settings.js";
import { $, esc, n0, toast, toastHtml, closeToast, clearToasts, show, toastBad, tb, undoBtn } from "./util.js";
import { t } from "../i18n/boot.js";
import { M, J } from "../i18n/msg.js";
import { app, because, addWhy, logAs, commit, undo, redo as redoStep, canUndo, canRedo, clearRedo, stepNo, saveLairs, saveParty, saveLibrary, saveEncounters, saveSpellNotes, resetBaseline } from "../state.js";
import { render, ui, openId, mode, atkAc, atkRider, atkTargets, paintLog, paintParty, paintQadd, monListHtml, monLabel, monPrev, addLabel, hidHint, anonHint, paintAoe, paintDmgSugg, dmgSp, aoeCaster, dmgSlot, dmgDice, dmgLevel, spellSlot, paintLa, paintSv, paintAtk, paintInit, laOpts, atkRoll, laCan, svBonus, selfRoll, aoeTargets, aoePick, okSave, editPreview, editKeys, edNow, addBlockHtml, addBlockTap, addHint, addInit, addHp, curSpell, spellPick, paintExpLast, monSearch, edLineHtml } from "./render.js";
import { PAS, pasVal, cleanPas } from "../rules/passives.js";
import { cleanEd, edField, rulesField, rulesOf } from "../rules/edition.js";
import { castSpell, casterDC, spellTargets, castKey } from "../rules/spellcast.js";
import { DMG_SPELLS } from "../rules/dmgtable.js";
import { rollDice, diceText, normDice } from "../rules/dmgspells.js";
import { spendSlot, autoSpend } from "../rules/slots.js";
import { addSave, resolveSave, openSaves, isValid } from "../rules/saves.js";
import { useLA } from "../rules/legendary.js";
import { PRESETS, presetsFor, addEffect, removeEffect, endFightEffects, baseMax, endOtherCasts, saveMods, effAc, effSpec, setExh, startRage, rageOf } from "../rules/effects.js";
import { exhLevel, exhMod, condEd } from "../rules/conditions.js";
import { openCond, closeCond, condOpen, condSheetClick } from "./condinfo.js";
import { showSB, showSheet, monCard, doRoll, doDmgRoll, closeSB, phone, toggleBigSB, togglePinSB, followTurn, wantSB, sbTop, previewSB } from "./statblock.js";
import { findMon, parseMonsterFile, findKey, keyRef, withEdWord, loadSrd24, srd24Status } from "../data/monsters.js";
import { parseStatText, foundText, hasStructure, withParsed } from "../data/statparse.js";
import { d, sgn, uid, rollExpr, HD_RE, avgExpr } from "../rules/dice.js";
import { step, startCombat, stopCombat, clearMonsters, setInits, initPcs, makeDur, parseInit, isOut, sortOrder, setSurprise, toggleSurprise, rerollMonsters, removeCombatant, setInit, durWords, saveWords, initBo, monInit, initModText, initThrow, surWho } from "../rules/turns.js";
import * as R from "../rules/combat.js";
import { applyAoe, saveBonus, clampDmg, newPick, rollSave, rollText, hasMagicRes, saveAdv, DTYPES, targetMode, drToggle, drKind, DR_LBL, cleanDr } from "../rules/aoe.js";
import { monsterActions, actionAoe, rcIndex, partsKey, rollAttack, rollDmgCrit, atkResult, atkWhy, atkDamage, multiSeq, seqAfter } from "../rules/attacks.js";
import { ufNeed, ufApply, ufInfo, monSave, parseRider, applyRider, riderOutcome, parryOf, canParry, useParry } from "../rules/monrules.js";
import { castInfo, legInfo, rcInfo, pickList, isConc, edFor, ORD } from "../rules/spells.js";
import { setRulesEd, spellEd } from "./spellrules.js";
import { initRoll, setInitRoll } from "./initroll.js";
import { visNow, setVis } from "./playervis.js";
import { nextAnon } from "../playerview.js";
import { spellClick as spellInfoClick, spellOpen, closeSpell, spellEsc, resetNoteUndo } from "./spellinfo.js";
import { logText, stepEntries, stepText } from "../log.js";
import { readSheetPdf, fetchDdb, ddbMsg } from "../ddb.js";
import { parseDdbLink, findMember, mergeSheet, partyUpdate, seatPlan } from "../ddbjson.js";
import { RACE_OPTS, raceKey, pickRace, cleanImg } from "./avatar.js";
import { buildExport, parseImport, exportName } from "../backup.js";
import { markExported, snoozeNudge, SNOOZE_DAYS } from "../exportnudge.js";
import { cleanLvl } from "../rules/encounters.js";
import { startFight, oldMons, dropOld } from "../rules/fight.js";
import { finishFight, closeEnd } from "./einde.js";
import { pcReact, setPcReact } from "./pcreact.js";
import { armTour, restartTour } from "./tour.js";
import { keysKey, keysOpen, closeKeys, openKeys, MAC } from "./keys.js";
import { mapOpen, close as closeMap, fogEsc } from "./mapview.js";

/** Fx uit de regels: meldingen tonen en oorzaken doorgeven aan het logboek */
/** RE17: nieuwe concentration saves uit schade, als staart voor de melding (bediening alleen in de beurtbalk) */
const concNote = (f) => {
  const C = ((f && f.saves) || []).filter((s) => s.kind === "conc");
  return !C.length ? "" : ` · ${C.length === 1 ? t("init.msg.concSave", { dc: C[0].dc }) : t("init.msg.concSaves", { n: C.length })}`;
};
/**
 * RE13: Undead Fortitude na schade, in dezelfde stap (de app rolt: statblock-save + Bless/Bane). info: { radiant, crit, why }.
 * Geeft de staart voor de melding ("Undead Fortitude CON 19: d20 [17] +3 = 20, blijft op 1 HP") of "".
 */
function ufRoll(c, was, dealt, info) {
  const m = c.ref ? findMon(c.ref, c.ed) : null, need = ufNeed(c, m, was, dealt, info);
  if (!need) return "";
  const x = need.skip ? null : monSave(c, m, "CON");
  const r = ufApply(c, need, x, x ? rollText(x, 0) : "");
  addWhy(r.why);
  return r.txt;
}
/** RE16: Bear Totem / Frenzy per speler op dit apparaat (subclass staat niet betrouwbaar op de sheet) */
const RAGE_KEY = "it-rage";
const rageKey = (c) => c.pid || c.id;
function rageOpts(c) {
  try { const o = (JSON.parse(localStorage.getItem(RAGE_KEY) || "{}") || {})[rageKey(c)] || {}; return { bear: o.bear === true, frz: o.frz === true }; } catch { return { bear: false, frz: false }; }
}
function saveRageOpts(c, o) {
  try { const all = JSON.parse(localStorage.getItem(RAGE_KEY) || "{}") || {}; all[rageKey(c)] = { bear: !!o.bear, frz: !!o.frz }; localStorage.setItem(RAGE_KEY, JSON.stringify(all)); } catch { /* privémodus: alleen deze keer */ }
}

/** RE10: uitleg bij een conditiechip; duur, herhaalsave en bron uit de encounter */
function openCondFor(btn) {
  const S = app.S, c = S.list.find((x) => x.id === btn.dataset.cid), k = btn.dataset.cinfo;
  if (!c) return;
  const e = c.cd && c.cd[k], by = e && e.by && S.list.find((x) => x.id === e.by);
  const rows = k === "Concentrating" ? [["Spell", c.concSpell || ""]]
    : e ? [[t("init.eff.dur"), durWords(e, S.list)], [t("init.cinfo.rep"), saveWords(e)], [t("init.cinfo.from"), e.spell ? `${e.spell}${by ? ` · ${by.name}${by.cond.includes("Concentrating") ? ` ${t("init.cinfo.conc")}` : ""}` : ""}` : ""]] : [];
  openCond(btn, { lvl: exhLevel(c), ed: condEd(k, c, rulesOf(S)), rows }); // WP52
}

const apply = (fx) => { if (!fx) return; addWhy(fx.why); show(fx); if (fx.saves) fx.saves.forEach((x) => addSave(app.S, x)); };

/* ---------- monsters toevoegen ---------- */
/**
 * initmode: "each" (per monster rollen), "group" (één worp) of "fixed" (initiative = fixed, bijv. al aan tafel gerold).
 * hidden: meteen verborgen voor spelers (vóór de eerste render, dus vóór de eerste snapshot).
 * ed: "2024" = SRD 5.2-statblock (G1); ontbreekt = eigen > geïmporteerd > SRD 5.1.
 */
export function addMonsters(name, n, hpmode, initmode, silent, fixed = null, hidden = false, anon = false, ed) {
  const S = app.S, m = findMon(name, ed);
  if (!m) return;
  // doornummeren vanaf het hoogste bestaande nummer, zodat "Goblin 2" na verwijderen niet dubbel ontstaat
  const nums = S.list.filter((c) => c.ref === name).map((c) => { const x = c.name.match(/ (\d+)$/); return x ? +x[1] : 1; });
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  const set = initmode === "fixed" && Number.isFinite(fixed);
  const group = initmode === "group" ? d(20) : null;
  const grp = n > 1 && (group !== null || set) ? uid() : undefined; // groepsbeurt in de weergave (groupOf)
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = set ? undefined : group ?? d(20);
    let hp = m.hp;
    if (hpmode === "roll" && m.hd) { const x = rollExpr(m.hd); if (x) hp = Math.max(1, x.total); }
    const label = n > 1 || nums.length ? `${m.n} ${next + i}` : m.n;
    // WP48: monInit = d20 + Initiative uit een 2024-statblock (initBonus), anders + Dex; tiebreak blijft Dex
    const c = { id: uid(), name: label, kind: "monster", ref: m.n, ...edField(ed), ...(grp ? { grp } : {}), ...(hidden ? { hidden: true } : {}), ...(anon ? { anon: nextAnon(S.list) } : {}), ...monInit(m, r, fixed), ac: parseInt(m.ac) || 10, hp, max: hp, cond: [], ...legInfo(m), rc: rcInfo(m), casting: castInfo(m) };
    S.list.push(c); out.push(c);
    because(J([set ? M("log.w.initSet") : `d20 [${r}] ${sgn(initBo(c))}`, group !== null && n > 1 ? M("log.w.grp") : null, hpmode === "roll" && m.hd ? M("log.w.hpRoll", { hd: m.hd }) : null]), c.id);
  }
  if (!silent) {
    S.sample = false;
    wantSB(out[out.length - 1].id); // zijkolom toont het net toegevoegde monster
    toastHtml(out.map((c) => `${esc(c.name)}: ${c.roll === undefined ? "initiative" : `d20 [${c.roll}] ${sgn(initBo(c))} =`} <b>${c.init}</b>`).join("<br>") + (hidden ? `<br>${esc(t("init.mon.hidden"))}` : "") + (anon ? `<br>${esc(t("init.mon.anon"))}` : ""));
  }
}

/** Nieuwe lair-deelnemer (init 20, verliest gelijke stand); acties staan in app.lairs[key] */
export const newLair = (key, hidden = false) => ({ id: uid(), name: key, key, kind: "lair", init: 20, dex: -99, cond: [], last: null, ...(hidden ? { hidden: true } : {}) });
/** UI-toestand die na monsters wissen (ook encounter vervangen) niet meer klopt */
export const CLEAR_UI = { confirmReset: false, open: null, panel: null, edit: null, atk: null, aoe: null, la: null, sv: false,
  effWho: null, castPick: null, atkOpen: null, atkRx: null, atkAdv: null, atkPrev: null, svRetry: null, startAsk: false, oldGo: null };

/** Vult ontbrekende velden aan bij deelnemers uit oudere versies of imports */
export function normalize(c) {
  c.cond = c.cond || [];
  if (c.kind === "lair") { if (!c.key) c.key = c.name; return; }
  if (!c.ref) return;
  const m = findMon(c.ref, c.ed);
  if (!m && cleanEd(c.ed)) return; // G1: SRD 5.2 (nog) niet geladen: niets vastleggen, anders blijven legendary/recharge/spells leeg als de data later komt
  if (c.la === undefined && c.lr === undefined) Object.assign(c, legInfo(m));
  if (c.rc === undefined) c.rc = rcInfo(m);
  if (c.casting === undefined) c.casting = castInfo(m);
}

/**
 * Effect toepassen: duur, concentratie van de caster (start of koppelt), Shield = reaction. Eén undo-stap.
 * Concentratie-spell die de caster al heeft: doelen in dezelfde beurt horen bij dezelfde cast, een latere beurt is een
 * nieuwe cast en de oude doelen vervallen (met "Hoort erbij" in de melding). join = cast-sleutel om bij aan te sluiten.
 */
function applyEff(c, p, byId, join = null) {
  const S = app.S, out = R.fx();
  const d = ["inf", "lr"].includes(p.dur) ? null : makeDur(c, { dur: p.dur }, S.active);
  let by = null, cast = join || castKey(S.round, S.active), old = null, newCast = false;
  if (p.conc) {
    const caster = S.list.find((x) => x.id === byId);
    if (caster) {
      by = caster.id;
      if (caster.cond.includes("Concentrating") && caster.concSpell === p.n) { // Bless op 3 doelen: alleen koppelen
        if (!join) {
          const prev = S.list.flatMap((x) => (x.eff || []).filter((e) => e.by === by && e.spell === p.n && e.cast !== cast).map((e) => ({ x, e })));
          if (prev.length) {
            old = { cast: prev[0].e.cast || "", names: [...new Set(prev.map((o) => o.x.name))] };
            out.why.push(...endOtherCasts(S.list, by, p.n, cast, S.active).why, { t: M("rules.recast", { spell: p.n }), id: by }); // meldingen: één samenvatting hieronder
          }
        }
      } else { R.merge(out, R.startConc(caster, p.n)); newCast = true; }
    }
  }
  R.merge(out, addEffect(c, p, d, { lr: p.dur === "lr", by, spell: p.n, cast }));
  if (p.react) c.reaction = true;
  // RE1: slot afschrijven bij Shield (eigen reaction) en bij een nieuwe cast van een concentratie-spell; niet bij aansluiten
  // (Bless op het 2e en 3e doel) of een spell zonder bekende caster (Mage Armor, Aid: de DM gebruikt de pips op de kaart)
  const sc = p.lv && !join ? (p.react ? c : p.conc && by && (newCast || old) ? S.list.find((x) => x.id === by) : null) : null;
  const sl = sc ? autoSpend(sc, p.n, p.lv) : { why: [], txt: "" };
  out.why.push(...sl.why);
  addWhy(out.why);
  ui.effWho = null;
  if (!old) return { undoToast: [...out.msgs, ...(sl.txt ? [`${p.n}: ${sc.name} · ${sl.txt}.`] : [])].join(" ") };
  ui.effJoin = { id: c.id, p, by, cast: old.cast, step: stepNo() + 1 }; // alleen geldig zolang dit de laatste stap is (commit volgt in render)
  const caster = S.list.find((x) => x.id === by);
  return { undoToast: t(sl.txt ? "init.msg.recastSl" : "init.msg.recast", { spell: p.n, name: caster.name, sl: sl.txt, names: old.names }), extra: `<button class="tundo" id="toast-join">${esc(t("init.msg.join"))}</button> ` };
}

/* ---------- acties per deelnemer: (c, knop, rij-element) ---------- */
const row = {
  sb: (c) => showSB(c),
  sheet: (c) => showSheet(c),
  "atk-open"(c) { ui.atkOpen = c.id; },
  "atk-close"() { ui.atkOpen = null; },
  "atk-rx"(c) { ui.atkRx = ui.atkRx === c.id ? null : c.id; },
  /** AF9: één tik, met Ongedaan in de melding (undo is betrouwbaar, ook na herladen); "Uit party" houdt zijn bevestiging */
  del(c) {
    apply(removeCombatant(app.S, c.id)); ui.panel = null;
    return { undoToast: t("init.msg.removed", { name: c.kind === "lair" ? "Lair" : c.name }) };
  },
  open(c, b, li) {
    const isOpen = openId() === c.id;
    ui.open = isOpen ? "" : c.id;
    ui.fromDown = !isOpen && li && li.dataset.down ? c.id : null; // uit het blok "Neer" geopend: blijft daar staan
    ui.panel = null; ui.castPick = null; ui.edit = null; ui.effWho = null; ui.effCustom = false; ui.effForm = {}; ui.drOpen = null; ui.exhOpen = false; ui.rage = null; ui.dsPad = null;
    return "scroll";
  },
  panel(c, b) {
    ui.panel = ui.panel === b.dataset.p ? null : b.dataset.p; ui.effWho = null; ui.exhOpen = false; ui.rage = null;
    // keys: alleen wat het paneel toont, zodat Opslaan niets terugzet wat intussen direct op de kaart is aangepast
    ui.edit = ui.panel === "more" ? { id: c.id, ...edNow(c), dirty: false, keys: editKeys(c, mode() === "prep") } : null;
  },
  /* ---- bewerken (⋯) ---- */
  "ed-cancel"() { ui.edit = null; ui.panel = null; },
  "ed-save"(c) {
    const ed = ui.edit;
    if (!ed || ed.id !== c.id) return false;
    const name = String(ed.name).trim().slice(0, 120);
    if (!name) { toastBad(t("init.msg.noName")); return false; }
    const has = (k) => !ed.keys || ed.keys.includes(k);
    // SP5: eigen passives (leeg = uit de sheet); ongeldig = niets opslaan, melding
    const pas = has("pas") && c.kind === "pc" ? Object.fromEntries(PAS.map(([k]) => [k, String(ed[k] ?? "").trim()])) : null;
    if (pas && PAS.some(([k]) => pas[k] !== "" && pasVal(pas[k]) == null)) { toastBad(t("init.msg.pasRange")); return false; }
    c.name = name;
    if (pas) { const v = cleanPas(pas); if (v) c.pas = v; else delete c.pas; }
    const ac = parseInt(ed.ac);
    if (has("ac")) c.ac = Number.isFinite(ac) ? Math.max(0, Math.min(40, ac)) : 0;
    const mx = parseInt(ed.max), extra = (c.max || 0) - baseMax(c);
    if (has("max") && Number.isFinite(mx) && mx > 0 && mx !== baseMax(c)) R.setMax(c, mx + extra); // effecten (Aid) blijven bovenop
    const ini = parseInit(ed.init);
    because(M("log.w.edited"));
    if (has("init") && ini !== null && ini !== c.init) apply(setInit(app.S, c, ini)); // RE9: al geweest / ingeschoven
    ui.edit = null; ui.panel = null;
  },
  /* ---- effecten ---- */
  effp(c, b) {
    const i = +b.dataset.i, p0 = PRESETS[i];
    if (!p0) return false;
    if (p0.rage) { if (c.kind !== "pc") return false; ui.rage = { id: c.id, ...rageOpts(c) }; return; } // RE16: eerst de bevestigstap
    // editie per caster: zijn D&D Beyond-sheet, anders de instelling Spells (Barkskin 2024 = geen concentratie)
    const act = app.S.list.find((x) => x.id === app.S.active), p = presetsFor(edFor(act, p0.n, spellEd()))[i];
    if ((p0.conc || p.conc) && !act) { ui.effWho = { id: c.id, i }; return; } // geen beurt: vraag wie cast (de sheet bepaalt de editie)
    return applyEff(c, p, p.conc ? act.id : null);
  },
  effby(c, b) {
    const w = ui.effWho; if (!w || w.id !== c.id || !PRESETS[w.i]) return false;
    const by = app.S.list.find((x) => x.id === b.dataset.by), p = presetsFor(edFor(by, PRESETS[w.i].n, spellEd()))[w.i];
    return applyEff(c, p, p.conc ? b.dataset.by : null);
  },
  "effwho-no"() { ui.effWho = null; },
  effcustom() { ui.effCustom = !ui.effCustom; },
  "eff-add"(c) {
    const f = ui.effForm, k = f.k || "ac+";
    const { st, op, v } = effSpec(k, f.v);
    const spec = { n: String(f.n || "").trim() || "Effect", st, op, v, txt: f.txt || "" };
    if (st === "ac" && spec.op === "+" && !c.ac) { toastBad(t("init.msg.acFirst")); return false; }
    if (st && !spec.v) { toastBad(t("init.msg.effVal")); return false; }
    // RE11/RE16: deze namen horen bij Conditie → Exhaustion en de preset Rage (niveau, Frenzy, resource)
    if (/^(exhaustion|rage)$/i.test(spec.n)) { toastBad(t(/^e/i.test(spec.n) ? "init.msg.effExh" : "init.msg.effRage")); return false; }
    if (!st && !spec.txt && !f.n) { toastBad(t("init.msg.effName")); return false; }
    const by = f.by && app.S.list.some((x) => x.id === f.by) ? f.by : null;
    ui.effForm = {}; ui.effCustom = false;
    return applyEff(c, { ...spec, dur: f.dur || "inf", conc: !!by }, by);
  },
  effdel(c, b) { apply(removeEffect(c, b.dataset.e, M("rules.manual"), { active: app.S.active })); },
  /* ---- Rage (RE16): bevestigstap met Bear Totem / Frenzy (per speler onthouden op dit apparaat) ---- */
  "rage-opt"(c, b) { if (!ui.rage || ui.rage.id !== c.id) return false; ui.rage[b.dataset.k] = !ui.rage[b.dataset.k]; saveRageOpts(c, ui.rage); },
  "rage-no"() { ui.rage = null; },
  "rage-go"(c) {
    const o = ui.rage; if (!o || o.id !== c.id || rageOf(c)) return false; // loopt al: geen tweede resource
    ui.rage = null; ui.panel = null;
    because("Rage");
    const ed = rulesOf(app.S); // WP50: 2014 10 rondes, 2024 10 minuten; regels vast op de rage
    const out = startRage(c, makeDur(c, { dur: ed === "2024" ? "r100" : "r10" }, app.S.active), { bear: o.bear, frz: o.frz, ed });
    addWhy(out.why);
    return out.msgs.length ? { undoToast: out.msgs.join(" ") } : undefined;
  },
  /* ---- Exhaustion (RE11): rij met − en + in het Conditie-paneel ---- */
  "exh-open"() { ui.exhOpen = !ui.exhOpen; },
  exh(c, b) {
    const out = setExh(c, exhLevel(c) + +b.dataset.v, undefined, rulesOf(app.S));
    addWhy(out.why);
    if (exhLevel(c) === 6) return { undoToast: out.msgs.join(" ") }; // dood: zonder "Zeker?", met Ongedaan (zoals verwijderen)
  },
  "sheet-open"(c, b) { ui.sheet = { id: c.id, kind: b.dataset.kind, val: "", mode: 1, from: b.classList.contains("khp") ? "khp" : b.dataset.kind }; },
  react(c) { c.reaction = !c.reaction; },
  hide(c) { if (c.hidden) delete c.hidden; else c.hidden = true; },
  /* ---- resistances van een speler (SP2, in ⋯) ---- */
  "dr-open"(c) { ui.drOpen = ui.drOpen === c.id ? null : c.id; ui.drKind = "r"; },
  "dr-kind"(c, b) { if (DR_LBL[b.dataset.v]) ui.drKind = b.dataset.v; },
  "dr-t"(c, b) {
    const ty = b.dataset.t, k = ui.drKind;
    if (!DTYPES.includes(ty) || !DR_LBL[k]) return false;
    const was = drKind(c.dr, ty), dr = drToggle(c.dr, k, ty);
    if (dr) c.dr = dr; else delete c.dr;
    because(was === k ? M("log.w.drOff", { kind: M(DR_LBL[k]), type: ty }) : was ? M("log.w.drWas", { kind: M(DR_LBL[k]), type: ty, was: M(DR_LBL[was]) }) : M("log.w.dr", { kind: M(DR_LBL[k]), type: ty }), c.id);
  },
  anon(c) { if (c.anon) delete c.anon; else c.anon = nextAnon(app.S.list); },
  sur(c) { const r = toggleSurprise(c, app.S, rulesOf(app.S)); if (!r) return false; apply(r); },
  dropconc(c) { apply(R.dropConc(c, M("log.w.ended"))); },
  topty(c) { const ex = app.party.find((m) => m.name.toLowerCase() === c.name.toLowerCase()); c.pid = ex ? ex.pid : uid(); toast(t("init.msg.toParty", { name: c.name })); },
  "ds-roll": (c) => dsDone(c, d(20), true),
  /* RE15: eigen worp via het cijferpad; pas bij een volledige worp één undo-stap met melding + Ongedaan */
  "ds-own"(c) { ui.dsPad = ui.dsPad && ui.dsPad.id === c.id ? null : { id: c.id, v: "" }; renderFocus(c, ui.dsPad ? '[data-a="ds-k"]:not([disabled])' : '[data-a="ds-own"]'); return false; },
  "ds-k"(c, b) {
    const p = ui.dsPad; if (!p || p.id !== c.id) return false;
    const k = b.dataset.v;
    if (k === "back") p.v = p.v.slice(0, -1);
    else if (k !== "ok") p.v = (p.v + k).slice(0, 2);
    if (k !== "ok" && p.v.length < 2 && !(+p.v >= 3)) { renderFocus(c, `[data-a="ds-k"][data-v="${k}"]:not([disabled])`, '[data-a="ds-k"]:not([disabled])'); return false; }
    return dsDone(c, +p.v, false);
  },
  "ds-crit": (c) => { ui.dsPad = null; apply(R.critAtZero(c)); },
  "cast-reset"(c) {
    c.casting.slots.forEach((x) => (x.left = x.max));
    c.casting.daily.forEach((g) => g.items.forEach((x) => (x.left = x.max)));
    if (c.casting.pact) c.casting.pact.left = c.casting.pact.max;
    (c.res || []).forEach((x) => (x.left = x.max));
  },
  "lair-add"(c, b, li) {
    const n = li.querySelector('[data-f="la-n"]').value.trim(), tx = li.querySelector('[data-f="la-t"]').value.trim();
    if (!n || !tx) { toastBad(t("init.msg.lairFill")); return false; }
    app.lairs[c.key] = [...(app.lairs[c.key] || []), { n, t: tx }]; saveLairs();
  },
  "lair-del"(c, b) { app.lairs[c.key].splice(+b.dataset.i, 1); saveLairs(); },
  "lair-use"(c, b) { c.last = app.lairs[c.key][+b.dataset.i].n; },
};

/** AF10: na Toevoegen naar het naamveld voor de volgende speler, maar alleen met muis/toetsenbord (telefoon: geen toetsenbord dat opspringt) */
function nextPcFocus() { if (matchMedia("(hover:hover) and (pointer:fine)").matches) $("#pc-name").focus(); else $("#f-pc")?.closest(".sheet")?.focus?.({ preventScroll: true }); }
/** Na een UI-tik op de kaart: opnieuw tekenen en de focus terug (toetsenbord; op touch onschadelijk) */
function renderFocus(c, ...sels) {
  render();
  const li = cardEl(c.id);
  for (const s of sels) { const el = li && li.querySelector(s); if (el) { el.focus({ preventScroll: true }); return; } }
}
/** RE15: death save toepassen (gerold of getypt): één stap, melding met Ongedaan, focus blijft op de kaart */
function dsDone(c, r, byApp) {
  ui.dsPad = null;
  const f = R.dsResult(c, r, byApp);
  if (!f.why.length) { toastBad(t("init.msg.dsNone")); renderFocus(c, '[data-a="ds-own"]', ".khead"); return false; }
  addWhy(f.why);
  renderFocus(c, byApp ? '[data-a="ds-roll"]' : '[data-a="ds-own"]', ".khead");
  toastHtml(`${esc(dsToast(c, r))} ${undoBtn()}`);
  return false;
}
/** RE15: "Aria: 14, success (2/3)" / "nat 20, staat op met 1 HP" / "nat 1, twee failures (2/3)" */
function dsToast(c, r) {
  const name = c.name, d = c.ds || {};
  if (r === 20) return t("init.msg.ds20", { name });
  if (d.dead) return t("init.msg.dsDead", { name, r: r === 1 ? "nat 1" : r });
  if (d.stable) return t("init.msg.dsStable", { name, r });
  return r === 1 ? t("init.msg.ds1", { name, n: d.f }) : r >= 10 ? t("init.msg.dsOk", { name, r, n: d.s }) : t("init.msg.dsFail", { name, r, n: d.f });
}

/* ---------- schade-paneel (data-sk) ---------- */
function sheetKey(k, v) {
  const s = ui.sheet;
  if (!s) return;
  if (k === "close") { ui.sheet = null; return { back: s }; }
  if (k === "d") { if (s.val.length < 4) s.val = (s.val + v).replace(/^0+/, ""); return; }
  if (k === "back") { s.val = s.val.slice(0, -1); return; }
  if (k === "clear") { s.val = ""; return; }
  if (k === "kind") { s.kind = v; return; }
  if (k === "mode") { s.mode = +v; return; }
  if (k === "ufx") { s.ufx = !s.ufx; return; } // RE13: schadepaneel kent het type niet; de DM zegt het
  if (k === "parry") { // RE13: Parry van het monster: de aanval van de speler mist, reaction gebruikt
    const c = app.S.list.find((x) => x.id === s.id), n = c && c.ref ? parryOf(findMon(c.ref, c.ed)) : 0;
    if (!c || !n || !canParry(c, app.S.round)) return;
    because("Parry");
    apply(useParry(c, n));
    ui.sheet = null;
    return { back: s, undoToast: t("init.msg.parry", { name: c.name }) };
  }
  if (k === "apply") {
    const c = app.S.list.find((x) => x.id === s.id), n = parseInt(s.val) || 0;
    if (!c || !n) return;
    const was = c.hp;
    const f = s.kind === "dmg" ? R.applyDamage(c, n, s.mode, false, rulesOf(app.S)) : s.kind === "heal" ? R.heal(c, n) : R.giveTemp(c, n);
    apply(f);
    const uf = s.kind === "dmg" ? ufRoll(c, was, Math.floor(n * s.mode), s.ufx ? { radiant: true, why: t("init.uf.radOrCrit") } : {}) : "";
    const before = { dmg: `−${Math.floor(n * s.mode)}`, heal: `+${n}`, thp: `+${n} temp` }[s.kind];
    ui.sheet = null;
    return { back: s, undoToast: `${c.name} ${before} HP → ${c.hp}/${c.max}${c.temp ? ` (+${c.temp} temp)` : ""}${uf ? ` · ${uf}` : ""}${concNote(f)}` };
  }
}

/** Na een schadepaneel-toets: melding, en bij sluiten de focus terug naar wat het paneel opende (toetsenbord) */
function sheetDone(res) {
  if (!res) return;
  if (res.undoToast) toastHtml(`${esc(res.undoToast)} ${undoBtn()}`);
  const s = res.back;
  if (!s) return;
  const li = document.querySelector(`.c[data-id="${CSS.escape(s.id)}"]`);
  // HP-knop (GV1), anders de knop op de open kaart; monster intussen in het blok Neer: dat blok; anders de kop
  const el = li && li.querySelector(s.from === "khp" ? ".khp" : `.kbody [data-a="sheet-open"][data-kind="${s.from}"]`) || (!li && $("#down-tog")) || li?.querySelector(".khead");
  el?.focus({ preventScroll: true });
}

/** Klikken op bolletjes, condities en spell-keuzes (herkend aan data-attributen) */
function rowData(c, b) {
  const ds = b.dataset;
  const toggle = (o, i) => { o.left = i < o.left ? o.left - 1 : Math.min(o.max, o.left + 1); };
  if (ds.cond) {
    const k = ds.cond; c.cd = c.cd || {};
    if (c.cond.includes(k)) { c.cond = c.cond.filter((x) => x !== k); delete c.cd[k]; if (k === "Concentrating") c.concSpell = null; }
    else { c.cond = [...c.cond, k]; const e = makeDur(c, ui.condOpt[c.id] || {}, app.S.active); if (e) c.cd[k] = e; }
    return true;
  }
  if (ds.slot !== undefined || ds.daily !== undefined) {
    const o = ds.slot === "p" ? c.casting.pact : ds.slot !== undefined ? c.casting.slots[+ds.slot] : (([g, i]) => c.casting.daily[g].items[i])(ds.daily.split(".").map(Number));
    const spend = +ds.i < o.left;
    toggle(o, +ds.i);
    ui.castPick = null;
    if (spend && ds.slot !== undefined && pickList(c, o.lvl, spellEd()).some((x) => x.conc)) ui.castPick = { id: c.id, lvl: o.lvl, p: ds.slot === "p" };
    if (spend && ds.daily !== undefined && isConc(o.n, edFor(c, o.n, spellEd()))) apply(R.startConc(c, o.n.replace(/\(.*?\)/g, "").trim()));
    return true;
  }
  if (ds.pickspell !== undefined) { if (ds.conc) apply(R.startConc(c, ds.pickspell)); ui.castPick = null; return true; }
  if (ds.res !== undefined) {
    const o = c.res[+ds.res];
    if (ds.step) o.left = Math.max(0, Math.min(o.max, o.left + +ds.step)); else toggle(o, +ds.i);
    return true;
  }
  if (ds.rc !== undefined) { const r = c.rc[+ds.rc]; r.ready = !r.ready; return true; }
  if (ds.ds) { c.ds = c.ds || R.newDs(); const i = +ds.i; c.ds[ds.ds] = c.ds[ds.ds] === i + 1 ? i : i + 1; apply(R.checkDs(c)); return true; }
  if (ds.pip) { toggle(c[ds.pip], +ds.i); return true; }
  return false;
}

/** GV8: melding na Ongedaan/Opnieuw: wat er terugging (eerste logregel of de beurt), met de knop voor de andere kant op */
function stepToast(verb, entries) {
  closeToast(); // dubbeltik op ↶: niet samenvoegen met de vorige melding (anders twee keer id toast-redo)
  const { text, more } = stepText(entries, app.S, verb);
  const last = verb === "undo" && !canUndo() ? ` ${t("init.msg.lastStep")}` : "";
  const btn = (id, l) => `<button class="tundo" id="${id}">${esc(t(l))}</button>`;
  toastHtml(`${esc(text)}${more ? ` <span class="tmore">${esc(t("init.atk.more", { n: more }))}</span>` : ""}${esc(last)} ${verb === "redo" ? btn("toast-undo", "common.undo") : ""}${canRedo() ? btn("toast-redo", "common.redo") : ""}`);
}

/* ---------- algemene acties (op id) ---------- */
const global = {
  "toast-undo"() { closeToast(); return global.undo(); },
  /** Bless "nieuwe cast" was toch een extra doel: terugdraaien en bij de vorige cast aansluiten */
  "toast-join"() {
    const j = ui.effJoin; closeToast(); ui.effJoin = null;
    if (!j || stepNo() !== j.step || !undo()) return;
    const c = app.S.list.find((x) => x.id === j.id);
    if (c) { const r = applyEff(c, j.p, j.by, j.cast || "-"); toastHtml(`${esc(r.undoToast)} ${undoBtn()}`); }
  },
  /** Gefaalde monster-save: toch Legendary Resistance, of opnieuw met advantage (Magic Resistance tegen een spell) */
  "toast-svlr"() { svRetry((c, sid) => { if (!c.lr || c.lr.left < 1) return; c.lr.left--; because(M("rules.lrUsed"), c.id); svDone(c, sid, true, "legendary resistance", ""); }); },
  "toast-svadv"() { svRetry((c, sid) => svRoll(sid, true)); },
  undo() {
    const np = ui.addPid && ui.addPid.step === stepNo() ? ui.addPid.pid : null; ui.addPid = null; // AF9: net toegevoegd met vaste party
    const log0 = app.S.log;
    if (!undo()) return;
    if (np && !app.S.list.some((c) => c.pid === np)) { app.party = app.party.filter((m) => m.pid !== np); saveParty(); clearRedo(); } // syncParty maakte het lid; Ongedaan haalt het weg (Opnieuw zou het half terugzetten)
    ui.confirmReset = false; ui.startAsk = false; ui.oldGo = null; // GV7: geen hangende vraag of "oude wissen" na een stap terug
    stepToast("undo", stepEntries(log0, app.S.log));
  },
  /** GV8: Opnieuw, alleen in het geheugen (leeg na een nieuwe wijziging of herladen) */
  redo() {
    const log0 = app.S.log;
    if (!redoStep()) return false;
    ui.addPid = null; ui.confirmReset = false; ui.startAsk = false; ui.oldGo = null;
    stepToast("redo", stepEntries(app.S.log, log0));
  },
  "toast-redo"() { closeToast(); return global.redo(); },
  // na starten of stoppen volgt de modus weer het gevecht (ui.mode = null)
  start() {
    // GV7: monsters uit het vorige gevecht nog in de lijst? Eerst vragen (vóór het initiative-paneel, ook zonder spelers)
    if (!app.S.round && !ui.oldGo && oldMons(app.S).length) { ui.startAsk = true; render(); $("#old-start, #old-wipe")?.focus(); return false; }
    // spelers eerst hun initiative (paneel); vanuit het paneel komt start terug met initSkip
    if (!ui.initSkip && !app.S.round && initPcs(app.S.list).length) { ui.startAsk = false; openInit(); return false; }
    ui.initSkip = false; ui.startAsk = false;
    const pcs = initPcs(app.S.list).length, sur = ui.surMon && !pcs; ui.surMon = false; // RE5: met spelers beslist het paneel (dat zette setSurprise al)
    const ed = rulesOf(app.S), who = pcs ? ui.surWho || "none" : sur ? "mon" : "none"; ui.surWho = null; // WP51: 2024 zet geen sur, de keuze gaat zo mee
    const drop = ui.oldGo === "drop"; ui.oldGo = null;
    const gone = drop ? dropOld(app.S) : 0; // zelfde undo-stap als de start
    if (gone) because(M("log.w.oldGone", { n: gone }));
    if (sur) apply(setSurprise(app.S.list, "mon", ed)); // vóór startCombat: die zet de reaction van verrasten op gebruikt
    startFight(app.S, Date.now()); // GV2: duur en wie neer ging; oude samenvatting weg
    // GV5: onaangeroerde monsterworpen opnieuw (keuze in het paneel; zonder spelers de onthouden keuze), zelfde undo-stap;
    // !round is een vangnet (#start bestaat alleen vóór het gevecht)
    // WP51 (2024): verraste monsters rollen met disadvantage; bij Houden krijgt alleen hun bestaande worp een tweede d20
    const dis = ed === "2024" && who === "mon" ? (c) => surWho(c, who) : null, roll = initRoll() === "roll";
    const rr = !app.S.round && (roll || dis) ? rerollMonsters(app.S.list, Math.random, { dis, keep: !roll }) : null;
    apply(rr ? R.merge(rr, startCombat(app.S, Math.random, ed)) : startCombat(app.S, Math.random, ed)); ui.mode = null; rekeyEdit();
    armTour("f"); // OB1: tweede deel van de rondleiding bij de eerste keer Gevecht (alleen als deel f nog niet gezien is)
  },
  /** GV7: antwoorden op "Nog N monsters uit het vorige gevecht" boven Start */
  "old-start"() { ui.oldGo = "drop"; return global.start(); },
  /** RE5: Verrast zonder spelers (schakelaar naast Start) */
  "sur-mon"() { ui.surMon = !ui.surMon; render(); $("#sur-mon")?.focus(); return false; },
  "old-go"() { ui.oldGo = "keep"; return global.start(); },
  "old-no"() { ui.startAsk = false; ui.oldGo = null; render(); $("#start")?.focus(); return false; },
  /** Alleen oude monsters in de lijst: wissen en in Voorbereiden blijven */
  "old-wipe"() {
    ui.startAsk = false;
    because(M("log.w.oldWiped"));
    const n = dropOld(app.S);
    render();
    toastHtml(`${esc(t("init.msg.oldWiped", { n }))} ${undoBtn()}`);
    $("#start:not([disabled])")?.focus();
    return false;
  },
  next() { apply(step(app.S, 1)); ui.laPulse = true; },
  "down-tog"() { ui.downOpen = !ui.downOpen; },
  prev() { apply(step(app.S, -1)); },
  /** Gevecht afronden (GV2): samenvatting (paneel + logregel) en stoppen in één undo-stap */
  stop() {
    const r = app.S.round;
    clearToasts(); // vóór apply: effect-meldingen van stopCombat horen bij deze stap en voegen samen met de afrondmelding
    finishFight();
    apply(stopCombat(app.S)); ui.mode = null; rekeyEdit();
    // WP39 (HS18): telefoon: statblock dicht (lag achter het afrondpaneel); alleen de afrondmelding blijft staan
    if (phone()) closeSB();
    render();
    toastHtml(`${esc(t("init.msg.ended", { n: r }))} ${undoBtn()}`);
    $("#esheet .esheet")?.focus();
    return false;
  },
  fin() { return global.stop(); }, // knop "Gevecht afronden" in de beurtbalk als alle monsters neer zijn
  /** Volgende encounter: monsters en lair weg, spelers blijven met HP, slots en effecten (één undo-stap) */
  "reset-mons"() {
    const r = clearMonsters(app.S);
    apply(r);
    Object.assign(ui, CLEAR_UI, { mode: null });
    render();
    const what = [r.n && t("init.diff.mons", { n: r.n }), r.lairs && t("init.prep.lair")].filter(Boolean); // array: opsomming in de taal ("en"/"and")
    toastHtml(`${esc(t("init.prep.wiped", { what }))} ${undoBtn()}`);
    return false;
  },
  qadd() { ui.qadd = { q: "", sel: null, n: 1, fixOn: false, fix: "", hid: false, anon: false }; },
  aoe() {
    ui.sheet = null; ui.qadd = null; ui.atk = null;
    const act = app.S.list.find((x) => x.id === app.S.active && x.kind !== "lair");
    ui.aoe = { dmg: "", ...ui.aoeLast, t: {}, sp: null, by: act ? act.id : "", sdc: "", cf: {}, s: {} };
  },
  addlair() {
    const lm = app.S.list.find((x) => x.la);
    const key = lm ? "Lair: " + lm.ref : Object.keys(app.lairs)[0] || "Lair";
    const l = newLair(key), id = l.id;
    app.S.list.push(l);
    app.S.sample = false;
    ui.prep = null; ui.prepLast = null; ui.open = id; // kaart staat bovenaan (init 20) en is direct in te vullen
    render(); scrollToCard(id, true);
    return false;
  },
  "welcome-sample"() {
    if (rulesOf(app.S) !== "2024" || srd24Status() === "ok") { loadSample(); ui.welcome = false; armTour("p"); return; }
    // WP54: voorbeeld bij regels 2024 met SRD 5.2-monsters; eerst laden (B4: nooit terugvallen op 2014)
    const btn = $("#welcome-sample");
    if (btn) { btn.disabled = true; btn.textContent = t("init.enc.loading"); }
    loadSrd24().then((st) => {
      if (app.S.list.length || !ui.welcome) { render(); return; } // intussen iets anders gekozen
      if (rulesOf(app.S) === "2024" && st !== "ok") { render(); toastBad(t("init.welcome.fail24")); return; } // terug naar 2014 = gewoon voorbeeld
      loadSample(); ui.welcome = false; armTour("p"); render();
    });
    return false;
  },
  "welcome-empty"() { ui.welcome = false; armTour("p"); },
  // OB2: rondleiding opnieuw (Instellingen → Hulp): paneel dicht, het deel van de huidige modus start na de render
  "keys-open"() { closePrep(); openKeys(); return false; }, // GV10: Instellingen dicht, overzicht open
  "tour-again"() { stopPUpd(); ui.prep = null; ui.prepLast = null; ui.mode = null; restartTour(); },
  /** DA1: strook "Geen recente export" in Voorbereiden */
  "exp-now"() { exportFile().then((ok) => { if (ok) { render(); focusAfterStrip(); } }); return false; },
  "exp-later"() { snoozeNudge(); render(); focusAfterStrip(); toast(t("init.exp.snoozed", { n: SNOOZE_DAYS })); return false; },
  /** Voorbeeld weg: zelfde als "Alles wissen", met Ongedaan */
  "sample-clear"() {
    app.S = { list: [], round: 0, active: null, sample: false, ...rulesField(app.S) }; Object.assign(ui, { welcome: false, open: null, panel: null, mode: null, confirmReset: false });
    render();
    toastHtml(`${esc(t("init.prep.sampleGone"))} ${undoBtn()}`);
    return false;
  },
  reset() { ui.confirmReset = true; },
  "reset-no"() { ui.confirmReset = false; },
  "reset-yes"() { app.S = { list: [], round: 0, active: null, sample: false, ...rulesField(app.S) }; ui.confirmReset = false; ui.mode = null; },
  spelers() {
    if (!window.open("player/", "it-spelers")) toastBad(t("init.msg.popup")); // relatief: /{taal}/initiative/player/, zelfde taal (WP21)
    return false;
  },
  sbclose() { closeSB(); return false; },
  sbbig() { toggleBigSB(); return false; },
  sbpin() { togglePinSB(); return false; },
  sbfollow() { followTurn(); return false; },
};

const TOP = 64; // ruimte boven een kaart na scrollen (kop van de pagina, iets lucht)
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Onderrand van wat zichtbaar is: de dock, of een open statblock op de telefoon */
const visBottom = () => Math.min($("#dock").getBoundingClientRect().top, sbTop()) - 8;

/**
 * AF6/IN8/IN9: element zichtbaar maken boven de dock. Steekt het onder de dock uit, dan omhoog schuiven tot de onderkant
 * net boven de dock staat, maar nooit verder dan "bovenkant op TOP" (langer dan het scherm: de kop blijft in beeld).
 * Staat de bovenkant boven TOP, dan omlaag tot TOP. Anders niets.
 */
export function reveal(el, instant) {
  if (!el) return;
  const r = el.getBoundingClientRect(), bottom = visBottom();
  const dy = r.top < TOP ? r.top - TOP : r.bottom > bottom ? Math.min(r.bottom - bottom, r.top - TOP) : 0;
  if (Math.abs(dy) >= 1) window.scrollBy({ top: dy, behavior: instant || calm() ? "auto" : "smooth" });
}

const cardEl = (id) => id && document.querySelector(`.c[data-id="${CSS.escape(id)}"]`);

/** Naar een kaart: bovenaan (TOP), of met onlyIfHidden alleen zover dat hij boven de dock past */
export function scrollToCard(id, onlyIfHidden, instant) {
  const el = cardEl(id);
  if (!el) return;
  if (onlyIfHidden) { reveal(el, instant); return; }
  window.scrollBy({ top: el.getBoundingClientRect().top - TOP, behavior: calm() || instant ? "auto" : "smooth" });
}

/**
 * IN8: na openen blijft de kop van de aangetikte kaart op dezelfde schermplek (de kaart erboven klapte dicht), direct en
 * zonder animatie, zodat de volgende tik raakt wat er stond. Daarna de open kaart boven de dock in beeld (reveal).
 */
function keepCard(id, y0) {
  const el = cardEl(id);
  if (!el) return;
  if (y0 != null) { const dy = el.getBoundingClientRect().top - y0; if (Math.abs(dy) >= 1) window.scrollBy({ top: dy, behavior: "auto" }); }
  if (el.classList.contains("open")) reveal(el);
}

/**
 * Voorbeeld-encounter: twee spelers (level 3, zodat de moeilijkheid meteen een oordeel geeft), twee Goblins en een
 * Hobgoblin (één undo-stap). WP54: bij regels 2024 SRD 5.2 (Goblin Warrior, Hobgoblin Warrior, ed "2024"; moet geladen zijn).
 */
export function loadSample() {
  app.S.list.push(
    { id: uid(), name: t("init.sample.pc1"), kind: "pc", race: "Elf", lvl: 3, init: 17, dex: 3, ac: 15, hp: 24, max: 24, cond: [] },
    { id: uid(), name: t("init.sample.pc2"), kind: "pc", race: "Dwarf", lvl: 3, init: 9, dex: 0, ac: 18, hp: 31, max: 31, cond: [] },
  );
  const ed = rulesOf(app.S) === "2024" ? "2024" : undefined;
  addMonsters(ed ? "Goblin Warrior" : "Goblin", 2, "avg", "each", true, null, false, false, ed);
  addMonsters(ed ? "Hobgoblin Warrior" : "Hobgoblin", 1, "avg", "each", true, null, false, false, ed);
  app.S.sample = true;
}

/** Paneel in Voorbereiden openen of wisselen (Monster/Speler/Party/Instellingen); andere panelen gaan dicht */
function openPrep(k) {
  const was = ui.prep;
  if (k !== "party" || was !== "party") stopPUpd(); // heropenen begint schoon
  Object.assign(ui, { prep: k, sheet: null, qadd: null, aoe: null, atk: null, la: null, sv: false, confirmReset: false });
  if (!was) ui.prepLast = null;
  render();
  if (k === "mon" && was !== "mon") { // eigen monsters van elders staan er ook in; aantal en Invullen beginnen schoon (zoals snel toevoegen)
    Object.assign(ui.monAdd, { n: 1, fixOn: false, fix: "" });
    bindForms.renderMonList();
  }
  // focus in de dialog, niet op een invoerveld: dat zou op de telefoon meteen het toetsenbord openen
  if (!was) $("#psheet .psheet").focus(); else $("#psheet .psheet").scrollTop = 0;
  if (k === "pc") showMatch(); // party of tafel kan intussen veranderd zijn
  if (k === "data" && was !== "data") openSettings(); // AF5: sectie waarvoor de DM komt (kamer kwijt, export nodig) open
}

/** Paneel dicht: focus terug op de knop, en wat er net bijkwam in beeld */
function closePrep() {
  const k = ui.prep === "custom" || ui.prep === "enc" ? "mon" : ui.prep, last = ui.prepLast;
  stopPUpd();
  ui.prep = null; ui.prepLast = null;
  render();
  $(`#dock [data-prep="${k}"]`)?.focus({ preventScroll: true });
  if (last) scrollToCard(last, true);
}

/** Monsters wissen vanuit de samenvatting (zelfde als Encounter wissen → Monsters wissen) */
export const resetMons = () => global["reset-mons"]();

export function onClick(e) {
  // een veld op de kaart (Voorbereiden) eerst vastleggen: blur stuurt change synchroon, vóór de render van deze tik
  const pf = document.activeElement;
  // (levelvelden in het Encounters-paneel doet dat paneel zelf: zijn klik komt eerder en zet soms net de focus)
  if (pf && pf.dataset && (pf.dataset.pf || ("dlvl" in pf.dataset && !pf.closest("#enc-panel"))) && !pf.contains(e.target)) pf.blur();
  if (spellInfoClick(e)) return; // spell-uitleg: tikbare naam of het paneel sluiten
  if (condSheetClick(e)) return; // conditie-uitleg (RE10): het paneel sluiten
  const ci = e.target.closest("button[data-cinfo]");
  if (ci) { openCondFor(ci); return; }
  if (e.target.closest("[data-impw]")) { // AF10: import vanaf de welkomstkaart; de bevestiging staat in Instellingen → Opslag
    openPrep("data");
    const sec = document.querySelector('.setsec[data-sec="store"]'); if (sec) sec.open = true;
    $("#imp-backup").click(); // nog binnen de tik: anders blokkeert de browser de bestandskiezer
    return;
  }
  const pick = e.target.closest("[data-file]"); // eigen knop voor een verborgen bestandskiezer (geen Engelse "Choose File")
  if (pick) { document.getElementById(pick.dataset.file)?.click(); return; }
  const sk = e.target.closest("[data-sk]");
  if (sk) {
    const res = sheetKey(sk.dataset.sk, sk.dataset.v);
    render();
    if (ui.sheet && e.detail === 0) $("#sheet .sheet")?.focus({ preventScroll: true }); // toetsenbord: focus blijft in het opnieuw getekende paneel
    sheetDone(res);
    return;
  }
  if (e.target.closest('.dim[data-lsh="close"]')) { closeLa(); return; } // achtergrond van het legendary-paneel
  if (e.target.closest('.dim[data-prep="close"]')) { closePrep(); return; } // achtergrond van het Voorbereiden-paneel
  if (e.target.closest(".dim[data-svsheet]")) { ui.sv = false; render(); $("[data-svsheet]")?.focus(); return; } // achtergrond van het saves-paneel
  const b = e.target.closest("button");
  if (!b) return;
  if (b.id === "logopen") { openLogSheet(); return; }
  if (b.dataset.roll) {
    const lab = b.dataset.label || b.closest(".entry")?.querySelector("i")?.textContent.replace(/\.$/, "");
    return doRoll(b.dataset.roll, lab, !!b.dataset.hit);
  }
  if (b.dataset.dmg) return doDmgRoll(b.dataset.dmg, b.dataset.label);
  if (b.dataset.aoe) return openActAoe(b.dataset.cid, b.dataset.aoe);
  if (b.dataset.atk) return openAtk(b.dataset.cid, b.dataset.atk, b.dataset.label, b.dataset.laI, b);
  if (b.dataset.setmode) {
    ui.mode = b.dataset.setmode; ui.confirmReset = false;
    rekeyEdit();
    render();
    if (mode() === "fight") scrollToCard(app.S.active); else window.scrollTo({ top: 0 }); // terug naar het gevecht: naar wie aan de beurt is
    return;
  }
  if (b.dataset.prep) { if (b.dataset.prep === "close") closePrep(); else openPrep(b.dataset.prep); return; }
  if (b.dataset.svroll) { svRoll(b.dataset.svroll); return; }
  if (b.dataset.rgend) { // RE16: "Rage loopt door?" → Voorbij
    const c = app.S.list.find((x) => x.id === b.dataset.rgend), e = c && rageOf(c);
    if (!e) return;
    because(M("log.w.rageOver"));
    const out = removeEffect(c, e.id, M("rules.rageNoDmg"), { active: app.S.active });
    addWhy(out.why); render();
    toastHtml(`${esc(out.msgs.join(" "))} ${undoBtn()}`);
    return;
  }
  if (b.dataset.svok) { const s = (app.S.saves || []).find((x) => x.sid === b.dataset.svok), c = s && app.S.list.find((x) => x.id === s.id); if (c) svDone(c, s.sid, b.dataset.v === "1", "", ""); return; }
  if (b.dataset.svrollall) { svRollAll(); return; }
  if (b.dataset.svsheet) { ui.sv = b.dataset.svsheet === "1"; if (ui.sv) { ui.sheet = null; ui.qadd = null; ui.aoe = null; ui.la = null; ui.atk = null; } render(); if (ui.sv) $("#ssheet .ssheet")?.focus(); else $("[data-svsheet]")?.focus(); return; }
  if (b.dataset.la) { openLa(b.dataset.la); return; }
  if (b.dataset.lsh === "close") { closeLa(); return; }
  if (b.dataset.lause) { laUse(b.dataset.lause, +b.dataset.i); return; }
  if (b.id && global[b.id]) {
    if (global[b.id]() === false) return;
    const turnish = ["start", "next", "prev", "old-start", "old-go"].includes(b.id); // old-*: Start na de GV7-vraag
    if (turnish) {
      // een niet-opgeslagen bewerking blijft open staan; anders volgt de open kaart de beurt
      if (ui.edit && ui.edit.dirty) { ui.open = ui.edit.id; rekeyEdit(); } else { ui.open = null; ui.panel = null; ui.edit = null; }
      ui.fromDown = null;
      ui.castPick = null; ui.effWho = null; ui.dsPad = null; ui.atkOpen = null; ui.atkRx = null; ui.atkAdv = null; ui.atk = null;
    }
    render();
    ui.laPulse = false; // alleen de render direct na Volgende laat de legendary-knoppen oplichten
    if (turnish) scrollToCard(app.S.active);
    // focus in de dialog, maar niet op het zoekveld: dat zou op de telefoon meteen het toetsenbord openen
    if (b.id === "qadd") $("#qsheet .qsheet").focus();
    if (b.id === "aoe") (ui.aoe && ui.aoe.tab === "spell" ? $("#asheet .asheet") : $("#a-dmg"))?.focus();
    return;
  }
  const li = b.closest(".c");
  if (!li) return;
  const c = app.S.list.find((x) => x.id === li.dataset.id);
  if (!c) return;
  const fn = row[b.dataset.a];
  const y0 = fn === row.open ? li.getBoundingClientRect().top : null; // IN8: schermplek van de aangetikte kaart
  const pnl = fn === row.panel ? b.dataset.p : null;
  let res = fn ? fn(c, b, li) : rowData(c, b);
  if (res === false) return;
  if (fn === row.sb || fn === row.sheet) return;
  render();
  if (fn === row["sheet-open"]) $("#sheet .sheet")?.focus({ preventScroll: true }); // cijfers en Enter werken via onKey
  if (res === "scroll") keepCard(c.id, y0);
  if (pnl && ui.panel === pnl) reveal(cardEl(c.id)?.querySelector(".kpanel")); // AF6: paneel niet achter de dock
  if (res && res.undoToast) toastHtml(`${esc(res.undoToast)} ${res.extra || ""}${undoBtn()}`);
}

export function onChange(e) {
  const t = e.target, f = t.dataset.f;
  if ("dlvl" in t.dataset) { if (!saveLevel(t.dataset, t.value.trim())) t.value = ""; return; } // level in de uitleg bij de moeilijkheid
  const li = t.closest(".c");
  if (["cdur", "cab", "cdc"].includes(f)) {
    const o = (ui.condOpt[li.dataset.id] = ui.condOpt[li.dataset.id] || {});
    o[{ cdur: "dur", cab: "ab", cdc: "dc" }[f]] = t.value;
    return;
  }
  const c = li && app.S.list.find((x) => x.id === li.dataset.id);
  if (!c) return;
  if (f === "lairkey") { c.key = c.name = t.value; c.last = null; render(); }
  // concepten: niet renderen (dan verspringt de focus), alleen het voorbeeld bijwerken
  if (f && f.startsWith("ed-") && ui.edit && ui.edit.id === c.id) {
    ui.edit[f.slice(3)] = t.value; ui.edit.dirty = true;
    const pv = li.querySelector(".edprev"); if (pv) pv.innerHTML = editPreview(c);
  }
  if (f && f.startsWith("ef-")) ui.effForm[f.slice(3)] = t.value;
  if (t.dataset.pf) prepField(c, t);
}

/**
 * Open ⋯-concept na een moduswissel (✎, Terug, Start): de velden van de nieuwe modus. Wat erbij komt, vers uit de
 * deelnemer (kan intussen op de kaart veranderd zijn); wat al in het concept stond, blijft.
 */
function rekeyEdit() {
  const ed = ui.edit, c = ed && app.S.list.find((x) => x.id === ed.id);
  if (!c) return;
  const keys = editKeys(c, mode() === "prep"), now = edNow(c);
  for (const k of keys) if (!(ed.keys || []).includes(k)) { if (k === "pas") for (const [p] of PAS) ed[p] = now[p]; else ed[k] = now[k]; }
  ed.keys = keys;
}

/**
 * Level invullen (kaartveld in Voorbereiden of de uitleg bij de moeilijkheid, VB1). Partylid (via pid of de pid van de
 * deelnemer) → in de party, zonder undo-stap (hoort niet bij de encounter, zoals in het Party-paneel); anders bij de
 * speler zelf met een undo-stap. Leeg = level weg. Geen render (zie prepField). → false bij ongeldige invoer (melding gegeven).
 */
export function saveLevel({ cid, pid }, raw) {
  const c = cid && app.S.list.find((x) => x.id === cid), p = pid || (c && c.pid);
  const m = p && app.party.find((x) => x.pid === p);
  if (!c && !m) return true; // intussen weg
  const v = cleanLvl(raw);
  if (raw !== "" && !v) { toastBad(t("init.prep.errLvl")); return false; }
  if (m) { if ((m.lvl ?? null) !== v) { m.lvl = v; saveParty(); } return true; }
  if (c && (c.lvl ?? null) !== v) { c.lvl = v ?? undefined; because("level", c.id); commit(); }
  return true;
}

/**
 * Kaart in Voorbereiden (IN2): een veld slaat op zodra het de focus verliest. Direct vastleggen (commit: undo-stap,
 * logboek, opslag) maar niet renderen: dan zou de tik op het volgende veld of een knop verloren gaan. main.js
 * rendert na het verlaten van de velden (focusout). Ongeldig: oude waarde terug en een melding.
 */
function prepField(c, inp) {
  const k = inp.dataset.pf, raw = inp.value.trim();
  const back = (key) => { toastBad(t(key)); inp.value = { init: c.init, max: baseMax(c) || "", hp: c.hp, ac: c.ac || "" }[k] ?? inp.value; };
  if (k === "lvl") { if (!saveLevel({ cid: c.id }, raw)) { const m = c.pid && app.party.find((x) => x.pid === c.pid); inp.value = (m ? m.lvl : c.lvl) ?? ""; } return; }
  const n = parseInt(raw);
  if (k === "init") {
    const v = parseInit(raw);
    if (v === null) return back("init.prep.errInit");
    if (v === c.init) return;
    because(M("log.w.prep"), c.id); apply(setInit(app.S, c, v)); // RE9: tijdens een gevecht
  } else if (k === "max") {
    if (!(n > 0)) return back("init.prep.errMax");
    if (n === baseMax(c)) return;
    R.setMax(c, n + ((c.max || 0) - baseMax(c))); because(M("log.w.prep"), c.id); // effecten (Aid) blijven bovenop
  } else if (k === "hp") {
    if (!Number.isFinite(n) || n < 0) return back("init.prep.errHp");
    if (n === c.hp) return;
    const fx = R.setHp(c, n); because(M("log.w.prepHp"), c.id); apply(fx);
    if (c.hp !== n) inp.value = c.hp; // begrensd op max, of dood
  } else if (k === "ac") {
    if (raw !== "" && !(n >= 0 && n <= 40)) return back("init.prep.errAc");
    const v = raw === "" ? 0 : n;
    if (v === (c.ac || 0)) return;
    c.ac = v; because(M("log.w.prep"), c.id);
  } else return;
  commit();
}

export function onKey(e) {
  if (e.key === "Enter" && e.target.dataset && e.target.dataset.pf) { e.preventDefault(); e.target.blur(); return; } // veld op de kaart: klaar = opslaan
  if (spellOpen()) { if (e.key === "Escape") { e.preventDefault(); if (!spellEsc()) closeSpell(); } return; } // ligt boven alle andere panelen: toetsen niet naar het cijferpad eronder
  if (condOpen()) { if (e.key === "Escape") { e.preventDefault(); closeCond(); } return; } // conditie-uitleg (RE10): idem
  if (keysOpen()) { if (e.key === "Escape" || e.key === "?") { e.preventDefault(); closeKeys(); } return; } // overzicht sneltoetsen (GV10)
  if (ui.end && e.key === "Escape") { e.preventDefault(); closeEnd(); return; }
  if (ui.logSheet && e.key === "Escape") { e.preventDefault(); closeLogSheet(); return; }
  if (ui.prep && e.key === "Escape") { e.preventDefault(); closePrep(); return; }
  if (ui.qadd && e.key === "Escape") { e.preventDefault(); closeQadd(); return; }
  if (ui.aoe && e.key === "Escape") { e.preventDefault(); closeAoe(); return; }
  if (ui.atk && e.key === "Escape") { e.preventDefault(); closeAtk(); return; }
  if (ui.initDraft && !e.ctrlKey && !e.metaKey) {
    // Enter/spatie op een knop in het paneel (Rol, Start, …) doet wat die knop doet
    const onBtn = e.target.closest?.("#isheet button");
    const k = /^\d$/.test(e.key) ? ["d", e.key] : e.key === "Backspace" ? ["back"] : e.key === "Escape" ? ["close"] : e.key === "Enter" && !onBtn ? ["enter"] : null;
    if (k) { e.preventDefault(); initKey(...k); }
    return;
  }
  if (ui.la && e.key === "Escape") { e.preventDefault(); closeLa(); return; }
  if (ui.sv && e.key === "Escape") { e.preventDefault(); ui.sv = false; paintSv(); return; }
  if (ui.startAsk && e.key === "Escape") { e.preventDefault(); global["old-no"](); return; } // GV7: vraag boven Start
  const typing = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable;
  const kz = e.key.toLowerCase();
  // ⌘Z/Ctrl+Z = Ongedaan; ⌘⇧Z/Ctrl+Shift+Z/Ctrl+Y = Opnieuw (GV8: Shift deed eerst nóg een undo)
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !typing && (kz === "z" || (kz === "y" && e.ctrlKey && !e.shiftKey && !MAC))) {
    e.preventDefault();
    if (e.repeat) return;
    const fwd = kz === "y" || e.shiftKey;
    if (fwd ? !canRedo() : !canUndo()) return;
    ui.qadd = null; ui.aoe = null; ui.atk = null; ui.initDraft = null;
    if (fwd) global.redo(); else global.undo();
    render(); return;
  }
  if (e.key === "Escape" && !ui.sheet && mapOpen()) { e.preventDefault(); if (!fogEsc()) closeMap(); return; } // WP70: kaartviewer (geen paneel); WP73: eerst de fogmodus
  if (keysKey(e, typing)) return; // GV10: "?" = overzicht, N/spatie = Volgende, Shift+N = Vorige
  if (ui.sheet && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) {
    const k = /^\d$/.test(e.key) ? ["d", e.key] : e.key === "Backspace" ? ["back"] : e.key === "Escape" ? ["close"] : e.key === "Enter" && !e.target.closest?.("#sheet button") ? ["apply"] : null;
    if (k) { e.preventDefault(); const res = sheetKey(...k); render(); if (ui.sheet) $("#sheet .sheet")?.focus({ preventScroll: true }); sheetDone(res); }
  }
}

export function onToggle(e) {
  const t = e.target;
  if (t.matches && t.matches("details[data-cast]")) { const id = t.closest(".c")?.dataset.id; if (id) t.open ? ui.openCast.add(id) : ui.openCast.delete(id); }
  if (t.id === "logbox" && ui.logOpen !== t.open) { ui.logOpen = t.open; paintLog(); }
}

/* ---------- formulieren: speler, monster, eigen monster ---------- */
// UI-toestand van het spelersformulier (geen data: hoort niet in undo/opslag)
let pendingSheet = null, pendingCheck = null, pendingImg = null, pendingDdb = null, pendingNew = false, ddbBusy = null, pdfSeq = 0, selMon = "Goblin";

/* ---------- + Speler: init-bonus (stepper, AF15), foutregels (SP4), vaste party onthouden (AF9) ---------- */
const BON = [-5, 15];
let pcBonus = 0;
/** "+2", "0", "−1" (echt minteken) */
export const fmtBonus = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0");
/** Stepper zetten; een waarde uit een sheet buiten het bereik blijft staan (alleen de knoppen gaan uit) */
function setBonus(v) {
  pcBonus = Number.isFinite(v) ? Math.trunc(v) : 0;
  $("#pc-bonv").textContent = fmtBonus(pcBonus);
  const [lo, hi] = $("#pc-bon").querySelectorAll("button");
  const f = document.activeElement;
  lo.disabled = pcBonus <= BON[0]; hi.disabled = pcBonus >= BON[1];
  if (f && f.disabled && (f === lo || f === hi)) (f === lo ? hi : lo).focus(); // focus niet kwijt aan een knop die uitgaat
}
function stepBonus(dv) {
  const v = Math.min(BON[1], Math.max(BON[0], pcBonus + dv));
  if (v !== pcBonus) setBonus(v);
}
const PTY_KEY = "it-pc-party";
const ptyPref = () => { try { return localStorage.getItem(PTY_KEY) !== "0"; } catch { return true; } };
const savePty = (on) => { try { localStorage.setItem(PTY_KEY, on ? "1" : "0"); } catch { /* privémodus: niet onthouden */ } };
/** Initiative-veld alleen tijdens een gevecht (daarna opent het paneel bij Start niet meer), niet bij Bijwerken van wie al aan tafel zit */
const needInit = (plan) => !!app.S.round && plan !== "upd" && plan !== "none";
const FERR = ["name", "init", "ac", "hp", "lvl"];
function setErr(k, msg) {
  const e = $(`#pc-${k}-e`), inp = $(`#pc-${k}`);
  e.hidden = !msg; e.textContent = msg || "";
  if (msg) inp.setAttribute("aria-invalid", "true"); else inp.removeAttribute("aria-invalid");
}
const clearErrs = () => FERR.forEach((k) => setErr(k, ""));
/** Leeg of een geheel getal in [lo, hi] */
const inRange = (v, lo, hi) => { const t = String(v).trim(); if (t === "") return true; const n = Number(t); return Number.isInteger(n) && n >= lo && n <= hi; };
/** SP4: eigen controle i.p.v. de browser-bubbel ("Please fill out this field"). Eerste fout veld krijgt de focus. */
function pcValid(plan) {
  const errs = [];
  if (!$("#pc-name").value.trim()) errs.push(["name", t("init.pc.errName")]);
  if (needInit(plan) && parseInit($("#pc-init").value) === null) errs.push(["init", t("init.pc.errInit")]);
  if (!inRange($("#pc-ac").value, 1, 40)) errs.push(["ac", t("init.pc.errAc")]); // zelfde grens als de sheet-parser
  if (!inRange($("#pc-hp").value, 1, 999)) errs.push(["hp", t("init.pc.errHp")]);
  if (!inRange($("#pc-lvl").value, 1, 20)) errs.push(["lvl", t("init.pc.errLvl")]);
  $("#pc-initl").hidden = !needInit(plan); // nooit een fout op een verborgen veld
  clearErrs();
  for (const [k, m] of errs) setErr(k, m);
  if (errs.length) { const f = $(`#pc-${errs[0][0]}`); f.focus(); f.scrollIntoView({ block: "center" }); }
  return !errs.length;
}
/** AF9: "Sanne toegevoegd (4 spelers aan tafel)." */
const pcCount = () => { const n = app.S.list.filter((c) => c.kind === "pc" && !(c.ds && c.ds.dead)).length; return t("init.pc.count", { n }); };

/** Bijwerken toepassen: partylid én wie aan tafel zit (zelfde pid). Eén undo-stap voor de tafel; geeft de wijzigingen terug */
function updMember(m, f) {
  for (const c of app.S.list) if (c.pid === m.pid) mergeSheet(c, structuredClone(f));
  const ch = mergeSheet(m, structuredClone(f));
  because(M("log.w.ddb", { name: f.name }));
  saveParty();
  return ch;
}

/** Onzekere AC/HP markeren (verdwijnt zodra de DM het veld aanpast) */
function setCheck(check) {
  const why = [];
  for (const [k, lbl] of [["ac", "AC"], ["hp", "max HP"]]) {
    const r = check ? check[k] : [];
    $("#pc-" + k).closest("label").classList.toggle("warn", r.length > 0);
    if (r.length) why.push(t("init.pc.checkWhy", { what: lbl, why: r.join(", ") }));
  }
  $("#pc-check").hidden = !why.length;
  $("#pc-check").textContent = why.join(" ");
}

function clearPending() {
  pendingSheet = pendingCheck = pendingImg = pendingDdb = null; pendingNew = false;
  setCheck(null); showMatch();
}

/** Sheet (uit PDF of link) in het formulier zetten */
function fillSheet(h, img) {
  if ($("#pc-name").value.trim().toLowerCase() !== h.name.toLowerCase()) $("#pc-init").value = ""; // ander character: oude worp weg
  pendingSheet = h; pendingImg = cleanImg(img);
  $("#pc-name").value = h.name; $("#pc-ac").value = h.ac || ""; $("#pc-hp").value = h.max || ""; setBonus(h.initBonus ?? h.dex ?? 0);
  $("#pc-bonh").hidden = true; // Dex voor gelijke stand komt uit de sheet
  clearErrs();
  $("#pc-race").value = RACE_OPTS.find((r) => raceKey(r) === raceKey(h.race)) || "";
  const sl = h.casting && h.casting.slots.length ? h.casting.slots.map((x) => `${t(`init.pc.sl${x.lvl}`)}: ${x.max}`).join(", ") : t("init.pc.slotsNone");
  $("#pc-sheetinfo").innerHTML = `${tb("init.pc.loaded", { what: [h.race, h.cls].filter(Boolean).join(", ") }, h.name)}${pendingImg ? `${esc(t("init.pc.withImg"))} <img class="pv" src="${esc(pendingImg)}" alt="">` : ""}. Spell slots: ${esc(sl)}${h.res.length ? `. Resources: ${esc(h.res.map((r) => r.n + " " + r.max).join(", "))}` : ""}.${app.S.round ? ` ${esc(t("init.pc.errInit"))}` : ""}`;
}

/** Wat Bijwerken overneemt: formulierwaarden (de DM kan AC/HP gecorrigeerd hebben) + sheet */
function formUpdate() {
  const sh = pendingSheet;
  return {
    name: $("#pc-name").value.trim() || sh.name, race: pickRace($("#pc-race").value, sh.race),
    ac: parseInt($("#pc-ac").value) || 0, max: parseInt($("#pc-hp").value) || 0, dex: sh.dex ?? pcBonus,
    initBonus: pcBonus, sheet: sh, // init-bonus uit de stepper: de DM kan hem aangepast hebben (Alert, homebrew) ddbId: pendingDdb || undefined, img: pendingImg, // PDF: geen id, het bestaande blijft casting: sh.casting || null, res: sh.res || [],
  };
}

/** Welk partylid bedoelt het formulier? Alleen met "Ook opslaan in vaste party" aan en niet na "Als nieuwe speler" (SP3) */
function curMatch() {
  if (pendingNew || !$("#pc-party").checked) return null;
  return findMember(app.party, pendingDdb, $("#pc-name").value.trim() || (pendingSheet && pendingSheet.name));
}

/**
 * Staat deze speler al in de party? Dan een vak dat zegt wat Toevoegen doet, en een knop met die naam (SP3):
 * met sheet = bijwerken (schade en verbruik blijven) en aan tafel; alleen een naam = aan tafel met de bewaarde stand;
 * zit hij al aan tafel = nooit een tweede deelnemer.
 */
function showMatch() {
  const m = curMatch(), btn = $("#pc-add");
  const here = !!m && app.S.list.some((c) => c.pid === m.pid), plan = seatPlan(!!m, here, !!pendingSheet);
  btn.disabled = plan === "none";
  btn.textContent = t(PLAN_LBL[plan]);
  $("#pc-initl").hidden = !needInit(plan); // SP4: buiten een gevecht komt initiative bij Start
  $("#pc-bon").closest(".lab").hidden = plan === "seat"; // partylid zonder sheet: bewaarde stand, de stepper doet dan niets
  if ($("#pc-initl").hidden) setErr("init", "");
  if (!m) { $("#pc-match").innerHTML = dupHint(); return; }
  let txt;
  if (pendingSheet) {
    const ck = pendingCheck || { ac: [], hp: [] };
    const ch = mergeSheet(structuredClone(m), structuredClone(formUpdate())) // alleen voorproefje, op een kopie
      .map((x) => (/^AC /.test(x) && ck.ac.length) || (/^max HP /.test(x) && ck.hp.length) ? `${x} (${t("init.pc.check")})` : x); // regels uit mergeSheet (WP27)
    const what = ch.length ? ch.join(" · ") : t("init.pc.noChange");
    txt = tb(here ? "init.pc.mUpdHere" : "init.pc.mUpd", { what }, m.name);
  } else {
    txt = here ? tb("init.pc.mHere", {}, m.name) : tb("init.pc.mSeat", { hp: m.max ? ` (${n0(m.hp)}/${n0(m.max)} HP)` : "", name: m.name }, m.name);
  }
  $("#pc-match").innerHTML = `<div class="confirmbox"><p class="hint" style="margin:0">${txt}</p>
    <div class="bar"><button type="button" class="btn tap" id="pc-new">${esc(t("init.pc.asNew"))}</button></div></div>`;
}

const PLAN_LBL = { add: "init.pc.add", upd: "init.pc.planUpd", none: "init.pc.planNone", updSeat: "init.pc.planUpdSeat", seat: "init.pc.planSeat" }; // sleutels
/** Meerdere partyleden met deze naam: findMember kiest er geen, dan wordt het een nieuw lid; zeg dat */
function dupHint() {
  if (pendingNew || !$("#pc-party").checked) return "";
  const n = ($("#pc-name").value.trim() || (pendingSheet && pendingSheet.name) || "").toLowerCase();
  if (!n || app.party.filter((x) => String(x.name || "").trim().toLowerCase() === n).length < 2) return "";
  return `<p class="hint">${esc(t("init.pc.dup", { name: $("#pc-name").value.trim() }))}</p>`;
}

/** Partylid aan tafel zetten met de bewaarde stand (HP, slots, death saves, lange effecten); gedeeld met "Party aan tafel zetten" */
function seatMember(m, init) {
  const c = structuredClone(m); delete c.pid;
  endFightEffects([c]); // ronde-effecten van een vorig (niet gestopt) gevecht vervallen
  R.reExh(c, rulesOf(app.S)); // WP50/B1: Exhaustion volgens de regels van de tafel (de party zelf wordt niet omgerekend)
  app.S.list.push({ ...c, id: uid(), pid: m.pid, kind: "pc", init, cond: c.hp > 0 ? [] : ["Unconscious"], reaction: false });
}

async function ddbFetch() {
  const id = parseDdbLink($("#pc-ddb").value), info = $("#pc-sheetinfo"), btn = $("#pc-ddbgo");
  if (!id) { info.textContent = ddbMsg("bad"); return; }
  if (ddbBusy) ddbBusy.abort(); // laatste verzoek wint
  pdfSeq++; // een PDF die nog gelezen wordt, overschrijft deze sheet niet meer
  const ctl = ddbBusy = new AbortController();
  btn.disabled = true; btn.setAttribute("aria-busy", "true"); info.textContent = t("init.pc.fetching");
  try {
    const got = await fetchDdb(id, ctl.signal);
    if (ctl !== ddbBusy) return;
    clearPending();
    pendingDdb = got.id || id;
    pendingCheck = got.check; fillSheet(got.sheet, got.img); setCheck(got.check); showMatch();
  } catch (e) {
    if (ctl !== ddbBusy || e.name === "AbortError") return;
    info.textContent = ddbMsg(e.code);
  } finally {
    if (ctl === ddbBusy) { ddbBusy = null; btn.disabled = false; btn.removeAttribute("aria-busy"); }
  }
}

/** Lopend ophalen afbreken (PDF gekozen, formulier verstuurd) */
function stopDdb() {
  if (!ddbBusy) return;
  ddbBusy.abort(); ddbBusy = null;
  $("#pc-ddbgo").disabled = false; $("#pc-ddbgo").removeAttribute("aria-busy");
}

function resetPcForm() {
  stopDdb(); pdfSeq++; $("#f-pc").reset();
  $("#pc-party").checked = ptyPref(); // AF9: vóór clearPending (showMatch hangt aan dit vinkje)
  setBonus(0); $("#pc-bonh").hidden = false; clearErrs();
  clearPending(); $("#pc-sheetinfo").textContent = "";
}

export function bindForms() {
  $("#pc-race").insertAdjacentHTML("beforeend", RACE_OPTS.map((r) => `<option>${esc(r)}</option>`).join(""));
  $("#f-pc").addEventListener("submit", (e) => {
    e.preventDefault();
    const sh = pendingSheet, nm = $("#pc-name").value.trim();
    const ex = curMatch(); // zelfde regel als het vak hierboven
    const here = !!ex && app.S.list.some((c) => c.pid === ex.pid), plan = seatPlan(!!ex, here, !!sh);
    if (plan === "none") return; // knop staat uit: zit al aan tafel
    if (!pcValid(plan)) return;
    // SP4: tijdens een gevecht verplicht ingevuld; daarvoor null = invullen bij Start gevecht (paneel)
    const init = needInit(plan) ? parseInit($("#pc-init").value) : null;
    let lvl = cleanLvl($("#pc-lvl").value);
    if (ex) { // SP3: bestaand partylid nooit met volle HP opnieuw aanmaken (dat overschreef de bewaarde stand)
      let ch = [];
      if (sh) ch = updMember(ex, formUpdate()); else because(M("log.w.seat1"));
      if (lvl) ex.lvl = lvl;
      if (plan !== "upd") { seatMember(ex, init); ui.prepLast = app.S.list[app.S.list.length - 1].id; }
      app.S.sample = false; saveParty();
      const what = ch.length ? ` (${ch.join(", ")})` : "";
      resetPcForm(); render(); nextPcFocus();
      const st = ex.ds && ex.ds.dead ? "init.pc.stDead" : ex.max && ex.hp <= 0 ? "init.pc.stUnc" : null;
      const msg = here ? t("init.pc.hereDone", { name: ex.name, what })
        : sh ? t("init.pc.updSeated", { name: ex.name, what })
        : t("init.pc.seated", { name: ex.name, hp: n0(ex.hp), max: n0(ex.max), st: st ? ` (${t(st)})` : "" });
      // AF9: aan tafel zetten is terug te draaien; bijwerken van de party niet (undo dekt alleen de tafel)
      if (here) toast(msg); else toastHtml(`${esc(msg)}${sh ? ` ${esc(t("init.pc.partyKeeps"))}` : ""} ${undoBtn()}`);
      return;
    }
    const max = parseInt($("#pc-hp").value) || 0;
    const manual = (() => {
      const sl = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => ({ lvl: l, max: parseInt($("#pc-sl" + l).value) || 0 })).filter((x) => x.max > 0).map((x) => ({ ...x, left: x.max, spells: "" }));
      return sl.length ? { slots: sl, daily: [] } : null;
    })();
    const pid = $("#pc-party").checked ? uid() : null;
    const dex = sh ? sh.dex ?? pcBonus : pcBonus; // zonder sheet is de bonus ook de tiebreak
    const race = pickRace($("#pc-race").value, sh && sh.race);
    app.S.list.push({
      id: uid(), pid, name: nm, kind: "pc", race, img: pendingImg, init, dex, ac: parseInt($("#pc-ac").value) || 0, hp: max, max, cond: [],
      casting: manual || (sh && sh.casting ? structuredClone(sh.casting) : null), res: sh ? structuredClone(sh.res || []) : [], sheet: sh || null, initBonus: pcBonus,
      ...(pendingDdb && !pendingNew ? { ddbId: pendingDdb } : {}), // "Als nieuwe speler": geen tweede koppeling aan hetzelfde character
      ...(lvl ? { lvl } : {}), // voor de moeilijkheid (anders uit de klasse-string van de sheet)
      ...(sh && cleanDr(sh.dr) ? { dr: cleanDr(sh.dr) } : {}), // resistances uit de D&D Beyond-link (SP2)
    });
    app.S.sample = false; ui.prepLast = app.S.list[app.S.list.length - 1].id;
    resetPcForm(); render(); nextPcFocus();
    ui.addPid = pid ? { pid, step: stepNo() } : null;
    toastHtml(`${esc(init != null ? t("init.pc.addedInit", { name: nm, init, count: pcCount() }) : t("init.pc.added", { name: nm, count: pcCount() }))} ${undoBtn()}`); // AF9
    // level hoort bij de party (syncParty neemt lvl niet over: het Party-paneel is de bron)
    const pm = pid && lvl && app.party.find((x) => x.pid === pid);
    if (pm && pm.lvl !== lvl) { pm.lvl = lvl; saveParty(); render(); }
  });
  $("#pc-roll").addEventListener("click", () => {
    const b = pcBonus, r = d(20);
    $("#pc-init").value = r + b; setErr("init", ""); toastHtml(`Initiative: d20 [${r}] ${sgn(b)} = <b>${r + b}</b>`);
  });
  $("#pc-bon").addEventListener("click", (e) => { const b = e.target.closest("[data-bon]"); if (b) stepBonus(+b.dataset.bon); });
  $("#pc-bon").addEventListener("keydown", (e) => { // pijltoetsen op de stepper (toetsenbord)
    const dv = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
    if (dv) { e.preventDefault(); stepBonus(dv); }
  });
  for (const k of FERR) $("#pc-" + k).addEventListener("input", () => setErr(k, "")); // fout weg zodra de DM typt
  $("#pc-party").checked = ptyPref();
  setBonus(0);
  $("#pc-ddbgo").addEventListener("click", ddbFetch);
  $("#pc-ddb").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); ddbFetch(); } }); // niet de submit (eerst de sheet ophalen)
  for (const k of ["ac", "hp"]) $("#pc-" + k).addEventListener("input", (e) => e.target.closest("label").classList.remove("warn"));
  $("#pc-match").addEventListener("click", (e) => {
    if (e.target.closest("#pc-new")) { pendingNew = true; showMatch(); toast(app.S.round ? `${t("init.pc.asNewDone")} ${t("init.pc.fillInit")}` : t("init.pc.asNewDone")); }
  });
  $("#pc-name").addEventListener("input", () => showMatch());
  $("#pc-party").addEventListener("change", (e) => { savePty(e.target.checked); showMatch(); }); // AF9: alleen een keuze van de DM onthouden
  $("#pc-pdf").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    e.target.value = ""; // zelfde bestand opnieuw kiezen moet weer werken, ook na een fout
    stopDdb();
    const seq = ++pdfSeq; // laatste keuze wint (link ophalen, andere PDF, formulier verstuurd)
    $("#pc-sheetinfo").textContent = t("init.pc.reading", { file: f.name });
    try {
      const got = await readSheetPdf(f), h = got && got.sheet;
      if (seq !== pdfSeq) return;
      if (!h) { $("#pc-sheetinfo").textContent = t("init.pc.noPdf"); return; }
      clearPending(); fillSheet(h, got.img); showMatch();
    } catch { if (seq === pdfSeq) $("#pc-sheetinfo").textContent = t("init.pc.pdfFail"); }
  });

  // bedieningsblok (IN4, zelfde als snel toevoegen): opnieuw tekenen, behalve tijdens typen in het getalveld (focus)
  const monBtn = (typing) => {
    const btn = $("#mon-add"), st = ui.monAdd, m = selMon ? findKey(selMon) : null; // selMon = monKey (WP49)
    if (typing) $("#mon-addh").textContent = addHint(st, m); else $("#mon-blk").innerHTML = addBlockHtml("mon", st, m);
    btn.disabled = !m || (st.fixOn && parseInit(st.fix) === null);
    btn.textContent = m ? addLabel(st.n, m.n, $("#mon-hid").checked, $("#mon-anon").checked) : t("init.mon.pick");
    $("#mon-hidh").hidden = !$("#mon-hid").checked;
    $("#mon-anonh").hidden = !$("#mon-anon").checked;
  };
  const renderMonList = (typed) => {
    const q = $("#mon-q").value, { f, st } = monSearch(q, selMon, typed === true, () => { if (ui.prep === "mon") renderMonList(); }); // VB5: tijdens typen wint een exacte naam
    if (f.sel !== selMon) ui.monFull = false; // andere keuze: preview weer kort
    selMon = f.sel; // UI-toestand, geen data: de selectie volgt wat zichtbaar is
    monBtn();
    const lbl = st ? "" : monLabel(f), m = selMon ? findKey(selMon) : null;
    $("#mon-lbl").hidden = !lbl; $("#mon-lbl").textContent = lbl;
    $("#mon-list").innerHTML = monListHtml(f, selMon, "data-pick", t("init.mon.noneTab"), st);
    $("#mon-ed").innerHTML = edLineHtml(q);
    $("#mon-prev").innerHTML = monPrev(m, ui.monFull, true);
    if (ui.prep === "mon") previewSB(m || null); // tablet/desktop: volledig statblock in de zijkolom (geen keuze: terug)
  };
  bindForms.renderMonList = renderMonList;
  $("#mon-q").addEventListener("input", () => renderMonList(true));
  $("#mon-blk").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-ab]"); if (!b) return;
    const f = addBlockTap(ui.monAdd, b), had = document.activeElement === b; monBtn();
    if (f) $("#mon-fix")?.focus(); else if (had) refocusAb($("#mon-blk"), b);
  });
  $("#mon-blk").addEventListener("input", (e) => { if (e.target.dataset.ab === "fix") { ui.monAdd.fix = e.target.value; monBtn(true); } });
  $("#mon-hidh").textContent = hidHint(); // één tekst voor Monster-tab en snel toevoegen
  $("#mon-anonh").textContent = anonHint();
  $("#mon-hid").addEventListener("change", () => monBtn());
  $("#mon-anon").addEventListener("change", () => monBtn());
  $("#mon-list").addEventListener("click", (e) => { const b = e.target.closest("[data-pick]"); if (!b) return; if (selMon !== b.dataset.pick) ui.monFull = false; selMon = b.dataset.pick; renderMonList(); });
  // WP49 (V4): zoekwoord 2014/2024 toevoegen of weghalen; de toestand blijft zichtbaar in het veld
  $("#mon-ed").addEventListener("click", (e) => { const b = e.target.closest("[data-edq]"); if (!b) return; $("#mon-q").value = withEdWord($("#mon-q").value, b.dataset.edq, rulesOf(app.S)); renderMonList(true); });
  $("#mon-prev").addEventListener("click", (e) => { if (!e.target.closest("[data-mpfull]")) return; ui.monFull = !ui.monFull; renderMonList(); });
  $("#f-mon").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!selMon || !findKey(selMon)) { toastBad(t("init.mon.errPick")); return; }
    const st = ui.monAdd, fix = parseInit(st.fix);
    if (st.fixOn && fix === null) { toastBad(t("init.mon.errInit")); $("#mon-fix")?.focus(); return; }
    $("#mon-q").blur();
    const r = keyRef(selMon);
    addMonsters(r.n, st.n, addHp(findKey(selMon)), addInit(st), false, fix, $("#mon-hid").checked, $("#mon-anon").checked, r.ed);
    Object.assign(st, { n: 1, fixOn: false, fix: "" }); // aantal en ingevulde initiative gelden één keer; HP en Per monster/Groep blijven
    $("#mon-hid").checked = $("#mon-anon").checked = false; monBtn(); // elke keer opnieuw kiezen: nooit per ongeluk verborgen toevoegen
    ui.prepLast = app.S.list.at(-1)?.id ?? null;
    render();
  });

  /* RE14: plaktekst live herkennen; lege velden invullen (gemarkeerd "uit tekst"), getypte waarden nooit overschrijven */
  const CU = [["cu-name", (p) => p.n], ["cu-cr", (p) => p.cr], ["cu-ac", (p) => String(parseInt(p.ac) || "")],
    ["cu-hp", (p) => (p.hd && HD_RE.test(p.hd) ? p.hd : p.hp)], ["cu-dex", (p) => (p.ab ? String(p.ab[1]) : "")]];
  const cuAuto = (el, on) => { el.dataset.auto = on ? "1" : ""; el.closest("label").querySelector(".autot").hidden = !on; };
  let cuT = 0, cuPrev = false;
  const cuParse = () => {
    const txt = $("#cu-text").value, p = txt.trim() ? parseStatText(txt) : null, ok = hasStructure(p);
    for (const [id, get] of CU) {
      const el = $("#" + id), v = ok || (p && id !== "cu-dex") ? get(p) || "" : "";
      if (el.value && !el.dataset.auto) continue; // zelf getypt: blijft
      el.value = v; cuAuto(el, !!v);
    }
    const box = $("#cu-parse");
    if (!p) { box.innerHTML = `<p class="hint">${esc(t("init.custom.textHint"))}</p>`; cuPrev = false; return; }
    if (!ok) { box.innerHTML = `<p class="hint">${esc(t("init.custom.none"))}</p>`; cuPrev = false; return; }
    const rest = p.rest ? p.rest.split("\n").length : 0;
    const m = cuMon();
    box.innerHTML = `<p class="hint cuok">${esc(t("init.custom.found", { list: foundText(p) }))}</p>
      ${rest ? `<p class="hint">${esc(t("init.custom.rest", { n: rest }))}</p>` : ""}
      <button type="button" class="link" data-cuprev aria-expanded="${cuPrev}">${esc(t("init.custom.preview"))} ${chev(cuPrev)}</button>
      ${cuPrev && m ? monCard(withParsed(m), false, false) : ""}`;
  };
  /** Monster uit het formulier (null = nog niet compleet); HP: getal of dobbelstenen */
  function cuMon() {
    const hpIn = $("#cu-hp").value.replace(/\s/g, "");
    let hp = parseInt(hpIn), hd = null;
    if (/d/i.test(hpIn)) { if (!HD_RE.test(hpIn)) return { err: t("init.custom.errHp") }; hd = hpIn; hp = avgExpr(hpIn); }
    return { n: $("#cu-name").value.trim() || t("init.custom.defName"), cr: $("#cu-cr").value.trim(), ac: $("#cu-ac").value, hp, hd,
      dexScore: parseInt($("#cu-dex").value) || 10, text: $("#cu-text").value };
  }
  $("#cu-text").addEventListener("input", () => { clearTimeout(cuT); cuT = setTimeout(cuParse, 300); });
  for (const [id] of CU) $("#" + id).addEventListener("input", (e) => { cuAuto(e.target, false); if (cuPrev) { clearTimeout(cuT); cuT = setTimeout(cuParse, 300); } });
  $("#cu-parse").addEventListener("click", (e) => { if (!e.target.closest("[data-cuprev]")) return; cuPrev = !cuPrev; cuParse(); $("#cu-parse [data-cuprev]")?.focus(); });

  $("#f-custom").addEventListener("submit", (e) => {
    e.preventDefault();
    clearTimeout(cuT); cuParse(); // net geplakt en meteen opslaan: eerst herkennen
    const m = cuMon();
    if (m.err) { toastBad(m.err); $("#cu-hp").focus(); return; }
    if (!$("#cu-name").value.trim()) { toastBad(t("init.pc.errName")); $("#cu-name").focus(); return; }
    if (!(parseInt(m.ac) > 0)) { toastBad(t("init.custom.errAc")); $("#cu-ac").focus(); return; }
    if (!(m.hp > 0)) { toastBad(t("init.custom.errHp2")); $("#cu-hp").focus(); return; }
    app.custom = [m, ...app.custom.filter((x) => x.n !== m.n)]; saveLibrary();
    e.target.reset(); for (const [id] of CU) cuAuto($("#" + id), false); cuPrev = false; cuParse();
    selMon = m.n; $("#mon-q").value = "";
    ui.prep = "mon"; renderMonList(); render(); $("#mon-add").focus(); toast(t("init.custom.saved", { name: m.n }));
  });

  const impStatus = () => {
    $("#imp-status").innerHTML = app.imported.length ? `${esc(t("init.custom.imported", { n: app.imported.length }))} <button type="button" class="link" id="imp-clear">${esc(t("init.custom.impClear"))}</button>` : "";
  };
  bindForms.impStatus = impStatus;
  $("#imp-status").addEventListener("click", (e) => { if (e.target.id === "imp-clear") { app.imported = []; saveLibrary(); renderMonList(); impStatus(); } });
  $("#imp-file").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    e.target.value = ""; // ook na een fout opnieuw te kiezen
    let j;
    try { j = JSON.parse(await f.text()); } catch { toastBad(t("init.custom.errJson")); return; }
    const conv = parseMonsterFile(j);
    if (!conv.length) { toastBad(t("init.custom.errEmpty")); return; }
    const before = app.imported.length;
    const map = new Map(app.imported.map((m) => [m.n.toLowerCase(), m]));
    conv.forEach((m) => map.set(m.n.toLowerCase(), m));
    app.imported = [...map.values()]; saveLibrary(); renderMonList(); impStatus();
    toast(t("init.custom.impDone", { n: conv.length, k: app.imported.length - before }));
  });
}

/** Na hertekenen van het toevoegblok: focus terug op dezelfde knop (toetsenbord/screenreader), anders de buurknop van de stepper */
function refocusAb(box, b) {
  const sel = `[data-ab="${b.dataset.ab}"]`, same = box.querySelector(`${sel}[data-v="${b.dataset.v}"]`);
  (same && !same.disabled ? same : box.querySelector(`${sel}:not(:disabled)`))?.focus();
}

/* ---------- snel toevoegen tijdens het gevecht (+ in Gevecht-modus) ---------- */
function closeQadd() {
  ui.qadd = null; paintQadd();
  $("#qadd")?.focus();
}

export function bindQadd() {
  const el = $("#qsheet");
  // invoer: alleen het paneel bijwerken (geen volledige render), zodat het zoekveld focus houdt
  el.addEventListener("input", (e) => {
    const q = ui.qadd; if (!q) return;
    if (e.target.id === "q-q") { q.q = e.target.value; q.typed = true; paintQadd(); q.typed = false; }
    else if (e.target.dataset.ab === "fix") { q.fix = e.target.value; q.typing = true; paintQadd(); q.typing = false; }
  });
  el.addEventListener("click", (e) => {
    const q = ui.qadd; if (!q) return;
    const p = e.target.closest("[data-qpick]");
    if (p) { if (q.sel !== p.dataset.qpick) q.full = false; q.sel = p.dataset.qpick; paintQadd(); return; }
    const eq = e.target.closest("[data-edq]");
    if (eq) { q.q = withEdWord(q.q, eq.dataset.edq, rulesOf(app.S)); $("#q-q").value = q.q; q.typed = true; paintQadd(); q.typed = false; return; }
    if (e.target.closest("[data-mpfull]")) { q.full = !q.full; paintQadd(); return; }
    const ab = e.target.closest("button[data-ab]");
    if (ab) { const f = addBlockTap(q, ab), had = document.activeElement === ab; paintQadd(); if (f) $("#q-fix")?.focus(); else if (had) refocusAb($("#q-blk"), ab); return; }
    const b = e.target.closest("[data-q]"); if (!b) return;
    const k = b.dataset.q;
    if (k === "close") { closeQadd(); return; }
    if (k === "hid") q.hid = b.checked;
    if (k === "anon") q.anon = b.checked;
    if (k === "go") { qGo(); return; }
    paintQadd();
  });
  // Enter (zoekknop van het toetsenbord) voegt toe zodra er een monster gekozen is
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.target.id === "q-q" || e.target.id === "q-fix")) { e.preventDefault(); qGo(); }
  });
}

function qGo() {
  const q = ui.qadd; if (!q || !q.sel || !findKey(q.sel)) return;
  const fix = parseInit(q.fix);
  if (q.fixOn && fix === null) { $("#q-fix")?.focus(); return; }
  because(M("log.w.midFight"));
  const r = keyRef(q.sel);
  addMonsters(r.n, q.n, addHp(findKey(q.sel)), addInit(q), false, fix, q.hid, q.anon, r.ed);
  ui.qadd = null;
  render();
  $("#qadd")?.focus();
}

/* ---------- open saves (regels in de beurtbalk) ---------- */
/** Monster-save rollen: statblock-bonus plus Bless/Bane/cover; uitslag verwerken. Geeft de toast-tekst terug (zonder te tonen) als quiet. */
function svRoll(sid, adv = false, quiet = false) {
  const S = app.S, s = (S.saves || []).find((x) => x.sid === sid), c = s && S.list.find((x) => x.id === s.id);
  if (!c || !isValid(S, s)) return "";
  const sa = saveAdv(c, s.ab, adv); // RE11/RE16: Exhaustion 3+ / Rage op STR
  const x = rollSave(svBonus(c, s.ab), sa.v, Math.random, saveMods(c, s.ab), adv && sa.why === "Magic Resistance" ? "" : sa.why);
  const ok = x.tot >= s.dc, txt = `${s.ab} ${rollText(x, s.dc)}`.replace(" (advantage: Magic Resistance)", " (advantage)");
  return svDone(c, sid, ok, txt, txt, quiet, adv);
}

/** Uitslag verwerken, renderen en melden met Ongedaan (gefaald monster: Legendary Resistance / Advantage erbij) */
function svDone(c, sid, ok, note, shown, quiet = false, adv = false) {
  const s = (app.S.saves || []).find((x) => x.sid === sid);
  if (!s || !isValid(app.S, s)) return ""; // bijv. tweede concentration save nadat de eerste al faalde
  const was = c.hp, f = resolveSave(app.S, sid, ok, note, rulesOf(app.S)); // was vóór de rider-schade
  addWhy(f.why); // de melding hieronder zegt al wat er gebeurde
  if (f.saves) f.saves.forEach((x) => addSave(app.S, x)); // rider-schade: concentration save
  if (!quiet) render(); // "Rol alle monsters" rendert één keer: één undo-stap
  const m = c.kind === "monster" && c.ref ? findMon(c.ref, c.ed) : null;
  const res = s.kind === "conc" ? t(ok ? "init.msg.svConcOk" : "init.msg.svConcFail")
    : s.kind === "rider" ? riderOutcome(s.rd, ok, was - c.hp) + concNote(f)
    : t(ok ? "init.msg.svGone" : "init.msg.svStays", { name: s.n });
  const line = esc(`${c.name}: ${shown || t(ok ? "init.msg.svOk" : "init.msg.svFail", { ab: s.ab })} · ${res}`);
  if (quiet) return line;
  ui.svRetry = !ok && c.kind === "monster" ? { sid, id: c.id, step: stepNo() } : null;
  const extra = !ui.svRetry ? ""
    : (c.lr && c.lr.left > 0 ? `<button class="tundo" id="toast-svlr">Legendary Resistance (${c.lr.left})</button>` : "")
      + (!adv && s.kind === "cond" && hasMagicRes(m) ? `<button class="tundo" id="toast-svadv">Spell? Advantage</button>` : "");
  toastHtml(`${line} ${extra}${undoBtn()}`);
  return line;
}

/** Laatste gefaalde save terugdraaien en anders afhandelen (alleen als er sindsdien niets gebeurde) */
function svRetry(fn) {
  const j = ui.svRetry; closeToast(); ui.svRetry = null;
  if (!j || stepNo() !== j.step || !undo()) return;
  const c = app.S.list.find((x) => x.id === j.id);
  if (c) fn(c, j.sid);
}

/** RE7: monsters zonder bekende savebonus worden niet gerold; melden wie de DM zelf rolt */
function selfToast(list, ab) {
  const n = [...new Set(list.filter((c) => selfRoll(c, ab)).map((c) => c.name))];
  if (n.length) toast(t("init.msg.selfRoll", { names: n, ab }));
}

function svRollAll() {
  const S = app.S;
  const ids = openSaves(S).filter((s) => { const c = S.list.find((x) => x.id === s.id); return c && c.kind === "monster" && !selfRoll(c, s.ab); }).map((s) => s.sid);
  const lines = ids.map((sid) => svRoll(sid, false, true)).filter(Boolean);
  ui.svRetry = null;
  render();
  if (lines.length) toastHtml(`${lines.join("<br>")} ${undoBtn()}`);
}

/* ---------- legendary actions (regel in de beurtbalk) ---------- */
let laFrom = null; // knop die het paneel opende, voor de focus bij sluiten
function openLa(id) {
  ui.sheet = null; ui.qadd = null; ui.aoe = null; ui.atk = null; ui.la = id;
  laFrom = id;
  render();
  const sh = $("#lsheet .lsheet"); if (sh) sh.focus();
}
function closeLa() {
  ui.la = null; paintLa();
  const b = laFrom && document.querySelector(`[data-la="${CSS.escape(laFrom)}"]`); if (b && !b.disabled) b.focus();
}
/** Optie gebruiken: LA aftrekken (logboek met oorzaak, Ongedaan); paneel blijft open om te rollen */
function laUse(id, i) {
  const c = app.S.list.find((x) => x.id === id), o = c && laOpts(c)[i];
  if (!o) return;
  const r = useLA(c, o, app.S);
  if (!r.why.length) { show(r); return; }
  addWhy(r.why);
  render();
  // paneel is opnieuw opgebouwd: focus terug op dezelfde knop (of het paneel als die nu uit staat)
  const nb = document.querySelector(`#lsheet [data-lause="${CSS.escape(id)}"][data-i="${i}"]`);
  (nb && !nb.disabled ? nb : $("#lsheet .lsheet"))?.focus();
  toastHtml(`${esc(t("init.msg.laUsed", { name: c.name, opt: o.n, n: o.cost, left: c.la.left }))} ${undoBtn()}`);
}

/* ---------- AoE: één schadeworp op meerdere doelen (knop AoE in de beurtbalk) ---------- */
function closeAoe() {
  const a = ui.aoe;
  ui.aoe = null; paintAoe();
  // geopend vanaf een save-actie op de kaart: focus terug op die knop, anders op AoE in de beurtbalk
  const src = a && a.src && document.querySelector(`.c[data-id="${CSS.escape(a.src)}"] [data-aoe="${CSS.escape(a.act)}"]`);
  (src || $("#aoe"))?.focus();
}

/** Keuze voor één doelwit bijwerken (UI-toestand, niet in undo) */
const aoeSet = (a, id, patch) => { a.t[id] = { ...(a.t[id] || newPick()), ...patch }; };

/** Spell-tab opnieuw opbouwen (andere tab, spell of caster); focus op de gekozen knop of het paneel */
function rebuildAoe(focus) {
  $("#asheet").innerHTML = ""; paintAoe();
  ($(focus || "") || $("#asheet .asheet"))?.focus();
}

/** Spell-velden (caster, DC, eigen spell). true = afgehandeld */
function spellField(a, t) {
  const id = t.id;
  if (id === "s-by") { // RE8: de keuze per doel blijft; alleen de nieuwe caster gaat uit, gerolde saves gelden tegen de nieuwe DC
    a.by = t.value; a.sslot = null; a.slot = null;
    if (a.dsp) chooseDmg(a, dmgSp(a), true); // zelfde gedrag als in de tab Schade: spell blijft, nieuwe DC en dobbelstenen
    const dc0 = a.sdc; a.sdc = spellDC(a);
    if (a.by) a.s[a.by] = { ...(a.s[a.by] || {}), sel: false };
    const dc = parseInt(a.sdc), rolled = Object.values(a.s).filter((x) => x.roll);
    rolled.forEach((x) => { x.lr = false; x.ok = dc > 0 && x.roll.tot >= dc; });
    a.redc = rolled.length && a.sdc && a.sdc !== dc0 ? a.sdc : ""; // melding in #s-info
    rebuildAoe("#s-by"); return true;
  }
  if (id === "s-dc") {
    a.sdc = t.value; a.redc = "";
    const dc = parseInt(a.sdc); // al gerolde saves opnieuw tegen de nieuwe DC leggen
    Object.values(a.s).forEach((x) => { if (x.roll) { x.lr = false; x.ok = dc > 0 && x.roll.tot >= dc; } });
    paintAoe(); return true;
  }
  const k = { "s-n": "n", "s-cond": "cond", "s-ab": "ab", "s-dur": "dur", "s-rep": "rep", "s-conc": "conc" }[id];
  if (!k) return false;
  a.cf[k] = t.type === "checkbox" ? t.checked : t.value;
  if (k === "ab" || k === "cond") { a.s = {}; rebuildAoe("#" + id); } else paintAoe(); // save erbij of weg, andere immuniteit
  return true;
}
/** DC van de caster (sheet of statblock), alleen voor spells met een save */
const spellDC = (a) => { const c = app.S.list.find((x) => x.id === a.by); return c ? casterDC(c, c.ref ? findMon(c.ref, c.ed) : null) : ""; };

/** Spell-tab: klikken. true = afgehandeld */
function spellClick(a, k, b) {
  const sp = curSpell(a), id = b.dataset.id, caster = app.S.list.find((x) => x.id === a.by);
  const set = (patch) => { a.s[id] = { ...(a.s[id] || {}), ...patch }; };
  if (k === "sp") { const v = b.dataset.v === "own" ? "own" : +b.dataset.v; if (a.sp !== v) { a.sp = v; a.s = {}; a.redc = ""; a.sslot = null; if (!a.sdc) a.sdc = spellDC(a); } rebuildAoe(`[data-ao="sp"][data-v="${b.dataset.v}"]`); return true; }
  if (k === "sgo") { spellGo(); return true; }
  if (!sp) return k.startsWith("s");
  if (k === "sslot") { a.sslot = b.dataset.v; paintAoe(); $(`#s-slot [data-v="${CSS.escape(b.dataset.v)}"]`)?.focus(); return true; }
  if (k === "ssave") set({ ok: b.dataset.v === "1", lr: false });
  else if (k === "slr") set({ ok: false, lr: true });
  else if (k === "sall") spellTargets(app.S.list).forEach((c) => { // niet de caster, niet wie immuun of (Hold Person) geen humanoid is
    a.s[c.id] = { ...(a.s[c.id] || {}), sel: !!b.dataset.v && c.kind === b.dataset.v && c.id !== a.by && spellPick(a, sp, caster, c).fit };
  });
  else if (k === "sroll") {
    const dc = parseInt(a.sdc);
    if (!(dc > 0)) { toastBad(t("init.msg.dcFirst")); $("#s-dc")?.focus(); return true; }
    const mons = spellTargets(app.S.list).map((c) => ({ c, p: spellPick(a, sp, caster, c) })).filter((x) => x.c.kind === "monster" && x.p.sel && !x.p.immune);
    if (!mons.length) { toastBad(t("init.msg.monsFirst")); return true; }
    selfToast(mons.map((x) => x.c), sp.ab);
    // altijd een spell: Magic Resistance geeft advantage; Bless/Bane en cover tellen mee
    mons.filter(({ c }) => !selfRoll(c, sp.ab)).forEach(({ c, p }) => { const sa = saveAdv(c, sp.ab, hasMagicRes(p.m)), x = rollSave(saveBonus(p.m, sp.ab), sa.v, Math.random, saveMods(c, sp.ab), sa.why); a.s[c.id] = { ...(a.s[c.id] || {}), roll: x, ok: x.tot >= dc, lr: false }; });
  } else return false;
  paintAoe();
  return true;
}

/** Spell toepassen: concentratie, effect of condities per doel en het logboek in één stap (één Ongedaan) */
function spellGo() {
  const a = ui.aoe, S = app.S, sp = curSpell(a), caster = S.list.find((x) => x.id === a.by && x.kind !== "lair");
  if (!sp || !caster) return;
  const dc = parseInt(a.sdc);
  if (sp.rep && !(dc > 0)) { toastBad(t("init.msg.dcRep")); $("#s-dc")?.focus(); return; }
  const picks = sortOrder(spellTargets(S.list)).map((c) => ({ c, p: spellPick(a, sp, caster, c) })).filter((x) => x.p.sel)
    .map(({ c, p }) => ({ c, m: p.m, ok: !!sp.ab && p.ok, lr: !!sp.ab && p.lr, note: p.roll ? `${sp.ab} save ${rollText(p.roll, dc)}` : "" }));
  if (!picks.length) return;
  const k = spellSlot(a, sp, caster, picks.length); // RE2: zelfde stap
  const r = castSpell(S.list, sp, caster, picks, { round: S.round, active: S.active, dc: a.sdc, ed: edFor(caster, sp.n, spellEd()) });
  const sl = spendSlot(caster, k, sp.n, sp.lvl, !!a.sslot);
  addWhy([...r.why, ...sl.why]);
  ui.aoe = null;
  render();
  const parts = [r.hit.length ? `${r.hit.join(", ")}${sp.conds ? ` ${sp.conds.join(" + ")}` : ""}` : sp.ab ? t("init.msg.spNone") : "", r.ok.length ? t("init.msg.spOk", { n: r.ok.length }) : "", r.immune.length ? t("init.msg.spImm", { n: r.immune.length }) : ""].filter(Boolean);
  toastHtml(`${esc(`${sp.n} (${caster.name}): ${parts.join(" · ")}${sp.conc ? " · conc" : ""}${sl.txt ? ` · ${sl.txt}` : ""}`)} ${undoBtn()}`);
  $("#aoe")?.focus();
}

/** RE18: rol de dobbelstenen en zet de uitkomst in het schadeveld (aanpasbaar); worp onthouden voor de regel en het logboek */
function rollNow(a, e) {
  a.dice = e;
  const r = rollDice(e);
  if (!r) return;
  a.dmg = String(r.tot); a.rtot = r.tot; a.roll = `${a.dsp ? a.dsp + " " : ""}${diceText(r)}`;
}

/** RE18: schade-spell kiezen (of null = weg): type, save, half en DC invullen, slot terug naar de standaard, meteen rollen */
function chooseDmg(a, sp, sameSpell = false) {
  const c = aoeCaster(a);
  a.dsp = sp ? sp.n : null; a.slot = null; a.dq = "";
  Object.values(a.t).forEach((t) => { t.roll = null; t.lr = false; }); // andere save of DC: oude worpen gelden niet meer
  if (!sp) { a.half = undefined; a.extra = ""; a.alt = ""; a.roll = ""; a.rtot = null; return; }
  if (DTYPES.includes(sp.type)) a.type = ui.aoeLast.type = sp.type;
  a.ab = ui.aoeLast.ab = sp.ab; a.half = sp.half;
  const dc = c ? casterDC(c, c.ref ? findMon(c.ref, c.ed) : null) : "";
  if (dc) a.dc = ui.aoeLast.dc = dc;
  a.extra = sp.x.map((x) => `${x.dice} ${x.type}`).join(", "); a.alt = sp.alt || "";
  if (!sameSpell) Object.values(a.t).forEach((t) => { if (t.save === "half" || t.save === "none") t.save = "fail"; }); // Evasion e.d. blijft bij een andere caster
  rollNow(a, dmgDice(a, c, sp));
}

export function bindAoe() {
  const el = $("#asheet");
  const field = (e) => {
    const a = ui.aoe; if (!a) return;
    if (a.tab === "spell") { spellField(a, e.target); return; }
    const id = e.target.id;
    if (id === "a-by") { a.by = e.target.value; a.sslot = null; a.slot = null; a.sdc = spellDC(a); if (a.dsp) chooseDmg(a, dmgSp(a), true); rebuildAoe("#a-by"); return; }
    if (id === "a-q") { a.dq = e.target.value; paintDmgSugg(a); return; }
    if (id === "a-dice") { a.dice = e.target.value; return; }
    if (id === "a-dmg") a.dmg = e.target.value;
    else if (id === "a-type") a.type = ui.aoeLast.type = e.target.value;
    else if (id === "a-ab") { a.ab = ui.aoeLast.ab = e.target.value; Object.values(a.t).forEach((t) => { t.roll = null; t.lr = false; }); }
    else if (id === "a-dc") {
      a.dc = ui.aoeLast.dc = e.target.value;
      // al gerolde saves opnieuw tegen de nieuwe DC leggen
      const dc = parseInt(a.dc);
      Object.values(a.t).forEach((t) => { if (t.roll) { t.lr = false; t.save = dc > 0 && t.roll.tot >= dc ? okSave(a) : "fail"; } });
    }
    else return;
    paintAoe();
  };
  el.addEventListener("input", (e) => { if (e.target.tagName === "INPUT" && e.target.type !== "checkbox") field(e); });
  el.addEventListener("change", (e) => {
    const a = ui.aoe; if (!a) return;
    if (e.target.dataset.ao === "sel") { aoeSet(a, e.target.dataset.id, { sel: e.target.checked }); paintAoe(); }
    else if (e.target.dataset.ao === "ssel") { a.s[e.target.dataset.id] = { ...(a.s[e.target.dataset.id] || {}), sel: e.target.checked }; paintAoe(); }
    else if (e.target.tagName === "SELECT" || e.target.type === "checkbox") field(e);
  });
  el.addEventListener("click", (e) => {
    const a = ui.aoe; if (!a) return;
    const b = e.target.closest("button[data-ao], .dim[data-ao]"); if (!b) return;
    const k = b.dataset.ao, id = b.dataset.id;
    if (k === "close") { closeAoe(); return; }
    if (k === "tab") { const v = b.dataset.v === "spell" ? "spell" : "dmg"; if ((a.tab || "dmg") !== v) { a.tab = ui.aoeLast.tab = v; rebuildAoe(`[data-ao="tab"][data-v="${v}"]`); } return; }
    if (k === "todmg") { a.tab = ui.aoeLast.tab = "dmg"; rebuildAoe(a.dsp ? '[data-ao="dspx"]' : ".acast .dchips [data-ao=dsp]") ; if (!a.dsp && !document.querySelector(".acast .dchips [data-ao=dsp]")) $("#a-q")?.focus(); return; } // chips van de caster: geen toetsenbord
    if (a.tab === "spell" && spellClick(a, k, b)) return;
    if (k === "go") { aoeGo(); return; }
    if (k === "dsp") { chooseDmg(a, DMG_SPELLS.find((x) => x.n === b.dataset.v) || null); rebuildAoe('[data-ao="dspx"]'); return; }
    if (k === "dspx") { chooseDmg(a, null); rebuildAoe("#a-q"); return; }
    if (k === "slot") { const sp = dmgSp(a), cur = dmgSlot(a, aoeCaster(a), sp); a.slot = b.dataset.v; if (sp && cur !== a.slot) rollNow(a, dmgDice(a, aoeCaster(a), sp)); rebuildAoe(`[data-ao="slot"][data-v="${b.dataset.v}"]`); return; }
    if (k === "droll" || (k === "reroll" && !a.src)) {
      if (!normDice(a.dice)) { toastBad(t("init.msg.diceFmt")); $("#a-dice")?.focus(); return; }
      rollNow(a, a.dice); $("#a-dmg").value = a.dmg; paintAoe(); return;
    }
    if (k === "save") aoeSet(a, id, { save: b.dataset.v, lr: false });
    if (k === "mode") aoeSet(a, id, { mode: +b.dataset.v });
    if (k === "lr") aoeSet(a, id, { save: okSave(a), lr: true });
    if (k === "reroll") { const x = srcAoe(a); if (x) { a.dmg = String(x.dmg); a.roll = x.roll; a.extra = x.extra; $("#a-dmg").value = a.dmg; } }
    if (k === "all") aoeTargets(a.src).forEach((c) => aoeSet(a, c.id, { sel: !!b.dataset.v && c.kind === b.dataset.v }));
    if (k === "roll") {
      const dc = parseInt(a.dc);
      if (!(dc > 0)) { toastBad(t("init.msg.dcFirst")); $("#a-dc").focus(); return; }
      const mons = aoeTargets(a.src).filter((c) => c.kind === "monster" && aoePick(a, c).sel);
      if (!mons.length) { toastBad(t("init.msg.monsFirst")); return; }
      selfToast(mons, a.ab);
      mons.filter((c) => !selfRoll(c, a.ab)).forEach((c) => {
        const m = findMon(c.ref, c.ed), sa = saveAdv(c, a.ab, hasMagicRes(m)), x = rollSave(saveBonus(m, a.ab), sa.v, Math.random, saveMods(c, a.ab), sa.why);
        aoeSet(a, c.id, { roll: x, save: x.tot >= dc ? okSave(a) : "fail", lr: false });
      });
    }
    paintAoe();
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.id === "a-dmg") { e.preventDefault(); e.target.blur(); }
  });
}

/** De save-actie achter het paneel opnieuw opzoeken en rollen (monster kan intussen weg zijn) */
function srcAoe(a) {
  const c = app.S.list.find((x) => x.id === a.src), A = c && c.ref ? monsterActions(findMon(c.ref, c.ed)) : null;
  const act = A && [...A.main, ...A.other].find((x) => x.n === a.act);
  return act ? actionAoe(act, (e) => rollExpr(e), DTYPES) : null;
}

/** "DC 18 DEX · AoE" op een aanvalsregel: AoE-paneel met gerolde schade, type, save en DC; spelers aangevinkt */
function openActAoe(cid, name) {
  const c = app.S.list.find((x) => x.id === cid);
  if (!c) return;
  const a = { src: c.id, srcName: c.name, act: name, t: {} };
  const x = srcAoe(a);
  if (!x) { toastBad(t("init.msg.actRead")); return; }
  const ri = rcIndex(c.rc, name);
  ui.aoe = null; paintAoe(); // paneel opnieuw opbouwen met de titel van deze actie
  ui.sheet = null; ui.qadd = null; ui.la = null; ui.atk = null;
  ui.aoe = Object.assign(a, { dmg: String(x.dmg), type: x.type, ab: x.ab, dc: String(x.dc), half: x.half, roll: x.roll, extra: x.extra,
    title: `${name} · ${c.name}`, used: ri >= 0 && !c.rc[ri].ready });
  aoeTargets(a.src).forEach((t) => { if (t.kind === "pc") aoeSet(ui.aoe, t.id, { sel: true }); });
  render();
  $("#asheet .asheet")?.focus();
}

function aoeGo() {
  const a = ui.aoe; if (!a) return;
  const n = clampDmg(a.dmg), dc = parseInt(a.dc);
  const picks = aoeTargets(a.src).map((c) => ({ c, p: aoePick(a, c) })).filter((x) => x.p.sel)
    .map(({ c, p }) => ({ c, save: p.save, mode: p.mode, lr: p.lr, note: p.roll ? `${a.ab} save ${rollText(p.roll, dc)}` : "", up: c.hp > 0 }));
  if (!n || !picks.length) return;
  const L = picks.map((x) => x.c);
  // RE18/RE1: schade-spell van een caster: slot afschrijven, concentratie, worp in het logboek (alles in dezelfde stap)
  const sp = !a.src && dmgSp(a), c = !a.src && aoeCaster(a), k = sp ? dmgSlot(a, c, sp) : "";
  const lv = sp ? (c ? dmgLevel(a, c, sp) : sp.lv) : 0;
  const name = sp ? `${sp.n}${sp.lv ? ` (${ORD[lv]})` : ""}${c ? ` · ${c.name}` : ""}: ` : "";
  const label = `${a.act ? `${a.srcName}: ${a.act} ` : name}${n}${a.type ? " " + a.type : ""}${dc > 0 ? ` (${a.ab} DC ${dc})` : ""}`;
  const r = applyAoe(picks, n, label, rulesOf(app.S));
  apply(r);
  // RE13: Undead Fortitude per monster dat hierdoor op 0 kwam (type bekend: radiant = geen worp)
  const ufs = r.hits.map((h) => { const t = picks.find((x) => x.c.id === h.id); return t && t.up ? [t.c, ufRoll(t.c, 1, h.dealt, { radiant: a.type === "radiant" })] : null; })
    .filter((x) => x && x[1]).map(([t, txt]) => `${t.name}: ${txt}`);
  const sl = c && sp ? spendSlot(c, k, sp.n, sp.lv, !!a.slot) : { why: [], txt: "" };
  if (!a.src && a.roll) addWhy([{ t: M(a.rtot != null && a.rtot !== n ? "log.w.castAdj" : "log.w.cast", { who: c ? `${c.name} cast ` : "", roll: a.roll, n: String(n), type: a.type ? ` ${a.type}` : "" }), id: (c || L[0]).id }]);
  addWhy(sl.why);
  let conc = "";
  if (c && sp && isConc(sp.n, edFor(c, sp.n, spellEd())) && (a.slot || !(c.cond.includes("Concentrating") && c.concSpell === sp.n))) { apply(R.startConc(c, sp.n)); c.concLvl = lv; conc = " · conc"; } // concLvl: herhaalschade op hetzelfde level
  // recharge-actie: pas bij toepassen op "op", in dezelfde stap (één keer Ongedaan)
  const src = a.src && app.S.list.find((x) => x.id === a.src), ri = src ? rcIndex(src.rc, a.act) : -1;
  const rcUsed = ri >= 0 && src.rc[ri].ready;
  if (rcUsed) src.rc[ri].ready = false;
  const down = picks.filter((x) => x.up && x.c.hp <= 0).length;
  ui.aoe = null;
  render();
  const sum = t(down ? "init.msg.aoeDown" : "init.msg.aoe", { what: a.act || (sp ? sp.n : `AoE ${label}`), n: L.length, dmg: r.hits.reduce((s, h) => s + h.dealt, 0), k: down });
  toastHtml(`${esc(`${sum}${rcUsed ? ` · ${t("init.msg.rcUsed")}` : ""}${sl.txt ? ` · ${sl.txt}` : ""}${conc}${concNote(r)}${ufs.length ? ` · ${ufs.join(" · ")}` : ""}`)} ${undoBtn()}`);
  const ab = $("#aoe"); if (ab) ab.focus();
}

/* ---------- aanval op één doel (to-hit-knop op de monsterkaart) ---------- */
/** Aanval opzoeken in het statblock van de aanvaller (op naam) */
function findAtk(by, name) {
  const A = by && by.ref ? monsterActions(findMon(by.ref, by.ed)) : null;
  return A && [...A.main, ...A.other].find((a) => a.n === name && a.hit !== null);
}

let atkFrom = null; // knop die het paneel opende (kaart, statblock of legendary-paneel), voor de focus bij sluiten

/** Doelpaneel openen vanaf een to-hit-knop. laI = index van de legendary-optie (aanval uit het legendary-paneel). */
function openAtk(cid, name, label, laI, from) {
  const by = app.S.list.find((c) => c.id === cid), a = findAtk(by, name);
  if (!a) { // geen aanval met die naam (bijv. to hit in spellcasting-tekst): losse worp zoals voorheen
    const m = from && from.textContent.match(/[+-]\d+/);
    if (m) doRoll(`1d20${m[0]}`, label || from.closest(".entry")?.querySelector("i")?.textContent.replace(/\.$/, ""), true);
    return;
  }
  const o = laI != null && laI !== "" ? laOpts(by)[+laI] : null, laBack = ui.la || by.id; // "*" = paneel met alle monsters
  ui.sheet = null; ui.qadd = null; ui.aoe = null; ui.la = null; ui.sv = false;
  // GV11: volgorde uit de Multiattack ("one with its bite and two with its claws"); niet vanuit het legendary-paneel
  const seq = o || by.id !== app.S.active ? null : multiSeq(monsterActions(findMon(by.ref, by.ed))), rest = seqAfter(seq, a.n); // niet bij een opportunity attack
  ui.atk = newAtk(by, a, label, o ? { i: +laI, n: o.n, cost: o.cost, on: true, back: laBack } : null, rest ? { left: rest, i: 1, n: seq.length } : null);
  atkFrom = o ? null : from || null;
  render();
  focusAtk();
}

/** Toestand van het aanvalspaneel. sq = { left: [namen], i, n } (GV11), rid = save-rider van deze aanval (RE13) */
function newAtk(by, a, label, la, sq) {
  const adv = ui.atkAdv && ui.atkAdv.by === by.id ? ui.atkAdv.v : "a";
  return { by: by.id, n: a.n, label: label || a.n, bo: a.hit, kind: a.kind, key: partsKey(a.dmg), adv, tid: null, r: null, parts: null, modes: {}, force: {},
    la, sq, rid: parseRider(a.text), rroll: null, rs: null, rx: null, acp: 0 };
}

/** GV11: volgende aanval uit de multiattack, hetzelfde doel meteen gerold (doel neer of weg: doelkeuze) */
function atkNext(x, tid) {
  const by = app.S.list.find((c) => c.id === x.by);
  if (!by || !x.sq) { ui.atk = null; return false; }
  let left = x.sq.left, i = x.sq.i, a = null;
  while (left.length && !a) { a = findAtk(by, left[0]); left = left.slice(1); i++; } // naam niet (meer) te vinden: overslaan
  if (!a) { ui.atk = null; return false; }
  ui.atk = newAtk(by, a, a.n, null, left.length ? { left, i, n: x.sq.n } : { left: [], i, n: x.sq.n });
  const c = app.S.list.find((t) => t.id === tid);
  if (c && c.max && !isOut(c) && atkTargets(by.id).some((t) => t.id === c.id)) atkTarget(ui.atk, c.id);
  return true;
}

const focusAtk = () => { const s = $("#xsheet"); (s.querySelector(".qgo:not([disabled])") || s.querySelector(".xt") || s.querySelector(".xsheet"))?.focus(); };
/** Focus terug naar de opener; aanval uit het legendary-paneel: terug naar dat paneel (back) */
function atkBack(x, back) {
  if (x && x.la && back) return openLa(x.la.back);
  const f = atkFrom && atkFrom.isConnected ? atkFrom : x && $(`.c[data-id="${CSS.escape(x.by)}"] .d.hit`);
  atkFrom = null;
  f?.focus();
}
function closeAtk(back = true) { const x = ui.atk; ui.atk = null; paintAtk(); atkBack(x, back); }

/** Legendary action van deze aanval aftrekken (schakelaar aan), in dezelfde stap als de schade */
function atkLa(x, by) {
  if (!x.la || !x.la.on || !laCan(x, by)) return "";
  const r = useLA(by, { n: x.la.n, cost: x.la.cost }, app.S);
  addWhy(r.why);
  return r.why.length ? ` · ${t("init.msg.laLeft", { name: by.name, n: x.la.cost, left: by.la.left })}` : "";
}

/** Doel gekozen: to hit en damage in één keer rollen (een ander doel kiezen houdt dezelfde worp) */
function atkTarget(x, id) {
  const c = app.S.list.find((t) => t.id === id);
  if (!c) return;
  x.tid = id;
  if (!x.r) {
    x.r = rollAttack(x.bo); x.parts = x.key ? rollDmgCrit(x.key, (e) => rollExpr(e)) || [] : [];
    if (x.rid && x.rid.dmg) { const r = rollExpr(x.rid.dmg.e); if (r) x.rroll = { total: r.total, txt: `${x.rid.dmg.e} [${r.rolls.join(", ")}] = ${r.total} ${x.rid.dmg.type}` }; } // RE13: rider-schade vooraf
  }
  x.force = {}; x.rs = null; x.rx = null; // save en "toch raak" horen bij het doel; Parry onthoudt zelf het doel (acp.id)
  // resistance/immuniteit: monster uit het statblock (onvoorwaardelijk), speler uit zijn opgeslagen resistances (SP2)
  const m = c.ref ? findMon(c.ref, c.ed) : null;
  x.modes = {};
  for (const p of x.parts) if (!(p.type in x.modes)) x.modes[p.type] = targetMode(c, m, p.type).mode;
}

function atkGo() {
  const x = ui.atk, by = x && app.S.list.find((c) => c.id === x.by), c = x && app.S.list.find((t) => t.id === x.tid);
  if (!by || !c || !c.max || isOut(c)) return;
  const { r } = atkRoll(x, by, c), ac = atkAc(x, c), res = atkResult(r, ac, x.parts, x.modes, x.force);
  if (!res.hit) return;
  const sim = structuredClone(c); atkDamage(sim, res, rulesOf(app.S));
  const ri = atkRider(x, c, res, sim); // RE13: vóór de schade bepaald, zoals het paneel het toonde
  const rOn = ri && ri.act && ri.choice !== "na";
  if (!res.dealt && !rOn) return;
  const before = c.hp;
  because(atkWhy(`${x.label} (${by.name})`, r, ac || null, x.parts, res), c.id);
  const f = res.dealt ? atkDamage(c, res, rulesOf(app.S)) : R.fx();
  apply(f);
  const uf = res.dealt ? ufRoll(c, before, res.dealt, ufInfo(res)) : "";
  const rt = rOn ? atkRiderGo(x, c, ri) : "";
  const la = atkLa(x, by); // na de schade: een monster dat zichzelf raakt en neergaat kan geen LA meer
  ui.atkPrev = { by: by.id, id: c.id };
  const hasNext = x.sq && x.sq.left.length && atkNext(x, c.id); // GV11: door naar de volgende aanval, zelfde doel
  if (!hasNext) ui.atk = null;
  render();
  toastHtml(`${esc(`${c.name}: −${res.dealt} HP${res.crit ? ` ${t("init.msg.crit")}` : ""} → ${n0(c.hp)}/${n0(c.max)}${before > 0 && c.hp <= 0 ? `, ${t(c.kind === "pc" ? "init.dmg.unc" : "init.card.down")}` : ""}${uf ? ` · ${uf}` : ""}${rt}${la}${concNote(f)}`)} ${undoBtn()}`);
  if (hasNext) focusAtk(); else atkBack(x, false);
}

/**
 * RE13: rider na de treffer, in dezelfde stap. Ingevuld: meteen toepassen; niet ingevuld: open save in de beurtbalk.
 * Geeft de staart voor de melding.
 */
function atkRiderGo(x, c, ri) {
  const m = c.ref ? findMon(c.ref, c.ed) : null, rd = ri.rd;
  const full = { ...rd, n: x.n, by: x.by, roll: x.rroll, mode: rd.dmg ? targetMode(c, m, rd.dmg.type).mode : 1 };
  if (!ri.choice) {
    addSave(app.S, { id: c.id, kind: "rider", n: x.n, ab: rd.ab, dc: rd.dc, rd: full });
    return ` · ${t("init.msg.riderBar", { ab: rd.ab, dc: rd.dc })}`;
  }
  const hp = c.hp, f = applyRider(c, full, ri.choice === "ok", app.S.active, rulesOf(app.S));
  addWhy(f.why);
  if (f.saves) f.saves.forEach((s) => addSave(app.S, s));
  return ` · ${rd.ab} ${rd.dc} ${t(ri.choice === "ok" ? "init.msg.ok" : "init.msg.fail")}: ${riderOutcome(rd, ri.choice === "ok", hp - c.hp)}${concNote(f)}`;
}

/** Mis met de LA-schakelaar aan: legendary action is toch gebruikt */
function atkMiss() {
  const x = ui.atk, by = x && app.S.list.find((c) => c.id === x.by);
  if (!by) return;
  const la = atkLa(x, by);
  ui.atk = null;
  render();
  if (la) toastHtml(`${esc(`${x.label}: ${t("init.msg.miss")}${la}`)} ${undoBtn()}`);
  atkBack(x, false);
}

export function bindAtk() {
  $("#xsheet").addEventListener("click", (e) => {
    const x = ui.atk; if (!x) return;
    const b = e.target.closest("[data-xa]"); if (!b) return;
    const k = b.dataset.xa;
    if (k === "close") { closeAtk(!b.classList.contains("qgo")); return; } // Annuleer/achtergrond: terug; Sluit na mis: dicht
    if (k === "go") { atkGo(); return; }
    if (k === "miss") { atkMiss(); return; }
    if (k === "next") { if (!atkNext(x, x.tid)) { closeAtk(false); return; } render(); focusAtk(); return; } // GV11: misser → volgende aanval
    if (k === "rs") { x.rs = x.rs === b.dataset.v ? null : b.dataset.v; } // RE13: nog eens tikken = weer open (beurtbalk)
    if (k === "rroll") { // monster als doel: save rollen, uitslag zet de seg (blijft om te zetten)
      const c = app.S.list.find((t) => t.id === x.tid), rd = x.rid;
      if (c && rd) { x.rx = monSave(c, findMon(c.ref, c.ed), rd.ab); x.rs = x.rx.tot >= rd.dc ? "ok" : "fail"; }
    }
    if (k === "parry") { // RE13: Parry van het doelmonster (monster tegen monster): reaction weg, +N AC voor deze aanval
      const c = app.S.list.find((t) => t.id === x.tid), n = c && c.ref ? parryOf(findMon(c.ref, c.ed)) : 0;
      if (c && n && canParry(c, app.S.round)) { because("Parry"); apply(useParry(c, n)); x.acp = { id: c.id, n }; render(); toastHtml(`${esc(t("init.msg.parryAc", { name: c.name, n }))} ${undoBtn()}`); focusAtk(); return; }
    }
    if (k === "la") x.la.on = !x.la.on;
    if (k === "free") { // oude gedrag: alleen de worp als melding
      const lab = x.label; closeAtk(!!x.la); // uit het legendary-paneel: terug, daar staat Gebruik
      doRoll(`1d20${sgn(x.bo)}`, lab, true);
      return;
    }
    if (k === "adv") { x.adv = b.dataset.v === "a" ? "a" : +b.dataset.v; ui.atkAdv = { by: x.by, v: x.adv }; } // zelfde dobbelstenen, andere modus
    if (k === "tgt") atkTarget(x, b.dataset.id);
    if (k === "back") x.tid = null;
    if (k === "mode") x.modes[b.dataset.t] = +b.dataset.v;
    if (k === "crit") { const c = app.S.list.find((t) => t.id === x.tid), by = app.S.list.find((t) => t.id === x.by); const res = c && by && atkResult(atkRoll(x, by, c).r, atkAc(x, c), x.parts, x.modes, x.force); x.force.crit = !(res && res.crit); }
    if (k === "force") x.force.hit = true;
    if (k === "shield") {
      const c = app.S.list.find((t) => t.id === x.tid), p = PRESETS.find((q) => q.n === "Shield");
      if (c && p) { const r = applyEff(c, p, null); render(); if (r.undoToast) toastHtml(`${esc(r.undoToast)} ${undoBtn()}`); focusAtk(); return; }
    }
    paintAtk();
    focusAtk();
  });
}

/* ---------- initiative van spelers bij Start gevecht ---------- */
function openInit() {
  const L = initPcs(app.S.list);
  ui.sheet = null; ui.qadd = null; ui.aoe = null; ui.atk = null; ui.la = null; ui.sv = false;
  ui.initDraft = { v: Object.fromEntries(L.map((c) => [c.id, c.init == null ? "" : String(c.init)])), act: L[0].id, fresh: true, rolls: {}, sur: ui.surMon ? "mon" : undefined }; // RE5: schakelaar van vóór de eerste speler gaat mee
  render();
  $("#isheet .isheet")?.focus();
}
function closeInit() { ui.initDraft = null; ui.oldGo = null; ui.surWho = null; paintInit(); $("#start")?.focus(); } // GV7: volgende Start vraagt het opnieuw

/** Volgende speler in het paneel (op de laatste blijft hij staan) */
function initNext(x) {
  const L = initPcs(app.S.list), i = L.findIndex((c) => c.id === x.act);
  if (i >= 0 && i < L.length - 1) { x.act = L[i + 1].id; x.fresh = true; return true; }
  return false;
}

function initGo() {
  const x = ui.initDraft; if (!x) return;
  const r = setInits(app.S.list, x.v);
  if (r.missing.length) {
    const L = initPcs(app.S.list), first = L.find((c) => parseInit(x.v[c.id]) === null);
    if (first) { x.act = first.id; x.fresh = true; }
    paintInit();
    toastBad(t("init.msg.noInit", { names: r.missing }));
    return;
  }
  apply(r);
  apply(setSurprise(app.S.list, x.sur || "none", rulesOf(app.S))); // zelfde undo-stap als de start
  ui.surWho = x.sur || "none"; // WP51: start() heeft de keuze nodig (2024 zet geen sur)
  ui.initDraft = null; ui.initSkip = true;
  paintInit();
  $("#start")?.click(); // zelfde afhandeling als de knop: gevecht starten, kaart van wie begint, één undo-stap
  ui.initSkip = false; // click is synchroon; zonder (werkende) #start mag de vlag niet blijven hangen
  render(); // vangnet: commit de nieuwe waarden als er toch niet gestart is (anders no-op)
}

/** Knop of toets in het paneel. k: d (cijfer), back, clear, sel, roll, next, enter, go, close */
function initKey(k, v) {
  const x = ui.initDraft; if (!x) return;
  if (k === "close") { closeInit(); return; }
  if (k === "go" || (k === "enter" && !initNext(x))) { initGo(); return; }
  const cur = x.v[x.act] ?? "";
  if (k === "d") { x.v[x.act] = x.fresh ? String(v) : cur.length < 2 ? cur + v : cur; x.fresh = false; delete x.rolls[x.act]; }
  if (k === "back") { x.v[x.act] = x.fresh ? "" : cur.slice(0, -1); x.fresh = false; delete x.rolls[x.act]; }
  if (k === "clear") { x.v[x.act] = ""; x.fresh = false; delete x.rolls[x.act]; }
  if (k === "sel") { x.act = v; x.fresh = true; }
  if (k === "sur") {
    // WP51 (2024): wie door de wissel wel/geen disadvantage krijgt, rolt opnieuw (alleen gerolde, geen ingetikte waarden)
    if (rulesOf(app.S) === "2024") for (const c of initPcs(app.S.list)) if (x.rolls[c.id] && surWho(c, x.sur || "none") !== surWho(c, v)) { x.v[c.id] = ""; delete x.rolls[c.id]; }
    x.sur = v;
  }
  if (k === "mroll") setInitRoll(v);
  if (k === "next") initNext(x);
  if (k === "roll") {
    const c = app.S.list.find((t) => t.id === v); if (!c) return;
    // WP50: Exhaustion 2024 op de initiativeworp; WP51: verraste speler in 2024 = disadvantage (twee d20's)
    const sd = rulesOf(app.S) === "2024" && surWho(c, x.sur || "none"), ir = initThrow(sd ? [d(20), d(20)] : [d(20)], initBo(c), exhMod(c));
    x.v[c.id] = String(ir.v); x.rolls[c.id] = ir.txt;
    x.act = c.id; initNext(x);
  }
  paintInit();
  const b = $("#isheet .ir.act .irn"); if (b) b.scrollIntoView({ block: "nearest" });
  // seg-knoppen (Verrast, Monsters): focus blijft op de gekozen knop (toetsenbord); anders het paneel (cijferpad)
  const seg = (k === "sur" || k === "mroll") && $(`#isheet [data-ia="${k}"][data-v="${v}"]`);
  (seg || $("#isheet .isheet"))?.focus({ preventScroll: true });
}

export function bindInit() {
  $("#isheet").addEventListener("click", (e) => {
    const b = e.target.closest("[data-ia]"); if (!b) return;
    initKey(b.dataset.ia, b.dataset.v ?? b.dataset.id);
  });
}

/* ---------- party-tab ---------- */
// SP1: Bijwerken per partylid met D&D Beyond-link. Toestand in ui.pUpd ({ pid, st: "busy"|"ask"|"err", f, ch, kept, msg }),
// want render() tekent het paneel opnieuw. Eén ophaalactie tegelijk.
let pUpdCtl = null;
function stopPUpd() { if (pUpdCtl) pUpdCtl.abort(); pUpdCtl = null; ui.pUpd = null; }
/** Paneel opnieuw tekenen; focus alleen als het Party-paneel open is (een late ophaal steelt geen focus elders) */
/** Focus alleen meenemen als die nog bij Bijwerken of nergens stond (niet uit een init-veld trekken) */
function pFocus(sel, was) {
  if (!sel || ui.prep !== "party") return;
  if (!was || was === document.body || !document.contains(was) || was.matches?.("[data-pupd],[data-pupdok],[data-pupdno]")) $("#party-panel " + sel)?.focus();
}
function pPaint(sel) {
  const was = document.activeElement; paintParty(); pFocus(sel, was);
  if (ui.pUpd && ui.pUpd.st === "err") ui.pUpd.said = true; // role="alert" één keer, niet bij elke repaint
}
const pLink = (pid) => `[data-pupd="${CSS.escape(pid)}"]`;

async function partyFetch(pid) {
  const m = app.party.find((x) => x.pid === pid); if (!m || !m.ddbId) return;
  stopPUpd();
  if (navigator.onLine === false) { ui.pUpd = { pid, st: "err", msg: ddbMsg("offline", true) }; return pPaint(pLink(pid)); }
  const ctl = pUpdCtl = new AbortController();
  ui.pUpd = { pid, st: "busy" }; pPaint(pLink(pid));
  try {
    const got = await fetchDdb(m.ddbId, ctl.signal);
    if (ctl !== pUpdCtl) return;
    if (ui.prep !== "party") { stopPUpd(); return; } // paneel ging dicht zonder closePrep (modus, encounter inladen): niets toepassen
    pUpdCtl = null;
    const cur = app.party.find((x) => x.pid === pid);
    if (!cur) { ui.pUpd = null; return pPaint(); } // intussen uit de party
    const { f, kept } = partyUpdate(cur, got);
    const ch = mergeSheet(structuredClone(cur), structuredClone(f)); // voorproefje op een kopie
    if (!ch.length && !kept.length) { // niets te bevestigen: sheet-details (spells, portret) stil verversen
      const was = document.activeElement; updMember(cur, f); ui.pUpd = null; render(); pFocus(pLink(pid), was); toast(t("init.party.fresh", { name: cur.name })); return;
    }
    ui.pUpd = { pid, st: "ask", f, ch, kept }; pPaint("[data-pupdok]");
  } catch (e) {
    if (ctl !== pUpdCtl || e.name === "AbortError") return;
    if (ui.prep !== "party") { stopPUpd(); return; }
    pUpdCtl = null;
    ui.pUpd = { pid, st: "err", msg: ddbMsg(e.code, true) }; pPaint(pLink(pid));
  }
}

export function bindParty() {
  const panel = $("#party-panel");
  panel.addEventListener("input", (e) => { if (e.target.dataset.pinit) ui.partyInit[e.target.dataset.pinit] = e.target.value; });
  // level per partylid (moeilijkheid)
  panel.addEventListener("change", (e) => {
    const pid = e.target.dataset.plvl; if (!pid) return;
    const m = app.party.find((x) => x.pid === pid); if (!m) return;
    const v = cleanLvl(e.target.value);
    if (e.target.value !== "" && !v) { toastBad(t("init.prep.errLvl")); e.target.value = m.lvl ?? ""; return; } // ongeldig: oude waarde blijft
    m.lvl = v; // de party is de bron (geen undo-stap: hoort niet bij de encounter)
    saveParty(); render();
  });
  panel.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const rollFor = (m) => { const r = d(20), bo = initBo(m), em = exhMod(m), v = r + bo + (em ? em.b : 0); ui.partyInit[m.pid] = v; return `${esc(m.name)}: d20 [${r}] ${sgn(bo)}${esc(initModText(em))} = <b>${v}</b>`; }; // WP50
    const at = new Set(app.S.list.filter((c) => c.pid).map((c) => c.pid));
    if (b.dataset.pupd) { if (ui.pUpd?.st !== "busy") partyFetch(b.dataset.pupd); return; }
    if (b.dataset.pupdno) { ui.pUpd = null; pPaint(pLink(b.dataset.pupdno)); return; }
    if (b.dataset.pupdok) {
      const u = ui.pUpd, m = u && u.st === "ask" && app.party.find((x) => x.pid === u.pid);
      ui.pUpd = null;
      if (!m) { pPaint(); return; }
      const ch = updMember(m, u.f);
      render(); pFocus(pLink(m.pid), b);
      toast(ch.length ? t("init.party.updatedCh", { name: m.name, list: ch.join(", ") }) : t("init.party.updated", { name: m.name }));
      return;
    }
    if (b.dataset.proll) { toastHtml(rollFor(app.party.find((x) => x.pid === b.dataset.proll))); paintParty(); return; }
    if (b.dataset.pdel) {
      const m = app.party.find((x) => x.pid === b.dataset.pdel);
      if (b.dataset.sure) { if (ui.pUpd?.pid === m.pid) stopPUpd(); app.party = app.party.filter((x) => x !== m); app.S.list.forEach((c) => { if (c.pid === m.pid) c.pid = null; }); saveParty(); render(); }
      else { b.dataset.sure = "1"; b.textContent = t("init.party.sure"); }
      return;
    }
    if (b.id === "p-rollall") { toastHtml(app.party.filter((m) => !at.has(m.pid)).map(rollFor).join("<br>") || esc(t("init.party.allHere"))); paintParty(); return; }
    if (b.id === "p-add") {
      const todo = app.party.filter((m) => !at.has(m.pid));
      const fight = !!app.S.round; // SP4: vóór het gevecht null, het paneel bij Start vraagt het
      const missing = fight ? todo.filter((m) => parseInit(ui.partyInit[m.pid]) === null) : [];
      if (missing.length) { toastBad(t("init.party.noInit", { names: missing.map((m) => m.name).join(", ") })); return; }
      because(M("log.w.seatAll"));
      todo.forEach((m) => { seatMember(m, fight ? parseInit(ui.partyInit[m.pid]) : null); delete ui.partyInit[m.pid]; });
      app.S.sample = false; ui.prepLast = app.S.list[app.S.list.length - 1].id; toast(t("init.party.seated", { n: todo.length }));
      if (ui.prep === "party") closePrep(); else render();
      return;
    }
    if (b.id === "p-short" || b.id === "p-long") {
      const long = b.id === "p-long";
      because(long ? "long rest" : "short rest");
      const ex = long ? app.party.filter((m) => exhLevel(m)).map((m) => [m.name, exhLevel(m)]) : [];
      const ed = rulesOf(app.S); // WP50: Exhaustion na de rust volgens de regels van de tafel
      app.party.forEach((m) => R.restMember(m, long, ed));
      app.S.list.forEach((c) => { if (c.pid) R.restMember(c, long, ed); });
      const exT = ex.length ? ` Exhaustion: ${ex.map(([n, x]) => `${n} ${x} → ${x - 1}`).join(", ")}.` : ""; // RE11: één niveau minder
      const pact = [...app.party, ...app.S.list].some((m) => m.casting && m.casting.pact); // RE3
      saveParty(); toast(long ? t("init.party.long", { ex: exT }) : t(pact ? "init.party.shortPact" : "init.party.short")); render();
    }
  });
}

/* ---------- logboek ---------- */
export function bindLog() {
  // reden opslaan; de render pas na het loslaten van een tik, anders vervangt hij de knop (Sluit, Kopieer, achtergrond)
  // vóór zijn click binnenkomt (zelfde patroon als de kaartvelden in main.js)
  let down = false, due = false;
  const later = () => { if (due && !down) { due = false; setTimeout(render, 0); } };
  addEventListener("pointerdown", () => { down = true; }, true);
  addEventListener("pointerup", () => { down = false; later(); }, true);
  addEventListener("pointercancel", () => { down = false; later(); }, true);
  const saveNote = (inp) => { const e = (app.S.log || []).find((x) => x.id === inp.dataset.lognote); if (e) e.note = inp.value.trim(); ui.editLog = null; };
  // twee plekken met dezelfde regels: het blok onder de lijst (Voorbereiden) en het paneel (Gevecht, IN7)
  for (const wrap of [$("#logwrap"), $("#gsheet")]) {
    wrap.addEventListener("click", async (e) => {
      const b = e.target.closest("button, [data-log]"); if (!b) return;
      if (b.dataset.log === "close") { closeLogSheet(); return; }
      if (b.dataset.logedit) { ui.editLog = b.dataset.logedit; paintLog(); return; }
      if (b.id === "logcopy") copyText(logText(app.S.log), t("init.log.copied"), b.closest(".logbox, .gsheet"));
    });
    wrap.addEventListener("keydown", (e) => {
      if (!e.target.dataset.lognote) return;
      if (e.key === "Enter") { e.preventDefault(); saveNote(e.target); render(); $("#gsheet .gsheet")?.focus({ preventScroll: true }); }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); ui.editLog = null; paintLog(); wrap.querySelector(".gsheet")?.focus({ preventScroll: true }); }
    });
    wrap.addEventListener("focusout", (e) => { if (e.target.dataset.lognote && ui.editLog) { saveNote(e.target); due = true; later(); } });
  }
}
/** IN7: logboek-paneel openen vanuit het rondeblok in de Gevecht-kop */
function openLogSheet() { ui.logSheet = true; ui.editLog = null; paintLog(); $("#gsheet .gsheet")?.focus(); }
/** Sluit, Escape, achtergrond: focus terug naar het rondeblok */
function closeLogSheet() { ui.logSheet = false; ui.editLog = null; paintLog(); $("#logopen")?.focus({ preventScroll: true }); }

/** true als het klembord het heeft; anders staat de tekst geselecteerd in `box` */
async function copyText(txt, okMsg, box) {
  try { await navigator.clipboard.writeText(txt); toast(okMsg); return true; }
  catch {
    const ta = document.createElement("textarea");
    ta.value = txt; ta.readOnly = true; ta.style.cssText = "width:100%;min-height:200px;margin-top:8px";
    box.appendChild(ta); ta.select();
    toastBad(t("init.msg.copySel"));
    return false;
  }
}

/* ---------- opslag-tab: export en import ---------- */
/** Strook weg: focus naar Start gevecht, bij een lege lijst (Start uit) naar de eerste knop in de lijst */
const focusAfterStrip = () => ($("#start:not([disabled])") || $("#order button") || $("#order"))?.focus({ preventScroll: true });
const exportJson = () => JSON.stringify(buildExport(app));
/**
 * Exporteer als bestand (Instellingen en de herinneringsstrook, DA1). Telefoon: deelmenu (Opslaan in Bestanden), en pas
 * na een gelukte share telt het als export; geannuleerd = niets. Anders downloaden (best effort: telt meteen).
 * Geeft true als het als geëxporteerd telt.
 */
async function exportFile() {
  const json = exportJson(), name = exportName(new Date());
  try {
    const f = new File([json], name, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: t("init.exp.shareTitle", { app: APP }) }); return done(); }
  } catch (err) { if (err && err.name === "AbortError") return false; } // geannuleerd; andere fout: downloaden
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([json], { type: "application/json" })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return done();
  function done() { markExported(); paintExpLast(); toast(t("init.exp.done")); return true; }
}
export function bindBackup(afterImport) {
  const seg = $("#theme-seg");
  const showTheme = (mode) => seg.querySelectorAll("[data-theme-set]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.themeSet === mode));
  showTheme(window.itTheme?.get() ?? "system");
  seg.addEventListener("click", (e) => {
    const b = e.target.closest("[data-theme-set]");
    if (b && window.itTheme) showTheme(window.itTheme.set(b.dataset.themeSet));
  });
  // GV4: Reaction van spelers als knop of door spelers zelf bijgehouden (alleen weergave)
  const xseg = $("#react-seg");
  const showReact = (on) => xseg.querySelectorAll("[data-react]").forEach((b) => b.setAttribute("aria-pressed", (b.dataset.react === "on") === on));
  showReact(pcReact());
  xseg.addEventListener("click", (e) => { const b = e.target.closest("[data-react]"); if (b) { showReact(setPcReact(b.dataset.react)); render(); } });
  // WP54 (G1): Regels 2014 | 2024 van de tafel (S.rules): één undo-stap met logregel, Exhaustion van de tafel omgerekend;
  // alleen zonder gevecht (knoppen dan uitgeschakeld, paintRules). Seg en Spells-subblok tekent paintRules bij elke render.
  $("#ruleset-seg").addEventListener("click", (e) => {
    const b = e.target.closest("[data-ruleset]");
    const r = b && !b.disabled && R.setRules(app.S, b.dataset.ruleset);
    if (!r) return;
    logAs(M("log.rules", { from: r.from, to: r.to }));
    addWhy(r.why);
    render();
    toastHtml(`${esc(t("init.set.rulesToast", { ed: r.to }))} ${undoBtn()}`);
  });
  // Spells 2014 | 2024 (alleen bij regels 2014): regels én uitleg; render volgt meteen (presets en concentratie)
  $("#rules-seg").addEventListener("click", (e) => { const b = e.target.closest("[data-rules]"); if (b) { setRulesEd(b.dataset.rules); render(); } });
  // Wat spelers zien: per apparaat; render() maakt een nieuwe snapshot, dus alle spelersschermen volgen meteen
  const vbox = $("#vis-box");
  const val = (v) => (v === "true" ? true : v === "false" ? false : v);
  const showVis = (V) => vbox.querySelectorAll("[data-vis]").forEach((g) => g.querySelectorAll("[data-v]").forEach((b) => b.setAttribute("aria-pressed", val(b.dataset.v) === V[g.dataset.vis])));
  showVis(visNow());
  vbox.addEventListener("click", (e) => {
    const b = e.target.closest("[data-v]"), g = b && b.closest("[data-vis]");
    if (g) { showVis(setVis(g.dataset.vis, val(b.dataset.v))); render(); }
  });
  $("#exp-file").addEventListener("click", () => exportFile());
  $("#exp-copy").addEventListener("click", async () => { if (await copyText(exportJson(), t("init.exp.copied"), $("#data-panel"))) { markExported(); paintExpLast(); } });

  let pending = null;
  const ask = (data) => {
    pending = data;
    const nMon = data.custom.length + data.imported.length, nLair = Object.keys(data.lairs).length;
    const what = [t("init.imp.party", { n: data.party.length }), t("init.imp.table", { n: data.S.list.length }), t("init.imp.mons", { n: nMon }), t("init.imp.lairs", { n: nLair }), t("init.imp.encs", { n: data.encounters.length })];
    const nNote = Object.keys(data.spellNotes).length;
    if (nNote) what.push(t("init.imp.notes", { n: nNote })); // alleen als er notities zijn (WP42)
    $("#imp-confirm").innerHTML = `<div class="confirmbox"><p style="margin:0">${esc(t("init.imp.has", { what }))} ${tb("init.imp.replaces", {}, t("init.imp.replacesB"))}</p>
      <div class="bar"><button type="button" class="btn primary" id="imp-yes">${esc(t("init.imp.go"))}</button><button type="button" class="btn small" id="imp-no">${esc(t("common.cancel"))}</button></div></div>`;
    $("#imp-confirm").scrollIntoView({ block: "nearest" }); // ook vanaf de welkomstkaart in beeld (AF10)
  };
  const read = (text) => {
    try { ask(parseImport(JSON.parse(text))); }
    catch (err) { toastBad(err instanceof SyntaxError ? t("init.imp.noJson") : err.message); }
  };
  $("#imp-backup").addEventListener("change", async (e) => { const f = e.target.files[0]; if (f) read(await f.text()); e.target.value = ""; });
  $("#imp-text-go").addEventListener("click", () => { const txt = $("#imp-text").value.trim(); if (txt) read(txt); });
  $("#imp-confirm").addEventListener("click", (e) => {
    if (e.target.id === "imp-no") { pending = null; $("#imp-confirm").innerHTML = ""; }
    if (e.target.id === "imp-yes" && pending) {
      Object.assign(app, { S: pending.S, party: pending.party, lairs: pending.lairs, custom: pending.custom, imported: pending.imported, encounters: pending.encounters, spellNotes: pending.spellNotes });
      saveParty(); saveLairs(); saveLibrary(); saveEncounters(); saveSpellNotes(); resetNoteUndo(); // ook opslaan (en de monsterbibliotheek bijwerken), niet alleen de lopende encounter
      markExported(); paintExpLast(); // de data komt uit een export: die bestaat dus al ergens
      pending = null; $("#imp-confirm").innerHTML = ""; $("#imp-text").value = "";
      afterImport();
      toast(t("init.imp.done"));
    }
  });
}
