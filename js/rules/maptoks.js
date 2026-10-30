// WP75 (G4 fase 4): tokens gekoppeld aan deelnemers. Puur (geen DOM, geen import uit js/maps/: de grens blijft, zie
// tests/maps-boundary.test.js). Een gekoppeld token is een gewoon token in de kaart (Inn Sight, js/maps/model/tokens.js)
// met p = "p:<party-id>" (speler: blijft over gevechten heen gekoppeld) of "c:<id>" (deelnemer in dit gevecht). Wat er
// verder bij hoort (beurt, neer/dood, verborgen, naam onbekend) komt uit Initiative en wordt alleen bij het tekenen over
// het token gelegd (decoratie), nooit opgeslagen in de kaart:
// - DM: decoDm(S, list): beurt-ring, kruis; verborgen deelnemer, monster vóór Start of deelnemer niet (meer) in de lijst
//   = "verborgen voor spelers" (50 %, gestippeld), zodat de DM ziet wat spelers niet zien.
// - Spelers: decoPv(V, list) uit de snapshot van het spelersscherm (toPlayerView): alleen deelnemers die daar staan,
//   dus dezelfde regels (verborgen bestaat niet, monsters pas na Start, verborgen beurt = de laatste zichtbare blijft);
//   naam onbekend = label "?" of "?N" (nooit de echte afkorting). Fog ligt er in het platte beeld nog overheen.
import { isOut, groupOf, sortOrder } from "./turns.js";

const LINK_RE = /^[pc]:[A-Za-z0-9_-]{1,40}$/; // = LINK_RE in js/maps/model/tokens.js (test)

/** Koppelsleutel van een deelnemer: speler met party-id → "p:<pid>", anders "c:<id>"; null = geen token mogelijk (lair, rare id) */
export function linkOf(c) {
  if (!c || c.kind === "lair") return null;
  const k = c.kind === "pc" && c.pid ? `p:${c.pid}` : `c:${c.id}`;
  return LINK_RE.test(k) ? k : null;
}

/** Alle sleutels waaronder een token bij deze deelnemer hoort: linkOf, en voor een speler met party-id ook "c:<id>"
 *  (review: een token geplaatst vóór "Naar party" blijft zo gekoppeld). */
export function keysOf(c) {
  const k = linkOf(c);
  if (!k) return [];
  const alt = `c:${c.id}`;
  return k !== alt && LINK_RE.test(alt) ? [k, alt] : [k];
}

/** Sleutel → deelnemer voor een hele lijst (één keer per aanroep, niet per token) */
export function linkIndex(list) {
  const by = new Map();
  for (const c of list || []) for (const k of keysOf(c)) if (!by.has(k)) by.set(k, c);
  return by;
}

/** Deelnemer bij koppeling p in S.list (of null) */
export const whoOf = (S, p) => (p ? linkIndex(S && S.list).get(p) || null : null);

/** D&D-grootte in cellen uit de statblock-tekst ("Large giant, …"); onbekend = Medium (1) */
const SIZES = { tiny: 0.5, small: 1, medium: 1, large: 2, huge: 3, gargantuan: 4 };
export function sizeOf(meta) {
  const w = /^\s*([A-Za-z]+)/.exec(String(meta || ""));
  return (w && SIZES[w[1].toLowerCase()]) || 1;
}

/** Kleur per kant (UX WP75; ids uit TOK_COLORS van Inn Sight, test) */
export const SIDE_COLOR = { pc: "blue", monster: "red" };

// Letters van een naam (geen cijfers, leestekens of spaties); hoofdletter vooraan
const letters = (s) => [...String(s || "").normalize("NFC")].filter((ch) => /\p{L}/u.test(ch));
const up = (a) => (a.length ? a[0].toLocaleUpperCase() + a.slice(1).join("") : "");
const trailNo = (name) => { const m = /(\d+)\s*$/.exec(String(name || "")); return m ? Number(m[1]) : 0; };
/** Soort van een monster (Goblin 1 en Goblin 2 = één soort): statblock, anders de naam zonder nummer */
const kindOf = (c) => (c.ref ? `r:${c.ref}` : `n:${String(c.name || "").replace(/\s*\d+\s*$/, "").toLocaleLowerCase()}`);
const free = (cands, used) => cands.find((x) => x && [...x].length <= 3 && !used.has(x)) || null;

