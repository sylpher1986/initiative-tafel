// Spelersscherm: wat spelers mogen zien. Puur (geen DOM), getest.
// Alleen deze snapshot verlaat het DM-scherm, nooit de volledige toestand. Zo kan dezelfde snapshot
// later ook via een server naar andere apparaten zonder dat er DM-info meegaat.
import { sortOrder, isOut, groupOf, nextUp, isSurprised, skipsTurn, reactUsed, durDesc, saveDesc } from "./rules/turns.js";
import { effName } from "./rules/effects.js";
import { iconId, cleanImg } from "./ui/avatar.js";
import { esc } from "./ui/util.js";
import { t } from "./i18n/boot.js";
import { isMsg } from "./i18n/msg.js";
import { rulesOf } from "./rules/edition.js";

// Meertaligheid (WP28): de snapshot bevat codes (hs, anon, tk, tdx), elk spelersscherm vertaalt zelf in zijn eigen taal.
// Sinds WP32 (v 2) zonder de oude Nederlandse velden (hp.st, naam "Onbekend wezen", tags-woorden, td, gname): geen UI-tekst
// over de lijn. Een spelersscherm van vóór 1.51.0 weigert v 2 zonder melding en blijft op zijn laatste stand staan tot
// het herladen wordt (de service worker herlaadt open tabbladen niet zelf).
// cleanView leest v 1 (DM 1.51–1.52.0, met codes) en v 2; uit een v 1 zonder codes (vóór 1.51.0) wordt niets afgeleid.

/**
 * Wat spelers zien (standaard). Instelbaar per apparaat (Instellingen → Spelersscherm, js/ui/playervis.js).
 * Spelers-HP is altijd exact (vaste keuze); de lair verberg je zoals een monster (c.hidden).
 */
export const VIS = {
  monHp: "status", // monsters: "status" (Ongedeerd … Bijna dood) | "none" | "exact"
  init: false,     // initiativegetallen tonen (anders alleen de volgorde)
  tags: "all",     // condities en effecten (alleen namen): "all" | "pc" (alleen bij spelers) | "none"
  log: true,       // SC9: "wat er net gebeurde" op het spelersscherm (afgeleid uit de snapshots zelf, dus niets extra's)
};
export const VIS_OPTS = { monHp: ["status", "none", "exact"], init: [false, true], tags: ["all", "pc", "none"], log: [true, false] };

/** Onbetrouwbare instelling (localStorage) → geldige VIS; per sleutel terug naar de standaard */
export function cleanVis(v) {
  const o = v && typeof v === "object" ? v : {};
  const out = {};
  for (const k of Object.keys(VIS)) out[k] = VIS_OPTS[k].includes(o[k]) ? o[k] : VIS[k];
  return out;
}

/* ---------- naam onbekend voor spelers (per monster, c.anon = vast nummer) ---------- */
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
/** Nummer voor spelers: 0 = zonder nummer (spelers zien er maar één) */
const anonNo = (c, many) => (many ? c.anon : 0);
/** "Onbekend wezen" / "Unknown creature 2" in de actieve taal */
export const anonText = (n) => (n ? t("player.anonN", { n }) : t("player.anon"));
export const anonName = (c, list) => anonText(anonNo(c, anonSeen(list) > 1));
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

/** HP-status voor spelers als code (WP28), zonder getallen; "" = geen (max HP onbekend) */
export const HS = ["ok", "hurt", "bloodied", "near", "down", "unconscious", "stable", "dead"];
export function hsCode(c) {
  if (!c.max) return "";
  if (c.hp <= 0) {
    if (c.kind !== "pc") return "down";
    const d = c.ds || {};
    return d.dead ? "dead" : d.stable ? "stable" : "unconscious";
  }
  const p = c.hp / c.max;
  return p >= 1 ? "ok" : p > 0.5 ? "hurt" : p > 0.25 ? "bloodied" : "near";
}
/** Status in de actieve taal */
export const hsText = (code) => (HS.includes(code) ? t(`dnd.hs.${code}`) : "");

function hpFor(c, how) {
  if (!c.max || how === "none") return null;
  const hs = hsCode(c);
  if (how === "exact") return { hp: Math.max(0, c.hp), max: c.max, temp: c.temp || 0, hs };
  return { hs };
}

