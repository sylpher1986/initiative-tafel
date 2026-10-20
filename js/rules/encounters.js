// Encounters vooraf klaarzetten en XP-moeilijkheid (DMG 2014). Puur: geen DOM, geen opslag.
// Encounter: { id, updatedAt, name, notes, monsters: [{ ref, n, hidden?, anon?, grp? }], lair?: { key, hidden? } }
// id + updatedAt maken de collectie sync-klaar (fase 2). Hp-modus en initiative worden bewust niet bewaard.

export const ENC_FORMAT = "initiative-tafel-encounter";
export const ENC_VERSION = 1;
export const MAX_N = 50, MAX_ROWS = 40, MAX_TOTAL = 100, MAX_ENCS = 500;

/* ---------- XP (DMG 2014) ---------- */
const XP = { 0: 10, 0.125: 25, 0.25: 50, 0.5: 100, 1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
  11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000, 16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000, 21: 33000, 22: 41000,
  23: 50000, 24: 62000, 25: 75000, 26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000 };
/** Drempels per karakterlevel: [easy, medium, hard, deadly] (DMG p. 82) */
export const THRESH = [null, [25, 50, 75, 100], [50, 100, 150, 200], [75, 150, 225, 400], [125, 250, 375, 500], [250, 500, 750, 1100],
  [300, 600, 900, 1400], [350, 750, 1100, 1700], [450, 900, 1400, 2100], [550, 1100, 1600, 2400], [600, 1200, 1900, 2800],
  [800, 1600, 2400, 3600], [1000, 2000, 3000, 4500], [1100, 2200, 3400, 5100], [1250, 2500, 3800, 5700], [1400, 2800, 4300, 6400],
  [1600, 3200, 4800, 7200], [2000, 3900, 5900, 8800], [2100, 4200, 6300, 9500], [2400, 4900, 7300, 10900], [2800, 5700, 8500, 12700]];
export const RATINGS = ["Easy", "Medium", "Hard", "Deadly"];
const STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];

const CRV = { "1/8": 0.125, "1/4": 0.25, "1/2": 0.5 };
/** CR ("1/4", "5", 0.5) → XP; onbekend → null */
export function crXp(cr) {
  const s = String(cr ?? "").trim();
  const v = s in CRV ? CRV[s] : /^\d+(\.\d+)?$/.test(s) ? +s : NaN;
  return XP[v] ?? null;
}

/** Multiplier op aantal monsters, met correctie voor partygrootte (< 3 een stap hoger, ≥ 6 een stap lager) */
export function multiplier(nMon, nPcs) {
  if (nMon < 1) return 1;
  let i = nMon === 1 ? 1 : nMon === 2 ? 2 : nMon <= 6 ? 3 : nMon <= 10 ? 4 : nMon <= 14 ? 5 : 6;
  if (nPcs > 0 && nPcs < 3) i++;
  else if (nPcs >= 6) i--;
  return STEPS[i];
}

/** "Fighter 5 / Wizard 2" → 7; "Wizard 5 (Evoker)" → 5; niets bruikbaars → null. Max 20. */
export function clsLevel(cls) {
  const ns = String(cls || "").match(/\b\d{1,2}\b/g);
  if (!ns) return null;
  const sum = ns.map(Number).filter((n) => n >= 1 && n <= 20).reduce((a, b) => a + b, 0);
  return sum ? Math.min(20, sum) : null;
}
/** Geldig level 1–20 of null */
export const cleanLvl = (v) => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 20 ? n : null; };
/** Level van een speler of partylid: uit de klasse-string van de sheet (volgt een level-up), anders het eigen veld */
export const pcLevel = (p) => clsLevel(p && p.sheet && p.sheet.cls) ?? cleanLvl(p && p.lvl);

