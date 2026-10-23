// GV2: samenvatting bij Gevecht afronden (paneel #esheet) en de strook "Laatste gevecht" in Voorbereiden.
// Regels puur in js/rules/fight.js; de samenvatting staat in app.S.endSum (undo: Ongedaan na afronden laat het gevecht doorlopen).
import { $, esc, toast, toastHtml, toastBad } from "./util.js";
import { ico, chev } from "./icons.js";
import { app, logAs, relog, because, stepNo } from "../state.js";
import { render, ui } from "./render.js";
import { findMon } from "../data/monsters.js";
import { endSummary, endCalc, endText, toggleFlip, byText, leftConds, wipeConds } from "../rules/fight.js";

const fmt = (n) => Math.round(n).toLocaleString("nl-NL");

/** Vóór stopCombat: samenvatting vastleggen en de logregel klaarzetten (zelfde undo-stap als het stoppen) */
export function finishFight() {
  const S = app.S;
  S.endSum = endSummary(S, findMon, Date.now());
  delete S.fight;
  logAs(endText(S.endSum), "end");
  ui.end = true; ui.endPick = {}; ui.condDone = null;
}

/** Strook in Voorbereiden na het afronden; weg bij Start gevecht of monsters wissen */
export function endBanner(S, calm) {
  if (!calm || !S.endSum) return "";
  return `<li class="sbanner endb"><span>Laatste gevecht · ${fmt(endCalc(S.endSum).xp)} XP</span><button type="button" class="btn small" data-end="open">Samenvatting</button></li>`;
}

/** GV7: condities van spelers (standaard aan: Prone/Grappled/Restrained en condities met een duur) */
const cchip = (x, on) => `<button type="button" class="echip" data-end="cpick" data-k="${esc(x.k)}" aria-pressed="${on}">${on ? ico("check") : ico("plus")}${esc(`${x.name}: ${x.cond}`)}</button>`;
const picked = (x) => (ui.endPick || {})[x.k] ?? x.on;
const condList = () => (ui.condDone === stepNo() ? [] : leftConds(app.S.list)); // na Wis: weg, tot er een stap (Ongedaan) bij komt
const chip = (id, on, label) => `<button type="button" class="echip" data-end="flip" data-id="${esc(id)}" aria-pressed="${on}">${on ? ico("check") : ico("plus")}${esc(label)}</button>`;

export function paintEnd() {
  const el = $("#esheet"), es = app.S.endSum;
  // na Ongedaan van het afronden (gevecht loopt weer) of monsters wissen: paneel dicht (ui is UI-toestand, geen data)
  if (!ui.end || !es || app.S.round) { ui.end = false; if (!el.hidden) { el.hidden = true; el.innerHTML = ""; } return; }
  const k = endCalc(es), fl = new Set(es.flip || []);
  const alive = es.mons.filter((m) => !m.out), counted = (m) => fl.has(m.id);
  const old = el.querySelector(".esheet"), top = old ? old.scrollTop : 0;
  const line = (lbl, v) => (v ? `<p class="eln"><span>${lbl}</span> ${v}</p>` : "");
  el.innerHTML = `<div class="dim" data-end="close"></div>
    <div class="sheet qsheet esheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="e-title">
      <div class="grab" aria-hidden="true"></div>
      <div class="shead"><h3 id="e-title">Gevecht afgerond</h3><button type="button" class="link" data-end="close">Sluit</button></div>
      <p class="esub">${es.enc ? `${esc(es.enc)} · ` : ""}${es.r} ${es.r === 1 ? "ronde" : "rondes"}${es.min ? ` · ± ${es.min} min` : ""}</p>
      <div class="etiles"><div><b>${fmt(k.xp)}</b><span>XP totaal</span></div><div><b>${k.per == null ? "–" : fmt(k.per)}</b><span>${k.share.length ? `per speler (${k.share.length})` : "niemand deelt"}</span></div></div>
      ${line("Verslagen:", k.by.length ? esc(byText(k.by)) : "niets")}
      ${k.noXp.length ? `<p class="hint">Zonder CR of statblock niet geteld: ${esc(k.noXp.join(", "))}</p>` : ""}
      ${alive.length ? `<details class="eflee" ${ui.endFlee ? "open" : ""}><summary>Gevlucht of overgegeven? Tel mee ${chev(ui.endFlee)}</summary>
        <div class="echips">${alive.map((m) => chip(m.id, counted(m), m.label || m.name)).join("")}</div></details>` : ""}
      ${es.pcs.length ? `<p class="elbl">Delen</p><div class="echips">${es.pcs.map((p) => chip(p.id, k.share.includes(p), `${p.name}${p.dead ? " (dood)" : ""}`)).join("")}</div>` : ""}
      ${line("Neer geweest:", esc(k.down.map((x) => `${x.name}${x.up ? " (stond weer op)" : ""}`).join(", ")))}
      ${k.dead.length ? line("Gestorven:", esc(k.dead.join(", "))) : ""}
      ${condBlock()}
      <div class="ifoot"><button type="button" class="btn" data-end="copy">Kopieer samenvatting</button>${app.S.list.some((c) => c.kind !== "pc") ? `<button type="button" class="btn primary" data-end="clear">Monsters wissen</button>` : ""}</div>
      <p class="hint">De samenvatting staat ook in het logboek.</p>
    </div>`;
  el.hidden = false;
  el.querySelector(".esheet").scrollTop = top;
}

