// Alle gebruikersacties. Knoppen dragen data-a="naam" (rij-acties) of een id (algemene acties).
import { openSettings } from "./settings.js";
import { $, esc, n0, toast, toastHtml, closeToast, show } from "./util.js";
import { app, because, addWhy, commit, undo, historySize, stepNo, saveLairs, saveParty, saveLibrary, saveEncounters, resetBaseline } from "../state.js";
import { render, ui, openId, mode, paintLog, paintParty, paintQadd, monListHtml, monLabel, monPrev, addLabel, HID_HINT, ANON_HINT, paintAoe, paintLa, paintSv, paintAtk, paintInit, laOpts, atkRoll, laCan, svBonus, selfRoll, aoeTargets, aoePick, okSave, editPreview, editKeys, addBlockHtml, addBlockTap, addHint, addInit, addHp, curSpell, spellPick, paintExpLast } from "./render.js";
import { castSpell, casterDC, spellTargets, castKey } from "../rules/spellcast.js";
import { addSave, resolveSave, openSaves, isValid } from "../rules/saves.js";
import { useLA } from "../rules/legendary.js";
import { PRESETS, presetsFor, addEffect, removeEffect, endFightEffects, baseMax, endOtherCasts, saveMods, effAc } from "../rules/effects.js";
import { showSB, showSheet, doRoll, doDmgRoll, closeSB, toggleBigSB, togglePinSB, followTurn, wantSB, sbTop, previewSB } from "./statblock.js";
import { findMon, allMonsters, parseMonsterFile, filterMonsters } from "../data/monsters.js";
import { d, mod, sgn, uid, rollExpr, HD_RE, avgExpr } from "../rules/dice.js";
import { step, startCombat, stopCombat, clearMonsters, setInits, initPcs, makeDur, parseInit, isOut, sortOrder, setSurprise, toggleSurprise, rerollMonsters, removeCombatant, setInit } from "../rules/turns.js";
import * as R from "../rules/combat.js";
import { applyAoe, saveBonus, clampDmg, newPick, rollSave, rollText, hasMagicRes, DTYPES, targetMode, drToggle, drKind, DR_LBL, cleanDr } from "../rules/aoe.js";
import { monsterActions, actionAoe, rcIndex, partsKey, rollAttack, rollDmgCrit, atkResult, atkWhy, atkDamage } from "../rules/attacks.js";
import { castInfo, legInfo, rcInfo, pickList, isConc, edFor } from "../rules/spells.js";
import { rulesEd, setRulesEd } from "./spellrules.js";
import { initRoll, setInitRoll } from "./initroll.js";
import { visNow, setVis } from "./playervis.js";
import { nextAnon } from "../playerview.js";
import { spellClick as spellInfoClick, spellOpen, closeSpell } from "./spellinfo.js";
import { logText } from "../log.js";
import { readSheetPdf, fetchDdb, ddbMsg } from "../ddb.js";
import { parseDdbLink, findMember, mergeSheet, partyUpdate, seatPlan } from "../ddbjson.js";
import { RACE_OPTS, raceKey, pickRace, cleanImg } from "./avatar.js";
import { buildExport, parseImport } from "../backup.js";
import { markExported, snoozeNudge } from "../exportnudge.js";
import { cleanLvl } from "../rules/encounters.js";
import { startFight } from "../rules/fight.js";
import { finishFight, closeEnd } from "./einde.js";
import { pcReact, setPcReact } from "./pcreact.js";
import { armTour, restartTour } from "./tour.js";

/** Fx uit de regels: meldingen tonen en oorzaken doorgeven aan het logboek */
/** RE17: nieuwe concentration saves uit schade, als staart voor de melding (bediening alleen in de beurtbalk) */
const concNote = (f) => {
  const C = ((f && f.saves) || []).filter((s) => s.kind === "conc");
  return !C.length ? "" : C.length === 1 ? ` · concentratie-save CON ${C[0].dc} in de beurtbalk` : ` · ${C.length} concentratie-saves in de beurtbalk`;
};
const apply = (fx) => { if (!fx) return; addWhy(fx.why); show(fx); if (fx.saves) fx.saves.forEach((x) => addSave(app.S, x)); };

/* ---------- monsters toevoegen ---------- */
/**
 * initmode: "each" (per monster rollen), "group" (één worp) of "fixed" (initiative = fixed, bijv. al aan tafel gerold).
 * hidden: meteen verborgen voor spelers (vóór de eerste render, dus vóór de eerste snapshot).
 */
export function addMonsters(name, n, hpmode, initmode, silent, fixed = null, hidden = false, anon = false) {
  const S = app.S, m = findMon(name);
  if (!m) return;
  const dx = mod(m.ab ? m.ab[1] : m.dexScore || 10);
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
    const c = { id: uid(), name: label, kind: "monster", ref: m.n, ...(grp ? { grp } : {}), ...(hidden ? { hidden: true } : {}), ...(anon ? { anon: nextAnon(S.list) } : {}), init: set ? fixed : r + dx, roll: r, dex: dx, ac: parseInt(m.ac) || 10, hp, max: hp, cond: [], ...legInfo(m), rc: rcInfo(m), casting: castInfo(m) };
    S.list.push(c); out.push(c);
    because(`${set ? "initiative ingevuld" : `d20 [${r}] ${sgn(dx)}`}${group !== null && n > 1 ? ", groepsworp" : ""}${hpmode === "roll" && m.hd ? `, HP gerold (${m.hd})` : ""}`, c.id);
  }
  if (!silent) {
    S.sample = false;
    wantSB(out[out.length - 1].id); // zijkolom toont het net toegevoegde monster
    toastHtml(out.map((c) => `${esc(c.name)}: ${c.roll === undefined ? "initiative" : `d20 [${c.roll}] ${sgn(c.dex)} =`} <b>${c.init}</b>`).join("<br>") + (hidden ? "<br>Verborgen voor spelers" : "") + (anon ? "<br>Naam onbekend voor spelers" : ""));
  }
}

/** Nieuwe lair-deelnemer (init 20, verliest gelijke stand); acties staan in app.lairs[key] */
export const newLair = (key, hidden = false) => ({ id: uid(), name: key, key, kind: "lair", init: 20, dex: -99, cond: [], last: null, ...(hidden ? { hidden: true } : {}) });
/** UI-toestand die na monsters wissen (ook encounter vervangen) niet meer klopt */
export const CLEAR_UI = { confirmReset: false, open: null, panel: null, edit: null, atk: null, aoe: null, la: null, sv: false,
  effWho: null, castPick: null, atkOpen: null, atkRx: null, atkAdv: null, atkPrev: null, svRetry: null, confirmDel: null };

/** Vult ontbrekende velden aan bij deelnemers uit oudere versies of imports */
export function normalize(c) {
  c.cond = c.cond || [];
  if (c.kind === "lair") { if (!c.key) c.key = c.name; return; }
  if (!c.ref) return;
  const m = findMon(c.ref);
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
  let by = null, cast = join || castKey(S.round, S.active), old = null;
  if (p.conc) {
    const caster = S.list.find((x) => x.id === byId);
    if (caster) {
      by = caster.id;
      if (caster.cond.includes("Concentrating") && caster.concSpell === p.n) { // Bless op 3 doelen: alleen koppelen
        if (!join) {
          const prev = S.list.flatMap((x) => (x.eff || []).filter((e) => e.by === by && e.spell === p.n && e.cast !== cast).map((e) => ({ x, e })));
          if (prev.length) {
            old = { cast: prev[0].e.cast || "", names: [...new Set(prev.map((o) => o.x.name))] };
            out.why.push(...endOtherCasts(S.list, by, p.n, cast, S.active).why, { t: `${p.n} opnieuw gecast`, id: by }); // meldingen: één samenvatting hieronder
          }
        }
      } else R.merge(out, R.startConc(caster, p.n));
    }
  }
  R.merge(out, addEffect(c, p, d, { lr: p.dur === "lr", by, spell: p.n, cast }));
  if (p.react) c.reaction = true;
  addWhy(out.why);
  ui.effWho = null;
  if (!old) return { undoToast: out.msgs.join(" ") };
  ui.effJoin = { id: c.id, p, by, cast: old.cast, step: stepNo() + 1 }; // alleen geldig zolang dit de laatste stap is (commit volgt in render)
  const caster = S.list.find((x) => x.id === by);
  return { undoToast: `${p.n}: nieuwe cast van ${caster.name}. Vervalt bij ${old.names.join(", ")}.`, extra: `<button class="tundo" id="toast-join">Hoort erbij</button> ` };
}