/**
 * Korte labels (max 3 tekens, gebruikersinhoud: nooit vertaald), UX WP75. Speler: twee letters ("Thorin" → "Th"), dubbel
 * → drie ("Tho"), nog dubbel → letter + cijfer ("T1"). Monster: beginletter + nummer ("Goblin 2" → "G2"; zonder nummer
 * telt de soort zelf door); delen twee soorten een beginletter, dan twee letters + nummer ("Go1", "Gh1"), past dat niet
 * in drie tekens, dan letter + nummer. used = labels die al op de kaart staan (nooit dubbel). → array, zelfde volgorde.
 */
export function tokLabels(cs, used = new Set()) {
  used = new Set(used);
  const mons = cs.filter((c) => c.kind !== "pc");
  const byFirst = new Map(); // beginletter → soorten
  for (const c of mons) { const f = up(letters(c.name).slice(0, 1)); if (!byFirst.has(f)) byFirst.set(f, new Set()); byFirst.get(f).add(kindOf(c)); }
  const seq = new Map(); // soort → laatste nummer (zonder nummer in de naam)
  return cs.map((c) => {
    const L = letters(c.name), one = up(L.slice(0, 1)) || "?", two = up(L.slice(0, 2)) || "?";
    let l;
    if (c.kind === "pc") l = free([two, up(L.slice(0, 3))], used);
    else {
      const k = kindOf(c);
      let n = trailNo(c.name);
      if (!n) { n = (seq.get(k) || 0) + 1; seq.set(k, n); }
      const shared = (byFirst.get(one) || new Set()).size > 1;
      l = free(shared ? [two + n, one + n] : [one + n, two + n], used);
    }
    for (let i = 1; !l && i <= 99; i++) l = free([one + i, two.slice(0, 1) + i], used);
    l = l || "?";
    used.add(l);
    return l;
  });
}

/** Zonder token: deelnemers in all (geen lair) waarvan geen enkele sleutel op de kaart staat → [{ c, p }] */
function without(all, list) {
  const have = new Set((list || []).map((t) => t.p).filter(Boolean));
  const out = [];
  for (const c of all || []) { const ks = keysOf(c); if (ks.length && !ks.some((k) => have.has(k))) { ks.forEach((k) => have.add(k)); out.push({ c, p: ks[0] }); } }
  return out;
}

/** Hoeveel deelnemers nog geen token hebben (pil "Plaatsen (n)"; goedkoop: zonder labels of statblocks, review) */
export const missingCount = (all, list) => without(all, list).length;

/**
 * Wie krijgt een token bij "Deelnemers plaatsen" (UX WP75): iedereen in de lijst (geen lair) zonder gekoppeld token;
 * spelers eerst, daarna monsters, binnen elke kant in de volgorde van all (= sortOrder(S.list): initiative, vóór Start de
 * lijst). meta(c) = statblock-tekst (grootte). Labels op de kaart (ook van wees-tokens) tellen als bezet: nooit dubbel.
 * → [{ p, l, c, s, pc }]
 */
export function toPlace(all, list, meta = () => "") {
  const who = without(all, list);
  const ord = [...who.filter((x) => x.c.kind === "pc"), ...who.filter((x) => x.c.kind !== "pc")];
  const ls = tokLabels(ord.map((x) => x.c), new Set((list || []).map((t) => t.l)));
  return ord.map((x, i) => ({ p: x.p, l: ls[i], c: SIDE_COLOR[x.c.kind === "pc" ? "pc" : "monster"], s: x.c.kind === "pc" ? 1 : sizeOf(meta(x.c)), pc: x.c.kind === "pc" }));
}

