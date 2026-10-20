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
import { VERSION } from "./version.js";

/** Alle data van de app. S = de lopende encounter. */
export const app = { S: null, party: [], lairs: {}, custom: [], imported: [], encounters: [] }; // encounters: klaargezet, niet in undo

/* Undo-geschiedenis (DA2): ook in IndexedDB, één sleutel per stap ("h:000000123"), zodat elke stap één snapshot
   schrijft. Stand en stap gaan samen in één transactie. Na herladen terug, behalve na een app-update, een
   volledige import of als de laatste stap ouder is dan HIST_AGE (nieuwe sessie = schone lei, UX-keuze). */
export const HIST_MAX = 80, HIST_AGE = 6 * 3600e3;
const HLO = "h:", HHI = "h:\uffff", hk = (n) => HLO + String(n).padStart(9, "0");
let hkeys = [], seq = 0, stored = null;

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
  [app.S, app.party, app.lairs, app.custom, app.imported, encs, stored] = await Promise.all([
    store.get("state", null), store.get("party", []), store.get("lairs", {}), store.get("custom", []), store.get("imported", []), store.get("encounters", []),
    store.range(HLO, HHI),
  ]);
  app.encounters = cleanEncounters(encs);
  setLibrary({ custom: app.custom, imported: app.imported });
  store.persistStorage();
}

/**
 * Welke bewaarde undo-stappen na herladen terugkomen (puur). rows: op sleutelvolgorde, { k, v, t, s }.
 * Alleen de laatste aaneengesloten reeks van deze versie (oudere snapshots passen niet bij nieuwe code), niets als de
 * laatste stap ouder is dan maxAge, geen stappen aan het eind die gelijk zijn aan de huidige stand (half geschreven), max HIST_MAX.
 */
export function restoreHist(rows, { version, now, cur, maxAge = HIST_AGE }) {
  rows = Array.isArray(rows) ? rows : [];
  const ok = (r) => r && typeof r.k === "string" && r.k.startsWith(HLO) && typeof r.s === "string" && r.v === version && Number.isFinite(r.t);
  let i = rows.length;
  while (i > 0 && ok(rows[i - 1])) i--;
  let keep = rows.slice(i);
  while (keep.length && keep[keep.length - 1].s === cur) keep.pop();
  const last = keep[keep.length - 1];
  if (!last || !(now - last.t <= maxAge) || last.t > now + 60e3) keep = []; // klok terug: niet vertrouwen
  keep = keep.slice(-HIST_MAX);
  const kept = new Set(keep.map((r) => r.k));
  return { keep, drop: rows.filter((r) => !(r && kept.has(r.k))).map((r) => r && r.k).filter((k) => typeof k === "string") };
}

// stand + wijzigingen aan de geschiedenis in één transactie; lukt IndexedDB niet, dan de stand zoals vroeger (met terugval)
function persist(ops) {
  const obj = prevObj;
  ops.push(["put", "state", obj]);
  store.batch(ops).then((ok) => { if (!ok) save("state", obj); });
}

/**
 * Huidige stand is het nieuwe vertrekpunt (geen undo-stap, geen logregels).
 * boot: na herladen de bewaarde geschiedenis terugzetten (restoreHist); anders (import) wissen.
 */
export function resetBaseline(boot = false) {
  tidy(app.S); // zelfde normalisatie als commit(), anders wordt die de eerste (onuitwisbare) undo-stap
  lastJSON = JSON.stringify(app.S); prevObj = JSON.parse(lastJSON); pendingWhy = []; pendingSum = pendingKey = null;
  let ops;
  if (boot && stored) {
    const r = restoreHist(stored, { version: VERSION, now: Date.now(), cur: lastJSON });
    hist = r.keep.map((x) => x.s); hkeys = r.keep.map((x) => x.k);
    seq = Math.max(seq, ...hkeys.map((k) => +k.slice(HLO.length)));
    ops = r.drop.map((k) => ["del", k]);
  } else {
    hist = []; hkeys = [];
    ops = [["delRange", HLO, HHI]];
  }
  stored = null;
  persist(ops);
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
  const ops = [];
  if (lastJSON !== null) {
    const k = hk(++seq);
    hist.push(lastJSON); hkeys.push(k);
    ops.push(["put", k, { k, v: VERSION, t: Date.now(), s: lastJSON }]);
    if (hist.length > HIST_MAX) { hist.shift(); ops.push(["del", hkeys.shift()]); }
    if (writeLog(prevObj)) j = JSON.stringify(app.S);
  }
  pendingWhy = []; pendingSum = pendingKey = null; steps++;
  lastJSON = j; prevObj = JSON.parse(j);
  persist(ops);
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
  const j = hist.pop(), k = hkeys.pop();
  app.S = JSON.parse(j);
  lastJSON = j; prevObj = JSON.parse(j); pendingWhy = []; steps++;
  persist(k ? [["del", k]] : []);
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
