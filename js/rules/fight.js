// Gevecht: ingeladen encounter (VB2) en de samenvatting bij Gevecht afronden (GV2). Puur: geen DOM, geen opslag.
// S.enc     = [{ name, notes }]: kopie van de ingeladen encounter(s), DM-geheim (niet in de snapshot voor spelers)
// S.fight   = { t0, down: [{ id, name }] }: loopt vanaf Start gevecht; wie van de spelers op 0 HP kwam
// S.endSum  = samenvatting van het laatst afgeronde gevecht (blijft tot Start gevecht of monsters wissen)
import { crXp } from "./encounters.js";
import { isOut } from "./turns.js";

const MAX_ENC = 5;
const str = (v, max) => (v == null ? "" : String(v)).slice(0, max);

/** Encounter erbij (Toevoegen) of in plaats van (Vervangen); max 5, dezelfde naam niet dubbel */
export function addEnc(S, enc, replace) {
  const cur = replace ? [] : (S.enc || []).filter((e) => e.name !== enc.name);
  S.enc = [...cur, { name: str(enc.name, 80), notes: str(enc.notes, 2000) }].slice(-MAX_ENC);
}
/** Naam boven de lijst: "Brug + Versterking" */
export const encName = (S) => (S.enc || []).map((e) => e.name).join(" + ");
/** Opschonen (backup-import): alleen naam en notitie */
export const cleanEnc = (a) => (Array.isArray(a) ? a : []).filter((e) => e && typeof e === "object" && str(e.name, 80).trim())
  .slice(0, MAX_ENC).map((e) => ({ name: str(e.name, 80).trim(), notes: str(e.notes, 2000) }));

/**
 * Na elke stap (commit): wie van de spelers op 0 HP kwam tijdens het gevecht onthouden, en de ingeladen encounter
 * vergeten als er geen monster of lair meer in de lijst staat (anders blijft er een verouderde naam staan).
 */
export function tidy(S) {
  if (S.round && !S.fight) S.fight = { t0: 0, down: [] }; // gevecht van vóór 1.31.0 of uit een import: zonder duur
  if (S.round && S.fight) for (const c of S.list) {
    if (c.kind === "pc" && c.max && c.hp <= 0 && !S.fight.down.some((x) => x.id === c.id)) S.fight.down.push({ id: c.id, name: c.name });
  }
  if (S.enc && !S.list.some((c) => c.kind === "monster" || c.kind === "lair")) delete S.enc;
}

/** Bij Start gevecht: nieuw gevecht, oude samenvatting weg */
export function startFight(S, now) {
  S.fight = { t0: now, down: [] };
  delete S.endSum;
}

/**
 * Samenvatting bij het afronden (vóór stopCombat: S.round is nog de laatste ronde). find(ref) = statblock.
 * Monsters: alle, behalve levende verborgen monsters (die heeft de groep niet gezien). xp = null zonder CR/xp.
 * flip = id's die de DM omzette: monster op 0 HP niet meetellen / levend monster (gevlucht) wel; speler wel of niet delen.
 */
export function endSummary(S, find, now) {
  const f = S.fight;
  const mons = S.list.filter((c) => c.kind === "monster" && (isOut(c) || !c.hidden)).map((c) => {
    const s = c.ref && find(c.ref), x = s ? crXp(s.cr) ?? (Number.isFinite(s.xp) && s.xp > 0 ? s.xp : null) : null;
    return { id: c.id, name: c.ref || c.name, xp: x, out: isOut(c) };
  });
  const pcs = S.list.filter((c) => c.kind === "pc").map((c) => ({ id: c.id, name: c.name, dead: !!(c.ds && c.ds.dead), up: !!c.max && c.hp > 0 }));
  const min = f && f.t0 ? Math.round((now - f.t0) / 60000) : 0;
  return { r: S.round || 0, min: min >= 1 && min < 24 * 60 ? min : 0, enc: encName(S), mons, pcs, down: f ? f.down.map((x) => ({ ...x })) : [], flip: [] };
}

/** Wat telt: { mons, xp, noXp, by: [[naam, n]], share: [pcs], per, down: [{ name, up }], dead: [namen] } */
export function endCalc(es) {
  const fl = new Set(es.flip || []);
  const mons = es.mons.filter((m) => m.out !== fl.has(m.id));
  const share = es.pcs.filter((p) => !p.dead !== fl.has(p.id));
  const xp = mons.reduce((a, m) => a + (m.xp || 0), 0);
  const noXp = [...new Set(mons.filter((m) => m.xp == null).map((m) => m.name))];
  const by = [];
  for (const m of mons) { const g = by.find((x) => x[0] === m.name); if (g) g[1]++; else by.push([m.name, 1]); }
  const now = new Map(es.pcs.map((p) => [p.id, p]));
  const dead = es.pcs.filter((p) => p.dead).map((p) => p.name);
  const down = es.down.filter((x) => !(now.get(x.id) || {}).dead).map((x) => ({ name: (now.get(x.id) || x).name, up: !!(now.get(x.id) || {}).up }));
  return { mons, xp, noXp, by, share, per: share.length ? Math.floor(xp / share.length) : null, down, dead };
}

const fmt = (n) => Math.round(n).toLocaleString("nl-NL");
export const byText = (by) => by.map(([n, k]) => (k > 1 ? `${k}× ${n}` : n)).join(", ");

/** Eén regel voor logboek en klembord */
export function endText(es) {
  const k = endCalc(es);
  const parts = [`${es.enc ? `${es.enc}: ` : "Gevecht afgerond: "}${es.r} ${es.r === 1 ? "ronde" : "rondes"}${es.min ? ` (± ${es.min} min)` : ""}`];
  parts.push(k.by.length ? `Verslagen: ${byText(k.by)}` : "Niets verslagen");
  parts.push(`${fmt(k.xp)} XP${k.share.length ? `, ${fmt(k.per)} per speler (${k.share.map((p) => p.name).join(", ")})` : ", niemand deelt"}`);
  if (k.noXp.length) parts.push(`Zonder CR niet geteld: ${k.noXp.join(", ")}`);
  if (k.down.length) parts.push(`Neer geweest: ${k.down.map((x) => `${x.name}${x.up ? " (stond weer op)" : ""}`).join(", ")}`);
  if (k.dead.length) parts.push(`Gestorven: ${k.dead.join(", ")}`);
  return parts.join(". ") + ".";
}

/** Schakelt meetellen (monster) of delen (speler) om */
export function toggleFlip(es, id) {
  const fl = es.flip || (es.flip = []), i = fl.indexOf(id);
  if (i < 0) fl.push(id); else fl.splice(i, 1);
}
