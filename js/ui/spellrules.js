// Instelling "Spells" (2014 | 2024): hoe de app spells afhandelt (presets, concentratie, Sleep) én welke tekst het
// spell-paneel eerst toont (één instelling, zodat lezen en rekenen niet uiteen kunnen lopen). Alleen spells:
// de rest van de app (condities, crits, concentration-DC) blijft 2014. Bewaard op dit apparaat, niet in de encounter.
// Wat al loopt houdt de regels van het moment van casten (effecten leggen hun vervolg vast, condities hun duur).
import { app } from "../state.js";
import { EDS, rulesOf, spellEdOf } from "../rules/edition.js";
const KEY = "it-spell-rules";
let cur = read();
try { localStorage.removeItem("it-spell-ed"); } catch { /* oude, aparte leesvoorkeur (1.20–1.21.0): vervalt, de regels winnen */ }
function read() {
  try { const v = localStorage.getItem(KEY); return EDS.includes(v) ? v : "2014"; } catch { return "2014"; }
}
/** Ruwe instelling (Instellingen toont die); voor rekenen en tonen altijd spellEd() */
export const rulesEd = () => cur;
/** G1/B2: spell-editie die geldt: regelset 2024 → 2024, anders de instelling */
export const spellEd = () => spellEdOf(rulesOf(app.S), cur);
export function setRulesEd(ed) {
  cur = EDS.includes(ed) ? ed : "2014";
  try { cur === "2014" ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, cur); } catch { /* privémodus: alleen deze sessie */ }
  return cur;
}