/** Tags met een eigen tekst (geen D&D-term): in tags staat dan de code, in tk ook (WP32) */
export const TAG_CODES = ["sur", "react"];
const TAG_KEY = { sur: "init.card.sur", react: "rules.reactTag" }; // zelfde labels als in de DM-app (GV12)
/** Tag in de actieve taal: code uit tk, anders de tag zelf (D&D-term, spellnaam of eigen effect) */
export const tagText = (c, i) => (c.tk && TAG_KEY[c.tk[i]] ? t(TAG_KEY[c.tk[i]]) : c.tags[i]);

/**
 * Tags (namen) plus per tag: tk = code voor tags met eigen tekst (WP28), tdx = duur en herhaalsave als descriptor voor de
 * uitleg op het spelersscherm (RE10). Beide parallel aan tags,
 * null waar niets is, en alleen als er iets in staat. name(id) = naam die spelers mogen zien (verborgen/anoniem: leeg),
 * nooit de bron (spell/caster).
 */
function tagsFor(c, S, pcr, name) {
  const tags = [], tk = [], tdx = [];
  const add = (x, k = null, d = null) => { tags.push(x); tk.push(k); tdx.push(d); };
  if (isSurprised(c, S)) add("sur", "sur");
  // SC8: speler op 0 HP heeft al de status Bewusteloos/Stabiel/Dood; "Unconscious" ernaast is dubbel
  const down = c.kind === "pc" && c.max && c.hp <= 0;
  for (const x of (c.cond || []).filter((k) => !(down && k === "Unconscious"))) {
    const e = c.cd && c.cd[x], d = e ? durDesc(e, S.list, name) : null, sv = saveDesc(e);
    add(x === "Concentrating" && c.kind === "pc" && c.concSpell ? `Concentrating · ${c.concSpell}` : x, null, d || sv ? { ...(d ? { d } : {}), ...(sv ? { s: sv } : {}) } : null);
  }
  for (const e of c.eff || []) { const n = effName(e); if (!tags.some((x, i) => x === n && !tk[i])) add(n); } // codes (sur/react) zijn geen namen
  if (reactUsed(c, S, pcr)) add("react", "react");
  return { t: tags, tk: tk.some(Boolean) ? tk : null, tdx: tdx.some(Boolean) ? tdx : null };
}

/** SC5: slots, daily spells en resources van een speler (geen geheim; alleen de eigen kaart toont ze). null = niets */
function slotsFor(c) {
  const k = c.casting || {}, n = (v) => Math.max(0, v | 0);
  const s = (k.slots || []).filter((x) => x && x.max > 0).map((x) => ({ l: x.lvl | 0, left: n(x.left), max: n(x.max) }));
  const p = k.pact && k.pact.max > 0 ? [{ n: `Pact ${["", "1st", "2nd", "3rd", "4th", "5th"][k.pact.lvl | 0] || ""}`.trim(), left: n(k.pact.left), max: n(k.pact.max) }] : []; // RE3: als regel, zelfde vorm
  const d = [...p, ...(k.daily || []).flatMap((g) => (g && g.items) || []).filter((x) => x && x.max > 0).map((x) => ({ n: String(x.n || ""), left: n(x.left), max: n(x.max) }))];
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
      id: c.id, kind: pc ? "pc" : "monster", name: anon ? "" : c.name, init: vis.init ? c.init : null,
      icon: anon ? "m-unknown" : iconId(c, pc ? "" : metaOf(c)), img: pc ? cleanImg(c.img) : null,
      out: isOut(c), hp: hpFor(c, pc ? "exact" : vis.monHp), tags: [],
    };
    if (anon) r.anon = anonNo(c, anonMany); // WP28: het spelersscherm maakt de naam zelf in zijn taal (0 = zonder nummer)
    if (vis.tags === "all" || (pc && vis.tags === "pc")) {
      const T = tagsFor(c, S, pcr, nameOf);
      r.tags = T.t;
      if (T.tk) r.tk = T.tk;
      if (T.tdx) r.tdx = T.tdx;
    }
    const sl = pc ? slotsFor(c) : null;
    if (sl) r.sl = sl;
    const d = c.ds || {}; // zonder ds-object nog geen worpen (zoals de DM-kaart met newDs())
    if (pc && c.max && c.hp <= 0 && !d.dead && !d.stable) r.ds = { s: d.s || 0, f: d.f || 0 };
    return r;
  });
  const out = { v: 2, round: vt.round, active, next, list };
  if (vis.log === false) out.nolog = 1;
  out.tg = vis.tags; // SC9: instelling gewisseld → geen regelstorm (zegt niets wat spelers niet al zien)
  if (!fight && S.endSum) out.end = Math.max(0, S.endSum.r | 0);
  if (inTurn.size > 1) out.group = [...inTurn]; // groepsnaam maakt het spelersscherm zelf (shownGroup)
  if (rulesOf(S) === "2024") out.ed = "2024"; // WP52 (B8): regels voor de conditie-uitleg; ontbreekt = 2014 (oudere schermen negeren het)
  const pm = pvMap(opts.map);
  if (pm) out.map = pm;
  return out;
}

