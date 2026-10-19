// Instelling "Spells" (2014 | 2024): hoe de app spells afhandelt (presets, concentratie, Sleep) én welke tekst het
// spell-paneel eerst toont (één instelling, zodat lezen en rekenen niet uiteen kunnen lopen). Alleen spells:
// de rest van de app (condities, crits, concentration-DC) blijft 2014. Bewaard op dit apparaat, niet in de encounter.
// Wat al loopt houdt de regels van het moment van casten (effecten leggen hun vervolg vast, condities hun duur).
const KEY = "it-spell-rules", EDS = ["2014", "2024"];
let cur = read();
try { localStorage.removeItem("it-spell-ed"); } catch { /* oude, aparte leesvoorkeur (1.20–1.21.0): vervalt, de regels winnen */ }
function read() {
  try { const v = localStorage.getItem(KEY); return EDS.includes(v) ? v : "2014"; } catch { return "2014"; }
}
export const rulesEd = () => cur;
export function setRulesEd(ed) {
  cur = EDS.includes(ed) ? ed : "2014";
  try { cur === "2014" ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, cur); } catch { /* privémodus: alleen deze sessie */ }
  return cur;
}
