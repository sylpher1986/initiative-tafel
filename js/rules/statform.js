// G1 (WP48): statblocktekst editiebestendig lezen. Puur: geen DOM.
// SRD 5.1 (2014) en SRD 5.2 (2024) schrijven hetzelfde anders; de parsers lezen één vorm, de klassieke. Deze module
// zet de 2024-schrijfwijze om (classic) en leest de verdedigingsregels uit beide vormen (defRows). Op 2014-tekst
// verandert classic niets (de 2024-patronen komen daar niet in voor; tests/wp48.test.js bewaakt de 2014-uitkomsten).

/**
 * 2024-schrijfwijze naar de klassieke, zodat parseAction/actionAoe/parseRider het lezen:
 * "Melee Attack Roll: +4, reach 5 ft." → "Melee Attack: +4 to hit, reach 5 ft.";
 * "Strength Saving Throw: DC 13, …" → "DC 13 Strength saving throw, …"; "Failure: …" blijft staan.
 */
export function classic(t) {
  return String(t)
    .replace(/\b((?:Melee|Ranged|Melee or Ranged)\s+)?Attack Roll:\s*([+-]\d+)/gi, (_, k, b) => `${k || ""}Attack: ${b} to hit`)
    .replace(/\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) Saving Throw:\s*DC (\d+)/g, "DC $2 $1 saving throw");
}

const CONDS = ["blinded", "charmed", "deafened", "exhaustion", "frightened", "grappled", "incapacitated", "invisible", "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious"];
const onlyConds = (s) => !!s.trim() && s.split(/,|\band\b/i).every((w) => !w.trim() || CONDS.includes(w.trim().toLowerCase()));

/**
 * Verdedigingsregels uit m.x als { vuln, res, imm, cimm } (tekst, "" = geen).
 * 2014: "Damage Vulnerabilities/Resistances/Immunities", "Condition Immunities".
 * 2024: "Vulnerabilities", "Resistances", "Immunities" met schade vóór ";" en condities erna ("Fire, Poison; Poisoned");
 * zonder ";" alleen condities als elk woord een conditie is. Een 2014-regel wint als beide er (eigen monster) staan.
 */
export function defRows(x) {
  const rows = Array.isArray(x) ? x.filter(Array.isArray) : [];
  const get = (l) => String((rows.find((r) => r[0] === l) || [])[1] || "");
  const out = { vuln: get("Damage Vulnerabilities"), res: get("Damage Resistances"), imm: get("Damage Immunities"), cimm: get("Condition Immunities") };
  out.vuln ||= get("Vulnerabilities");
  out.res ||= get("Resistances");
  const im = get("Immunities");
  if (im) {
    const i = im.indexOf(";");
    const dmg = i >= 0 ? im.slice(0, i).trim() : onlyConds(im) ? "" : im.trim();
    const cond = i >= 0 ? im.slice(i + 1).trim() : onlyConds(im) ? im.trim() : "";
    out.imm ||= dmg;
    out.cimm ||= cond;
  }
  return out;
}