/** Gekoppeld token zonder deelnemer in de lijst (vorig gevecht, verwijderd): de tokenbalk biedt "Weghalen" */
export const orphan = (S, t) => !!(t && t.p) && !whoOf(S, t.p);

/** Neer (UX WP75: één kruis voor 0 HP en dood): monster neer, speler dood of op 0 HP */
export const downOf = (c) => !!c && (isOut(c) || (c.kind === "pc" && !!c.max && c.hp <= 0));

/** Wie nu aan de beurt is (ring): de actieve deelnemer, bij een groepsbeurt alle levende leden. → Set van id's */
export function turnIds(S) {
  if (!S || !S.round || !S.active) return new Set();
  const g = groupOf(sortOrder(S.list || []), S.active, S.round);
  return new Set(g ? g.live.map((c) => c.id) : [S.active]);
}

/**
 * DM-beeld: gekoppelde tokens gedecoreerd (nieuwe objecten; vrije tokens ongewijzigd). turn = Set van deelnemer-id's
 * die aan de beurt zijn (turnIds). Velden alleen voor het tekenen: dn (kruis: neer), tn (beurt-ring), hide (spelers
 * zien hem niet: verborgen deelnemer, monster vóór Start, of deelnemer niet in de lijst).
 */
export function decoDm(S, list, turn = new Set()) {
  if (!list || !list.some((t) => t.p)) return list;
  const by = linkIndex(S && S.list);
  return list.map((t) => {
    if (!t.p) return t;
    const c = by.get(t.p);
    if (!c) return { ...t, hide: true };
    const n = { ...t };
    if (c.hidden || (!S.round && c.kind !== "pc")) n.hide = true; // review: vóór Start zien spelers geen monsters (hinderlaag)
    if (downOf(c)) n.dn = 1;
    if (turn.has(c.id)) n.tn = 1;
    return n;
  });
}

/**
 * Spelersbeeld uit de snapshot V (toPlayerView): alleen gekoppelde tokens van deelnemers die spelers zien; label bij
 * "naam onbekend" = "?" of "?N"; neer/dood en beurt zoals het spelersscherm ze toont. Vrije tokens ongewijzigd (die
 * filtert drawBase met fog "player" nog op hide). keys(id) = sleutels van de deelnemer met die id (keysById(S.list)).
 */
export function decoPv(V, list, keys) {
  if (!list || !list.some((t) => t.p)) return list;
  const rows = new Map();
  for (const r of (V && V.list) || []) { if (r.kind === "lair") continue; for (const k of keys(r.id)) if (!rows.has(k)) rows.set(k, r); }
  const turn = new Set(V && V.group ? V.group : V && V.active ? [V.active] : []);
  const out = [];
  for (const t of list) {
    if (!t.p) { out.push(t); continue; }
    const r = rows.get(t.p);
    if (!r || t.hide) continue; // spelers zien deze deelnemer niet (of de DM verborg het token zelf)
    const n = { ...t };
    if (r.anon != null) n.l = r.anon ? `?${r.anon}`.slice(0, 3) : "?";
    if (r.out || (r.kind === "pc" && r.hp && r.hp.max && r.hp.hp <= 0)) n.dn = 1; // spelers-HP is altijd exact (ook 0 HP en stabiel)
    if (turn.has(r.id)) n.tn = 1;
    out.push(n);
  }
  return out;
}

/** Sleutels per deelnemer-id, één keer per lijst opgebouwd (review: niet lineair zoeken per rij) → keys(id) voor decoPv */
export function keysById(list) {
  const m = new Map();
  for (const c of list || []) m.set(c.id, keysOf(c));
  return (id) => m.get(id) || [];
}

/** Korte vingerafdruk van de decoratie (een andere = opnieuw tekenen of een nieuw spelersbeeld) */
export const decoSig = (list) => (list || []).filter((t) => t.p).map((t) => `${t.id}|${t.p}|${t.l}|${t.dn || ""}|${t.tn || ""}|${t.hide ? 1 : ""}`).join(";");
