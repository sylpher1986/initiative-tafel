// Statblocks (monsters) en character sheets (spelers) in het zijpaneel, met klikbare dobbelstenen.
import { $, esc, n0, toastHtml, spellLink, mdLite } from "./util.js";
import { chev, dsMini } from "./icons.js";
import { findMon, edTagOf, monEd } from "../data/monsters.js";
import { cleanEd, rulesOf } from "../rules/edition.js";
import { app } from "../state.js";
import { rollExpr, mod, sgn } from "../rules/dice.js";
import { ORD, legInfo, castInfo } from "../rules/spells.js";
import { rollDmg, parseAction, monsterActions } from "../rules/attacks.js";
import { sortOrder, readAhead } from "../rules/turns.js";
import { effAc, acBreakdown } from "../rules/effects.js";
import { newDs } from "../rules/combat.js";
import { drText } from "../rules/aoe.js";
import { spellParts } from "../data/spells.js";
import { REST } from "../data/statparse.js";
import { passives, pasText } from "../rules/passives.js";
import { t, i18n } from "../i18n/boot.js";
/** WP49: tag "2024"/"2014" na de naam als het statblock uit de andere SRD komt dan de tafel (lijst, preview, statblock-kop) */
export const edTag = (m) => { const e = edTagOf(m, rulesOf(app.S)); return e ? ` <span class="tag">${e}</span>` : ""; };
/** Trait-naam voor weergave: niet herkende tekst van een eigen monster (REST) in de taal van de pagina */
const trName = (k) => (k === REST ? t("init.sb.other") : k);

/**
 * Tekst → HTML met klikbare "(2d6 + 3)", "+4 to hit" en losse "1d4".
 * atk = { cid, n, hit }: de to-hit-knop opent het doelpaneel van die aanval (statblock van een deelnemer);
 * een tweede to hit met een andere bonus (Druid: "+4 to hit with shillelagh") blijft een losse worp.
 */
