// Open saves (5e 2014): herhaal-saves tegen condities aan het einde van de beurt en concentration saves na schade.
// Staan in de encounter (S.saves), zodat undo ook de vraag terugdraait. Puur: geen DOM.
// Een open save vervalt na twee beurtwissels (de DM tikte te snel op Volgende: hij blijft nog één beurt staan).
import { fx, merge, dropConc } from "./combat.js";
import { uid } from "./dice.js";
import { isOut } from "./turns.js";

export const TTL = 2;

/** s: { id, kind: "cond"|"conc", n, ab, dc }. Herhaal-save tegen dezelfde conditie vervangt de oude; elke schade is een eigen concentration save. */
export function addSave(S, s) {
  S.saves = (S.saves || []).filter((x) => !(s.kind === "cond" && x.kind === "cond" && x.id === s.id && x.n === s.n));
  S.saves.push({ sid: uid(), ttl: TTL, id: s.id, kind: s.kind, n: s.n || "", ab: s.ab, dc: s.dc });
}

/** Begin van de beurt van id: herhaal-saves voor het einde van deze beurt klaarzetten */
export function turnSaves(S, id) {
  const c = S.list.find((x) => x.id === id);
  if (!c || !c.cd || isOut(c)) return;
  for (const [n, e] of Object.entries(c.cd)) if (e && e.save && c.cond.includes(n)) addSave(S, { id, kind: "cond", n, ab: e.save.ab, dc: e.save.dc });
}

/** Beurtwissel vooruit: open saves verouderen; verlopen = niet afgehandeld (de deelnemer verandert niet) */
export function tickSaves(S) {
  const out = fx();
  if (!S.saves || !S.saves.length) return out;
  S.saves = S.saves.filter((s) => {
    s.ttl--;
    if (s.ttl > 0) return true;
    if (isValid(S, s)) out.why.push({ t: `${label(s)} niet afgehandeld`, id: s.id });
    return false;
  });
  return out;
}

/** Hoort de vraag nog? (deelnemer bestaat, doet mee, conditie of dezelfde concentratie is er nog) */
export function isValid(S, s) {
  const c = S.list.find((x) => x.id === s.id);
  if (!c || isOut(c)) return false;
  return s.kind === "conc" ? c.cond.includes("Concentrating") && (c.concSpell || "") === s.n : c.cond.includes(s.n);
}

/** Open saves die er nog toe doen, in volgorde van ontstaan */
export const openSaves = (S) => (S.saves || []).filter((s) => isValid(S, s));

export const label = (s) => `${s.ab}-save DC ${s.dc} ${s.kind === "conc" ? "(concentratie)" : `tegen ${s.n}`}`;

/**
 * Uitslag verwerken. ok = geslaagd; note = bijv. de gerolde worp. Conditie-save geslaagd → conditie weg;
 * concentration save gefaald → concentratie weg (effecten volgen via commit). Geeft Fx terug.
 */
export function resolveSave(S, sid, ok, note = "") {
  const out = fx();
  const s = (S.saves || []).find((x) => x.sid === sid);
  if (!s) return out;
  S.saves = S.saves.filter((x) => x !== s);
  const c = S.list.find((x) => x.id === s.id);
  if (!c || !isValid(S, s)) return out;
  out.why.push({ t: `${label(s)}: ${note ? note + ", " : ""}${ok ? "geslaagd" : "gefaald"}`, id: c.id });
  if (s.kind === "cond" && ok) {
    c.cond = c.cond.filter((x) => x !== s.n);
    if (c.cd) delete c.cd[s.n];
    if (s.n === "Concentrating") c.concSpell = null;
    out.msgs.push(`${c.name}: ${s.n} is voorbij.`);
  }
  if (s.kind === "conc" && !ok) merge(out, dropConc(c, "concentration save gefaald"));
  return out;
}
