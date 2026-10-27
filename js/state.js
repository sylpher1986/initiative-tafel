// Centrale toestand, vastleggen van wijzigingen (logboek + undo), opslag en party-sync.
import * as store from "./storage.js";
import { diffLog } from "./log.js";
import { uid } from "./rules/dice.js";
import { setLibrary } from "./data/monsters.js";
import { endConcEffects, endRage } from "./rules/effects.js";
import { endConcConds } from "./rules/spellcast.js";
import { cleanEncounters } from "./rules/encounters.js";
import { cleanSpellNotes } from "./data/spellnotes.js";
import { tidy } from "./rules/fight.js";
import { markDirty } from "./exportnudge.js";
import { VERSION } from "./version.js";
import { pack, unpack } from "./histpack.js";
import { tr } from "./i18n/boot.js";
import { isMsg, isJoin } from "./i18n/msg.js";

/** Alle data van de app. S = de lopende encounter. */
export const app = { S: null, party: [], lairs: {}, custom: [], imported: [], encounters: [], spellNotes: {} }; // encounters: klaargezet; spellNotes: eigen spell-notities (WP42); beide niet in undo

/* Undo-geschiedenis (DA2): ook in IndexedDB, één sleutel per stap ("h:000000123"), zodat elke stap één snapshot
   schrijft. Stand en stap gaan samen in één transactie. Na herladen terug, behalve na een app-update, een
   volledige import of als de laatste stap ouder is dan HIST_AGE (nieuwe sessie = schone lei, UX-keuze). */
export const HIST_MAX = 80, HIST_AGE = 6 * 3600e3;
const HLO = "h:", HHI = "h:\uffff", hk = (n) => HLO + String(n).padStart(9, "0");
let hkeys = [], seq = 0, stored = null;
/* TS2: sheets en portretten staan niet in elke stap maar één keer (js/histpack.js), in IndexedDB als "hb:<sleutel>" = { k, s }.
   blobs: sleutel → { s, n, w }, n = aantal stappen in hist dat ernaar verwijst (0 = weg), w = staat (vermoedelijk) in
   IndexedDB; na een mislukte batch weet je dat niet meer, dan opnieuw schrijven bij het volgende gebruik. hrefs: per stap de sleutels.
   cur: sleutel → inhoud van de huidige stand (lastJSON); die komt pas in blobs als de stand een undo-stap wordt. */
const BLO = "hb:", BHI = "hb:\uffff";
let blobs = new Map(), hrefs = [], cur = new Map(), storedB = null;
const known = (k) => { const b = blobs.get(k); return b ? b.s : cur.get(k); };
const snap = () => pack(app.S, known);
const full = (j, refs) => unpack(j, (k) => refs.get(k));

let hist = [], lastJSON = null, prevObj = null, pendingWhy = [], pendingSum = null, pendingKey = null, steps = 0;
/* Opnieuw (GV8): stappen die net ongedaan zijn gemaakt, { j, refs } zoals lastJSON/cur. Alleen in het geheugen (UX-keuze):
   leeg bij elke nieuwe wijziging, bij een nieuw vertrekpunt en na herladen. */
let redos = [], redoing = false;
let warn = () => {}, warned = false;
export const setWarn = (fn) => { warn = fn; };

/** Oorzaak voor de volgende logregel(s); t = descriptor (M, WP27) of tekst; id = deelnemer, of leeg voor alle regels van deze stap */
export const because = (t, id) => pendingWhy.push({ t, id: id || null });
export const addWhy = (arr) => pendingWhy.push(...arr);
/**
 * Eén logregel voor deze stap in plaats van een regel per deelnemer die erbij kwam of wegging (encounter inladen).
 * key: de regel is later terug te vinden en bij te werken (samenvatting bij Gevecht afronden, GV2).
 */
export const logAs = (msg, key) => { pendingSum = msg; pendingKey = key || null; }; // msg: descriptor (WP27) of tekst
export const canUndo = () => hist.length > 0;
export const canRedo = () => redos.length > 0;
/** Opnieuw onmogelijk maken (bv. Ongedaan haalde ook buiten S iets weg dat Opnieuw niet terugzet) */
export const clearRedo = () => { redos = []; };
export const historySize = () => hist.length;
/** Aantal apart bewaarde sheets/portretten in de geschiedenis (TS2, voor tests) */
export const histBlobs = () => blobs.size;
/** Loopt op bij elke vastgelegde stap en elke undo: "is er sindsdien iets gebeurd?" */
export const stepNo = () => steps;

