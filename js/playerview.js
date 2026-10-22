// Spelersscherm: wat spelers mogen zien. Puur (geen DOM), getest.
// Alleen deze snapshot verlaat het DM-scherm, nooit de volledige toestand. Zo kan dezelfde snapshot
// later ook via een server naar andere apparaten zonder dat er DM-info meegaat.
import { sortOrder, isOut, groupOf, nextUp, isSurprised, skipsTurn, reactUsed, REACT_TAG, durWords, saveWords } from "./rules/turns.js";
import { effName } from "./rules/effects.js";
import { iconId, cleanImg } from "./ui/avatar.js";
import { esc } from "./ui/util.js";

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

export { REACT_TAG };

/**
 * Tags (namen) plus td: per tag de duur en herhaalsave voor de uitleg op het spelersscherm (RE10), parallel aan tags;
 * null waar niets te zeggen is. name(id) = naam die spelers mogen zien (verborgen/anoniem: leeg), nooit de bron (spell/caster).
 */
function tagsFor(c, S, pcr, name) {
  const t = isSurprised(c, S) ? ["Verrast"] : [], td = t.map(() => null);
  // SC8: speler op 0 HP heeft al de status Bewusteloos/Stabiel/Dood; "Unconscious" ernaast is dubbel
  const down = c.kind === "pc" && c.max && c.hp <= 0;
  for (const x of (c.cond || []).filter((k) => !(down && k === "Unconscious"))) {
    t.push(x === "Concentrating" && c.kind === "pc" && c.concSpell ? `Concentrating · ${c.concSpell}` : x);
    const e = c.cd && c.cd[x], d = e ? durWords(e, S.list, name) : "", sv = saveWords(e);
    td.push(d || sv ? { ...(d ? { d } : {}), ...(sv ? { s: sv } : {}) } : null);
  }
  for (const e of c.eff || []) { const n = effName(e); if (!t.includes(n)) { t.push(n); td.push(null); } }
  if (reactUsed(c, S, pcr)) { t.push(REACT_TAG); td.push(null); }
  return { t, td: td.some(Boolean) ? td : null };
}

/** SC5: slots, daily spells en resources van een speler (geen geheim; alleen de eigen kaart toont ze). null = niets */
function slotsFor(c) {
  const k = c.casting || {}, n = (v) => Math.max(0, v | 0);
  const s = (k.slots || []).filter((x) => x && x.max > 0).map((x) => ({ l: x.lvl | 0, left: n(x.left), max: n(x.max) }));
  const d = (k.daily || []).flatMap((g) => (g && g.items) || []).filter((x) => x && x.max > 0).map((x) => ({ n: String(x.n || ""), left: n(x.left), max: n(x.max) }));
  const r = (c.res || []).filter((x) => x && x.max > 0).map((x) => ({ n: String(x.n || ""), left: n(x.left), max: n(x.max) }));
  return s.length || d.length || r.length ? { s, d, r } : null;
}

/**
 * Zichtbare beurt voor spelers (SC2b, puur). Is een verborgen deelnemer aan de beurt, dan blijft de laatste zichtbare
 * beurt ervóór staan (met zijn ronde): dat leest als "die denkt nog even na", terwijl een lege beurt verraadt dat er iets
 * meedoet. prev = { id, round } van de vorige snapshot met een zichtbare beurt (het DM-scherm onthoudt hem): die wint als
 * hij nog bestaat en vóór de verborgen beurt ligt (dezelfde ronde eerder in de volgorde, of de vorige ronde erna), want
 * achteraf terugrekenen ziet niet wie intussen neerging of in ronde 1 verrast was (sur wordt in ronde 2 gewist).
 * Zonder bruikbare hint (na herladen): terug in de volgorde zoals step() vooruit loopt.
 * → { id, round, guess? }; id null = geen zichtbare beurt (verborgen monster opent het gevecht); guess = teruggerekend.
 */
export function shownTurn(S, all, seen, prev = null) {
  const i = all.findIndex((c) => c.id === S.active);
  if (i < 0 || seen(all[i])) return { id: i < 0 ? null : S.active, round: S.round || 0 };
  if (prev && prev.id) {
    const ip = all.findIndex((c) => c.id === prev.id);
    if (ip >= 0 && seen(all[ip]) && (prev.round === S.round ? ip < i : prev.round === S.round - 1 && prev.round >= 1 && ip > i)) return { id: prev.id, round: prev.round };
  }
  let r = S.round, j = i;
  for (let n = 1; n < all.length; n++) {
    if (--j < 0) { j = all.length - 1; r--; } // rondgang terug
    if (r < 1) break;
    const c = all[j];
    if (seen(c) && !skipsTurn(c, r)) return { id: c.id, round: r, guess: true };
  }
  return { id: null, round: S.round };
}

