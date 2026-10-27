// Spell-uitleg: tik op een spellnaam (statblock, speler-sheet, spells op de kaart) → paneel #rsheet met de SRD-tekst.
// Twee edities: SRD 5.1 (2014) en SRD 5.2 (2024). Het paneel opent op de instelling Spells (dezelfde die de regels bepaalt,
// js/ui/spellrules.js); staat de spell in beide, dan wisselt de schakelaar 2014 | 2024 alleen voor dit paneel. Rekent de app
// voor die spell anders per editie (rulesDiffer), dan zegt een regel dat je ter vergelijking leest.
// Alleen UI: niets hiervan zit in de encounter, undo of opslag. Data wordt bij de eerste tik geladen (js/data/spells.js).
import { $, esc, toast, toastBad, toastHtml, closeToast } from "./util.js";
import { app, saveSpellNotes } from "../state.js";
import { noteFor, setNote, NOTE_MAX } from "../data/spellnotes.js";
import { diceify } from "./statblock.js";
import { ORD } from "../rules/spells.js";
import { loadSpells, findSpell, spellSrc, normSpell, EDS, pickEd, spellsLoaded } from "../data/spells.js";
import { rulesDiffer } from "../rules/spellcast.js";
import { spellEd } from "./spellrules.js";
import { edFor, sheetEd } from "../rules/spells.js";
import { t } from "../i18n/boot.js";

let cur = null;   // { n: naam zoals getikt, cid: speler (terugval uit de sheet), ed: gekozen editie (null = instelling Spells), busy, err, edit, draft } of null
let from = null;  // knop die het paneel opende (focus terug bij sluiten)
let lastDel = null; // WP42: laatst gewiste notitie { n, t } voor de knop Undo in de melding (notities zitten niet in undo)
const NOTE_WARN = 400; // teller pas vanaf hier

export const spellOpen = () => !!cur;

