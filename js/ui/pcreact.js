// GV4: Reaction van spelers als knop op de kaart, of "spelers zelf" (geen knop, geen badge). Instellingen → Weergave,
// per apparaat (localStorage), niet in undo of export. Alleen weergave: c.reaction blijft volgens de regels bijgehouden
// (Shield, verrast, reset bij de eigen beurt). Monsters houden altijd de knop.
const KEY = "it-pc-react";
let on = read();
function read() {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}
/** true = knop op spelerskaarten (standaard) */
export const pcReact = () => on;
export function setPcReact(v) {
  on = v !== "off";
  try { on ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, "off"); } catch { /* privémodus: alleen deze sessie */ }
  return on;
}