function save(key, value) {
  store.set(key, value).then((ok) => {
    if (!ok && !warned) { warned = true; warn(tr({ k: "init.saveFail" })); }
  });
}
// Waardevolle data (niet de lopende encounter): telt voor de exportherinnering (DA1)
const keep = (key, value) => { if (!store.canWrite()) return; markDirty(); save(key, value); }; // gestopt tabblad (DA3): ook geen herinnering
export const saveParty = () => keep("party", app.party);
export const saveLairs = () => keep("lairs", app.lairs);
export const saveEncounters = () => keep("encounters", app.encounters);
export const saveSpellNotes = () => keep("spellNotes", app.spellNotes);
export function saveLibrary() {
  keep("custom", app.custom); keep("imported", app.imported);
  setLibrary({ custom: app.custom, imported: app.imported });
}

export async function load() {
  let encs, notes;
  [app.S, app.party, app.lairs, app.custom, app.imported, encs, notes, stored, storedB] = await Promise.all([
    store.get("state", null), store.get("party", []), store.get("lairs", {}), store.get("custom", []), store.get("imported", []), store.get("encounters", []), store.get("spellNotes", {}),
    store.range(HLO, HHI), store.range(BLO, BHI),
  ]);
  app.encounters = cleanEncounters(encs);
  app.spellNotes = cleanSpellNotes(notes);
  setLibrary({ custom: app.custom, imported: app.imported });
  store.persistStorage();
}

/**
 * Welke bewaarde undo-stappen na herladen terugkomen (puur). rows: op sleutelvolgorde, { k, v, t, s }.
 * Alleen de laatste aaneengesloten reeks van deze versie (oudere snapshots passen niet bij nieuwe code), niets als de
 * laatste stap ouder is dan maxAge, geen stappen aan het eind die gelijk zijn aan de huidige stand (half geschreven), max HIST_MAX.
 */
export function restoreHist(rows, { version, now, cur: curJSON, maxAge = HIST_AGE, has = () => true }) {
  rows = Array.isArray(rows) ? rows : [];
  const ok = (r) => r && typeof r.k === "string" && r.k.startsWith(HLO) && typeof r.s === "string" && r.v === version && Number.isFinite(r.t)
    && Array.isArray(r.b) && r.b.every((k) => typeof k === "string");
  let i = rows.length;
  while (i > 0 && ok(rows[i - 1])) i--;
  // ontbreekt een sheet (mislukte opslag), dan kan undo niet voorbij die stap: alleen wat erna komt
  for (let j = rows.length - 1; j >= i; j--) if (!rows[j].b.every(has)) { i = j + 1; break; }
  let keep = rows.slice(i);
  while (keep.length && keep[keep.length - 1].s === curJSON) keep.pop();
  const last = keep[keep.length - 1];
  if (!last || !(now - last.t <= maxAge) || last.t > now + 60e3) keep = []; // klok terug: niet vertrouwen
  keep = keep.slice(-HIST_MAX);
  const kept = new Set(keep.map((r) => r.k));
  return { keep, drop: rows.filter((r) => !(r && kept.has(r.k))).map((r) => r && r.k).filter((k) => typeof k === "string") };
}

// stand + wijzigingen aan de geschiedenis in één transactie; lukt IndexedDB niet, dan de stand zoals vroeger (met terugval)
// Terugval met de stand van dát moment (prevObj), niet die van deze stap: een latere batch kan al gelukt zijn
// Mislukte batch (opslag vol): die stap ontbreekt in IndexedDB. Bij de volgende gelukte batch begint de bewaarde
// geschiedenis opnieuw, anders springt undo na herladen over het gat heen naar een oudere stand.
let gap = false;
function persist(ops) {
  const fix = gap;
  if (fix) {
    const put = ops.find((o) => o[0] === "put" && o[1] === hk(seq));
    ops.unshift(put ? ["delRange", HLO, hk(seq - 1)] : ["delRange", HLO, HHI]);
  }
  ops.push(["put", "state", prevObj]);
  store.batch(ops).then((ok) => { if (!ok) { gap = true; for (const e of blobs.values()) e.w = false; } else if (fix) gap = false; if (!ok) save("state", prevObj); }); // prevObj van nu: altijd de nieuwste stand
}