/**
 * Wie telt als party: levende spelers in de lijst; zonder spelers in de lijst de vaste party.
 * Geeft { who: [{ name, lvl, cid?, pid? }], src: "list"|"party" }: cid = deelnemer in de lijst, pid = partylid
 * (waar een ontbrekend level opgeslagen wordt).
 */
export function partyFor(list, party) {
  const pcs = (list || []).filter((c) => c.kind === "pc" && !(c.ds && c.ds.dead));
  if (pcs.length) {
    const byPid = new Map((party || []).map((m) => [m.pid, m]));
    // partylid: de party is de bron (levelveld in het Party-paneel), anders de speler zelf
    return { src: "list", who: pcs.map((c) => { const m = c.pid && byPid.get(c.pid); return { name: c.name, lvl: pcLevel(m) ?? pcLevel(c), cid: c.id, ...(m ? { pid: m.pid } : {}) }; }) };
  }
  return { src: "party", who: (party || []).map((m) => ({ name: m.name || "?", lvl: pcLevel(m), pid: m.pid })) };
}

/**
 * Moeilijkheid. mons = [{ cr, n, name }], who = [{ name, lvl }].
 * → { n, xp, mult, adj, th: [e,m,h,d] | null, rating: -1..3 | null, noLvl: [namen], noXp: [namen], pcs }
 * rating -1 = Trivial (onder Easy); null = niet te bepalen (geen party of level onbekend).
 */
export function difficulty(mons, who) {
  let n = 0, xp = 0;
  const noXp = [];
  for (const m of mons || []) {
    const k = Math.max(0, Math.trunc(m.n || 0));
    if (!k) continue;
    n += k;
    const x = crXp(m.cr) ?? (Number.isFinite(m.xp) && m.xp > 0 ? m.xp : null);
    if (x == null) { if (!noXp.includes(m.name)) noXp.push(m.name); } else xp += x * k;
  }
  const pcs = (who || []).length;
  const mult = multiplier(n, pcs), adj = Math.round(xp * mult);
  const noLvl = (who || []).filter((p) => !cleanLvl(p.lvl)).map((p) => p.name);
  let th = null, rating = null;
  if (pcs && !noLvl.length && !(n && !xp && noXp.length)) { // alleen monsters zonder CR: geen oordeel ("Trivial" zou misleiden)
    th = [0, 0, 0, 0];
    for (const p of who) THRESH[p.lvl].forEach((v, i) => (th[i] += v));
    rating = -1;
    th.forEach((v, i) => { if (adj >= v) rating = i; });
  }
  return { n, xp, mult, adj, th, rating, noLvl, noXp, pcs };
}
export const ratingName = (r) => (r == null ? null : r < 0 ? "Trivial" : RATINGS[r]);
/** Waarom er geen oordeel is: "level onbekend", "geen party", "CR onbekend"; null = er is een oordeel */
export const noRating = (r) => (r.rating != null ? null : !r.pcs ? "geen party" : r.noLvl.length ? "level onbekend" : "CR onbekend");

/** Monsters van een encounter als invoer voor difficulty (CR via de bibliotheek) */
export const encMons = (enc, find) => (enc.monsters || []).map((m) => { const s = find(m.ref); return { name: m.ref, n: m.n, cr: s ? s.cr : null, xp: s ? s.xp : null }; });
/** Monsters in de huidige lijst als invoer voor difficulty (lair telt niet mee) */
export const listMons = (list, find) => (list || []).filter((c) => c.kind === "monster").map((c) => { const s = c.ref && find(c.ref); return { name: c.ref || c.name, n: 1, cr: s ? s.cr : null, xp: s ? s.xp : null }; });

/* ---------- maken, opschonen ---------- */
const str = (v, max) => (v == null ? "" : String(v)).slice(0, max);
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
export const total = (enc) => (enc.monsters || []).reduce((a, m) => a + m.n, 0);

