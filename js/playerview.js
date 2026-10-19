// Spelersscherm: wat spelers mogen zien. Puur (geen DOM), getest.
// Alleen deze snapshot verlaat het DM-scherm, nooit de volledige toestand. Zo kan dezelfde snapshot
// later ook via een server naar andere apparaten zonder dat er DM-info meegaat.
import { sortOrder, isOut, groupOf, nextUp, isSurprised } from "./rules/turns.js";
import { iconId, cleanImg } from "./ui/avatar.js";

/**
 * Wat spelers zien (standaard). Instelbaar per apparaat (Instellingen → Spelersscherm, js/ui/playervis.js).
 * Spelers-HP is altijd exact (vaste keuze); de lair verberg je zoals een monster (c.hidden).
 */
export const VIS = {
  monHp: "status", // monsters: "status" (Ongedeerd … Bijna dood) | "none" | "exact"
  init: false,     // initiativegetallen tonen (anders alleen de volgorde)
  tags: "all",     // condities en effecten (alleen namen): "all" | "pc" (alleen bij spelers) | "none"
};
export const VIS_OPTS = { monHp: ["status", "none", "exact"], init: [false, true], tags: ["all", "pc", "none"] };

/** Onbetrouwbare instelling (localStorage) → geldige VIS; per sleutel terug naar de standaard */
export function cleanVis(v) {
  const o = v && typeof v === "object" ? v : {};
  const out = {};
  for (const k of Object.keys(VIS)) out[k] = VIS_OPTS[k].includes(o[k]) ? o[k] : VIS[k];
  return out;
}

/* ---------- naam onbekend voor spelers (per monster, c.anon = vast nummer) ---------- */
export const ANON = "Onbekend wezen";
/** Laagste vrije nummer onder de monsters met een onbekende naam; vast in de data, zodat onthullen niets laat verspringen */
export function nextAnon(list) {
  const used = new Set((list || []).filter((c) => c.kind === "monster" && c.anon).map((c) => c.anon));
  let n = 1;
  while (used.has(n)) n++;
  return n;
}
/** Spelersnaam: "Onbekend wezen" als spelers er maar één zien, anders "Onbekend wezen 2". Verborgen monsters tellen
 *  niet mee: anders verraadt "Onbekend wezen 1" dat er nog een tweede klaarstaat. */
export const anonSeen = (list) => (list || []).filter((x) => x.kind === "monster" && x.anon && !x.hidden).length;
const anonLabel = (c, many) => (many ? `${ANON} ${c.anon}` : ANON);
export const anonName = (c, list) => anonLabel(c, anonSeen(list) > 1);
/** Dubbele nummers (handgemaakte import) → laagste vrije nummer, zodat spelers nooit twee keer "Onbekend wezen 2" zien */
export function dedupeAnon(list) {
  const used = new Set();
  for (const c of list) {
    if (!c.anon) continue;
    if (used.has(c.anon)) { let n = 1; while (used.has(n) || list.some((x) => x.anon === n)) n++; c.anon = n; }
    used.add(c.anon);
  }
  return list;
}

/** HP als status voor spelers, zonder getallen */
export function hpStatus(c) {
  if (!c.max) return "";
  if (c.hp <= 0) {
    if (c.kind !== "pc") return "Neer";
    const d = c.ds || {};
    return d.dead ? "Dood" : d.stable ? "Stabiel" : "Bewusteloos";
  }
  const p = c.hp / c.max;
  return p >= 1 ? "Ongedeerd" : p > 0.5 ? "Gewond" : p > 0.25 ? "Bloodied" : "Bijna dood";
}

function hpFor(c, how) {
  if (!c.max || how === "none") return null;
  if (how === "exact") return { hp: Math.max(0, c.hp), max: c.max, temp: c.temp || 0, st: hpStatus(c) };
  return { st: hpStatus(c) };
}

function tagsFor(c, S) {
  const t = isSurprised(c, S) ? ["Verrast"] : [];
  t.push(...(c.cond || []).map((x) => (x === "Concentrating" && c.kind === "pc" && c.concSpell ? `Concentrating · ${c.concSpell}` : x)));
  for (const e of c.eff || []) if (!t.includes(e.n)) t.push(e.n);
  return t;
}

/**
 * Snapshot voor het spelersscherm.
 * metaOf(c): creature type-tekst van een monster (voor het icoon); vis: zie VIS.
 * Verborgen deelnemers (c.hidden) bestaan niet voor spelers: ook hun beurt niet.
 */