/**
 * Huidige stand is het nieuwe vertrekpunt (geen undo-stap, geen logregels).
 * boot: na herladen de bewaarde geschiedenis terugzetten (restoreHist); anders (import) wissen.
 */
export function resetBaseline(boot = false) {
  tidy(app.S); // zelfde normalisatie als commit(), anders wordt die de eerste (onuitwisbare) undo-stap
  blobs = new Map(); cur = new Map(); redos = [];
  const p = snap();
  lastJSON = p.j; cur = p.refs; prevObj = full(p.j, cur); pendingWhy = []; pendingSum = pendingKey = null;
  let ops;
  if (boot && stored) {
    const B = new Map();
    for (const x of storedB || []) if (x && typeof x.k === "string" && typeof x.s === "string") B.set(x.k, x.s);
    const r = restoreHist(stored, { version: VERSION, now: Date.now(), cur: lastJSON, has: (k) => B.has(k) });
    hist = r.keep.map((x) => x.s); hkeys = r.keep.map((x) => x.k); hrefs = r.keep.map((x) => x.b);
    for (const b of hrefs) for (const k of b) { const e = blobs.get(k); if (e) e.n++; else blobs.set(k, { s: B.get(k), n: 1, w: true }); }
    // boven álle bewaarde sleutels, ook die weg moeten: mislukt het wissen, dan komen nieuwe stappen er toch na
    for (const x of stored) { const n = x && typeof x.k === "string" ? +x.k.slice(HLO.length) : NaN; if (n > seq) seq = n; }
    ops = r.drop.map((k) => ["del", k]);
    for (const k of B.keys()) if (!blobs.has(k)) ops.push(["del", BLO + k]);
  } else {
    hist = []; hkeys = []; hrefs = [];
    ops = [["delRange", HLO, HHI], ["delRange", BLO, BHI]];
  }
  stored = storedB = null;
  persist(ops);
}

/**
 * Legt een wijziging vast: logregels, undo-stap, opslag en party-sync.
 * Doet niets als er niets veranderde. Geeft true terug bij een wijziging.
 */
export function commit() {
  // effecten en condities (Hold Person) van een caster die geen concentratie meer heeft (0 HP, nieuwe spell, verwijderd) horen bij deze stap
  if (!redoing) { // een stap van Opnieuw is al genormaliseerd en heeft zijn logregels al
    pendingWhy.push(...endRage(app.S.list).why, ...endConcEffects(app.S.list, app.S.active).why, ...endConcConds(app.S.list).why); // RE16: rage voorbij bij bewusteloos
    tidy(app.S); // wie neer ging (GV2), ingeladen encounter vergeten zonder monsters (VB2)
  }
  let p = snap();
  if (p.j === lastJSON) { pendingWhy = []; pendingSum = pendingKey = null; return false; }
  if (!redoing) redos = []; // nieuwe wijziging: wat ongedaan was, komt niet meer terug
  const ops = [];
  if (lastJSON !== null) {
    const k = hk(++seq), b = [...cur.keys()];
    for (const [x, s] of cur) {
      const e = blobs.get(x) || { s, n: 0, w: false };
      if (!e.n) blobs.set(x, e);
      e.n++;
      if (!e.w) { e.w = true; ops.push(["put", BLO + x, { k: x, s }]); }
    }
    hist.push(lastJSON); hkeys.push(k); hrefs.push(b);
    ops.push(["put", k, { k, v: VERSION, t: Date.now(), s: lastJSON, b }]);
    if (hist.length > HIST_MAX) { hist.shift(); ops.push(["del", hkeys.shift()]); unref(hrefs.shift(), ops); }
    if (!redoing && writeLog(prevObj)) p = snap();
  }
  pendingWhy = []; pendingSum = pendingKey = null; steps++;
  lastJSON = p.j; cur = p.refs; prevObj = full(p.j, cur);
  persist(ops);
  syncParty();
  return true;
}