/**
 * Encounter uit de huidige lijst: monsters (op volgorde van toevoegen) samengevoegd per ref + verborgen + onbekend + groep;
 * lair met sleutel. Spelers gaan niet mee. Monsters zonder ref (zou niet moeten) worden overgeslagen.
 */
export function fromList(list, { id, name, notes = "", now }) {
  const monsters = [];
  let lair = null;
  for (const c of list || []) {
    if (c.kind === "lair") { if (!lair) lair = { key: str(c.key || c.name, 120), ...(c.hidden ? { hidden: true } : {}) }; continue; }
    if (c.kind !== "monster" || !c.ref) continue;
    const k = { ref: c.ref, hidden: !!c.hidden, anon: !!c.anon, g: c.grp || "" };
    const last = monsters.at(-1);
    if (last && last.n < MAX_N && last.ref === k.ref && !!last.hidden === k.hidden && !!last.anon === k.anon && (last._g || "") === k.g) { last.n++; continue; }
    monsters.push({ ref: c.ref, n: 1, ...(k.hidden ? { hidden: true } : {}), ...(k.anon ? { anon: true } : {}), ...(k.g ? { grp: true, _g: k.g } : {}) });
  }
  monsters.forEach((m) => { delete m._g; if (m.grp && m.n < 2) delete m.grp; });
  return cleanEncounter({ id, updatedAt: now, name, notes, monsters, ...(lair ? { lair } : {}) }, now);
}

/**
 * Opschonen (bestand of opslag is onbetrouwbaar). Geeft null als het geen bruikbare encounter is.
 * Grenzen: max 40 regels, per regel 1–50, totaal max 100 monsters.
 */
export function cleanEncounter(o, now = Date.now()) {
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const name = str(o.name, 80).trim();
  if (!name) return null;
  let left = MAX_TOTAL;
  const monsters = [];
  for (const m of Array.isArray(o.monsters) ? o.monsters : []) {
    if (monsters.length >= MAX_ROWS || left < 1) break;
    if (!m || typeof m !== "object") continue;
    const ref = str(m.ref, 120).trim();
    const n = Math.min(MAX_N, left, Math.max(0, Math.trunc(Number(m.n) || 0)));
    if (!ref || n < 1) continue;
    left -= n;
    monsters.push({ ref, n, ...(m.hidden === true ? { hidden: true } : {}), ...(m.anon === true ? { anon: true } : {}), ...(m.grp === true && n > 1 ? { grp: true } : {}) });
  }
  const lk = o.lair && typeof o.lair === "object" ? str(o.lair.key, 120).trim() : "";
  const lair = lk ? { key: lk, ...(o.lair.hidden === true ? { hidden: true } : {}) } : null;
  if (!monsters.length && !lair) return null;
  const t = Number(o.updatedAt);
  return {
    id: typeof o.id === "string" && ID_RE.test(o.id) ? o.id : newId(),
    updatedAt: Number.isFinite(t) && t > 0 && t <= now + 864e5 ? Math.trunc(t) : now,
    name, notes: str(o.notes, 2000), monsters, ...(lair ? { lair } : {}),
  };
}
export const newId = () => "e" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
/** Lijst uit opslag of backup: opschonen, dubbele id's eruit (de nieuwste wint), max 500 */
export function cleanEncounters(a, now = Date.now()) {
  const out = new Map();
  for (const o of Array.isArray(a) ? a : []) {
    const e = cleanEncounter(o, now);
    if (!e) continue;
    const had = out.get(e.id);
    if (!had || had.updatedAt < e.updatedAt) out.set(e.id, e);
  }
  return [...out.values()].slice(0, MAX_ENCS);
}
/** Nieuwste eerst */
export const sorted = (list) => [...list].sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));

