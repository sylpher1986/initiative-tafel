// Gevecht: ingeladen encounter (VB2) en de samenvatting bij Gevecht afronden (GV2). Puur: geen DOM, geen opslag.
// S.enc     = [{ name, notes, map? }]: kopie van de ingeladen encounter(s), DM-geheim (niet in de snapshot voor spelers);
//             map = verwijzing { id, name } naar een Inn Sight-kaart (WP70: kaart bekijken in Gevecht), nooit de kaart zelf
// S.fight   = { t0, down: [{ id, name }] }: loopt vanaf Start gevecht; wie van de spelers op 0 HP kwam
// S.endSum  = samenvatting van het laatst afgeronde gevecht (blijft tot Start gevecht of monsters wissen)
import { crXp, cleanMapRef } from "./encounters.js";
import { isOut, dropIds } from "./turns.js";
import { M, J } from "../i18n/msg.js";
import { t } from "../i18n/boot.js";

const MAX_ENC = 5;
const str = (v, max) => (v == null ? "" : String(v)).slice(0, max);

/** Encounter erbij (Toevoegen) of in plaats van (Vervangen); max 5, dezelfde naam niet dubbel */
export function addEnc(S, enc, replace) {
  const cur = replace ? [] : (S.enc || []).filter((e) => e.name !== enc.name);
  const map = cleanMapRef(enc.map);
  S.enc = [...cur, { name: str(enc.name, 80), notes: str(enc.notes, 2000), ...(map ? { map } : {}) }].slice(-MAX_ENC);
}
/** Naam boven de lijst: "Brug + Versterking" */
export const encName = (S) => (S.enc || []).map((e) => e.name).join(" + ");
/** Opschonen (backup-import): naam, notitie en (WP70) de kaartverwijzing; optioneel veld, backup blijft v4 */
export const cleanEnc = (a) => (Array.isArray(a) ? a : []).filter((e) => e && typeof e === "object" && str(e.name, 80).trim())
  .slice(0, MAX_ENC).map((e) => { const map = cleanMapRef(e.map); return { name: str(e.name, 80).trim(), notes: str(e.notes, 2000), ...(map ? { map } : {}) }; });
/** WP70: ingeladen encounters met een kaart → [{ name, map }] (volgorde van inladen; dezelfde kaart één keer) */
export const encMaps = (S) => { const seen = new Set(); return (S.enc || []).filter((e) => e.map && !seen.has(e.map.id) && seen.add(e.map.id)).map((e) => ({ name: e.name, map: e.map })); };

/**
 * Na elke stap (commit): wie van de spelers op 0 HP kwam tijdens het gevecht onthouden, en de ingeladen encounter
 * vergeten als er geen monster of lair meer in de lijst staat (anders blijft er een verouderde naam staan).
 */
export function tidy(S) {
  if (S.round && !S.fight) S.fight = { t0: 0, down: [] }; // gevecht van vóór 1.31.0 of uit een import: zonder duur
  if (S.round && S.fight) for (const c of S.list) {
    if (c.kind !== "pc" || !c.max) continue;
    const pre = S.fight.pre || [], i = pre.indexOf(c.id);
    if (i >= 0) { if (c.hp > 0) pre.splice(i, 1); continue; } // begon al op 0 HP: telt pas als hij opstaat en opnieuw neergaat
    if (c.hp <= 0 && !S.fight.down.some((x) => x.id === c.id)) S.fight.down.push({ id: c.id, name: c.name });
  }
  if (S.enc && !S.list.some((c) => c.kind === "monster" || c.kind === "lair")) delete S.enc;
  if (S.allMon && !S.list.some((c) => c.kind === "monster")) delete S.allMon; // "toch meetellen" hoort bij de monsters in de lijst
}

/** Bij Start gevecht: nieuw gevecht, oude samenvatting weg */
export function startFight(S, now) {
  S.fight = { t0: now, down: [], pre: S.list.filter((c) => c.kind === "pc" && c.max && c.hp <= 0).map((c) => c.id) };
  delete S.endSum;
}

/**
 * Samenvatting bij het afronden (vóór stopCombat: S.round is nog de laatste ronde). find(ref, ed) = statblock.
 * Monsters: alle, behalve levende verborgen monsters (die heeft de groep niet gezien). xp = null zonder CR/xp.
 * flip = id's die de DM omzette: monster op 0 HP niet meetellen / levend monster (gevlucht) wel; speler wel of niet delen.
 */