/**
 * Snapshot voor het spelersscherm.
 * metaOf(c): creature type-tekst van een monster (voor het icoon); vis: zie VIS.
 * Verborgen deelnemers (c.hidden) bestaan niet voor spelers: ook hun beurt niet (shownTurn, prev = vorige zichtbare beurt).
 * Zonder gevecht (round 0) alleen spelers (SC2a): klaargezette monsters verraden de hinderlaag. end = rondes van het
 * net afgeronde gevecht (S.endSum, tot Start of monsters wissen), voor de kop "Gevecht voorbij".
 */
export function toPlayerView(S, metaOf = () => "", vis = VIS, prev = null, opts = {}) {
  const pcr = opts.pcReact !== false; // GV4 "Spelers zelf": geen "Reaction op" bij spelers
  const all = sortOrder(S.list || []);
  const fight = !!S.round;
  const seen = (c) => !c.hidden && (fight || c.kind === "pc");
  const shown = all.filter(seen);
  const vt = fight ? shownTurn(S, all, seen, prev) : { id: null, round: 0 };
  let active = vt.id;
  // groepsbeurt: spelers zien de zichtbare levende leden samen aan de beurt, "volgende" ligt voorbij de groep
  const g = active ? groupOf(all, active, vt.round) : null;
  const inTurn = new Set(g ? g.live.filter(seen).map((c) => c.id) : []);
  const nx = S.round && S.active ? nextUp(S, all, S.active, (c) => inTurn.has(c.id) || !seen(c)) : null; // ook verrast in ronde 1 overslaan
  const next = nx ? nx.id : null;
  if (vt.guess && active === next) active = null; // teruggerekend en gelijk aan Daarna: waarschijnlijk mis, dan liever geen naam
  const anonMany = anonSeen(all) > 1; // één keer per snapshot, niet per rij
  const nameOf = (id) => { const x = all.find((y) => y.id === id); return x && seen(x) && !(x.kind === "monster" && x.anon > 0) ? x.name : ""; }; // RE10: duur "t/m beurt van X"
  const list = shown.map((c) => {
    if (c.kind === "lair") return { id: c.id, kind: "lair", name: "Lair", init: vis.init ? c.init : null };
    const pc = c.kind === "pc", anon = !pc && c.anon > 0; // naam en icoon (type) verraden het monster
    const r = {
      id: c.id, kind: pc ? "pc" : "monster", name: anon ? anonLabel(c, anonMany) : c.name, init: vis.init ? c.init : null,
      icon: anon ? "m-unknown" : iconId(c, pc ? "" : metaOf(c)), img: pc ? cleanImg(c.img) : null,
      out: isOut(c), hp: hpFor(c, pc ? "exact" : vis.monHp), tags: [],
    };
    if (vis.tags === "all" || (pc && vis.tags === "pc")) { const T = tagsFor(c, S, pcr, nameOf); r.tags = T.t; if (T.td) r.td = T.td; }
    const sl = pc ? slotsFor(c) : null;
    if (sl) r.sl = sl;
    const d = c.ds || {}; // zonder ds-object nog geen worpen (zoals de DM-kaart met newDs())
    if (pc && c.max && c.hp <= 0 && !d.dead && !d.stable) r.ds = { s: d.s || 0, f: d.f || 0 };
    return r;
  });
  const out = { v: 1, round: vt.round, active, next, list };
  if (!fight && S.endSum) out.end = Math.max(0, S.endSum.r | 0);
  if (inTurn.size > 1) Object.assign(out, { group: [...inTurn], gname: groupName(list.filter((c) => inTurn.has(c.id))) });
  return out;
}

/** "Bugbear ×3" als alle leden dezelfde naam met een nummer hebben, anders de namen achter elkaar */
export function groupName(rows) {
  const base = rows.map((c) => c.name.replace(/ \d+$/, ""));
  return base.every((b) => b === base[0]) ? `${base[0]} ×${rows.length}` : rows.map((c) => c.name).join(", ");
}

/* ---------- "Dit ben ik" (SC5): keuze per spelerstoestel, puur lokaal ---------- */
/** Gekozen speler in de snapshot: eerst op id, anders op exacte naam (DM herlaadde of zette hem opnieuw aan tafel). null = niet zichtbaar */
export function findMe(V, me) {
  if (!V || !me) return null;
  const pcs = V.list.filter((c) => c.kind === "pc");
  return pcs.find((c) => c.id === me.id) || (me.name ? pcs.find((c) => c.name === me.name) : null) || null;
}
/** "turn" (aan de beurt, ook in een groep), "next" (Daarna) of "" */
export function meState(V, id) {
  if (!V || !id || !V.round) return "";
  if (V.active === id || (V.group || []).includes(id)) return "turn";
  return V.next === id ? "next" : "";
}
/** Trillen bij een overgang (niet bij de eerste stand na laden: prev null). Patroon of null. */
export function buzzFor(prev, now) {
  if (prev == null || prev === now) return null;
  return now === "turn" ? [200, 100, 200] : now === "next" ? [60] : null;
}

