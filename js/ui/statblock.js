// Statblocks (monsters) en character sheets (spelers) in het zijpaneel, met klikbare dobbelstenen.
import { $, esc, n0, toastHtml } from "./util.js";
import { findMon } from "../data/monsters.js";
import { rollExpr, mod, sgn } from "../rules/dice.js";
import { ORD } from "../rules/spells.js";

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

const abilRow = (ab) => `<div class="abil">${["STR", "DEX", "CON", "INT", "WIS", "CHA"].map((k, i) =>
  `<button data-roll="1d20${sgn(mod(n0(ab[i])))}" data-label="${k} check"><b>${k}</b>${n0(ab[i])} (${sgn(mod(n0(ab[i])))})</button>`).join("")}</div>`;

function open() { $("#sbwrap").dataset.open = "true"; }

export function showSB(name, cname) {
  const m = findMon(name);
  if (!m) return;
  const ent = (arr) => arr.map(([k, v]) => `<p class="entry"><b><i>${esc(k)}.</i></b> ${diceify(v)}</p>`).join("");
  $("#sb").innerHTML = `<div class="sbhead"><div><h2>${esc(m.n)}</h2><div class="meta">${esc(m.meta || (m.custom ? "Eigen monster" : ""))}${cname && cname !== m.n ? ` · ${esc(cname)}` : ""}</div></div>
    <button class="btn small closebtn" id="sbclose">Sluit</button></div><hr>
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
  open();
}

export function showSheet(c) {
  const h = c.sheet;
  if (!h) return;
  const dice = (s) => esc(s).replace(/(\d+d\d+(?:[+-]\d+)?)/g, '<button class="dice" data-roll="$1">$1</button>');
  const hitBtn = (b, l) => (/^[+-]\d+$/.test(b) ? `<button class="dice" data-roll="1d20${b}" data-hit="1" data-label="${esc(l)}">${b}</button>` : esc(b || ""));
  const roll = (v) => (/^[+-]\d+$/.test(v) ? v : "+0");
  $("#sb").innerHTML = `<div class="sbhead"><div><h2>${esc(h.name)}</h2><div class="meta">${esc([h.cls, h.race].filter(Boolean).join(" · "))}</div></div>
    <button class="btn small closebtn" id="sbclose">Sluit</button></div><hr>
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
  open();
}
