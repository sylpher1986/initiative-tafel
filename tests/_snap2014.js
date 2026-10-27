// WP48: vingerafdruk van alle parseruitkomsten voor de 322 SRD 5.1-monsters (byte-gelijk na de 2024-uitbreiding)
import "./_nl.js"; // de hash bevat herinneringsteksten (riderNote) en hangt dus aan de NL-catalogus
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { monsterActions } from "../js/rules/attacks.js";
import { legInfo, rcInfo, castInfo } from "../js/rules/spells.js";
import { laOptions } from "../js/rules/legendary.js";
import { parseRider, parryOf, hasUF } from "../js/rules/monrules.js";
import { defMode } from "../js/rules/aoe.js";
import { condImmune } from "../js/rules/spellcast.js";
import { DTYPES } from "../js/rules/aoe.js";

export const SRD14 = JSON.parse(readFileSync(new URL("../data/monsters.json", import.meta.url)));
export function snap2014(list = SRD14) {
  const out = list.map((m0) => {
    const m = structuredClone(m0); // geen cache tussen runs
    const riders = [];
    for (const s of ["a", "ba", "re", "l"]) for (const [, v] of m[s] || []) riders.push(parseRider(v));
    return { n: m.n, A: monsterActions(m), L: legInfo(m), R: rcInfo(m), C: castInfo(m), O: laOptions(m), riders, p: parryOf(m), uf: hasUF(m),
      def: DTYPES.map((t) => defMode(m.x, t)), ci: condImmune(m) };
  });
  return createHash("sha256").update(JSON.stringify(out)).digest("hex");
}