export function endSummary(S, find, now) {
  const f = S.fight;
  const mons = S.list.filter((c) => c.kind === "monster" && (isOut(c) || !c.hidden)).map((c) => {
    const s = c.ref && find(c.ref, c.ed), x = s ? crXp(s.cr) ?? (Number.isFinite(s.xp) && s.xp > 0 ? s.xp : null) : null;
    return { id: c.id, name: c.ref || c.name, label: c.name, xp: x, out: isOut(c) };
  });
  const pcs = S.list.filter((c) => c.kind === "pc").map((c) => ({ id: c.id, name: c.name, dead: !!(c.ds && c.ds.dead), up: !!c.max && c.hp > 0 }));
  const min = f && f.t0 ? Math.round((now - f.t0) / 60000) : 0;
  const all = S.list.filter((c) => c.kind === "monster").map((c) => c.id); // GV7: ook levende verborgen monsters (restant bij de volgende Start)
  return { r: S.round || 0, min: min >= 1 && min < 24 * 60 ? min : 0, enc: encName(S), mons, pcs, down: f ? f.down.map((x) => ({ ...x })) : [], flip: [], all };
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

export const byText = (by) => by.map(([n, k]) => (k > 1 ? `${k}× ${n}` : n)).join(", ");

/** Eén regel voor het logboek (descriptor, WP27; getallen worden in de taal van het scherm opgemaakt) */
export function endText(es) {
  const k = endCalc(es);
  const head = M(es.enc ? "rules.end.headEnc" : "rules.end.head", { enc: es.enc || "", n: es.r });
  const parts = [es.min ? M("rules.end.min", { head, min: es.min }) : head];
  parts.push(k.by.length ? M("rules.end.beaten", { what: byText(k.by) }) : M("rules.end.none"));
  parts.push(k.share.length ? M("rules.end.xpShare", { xp: Math.round(k.xp), per: Math.round(k.per), names: k.share.map((p) => p.name).join(", ") }) : M("rules.end.xpNone", { xp: Math.round(k.xp) }));
  if (k.noXp.length) parts.push(M("rules.end.noXp", { names: k.noXp.join(", ") }));
  if (k.down.length) parts.push(M("rules.end.down", { what: J(k.down.map((x) => (x.up ? M("rules.end.up", { name: x.name }) : x.name))) }));
  if (k.dead.length) parts.push(M("rules.end.dead", { names: k.dead.join(", ") }));
  return M("rules.end.line", { body: J(parts, ". ") });
}

/** Schakelt meetellen (monster) of delen (speler) om */
export function toggleFlip(es, id) {
  const fl = es.flip || (es.flip = []), i = fl.indexOf(id);
  if (i < 0) fl.push(id); else fl.splice(i, 1);
}

/* ---------- GV7: restanten van het vorige gevecht ---------- */

/** Monsters die er bij het afronden al stonden (S.endSum bestaat tot Start gevecht of monsters wissen) */
export function oldMons(S) {
  const es = S.endSum; if (!es) return [];
  const ids = new Set(Array.isArray(es.all) ? es.all : (es.mons || []).map((m) => m.id)); // samenvatting van vóór 1.37.0: zonder all
  return S.list.filter((c) => c.kind === "monster" && ids.has(c.id));
}
/** WP76 (K2): monsters die bij Start blijven; bij drop ("Oude wissen en starten") zonder die van het vorige gevecht */
export function keptMons(S, drop) {
  const L = S.list.filter((c) => c.kind === "monster");
  if (!drop) return L;
  const old = new Set(oldMons(S).map((c) => c.id));
  return old.size ? L.filter((c) => !old.has(c.id)) : L;
}
/** "Nog 3 monsters uit het vorige gevecht: Adult Red Dragon 83/178 HP, Goblin 1, Goblin 2 +1." (max 3 namen) */
export function oldText(L) {
  const nm = (c) => (c.max && c.hp < c.max ? `${c.name} ${Math.max(0, c.hp)}/${c.max} HP` : c.name);
  return t("rules.old", { n: L.length, names: L.slice(0, 3).map(nm).join(", "), more: L.length > 3 ? ` +${L.length - 3}` : "" });
}
/** Oude monsters weghalen (vóór Start of los); geeft het aantal */
export function dropOld(S) {
  const L = oldMons(S);
  if (L.length) dropIds(S, new Set(L.map((c) => c.id)));
  return L.length;
}

/** Condities die na een gevecht meestal niet doorlopen: standaard aan in "Condities van spelers" */
const END_ON = ["Prone", "Grappled", "Restrained"];
const END_KEEP = ["Concentrating"]; // kan doorlopen, nooit standaard aan
const END_HIDE = ["Unconscious"]; // hangt aan HP
/**
 * Condities van levende spelers na het afronden: [{ k: "id|cond", id, name, cond, on }].
 * on = standaard aanvinken: Prone/Grappled/Restrained, of een conditie met een duur in beurten of rondes (Frightened van een spell).
 */
export function leftConds(list) {
  const out = [];
  for (const c of list) {
    if (c.kind !== "pc" || (c.ds && c.ds.dead)) continue;
    for (const n of c.cond || []) {
      if (END_HIDE.includes(n)) continue;
      const e = c.cd && c.cd[n], timed = !!(e && e.kind && e.kind !== "inf");
      const down = n === "Prone" && c.max && c.hp <= 0; // Unconscious houdt Prone in (5e 2014): niet standaard wissen
      out.push({ k: `${c.id}|${n}`, id: c.id, name: c.name, cond: n, on: !down && !END_KEEP.includes(n) && (END_ON.includes(n) || timed) });
    }
  }
  return out;
}
/** Gekozen condities weghalen (keys "id|cond"); geeft ["Thalia Prone", …] */
export function wipeConds(list, keys) {
  const done = [];
  for (const k of keys) {
    const i = k.lastIndexOf("|"), id = k.slice(0, i), n = k.slice(i + 1), c = list.find((x) => x.id === id);
    if (!c || !(c.cond || []).includes(n) || END_HIDE.includes(n)) continue;
    c.cond = c.cond.filter((x) => x !== n);
    if (c.cd) delete c.cd[n];
    if (n === "Concentrating") c.concSpell = null; // zoals breakConc: effecten van deze caster vervallen in commit()
    done.push(`${c.name} ${n}`);
  }
  return done;
}