/* ---------- WP71: spelerskaart (plat beeld, alleen lokaal) ---------- */
// De DM deelt een kaart bewust (schakelaar in de kaartviewer) en rendert hem zelf tot één plat beeld (js/ui/encmap.js,
// flatMap): achtergrond, terrein, objecten en raster, zonder editor-overlays. Naar spelers gaat alleen dat beeld met
// zijn maat en een sleutel, nooit het kaartdocument (raster, objecten, assets, naam, id). Het beeld is een Blob: goedkoop
// over het lokale kanaal (structured clone) en geen base64 in de JSON-vergelijking van dmLink. De kamer stuurt het niet
// (roomChannel haalt map eruit; via de kamer pas in WP72).
export const MAP_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAP_MAX = 8 * 1048576; // bytes; een plat beeld van ≤ 2048 px in JPEG is ruim kleiner
export const MAP_PX = 4096;          // breedte en hoogte
const MAP_K = /^[A-Za-z0-9_.-]{1,64}$/;
const isBlob = (b) => typeof Blob !== "undefined" && b instanceof Blob;
/** Expliciete whitelist (ook voor wat de DM-kant aanlevert): { k, w, h, img } of null */
function pvMap(m) {
  if (!m || typeof m !== "object" || typeof m.k !== "string" || !MAP_K.test(m.k) || !isBlob(m.img) || !MAP_TYPES.includes(m.img.type) || m.img.size > MAP_MAX) return null;
  const w = int(m.w), h = int(m.h);
  return w >= 1 && h >= 1 && w <= MAP_PX && h <= MAP_PX ? { k: m.k, w, h, img: m.img } : null;
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
export const dsText = (d) => (!d.s && !d.f ? t("player.ds.none") : t("player.ds.some", { s: d.s, f: d.f }));

/** Naam voor spelers in de actieve taal (WP28): onbekend wezen en lair uit de catalogus, anders de naam uit de stand */
export const pvName = (c) => (c.kind === "lair" ? t("player.lair") : c.anon != null ? anonText(c.anon) : c.name);
/** Groepsnaam in de actieve taal: uit de rijen (namen kunnen vertaald zijn), anders de ontvangen gname (DM vóór WP32) */
function shownGroup(V) {
  const rows = (V.group || []).map((id) => V.list.find((c) => c.id === id)).filter(Boolean);
  return rows.length > 1 ? groupName(rows.map((c) => ({ name: pvName(c) }))) : V.gname || null;
}

/**
 * Kop: wie aan de beurt is. Zonder zichtbare beurt in ronde 1 (verborgen monster begint): "Gevecht begint" (SC2b).
 * meId (SC5): "Jij bent aan de beurt" / "Daarna jij".
 */
export function headHtml(V, meId = null) {
  const act = V.list.find((c) => c.id === V.active), nxt = V.list.find((c) => c.id === V.next);
  const ms = meState(V, meId), L = (s) => `<span class="l">${esc(s)}</span>`;
  const daarna = ms === "next" ? `<div class="r me">${L(t("player.head.next"))}${esc(t("player.head.nextMe"))}</div>`
    : nxt ? `<div class="r">${L(t("player.head.next"))}${esc(pvName(nxt))}</div>` : "";
  const rnd = t("player.head.round", { n: V.round });
  if (ms === "turn") return `<div>${L(rnd)}<b>${esc(t("player.head.myTurn"))}</b></div>${daarna}`;
  const gn = V.round ? shownGroup(V) : null;
  if (V.round) return gn || act
    ? `<div>${L(t("player.head.roundTurn", { n: V.round }))}<b>${esc(gn || pvName(act))}</b></div>${daarna}`
    : `<div>${L(V.round === 1 ? rnd : t("player.head.combat"))}<b>${esc(V.round === 1 ? t("player.head.begins") : rnd)}</b></div>${daarna}`;
  if (V.end != null) return `<div>${L(t("player.head.over"))}<b>${esc(V.end ? t("player.head.after", { n: V.end }) : t("player.head.done"))}</b></div>`;
  return `<div>${L(t("player.head.none"))}<b>${esc(t("player.head.wait"))}</b></div>`;
}

/* ---------- ontvangen: snapshot opschonen (nu uit een ander venster, later uit het netwerk) ---------- */
const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
const int = (v) => (Number.isFinite(+v) ? Math.round(+v) : 0);
const ICON_RE = /^[rm]-[a-z]{2,20}$/;
/** Alleen bekende statussen komen door */
const hsOf = (h) => (HS.includes(h.hs) ? h.hs : "");
const anonOf = (c, kind) => (kind !== "monster" || c.anon == null ? null : Math.max(0, Math.min(99, int(c.anon))));
/** Descriptoren in tdx: alleen deze sleutels, met deze waarden (een spelersscherm vertaalt verder niets van de DM) */
const TDX = { "rules.dw.rounds": ["n"], "rules.dw.tend": [], "rules.dw.tend2": [], "rules.dw.tstart": [], "rules.dw.sstart": ["name"], "rules.dw.sstartX": [], "rules.saveWords": ["ab", "dc"] };
function cleanTdx(x) {
  if (!isMsg(x) || !Object.prototype.hasOwnProperty.call(TDX, x.k)) return null;
  const want = TDX[x.k], p = x.p && typeof x.p === "object" ? x.p : {}, out = {};
  for (const k of want) {
    const v = p[k];
    if (k === "n") { if (typeof v !== "number" || !Number.isFinite(v)) return null; out.n = Math.max(0, Math.min(9999, int(v))); }
    else { if (typeof v !== "string" && typeof v !== "number") return null; out[k] = str(String(v), 80); }
  }
  return want.length ? { k: x.k, p: out } : { k: x.k };
}

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
  if (!d || typeof d !== "object" || (d.v !== 1 && d.v !== 2) || !Array.isArray(d.list)) return null;
  const list = d.list.slice(0, 60).filter((c) => c && typeof c === "object").map((c) => {
    const kind = ["pc", "monster", "lair"].includes(c.kind) ? c.kind : "monster";
    const anon = anonOf(c, kind);
    const r = { id: str(c.id, 40), kind, name: str(c.name, 120) || (anon != null ? "" : "?"), init: c.init == null ? null : int(c.init) };
    if (kind === "lair") return r;
    if (anon != null) r.anon = anon;
    const h = c.hp && typeof c.hp === "object" ? c.hp : null;
    Object.assign(r, {
      icon: ICON_RE.test(c.icon) ? c.icon : kind === "pc" ? "r-pc" : "m-monstrosity",
      img: kind === "pc" ? cleanImg(c.img) : null, out: !!c.out,
      hp: h ? (h.max != null ? { hp: int(h.hp), max: Math.max(0, int(h.max)), temp: Math.max(0, int(h.temp)), hs: hsOf(h) } : { hs: hsOf(h) }) : null,
      tags: Array.isArray(c.tags) ? c.tags.slice(0, 20).map((t) => str(t, 80)).filter(Boolean) : [],
    });
    // RE10/WP28: per tag duur/save (tdx descriptor) en code (tk); optioneel. Alleen als het parallel aan tags past.
    const par = (a) => Array.isArray(a) && Array.isArray(c.tags) && a.length === c.tags.length && r.tags.length === c.tags.length;
    if (par(c.tdx)) {
      const tdx = c.tdx.slice(0, 20).map((x) => {
        if (!x || typeof x !== "object") return null;
        const d = cleanTdx(x.d), s = cleanTdx(x.s);
        return d || s ? { ...(d ? { d } : {}), ...(s ? { s } : {}) } : null;
      });
      if (tdx.some(Boolean)) r.tdx = tdx;
    }
    const tk = par(c.tk) ? c.tk.slice(0, 20).map((x) => (TAG_CODES.includes(x) ? x : null)) : [];
    if (tk.some(Boolean)) r.tk = tk;
    if (c.ds && typeof c.ds === "object") r.ds = { s: Math.max(0, Math.min(3, int(c.ds.s))), f: Math.max(0, Math.min(3, int(c.ds.f))) };
    if (kind === "pc" && c.sl && typeof c.sl === "object") {
      const sl = cleanSl(c.sl);
      if (sl) r.sl = sl;
    }
    return r;
  });
  const ids = new Set(list.map((c) => c.id));
  const pick = (v) => (typeof v === "string" && ids.has(v) ? v : null);
  const out = { v: d.v, round: Math.max(0, int(d.round)), active: pick(d.active), next: pick(d.next), list };
  if (d.nolog) out.nolog = 1;
  if (d.ed === "2024") out.ed = "2024";
  const pm = pvMap(d.map); // WP71: alleen een geldig beeld (type, grootte, maat), anders geen kaart
  if (pm) out.map = pm;
  if (VIS_OPTS.tags.includes(d.tg)) out.tg = d.tg;
  if (!out.round && d.end != null) out.end = Math.max(0, Math.min(9999, int(d.end)));
  const group = Array.isArray(d.group) ? [...new Set(d.group.map(pick).filter(Boolean))].slice(0, 20) : [];
  if (out.active && group.length > 1 && group.includes(out.active)) Object.assign(out, { group, gname: str(d.gname, 200) || null });
  return out;
}