/** Kopie met nieuwe id en naam "X (kopie)", "X (kopie 2)" … */
export function duplicate(enc, list, now) {
  const base = enc.name.replace(/ \(kopie(?: \d+)?\)$/, "");
  const names = new Set(list.map((e) => e.name));
  let name = `${base} (kopie)`, i = 2;
  while (names.has(name)) name = `${base} (kopie ${i++})`;
  return { ...structuredClone(enc), id: newId(), name: name.slice(0, 80), updatedAt: now };
}

/* ---------- inladen ---------- */
/**
 * Plan om in te laden: toevoegacties voor wat er op dit apparaat bestaat, plus de namen die ontbreken.
 * has(ref) = statblock bestaat. → { adds: [{ ref, n, hidden, anon, init: "group"|"each" }], missing: [ref], lair }
 */
export function loadPlan(enc, has) {
  const adds = [], missing = [];
  for (const m of enc.monsters) {
    if (!has(m.ref)) { if (!missing.includes(m.ref)) missing.push(m.ref); continue; }
    adds.push({ ref: m.ref, n: m.n, hidden: !!m.hidden, anon: !!m.anon, init: m.grp ? "group" : "each" });
  }
  return { adds, missing, lair: enc.lair || null };
}

/* ---------- bestand per encounter ---------- */
/** Exportbestand: encounter plus eigen/geïmporteerde statblocks en lair actions die erbij horen */
export function buildEncFile(enc, { own = [], lairs = {} } = {}) {
  const refs = new Set(enc.monsters.map((m) => m.ref));
  const key = enc.lair && enc.lair.key;
  return { format: ENC_FORMAT, version: ENC_VERSION, exported: new Date().toISOString(), encounter: enc,
    monsters: own.filter((m) => refs.has(m.n)), lairs: key && Array.isArray(lairs[key]) && lairs[key].length ? { [key]: lairs[key] } : {} };
}

/**
 * Bestand → { enc, monsters (ruw, nog door sanitizeOwn), lairs } of een Error met een leesbare melding.
 * Accepteert ook een losse encounter (zonder omhulsel) niet: alleen het eigen formaat.
 */
export function parseEncFile(json, now = Date.now()) {
  if (!json || typeof json !== "object" || json.format !== ENC_FORMAT) throw new Error("Geen encounter-bestand van Initiative Tafel.");
  if (Number(json.version) > ENC_VERSION) throw new Error("Dit encounter-bestand komt uit een nieuwere versie van de app. Werk de app eerst bij.");
  const enc = cleanEncounter(json.encounter, now);
  if (!enc) throw new Error("Dit encounter-bestand is leeg of beschadigd.");
  const refs = new Set(enc.monsters.map((m) => m.ref));
  const seen = new Set(); // elk statblock één keer (eerste wint)
  const monsters = (Array.isArray(json.monsters) ? json.monsters : []).filter((m) => m && typeof m === "object" && refs.has(String(m.n)) && !seen.has(String(m.n)) && seen.add(String(m.n))).slice(0, MAX_ROWS);
  const lairs = {};
  const L = json.lairs && typeof json.lairs === "object" ? json.lairs : {};
  if (enc.lair && Array.isArray(L[enc.lair.key])) lairs[enc.lair.key] = L[enc.lair.key].slice(0, 30).filter((a) => a && typeof a === "object").map((a) => ({ n: str(a.n, 120), t: str(a.t, 4000) }));
  return { enc, monsters, lairs };
}

/**
 * Import in de lijst: mode "new" (id onbekend), "replace" (zelfde id, overschrijven) of "copy" (nieuwe id).
 * Geeft de nieuwe lijst; de oude blijft ongewijzigd.
 */
export function mergeEnc(list, enc, mode, now) {
  if (mode === "copy") {
    const d = duplicate(enc, list, now);
    if (!list.some((e) => e.name === enc.name)) d.name = enc.name; // naam is vrij: geen "(kopie)" nodig
    return [...list, d];
  }
  if (mode === "replace") return list.map((e) => (e.id === enc.id ? { ...enc, updatedAt: now } : e));
  return [...list, enc];
}
