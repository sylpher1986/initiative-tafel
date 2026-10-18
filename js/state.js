// Centrale toestand, vastleggen van wijzigingen (logboek + undo), opslag en party-sync.
import * as store from "./storage.js";
import { diffLog } from "./log.js";
import { uid } from "./rules/dice.js";
import { setLibrary } from "./data/monsters.js";

/** Alle data van de app. S = de lopende encounter. */
export const app = { S: null, party: [], lairs: {}, custom: [], imported: [] };

let hist = [], lastJSON = null, prevObj = null, pendingWhy = [];
let warn = () => {}, warned = false;
export const setWarn = (fn) => { warn = fn; };

/** Oorzaak voor de volgende logregel(s); id = deelnemer, of leeg voor alle regels van deze stap */
export const because = (t, id) => pendingWhy.push({ t, id: id || null });
export const addWhy = (arr) => pendingWhy.push(...arr);
export const canUndo = () => hist.length > 0;
export const historySize = () => hist.length;

function save(key, value) {
  store.set(key, value).then((ok) => {
    if (!ok && !warned) { warned = true; warn("Opslaan in deze browser lukt niet (vol of geblokkeerd). Maak een export als je je data wilt bewaren."); }
  });
}
export const saveParty = () => save("party", app.party);
export const saveLairs = () => save("lairs", app.lairs);
export function saveLibrary() {
  save("custom", app.custom); save("imported", app.imported);
  setLibrary({ custom: app.custom, imported: app.imported });
}

export async function load() {
  [app.S, app.party, app.lairs, app.custom, app.imported] = await Promise.all([
    store.get("state", null), store.get("party", []), store.get("lairs", {}), store.get("custom", []), store.get("imported", []),
  ]);
  setLibrary({ custom: app.custom, imported: app.imported });
  store.persistStorage();
}

/** Na een import of bij opstarten: huidige stand is het nieuwe vertrekpunt (geen undo-stap, geen logregels) */
export function resetBaseline() {
  lastJSON = JSON.stringify(app.S); prevObj = JSON.parse(lastJSON); hist = []; pendingWhy = [];
  save("state", prevObj);
}

/**
 * Legt een wijziging vast: logregels, undo-stap, opslag en party-sync.
 * Doet niets als er niets veranderde. Geeft true terug bij een wijziging.
 */
export function commit() {
  let j = JSON.stringify(app.S);
  if (j === lastJSON) { pendingWhy = []; return false; }
  if (lastJSON !== null) {
    hist.push(lastJSON);
    if (hist.length > 80) hist.shift();
    if (writeLog(prevObj)) j = JSON.stringify(app.S);
  }
  pendingWhy = [];
  lastJSON = j; prevObj = JSON.parse(j);
  save("state", prevObj);
  syncParty();
  return true;
}

export function undo() {
  if (!hist.length) return false;
  const j = hist.pop();
  app.S = JSON.parse(j);
  lastJSON = j; prevObj = JSON.parse(j); pendingWhy = [];
  save("state", prevObj);
  syncParty();
  return true;
}

function writeLog(prev) {
  const S = app.S;
  const entries = diffLog(prev, S);
  if (!entries.length) return false;
  S.log = S.log || [];
  const act = S.list.find((c) => c.id === S.active);
  for (const e of entries) {
    const why = e.type ? "" : pendingWhy.filter((w) => !w.id || w.id === e.who).map((w) => w.t).join("; ");
    S.log.push({ id: uid(), r: S.round || 0, turn: e.type ? "" : act ? act.name : "", type: e.type || "", msg: e.msg, why, note: "" });
  }
  if (S.log.length > 600) S.log.splice(0, S.log.length - 600);
  return true;
}

/* ---------- vaste party: HP, slots en resources lopen door van gevecht naar gevecht ---------- */
const PKEYS = ["name", "race", "img", "ac", "max", "hp", "temp", "dex", "initBonus", "casting", "res", "sheet", "ds", "ddbId"];

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