function condBlock() {
  const L = condList(); if (!L.length) return "";
  const n = L.filter(picked).length;
  return `<p class="elbl">Condities van spelers</p><div class="echips">${L.map((x) => cchip(x, picked(x))).join("")}</div>
      <div class="bar"><button type="button" class="btn tap" data-end="wipe"${n ? "" : " disabled"}>Wis gekozen (${n})</button></div>`;
}

async function copy() {
  const t = endText(app.S.endSum);
  try { await navigator.clipboard.writeText(t); toast("Samenvatting gekopieerd."); }
  catch { toastBad("Kopiëren lukt niet in deze browser. De samenvatting staat ook in het logboek."); }
}

/** Sluit, Escape, achtergrond: focus terug naar de strook "Laatste gevecht", anders Start gevecht */
export function closeEnd() {
  ui.end = false; render();
  ($('[data-end="open"]') || $("#start"))?.focus({ preventScroll: true });
}

export function bindEnd(resetMons) {
  document.addEventListener("click", (e) => {
    if (e.target.closest(".eflee summary")) { e.preventDefault(); ui.endFlee = !ui.endFlee; render(); return; }
    const b = e.target.closest("[data-end]"); if (!b) return;
    const a = b.dataset.end, es = app.S.endSum;
    if (a === "open") { ui.end = true; ui.condDone = null; render(); $("#esheet .esheet")?.focus(); return; }
    if (a === "close") { closeEnd(); return; }
    if (!es) return;
    if (a === "flip") { toggleFlip(es, b.dataset.id); relog("end", endText(es)); render(); $("#esheet .esheet")?.focus({ preventScroll: true }); return; }
    if (a === "copy") { copy(); return; }
    if (a === "cpick") { // UI-keuze, geen undo-stap
      const x = condList().find((y) => y.k === b.dataset.k); if (!x) return;
      ui.endPick = { ...(ui.endPick || {}), [x.k]: !picked(x) };
      render(); $(`#esheet [data-end="cpick"][data-k="${CSS.escape(x.k)}"]`)?.focus({ preventScroll: true });
      return;
    }
    if (a === "wipe") { // één eigen undo-stap; het logboek noemt per speler "Prone voorbij" met deze reden
      const keys = condList().filter(picked).map((x) => x.k); if (!keys.length) return;
      because("na het gevecht gewist");
      const done = wipeConds(app.S.list, keys);
      render(); ui.condDone = stepNo(); paintEnd();
      toastHtml(`${esc(`Gewist: ${done.join(", ")}.`)} <button class="tundo" id="toast-undo">Ongedaan</button>`);
      $("#esheet .esheet")?.focus({ preventScroll: true });
      return;
    }
    if (a === "clear") { ui.end = false; resetMons(); ($("#start") || document.body).focus?.(); }
  });
}