/* ---------- acties per deelnemer: (c, knop, rij-element) ---------- */
const row = {
  sb: (c) => showSB(c),
  sheet: (c) => showSheet(c),
  "atk-open"(c) { ui.atkOpen = c.id; },
  "atk-close"() { ui.atkOpen = null; },
  "atk-rx"(c) { ui.atkRx = ui.atkRx === c.id ? null : c.id; },
  del(c) {
    if (c.kind !== "lair" && ui.confirmDel !== c.id) { ui.confirmDel = c.id; return; }
    apply(removeCombatant(app.S, c.id)); ui.confirmDel = null; ui.panel = null;
  },
  open(c, b, li) {
    const isOpen = openId() === c.id;
    ui.open = isOpen ? "" : c.id;
    ui.fromDown = !isOpen && li && li.dataset.down ? c.id : null; // uit het blok "Neer" geopend: blijft daar staan
    ui.panel = null; ui.confirmDel = null; ui.castPick = null; ui.edit = null; ui.effWho = null; ui.effCustom = false; ui.effForm = {}; ui.drOpen = null;
    return "scroll";
  },
  panel(c, b) {
    ui.panel = ui.panel === b.dataset.p ? null : b.dataset.p; ui.confirmDel = null; ui.effWho = null;
    // keys: alleen wat het paneel toont, zodat Opslaan niets terugzet wat intussen direct op de kaart is aangepast
    ui.edit = ui.panel === "more" ? { id: c.id, name: c.name, ac: c.ac || "", max: baseMax(c) || "", init: c.init, dirty: false, keys: editKeys(c, mode() === "prep") } : null;
  },
  /* ---- bewerken (⋯) ---- */
  "ed-cancel"() { ui.edit = null; ui.panel = null; },
  "ed-save"(c) {
    const ed = ui.edit;
    if (!ed || ed.id !== c.id) return false;
    const name = String(ed.name).trim().slice(0, 120);
    if (!name) { toast("Naam mag niet leeg zijn."); return false; }
    c.name = name;
    const has = (k) => !ed.keys || ed.keys.includes(k);
    const ac = parseInt(ed.ac);
    if (has("ac")) c.ac = Number.isFinite(ac) ? Math.max(0, Math.min(40, ac)) : 0;
    const mx = parseInt(ed.max), extra = (c.max || 0) - baseMax(c);
    if (has("max") && Number.isFinite(mx) && mx > 0 && mx !== baseMax(c)) R.setMax(c, mx + extra); // effecten (Aid) blijven bovenop
    const ini = parseInit(ed.init);
    because("bewerkt");
    if (has("init") && ini !== null && ini !== c.init) apply(setInit(app.S, c, ini)); // RE9: al geweest / ingeschoven
    ui.edit = null; ui.panel = null;
  },
  /* ---- effecten ---- */
  effp(c, b) {
    const i = +b.dataset.i, p0 = PRESETS[i];
    if (!p0) return false;
    // editie per caster: zijn D&D Beyond-sheet, anders de instelling Spells (Barkskin 2024 = geen concentratie)
    const act = app.S.list.find((x) => x.id === app.S.active), p = presetsFor(edFor(act, p0.n, rulesEd()))[i];
    if ((p0.conc || p.conc) && !act) { ui.effWho = { id: c.id, i }; return; } // geen beurt: vraag wie cast (de sheet bepaalt de editie)
    return applyEff(c, p, p.conc ? act.id : null);
  },
  effby(c, b) {
    const w = ui.effWho; if (!w || w.id !== c.id || !PRESETS[w.i]) return false;
    const by = app.S.list.find((x) => x.id === b.dataset.by), p = presetsFor(edFor(by, PRESETS[w.i].n, rulesEd()))[w.i];
    return applyEff(c, p, p.conc ? b.dataset.by : null);
  },
  "effwho-no"() { ui.effWho = null; },
  effcustom() { ui.effCustom = !ui.effCustom; },
  "eff-add"(c) {
    const f = ui.effForm, k = f.k || "ac+";
    const st = k.startsWith("ac") ? "ac" : k === "max" ? "max" : "";
    const spec = { n: String(f.n || "").trim() || "Effect", st, op: k === "ac=" ? "=" : k === "acmin" ? "min" : "+", v: parseInt(f.v) || 0, txt: f.txt || "" };
    if (st === "ac" && spec.op === "+" && !c.ac) { toast("Vul eerst AC in (⋯)."); return false; }
    if (st && !spec.v) { toast("Vul een waarde in."); return false; }
    if (!st && !spec.txt && !f.n) { toast("Geef het effect een naam of notitie."); return false; }
    const by = f.by && app.S.list.some((x) => x.id === f.by) ? f.by : null;
    ui.effForm = {}; ui.effCustom = false;
    return applyEff(c, { ...spec, dur: f.dur || "inf", conc: !!by }, by);
  },
  effdel(c, b) { apply(removeEffect(c, b.dataset.e, "handmatig", { active: app.S.active })); },
  "sheet-open"(c, b) { ui.sheet = { id: c.id, kind: b.dataset.kind, val: "", mode: 1, from: b.classList.contains("khp") ? "khp" : b.dataset.kind }; },
  react(c) { c.reaction = !c.reaction; },
  hide(c) { if (c.hidden) delete c.hidden; else c.hidden = true; },
  /* ---- resistances van een speler (SP2, in ⋯) ---- */
  "dr-open"(c) { ui.drOpen = ui.drOpen === c.id ? null : c.id; ui.drKind = "r"; },
  "dr-kind"(c, b) { if (DR_LBL[b.dataset.v]) ui.drKind = b.dataset.v; },
  "dr-t"(c, b) {
    const t = b.dataset.t, k = ui.drKind;
    if (!DTYPES.includes(t) || !DR_LBL[k]) return false;
    const was = drKind(c.dr, t), dr = drToggle(c.dr, k, t);
    if (dr) c.dr = dr; else delete c.dr;
    because(was === k ? `${DR_LBL[k]} ${t} weg` : `${DR_LBL[k]} ${t}${was ? ` (was ${DR_LBL[was]})` : ""}`, c.id);
  },
  anon(c) { if (c.anon) delete c.anon; else c.anon = nextAnon(app.S.list); },
  sur(c) { const r = toggleSurprise(c, app.S); if (!r) return false; apply(r); },
  dropconc(c) { apply(R.dropConc(c, "beëindigd")); },
  topty(c) { const ex = app.party.find((m) => m.name.toLowerCase() === c.name.toLowerCase()); c.pid = ex ? ex.pid : uid(); toast(`${c.name} staat nu in de vaste party.`); },
  "ds-roll": (c) => apply(R.rollDs(c)),
  "ds-crit": (c) => apply(R.critAtZero(c)),
  "cast-reset"(c) {
    c.casting.slots.forEach((x) => (x.left = x.max));
    c.casting.daily.forEach((g) => g.items.forEach((x) => (x.left = x.max)));
    (c.res || []).forEach((x) => (x.left = x.max));
  },
  "lair-add"(c, b, li) {
    const n = li.querySelector('[data-f="la-n"]').value.trim(), t = li.querySelector('[data-f="la-t"]').value.trim();
    if (!n || !t) { toast("Vul een naam en een effect in."); return false; }
    app.lairs[c.key] = [...(app.lairs[c.key] || []), { n, t }]; saveLairs();
  },
  "lair-del"(c, b) { app.lairs[c.key].splice(+b.dataset.i, 1); saveLairs(); },
  "lair-use"(c, b) { c.last = app.lairs[c.key][+b.dataset.i].n; },
};

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
  if (k === "apply") {
    const c = app.S.list.find((x) => x.id === s.id), n = parseInt(s.val) || 0;
    if (!c || !n) return;
    const f = s.kind === "dmg" ? R.applyDamage(c, n, s.mode) : s.kind === "heal" ? R.heal(c, n) : R.giveTemp(c, n);
    apply(f);
    const before = { dmg: `−${Math.floor(n * s.mode)}`, heal: `+${n}`, thp: `+${n} temp` }[s.kind];
    ui.sheet = null;
    return { back: s, undoToast: `${c.name} ${before} HP → ${c.hp}/${c.max}${c.temp ? ` (+${c.temp} temp)` : ""}${concNote(f)}` };
  }
}

