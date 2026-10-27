// Uitleg bij condities (RE10) en Exhaustion-niveaus (RE11), 5e 2014; afwijkingen volgens 2024 in CINFO24 (WP52). Puur: geen DOM.
// De tekst staat in de catalogus (locales/src/*/dnd.js, dnd.cond.* en dnd.exh.*; WP29): eigen samenvatting van de
// SRD 5.1 (appendix A). Hier alleen de id's en de opbouw; functies geven descriptoren (js/i18n/msg.js) terug.
import { M, J } from "../i18n/msg.js";
import { term } from "../i18n/term.js";

/** Uitleg per id: aantal regels (dnd.cond.<id>.1 …). Id = Engelse conditienaam, plus Surprised (badge) en Exhaustion */
export const CINFO = {
  Blinded: 2, Charmed: 2, Deafened: 1, Frightened: 2, Grappled: 2, Incapacitated: 1, Invisible: 2, Paralyzed: 2,
  Petrified: 2, Poisoned: 1, Prone: 2, Restrained: 2, Stunned: 2, Unconscious: 2, Concentrating: 2, Surprised: 2, Exhaustion: 1,
};
/**
 * WP52 (G1): uitleg volgens 2024 (SRD 5.2.1, Rules Glossary). Alleen condities die afwijken; per regel 24 = eigen tekst
 * dnd.cond24.<id>.<regel>, 14 = dezelfde regel als 2014 (dnd.cond.<id>.<regel>; één sleutel = één betekenis). Niet in de
 * lijst = de 2014-uitleg geldt ongewijzigd (Blinded, Deafened, Frightened, Paralyzed, Poisoned, Prone, Restrained,
 * Unconscious, Surprised: die badge bestaat in 2024 niet, WP51).
 */
export const CINFO24 = {
  Charmed: [24, 14], Grappled: [24, 24, 24], Incapacitated: [24, 24], Invisible: [24, 24], Petrified: [14, 24],
  Stunned: [24, 14], Concentrating: [24, 14], Exhaustion: [24],
};
/** Catalogussleutels van de uitleg bij id en editie (in volgorde); [] zonder uitleg */
export function cinfoKeys(name, ed = "2014") {
  if (!hasCondInfo(name)) return [];
  const v = ed === "2024" && Object.prototype.hasOwnProperty.call(CINFO24, name) ? CINFO24[name] : null;
  if (!v) return Array.from({ length: CINFO[name] }, (_, i) => `dnd.cond.${name}.${i + 1}`);
  return v.map((e, i) => `dnd.${e === 24 ? "cond24" : "cond"}.${name}.${i + 1}`);
}
/** Id van de uitleg bij de badge Verrast (geen conditie in c.cond, maar c.sur) */
export const SUR = "Surprised";
/** Heeft deze id uitleg? (eigen sleutel: geen "constructor" of andere prototype-naam) */
export const hasCondInfo = (k) => Object.prototype.hasOwnProperty.call(CINFO, k);
/** Label bij een id: de D&D-term, Verrast in de taal van de app (tekst of descriptor) */
export const condName = (k) => (k === SUR ? M("dnd.cond.Surprised.name") : term("cond", k));

export const EXH_NAME = "Exhaustion";
export const isExh = (e) => !!e && e.n === EXH_NAME;
/** WP50: wat Exhaustion 2024 op niveau x doet: "−4 on d20 tests" + "speed −10 ft" (descriptor) */
export const exh24 = (x, sep) => J([M("dnd.exh24.d20", { n: 2 * x }), M("dnd.exh24.speed", { n: 5 * x })], sep);
/**
 * Kort, voor de rij in het Conditie-paneel; speed 0 (5) vervangt speed ½ (2). ed "2024" (WP50, SRD 5.2.1): geen
 * opgetelde lijst maar −2 × niveau op d20-tests en speed −5 ft × niveau; niveau 6 blijft de dood.
 */
export const exhSummary = (lvl, ed = "2014") => {
  const x = Math.max(0, Math.min(6, lvl | 0));
  if (!x) return M("dnd.exh.none");
  if (ed === "2024") return M("dnd.exh.sum", { n: x, list: x === 6 ? M("dnd.exh.s6") : exh24(x, " · ") });
  return M("dnd.exh.sum", { n: x, list: J([1, 2, 3, 4, 5, 6].slice(0, x).filter((i) => !(x >= 5 && i === 2)).map((i) => M(`dnd.exh.s${i}`)), " · ") });
};
/** Niveau 0–6 uit de effecten */
export const exhLevel = (c) => { const e = (c && c.eff || []).find(isExh); return e ? Math.max(1, Math.min(6, e.x | 0 || 1)) : 0; };
/**
 * Wat er bij dit niveau geldt, opgeteld: ["1 Disadvantage on ability checks", …] als descriptoren (PHB 2014, appendix A).
 * ed "2024": één regel voor het niveau (de straf groeit mee, er komt niets bij), niveau 6 = de dood.
 */
export const exhRows = (x, ed = "2014") => {
  const n = Math.max(0, Math.min(6, x | 0));
  if (ed === "2024") return n ? [J([String(n), n === 6 ? M("dnd.exh.6") : exh24(n, ", ")], " ")] : [];
  return Array.from({ length: n }, (_, i) => J([String(i + 1), M(`dnd.exh.${i + 1}`)], " "));
};
/** Regels van het Exhaustion-effect zelf (WP50): "2024" als het zo is vastgelegd, anders "2014" */
export const exhEd = (c) => { const e = (c && c.eff || []).find(isExh); return e && e.ed === "2024" ? "2024" : "2014"; };
/**
 * WP50: d20-straf van Exhaustion 2024 als vaste modifier { n: "Exhaustion 2", b: -4 } (aanval, save, initiative), of
 * null (geen exhaustion of 2014: daar geeft niveau 3+ disadvantage, zie saveAdv/atkAdv).
 */
export const exhMod = (c) => { const x = exhLevel(c); return x && x < 6 && exhEd(c) === "2024" ? { n: `${EXH_NAME} ${x}`, b: -2 * x } : null; };

/**
 * Uitleg voor het paneel (RE10). name = id (conditienaam, "Exhaustion" of "Surprised"); lvl = Exhaustion-niveau;
 * ed = regels ("2024" = SRD 5.2.1, WP52; anders 2014). → { name, lines } (descriptoren, tonen met tr) of null.
 * Exhaustion 2014 zonder niveau toont alle zes niveaus; 2024 zonder niveau alleen de algemene regel (die zegt het al).
 */
export function condInfo(name, lvl = 0, ed = "2014") {
  if (!hasCondInfo(name)) return null;
  const e24 = ed === "2024" ? "2024" : "2014", lines = cinfoKeys(name, e24).map((k) => M(k));
  if (name !== EXH_NAME) return { name: condName(name), lines };
  const rows = e24 === "2024" ? exhRows(lvl, e24) : exhRows(lvl || 6);
  return { name: lvl ? `${EXH_NAME} ${lvl}` : EXH_NAME, lines: [...rows, lines[0]] };
}
