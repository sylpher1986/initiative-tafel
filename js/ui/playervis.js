// Instelling "Wat spelers zien" (Instellingen → Spelersscherm). Bewaard op dit apparaat (zoals Spells), niet in de
// encounter of export: het is de stijl van deze tafel. Alleen het DM-apparaat maakt de snapshot, dus alle
// spelersschermen (ander venster en kamer) volgen vanzelf. Standaardwaarden worden niet opgeslagen.
import { VIS, cleanVis } from "../playerview.js";

const KEY = "it-player-vis";
let cur = read();
function read() {
  try { return cleanVis(JSON.parse(localStorage.getItem(KEY) || "null")); } catch { return { ...VIS }; }
}
export const visNow = () => cur;
export function setVis(k, v) {
  cur = cleanVis({ ...cur, [k]: v });
  const diff = Object.fromEntries(Object.entries(cur).filter(([x, y]) => y !== VIS[x]));
  try { Object.keys(diff).length ? localStorage.setItem(KEY, JSON.stringify(diff)) : localStorage.removeItem(KEY); } catch { /* privémodus: alleen deze sessie */ }
  return cur;
}
