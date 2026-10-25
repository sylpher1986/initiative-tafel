// Spell-uitleg: tik op een spellnaam (statblock, speler-sheet, spells op de kaart) → paneel #rsheet met de SRD-tekst.
// Twee edities: SRD 5.1 (2014) en SRD 5.2 (2024). Het paneel opent op de instelling Spells (dezelfde die de regels bepaalt,
// js/ui/spellrules.js); staat de spell in beide, dan wisselt de schakelaar 2014 | 2024 alleen voor dit paneel. Rekent de app
// voor die spell anders per editie (rulesDiffer), dan zegt een regel dat je ter vergelijking leest.
// Alleen UI: niets hiervan zit in de encounter, undo of opslag. Data wordt bij de eerste tik geladen (js/data/spells.js).
import { $, esc } from "./util.js";
import { app } from "../state.js";
import { diceify } from "./statblock.js";
import { ORD } from "../rules/spells.js";
import { loadSpells, findSpell, spellSrc, normSpell, EDS, pickEd, spellsLoaded } from "../data/spells.js";
import { rulesDiffer } from "../rules/spellcast.js";
import { rulesEd } from "./spellrules.js";
import { edFor, sheetEd } from "../rules/spells.js";
import { t } from "../i18n/boot.js";

let cur = null;   // { n: naam zoals getikt, cid: speler (terugval uit de sheet), ed: gekozen editie (null = instelling Spells), busy, err } of null
let from = null;  // knop die het paneel opende (focus terug bij sluiten)

export const spellOpen = () => !!cur;

