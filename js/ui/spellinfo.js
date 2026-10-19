// Spell-uitleg: tik op een spellnaam (statblock, speler-sheet, spells op de kaart) → paneel #rsheet met de SRD-tekst.
// Alleen UI: niets hiervan zit in de encounter, undo of opslag. Data wordt bij de eerste tik geladen (js/data/spells.js).
import { $, esc } from "./util.js";
import { app } from "../state.js";
import { diceify } from "./statblock.js";
import { ORD } from "../rules/spells.js";
import { loadSpells, findSpell, spellSrc, normSpell, spellsLoaded } from "../data/spells.js";

let cur = null;   // { n: naam zoals getikt, cid: speler (terugval uit de sheet), err } of null
let from = null;  // knop die het paneel opende (focus terug bij sluiten)

export const spellOpen = () => !!cur;

export function openSpell(btn) {
  cur = { n: btn.dataset.spell, cid: btn.dataset.cid || "", err: "" };
  from = btn;
  paint();
  $("#rsheet .rsheet")?.focus();
  const want = cur;
  loadSpells().catch((e) => { want.err = e.message || "laden mislukt"; }).finally(() => { if (cur === want) paint(); });
}

export function closeSpell() {
  if (!cur) return;
  const n = cur.n;
  cur = null;
  const el = $("#rsheet");
  el.hidden = true; el.innerHTML = "";
  // de knop kan opnieuw getekend zijn (render): dan dezelfde naam zoeken
  const b = from && from.isConnected ? from : document.querySelector(`[data-spell="${CSS.escape(n)}"]`);
  from = null;
  b?.focus();
}

/** "2nd-level evocation" / "Evocation cantrip" */
const lvlText = (s) => (s.lv ? `${ORD[s.lv]}-level ${s.sch.toLowerCase()}` : `${s.sch} cantrip`);

/** Tekstblokken uit de data: alinea, { b, t } (vette aanloop) of { tbl } (tabel); worpen tikbaar met de spell als label */
function blocks(arr, label) {
  const dice = (t) => diceify(t).replaceAll('class="dice" data-roll=', () => `class="dice" data-label="${esc(label)}" data-roll=`); // functie: geen $-patronen
  return (arr || []).map((p) => {
    if (typeof p === "string") return `<p>${dice(p)}</p>`;
    if (p && p.tbl) {
      const [h, ...rows] = p.tbl;
      return `<div class="rtbl"><table><thead><tr>${h.map((x) => `<th>${esc(x)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${r.map((x) => `<td>${dice(x)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    }
    return p && p.b ? `<p><b><i>${esc(p.b)}</i></b> ${dice(p.t || "")}</p>` : "";
  }).join("");
}

const grid = (rows) => `<dl class="rgrid">${rows.filter(([, v]) => v).map(([k, v, wide]) =>
  `<div${wide ? ' class="w"' : ""}><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`;

/** Spell van de sheet van een speler (D&D Beyond), voor een spell die niet in de SRD staat */
function sheetSpell(cid, n) {
  const c = cid && app.S.list.find((x) => x.id === cid), k = normSpell(n);
  for (const l of (c && c.sheet && c.sheet.levels) || []) {
    const sp = (l.spells || []).find((x) => normSpell(x.n) === k);
    if (sp) return { ...sp, lvl: l.lvl };
  }
  return null;
}

function body(c) {
  const s = findSpell(c.n);
  if (s) {
    const aka = normSpell(c.n) !== normSpell(s.n) ? `<p class="hint raka">Ook bekend als ${esc(c.n)}</p>` : "";
    const m = s.c.match(/^([^(]*?)\s*\((.*)\)$/); // "V, S, M (materiaal)" → componenten en materiaal apart
    return { title: s.n, html: `<p class="rmeta">${esc(lvlText(s))}${s.conc ? ' <span class="tag m">Conc</span>' : ""}${s.rit ? ' <span class="tag">Ritual</span>' : ""}</p>${aka}
      ${grid([["Casting time", s.t, s.t.length > 24], ["Range", s.r], ["Components", m ? m[1] : s.c], ["Duration", s.d]])}
      ${m ? `<p class="hint rmat">${esc(m[2])}</p>` : ""}
      <div class="rtext">${blocks(s.x, s.n)}${s.h ? `<h4>At Higher Levels</h4>${blocks(s.h, s.n)}` : ""}</div>
      <p class="credit">Bron: ${esc(spellSrc())}.</p>` };
  }
  const sh = sheetSpell(c.cid, c.n);
  const q = `https://www.dndbeyond.com/spells?filter-search=${encodeURIComponent(c.n)}`;
  const state = c.err ? `<p class="hint">Spells konden niet geladen worden (${esc(c.err)}). Probeer het opnieuw als je online bent.</p>`
    : `<p class="hint">Deze spell staat niet in de SRD 5.1 (2014), dus de app heeft de tekst niet.</p>`;
  return { title: sh ? sh.n : c.n, html: `${sh ? `<p class="rmeta">${sh.lvl ? `${ORD[sh.lvl]}-level spell` : "Cantrip"}${/concentration/i.test(sh.dur || "") ? ' <span class="tag m">Conc</span>' : ""}</p>
      ${grid([["Casting time", sh.time], ["Range", sh.range], ["Duration", sh.dur], ["To hit / DC", sh.hit && sh.hit !== "--" ? sh.hit : ""], ["Notities", sh.notes, true]])}` : ""}
    ${state}<p><a class="btn small" href="${esc(q)}" target="_blank" rel="noopener noreferrer">Zoek op D&amp;D Beyond ↗</a></p>` };
}

function paint() {
  const el = $("#rsheet");
  if (!cur) { el.hidden = true; el.innerHTML = ""; return; }
  const loading = !cur.err && !spellsLoaded();
  const b = loading ? { title: cur.n, html: `<p class="hint">Laden…</p>` } : body(cur);
  const old = el.querySelector(".rsheet"), focused = old && old.contains(document.activeElement);
  el.innerHTML = `<div class="dim" data-rsh="close"></div>
    <div class="sheet qsheet rsheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="r-title">
      <div class="grab" aria-hidden="true"></div>
      <div class="shead rhead"><h3 id="r-title">${esc(b.title)}</h3><button type="button" class="link" data-rsh="close">Sluit</button></div>
      ${b.html}
    </div>`;
  el.hidden = false;
  if (focused) el.querySelector(".rsheet").focus();
}

/** Klikken in het paneel en op tikbare namen; true = afgehandeld */
export function spellClick(e) {
  if (e.target.closest('[data-rsh="close"]')) { closeSpell(); return true; }
  const b = e.target.closest("button[data-spell]");
  if (b) { openSpell(b); return true; }
  return false;
}