/* ---------- SC9: "wat er net gebeurde" (spelerskant) ---------- */
// Alleen afgeleid uit twee opeenvolgende, al opgeschoonde snapshots: wat spelers niet zien, kan er niet in staan.
// Geen regels voor verschijnen/verdwijnen (verborgen monsters), naamwissels (onthulling) of beurtwissels (staan in de kop).
// Tekst in de taal van dit spelersscherm; vergelijken gebeurt op codes (hs, tk), zodat het niet uitmaakt welke taal de DM heeft.
const DOWN_HS = ["unconscious", "stable", "dead"];

/** Regels voor de overgang a → b (beide uit cleanView). Leeg buiten een gevecht of zonder vorige stand. */
export function logLines(a, b) {
  if (!a || !b || !b.round || !a.round || b.nolog) return [];
  const old = new Map(a.list.map((c) => [c.id, c])), out = [];
  // tags zonder stille codes (Verrast, Reaction op: zichtbaar in de lijst, geen regel waard); tekst → weergave
  const loud = (c) => { const m = new Map(); c.tags.forEach((x, i) => { if (!(c.tk && c.tk[i]) && !m.has(x)) m.set(x, tagText(c, i)); }); return m; };
  for (const c of b.list) {
    const o = old.get(c.id);
    if (!o || c.kind === "lair") continue;
    const parts = [];
    let tight = false; // "Aria −7 HP" en "Goblin 1 neer" zonder dubbele punt
    const h0 = o.hp, h1 = c.hp, exact = h0 && h1 && h0.max != null && h1.max != null;
    if (exact && h1.hp !== h0.hp) { parts.push(`${h1.hp < h0.hp ? "−" : "+"}${Math.abs(h1.hp - h0.hp)} HP`); tight = true; }
    if (c.kind === "monster" && c.out && !o.out) { parts.unshift(t("player.log.down")); tight = true; } // WP39: "neer" vóór het getal (zelfde reden als hieronder)
    else if (h0 && h1 && h1.hs !== h0.hs && h1.hs && (!exact || DOWN_HS.includes(h1.hs) || DOWN_HS.includes(h0.hs))) {
      const st = exact ? hsText(h1.hs).toLowerCase() : `${hsText(h0.hs) || "?"} → ${hsText(h1.hs)}`;
      // WP39 (HS17): neer/stabiel/dood vóór het getal, zodat de afkapping op 320 px het getal raakt en niet de toestand
      if (exact && DOWN_HS.includes(h1.hs)) parts.unshift(st); else parts.push(st);
    }
    const same = a.tg === b.tg, t0 = same ? loud(o) : new Map(), t1 = same ? loud(c) : new Map();
    const add = [...t1].filter(([x]) => !t0.has(x)).map(([, v]) => v), gone = [...t0].filter(([x]) => !t1.has(x)).map(([, v]) => v);
    if (add.length) parts.push(add.join(", "));
    if (gone.length) parts.push(t("player.log.gone", { what: gone }));
    if (!parts.length) continue;
    out.push(`${pvName(c)}${tight ? " " : ": "}${parts.join(" · ")}`);
  }
  return out;
}

/** Bijhouden: nieuwste onderaan, max 8, alleen de huidige en vorige ronde; zonder gevecht leeg */
export function pushLog(log, lines, round) {
  if (!round) return [];
  return [...log.filter((e) => e.r >= round - 1), ...lines.map((t) => ({ t, r: round }))].slice(-8);
}