/** SC8: death saves in woorden ("✓0 ✗0" zegt spelers niets) */
export const dsText = (d) => (!d.s && !d.f ? "Death saves: nog geen worp" : `Death saves: ${d.s} gelukt · ${d.f} mislukt`);

/**
 * Kop: wie aan de beurt is. Zonder zichtbare beurt in ronde 1 (verborgen monster begint): "Gevecht begint" (SC2b).
 * meId (SC5): "Jij bent aan de beurt" / "Daarna jij".
 */
export function headHtml(V, meId = null) {
  const act = V.list.find((c) => c.id === V.active), nxt = V.list.find((c) => c.id === V.next);
  const ms = meState(V, meId);
  const daarna = ms === "next" ? `<div class="r me"><span class="l">Daarna</span>jij</div>`
    : nxt ? `<div class="r"><span class="l">Daarna</span>${esc(nxt.name)}</div>` : "";
  if (ms === "turn") return `<div><span class="l">Ronde ${V.round}</span><b>Jij bent aan de beurt</b></div>${daarna}`;
  if (V.round) return V.gname || act
    ? `<div><span class="l">Ronde ${V.round} · aan de beurt</span><b>${esc(V.gname || act.name)}</b></div>${daarna}`
    : `<div><span class="l">${V.round === 1 ? "Ronde 1" : "Gevecht"}</span><b>${V.round === 1 ? "Gevecht begint" : `Ronde ${V.round}`}</b></div>${daarna}`;
  if (V.end != null) return `<div><span class="l">Gevecht voorbij</span><b>${V.end ? `Na ${V.end} ronde${V.end === 1 ? "" : "s"}` : "Klaar"}</b></div>`;
  return `<div><span class="l">Nog geen gevecht</span><b>Wacht op de DM</b></div>`;
}

/* ---------- ontvangen: snapshot opschonen (nu uit een ander venster, later uit het netwerk) ---------- */
const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
const int = (v) => (Number.isFinite(+v) ? Math.round(+v) : 0);
const ICON_RE = /^[rm]-[a-z]{2,20}$/;
/** Alle statussen uit hpStatus; iets anders komt niet door */
export const STATUS = ["Ongedeerd", "Gewond", "Bloodied", "Bijna dood", "Neer", "Bewusteloos", "Stabiel", "Dood"];
const st = (v) => (STATUS.includes(v) ? v : "");

const cnt = (v) => Math.max(0, Math.min(99, int(v)));
const items = (a, f) => (Array.isArray(a) ? a.slice(0, 12).filter((x) => x && typeof x === "object").map(f) : []);
/** Slots (l 1–9), daily spells en resources; namen max 40 tekens */
function cleanSl(o) {
  const s = items(o.s, (x) => ({ l: int(x.l), left: cnt(x.left), max: cnt(x.max) })).filter((x) => x.l >= 1 && x.l <= 9);
  const d = items(o.d, (x) => ({ n: str(x.n, 40), left: cnt(x.left), max: cnt(x.max) })).filter((x) => x.n);
  const r = items(o.r, (x) => ({ n: str(x.n, 40), left: cnt(x.left), max: cnt(x.max) })).filter((x) => x.n);
  return s.length || d.length || r.length ? { s, d, r } : null;
}

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
    // RE10: duur/save per tag (optioneel; een oudere DM-app stuurt het niet). Alleen als het parallel aan tags past.
    if (Array.isArray(c.td) && Array.isArray(c.tags) && c.td.length === c.tags.length && r.tags.length === c.tags.length) {
      const td = c.td.slice(0, 20).map((x) => (x && typeof x === "object" && (x.d || x.s) ? { ...(x.d ? { d: str(x.d, 80) } : {}), ...(x.s ? { s: str(x.s, 80) } : {}) } : null));
      if (td.some(Boolean)) r.td = td;
    }
    if (c.ds && typeof c.ds === "object") r.ds = { s: Math.max(0, Math.min(3, int(c.ds.s))), f: Math.max(0, Math.min(3, int(c.ds.f))) };
    if (kind === "pc" && c.sl && typeof c.sl === "object") {
      const sl = cleanSl(c.sl);
      if (sl) r.sl = sl;
    }
    return r;
  });
  const ids = new Set(list.map((c) => c.id));
  const pick = (v) => (typeof v === "string" && ids.has(v) ? v : null);
  const out = { v: 1, round: Math.max(0, int(d.round)), active: pick(d.active), next: pick(d.next), list };
  if (!out.round && d.end != null) out.end = Math.max(0, Math.min(9999, int(d.end)));
  const group = Array.isArray(d.group) ? [...new Set(d.group.map(pick).filter(Boolean))].slice(0, 20) : [];
  if (out.active && group.length > 1 && group.includes(out.active)) Object.assign(out, { group, gname: str(d.gname, 200) || null });
  return out;
}
