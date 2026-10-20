// Centrale toestand, vastleggen van wijzigingen (logboek + undo), opslag en party-sync.
import * as store from "./storage.js";
import { diffLog } from "./log.js";
import { uid } from "./rules/dice.js";
import { setLibrary } from "./data/monsters.js";
import { endConcEffects } from "./rules/effects.js";
import { endConcConds } from "./rules/spellcast.js";
import { cleanEncounters } from "./rules/encounters.js";
import { tidy } from "./rules/fight.js";
import { markDirty } from "./exportnudge.js";

/** Alle data van de app. S = de lopende encounter. */
export const app = { S: null, party: [], lairs: {}, custom: [], imported: [], encounters: [] }; // encounters: klaargezet, niet in undo

let hist = [], lastJSON = null, prevObj = null, pendingWhy = [], pendingSum = null, pendingKey = null, steps = 0;
let warn = () => {}, warned = false;
export const setWarn = (fn) => { warn = fn; };

/** Oorzaak voor de volgende logregel(s); id = deelnemer, of leeg voor alle regels van deze stap */
export const because = (t, id) => pendingWhy.push({ t, id: id || null });
export const addWhy = (arr) => pendingWhy.push(...arr);
/**
 * Eén logregel voor deze stap in plaats van een regel per deelnemer die erbij kwam of wegging (encounter inladen).
 * key: de regel is later terug te vinden en bij te werken (samenvatting bij Gevecht afronden, GV2).
 */
export const logAs = (msg, key) => { pendingSum = msg; pendingKey = key || null; };
export const canUndo = () => hist.length > 0;
export const historySize = () => hist.length;
/** Loopt op bij elke vastgelegde stap en elke undo: "is er sindsdien iets gebeurd?" */
export const stepNo = () => steps;

function save(key, value) {
  store.set(key, value).then((ok) => {
    if (!ok && !warned) { warned = true; warn("Opslaan in deze browser lukt niet (vol of geblokkeerd). Maak een export als je je data wilt bewaren."); }
  });
}
// Waardevolle data (niet de lopende encounter): telt voor de exportherinnering (DA1)
const keep = (key, value) => { markDirty(); save(key, value); };
export const saveParty = () => keep("party", app.party);
export const saveLairs = () => keep("lairs", app.lairs);
export const saveEncounters = () => keep("encounters", app.encounters);
export function saveLibrary() {
  keep("custom", app.custom); keep("imported", app.imported);
  setLibrary({ custom: app.custom, imported: app.imported });
}

export async function load() {
  let encs;
  [app.S, app.party, app.lairs, app.custom, app.imported, encs] = await Promise.all([
    store.get("state", null), store.get("party", []), store.get("lairs", {}), store.get("custom", []), store.get("imported", []), store.get("encounters", []),
  ]);
  app.encounters = cleanEncounters(encs);
  setLibrary({ custom: app.custom, imported: app.imported });
  store.persistStorage();
}

/** Na een import of bij opstarten: huidige stand is het nieuwe vertrekpunt (geen undo-stap, geen logregels) */
export function resetBaseline() {
  tidy(app.S); // zelfde normalisatie als commit(), anders wordt die de eerste (onuitwisbare) undo-stap
  lastJSON = JSON.stringify(app.S); prevObj = JSON.parse(lastJSON); hist = []; pendingWhy = []; pendingSum = pendingKey = null;
  save("state", prevObj);
}

/**
 * Legt een wijziging vast: logregels, undo-stap, opslag en party-sync.
 * Doet niets als er niets veranderde. Geeft true terug bij een wijziging.
 */
export function commit() {
  // effecten en condities (Hold Person) van een caster die geen concentratie meer heeft (0 HP, nieuwe spell, verwijderd) horen bij deze stap
  pendingWhy.push(...endConcEffects(app.S.list, app.S.active).why, ...endConcConds(app.S.list).why);
  tidy(app.S); // wie neer ging (GV2), ingeladen encounter vergeten zonder monsters (VB2)
  let j = JSON.stringify(app.S);
  if (j === lastJSON) { pendingWhy = []; pendingSum = pendingKey = null; return false; }
  if (lastJSON !== null) {
    hist.push(lastJSON);
    if (hist.length > 80) hist.shift();
    if (writeLog(prevObj)) j = JSON.stringify(app.S);
  }
  pendingWhy = []; pendingSum = pendingKey = null; steps++;
  lastJSON = j; prevObj = JSON.parse(j);
  save("state", prevObj);
  syncParty();
  return true;
}

/** Logregel van deze stap of een eerdere met deze key bijwerken (de laatste); hoort bij de volgende commit */
export function relog(key, msg) {
  const L = app.S.log || [];
  for (let i = L.length - 1; i >= 0; i--) if (L[i].key === key) { L[i].msg = msg; return; } // geen findLast: oudere iPads
}

export function undo() {
  if (!hist.length) return false;
  pendingSum = pendingKey = null;
  const j = hist.pop();
  app.S = JSON.parse(j);
  lastJSON = j; prevObj = JSON.parse(j); pendingWhy = []; steps++;
  save("state", prevObj);
  syncParty();
  return true;
}

function writeLog(prev) {
  const S = app.S;
  let entries = diffLog(prev, S);
  if (pendingSum) { // erbij of weg (encounter inladen): samen één regel, met alleen de oorzaken die voor de hele stap gelden
    const P = new Set(prev.list.map((c) => c.id)), C = new Set(S.list.map((c) => c.id));
    entries = entries.filter((e) => e.type || (P.has(e.who) && C.has(e.who)));
    entries.push({ msg: pendingSum, sum: true, key: pendingKey });
  }
  if (!entries.length) return false;
  S.log = S.log || [];
  const act = S.list.find((c) => c.id === S.active);
  for (const e of entries) {
    const why = e.type ? "" : pendingWhy.filter((w) => !w.id || (!e.sum && w.id === e.who)).map((w) => w.t).join("; ");
    S.log.push({ id: uid(), r: S.round || 0, turn: e.type ? "" : act ? act.name : "", type: e.type || "", msg: e.msg, why, note: "", ...(e.key ? { key: e.key } : {}) });
  }
  if (S.log.length > 600) S.log.splice(0, S.log.length - 600);
  return true;
}

/* ---------- vaste party: HP, slots en resources lopen door van gevecht naar gevecht ---------- */
const PKEYS = ["name", "race", "img", "ac", "max", "hp", "temp", "dex", "initBonus", "casting", "res", "sheet", "ds", "ddbId", "eff"];

export function syncParty() {
  let changed = false;
  for (const c of app.S.list) {
    if (c.kind !== "pc" || !c.pid) continue;
    let m = app.party.find((x) => x.pid === c.pid);
    if (!m) { m = { pid: c.pid }; app.party.push(m); changed = true; }
    for (const k of PKEYS) {
      const v = c[k] === undefined ? null : c[k];
      if (JSON.stringify(m[k]) !== JSON.stringify(v)) { m[k] = v == null ? null : structuredClone(v); changed = true; }
    }
  }
  if (changed) saveParty();
}