/** Na een schadepaneel-toets: melding, en bij sluiten de focus terug naar wat het paneel opende (toetsenbord) */
function sheetDone(res) {
  if (!res) return;
  if (res.undoToast) toastHtml(`${esc(res.undoToast)} <button class="tundo" id="toast-undo">Ongedaan</button>`);
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
    const o = ds.slot !== undefined ? c.casting.slots[+ds.slot] : (([g, i]) => c.casting.daily[g].items[i])(ds.daily.split(".").map(Number));
    const spend = +ds.i < o.left;
    toggle(o, +ds.i);
    ui.castPick = null;
    if (spend && ds.slot !== undefined && pickList(c, o.lvl, rulesEd()).some((x) => x.conc)) ui.castPick = { id: c.id, lvl: o.lvl };
    if (spend && ds.daily !== undefined && isConc(o.n, edFor(c, o.n, rulesEd()))) apply(R.startConc(c, o.n.replace(/\(.*?\)/g, "").trim()));
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

/* ---------- algemene acties (op id) ---------- */
const global = {
  "toast-undo"() { closeToast(); return global.undo(); },
  /** Bless "nieuwe cast" was toch een extra doel: terugdraaien en bij de vorige cast aansluiten */
  "toast-join"() {
    const j = ui.effJoin; closeToast(); ui.effJoin = null;
    if (!j || stepNo() !== j.step || !undo()) return;
    const c = app.S.list.find((x) => x.id === j.id);
    if (c) { const r = applyEff(c, j.p, j.by, j.cast || "-"); toastHtml(`${esc(r.undoToast)} <button class="tundo" id="toast-undo">Ongedaan</button>`); }
  },
  /** Gefaalde monster-save: toch Legendary Resistance, of opnieuw met advantage (Magic Resistance tegen een spell) */
  "toast-svlr"() { svRetry((c, sid) => { if (!c.lr || c.lr.left < 1) return; c.lr.left--; because("legendary resistance gebruikt", c.id); svDone(c, sid, true, "legendary resistance", ""); }); },
  "toast-svadv"() { svRetry((c, sid) => svRoll(sid, true)); },
  undo() { if (undo()) { ui.confirmReset = false; toast(`Ongedaan gemaakt${historySize() ? ` (nog ${historySize()} stappen terug)` : ""}.`); } },
  // na starten of stoppen volgt de modus weer het gevecht (ui.mode = null)
  start() {
    // spelers eerst hun initiative (paneel); vanuit het paneel komt start terug met initSkip
    if (!ui.initSkip && !app.S.round && initPcs(app.S.list).length) { openInit(); return false; }
    ui.initSkip = false;
    startFight(app.S, Date.now()); // GV2: duur en wie neer ging; oude samenvatting weg
    // GV5: onaangeroerde monsterworpen opnieuw (keuze in het paneel; zonder spelers de onthouden keuze), zelfde undo-stap;
    // !round is een vangnet (#start bestaat alleen vóór het gevecht)
    const rr = !app.S.round && initRoll() === "roll" ? rerollMonsters(app.S.list) : null;
    apply(rr ? R.merge(rr, startCombat(app.S)) : startCombat(app.S)); ui.mode = null; rekeyEdit();
    armTour("f"); // OB1: tweede deel van de rondleiding bij de eerste keer Gevecht (alleen als deel f nog niet gezien is)
  },
  next() { apply(step(app.S, 1)); ui.laPulse = true; },
  "down-tog"() { ui.downOpen = !ui.downOpen; },
  prev() { apply(step(app.S, -1)); },
  /** Gevecht afronden (GV2): samenvatting (paneel + logregel) en stoppen in één undo-stap */
  stop() {
    const r = app.S.round;
    finishFight();
    apply(stopCombat(app.S)); ui.mode = null; rekeyEdit();
    render();
    toastHtml(`${esc(`Gevecht afgerond na ronde ${r}.`)} <button class="tundo" id="toast-undo">Ongedaan</button>`);
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
    toastHtml(`${esc(`${r.n ? `${r.n} monster${r.n === 1 ? "" : "s"}` : ""}${r.n && r.lairs ? " en " : ""}${r.lairs ? "lair" : ""} gewist. Spelers blijven; hun initiative vul je in bij Start gevecht.`)} <button class="tundo" id="toast-undo">Ongedaan</button>`);
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
  "welcome-sample"() { loadSample(); ui.welcome = false; armTour("p"); },
  "welcome-empty"() { ui.welcome = false; armTour("p"); },
  // OB2: rondleiding opnieuw (Instellingen → Hulp): paneel dicht, het deel van de huidige modus start na de render
  "tour-again"() { stopPUpd(); ui.prep = null; ui.prepLast = null; ui.mode = null; restartTour(); },
  /** DA1: strook "Geen recente export" in Voorbereiden */
  "exp-now"() { exportFile().then((ok) => { if (ok) { render(); focusAfterStrip(); } }); return false; },
  "exp-later"() { snoozeNudge(); render(); focusAfterStrip(); toast("Herinnering over 7 dagen weer."); return false; },
  /** Voorbeeld weg: zelfde als "Alles wissen", met Ongedaan */
  "sample-clear"() {
    app.S = { list: [], round: 0, active: null, sample: false }; Object.assign(ui, { welcome: false, open: null, panel: null, mode: null, confirmReset: false });
    render();
    toastHtml(`Voorbeeld gewist. <button class="tundo" id="toast-undo">Ongedaan</button>`);
    return false;
  },
  reset() { ui.confirmReset = true; },
  "reset-no"() { ui.confirmReset = false; },
  "reset-yes"() { app.S = { list: [], round: 0, active: null, sample: false }; ui.confirmReset = false; ui.mode = null; },
  spelers() {
    if (!window.open("speler", "it-spelers")) toast("Het venster werd geblokkeerd. Sta pop-ups toe voor deze site.");
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

/** Voorbeeld-encounter: twee spelers (level 3, zodat de moeilijkheid meteen een oordeel geeft: Hard), twee Goblins en een Hobgoblin (één undo-stap) */
export function loadSample() {
  app.S.list.push(
    { id: uid(), name: "Thalia (voorbeeld)", kind: "pc", race: "Elf", lvl: 3, init: 17, dex: 3, ac: 15, hp: 24, max: 24, cond: [] },
    { id: uid(), name: "Brom (voorbeeld)", kind: "pc", race: "Dwarf", lvl: 3, init: 9, dex: 0, ac: 18, hp: 31, max: 31, cond: [] },
  );
  addMonsters("Goblin", 2, "avg", "each", true);
  addMonsters("Hobgoblin", 1, "avg", "each", true);
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
  if (b.dataset.svok) { const s = (app.S.saves || []).find((x) => x.sid === b.dataset.svok), c = s && app.S.list.find((x) => x.id === s.id); if (c) svDone(c, s.sid, b.dataset.v === "1", "", ""); return; }
  if (b.dataset.svrollall) { svRollAll(); return; }
  if (b.dataset.svsheet) { ui.sv = b.dataset.svsheet === "1"; if (ui.sv) { ui.sheet = null; ui.qadd = null; ui.aoe = null; ui.la = null; ui.atk = null; } render(); if (ui.sv) $("#ssheet .ssheet")?.focus(); else $("[data-svsheet]")?.focus(); return; }
  if (b.dataset.la) { openLa(b.dataset.la); return; }
  if (b.dataset.lsh === "close") { closeLa(); return; }
  if (b.dataset.lause) { laUse(b.dataset.lause, +b.dataset.i); return; }
  if (b.id && global[b.id]) {
    if (global[b.id]() === false) return;
    if (["start", "next", "prev"].includes(b.id)) {
      // een niet-opgeslagen bewerking blijft open staan; anders volgt de open kaart de beurt
      if (ui.edit && ui.edit.dirty) { ui.open = ui.edit.id; rekeyEdit(); } else { ui.open = null; ui.panel = null; ui.edit = null; }
      ui.fromDown = null;
      ui.castPick = null; ui.effWho = null; ui.atkOpen = null; ui.atkRx = null; ui.atkAdv = null; ui.atk = null;
    }
    render();
    ui.laPulse = false; // alleen de render direct na Volgende laat de legendary-knoppen oplichten
    if (["start", "next", "prev"].includes(b.id)) scrollToCard(app.S.active);
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
  if (res && res.undoToast) toastHtml(`${esc(res.undoToast)} ${res.extra || ""}<button class="tundo" id="toast-undo">Ongedaan</button>`);
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
  const keys = editKeys(c, mode() === "prep"), now = { name: c.name, ac: c.ac || "", max: baseMax(c) || "", init: c.init };
  for (const k of keys) if (!(ed.keys || []).includes(k)) ed[k] = now[k];
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
  if (raw !== "" && !v) { toast("Level is 1 t/m 20."); return false; }
  if (m) { if ((m.lvl ?? null) !== v) { m.lvl = v; saveParty(); } return true; }
  if (c && (c.lvl ?? null) !== v) { c.lvl = v ?? undefined; because("level", c.id); commit(); }
  return true;
}

/**
 * Kaart in Voorbereiden (IN2): een veld slaat op zodra het de focus verliest. Direct vastleggen (commit: undo-stap,
 * logboek, opslag) maar niet renderen: dan zou de tik op het volgende veld of een knop verloren gaan. main.js
 * rendert na het verlaten van de velden (focusout). Ongeldig: oude waarde terug en een melding.
 */
function prepField(c, t) {
  const k = t.dataset.pf, raw = t.value.trim();
  const back = (msg) => { toast(msg); t.value = { init: c.init, max: baseMax(c) || "", hp: c.hp, ac: c.ac || "" }[k] ?? t.value; };
  if (k === "lvl") { if (!saveLevel({ cid: c.id }, raw)) { const m = c.pid && app.party.find((x) => x.pid === c.pid); t.value = (m ? m.lvl : c.lvl) ?? ""; } return; }
  const n = parseInt(raw);
  if (k === "init") {
    const v = parseInit(raw);
    if (v === null) return back("Initiative moet een getal zijn.");
    if (v === c.init) return;
    because("in Voorbereiden aangepast", c.id); apply(setInit(app.S, c, v)); // RE9: tijdens een gevecht
  } else if (k === "max") {
    if (!(n > 0)) return back("Max HP moet minstens 1 zijn.");
    if (n === baseMax(c)) return;
    R.setMax(c, n + ((c.max || 0) - baseMax(c))); because("in Voorbereiden aangepast", c.id); // effecten (Aid) blijven bovenop
  } else if (k === "hp") {
    if (!Number.isFinite(n) || n < 0) return back("HP moet 0 of meer zijn.");
    if (n === c.hp) return;
    const fx = R.setHp(c, n); because("HP bijgewerkt in Voorbereiden", c.id); apply(fx);
    if (c.hp !== n) t.value = c.hp; // begrensd op max, of dood
  } else if (k === "ac") {
    if (raw !== "" && !(n >= 0 && n <= 40)) return back("AC is 0 t/m 40.");
    const v = raw === "" ? 0 : n;
    if (v === (c.ac || 0)) return;
    c.ac = v; because("in Voorbereiden aangepast", c.id);
  } else return;
  commit();
}

export function onKey(e) {
  if (e.key === "Enter" && e.target.dataset && e.target.dataset.pf) { e.preventDefault(); e.target.blur(); return; } // veld op de kaart: klaar = opslaan
  if (spellOpen()) { if (e.key === "Escape") { e.preventDefault(); closeSpell(); } return; } // ligt boven alle andere panelen: toetsen niet naar het cijferpad eronder
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
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) { e.preventDefault(); ui.qadd = null; ui.aoe = null; ui.atk = null; ui.initDraft = null; global.undo(); render(); return; }
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

/** Bijwerken toepassen: partylid én wie aan tafel zit (zelfde pid). Eén undo-stap voor de tafel; geeft de wijzigingen terug */
function updMember(m, f) {
  for (const c of app.S.list) if (c.pid === m.pid) mergeSheet(c, structuredClone(f));
  const ch = mergeSheet(m, structuredClone(f));
  because(`${f.name} bijgewerkt via D&D Beyond`);
  saveParty();
  return ch;
}

/** Onzekere AC/HP markeren (verdwijnt zodra de DM het veld aanpast) */
function setCheck(check) {
  const why = [];
  for (const [k, lbl] of [["ac", "AC"], ["hp", "max HP"]]) {
    const r = check ? check[k] : [];
    $("#pc-" + k).closest("label").classList.toggle("warn", r.length > 0);
    if (r.length) why.push(`Controleer ${lbl}: ${r.join(", ")}.`);
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
  $("#pc-name").value = h.name; $("#pc-ac").value = h.ac || ""; $("#pc-hp").value = h.max || ""; $("#pc-dex").value = h.dex;
  $("#pc-race").value = RACE_OPTS.find((r) => raceKey(r) === raceKey(h.race)) || "";
  const sl = h.casting ? h.casting.slots.map((x) => `${x.lvl}e: ${x.max}`).join(", ") : "geen";
  $("#pc-sheetinfo").innerHTML = `<b>${esc(h.name)}</b> geladen (${esc([h.race, h.cls].filter(Boolean).join(", "))})${pendingImg ? `, met portret <img class="pv" src="${esc(pendingImg)}" alt="">` : ""}. Spell slots: ${esc(sl)}${h.res.length ? `. Resources: ${esc(h.res.map((r) => r.n + " " + r.max).join(", "))}` : ""}. Vul initiative in of tik op Rol.`;
}

/** Wat Bijwerken overneemt: formulierwaarden (de DM kan AC/HP gecorrigeerd hebben) + sheet */
function formUpdate() {
  const sh = pendingSheet;
  return {
    name: $("#pc-name").value.trim() || sh.name, race: pickRace($("#pc-race").value, sh.race),
    ac: parseInt($("#pc-ac").value) || 0, max: parseInt($("#pc-hp").value) || 0, dex: parseInt($("#pc-dex").value) || 0,
    initBonus: sh.initBonus, sheet: sh, ddbId: pendingDdb || undefined, img: pendingImg, // PDF: geen id, het bestaande blijft casting: sh.casting || null, res: sh.res || [],
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
  const m = curMatch(), btn = $("#pc-add"), init = $("#pc-init");
  const here = !!m && app.S.list.some((c) => c.pid === m.pid), plan = seatPlan(!!m, here, !!pendingSheet);
  btn.disabled = plan === "none";
  btn.textContent = PLAN_LBL[plan];
  init.required = !here;
  if (!m) { $("#pc-match").innerHTML = dupHint(); return; }
  const nm = `<b>${esc(m.name)}</b>`;
  let txt;
  if (pendingSheet) {
    const ck = pendingCheck || { ac: [], hp: [] };
    const ch = mergeSheet(structuredClone(m), structuredClone(formUpdate())) // alleen voorproefje, op een kopie
      .map((t) => (/^AC /.test(t) && ck.ac.length) || (/^max HP /.test(t) && ck.hp.length) ? t + " (controleer)" : t);
    const what = ch.length ? esc(ch.join(" · ")) : "geen wijzigingen in klasse, AC, HP of spell slots";
    txt = here ? `${nm} staat al in de party en zit aan tafel. Bijwerken: ${what}. Schade en verbruik blijven staan, initiative ook.`
      : `${nm} staat al in de party. Toevoegen werkt de sheet bij: ${what}. Schade en verbruik blijven staan.`;
  } else {
    txt = here ? `${nm} staat in de party en zit al aan tafel.`
      : `${nm} staat al in de party${m.max ? ` (${n0(m.hp)}/${n0(m.max)} HP)` : ""}. Toevoegen zet ${esc(m.name)} aan tafel met de bewaarde HP en slots.`;
  }
  $("#pc-match").innerHTML = `<div class="confirmbox"><p class="hint" style="margin:0">${txt}</p>
    <div class="bar"><button type="button" class="btn tap" id="pc-new">Als nieuwe speler</button></div></div>`;
}

const PLAN_LBL = { add: "Speler toevoegen", upd: "Bijwerken", none: "Zit al aan tafel", updSeat: "Bijwerken en aan tafel", seat: "Aan tafel zetten" };
/** Meerdere partyleden met deze naam: findMember kiest er geen, dan wordt het een nieuw lid; zeg dat */
function dupHint() {
  if (pendingNew || !$("#pc-party").checked) return "";
  const n = ($("#pc-name").value.trim() || (pendingSheet && pendingSheet.name) || "").toLowerCase();
  if (!n || app.party.filter((x) => String(x.name || "").trim().toLowerCase() === n).length < 2) return "";
  return `<p class="hint">Meerdere partyleden heten ${esc($("#pc-name").value.trim())}. Dit wordt een nieuw lid; een bestaand lid zet je aan tafel via Party.</p>`;
}

/** Partylid aan tafel zetten met de bewaarde stand (HP, slots, death saves, lange effecten); gedeeld met "Party aan tafel zetten" */
function seatMember(m, init) {
  const c = structuredClone(m); delete c.pid;
  endFightEffects([c]); // ronde-effecten van een vorig (niet gestopt) gevecht vervallen
  app.S.list.push({ ...c, id: uid(), pid: m.pid, kind: "pc", init, cond: c.hp > 0 ? [] : ["Unconscious"], reaction: false });
}

async function ddbFetch() {
  const id = parseDdbLink($("#pc-ddb").value), info = $("#pc-sheetinfo"), btn = $("#pc-ddbgo");
  if (!id) { info.textContent = ddbMsg("bad"); return; }
  if (ddbBusy) ddbBusy.abort(); // laatste verzoek wint
  pdfSeq++; // een PDF die nog gelezen wordt, overschrijft deze sheet niet meer
  const ctl = ddbBusy = new AbortController();
  btn.disabled = true; btn.setAttribute("aria-busy", "true"); info.textContent = "Sheet ophalen…";
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
  stopDdb(); pdfSeq++; $("#f-pc").reset(); clearPending(); $("#pc-dex").value = 0; $("#pc-sheetinfo").textContent = "";
}

export function bindForms() {
  $("#pc-race").insertAdjacentHTML("beforeend", RACE_OPTS.map((r) => `<option>${esc(r)}</option>`).join(""));
  $("#f-pc").addEventListener("submit", (e) => {
    e.preventDefault();
    const sh = pendingSheet, nm = $("#pc-name").value.trim(), init = parseInt($("#pc-init").value) || 0;
    let lvl = cleanLvl($("#pc-lvl").value);
    const ex = curMatch(); // zelfde regel als het vak hierboven
    if (ex) { // SP3: bestaand partylid nooit met volle HP opnieuw aanmaken (dat overschreef de bewaarde stand)
      const here = app.S.list.some((c) => c.pid === ex.pid), plan = seatPlan(true, here, !!sh);
      if (plan === "none") return; // knop staat uit: zit al aan tafel
      let ch = [];
      if (sh) ch = updMember(ex, formUpdate()); else because("uit de party aan tafel gezet");
      if (lvl) ex.lvl = lvl;
      if (plan !== "upd") { seatMember(ex, init); ui.prepLast = app.S.list[app.S.list.length - 1].id; }
      app.S.sample = false; saveParty();
      const what = ch.length ? ` (${ch.join(", ")})` : "";
      resetPcForm(); render(); $("#pc-name").focus();
      toast(here ? `${ex.name} zit al aan tafel: bijgewerkt${what}. Initiative blijft.`
        : sh ? `${ex.name} bijgewerkt${what} en aan tafel gezet. Schade en verbruik blijven staan.`
        : `${ex.name} aan tafel gezet met ${n0(ex.hp)}/${n0(ex.max)} HP${ex.ds && ex.ds.dead ? " (dood)" : ex.max && ex.hp <= 0 ? " (bewusteloos)" : ""}.`);
      return;
    }
    const max = parseInt($("#pc-hp").value) || 0;
    const manual = (() => {
      const sl = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => ({ lvl: l, max: parseInt($("#pc-sl" + l).value) || 0 })).filter((x) => x.max > 0).map((x) => ({ ...x, left: x.max, spells: "" }));
      return sl.length ? { slots: sl, daily: [] } : null;
    })();
    const pid = $("#pc-party").checked ? uid() : null;
    const dex = parseInt($("#pc-dex").value) || 0;
    const race = pickRace($("#pc-race").value, sh && sh.race);
    app.S.list.push({
      id: uid(), pid, name: nm, kind: "pc", race, img: pendingImg, init, dex, ac: parseInt($("#pc-ac").value) || 0, hp: max, max, cond: [],
      casting: manual || (sh && sh.casting ? structuredClone(sh.casting) : null), res: sh ? structuredClone(sh.res || []) : [], sheet: sh || null, initBonus: sh ? sh.initBonus : dex,
      ...(pendingDdb && !pendingNew ? { ddbId: pendingDdb } : {}), // "Als nieuwe speler": geen tweede koppeling aan hetzelfde character
      ...(lvl ? { lvl } : {}), // voor de moeilijkheid (anders uit de klasse-string van de sheet)
      ...(sh && cleanDr(sh.dr) ? { dr: cleanDr(sh.dr) } : {}), // resistances uit de D&D Beyond-link (SP2)
    });
    app.S.sample = false; ui.prepLast = app.S.list[app.S.list.length - 1].id;
    resetPcForm(); render(); $("#pc-name").focus();
    // level hoort bij de party (syncParty neemt lvl niet over: het Party-paneel is de bron)
    const pm = pid && lvl && app.party.find((x) => x.pid === pid);
    if (pm && pm.lvl !== lvl) { pm.lvl = lvl; saveParty(); render(); }
  });
  $("#pc-roll").addEventListener("click", () => {
    const b = pendingSheet ? pendingSheet.initBonus : parseInt($("#pc-dex").value) || 0, r = d(20);
    $("#pc-init").value = r + b; toastHtml(`Initiative: d20 [${r}] ${sgn(b)} = <b>${r + b}</b>`);
  });
  $("#pc-ddbgo").addEventListener("click", ddbFetch);
  $("#pc-ddb").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); ddbFetch(); } }); // niet de submit (initiative is verplicht)
  for (const k of ["ac", "hp"]) $("#pc-" + k).addEventListener("input", (e) => e.target.closest("label").classList.remove("warn"));
  $("#pc-match").addEventListener("click", (e) => {
    if (e.target.closest("#pc-new")) { pendingNew = true; showMatch(); toast("Wordt als nieuwe speler toegevoegd. Vul initiative in."); }
  });
  $("#pc-name").addEventListener("input", () => showMatch());
  $("#pc-party").addEventListener("change", () => showMatch());
  $("#pc-pdf").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    e.target.value = ""; // zelfde bestand opnieuw kiezen moet weer werken, ook na een fout
    stopDdb();
    const seq = ++pdfSeq; // laatste keuze wint (link ophalen, andere PDF, formulier verstuurd)
    $("#pc-sheetinfo").textContent = `${f.name} wordt gelezen…`;
    try {
      const got = await readSheetPdf(f), h = got && got.sheet;
      if (seq !== pdfSeq) return;
      if (!h) { $("#pc-sheetinfo").textContent = "Geen D&D Beyond-formuliervelden gevonden. Is dit een PDF-export van D&D Beyond?"; return; }
      clearPending(); fillSheet(h, got.img); showMatch();
    } catch { if (seq === pdfSeq) $("#pc-sheetinfo").textContent = "De PDF-lezer kon niet laden of het bestand niet openen. Controleer je verbinding en probeer het opnieuw."; }
  });

  // bedieningsblok (IN4, zelfde als snel toevoegen): opnieuw tekenen, behalve tijdens typen in het getalveld (focus)
  const monBtn = (typing) => {
    const btn = $("#mon-add"), st = ui.monAdd, m = selMon && findMon(selMon);
    if (typing) $("#mon-addh").textContent = addHint(st, m); else $("#mon-blk").innerHTML = addBlockHtml("mon", st, m);
    btn.disabled = !selMon || (st.fixOn && parseInit(st.fix) === null);
    btn.textContent = selMon ? addLabel(st.n, selMon, $("#mon-hid").checked, $("#mon-anon").checked) : "Kies een monster";
    $("#mon-hidh").hidden = !$("#mon-hid").checked;
    $("#mon-anonh").hidden = !$("#mon-anon").checked;
  };
  const renderMonList = () => {
    const f = filterMonsters(allMonsters(), $("#mon-q").value, selMon);
    if (f.sel !== selMon) ui.monFull = false; // andere keuze: preview weer kort
    selMon = f.sel; // UI-toestand, geen data: de selectie volgt wat zichtbaar is
    monBtn();
    const lbl = monLabel(f), m = selMon && findMon(selMon);
    $("#mon-lbl").hidden = !lbl; $("#mon-lbl").textContent = lbl;
    $("#mon-list").innerHTML = monListHtml(f, selMon, "data-pick", `Niets gevonden. Voeg het toe onder "Eigen monster".`);
    $("#mon-prev").innerHTML = monPrev(m, ui.monFull, true);
    if (ui.prep === "mon") previewSB(m || null); // tablet/desktop: volledig statblock in de zijkolom (geen keuze: terug)
  };
  bindForms.renderMonList = renderMonList;
  $("#mon-q").addEventListener("input", renderMonList);
  $("#mon-blk").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-ab]"); if (!b) return;
    const f = addBlockTap(ui.monAdd, b), had = document.activeElement === b; monBtn();
    if (f) $("#mon-fix")?.focus(); else if (had) refocusAb($("#mon-blk"), b);
  });
  $("#mon-blk").addEventListener("input", (e) => { if (e.target.dataset.ab === "fix") { ui.monAdd.fix = e.target.value; monBtn(true); } });
  $("#mon-hidh").textContent = HID_HINT; // één tekst voor Monster-tab en snel toevoegen
  $("#mon-anonh").textContent = ANON_HINT;
  $("#mon-hid").addEventListener("change", () => monBtn());
  $("#mon-anon").addEventListener("change", () => monBtn());
  $("#mon-list").addEventListener("click", (e) => { const b = e.target.closest("[data-pick]"); if (!b) return; if (selMon !== b.dataset.pick) ui.monFull = false; selMon = b.dataset.pick; renderMonList(); });
  $("#mon-prev").addEventListener("click", (e) => { if (!e.target.closest("[data-mpfull]")) return; ui.monFull = !ui.monFull; renderMonList(); });
  $("#f-mon").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!selMon) { toast("Tik eerst een monster in de lijst aan."); return; }
    const st = ui.monAdd, fix = parseInit(st.fix);
    if (st.fixOn && fix === null) { toast("Vul de initiative in."); $("#mon-fix")?.focus(); return; }
    $("#mon-q").blur();
    addMonsters(selMon, st.n, addHp(findMon(selMon)), addInit(st), false, fix, $("#mon-hid").checked, $("#mon-anon").checked);
    Object.assign(st, { n: 1, fixOn: false, fix: "" }); // aantal en ingevulde initiative gelden één keer; HP en Per monster/Groep blijven
    $("#mon-hid").checked = $("#mon-anon").checked = false; monBtn(); // elke keer opnieuw kiezen: nooit per ongeluk verborgen toevoegen
    ui.prepLast = app.S.list.at(-1)?.id ?? null;
    render();
  });

  $("#f-custom").addEventListener("submit", (e) => {
    e.preventDefault();
    const hpIn = $("#cu-hp").value.replace(/\s/g, "");
    let hp = parseInt(hpIn), hd = null;
    if (/d/i.test(hpIn)) {
      if (!HD_RE.test(hpIn)) { toast("HP als getal (22) of als dobbelstenen (5d8 of 5d8+10)."); return; }
      hd = hpIn; hp = avgExpr(hpIn);
    }
    if (!(hp > 0)) { toast("Vul geldige HP in."); return; }
    const m = { n: $("#cu-name").value.trim(), cr: $("#cu-cr").value.trim(), ac: $("#cu-ac").value, hp, hd, dexScore: parseInt($("#cu-dex").value) || 10, text: $("#cu-text").value };
    if (!m.n) return;
    app.custom = [m, ...app.custom.filter((x) => x.n !== m.n)]; saveLibrary();
    e.target.reset(); selMon = m.n; $("#mon-q").value = "";
    ui.prep = "mon"; renderMonList(); render(); $("#mon-add").focus(); toast(`${m.n} opgeslagen. Kies aantal en voeg toe.`);
  });

  const impStatus = () => {
    $("#imp-status").innerHTML = app.imported.length ? `${app.imported.length} geïmporteerde monsters actief. <button type="button" class="link" id="imp-clear">Import verwijderen</button>` : "";
  };
  bindForms.impStatus = impStatus;
  $("#imp-status").addEventListener("click", (e) => { if (e.target.id === "imp-clear") { app.imported = []; saveLibrary(); renderMonList(); impStatus(); } });
  $("#imp-file").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    e.target.value = ""; // ook na een fout opnieuw te kiezen
    let j;
    try { j = JSON.parse(await f.text()); } catch { toast("Dit bestand is geen geldige JSON. Kies het .json-bestand met monsters."); return; }
    const conv = parseMonsterFile(j);
    if (!conv.length) { toast("Geen monsters gevonden in dit bestand."); return; }
    const before = app.imported.length;
    const map = new Map(app.imported.map((m) => [m.n.toLowerCase(), m]));
    conv.forEach((m) => map.set(m.n.toLowerCase(), m));
    app.imported = [...map.values()]; saveLibrary(); renderMonList(); impStatus();
    toast(`${conv.length} monsters ingelezen, ${app.imported.length - before} nieuw.`);
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
    if (e.target.id === "q-q") { q.q = e.target.value; paintQadd(); }
    else if (e.target.dataset.ab === "fix") { q.fix = e.target.value; q.typing = true; paintQadd(); q.typing = false; }
  });
  el.addEventListener("click", (e) => {
    const q = ui.qadd; if (!q) return;
    const p = e.target.closest("[data-qpick]");
    if (p) { if (q.sel !== p.dataset.qpick) q.full = false; q.sel = p.dataset.qpick; paintQadd(); return; }
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
  const q = ui.qadd; if (!q || !q.sel) return;
  const fix = parseInit(q.fix);
  if (q.fixOn && fix === null) { $("#q-fix")?.focus(); return; }
  because("tijdens het gevecht toegevoegd");
  addMonsters(q.sel, q.n, addHp(findMon(q.sel)), addInit(q), false, fix, q.hid, q.anon);
  ui.qadd = null;
  render();
  $("#qadd")?.focus();
}

/* ---------- open saves (regels in de beurtbalk) ---------- */
/** Monster-save rollen: statblock-bonus plus Bless/Bane/cover; uitslag verwerken. Geeft de toast-tekst terug (zonder te tonen) als quiet. */
function svRoll(sid, adv = false, quiet = false) {
  const S = app.S, s = (S.saves || []).find((x) => x.sid === sid), c = s && S.list.find((x) => x.id === s.id);
  if (!c || !isValid(S, s)) return "";
  const x = rollSave(svBonus(c, s.ab), adv, Math.random, saveMods(c, s.ab));
  const ok = x.tot >= s.dc, txt = `${s.ab} ${rollText(x, s.dc)}`.replace(" (advantage: Magic Resistance)", adv ? " (advantage)" : "");
  return svDone(c, sid, ok, txt, txt, quiet, adv);
}

/** Uitslag verwerken, renderen en melden met Ongedaan (gefaald monster: Legendary Resistance / Advantage erbij) */
function svDone(c, sid, ok, note, shown, quiet = false, adv = false) {
  const s = (app.S.saves || []).find((x) => x.sid === sid);
  if (!s || !isValid(app.S, s)) return ""; // bijv. tweede concentration save nadat de eerste al faalde
  addWhy(resolveSave(app.S, sid, ok, note).why); // de melding hieronder zegt al wat er gebeurde
  if (!quiet) render(); // "Rol alle monsters" rendert één keer: één undo-stap
  const m = c.kind === "monster" && c.ref ? findMon(c.ref) : null;
  const res = s.kind === "conc" ? (ok ? "blijft concentreren" : "concentratie weg") : ok ? `${s.n} weg` : `${s.n} blijft`;
  const line = esc(`${c.name}: ${shown || `${s.ab}-save ${ok ? "geslaagd" : "gefaald"}`} · ${res}`);
  if (quiet) return line;
  ui.svRetry = !ok && c.kind === "monster" ? { sid, id: c.id, step: stepNo() } : null;
  const extra = !ui.svRetry ? ""
    : (c.lr && c.lr.left > 0 ? `<button class="tundo" id="toast-svlr">Legendary Resistance (${c.lr.left})</button>` : "")
      + (!adv && s.kind === "cond" && hasMagicRes(m) ? `<button class="tundo" id="toast-svadv">Spell? Advantage</button>` : "");
  toastHtml(`${line} ${extra}<button class="tundo" id="toast-undo">Ongedaan</button>`);
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
  if (n.length) toast(`Zelf rollen: ${n.join(", ")} (geen ${ab}-save bekend).`);
}

function svRollAll() {
  const S = app.S;
  const ids = openSaves(S).filter((s) => { const c = S.list.find((x) => x.id === s.id); return c && c.kind === "monster" && !selfRoll(c, s.ab); }).map((s) => s.sid);
  const lines = ids.map((sid) => svRoll(sid, false, true)).filter(Boolean);
  ui.svRetry = null;
  render();
  if (lines.length) toastHtml(`${lines.join("<br>")} <button class="tundo" id="toast-undo">Ongedaan</button>`);
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
  toastHtml(`${esc(`${c.name}: ${o.n} (−${o.cost} LA) · ${c.la.left} over`)} <button class="tundo" id="toast-undo">Ongedaan</button>`);
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
    a.by = t.value;
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
const spellDC = (a) => { const c = app.S.list.find((x) => x.id === a.by); return c ? casterDC(c, c.ref ? findMon(c.ref) : null) : ""; };

/** Spell-tab: klikken. true = afgehandeld */
function spellClick(a, k, b) {
  const sp = curSpell(a), id = b.dataset.id, caster = app.S.list.find((x) => x.id === a.by);
  const set = (patch) => { a.s[id] = { ...(a.s[id] || {}), ...patch }; };
  if (k === "sp") { const v = b.dataset.v === "own" ? "own" : +b.dataset.v; if (a.sp !== v) { a.sp = v; a.s = {}; a.redc = ""; if (!a.sdc) a.sdc = spellDC(a); } rebuildAoe(`[data-ao="sp"][data-v="${b.dataset.v}"]`); return true; }
  if (k === "sgo") { spellGo(); return true; }
  if (!sp) return k.startsWith("s");
  if (k === "ssave") set({ ok: b.dataset.v === "1", lr: false });
  else if (k === "slr") set({ ok: false, lr: true });
  else if (k === "sall") spellTargets(app.S.list).forEach((c) => { // niet de caster, niet wie immuun of (Hold Person) geen humanoid is
    a.s[c.id] = { ...(a.s[c.id] || {}), sel: !!b.dataset.v && c.kind === b.dataset.v && c.id !== a.by && spellPick(a, sp, caster, c).fit };
  });
  else if (k === "sroll") {
    const dc = parseInt(a.sdc);
    if (!(dc > 0)) { toast("Vul eerst de DC in."); $("#s-dc")?.focus(); return true; }
    const mons = spellTargets(app.S.list).map((c) => ({ c, p: spellPick(a, sp, caster, c) })).filter((x) => x.c.kind === "monster" && x.p.sel && !x.p.immune);
    if (!mons.length) { toast("Kies eerst de monsters die een save doen."); return true; }
    selfToast(mons.map((x) => x.c), sp.ab);
    // altijd een spell: Magic Resistance geeft advantage; Bless/Bane en cover tellen mee
    mons.filter(({ c }) => !selfRoll(c, sp.ab)).forEach(({ c, p }) => { const x = rollSave(saveBonus(p.m, sp.ab), hasMagicRes(p.m), Math.random, saveMods(c, sp.ab)); a.s[c.id] = { ...(a.s[c.id] || {}), roll: x, ok: x.tot >= dc, lr: false }; });
  } else return false;
  paintAoe();
  return true;
}

/** Spell toepassen: concentratie, effect of condities per doel en het logboek in één stap (één Ongedaan) */
function spellGo() {
  const a = ui.aoe, S = app.S, sp = curSpell(a), caster = S.list.find((x) => x.id === a.by && x.kind !== "lair");
  if (!sp || !caster) return;
  const dc = parseInt(a.sdc);
  if (sp.rep && !(dc > 0)) { toast("Vul de DC in: die is nodig voor de herhaalsave."); $("#s-dc")?.focus(); return; }
  const picks = sortOrder(spellTargets(S.list)).map((c) => ({ c, p: spellPick(a, sp, caster, c) })).filter((x) => x.p.sel)
    .map(({ c, p }) => ({ c, m: p.m, ok: !!sp.ab && p.ok, lr: !!sp.ab && p.lr, note: p.roll ? `${sp.ab} save ${rollText(p.roll, dc)}` : "" }));
  if (!picks.length) return;
  const r = castSpell(S.list, sp, caster, picks, { round: S.round, active: S.active, dc: a.sdc, ed: edFor(caster, sp.n, rulesEd()) });
  addWhy(r.why);
  ui.aoe = null;
  render();
  const parts = [r.hit.length ? `${r.hit.join(", ")}${sp.conds ? ` ${sp.conds.join(" + ")}` : ""}` : sp.ab ? "niemand geraakt" : "", r.ok.length ? `${r.ok.length} geslaagd` : "", r.immune.length ? `${r.immune.length} immuun` : ""].filter(Boolean);
  toastHtml(`${esc(`${sp.n} (${caster.name}): ${parts.join(" · ")}${sp.conc ? " · conc" : ""}`)} <button class="tundo" id="toast-undo">Ongedaan</button>`);
  $("#aoe")?.focus();
}

export function bindAoe() {
  const el = $("#asheet");
  const field = (e) => {
    const a = ui.aoe; if (!a) return;
    if (a.tab === "spell") { spellField(a, e.target); return; }
    const id = e.target.id;
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
    if (a.tab === "spell" && spellClick(a, k, b)) return;
    if (k === "go") { aoeGo(); return; }
    if (k === "save") aoeSet(a, id, { save: b.dataset.v, lr: false });
    if (k === "mode") aoeSet(a, id, { mode: +b.dataset.v });
    if (k === "lr") aoeSet(a, id, { save: okSave(a), lr: true });
    if (k === "reroll") { const x = srcAoe(a); if (x) { a.dmg = String(x.dmg); a.roll = x.roll; a.extra = x.extra; $("#a-dmg").value = a.dmg; } }
    if (k === "all") aoeTargets(a.src).forEach((c) => aoeSet(a, c.id, { sel: !!b.dataset.v && c.kind === b.dataset.v }));
    if (k === "roll") {
      const dc = parseInt(a.dc);
      if (!(dc > 0)) { toast("Vul eerst de DC in."); $("#a-dc").focus(); return; }
      const mons = aoeTargets(a.src).filter((c) => c.kind === "monster" && aoePick(a, c).sel);
      if (!mons.length) { toast("Kies eerst de monsters die een save doen."); return; }
      selfToast(mons, a.ab);
      mons.filter((c) => !selfRoll(c, a.ab)).forEach((c) => {
        const m = findMon(c.ref), x = rollSave(saveBonus(m, a.ab), hasMagicRes(m), Math.random, saveMods(c, a.ab));
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
  const c = app.S.list.find((x) => x.id === a.src), A = c && c.ref ? monsterActions(findMon(c.ref)) : null;
  const act = A && [...A.main, ...A.other].find((x) => x.n === a.act);
  return act ? actionAoe(act, (e) => rollExpr(e), DTYPES) : null;
}

/** "DC 18 DEX · AoE" op een aanvalsregel: AoE-paneel met gerolde schade, type, save en DC; spelers aangevinkt */
function openActAoe(cid, name) {
  const c = app.S.list.find((x) => x.id === cid);
  if (!c) return;
  const a = { src: c.id, srcName: c.name, act: name, t: {} };
  const x = srcAoe(a);
  if (!x) { toast("Deze actie kon niet gelezen worden. Gebruik de knop AoE in de beurtbalk."); return; }
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
  const label = `${a.act ? `${a.srcName}: ${a.act} ` : ""}${n}${a.type ? " " + a.type : ""}${dc > 0 ? ` (${a.ab} DC ${dc})` : ""}`;
  const r = applyAoe(picks, n, label);
  apply(r);
  // recharge-actie: pas bij toepassen op "op", in dezelfde stap (één keer Ongedaan)
  const src = a.src && app.S.list.find((x) => x.id === a.src), ri = src ? rcIndex(src.rc, a.act) : -1;
  const rcUsed = ri >= 0 && src.rc[ri].ready;
  if (rcUsed) src.rc[ri].ready = false;
  const down = picks.filter((x) => x.up && x.c.hp <= 0).length;
  ui.aoe = null;
  render();
  toastHtml(`${esc(`${a.act || `AoE ${label}`}: ${L.length} doel${L.length === 1 ? "" : "en"}, ${r.hits.reduce((s, h) => s + h.dealt, 0)} schade${down ? `, ${down} neer` : ""}${rcUsed ? " · recharge op" : ""}${concNote(r)}`)} <button class="tundo" id="toast-undo">Ongedaan</button>`);
  const ab = $("#aoe"); if (ab) ab.focus();
}

/* ---------- aanval op één doel (to-hit-knop op de monsterkaart) ---------- */
/** Aanval opzoeken in het statblock van de aanvaller (op naam) */
function findAtk(by, name) {
  const A = by && by.ref ? monsterActions(findMon(by.ref)) : null;
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
  const adv = ui.atkAdv && ui.atkAdv.by === by.id ? ui.atkAdv.v : "a";
  ui.atk = { by: by.id, n: a.n, label: label || a.n, bo: a.hit, kind: a.kind, key: partsKey(a.dmg), adv, tid: null, r: null, parts: null, modes: {}, force: {},
    la: o ? { i: +laI, n: o.n, cost: o.cost, on: true, back: laBack } : null };
  atkFrom = o ? null : from || null;
  render();
  focusAtk();
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
  return r.why.length ? ` · ${by.name} −${x.la.cost} LA, ${by.la.left} over` : "";
}

/** Doel gekozen: to hit en damage in één keer rollen (een ander doel kiezen houdt dezelfde worp) */
function atkTarget(x, id) {
  const c = app.S.list.find((t) => t.id === id);
  if (!c) return;
  x.tid = id;
  if (!x.r) { x.r = rollAttack(x.bo); x.parts = x.key ? rollDmgCrit(x.key, (e) => rollExpr(e)) || [] : []; }
  x.force = {};
  // resistance/immuniteit: monster uit het statblock (onvoorwaardelijk), speler uit zijn opgeslagen resistances (SP2)
  const m = c.ref ? findMon(c.ref) : null;
  x.modes = {};
  for (const p of x.parts) if (!(p.type in x.modes)) x.modes[p.type] = targetMode(c, m, p.type).mode;
}

function atkGo() {
  const x = ui.atk, by = x && app.S.list.find((c) => c.id === x.by), c = x && app.S.list.find((t) => t.id === x.tid);
  if (!by || !c || !c.max || isOut(c)) return;
  const { r } = atkRoll(x, by, c), ac = effAc(c) || 0, res = atkResult(r, ac, x.parts, x.modes, x.force);
  if (!res.hit || !res.dealt) return;
  const before = c.hp;
  because(atkWhy(`${x.label} (${by.name})`, r, ac || null, x.parts, res), c.id);
  const f = atkDamage(c, res);
  apply(f);
  const la = atkLa(x, by); // na de schade: een monster dat zichzelf raakt en neergaat kan geen LA meer
  ui.atkPrev = { by: by.id, id: c.id };
  ui.atk = null;
  render();
  toastHtml(`${esc(`${c.name}: −${res.dealt} HP${res.crit ? " (kritiek)" : ""} → ${n0(c.hp)}/${n0(c.max)}${before > 0 && c.hp <= 0 ? (c.kind === "pc" ? ", bewusteloos" : ", neer") : ""}${la}${concNote(f)}`)} <button class="tundo" id="toast-undo">Ongedaan</button>`);
  atkBack(x, false);
}

/** Mis met de LA-schakelaar aan: legendary action is toch gebruikt */
function atkMiss() {
  const x = ui.atk, by = x && app.S.list.find((c) => c.id === x.by);
  if (!by) return;
  const la = atkLa(x, by);
  ui.atk = null;
  render();
  if (la) toastHtml(`${esc(`${x.label}: mis${la}`)} <button class="tundo" id="toast-undo">Ongedaan</button>`);
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
    if (k === "crit") { const c = app.S.list.find((t) => t.id === x.tid), by = app.S.list.find((t) => t.id === x.by); const res = c && by && atkResult(atkRoll(x, by, c).r, effAc(c) || 0, x.parts, x.modes, x.force); x.force.crit = !(res && res.crit); }
    if (k === "force") x.force.hit = true;
    if (k === "shield") {
      const c = app.S.list.find((t) => t.id === x.tid), p = PRESETS.find((q) => q.n === "Shield");
      if (c && p) { const r = applyEff(c, p, null); render(); if (r.undoToast) toastHtml(`${esc(r.undoToast)} <button class="tundo" id="toast-undo">Ongedaan</button>`); focusAtk(); return; }
    }
    paintAtk();
    focusAtk();
  });
}

/* ---------- initiative van spelers bij Start gevecht ---------- */
function openInit() {
  const L = initPcs(app.S.list);
  ui.sheet = null; ui.qadd = null; ui.aoe = null; ui.atk = null; ui.la = null; ui.sv = false;
  ui.initDraft = { v: Object.fromEntries(L.map((c) => [c.id, c.init == null ? "" : String(c.init)])), act: L[0].id, fresh: true, rolls: {} };
  render();
  $("#isheet .isheet")?.focus();
}
function closeInit() { ui.initDraft = null; paintInit(); $("#start")?.focus(); }

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
    toast(`Nog geen initiative voor: ${r.missing.join(", ")}.`);
    return;
  }
  apply(r);
  apply(setSurprise(app.S.list, x.sur || "none")); // zelfde undo-stap als de start
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
  if (k === "sur") x.sur = v;
  if (k === "mroll") setInitRoll(v);
  if (k === "next") initNext(x);
  if (k === "roll") {
    const c = app.S.list.find((t) => t.id === v); if (!c) return;
    const r = d(20), bo = c.initBonus ?? c.dex ?? 0;
    x.v[c.id] = String(r + bo); x.rolls[c.id] = `d20 [${r}] ${sgn(bo)}`;
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
      const was = document.activeElement; updMember(cur, f); ui.pUpd = null; render(); pFocus(pLink(pid), was); toast(`${cur.name}: sheet ververst, verder niets veranderd.`); return;
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
    if (e.target.value !== "" && !v) { toast("Level is 1 t/m 20."); e.target.value = m.lvl ?? ""; return; } // ongeldig: oude waarde blijft
    m.lvl = v; // de party is de bron (geen undo-stap: hoort niet bij de encounter)
    saveParty(); render();
  });
  panel.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const rollFor = (m) => { const r = d(20), bo = m.initBonus ?? m.dex ?? 0; ui.partyInit[m.pid] = r + bo; return `${esc(m.name)}: d20 [${r}] ${sgn(bo)} = <b>${r + bo}</b>`; };
    const at = new Set(app.S.list.filter((c) => c.pid).map((c) => c.pid));
    if (b.dataset.pupd) { if (ui.pUpd?.st !== "busy") partyFetch(b.dataset.pupd); return; }
    if (b.dataset.pupdno) { ui.pUpd = null; pPaint(pLink(b.dataset.pupdno)); return; }
    if (b.dataset.pupdok) {
      const u = ui.pUpd, m = u && u.st === "ask" && app.party.find((x) => x.pid === u.pid);
      ui.pUpd = null;
      if (!m) { pPaint(); return; }
      const ch = updMember(m, u.f);
      render(); pFocus(pLink(m.pid), b);
      toast(`${m.name} bijgewerkt${ch.length ? ": " + ch.join(", ") : ""}.`);
      return;
    }
    if (b.dataset.proll) { toastHtml(rollFor(app.party.find((x) => x.pid === b.dataset.proll))); paintParty(); return; }
    if (b.dataset.pdel) {
      const m = app.party.find((x) => x.pid === b.dataset.pdel);
      if (b.dataset.sure) { if (ui.pUpd?.pid === m.pid) stopPUpd(); app.party = app.party.filter((x) => x !== m); app.S.list.forEach((c) => { if (c.pid === m.pid) c.pid = null; }); saveParty(); render(); }
      else { b.dataset.sure = "1"; b.textContent = "Zeker? Tik nogmaals"; }
      return;
    }
    if (b.id === "p-rollall") { toastHtml(app.party.filter((m) => !at.has(m.pid)).map(rollFor).join("<br>") || "Iedereen zit al aan tafel."); paintParty(); return; }
    if (b.id === "p-add") {
      const todo = app.party.filter((m) => !at.has(m.pid));
      const missing = todo.filter((m) => ui.partyInit[m.pid] === undefined || ui.partyInit[m.pid] === "");
      if (missing.length) { toast(`Nog geen initiative voor: ${missing.map((m) => m.name).join(", ")}. Vul in of tik op "Rol voor iedereen".`); return; }
      because("party aan tafel gezet");
      todo.forEach((m) => { seatMember(m, parseInt(ui.partyInit[m.pid]) || 0); delete ui.partyInit[m.pid]; });
      app.S.sample = false; ui.prepLast = app.S.list[app.S.list.length - 1].id; toast(`${todo.length} speler${todo.length === 1 ? "" : "s"} aan tafel gezet.`);
      if (ui.prep === "party") closePrep(); else render();
      return;
    }
    if (b.id === "p-short" || b.id === "p-long") {
      const long = b.id === "p-long";
      because(long ? "long rest" : "short rest");
      app.party.forEach((m) => R.restMember(m, long));
      app.S.list.forEach((c) => { if (c.pid) R.restMember(c, long); });
      saveParty(); toast(long ? "Long rest: HP, spell slots en resources hersteld." : "Short rest: short-rest resources hersteld."); render();
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
      if (b.id === "logcopy") copyText(logText(app.S.log), "Logboek gekopieerd.", b.closest(".logbox, .gsheet"));
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
async function copyText(t, okMsg, box) {
  try { await navigator.clipboard.writeText(t); toast(okMsg); return true; }
  catch {
    const ta = document.createElement("textarea");
    ta.value = t; ta.readOnly = true; ta.style.cssText = "width:100%;min-height:200px;margin-top:8px";
    box.appendChild(ta); ta.select();
    toast("Kopiëren lukte niet automatisch; de tekst staat geselecteerd.");
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
  const json = exportJson(), name = `initiative-tafel-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
  try {
    const f = new File([json], name, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: "Initiative Tafel export" }); return done(); }
  } catch (err) { if (err && err.name === "AbortError") return false; } // geannuleerd; andere fout: downloaden
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([json], { type: "application/json" })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return done();
  function done() { markExported(); paintExpLast(); toast("Export gemaakt."); return true; }
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
  // Spells 2014 | 2024: regels én uitleg (alleen spells; render volgt meteen: presets en concentratie)
  const rseg = $("#rules-seg");
  const showRules = (ed) => rseg.querySelectorAll("[data-rules]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.rules === ed));
  showRules(rulesEd());
  rseg.addEventListener("click", (e) => { const b = e.target.closest("[data-rules]"); if (b) { showRules(setRulesEd(b.dataset.rules)); render(); } });
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
  $("#exp-copy").addEventListener("click", async () => { if (await copyText(exportJson(), "Export gekopieerd als tekst.", $("#data-panel"))) { markExported(); paintExpLast(); } });

  let pending = null;
  const ask = (data) => {
    pending = data;
    const nMon = data.custom.length + data.imported.length, nLair = Object.keys(data.lairs).length;
    $("#imp-confirm").innerHTML = `<div class="confirmbox"><p style="margin:0">Deze export bevat <b>${data.party.length}</b> partyleden, <b>${data.S.list.length}</b> deelnemers aan tafel, <b>${nMon}</b> eigen/geïmporteerde monsters, <b>${nLair}</b> lairs en <b>${data.encounters.length}</b> klaargezette encounters.
      Importeren <b>vervangt</b> alles wat nu in de app staat.</p>
      <div class="bar"><button type="button" class="btn primary" id="imp-yes">Vervang en importeer</button><button type="button" class="btn small" id="imp-no">Annuleer</button></div></div>`;
  };
  const read = (text) => {
    try { ask(parseImport(JSON.parse(text))); }
    catch (err) { toast(err instanceof SyntaxError ? "Dit is geen geldige export (geen JSON)." : err.message); }
  };
  $("#imp-backup").addEventListener("change", async (e) => { const f = e.target.files[0]; if (f) read(await f.text()); e.target.value = ""; });
  $("#imp-text-go").addEventListener("click", () => { const t = $("#imp-text").value.trim(); if (t) read(t); });
  $("#imp-confirm").addEventListener("click", (e) => {
    if (e.target.id === "imp-no") { pending = null; $("#imp-confirm").innerHTML = ""; }
    if (e.target.id === "imp-yes" && pending) {
      Object.assign(app, { S: pending.S, party: pending.party, lairs: pending.lairs, custom: pending.custom, imported: pending.imported, encounters: pending.encounters });
      saveParty(); saveLairs(); saveLibrary(); saveEncounters(); // ook opslaan (en de monsterbibliotheek bijwerken), niet alleen de lopende encounter
      markExported(); paintExpLast(); // de data komt uit een export: die bestaat dus al ergens
      pending = null; $("#imp-confirm").innerHTML = ""; $("#imp-text").value = "";
      afterImport();
      toast("Import klaar.");
    }
  });
}
