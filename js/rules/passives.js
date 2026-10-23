// SP5: passive Perception, Insight en Investigation van een speler (PHB 2014: 10 + skill-bonus). Puur, geen DOM.
// Bron per waarde: eigen invoer (c.pas, ⋯) gaat voor, anders de sheet (link: sheet.passive; PDF/oude link-sheet: afgeleid
// uit "passive Perception N" in senses en de skills).

export const PAS = [["per", "Perception", "Perc"], ["ins", "Insight", "Ins"], ["inv", "Investigation", "Inv"]];

/** 1–40 als heel getal, anders null (leeg, onzin) */
export const pasVal = (v) => {
  if (v === "" || v == null) return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 40 ? n : null;
};

/** Opschonen (import, ⋯): alleen geldige waarden; niets over → undefined (veld weg) */
export function cleanPas(o) {
  if (!o || typeof o !== "object") return undefined;
  const out = {};
  for (const [k] of PAS) { const v = pasVal(o[k]); if (v != null) out[k] = v; }
  return Object.keys(out).length ? out : undefined;
}

const skillOf = (h, name) => {
  const p = Array.isArray(h.skills) && h.skills.find((s) => Array.isArray(s) && String(s[0]).toLowerCase() === name.toLowerCase());
  const v = p ? parseInt(String(p[1]).replace("−", "-"), 10) : NaN;
  return Number.isFinite(v) ? v : null;
};

/** Passives uit een sheet: { per, ins, inv } met null waar niets bekend is */
export function sheetPassives(h) {
  const out = { per: null, ins: null, inv: null };
  if (!h || typeof h !== "object") return out;
  const p = h.passive && typeof h.passive === "object" ? h.passive : {};
  const sen = String(h.senses || "").match(/passive Perception\s*(\d+)/i);
  for (const [k, name] of PAS) {
    let v = pasVal(p[k]);
    if (v == null && k === "per" && sen) v = pasVal(sen[1]);
    if (v == null) { const s = skillOf(h, name); if (s != null) v = pasVal(10 + s); }
    out[k] = v;
  }
  return out;
}

/** Wat geldt voor een speler of partylid: eigen waarde, anders de sheet */
export function passives(c) {
  const s = sheetPassives(c && c.sheet), own = (c && c.pas) || {};
  const out = {};
  for (const [k] of PAS) out[k] = pasVal(own[k]) ?? s[k];
  return out;
}

/** "Perc 14 · Ins 12 · Inv –"; niets bekend → "" */
export function pasText(p) {
  if (!p || PAS.every(([k]) => p[k] == null)) return "";
  return PAS.map(([k, , s]) => `${s} ${p[k] ?? "–"}`).join(" · ");
}

/** Initiative-paneel (hinderlaag): spelers met passive Perception, hoogste eerst; wie geen waarde heeft achteraan met "–" */
export function percList(list) {
  const pcs = (list || []).filter((c) => c && c.kind === "pc" && !(c.ds && c.ds.dead)).map((c) => ({ name: c.name, v: passives(c).per }));
  if (!pcs.some((x) => x.v != null)) return [];
  return pcs.sort((a, b) => (b.v ?? -1) - (a.v ?? -1) || a.name.localeCompare(b.name));
}