export function openSpell(btn) {
  cur = { n: btn.dataset.spell, cid: btn.dataset.cid || "", ed: null, busy: true, err: "" };
  from = btn;
  paint();
  $("#rsheet .rsheet")?.focus();
  const want = cur;
  // beide edities (elk één keer, uit de cache van de service worker); fout alleen als geen van beide laadt
  Promise.allSettled(EDS.map((e) => loadSpells(e))).then((r) => {
    want.busy = false;
    if (r.every((x) => x.status === "rejected")) want.err = r[0].reason?.message || t("init.spell.loadFail");
    if (cur === want) paint();
  });
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

/** 2014: "2nd-level evocation" / "Evocation cantrip"; 2024: "Level 2 Evocation" / "Evocation Cantrip" */
const lvlText = (s, ed) => (ed === "2024" ? (s.lv ? `Level ${s.lv} ${s.sch}` : `${s.sch} Cantrip`)
  : s.lv ? `${ORD[s.lv]}-level ${s.sch.toLowerCase()}` : `${s.sch} cantrip`);
/** Kop boven de tekst voor hogere levels, zoals in de SRD van die editie */
const higher = (s, ed) => (ed !== "2024" ? "At Higher Levels" : s.lv ? "Using a Higher-Level Spell Slot" : "Cantrip Upgrade");
const SRD = { 2014: "SRD 5.1 (2014)", 2024: "SRD 5.2 (2024)" };

/** Tekstblokken uit de data: alinea, { b, t } (vette aanloop) of { tbl } (tabel); worpen tikbaar met de spell als label */
function blocks(arr, label) {
  const dice = (x) => diceify(x).replaceAll('class="dice" data-roll=', () => `class="dice" data-label="${esc(label)}" data-roll=`); // functie: geen $-patronen
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
  // de app rekent met de editie op de sheet van de speler (als hij de spell daar heeft), anders met de instelling Spells
  const who = c.cid && app.S.list.find((x) => x.id === c.cid), pref = edFor(who, c.n, rulesEd());
  const { ed, eds } = pickEd(c.n, c.ed || pref), s = findSpell(c.n, ed);
  if (s) {
    // andere editie dan waarmee gerekend wordt: alleen een waarschuwing als de app voor deze spell echt anders rekent
    const calc = rulesDiffer(c.n) ? ` ${esc(sheetEd(who, c.n) ? t("init.spell.calcSheet", { ed: pref, name: who.name }) : t("init.spell.calc", { ed: pref }))}` : "";
    const only = ed === pref ? "" : !spellsLoaded(pref) ? `<p class="hint">${esc(t("init.spell.notLoaded", { a: SRD[pref], b: SRD[ed] }))}</p>`
      : eds.length === 1 ? `<p class="hint">${esc(t("init.spell.only", { src: SRD[ed] }))}${calc}</p>`
      : calc ? `<p class="rcmp">${esc(t("init.spell.cmp"))}${calc}</p>` : "";
    const aka = normSpell(c.n) !== normSpell(s.n) ? `<p class="hint raka">${esc(t("init.spell.aka", { name: c.n }))}</p>` : "";
    const m = s.c.match(/^([^(]*?)\s*\((.*)\)$/); // "V, S, M (materiaal)" → componenten en materiaal apart
    return { title: s.n, eds, ed, html: `<p class="rmeta">${esc(lvlText(s, ed))}${s.conc ? ' <span class="tag m">Conc</span>' : ""}${s.rit ? ' <span class="tag">Ritual</span>' : ""}</p>${aka}${only}
      ${grid([["Casting time", s.t, s.t.length > 24], ["Range", s.r], ["Components", m ? m[1] : s.c], ["Duration", s.d]])}
      ${m ? `<p class="hint rmat">${esc(m[2])}</p>` : ""}
      <div class="rtext">${blocks(s.x, s.n)}${s.h ? `<h4>${higher(s, ed)}</h4>${blocks(s.h, s.n)}` : ""}</div>
      <p class="credit">${esc(t("init.spell.src", { src: spellSrc(ed) }))}</p>` };
  }
  const sh = sheetSpell(c.cid, c.n);
  const q = `https://www.dndbeyond.com/spells?filter-search=${encodeURIComponent(c.n)}`;
  const state = c.err ? `<p class="hint">${esc(t("init.spell.err", { reason: c.err }))}</p>`
    : EDS.every((e) => spellsLoaded(e)) ? `<p class="hint">${esc(t("init.spell.noSrd"))}</p>`
    : `<p class="hint">${esc(t("init.spell.notFound", { a: EDS.filter((e) => spellsLoaded(e)).map((e) => SRD[e]), b: EDS.filter((e) => !spellsLoaded(e)).map((e) => SRD[e]) }))}</p>`;
  return { title: sh ? sh.n : c.n, html: `${sh ? `<p class="rmeta">${sh.lvl ? `${ORD[sh.lvl]}-level spell` : "Cantrip"}${/concentration/i.test(sh.dur || "") ? ' <span class="tag m">Conc</span>' : ""}</p>
      ${grid([["Casting time", sh.time], ["Range", sh.range], ["Duration", sh.dur], ["To hit / DC", sh.hit && sh.hit !== "--" ? sh.hit : ""], [esc(t("init.eff.note")), sh.notes, true]])}` : ""}
    ${state}<p><a class="btn small" href="${esc(q)}" target="_blank" rel="noopener noreferrer">${esc(t("init.spell.ddb"))}</a></p>` };
}

function paint() {
  const el = $("#rsheet");
  if (!cur) { el.hidden = true; el.innerHTML = ""; return; }
  const b = cur.busy ? { title: cur.n, html: `<p class="hint">${esc(t("init.spell.loading"))}</p>` } : body(cur);
  // schakelaar alleen als de spell in beide edities staat
  const sw = b.eds && b.eds.length > 1 ? `<div class="seg2 sm rsw" role="group" aria-label="${esc(t("init.spell.ed"))}">${b.eds.map((e) =>
    `<button type="button" data-red="${e}" aria-pressed="${e === b.ed}">${e}</button>`).join("")}</div>` : "";
  const old = el.querySelector(".rsheet"), focused = old && old.contains(document.activeElement);
  const onSw = focused && !!document.activeElement.closest(".rsw"); // focus alleen naar de schakelaar als hij daar al stond
  el.innerHTML = `<div class="dim" data-rsh="close"></div>
    <div class="sheet qsheet rsheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="r-title">
      <div class="grab" aria-hidden="true"></div>
      <div class="shead rhead"><h3 id="r-title">${esc(b.title)}</h3><button type="button" class="link" data-rsh="close">${esc(t("common.close"))}</button></div>
      ${sw}${b.html}
    </div>`;
  el.hidden = false;
  if (focused) ((onSw && el.querySelector(".rsw [aria-pressed=true]")) || el.querySelector(".rsheet")).focus();
}

/** Klikken in het paneel en op tikbare namen; true = afgehandeld */
export function spellClick(e) {
  if (e.target.closest('[data-rsh="close"]')) { closeSpell(); return true; }
  const r = e.target.closest("#rsheet [data-red]");
  if (r) { if (cur) { cur.ed = r.dataset.red; paint(); $("#rsheet .rsheet").scrollTop = 0; } return true; }
  const b = e.target.closest("button[data-spell]");
  if (b) { openSpell(b); return true; }
  return false;
}
