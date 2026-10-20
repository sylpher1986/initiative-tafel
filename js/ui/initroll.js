// GV5: initiative van monsters bij Start gevecht houden of opnieuw rollen. Keuze in het initiative-paneel,
// per apparaat onthouden (localStorage), niet in undo of export. Standaard Houden (zoals vóór 1.31.5).
const KEY = "it-init-reroll";
let cur = read();
function read() {
  try { return localStorage.getItem(KEY) === "roll" ? "roll" : "keep"; } catch { return "keep"; }
}
/** "keep" | "roll" */
export const initRoll = () => cur;
export function setInitRoll(v) {
  cur = v === "roll" ? "roll" : "keep";
  try { cur === "roll" ? localStorage.setItem(KEY, cur) : localStorage.removeItem(KEY); } catch { /* privémodus: alleen deze sessie */ }
  return cur;
}
