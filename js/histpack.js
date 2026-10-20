// Undo-stappen zonder character sheets (TS2, puur): grote velden die zelden veranderen (sheet, portret) staan niet
// in elke stap maar één keer, op inhoud. De stap verwijst ernaar met { $b: sleutel }. Elk ingevuld veld wordt
// verwezen (ook klein), zodat een object { $b } in een stap altijd een verwijzing is en nooit echte data.

/** Velden van een deelnemer die apart gaan */
export const BIG = ["sheet", "img"];

// cyrb53: snelle 53-bit hash, geen crypto nodig (botsingen vangt keyFor op)
function hash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Sleutel voor inhoud s; known(k) = bekende inhoud onder die sleutel (of undefined). Botsing: ".1", ".2", … */
export function keyFor(s, known) {
  const base = hash(s) + "-" + s.length.toString(36);
  let k = base, i = 0, have;
  while ((have = known(k)) !== undefined && have !== s) k = base + "." + ++i;
  return k;
}

/**
 * Stand als JSON zonder grote velden. known(k): inhoud die al onder een sleutel bekend is.
 * Geeft { j, refs } met refs: Map sleutel → inhoud (JSON) van wat deze stand gebruikt.
 */
export function pack(S, known) {
  const refs = new Map();
  const look = (k) => (refs.has(k) ? refs.get(k) : known(k));
  if (!S || !Array.isArray(S.list)) return { j: JSON.stringify(S), refs };
  let changed = false;
  const list = S.list.map((c) => {
    if (!c || typeof c !== "object") return c;
    let o = null;
    for (const f of BIG) {
      if (c[f] == null) continue;
      const s = JSON.stringify(c[f]);
      if (s === undefined) continue;
      const k = keyFor(s, look);
      refs.set(k, s);
      (o || (o = { ...c }))[f] = { $b: k };
    }
    if (o) changed = true;
    return o || c;
  });
  return { j: JSON.stringify(changed ? { ...S, list } : S), refs };
}

/** Terug naar een volledige stand; get(k) = inhoud (JSON). null als een verwijzing ontbreekt. */
export function unpack(j, get) {
  const S = JSON.parse(j);
  if (!S || !Array.isArray(S.list)) return S;
  for (const c of S.list) {
    if (!c || typeof c !== "object") continue;
    for (const f of BIG) {
      const v = c[f];
      if (!v || typeof v !== "object" || typeof v.$b !== "string") continue;
      const s = get(v.$b);
      if (typeof s !== "string") return null;
      c[f] = JSON.parse(s);
    }
  }
  return S;
}