export function toPlayerView(S, metaOf = () => "", vis = VIS) {
  const all = sortOrder(S.list || []);
  const seen = (c) => !c.hidden;
  const shown = all.filter(seen);
  const active = shown.some((c) => c.id === S.active) ? S.active : null;
  // groepsbeurt: spelers zien de zichtbare levende leden samen aan de beurt, "volgende" ligt voorbij de groep
  const g = S.round && active ? groupOf(all, active, S.round) : null;
  const inTurn = new Set(g ? g.live.filter(seen).map((c) => c.id) : []);
  const nx = S.round && S.active ? nextUp(S, all, S.active, (c) => inTurn.has(c.id) || !seen(c)) : null; // ook verrast in ronde 1 overslaan
  const next = nx ? nx.id : null;
  const anonMany = anonSeen(all) > 1; // één keer per snapshot, niet per rij
  const list = shown.map((c) => {
    if (c.kind === "lair") return { id: c.id, kind: "lair", name: "Lair", init: vis.init ? c.init : null };
    const pc = c.kind === "pc", anon = !pc && c.anon > 0; // naam en icoon (type) verraden het monster
    const r = {
      id: c.id, kind: pc ? "pc" : "monster", name: anon ? anonLabel(c, anonMany) : c.name, init: vis.init ? c.init : null,
      icon: anon ? "m-unknown" : iconId(c, pc ? "" : metaOf(c)), img: pc ? cleanImg(c.img) : null,
      out: isOut(c), hp: hpFor(c, pc ? "exact" : vis.monHp), tags: vis.tags === "all" || (pc && vis.tags === "pc") ? tagsFor(c, S) : [],
    };
    const d = c.ds || {}; // zonder ds-object nog geen worpen (zoals de DM-kaart met newDs())
    if (pc && c.max && c.hp <= 0 && !d.dead && !d.stable) r.ds = { s: d.s || 0, f: d.f || 0 };
    return r;
  });
  const out = { v: 1, round: S.round || 0, active, next, list };
  if (inTurn.size > 1) Object.assign(out, { group: [...inTurn], gname: groupName(list.filter((c) => inTurn.has(c.id))) });
  return out;
}

/** "Bugbear ×3" als alle leden dezelfde naam met een nummer hebben, anders de namen achter elkaar */
export function groupName(rows) {
  const base = rows.map((c) => c.name.replace(/ \d+$/, ""));
  return base.every((b) => b === base[0]) ? `${base[0]} ×${rows.length}` : rows.map((c) => c.name).join(", ");
}

/* ---------- ontvangen: snapshot opschonen (nu uit een ander venster, later uit het netwerk) ---------- */
const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
const int = (v) => (Number.isFinite(+v) ? Math.round(+v) : 0);
const ICON_RE = /^[rm]-[a-z]{2,20}$/;
/** Alle statussen uit hpStatus; iets anders komt niet door */
export const STATUS = ["Ongedeerd", "Gewond", "Bloodied", "Bijna dood", "Neer", "Bewusteloos", "Stabiel", "Dood"];
const st = (v) => (STATUS.includes(v) ? v : "");

/** Onbetrouwbare snapshot → schone snapshot, of null als het geen snapshot is */
export function cleanView(d) {
  if (!d || typeof d !== "object" || d.v !== 1 || !Array.isArray(d.list)) return null;
  const list = d.list.slice(0, 60).filter((c) => c && typeof c === "object").map((c) => {
    const kind = ["pc", "monster", "lair"].includes(c.kind) ? c.kind : "monster";
    const r = { id: str(c.id, 40), kind, name: str(c.name, 120) || "?", init: c.init == null ? null : int(c.init) };
    if (kind === "lair") return r;
    const h = c.hp && typeof c.hp === "object" ? c.hp : null;
    Object.assign(r, {
      icon: ICON_RE.test(c.icon) ? c.icon : kind === "pc" ? "r-pc" : "m-monstrosity",
      img: kind === "pc" ? cleanImg(c.img) : null, out: !!c.out,
      hp: h ? (h.max != null ? { hp: int(h.hp), max: Math.max(0, int(h.max)), temp: Math.max(0, int(h.temp)), st: st(h.st) } : { st: st(h.st) }) : null,
      tags: Array.isArray(c.tags) ? c.tags.slice(0, 20).map((t) => str(t, 80)).filter(Boolean) : [],
    });
    if (c.ds && typeof c.ds === "object") r.ds = { s: Math.max(0, Math.min(3, int(c.ds.s))), f: Math.max(0, Math.min(3, int(c.ds.f))) };
    return r;
  });
  const ids = new Set(list.map((c) => c.id));
  const pick = (v) => (typeof v === "string" && ids.has(v) ? v : null);
  const out = { v: 1, round: Math.max(0, int(d.round)), active: pick(d.active), next: pick(d.next), list };
  const group = Array.isArray(d.group) ? [...new Set(d.group.map(pick).filter(Boolean))].slice(0, 20) : [];
  if (out.active && group.length > 1 && group.includes(out.active)) Object.assign(out, { group, gname: str(d.gname, 200) || null });
  return out;
}