/** Logregel van deze stap of een eerdere met deze key bijwerken (de laatste); hoort bij de volgende commit */
export function relog(key, msg) {
  const L = app.S.log || [];
  for (let i = L.length - 1; i >= 0; i--) if (L[i].key === key) { setMsg(L[i], msg); return; } // geen findLast: oudere iPads
}
const desc = (x) => isMsg(x) || isJoin(x);
/** Tekst en descriptor van een logregel: msg altijd tekst (actieve taal; oudere apps, export), m alleen bij een descriptor (WP27) */
function setMsg(e, msg) { e.msg = tr(msg); if (desc(msg)) e.m = msg; else delete e.m; }

export function undo() {
  if (!hist.length) return false;
  pendingSum = pendingKey = null;
  const j = hist.pop(), k = hkeys.pop(), b = hrefs.pop() || [];
  const refs = new Map(b.map((x) => [x, known(x)]));
  const S = full(j, refs);
  if (!S) { hist = []; hkeys = []; hrefs = []; redos = []; blobs = new Map(); persist([["delRange", HLO, HHI], ["delRange", BLO, BHI]]); return false; } // vangnet, hoort niet te gebeuren
  redos.push({ j: lastJSON, refs: cur });
  if (redos.length > HIST_MAX) redos.shift();
  app.S = S;
  lastJSON = j; cur = refs; prevObj = full(j, refs); pendingWhy = []; steps++;
  const ops = k ? [["del", k]] : [];
  unref(b, ops);
  persist(ops);
  syncParty();
  return true;
}

/** Opnieuw (GV8): de laatst ongedaan gemaakte stap terug, als gewone stap (opslag, undo, party-sync), zonder nieuwe logregels */
export function redo() {
  const r = redos.pop();
  if (!r) return false;
  const S = full(r.j, r.refs);
  if (!S) { redos = []; return false; }
  app.S = S; pendingWhy = []; pendingSum = pendingKey = null;
  redoing = true;
  try { commit(); } finally { redoing = false; }
  return true;
}

// stap weg uit hist: sheets waar geen stap meer naar verwijst ook weg (de huidige stand heeft ze zelf in cur)
function unref(keys, ops) {
  for (const k of keys) {
    const e = blobs.get(k);
    if (e && --e.n <= 0) { blobs.delete(k); ops.push(["del", BLO + k]); }
  }
}

function writeLog(prev) {
  const S = app.S;
  let entries = diffLog(prev, S);
  if (pendingSum) { // erbij of weg (encounter inladen): samen één regel, met alleen de oorzaken die voor de hele stap gelden
    const P = new Set(prev.list.map((c) => c.id)), C = new Set(S.list.map((c) => c.id));
    entries = entries.filter((e) => e.type || (P.has(e.who) && C.has(e.who)));
    entries.push({ m: pendingSum, sum: true, key: pendingKey });
  }
  if (!entries.length) return false;
  S.log = S.log || [];
  const act = S.list.find((c) => c.id === S.active);
  for (const e of entries) {
    const ws = e.type ? [] : pendingWhy.filter((w) => !w.id || (!e.sum && w.id === e.who)).map((w) => w.t).filter((x) => x != null && x !== "");
    const row = { id: uid(), r: S.round || 0, turn: e.type ? "" : act ? act.name : "", type: e.type || "", msg: "", why: ws.map(tr).join("; "), note: "", ...(e.key ? { key: e.key } : {}) };
    setMsg(row, e.m !== undefined ? e.m : e.msg);
    if (ws.some(desc)) row.w = ws; // oorzaken als descriptoren (WP27); why blijft de tekst
    S.log.push(row);
  }
  if (S.log.length > 600) S.log.splice(0, S.log.length - 600);
  return true;
}

/* ---------- vaste party: HP, slots en resources lopen door van gevecht naar gevecht ---------- */
const PKEYS = ["name", "race", "img", "ac", "max", "hp", "temp", "dex", "initBonus", "casting", "res", "sheet", "ds", "ddbId", "eff", "dr", "slotSelf", "pas"];

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