export function openSpell(btn) {
  cur = { n: btn.dataset.spell, cid: btn.dataset.cid || "", ed: null, busy: true, err: "", edit: false, draft: "" };
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

/** WP42: notitie tonen (gebruikersinhoud: esc, regels via pre-wrap) */
const noteShow = (note) => `<div class="rnote"><div class="rnhead"><span class="rnlab">${esc(t("init.spell.note"))}</span>
  <button type="button" class="link" data-rnote="edit">${esc(t("init.spell.noteEdit"))}</button></div><div class="rntxt">${esc(note.t)}</div></div>`;
const count = (n) => (n >= NOTE_WARN ? `${n}/${NOTE_MAX}` : "");
/** WP42: bewerkstand; Delete alleen als er al een notitie is (leeg opslaan wist ook) */
const noteEdit = (c, has) => `<div class="rnote"><label class="rnlab" for="r-note">${esc(t("init.spell.note"))}</label>
  <textarea id="r-note" maxlength="${NOTE_MAX}" rows="4" placeholder="${esc(t("init.spell.notePh"))}">${esc(c.draft)}</textarea>
  <div class="bar rnbar"><button type="button" class="btn primary small" data-rnote="save">${esc(t("common.save"))}</button>
  <button type="button" class="btn small" data-rnote="cancel">${esc(t("common.cancel"))}</button>
  <span class="rncount" aria-live="polite">${count(c.draft.length)}</span>
  ${has ? `<button type="button" class="link rndel" data-rnote="del">${esc(t("init.spell.noteDel"))}</button>` : ""}</div></div>`;

function body(c) {
  // de app rekent met de editie op de sheet van de speler (als hij de spell daar heeft), anders met de instelling Spells
  const who = c.cid && app.S.list.find((x) => x.id === c.cid), pref = edFor(who, c.n, spellEd());
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
  // WP42: eigen notitie. Bestaande altijd tonen (ook offline: staat los van de spelldata); toevoegen alleen als beide
  // edities geladen zijn, want alleen dan staat vast dat de spell niet in de SRD staat.
  const note = noteFor(app.spellNotes, c.n), all = !c.err && EDS.every((e) => spellsLoaded(e));
  const state = c.err ? `<p class="hint">${esc(t("init.spell.err", { reason: c.err }))}</p>`
    : all ? (note || c.edit ? "" : `<p class="hint">${esc(t("init.spell.noSrd"))}</p>`)
    : `<p class="hint">${esc(t("init.spell.notFound", { a: EDS.filter((e) => spellsLoaded(e)).map((e) => SRD[e]), b: EDS.filter((e) => !spellsLoaded(e)).map((e) => SRD[e]) }))}</p>`;
  const nb = c.edit ? noteEdit(c, !!note) : note ? noteShow(note) : all ? `<p><button type="button" class="btn small" data-rnote="add">${esc(t("init.spell.noteAdd"))}</button></p>` : "";
  return { title: sh ? sh.n : c.n, html: `${sh ? `<p class="rmeta">${sh.lvl ? `${ORD[sh.lvl]}-level spell` : "Cantrip"}${/concentration/i.test(sh.dur || "") ? ' <span class="tag m">Conc</span>' : ""}</p>
      ${grid([["Casting time", sh.time], ["Range", sh.range], ["Duration", sh.dur], ["To hit / DC", sh.hit && sh.hit !== "--" ? sh.hit : ""], [esc(t("init.eff.note")), sh.notes, true]])}` : ""}
    ${nb}${state}<p><a class="btn small" href="${esc(q)}" target="_blank" rel="noopener noreferrer">${esc(t("init.spell.ddb"))}</a></p>` };
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
  const ta = el.querySelector("#r-note");
  if (ta) ta.addEventListener("input", () => { if (cur) { cur.draft = ta.value; el.querySelector(".rncount").textContent = count(ta.value.length); } });
  if (focused) ((onSw && el.querySelector(".rsw [aria-pressed=true]")) || el.querySelector(".rsheet")).focus();
}

/** Display-naam voor de notitie: zoals de sheet hem schrijft, anders zoals getikt */
const noteName = (c) => sheetSpell(c.cid, c.n)?.n || c.n;

/** WP42: knoppen van de notitie. Focus: textarea bij openen (in de tik zelf, anders geen toetsenbord op iOS), daarna terug. */
function noteAct(a) {
  const c = cur;
  if (a === "add" || a === "edit") {
    c.edit = true; c.draft = noteFor(app.spellNotes, c.n)?.t || ""; paint();
    const ta = $("#r-note");
    if (ta) { ta.focus({ preventScroll: true }); ta.setSelectionRange(ta.value.length, ta.value.length); ta.scrollIntoView({ block: "nearest" }); }
    return;
  }
  const old = noteFor(app.spellNotes, c.n);
  if (a === "save" || a === "del") {
    const text = a === "del" ? "" : ($("#r-note")?.value ?? c.draft);
    const next = setNote(app.spellNotes, noteName(c), text);
    if (next === app.spellNotes && text.trim() && !old) { c.draft = text; toastBad(t("init.spell.noteFull")); return; } // maximum aantal: bewerkstand en tekst blijven
    if (next !== app.spellNotes && old?.t !== text.trim()) { app.spellNotes = next; saveSpellNotes(); } // ongewijzigd: niet opslaan (exportherinnering)
    c.edit = false; c.draft = ""; paint(); focusNote();
    if (old && !noteFor(app.spellNotes, c.n)) { // gewist (ook leeg opslaan): eigen Undo, want Ongedaan in de beurtbalk zet een notitie niet terug
      lastDel = { ...old };
      toastHtml(`${esc(t("init.spell.noteGone"))} <button class="tundo" id="toast-noteundo">${esc(t("common.undo"))}</button>`);
    }
    return;
  }
  c.edit = false; c.draft = ""; paint(); focusNote(); // cancel
}
const focusNote = () => ($('#rsheet [data-rnote="edit"]') || $('#rsheet [data-rnote="add"]') || $("#rsheet .rsheet"))?.focus();

/** Na een import: Undo van een eerder gewiste notitie mag niet in de nieuwe set terechtkomen */
export const resetNoteUndo = () => { lastDel = null; };

/** Escape tijdens bewerken: alleen de bewerkstand sluiten (true = afgehandeld) */
export function spellEsc() {
  if (!cur || !cur.edit) return false;
  noteAct("cancel");
  return true;
}

/** Klikken in het paneel en op tikbare namen; true = afgehandeld */
export function spellClick(e) {
  if (e.target.closest('[data-rsh="close"]')) { closeSpell(); return true; }
  const nt = e.target.closest("#rsheet [data-rnote]");
  if (nt) { if (cur) noteAct(nt.dataset.rnote); return true; }
  if (e.target.closest("#toast-noteundo")) {
    const back = !!lastDel && !noteFor(app.spellNotes, lastDel.n);
    if (back) { app.spellNotes = setNote(app.spellNotes, lastDel.n, lastDel.t); saveSpellNotes(); }
    lastDel = null; closeToast();
    if (back) toast(t("init.spell.noteBack"));
    if (cur && !cur.edit) paint();
    return true;
  }
  const r = e.target.closest("#rsheet [data-red]");
  if (r) { if (cur) { cur.ed = r.dataset.red; paint(); $("#rsheet .rsheet").scrollTop = 0; } return true; }
  const b = e.target.closest("button[data-spell]");
  if (b) { openSpell(b); return true; }
  return false;
}
