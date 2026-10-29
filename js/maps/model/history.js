// Inn Sight (G4, WP61): undo/redo, puur (geen DOM, Node-testbaar). Een stap = { before, after, group }: before/after
// zijn kleine "patches" met alleen de velden van het kaartdocument die de stap verandert (grid, bg, objs, terr; undefined =
// veld afwezig). Waarden worden nooit ter plekke gewijzigd (de editor maakt altijd nieuwe objecten/lijsten), dus een
// stap houdt alleen verwijzingen vast. Alleen in het geheugen, per geopende kaart, max HIST_MAX stappen; niet in de
// opslag en niet in een export (docs/g4-inn-the-grid.md §2.4). Naam en kaartlijst vallen erbuiten.
// Groeperen: opeenvolgende stappen met dezelfde group (bijv. één uitlijnsessie: slepen + pijltjes tot Klaar) worden één
// stap; seal() sluit de groep af. Een groep die per saldo niets veranderde, verdwijnt. meta = beschrijving van de stap
// als code (bijv. { k: "place", id: "table" }) voor de knoplabels; de UI maakt er tekst van.
import { LIMITS } from "./limits.js";

/** Maximaal aantal stappen (oudste vallen weg) */
export const HIST_MAX = LIMITS.hist;

// Lijsten (objs) zijn altijd nieuw bij een wijziging: identiteit volstaat (geen JSON over 2000 objecten per tik);
// kleine objecten (grid, bg) worden op inhoud vergeleken. terr (WP63, ± 10 KB tekst) ook: één keer per veeg, en verven
// en weer terugwissen naar dezelfde stand geeft zo terecht geen stap.
const same = (a, b) => a === b || (!Array.isArray(a) && !Array.isArray(b) && JSON.stringify(a) === JSON.stringify(b));
/** Verandert een stap iets? (alle sleutels van before en after vergelijken) */
export const changes = (before, after) => [...new Set([...Object.keys(before), ...Object.keys(after)])].some((k) => !same(before[k], after[k]));

/** Patch toepassen: nieuwe kaart (kopie) met de velden uit patch (undefined = veld weg) */
export function apply(doc, patch) {
  const out = { ...doc };
  for (const [k, v] of Object.entries(patch)) { if (v === undefined) delete out[k]; else out[k] = v; }
  return out;
}

export function createHistory(max = HIST_MAX) {
  let done = [], undone = [];
  return {
    /** Wijziging vastleggen; group = samenvoegen met de vorige stap als die dezelfde (open) groep heeft. Geeft de stap
     *  (als teken voor isTop) of null als er niets veranderde. */
    record(before, after, group = null, meta = null) {
      const top = done[done.length - 1];
      if (group !== null && top && top.group === group) {
        for (const k of Object.keys(after)) if (!(k in top.before)) top.before[k] = before[k];
        top.after = { ...top.after, ...after };
        if (meta) top.meta = meta;
        undone = [];
        if (!changes(top.before, top.after)) { done.pop(); return null; }
        return top;
      }
      if (!changes(before, after)) return null;
      const s = { before: { ...before }, after: { ...after }, group, meta };
      done.push(s);
      if (done.length > max) done.splice(0, done.length - max);
      undone = [];
      return s;
    },
    /** Lopende groep afsluiten (volgende stap met dezelfde naam wordt een nieuwe stap) */
    seal() { const top = done[done.length - 1]; if (top) top.group = null; },
    /** Laatste stap terugdraaien: geeft de patch om toe te passen, of null */
    undo() { const s = done.pop(); if (!s) return null; s.group = null; undone.push(s); return s.before; },
    /** Teruggedraaide stap opnieuw: patch of null */
    redo() { const s = undone.pop(); if (!s) return null; done.push(s); return s.after; },
    /** Beschrijving (meta) van wat undo en redo nu zouden doen, of null */
    peek: () => ({ undo: done.length ? done[done.length - 1].meta : null, redo: undone.length ? undone[undone.length - 1].meta : null }),
    /** Is s (teken uit record) de laatste stap? (Ongedaan in een melding mag alleen dan de gewone undo zijn) */
    isTop: (s) => !!s && done[done.length - 1] === s,
    clear() { done = []; undone = []; },
    get canUndo() { return done.length > 0; },
    get canRedo() { return undone.length > 0; },
    get size() { return done.length; },
  };
}
