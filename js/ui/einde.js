// GV2: samenvatting bij Gevecht afronden (paneel #esheet) en de strook "Laatste gevecht" in Voorbereiden.
// Regels puur in js/rules/fight.js; de samenvatting staat in app.S.endSum (undo: Ongedaan na afronden laat het gevecht doorlopen).
import { $, esc, toast } from "./util.js";
import { app, logAs, relog } from "../state.js";
import { render, ui } from "./render.js";
import { findMon } from "../data/monsters.js";
import { endSummary, endCalc, endText, toggleFlip, byText } from "../rules/fight.js";

const fmt = (n) => Math.round(n).toLocaleString("nl-NL");

/** Vóór stopCombat: samenvatting vastleggen en de logregel klaarzetten (zelfde undo-stap als het stoppen) */
export function finishFight() {
  const S = app.S;
  S.endSum = endSummary(S, findMon, Date.now());
  delete S.fight;
  logAs(endText(S.endSum), "end");
  ui.end = true;
}

/** Strook in Voorbereiden na het afronden; weg bij Start gevecht of monsters wissen */
export function endBanner(S, calm) {
  if (!calm || !S.endSum) return "";
  return `<li class="sbanner endb"><span>Laatste gevecht · ${fmt(endCalc(S.endSum).xp)} XP</span><button type="button" class="btn small" data-end="open">Samenvatting</button></li>`;
}

const chip = (id, on, label) => `<button type="button" class="echip" data-end="flip" data-id="${esc(id)}" aria-pressed="${on}">${on ? "✓ " : "+ "}${esc(label)}</button>`;

export function paintEnd() {
  const el = $("#esheet"), es = app.S.endSum;
  if (!ui.end || !es || app.S.round) { ui.end = false; el.hidden = true; el.innerHTML = ""; return; }
  const k = endCalc(es), fl = new Set(es.flip || []);
  const won = es.mons.filter((m) => m.out), alive = es.mons.filter((m) => !m.out);
  const counted = (m) => m.out !== fl.has(m.id);
  const old = el.querySelector(".esheet"), top = old ? old.scrollTop : 0;
  const line = (lbl, v) => (v ? `<p class="eln"><span>${lbl}</span> ${v}</p>` : "");
  const flipOff = won.filter((m) => !counted(m)); // op 0 HP maar niet meegeteld (bijv. bewusteloos geslagen en vrijgelaten)
  el.innerHTML = `<div class="dim" data-end="close"></div>
    <div class="sheet qsheet esheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="e-title">
      <div class="grab" aria-hidden="true"></div>
      <div class="shead"><h3 id="e-title">Gevecht afgerond</h3><button type="button" class="link" data-end="close">Sluit</button></div>
      <p class="esub">${es.enc ? `${esc(es.enc)} · ` : ""}${es.r} ${es.r === 1 ? "ronde" : "rondes"}${es.min ? ` · ± ${es.min} min` : ""}</p>
      <div class="etiles"><div><b>${fmt(k.xp)}</b><span>XP totaal</span></div><div><b>${k.per == null ? "–" : fmt(k.per)}</b><span>${k.share.length ? `per speler (${k.share.length})` : "niemand deelt"}</span></div></div>
      ${line("Verslagen:", k.by.length ? esc(byText(k.by)) : "niets")}
      ${k.noXp.length ? `<p class="hint">Zonder CR niet geteld: ${esc(k.noXp.join(", "))}</p>` : ""}
      ${alive.length || flipOff.length ? `<details class="eflee" ${ui.endFlee || alive.some(counted) || flipOff.length ? "open" : ""}><summary>Gevlucht of overgegeven? Tel mee</summary>
        <div class="echips">${[...alive, ...won.filter((m) => fl.has(m.id))].map((m) => chip(m.id, counted(m), nm(m))).join("")}</div></details>` : ""}
      ${es.pcs.length ? `<p class="elbl">Delen</p><div class="echips">${es.pcs.map((p) => chip(p.id, k.share.includes(p), `${p.name}${p.dead ? " (dood)" : ""}`)).join("")}</div>` : ""}
      ${line("Neer geweest:", esc(k.down.map((x) => `${x.name}${x.up ? " (stond weer op)" : ""}`).join(", ")))}
      ${k.dead.length ? line("Gestorven:", esc(k.dead.join(", "))) : ""}
      <div class="ifoot"><button type="button" class="btn" data-end="copy">Kopieer samenvatting</button>${app.S.list.some((c) => c.kind !== "pc") ? `<button type="button" class="btn primary" data-end="clear">Monsters wissen</button>` : ""}</div>
      <p class="hint">De samenvatting staat ook in het logboek.</p>
    </div>`;
  el.hidden = false;
  el.querySelector(".esheet").scrollTop = top;
}
/** Naam op de chip: de echte naam (Goblin 3), niet de soort */
const nm = (m) => (app.S.list.find((c) => c.id === m.id) || {}).name || m.name;

async function copy() {
  const t = endText(app.S.endSum);
  try { await navigator.clipboard.writeText(t); toast("Samenvatting gekopieerd."); }
  catch { toast("Kopiëren lukt niet in deze browser. De samenvatting staat ook in het logboek."); }
}

export function bindEnd(resetMons) {
  document.addEventListener("click", (e) => {
    if (e.target.closest(".eflee summary")) { ui.endFlee = !e.target.closest("details").open; return; }
    const b = e.target.closest("[data-end]"); if (!b) return;
    const a = b.dataset.end, es = app.S.endSum;
    if (a === "open") { ui.end = true; render(); $("#esheet .esheet")?.focus(); return; }
    if (a === "close") { ui.end = false; render(); return; }
    if (!es) return;
    if (a === "flip") { toggleFlip(es, b.dataset.id); relog("end", endText(es)); render(); $("#esheet .esheet")?.focus({ preventScroll: true }); return; }
    if (a === "copy") { copy(); return; }
    if (a === "clear") { ui.end = false; resetMons(); }
  });
}
