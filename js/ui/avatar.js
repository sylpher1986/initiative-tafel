// Avatar per deelnemer: portret uit de character sheet, anders een icoon op ras (speler) of creature type (monster).
// Icoontjes: game-icons.net (CC BY 3.0), als sprite in icons/creatures.svg. Puur, behalve de HTML-uitvoer.
import { esc } from "./util.js";

const SPRITE = "icons/creatures.svg";
const TYPES = "aberration|beast|celestial|construct|dragon|elemental|fey|fiend|giant|humanoid|monstrosity|ooze|plant|undead";
const TYPE_RE = new RegExp(`\\b(${TYPES})s?\\b`);

/** "Large aberration, lawful evil" → "aberration"; onbekend → "monstrosity" */
export function monType(meta) {
  const m = String(meta || "").split(",")[0].toLowerCase().match(TYPE_RE);
  return m ? m[1] : "monstrosity";
}

// Volgorde telt: half-elf vóór elf, half-orc vóór orc
const RACES = [
  [/dragonborn/, "dragonborn"], [/half[\s-]*orc/, "halforc"], [/half[\s-]*elf/, "halfelf"], [/tiefling/, "tiefling"],
  [/gnome/, "gnome"], [/halfling/, "halfling"], [/dwarf|duergar/, "dwarf"], [/elf|eladrin|drow/, "elf"],
  [/human/, "human"], [/\borc\b/, "halforc"],
];
/** "Hill Dwarf" → "dwarf"; onbekend of leeg → "pc" (algemeen spelersicoon) */
export function raceKey(race) {
  const r = String(race || "").toLowerCase();
  for (const [re, k] of RACES) if (re.test(r)) return k;
  return "pc";
}
/** Keuzes in het spelersformulier (D&D-termen blijven Engels) */
export const RACE_OPTS = ["Human", "Elf", "Half-Elf", "Dwarf", "Halfling", "Gnome", "Half-Orc", "Tiefling", "Dragonborn"];

/** Ras bij toevoegen: keuze in het formulier gaat voor; dezelfde soort als de sheet → sheettekst houden ("Hill Dwarf").
 *  Bewust "Anders / onbekend" bij een herkend sheetras → leeg (algemeen icoon). Onherkend sheetras → sheettekst. */
export function pickRace(sel, sheetRace) {
  const s = String(sel || ""), r = String(sheetRace || "");
  if (s) return r && raceKey(s) === raceKey(r) ? r : s;
  return raceKey(r) === "pc" ? r : "";
}

/** Lege race ("" = bewust onbekend) gaat voor het sheetras; alleen oude data zonder race valt terug op de sheet */
export const iconId = (c, meta) => (c.kind === "pc" ? "r-" + raceKey(c.race != null ? c.race : c.sheet && c.sheet.race) : "m-" + monType(meta));

/** Alleen kleine base64-afbeeldingen (jpeg/png/webp); al het andere (url's, svg, scripts) wordt weggegooid */
const IMG_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
export const IMG_MAX = 60000;
export const cleanImg = (v) => (typeof v === "string" && v.length <= IMG_MAX && IMG_RE.test(v) ? v : null);

/** Sprite-icoon als inline svg (decoratief) */
export const icon = (id, cls = "") => `<svg class="ic ${cls}" aria-hidden="true" focusable="false"><use href="${SPRITE}#${esc(id)}"/></svg>`;

/** Rond avatar: portret als het er is, anders icoon */
export function avatar(c, meta) {
  const img = cleanImg(c.img);
  if (img) return `<span class="av img" aria-hidden="true"><img src="${esc(img)}" alt=""></span>`;
  return `<span class="av" aria-hidden="true">${icon(iconId(c, meta))}</span>`;
}

/** Leeg vlak? (standaardafwijking van de helderheid, RGBA-pixels). Puur, voor het portret uit een PDF. */
export function isBlank(px, minDev = 8) {
  let n = 0, s = 0, s2 = 0;
  for (let i = 0; i + 2 < px.length; i += 16) { // elke 4e pixel is genoeg
    const y = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    s += y; s2 += y * y; n++;
  }
  if (!n) return true;
  const m = s / n;
  return Math.sqrt(Math.max(0, s2 / n - m * m)) < minDev;
}
