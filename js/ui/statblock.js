// Statblocks (monsters) en character sheets (spelers) in het zijpaneel, met klikbare dobbelstenen.
import { $, esc, n0, toastHtml } from "./util.js";
import { findMon } from "../data/monsters.js";
import { rollExpr, mod, sgn } from "../rules/dice.js";
import { ORD } from "../rules/spells.js";
import { rollDmg } from "../rules/attacks.js";

/** Tekst → HTML met klikbare "(2d6 + 3)", "+4 to hit" en losse "1d4" */
export function diceify(t) {
  return esc(t)
    .replace(/\((\d+d\d+(?:\s*[+−-]\s*\d+)?)\)/g, (m, e) => `(<button class="dice" data-roll="${e}">${e}</button>)`)
    .replace(/([+-]\d+) to hit/g, (m, b) => `<button class="dice" data-roll="1d20${b}" data-hit="1">${b} to hit</button>`)
    .replace(/\b(\d+d\d+)\b(?![^<]*<\/button>)(?![^<]*")/g, (m, e) => `<button class="dice" data-roll="${e}">${e}</button>`);
}

export function doRoll(expr, label, isHit) {
  const r = rollExpr(expr);
  if (!r) return;
  let extra = "";
  if (isHit && r.rolls[0] === 20) extra = ` <span class="crit">kritiek!</span>`;
  if (isHit && r.rolls[0] === 1) extra = ` <span class="fumble">misser</span>`;
  toastHtml(`${label ? esc(label) + ": " : ""}${esc(expr)} → [${r.rolls.join(", ")}]${r.mod ? ` ${sgn(r.mod)}` : ""} = <b>${r.total}</b>${extra}`);
}

const HEADBTNS = `<div class="sbbtns"><button class="btn small sbbig" id="sbbig" aria-pressed="false">Groot</button><button class="btn small closebtn" id="sbclose">Sluit</button></div>`;

const abilRow = (ab) => `<div class="abil">${["STR", "DEX", "CON", "INT", "WIS", "CHA"].map((k, i) =>
  `<button data-roll="1d20${sgn(mod(n0(ab[i])))}" data-label="${k} check"><b>${k}</b>${n0(ab[i])} (${sgn(mod(n0(ab[i])))})</button>`).join("")}</div>`;

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
 * Tablet/desktop (zijkolom): volgt altijd het monster aan de beurt; bij een spelersbeurt blijft het laatste staan.
 * Alleen UI: niets hiervan zit in de encounter, undo of opslag.
 */
const sb = { follow: false, ref: null, last: undefined };
const PHONE = matchMedia("(max-width:899px)");
const phone = () => PHONE.matches;
// wisselen tussen telefoon en tablet/desktop (draaien, venster smaller): telefoon begint weer dicht, zonder volgen
PHONE.addEventListener?.("change", () => { if (phone()) { sb.follow = false; setOpen(false); } });
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
  if (b) { b.textContent = big ? "Half" : "Groot"; b.setAttribute("aria-pressed", big); }
}
/** Bovenkant van het open paneel op de telefoon (voor scrollen: wat eronder valt is niet zichtbaar) */
export const sbTop = () => (phone() && isOpen() ? $("#sbwrap").getBoundingClientRect().top : Infinity);

/** Na elke render: alleen iets doen als de beurt wisselt */
export function syncSB(S) {
  const a = S.round ? S.active : null;
  if (a === sb.last) return;
  sb.last = a;
  if (!a || (phone() && !sb.follow)) return;
  const c = S.list.find((x) => x.id === a);
  if (c && c.kind === "monster" && c.ref && findMon(c.ref)) showSB(c.ref, c.name, true);
  else if (phone() && isOpen()) setOpen(false); // follow blijft aan: terug bij het volgende monster
}

export function showSB(name, cname, follow = false) {
  const m = findMon(name);
  if (!m) return;
  const cn = $("#sbcname");
  if (follow && sb.ref === m.n && cn) { // zelfde monster bij een beurtwissel (Goblin 1 → 2): alleen de naam, scroll blijft
    cn.textContent = cname && cname !== m.n ? ` · ${cname}` : "";
    return open();
  }
  sb.ref = m.n;
  const ent = (arr) => arr.map(([k, v]) => `<p class="entry"><b><i>${esc(k)}.</i></b> ${diceify(v)}</p>`).join("");
  $("#sb").innerHTML = `<div class="sbhead"><div><h2>${esc(m.n)}</h2><div class="meta">${esc(m.meta || (m.custom ? "Eigen monster" : ""))}<span id="sbcname">${cname && cname !== m.n ? ` · ${esc(cname)}` : ""}</span></div></div>
    ${HEADBTNS}</div><hr>
    <p><span class="k">Armor Class</span> ${esc(m.ac)}</p>
    <p><span class="k">Hit Points</span> ${n0(m.hp)}${m.hd ? ` (<button class="dice" data-roll="${esc(m.hd)}">${esc(m.hd.replace(/([+-])/, " $1 "))}</button>)` : ""}</p>
    ${m.spd ? `<p><span class="k">Speed</span> ${esc(m.spd)}</p>` : ""}
    ${m.ab ? `<hr>${abilRow(m.ab)}` : ""}
    <hr>${(m.x || []).map(([k, v]) => `<p><span class="k">${esc(k)}</span> ${diceify(v)}</p>`).join("")}
    ${m.cr ? `<p><span class="k">Challenge</span> ${esc(m.cr)}${m.xp ? ` (${n0(m.xp).toLocaleString("nl-NL")} XP)` : ""}</p>` : ""}
    ${m.t && m.t.length ? `<hr>${ent(m.t)}` : ""}
    ${m.a && m.a.length ? `<h3>Actions</h3>${ent(m.a)}` : ""}
    ${m.ba && m.ba.length ? `<h3>Bonus Actions</h3>${ent(m.ba)}` : ""}
    ${m.re && m.re.length ? `<h3>Reactions</h3>${ent(m.re)}` : ""}
    ${m.l && m.l.length ? `<h3>Legendary Actions</h3>${m.ld ? `<p>${diceify(m.ld)}</p>` : ""}${ent(m.l)}` : ""}
    ${m.text ? `<hr><div class="pre">${diceify(m.text)}</div>` : ""}
    ${m.custom ? "" : `<p class="credit">Bron: System Reference Document 5.1 (2014), Wizards of the Coast, CC-BY-4.0, via Open5e.</p>`}`;
  $("#sb").scrollTop = 0;
  open();
}

export function showSheet(c) {
  const h = c.sheet;
  if (!h) return;
  sb.ref = null;
  const dice = (s) => esc(s).replace(/(\d+d\d+(?:[+-]\d+)?)/g, '<button class="dice" data-roll="$1">$1</button>');
  const hitBtn = (b, l) => (/^[+-]\d+$/.test(b) ? `<button class="dice" data-roll="1d20${b}" data-hit="1" data-label="${esc(l)}">${b}</button>` : esc(b || ""));
  const roll = (v) => (/^[+-]\d+$/.test(v) ? v : "+0");
  $("#sb").innerHTML = `<div class="sbhead"><div><h2>${esc(h.name)}</h2><div class="meta">${esc([h.cls, h.race].filter(Boolean).join(" · "))}</div></div>
    ${HEADBTNS}</div><hr>
    <p><span class="k">Armor Class</span> ${n0(h.ac)} &nbsp; <span class="k">Hit Points</span> ${n0(h.max)} &nbsp; <span class="k">Initiative</span> ${sgn(n0(h.initBonus))}</p>
    <p><span class="k">Speed</span> ${esc(h.speed)} &nbsp; <span class="k">Proficiency</span> ${esc(h.prof)}</p>
    <hr>${abilRow(h.ab || [])}<hr>
    <p><span class="k">Saving Throws</span> ${(h.saves || []).map(([n, v]) => `${esc(n)} <button class="dice" data-roll="1d20${roll(v)}" data-label="${esc(n)} save">${esc(v)}</button>`).join(", ")}</p>
    ${h.saveNotes ? `<p class="hint">${esc(h.saveNotes).replace(/\n/g, "; ")}</p>` : ""}
    <p><span class="k">Skills</span> ${(h.skills || []).map(([n, v]) => `${esc(n)} <button class="dice" data-roll="1d20${roll(v)}" data-label="${esc(n)}">${esc(v)}</button>`).join(", ")}</p>
    ${h.senses ? `<p><span class="k">Senses</span> ${esc(h.senses)}</p>` : ""}
    ${h.attacks && h.attacks.length ? `<h3>Attacks</h3>${h.attacks.map((a) => `<p class="entry"><b><i>${esc(a.n)}.</i></b> ${hitBtn(a.hit, a.n)} to hit, ${dice(a.dmg)}${a.notes ? ` <span class="hint">${esc(a.notes)}</span>` : ""}</p>`).join("")}` : ""}
    ${h.levels && h.levels.length ? `<h3>Spellcasting</h3><p>${h.spellAbility ? `${esc(h.spellAbility)} · ` : ""}${h.spellDC ? `save DC ${esc(h.spellDC)}` : ""}${h.spellAtk ? ` · spell attack ${hitBtn(h.spellAtk, "Spell attack")}` : ""}</p>
      ${h.levels.map((l) => `<p class="entry"><b><i>${l.lvl ? ORD[l.lvl] + " level" + (l.max ? ` (${n0(l.max)} slots)` : "") : "Cantrips"}.</i></b> ${l.spells.map((sp) => `${esc(sp.n)}${sp.hit && sp.hit !== "--" ? ` <span class="hint">(${esc(sp.hit)})</span>` : ""}${/concentration/i.test(sp.dur) ? ` <span class="hint">conc.</span>` : ""}`).join(", ")}</p>`).join("")}` : ""}
    ${h.features ? `<h3>Features &amp; Actions</h3><details><summary class="link">Toon alles</summary><p class="entry">${dice(h.features)}</p></details>` : ""}
    <p class="credit">Geïmporteerd uit D&amp;D Beyond character sheet.</p>`;
  $("#sb").scrollTop = 0;
  open();
}