export function diceify(txt, atk) {
  const hit = atk ? `data-atk="${esc(atk.n)}" data-cid="${esc(atk.cid)}"` : "", own = (b) => atk && +b === atk.hit;
  return mdLite(esc(txt))
    .replace(/\((\d+d\d+(?:\s*[+−-]\s*\d+)?)\)/g, (m, e) => `(<button class="dice" data-roll="${e}">${e}</button>)`)
    .replace(/([+-]\d+) to hit/g, (m, b) => `<button class="dice" ${own(b) ? hit : `data-roll="1d20${b}" data-hit="1"`}>${b} to hit</button>`)
    .replace(/\b(\d+d\d+)\b(?![^<]*<\/button>)(?![^<]*")/g, (m, e) => `<button class="dice" data-roll="${e}">${e}</button>`);
}

/** Spellcasting-tekst: spell-lijsten ("1st level (4 slots): …", "At will: …") met tikbare namen, de rest via diceify */
export const linkSpells = (txt, atk) => String(txt).split("\n").map((line) =>
  spellParts(line).map((p) => (p.sp ? spellLink(p.sp, p.t) : diceify(p.t, atk))).join("")).join("\n");

export function doRoll(expr, label, isHit) {
  const r = rollExpr(expr);
  if (!r) return;
  let extra = "";
  if (isHit && r.rolls[0] === 20) extra = ` <span class="crit">${esc(t("init.sb.crit"))}</span>`;
  if (isHit && r.rolls[0] === 1) extra = ` <span class="fumble">${esc(t("init.sb.fumble"))}</span>`;
  toastHtml(`${label ? esc(label) + ": " : ""}${esc(expr)} → [${r.rolls.join(", ")}]${r.mod ? ` ${sgn(r.mod)}` : ""} = <b>${r.total}</b>${extra}`);
}

const headBtns = () => `<div class="sbbtns"><button class="btn small sbpin" id="sbpin" aria-pressed="${sb.pin}" title="${esc(t("init.sb.pinTip"))}">${esc(t(sb.pin ? "init.sb.pinned" : "init.sb.pin"))}</button><button class="btn small sbbig" id="sbbig" aria-pressed="false">${esc(t("init.sb.big"))}</button><button class="btn small closebtn" id="sbclose">${esc(t("common.close"))}</button></div>`;

const abilRow = (ab) => `<div class="abil">${["STR", "DEX", "CON", "INT", "WIS", "CHA"].map((k, i) =>
  `<button data-roll="1d20${sgn(mod(n0(ab[i])))}" data-label="${k} check"><b>${k}</b>${n0(ab[i])} <i>(${sgn(mod(n0(ab[i])))})</i></button>`).join("")}</div>`;

/** Damage-knop op de kaart: alle delen in één melding ("Bite: 2d10+6 [7, 3] = 16 piercing + 1d8 [5] = 5 acid → 21") */
export function doDmgRoll(key, label) {
  const r = rollDmg(key, (e) => rollExpr(e));
  if (!r) return;
  const part = (p) => (!p.rolls.length ? `${p.total} ${esc(p.type)}` // vaste schade ("1 piercing")
    : `${esc(p.e)} [${p.rolls.join(", ")}]${r.parts.length > 1 ? ` = ${p.total}` : " ="} ${r.parts.length > 1 ? "" : `<b>${p.total}</b> `}${esc(p.type)}`);
  toastHtml(`${label ? esc(label) + ": " : ""}${r.parts.map(part).join(" + ")}${r.parts.length > 1 ? ` → <b>${r.total}</b>` : ""}`);
}

/*
 * Statblock-paneel. Telefoon: half hoog boven de beurtbalk (Groot = bijna volledig); het volgt de beurt zodra de DM het
 * zelf geopend heeft, tot Sluit. Bij een spelersbeurt gaat het weg en komt het terug bij het volgende monster.
 * Tablet/desktop (zijkolom): altijd gevuld. In een gevecht volgt hij de beurt (monster: statblock, speler: sheet;
 * lair: blijft staan), tenzij vastgezet. Zonder gevecht: wat het laatst geopend of toegevoegd is, anders het eerste
 * monster. Handmatig geopend blijft staan tot de volgende beurtwissel.
 * Alleen UI: niets hiervan zit in de encounter, undo of opslag.
 */
const sb = {
  follow: false,   // telefoon: de DM opende het paneel zelf, dus volgen
  ref: null,       // naam van het getoonde monster (zelfde monster bij beurtwissel = scroll blijft)
  ed: undefined,   // G1: editie van het getoonde statblock (alleen geldig samen met ref)
  cid: null,       // id van de getoonde deelnemer (null = niets of placeholder)
  pc: false,       // getoonde deelnemer is een speler: live-blok bij elke render bijwerken
  live: "", turn: "", // laatst geschreven HTML van live-blok en beurtbalkje (alleen schrijven als het verandert)
  pin: false,      // desktop: vastgezet, een beurtwissel doet niets
  last: undefined, // laatst geziene actieve id
  open: undefined, // laatst geziene open kaart
  want: null,      // id die bij de volgende sync getoond moet worden (net toegevoegd monster)
  prev: null,      // desktop: naam van het monster in preview (nog niet toegevoegd), zolang het Monster-paneel open is
  drop: false,     // preview beëindigen bij de volgende sync (keuze valt buiten het filter)
  back: null,      // id die vóór de preview getoond werd (terug na sluiten van het paneel)
  args: null,      // laatste syncSB-argumenten (om bij draaien/venster breder direct te vullen)
  nk: null,        // tablet/desktop, speler zonder sheet: sleutel van het getekende Daarna/Nu-blok (alleen opnieuw tekenen als die verandert)
  nid: null,       // id van het monster in dat blok
};
const PHONE = matchMedia("(max-width:899px)");
export const phone = () => PHONE.matches; // ook voor Gevecht afronden (WP39): één bron voor de telefoongrens
// wisselen tussen telefoon en tablet/desktop (draaien, venster smaller): telefoon begint weer dicht, zonder volgen
PHONE.addEventListener?.("change", () => {
  sb.prev = null; sb.back = null; // preview bestaat alleen op tablet/desktop
  if (phone()) { sb.follow = false; setOpen(false); return; }
  sb.cid = null; sb.last = undefined;
  if (sb.args) syncSB(...sb.args);
});
const isOpen = () => $("#sbwrap").dataset.open === "true";

function open() { sb.follow = true; setOpen(true); bigBtn(); }
function setOpen(on) {
  $("#sbwrap").dataset.open = String(on);
  document.body.dataset.sb = on ? "open" : "";
  if (!on) $("#sbwrap").dataset.big = "false";
}
export function closeSB() { sb.follow = false; setOpen(false); }
export function toggleBigSB() {
  const w = $("#sbwrap");
  w.dataset.big = String(w.dataset.big !== "true");
  bigBtn();
}
function bigBtn() {
  const big = $("#sbwrap").dataset.big === "true", b = $("#sbbig");
  if (b) { b.textContent = t(big ? "init.sb.half" : "init.sb.big"); b.setAttribute("aria-pressed", big); }
}
/** Desktop: vastzetten aan/uit; los = meteen weer de beurt volgen */
export function togglePinSB() {
  sb.pin = !sb.pin;
  const b = $("#sbpin");
  if (b) { b.textContent = t(sb.pin ? "init.sb.pinned" : "init.sb.pin"); b.setAttribute("aria-pressed", sb.pin); }
  if (!sb.pin) sb.last = undefined; // los = meteen de beurt volgen; vast = balkje direct tonen
  if (sb.args) syncSB(...sb.args);
}
/** Balkje "Beurt: X →" (vastgezet): los en naar wie aan de beurt is */
export function followTurn() {
  sb.pin = false; sb.last = undefined;
  if (sb.args) syncSB(...sb.args);
}
/** Laat een deelnemer bij de volgende sync zien (net toegevoegd monster) */
export const wantSB = (id) => { sb.want = id; };
/** Tablet/desktop: gekozen monster in het Monster-paneel als preview in de zijkolom (niet op de telefoon, niet vastgezet) */
export function previewSB(m) {
  if (!m) { if (sb.prev && sb.args) { sb.drop = true; syncSB(...sb.args); } return; } // geen keuze meer: terug naar wat er stond
  if (phone() || sb.pin || sb.prev === m) return; // het statblock zelf: Zombie 2014 en 2024 hebben dezelfde naam
  if (!sb.prev) sb.back = sb.cid;
  sb.prev = m; sb.cid = null; sb.ref = null; sb.pc = false; sb.live = "";
  $("#sb").innerHTML = `<div class="sbhead"><div><h2>${esc(m.n)}${edTag(m)}</h2><div class="meta">${esc(m.meta || (m.custom ? t("init.sb.custom") : ""))}</div></div></div>
    <p class="sbprev">${esc(t("init.sb.preview"))}</p><hr>${sbBody(m)}`;
  $("#sb").scrollTop = 0;
  paintTurn(null);
}
export const isPhone = () => phone();
/** Bovenkant van het open paneel op de telefoon (voor scrollen: wat eronder valt is niet zichtbaar) */
export const sbTop = () => (phone() && isOpen() ? $("#sbwrap").getBoundingClientRect().top : Infinity);

const hasSB = (c) => c && c.kind === "monster" && c.ref && findMon(c.ref, c.ed);
const showable = (c) => hasSB(c) || (c && c.kind === "pc");
// getoonde deelnemer bestaat nog én is nog hetzelfde soort (import/undo kan dezelfde id met andere inhoud geven)
const still = (c) => (c && (sb.pc ? c.kind === "pc" : hasSB(c)?.n === sb.ref && cleanEd(c.ed) === sb.ed) ? c : null);
function show(c, chips, follow) {
  if (c.kind === "pc") showSheet(c, chips); else showSB(c, follow);
}

/**
 * Na elke render. chips(c) = conditie- en effect-chips (alleen tekst) uit render.js.
 * Doet weinig: alleen bij een beurtwissel, een andere open kaart of als het live-blok van een speler verandert.
 */
export function syncSB(S, openCard, chips) {
  sb.args = [S, openCard, chips];
  const a = S.round ? S.active : null, find = (id) => id && S.list.find((x) => x.id === id);
  const turned = a !== sb.last;
  sb.last = a;
  const opened = openCard !== sb.open;
  sb.open = openCard;
  const want = find(sb.want);
  sb.want = null;
  if (phone()) {
    if (turned && a && sb.follow) {
      const c = find(a);
      if (hasSB(c)) showSB(c, true);
      else if (isOpen()) setOpen(false); // follow blijft aan: terug bij het volgende monster
    }
    if (sb.pc && isOpen()) { const c = find(sb.cid); if (c) paintLive(c, chips); else closeSB(); }
    else if (isOpen() && sb.cid && !find(sb.cid)) closeSB(); // getoond monster is weg (verwijderd, volgende encounter)
    return;
  }
  let t = null, back = null;
  if (sb.prev) { // preview vóór toevoegen: blijft staan zolang het paneel open is en er niets anders gebeurt
    const prepOpen = !$("#psheet")?.hidden && !$("#f-mon")?.hidden; // Monster-paneel nog open (niet Speler of Party)
    if (prepOpen && !(turned && a) && !want && !opened && !sb.drop) return;
    sb.drop = false;
    back = find(sb.back);
    sb.prev = null; sb.back = null; sb.cid = null; sb.ref = null;
  }
  if (!sb.pin) {
    if (a) { if (turned) t = find(a); }
    else t = want || (opened ? find(openCard) : null); // net toegevoegd alleen buiten een gevecht: in een gevecht wint de beurt
    if (!showable(t)) t = null;
  }
  if (!t && showable(back)) t = back; // na de preview terug naar wat er stond (ook als de beurt naar een lair ging)
  if (!t && !still(find(sb.cid))) { // getoonde deelnemer weg (of nog niets): eerste monster, anders de eerste speler
    const L = sortOrder(S.list);
    t = L.find(hasSB) || L.find(showable) || null;
    if (!t) emptySB();
  }
  if (t && t.id !== sb.cid) {
    const keep = sb.pc && t.id === sb.nid ? bodyOff() : null; // DM las al vooruit in het Daarna-blok: leespositie houden
    show(t, chips, true);
    if (keep > 0) $("#sb").scrollTop = bodyTop() + keep;
  }
  const cur = still(find(sb.cid));
  if (cur && sb.pc) { paintLive(cur, chips); paintNext(S); }
  else if (cur) nameSB(cur);
  const at = sb.pin && a && a !== sb.cid ? find(a) : null;
  paintTurn(showable(at) ? at : null); // lair of monster zonder statblock: niets om naartoe te springen
}

/** Bovenkant van het statblock (.sbnb) binnen de scrollende kolom */
function bodyTop() {
  const box = $("#sb"), b = box.querySelector(".sbnb");
  return b ? b.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop : 0;
}
const bodyOff = () => ($("#sb .sbnb") ? $("#sb").scrollTop - bodyTop() : null);

/**
 * GV3, tablet/desktop: onder een speler zonder sheet het statblock van het monster dat nu of hierna aan de beurt is,
 * om vooruit te lezen (aanvallen klikbaar met het doelpaneel). Niet vastgezet, alleen in een gevecht.
 * Wordt bij elke sync berekend (gedood, toegevoegd, verborgen) maar alleen opnieuw getekend als het blok verandert.
 */
function paintNext(S) {
  const el = $("#sbnext");
  if (!el) return;
  const r = sb.pin ? null : readAhead(S, sortOrder(S.list), hasSB), m = r && hasSB(r.c);
  const key = m ? [r.now, r.c.id, r.n, r.c.name, m.n].join("|") : ""; // m.n: undo/import kan dezelfde id een ander statblock geven
  if (key === sb.nk) return;
  sb.nk = key; sb.nid = m ? r.c.id : null;
  const sub = r && r.n === 1 && r.c.name !== m.n ? ` · ${esc(r.c.name)}` : "";
  el.innerHTML = m ? `<hr><p class="sbprev">${esc(t(r.now ? "init.sb.now" : "init.sb.next"))}</p>
    <div class="sbhead"><div><h2>${esc(m.n)}${r.n > 1 ? ` ×${r.n}` : ""}${edTag(m)}</h2><div class="meta">${esc(m.meta || (m.custom ? t("init.sb.custom") : ""))}${sub}</div></div></div>
    <hr><div class="sbnb">${sbBody(m, r.c.id)}</div>` : "";
}

function emptySB() {
  if (sb.cid === null && sb.ref === null && !sb.pc && $("#sb .sbempty")) return;
  sb.cid = null; sb.ref = null; sb.pc = false; sb.live = ""; sb.prev = null;
  $("#sb").innerHTML = `<div class="sbempty empty">${esc(t("init.sb.empty"))}</div>`;
}
/** Naam van het getoonde monster bijwerken (na bewerken of Goblin 1 → 2) */
function nameSB(c) {
  const cn = $("#sbcname"), t = c.name && c.name !== sb.ref ? ` · ${c.name}` : "";
  if (cn && cn.textContent !== t) cn.textContent = t;
}
function paintTurn(c) {
  const html = c ? `<button class="sbturn" id="sbfollow">${esc(t("init.sb.turn"))} <b>${esc(c.name)}</b> <span aria-hidden="true">→</span></button>` : "";
  if (html === sb.turn) return;
  sb.turn = html;
  $("#sbturn").innerHTML = html;
}

const atkRef = (cid, k, v) => { const a = parseAction(k, v); return { cid, n: a.n, hit: a.hit }; };

/**
 * Statblock zonder kop. cid = deelnemer: aanvallen (acties, bonus, reactions, legendary) openen het doelpaneel;
 * zonder cid (preview vóór toevoegen) zijn alle worpen losse worpen. Traits en vrije tekst rollen altijd los.
 */
export function sbBody(m, cid = null) {
  const ent = (arr, atk) => arr.map(([k, v]) => `<p class="entry"><b><i>${esc(trName(k))}.</i></b> ${(/spellcasting/i.test(k) ? linkSpells : diceify)(v, atk && cid && atkRef(cid, k, v))}</p>`).join("");
  const ini = Number.isFinite(m.init) ? ` &nbsp; <span class="k">Initiative</span> ${esc(sgn(m.init))} (${10 + m.init})` : ""; // WP49: 2024-statblock "AC 8 Initiative −2 (8)"
  return `<p><span class="k">Armor Class</span> ${mdLite(esc(m.ac))}${ini}</p>
    <p><span class="k">Hit Points</span> ${n0(m.hp)}${m.hd ? ` (<button class="dice" data-roll="${esc(m.hd)}">${esc(m.hd.replace(/([+-])/, " $1 "))}</button>)` : ""}</p>
    ${m.spd ? `<p><span class="k">Speed</span> ${esc(m.spd)}</p>` : ""}
    ${m.ab ? `<hr>${abilRow(m.ab)}` : ""}
    <hr>${(m.x || []).map(([k, v]) => `<p><span class="k">${esc(k)}</span> ${diceify(v)}</p>`).join("")}
    ${m.cr ? `<p><span class="k">Challenge</span> ${esc(m.cr)}${m.xp || m.pb ? ` (${[m.xp && `${esc(i18n().num(n0(m.xp)))} XP`, m.pb && `PB ${esc(sgn(+m.pb))}`].filter(Boolean).join("; ")})` : ""}</p>` : ""}
    ${m.t && m.t.length ? `<hr>${ent(m.t)}` : ""}
    ${m.a && m.a.length ? `<h3>Actions</h3>${ent(m.a, true)}` : ""}
    ${m.ba && m.ba.length ? `<h3>Bonus Actions</h3>${ent(m.ba, true)}` : ""}
    ${m.re && m.re.length ? `<h3>Reactions</h3>${ent(m.re, true)}` : ""}
    ${m.l && m.l.length ? `<h3>Legendary Actions</h3>${m.ld ? `<p>${diceify(m.ld)}</p>` : ""}${ent(m.l, true)}` : ""}
    ${m.text ? `<hr><div class="pre">${diceify(m.text)}</div>` : ""}
    ${m.custom ? "" : `<p class="credit">${esc(t(monEd(m) === "2024" ? "init.sb.credit24" : "init.sb.credit"))}</p>`}`;
}

export function showSB(c, follow = false) {
  const m = findMon(c.ref, c.ed);
  if (!m) return;
  const cname = c.name;
  const same = follow && sb.ref === m.n && sb.ed === cleanEd(c.ed) && $("#sbcname"); // Zombie 2014 → 2024 is een ander statblock
  sb.cid = c.id; sb.pc = false; sb.live = ""; sb.prev = null;
  if (same) { // zelfde monster bij een beurtwissel (Goblin 1 → 2): alleen de naam en de aanvaller, scroll blijft
    nameSB(c);
    for (const b of $("#sb").querySelectorAll("[data-atk]")) b.dataset.cid = c.id;
    return open();
  }
  sb.ref = m.n; sb.ed = cleanEd(c.ed);
  $("#sb").innerHTML = `<div class="sbhead"><div><h2>${esc(m.n)}${edTag(m)}</h2><div class="meta">${esc(m.meta || (m.custom ? t("init.sb.custom") : ""))}<span id="sbcname">${cname && cname !== m.n ? ` · ${esc(cname)}` : ""}</span></div></div>
    ${headBtns()}</div><hr><div class="sbnb">${sbBody(m, c.id)}</div>`;
  $("#sb").scrollTop = 0;
  open();
}

/** Live-blok van een speler: alles wat tijdens het gevecht verandert. Alleen-lezen: bediening zit op de kaart. */
function liveHtml(c, chips) {
  const ac = effAc(c), br = acBreakdown(c), pt = pasText(passives(c));
  const d = c.ds || newDs();
  const ds = c.max && c.hp <= 0 ? (d.dead ? `<span class="bd r">${esc(t("init.card.dead"))}</span>` : d.stable ? `<span class="bd g">${esc(t("init.card.stable"))}</span>`
    : `<span class="bd r">${dsMini(n0(d.s), n0(d.f))}</span>`) : "";
  const k = c.casting, cnt = (l, o) => `<span class="cnt"><b>${esc(l)}</b> ${n0(o.left)}/${n0(o.max)}</span>`;
  const slots = k ? [...(k.pact ? [cnt(`Pact ${ORD[k.pact.lvl] || ""}`, k.pact)] : []), ...k.slots.map((x) => cnt(ORD[x.lvl] || "", x)), ...k.daily.flatMap((g) => g.items.map((it) => cnt(it.n, it)))] : [];
  const res = (c.res || []).map((r) => cnt(r.n, r));
  const tags = (chips ? chips(c) : "") + ds;
  return `<div class="livest">
      <div><span class="lk">AC</span><b class="${ac !== c.ac ? "acx" : ""}">${ac ? n0(ac) : "–"}</b></div>
      <div><span class="lk">HP</span><b>${c.max ? `${n0(c.hp)}/${n0(c.max)}` : "?"}</b>${c.temp ? ` <span class="thp">+${n0(c.temp)}</span>` : ""}</div>
      <div><span class="lk">Init</span><b>${c.init == null ? "–" : n0(c.init)}</b></div>
      <div><span class="lk">Dex</span><b>${sgn(n0(c.dex))}</b></div>
    </div>
    ${br ? `<p class="hint">AC: ${esc(br)}</p>` : ""}
    ${pt ? `<p class="cnts"><span class="k">Passive</span> ${esc(pt)}</p>` : ""}
    ${c.dr ? `<p class="cnts"><span class="k">Resistances</span> ${esc(drText(c.dr))}</p>` : ""}
    ${tags ? `<div class="badges">${tags}</div>` : ""}
    ${slots.length ? `<p class="cnts"><span class="k">Slots</span> ${slots.join("")}</p>` : ""}
    ${res.length ? `<p class="cnts"><span class="k">Resources</span> ${res.join("")}</p>` : ""}`;
}
function paintLive(c, chips) {
  const html = liveHtml(c, chips), el = $("#sblive");
  const nm = $("#sbpname");
  if (nm && nm.textContent !== c.name) nm.textContent = c.name;
  if (!el || html === sb.live) return;
  sb.live = html;
  el.innerHTML = html;
}

/** Speler: live-blok bovenaan, daaronder de statische sheet (D&D Beyond-link of PDF) als die er is */
export function showSheet(c, chips = sb.args && sb.args[2]) {
  const h = c.sheet;
  sb.cid = c.id; sb.ref = null; sb.pc = true; sb.prev = null; sb.nk = null; sb.nid = null;
  sb.live = liveHtml(c, chips);
  const dice = (s) => esc(s).replace(/(\d+d\d+(?:[+-]\d+)?)/g, '<button class="dice" data-roll="$1">$1</button>');
  const hitBtn = (b, l) => (/^[+-]\d+$/.test(b) ? `<button class="dice" data-roll="1d20${b}" data-hit="1" data-label="${esc(l)}">${b}</button>` : esc(b || ""));
  const roll = (v) => (/^[+-]\d+$/.test(v) ? v : "+0");
  const meta = [h && h.cls, c.race || (h && h.race)].filter(Boolean).join(" · ");
  $("#sb").innerHTML = `<div class="sbhead"><div><h2 id="sbpname">${esc(c.name)}</h2><div class="meta">${esc(meta || t("init.sb.pc"))}</div></div>
    ${headBtns()}</div><hr>
    <div id="sblive">${sb.live}</div>
    ${h ? `<hr>
    <p><span class="k">Speed</span> ${esc(h.speed)} &nbsp; <span class="k">Proficiency</span> ${esc(h.prof)}${h.max && h.max !== c.max ? ` &nbsp; <span class="k">Sheet-HP</span> ${n0(h.max)}` : ""}</p>
    <hr>${abilRow(h.ab || [])}<hr>
    <p><span class="k">Saving Throws</span> ${(h.saves || []).map(([n, v]) => `${esc(n)} <button class="dice" data-roll="1d20${roll(v)}" data-label="${esc(n)} save">${esc(v)}</button>`).join(", ")}</p>
    ${h.saveNotes ? `<p class="hint">${esc(h.saveNotes).replace(/\n/g, "; ")}</p>` : ""}
    <p><span class="k">Skills</span> ${(h.skills || []).map(([n, v]) => `${esc(n)} <button class="dice" data-roll="1d20${roll(v)}" data-label="${esc(n)}">${esc(v)}</button>`).join(", ")}</p>
    ${h.senses ? `<p><span class="k">Senses</span> ${esc(h.senses)}</p>` : ""}
    ${h.attacks && h.attacks.length ? `<h3>Attacks</h3>${h.attacks.map((a) => `<p class="entry"><b><i>${esc(a.n)}.</i></b> ${hitBtn(a.hit, a.n)} to hit, ${dice(a.dmg)}${a.notes ? ` <span class="hint">${esc(a.notes)}</span>` : ""}</p>`).join("")}` : ""}
    ${h.levels && h.levels.length ? `<h3>Spellcasting</h3><p>${h.spellAbility ? `${esc(h.spellAbility)} · ` : ""}${h.spellDC ? `save DC ${esc(h.spellDC)}` : ""}${h.spellAtk ? ` · spell attack ${hitBtn(h.spellAtk, "Spell attack")}` : ""}</p>
      ${h.levels.map((l) => `<p class="entry"><b><i>${l.lvl ? ORD[l.lvl] + " level" + (l.max ? ` (${n0(l.max)} slots)` : "") : "Cantrips"}.</i></b> ${(l.spells || []).map((sp) => `${sp.n ? spellLink(sp.n, sp.n, c.id) : ""}${sp.hit && sp.hit !== "--" ? ` <span class="hint">(${esc(sp.hit)})</span>` : ""}${/concentration/i.test(sp.dur) ? ` <span class="hint">conc.</span>` : ""}`).join(", ")}</p>`).join("")}` : ""}
    ${h.features ? `<h3>Features &amp; Actions</h3><details><summary class="link">${esc(t("init.sb.showAll"))}</summary><p class="entry">${dice(h.features)}</p></details>` : ""}
    <p class="credit">${esc(t("init.sb.ddb"))}</p>`
    : `<p class="hint sbnosheet">${esc(t("init.sb.noSheet"))}</p>${phone() ? "" : `<div id="sbnext"></div>`}`}`;
  $("#sb").scrollTop = 0;
  if (!h && sb.args) paintNext(sb.args[0]);
  open();
}

/* ---------- preview vóór toevoegen (Monster-paneel en snel toevoegen) ---------- */
const DEF = [["Damage Immunities", "init.card.defImm"], ["Damage Resistances", "init.card.defRes"], ["Damage Vulnerabilities", "init.sb.defVuln"]]; // sleutels
const PREV_MAX = 3;
/** Eén aanvalsregel als tekst: "Scimitar +4 · 1d6+2 slashing", "Fire Breath DC 15 DEX · 8d6 fire" */
const atkText = (a) => [a.n, a.hit !== null ? sgn(a.hit) : a.dc ? `DC ${a.dc.n} ${a.dc.ab}` : "",
  a.dmg.length ? "· " + a.dmg.map((x) => `${x.e || x.flat} ${x.type}`).join(" + ") : ""].filter(Boolean).join(" ");

/**
 * Compacte kaart om te kiezen: meta, AC/HP/speed/CR, verdediging, eerste aanvallen, traits op naam, tags.
 * Alleen-lezen. full: het volledige statblock eronder (telefoon, via de knop data-mpfull); toggle = toon die knop.
 */
export function monCard(m, full = false, toggle = true) {
  if (!m) return "";
  const A = monsterActions(m), lg = legInfo(m);
  const def = DEF.map(([k, l]) => { const x = (m.x || []).find(([n]) => n === k); return x ? `${t(l)}: ${x[1]}` : ""; }).filter(Boolean);
  const main = A ? A.main : [], more = main.length - PREV_MAX;
  const traits = (m.t || []).map(([k]) => trName(k)).filter((k) => !/^spellcasting/i.test(k));
  const tags = [lg.la ? `Legendary (${lg.la.max})` : "", castInfo(m) || (m.t || []).some(([k]) => /spellcasting/i.test(k)) ? "Spellcasting" : ""].filter(Boolean);
  const stats = [`AC ${parseInt(m.ac) || "?"}`, `HP ${n0(m.hp) || "?"}${m.hd ? ` (${m.hd})` : ""}`, m.spd, m.cr ? `CR ${m.cr}${m.xp ? ` (${i18n().num(n0(m.xp))} XP)` : ""}` : ""].filter(Boolean);
  return `<div class="mprev" aria-live="polite">
    <div class="mphead"><b>${esc(m.n)}${edTag(m)}</b><span>${esc(m.meta || (m.custom ? t("init.sb.custom") : ""))}</span></div>
    <p class="mpstat">${esc(stats.join(" · "))}</p>
    ${def.length ? `<p class="mpdef">${esc(def.join(" · "))}</p>` : ""}
    ${A && A.multi ? `<p class="mpmulti">${esc(A.multi.text)}</p>` : ""}
    ${main.slice(0, PREV_MAX).map((a) => `<p class="mpatk">${esc(atkText(a))}</p>`).join("")}
    ${more > 0 ? `<p class="mpmore">${esc(t("init.atk.more", { n: more }))}</p>` : ""}
    ${!A && m.text ? `<p class="mptext">${esc(m.text)}</p>` : ""}
    ${traits.length ? `<p class="mptraits">${esc(traits.join(" · "))}</p>` : ""}
    ${tags.length ? `<p class="mptags">${tags.map((x) => `<span class="tag m">${esc(x)}</span>`).join("")}</p>` : ""}
    ${toggle ? `<button type="button" class="link mpfull" data-mpfull aria-expanded="${full}">${esc(t(full ? "init.sb.less" : "init.sb.full"))} ${chev(full)}</button>` : ""}
    ${toggle && full ? `<div class="sbx">${sbBody(m)}</div>` : ""}
  </div>`;
}
