// Uitleg bij condities (RE10) en Exhaustion-niveaus (RE11), 5e 2014. Puur: geen DOM, geen imports.
// Eigen Nederlandse samenvatting van de SRD 5.1 (appendix A); de namen blijven Engels.

/** Korte uitleg per conditie: 2–3 regels, wat de DM aan tafel moet weten */
export const CINFO = {
  Blinded: ["Ziet niets: checks waarvoor je moet zien mislukken vanzelf.", "Aanvallen tegen hem hebben advantage, zijn eigen aanvallen disadvantage."],
  Charmed: ["Valt de charmer niet aan en richt geen schadelijke effecten op hem.", "De charmer heeft advantage op sociale checks tegen hem."],
  Deafened: ["Hoort niets: checks waarvoor je moet horen mislukken vanzelf."],
  Frightened: ["Disadvantage op ability checks en aanvallen zolang de bron van de angst in zicht is.", "Kan niet uit vrije wil dichter naar die bron bewegen."],
  Grappled: ["Speed 0, bonussen op speed tellen niet.", "Eindigt als de grappler incapacitated raakt of hij buiten diens bereik wordt verplaatst."],
  Incapacitated: ["Geen actions en geen reactions."],
  Invisible: ["Niet te zien zonder magie of een speciaal zintuig; wel te horen of te sporen.", "Zijn aanvallen hebben advantage, aanvallen tegen hem disadvantage."],
  Paralyzed: ["Incapacitated, kan niet bewegen of praten. STR- en DEX-saves mislukken vanzelf.", "Aanvallen tegen hem hebben advantage; raak binnen 5 ft is een kritieke treffer."],
  Petrified: ["Versteend: incapacitated, kan niet bewegen of praten. STR- en DEX-saves mislukken vanzelf.", "Aanvallen tegen hem hebben advantage. Resistance tegen alle schade, immuun voor poison en disease."],
  Poisoned: ["Disadvantage op aanvallen en ability checks."],
  Prone: ["Kan alleen kruipen; opstaan kost de helft van zijn speed. Zijn aanvallen hebben disadvantage.", "Aanvallen tegen hem binnen 5 ft hebben advantage, van verder weg disadvantage."],
  Restrained: ["Speed 0. Zijn aanvallen en DEX-saves hebben disadvantage.", "Aanvallen tegen hem hebben advantage."],
  Stunned: ["Incapacitated, kan niet bewegen en praat haperend. STR- en DEX-saves mislukken vanzelf.", "Aanvallen tegen hem hebben advantage."],
  Unconscious: ["Incapacitated, kan niet bewegen of praten, laat vallen wat hij vasthoudt en ligt prone. STR- en DEX-saves mislukken vanzelf.", "Aanvallen tegen hem hebben advantage; raak binnen 5 ft is een kritieke treffer."],
  Concentrating: ["Houdt een spell vast. Bij schade een CON-save: DC 10 of de helft van de schade, het hoogste telt.", "Voorbij bij incapacitated, 0 HP of een andere concentratie-spell."],
  Verrast: ["Slaat zijn eerste beurt over en heeft geen reaction tot die beurt voorbij is.", "Alleen in ronde 1: wie de ander niet zag aankomen (Stealth tegen passive Perception)."],
  Exhaustion: ["Zes niveaus, die optellen. Weg met één niveau per long rest (met eten en drinken)."],
};

/** Exhaustion (PHB 2014, appendix A): wat er bij elk niveau bijkomt */
export const EXH = ["", "Disadvantage op ability checks", "Speed gehalveerd", "Disadvantage op aanvallen en saves", "Max HP gehalveerd", "Speed 0", "Dood"];
export const EXH_NAME = "Exhaustion";
export const isExh = (e) => !!e && e.n === EXH_NAME;
/** Niveau 0–6 uit de effecten */
export const exhLevel = (c) => { const e = (c && c.eff || []).find(isExh); return e ? Math.max(1, Math.min(6, e.x | 0 || 1)) : 0; };
/** Wat er bij dit niveau geldt, opgeteld: ["1 Disadvantage op ability checks", …] */
export const exhRows = (x) => EXH.slice(1, Math.max(0, Math.min(6, x)) + 1).map((t, i) => `${i + 1} ${t}`);

/**
 * Uitleg voor het paneel (RE10). name = conditienaam (of "Exhaustion"/"Verrast"); lvl = Exhaustion-niveau.
 * → { name, lines } of null als er geen uitleg is.
 */
export function condInfo(name, lvl = 0) {
  const base = CINFO[name];
  if (!base) return null;
  if (name !== EXH_NAME) return { name, lines: base };
  return { name: lvl ? `${EXH_NAME} ${lvl}` : EXH_NAME, lines: [...exhRows(lvl || 6), base[0]] };
}
