// Uitleg bij condities (RE10) en Exhaustion-niveaus (RE11), 5e 2014. Puur: geen DOM.
// De tekst staat in de catalogus (locales/src/*/dnd.js, dnd.cond.* en dnd.exh.*; WP29): eigen samenvatting van de
// SRD 5.1 (appendix A). Hier alleen de id's en de opbouw; functies geven descriptoren (js/i18n/msg.js) terug.
import { M, J } from "../i18n/msg.js";
import { term } from "../i18n/term.js";

/** Uitleg per id: aantal regels (dnd.cond.<id>.1 …). Id = Engelse conditienaam, plus Surprised (badge) en Exhaustion */
export const CINFO = {
  Blinded: 2, Charmed: 2, Deafened: 1, Frightened: 2, Grappled: 2, Incapacitated: 1, Invisible: 2, Paralyzed: 2,
  Petrified: 2, Poisoned: 1, Prone: 2, Restrained: 2, Stunned: 2, Unconscious: 2, Concentrating: 2, Surprised: 2, Exhaustion: 1,
};
/** Id van de uitleg bij de badge Verrast (geen conditie in c.cond, maar c.sur) */
export const SUR = "Surprised";
/** Heeft deze id uitleg? (eigen sleutel: geen "constructor" of andere prototype-naam) */
export const hasCondInfo = (k) => Object.prototype.hasOwnProperty.call(CINFO, k);
/** Label bij een id: de D&D-term, Verrast in de taal van de app (tekst of descriptor) */
export const condName = (k) => (k === SUR ? M("dnd.cond.Surprised.name") : term("cond", k));

export const EXH_NAME = "Exhaustion";
export const isExh = (e) => !!e && e.n === EXH_NAME;
/** Kort, voor de rij in het Conditie-paneel; speed 0 (5) vervangt speed ½ (2) */
export const exhSummary = (lvl) => { const x = Math.max(0, Math.min(6, lvl | 0)); return x ? M("dnd.exh.sum", { n: x, list: J([1, 2, 3, 4, 5, 6].slice(0, x).filter((i) => !(x >= 5 && i === 2)).map((i) => M(`dnd.exh.s${i}`)), " · ") }) : M("dnd.exh.none"); };
/** Niveau 0–6 uit de effecten */
export const exhLevel = (c) => { const e = (c && c.eff || []).find(isExh); return e ? Math.max(1, Math.min(6, e.x | 0 || 1)) : 0; };
/** Wat er bij dit niveau geldt, opgeteld: ["1 Disadvantage on ability checks", …] als descriptoren (PHB 2014, appendix A) */
export const exhRows = (x) => Array.from({ length: Math.max(0, Math.min(6, x | 0)) }, (_, i) => J([String(i + 1), M(`dnd.exh.${i + 1}`)], " "));

/**
 * Uitleg voor het paneel (RE10). name = id (conditienaam, "Exhaustion" of "Surprised"); lvl = Exhaustion-niveau.
 * → { name, lines } (tekst of descriptoren, tonen met tr) of null als er geen uitleg is.
 */
export function condInfo(name, lvl = 0) {
  if (!hasCondInfo(name)) return null;
  const lines = Array.from({ length: CINFO[name] }, (_, i) => M(`dnd.cond.${name}.${i + 1}`));
  if (name !== EXH_NAME) return { name: condName(name), lines };
  return { name: lvl ? `${EXH_NAME} ${lvl}` : EXH_NAME, lines: [...exhRows(lvl || 6), lines[0]] };
}
