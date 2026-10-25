// GV2: samenvatting bij Gevecht afronden (paneel #esheet) en de strook "Laatste gevecht" in Voorbereiden.
// Regels puur in js/rules/fight.js; de samenvatting staat in app.S.endSum (undo: Ongedaan na afronden laat het gevecht doorlopen).
import { $, esc, toast, toastHtml, toastBad, undoBtn } from "./util.js";
import { t, i18n } from "../i18n/boot.js";
import { ico, chev } from "./icons.js";
import { app, logAs, relog, because, stepNo } from "../state.js";
import { render, ui } from "./render.js";
import { findMon } from "../data/monsters.js";
import { endSummary, endCalc, endText, toggleFlip, byText, leftConds, wipeConds } from "../rules/fight.js";

const fmt = (n) => i18n().num(Math.round(n));
const downTxt = (k) => k.down.map((x) => (x.up ? t("init.end.upAgain", { name: x.name }) : x.name)).join(", ");
const roundsTxt = (es) => t("init.end.rounds", { n: es.r });

/** WP26: samenvatting voor het klembord in de taal van de app (het logboek houdt endText tot WP27) */
export function copyText(es) {
  const k = endCalc(es);
  const head = `${es.enc ? `${es.enc}: ` : `${t("init.end.title")}: `}${roundsTxt(es)}${es.min ? ` (± ${es.min} min)` : ""}`;
  const parts = [head, k.by.length ? `${t("init.end.beaten")} ${byText(k.by)}` : t("init.end.noneBeaten"),
    `${fmt(k.xp)} XP, ${k.share.length ? t("init.end.perPc", { xp: fmt(k.per), names: k.share.map((p) => p.name) }) : t("init.end.noShare")}`];
  if (k.noXp.length) parts.push(t("init.end.noXp", { names: k.noXp }));
  if (k.down.length) parts.push(`${t("init.end.down")} ${downTxt(k)}`);
  if (k.dead.length) parts.push(`${t("init.end.died")} ${k.dead.join(", ")}`);
  return parts.join(". ") + ".";
}

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
  return `<li class="sbanner endb"><span>${esc(t("init.end.last", { xp: fmt(endCalc(S.endSum).xp) }))}</span><button type="button" class="btn small" data-end="open">${esc(t("init.end.sum"))}</button></li>`;
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
  const line = (lbl, v) => (v ? `<p class="eln"><span>${esc(t(lbl))}</span> ${v}</p>` : "");
  el.innerHTML = `<div class="dim" data-end="close"></div>
    <div class="sheet qsheet esheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="e-title">
      <div class="grab" aria-hidden="true"></div>
      <div class="shead"><h3 id="e-title">${esc(t("init.end.title"))}</h3><button type="button" class="link" data-end="close">${esc(t("common.close"))}</button></div>
      <p class="esub">${es.enc ? `${esc(es.enc)} · ` : ""}${esc(roundsTxt(es))}${es.min ? ` · ± ${es.min} min` : ""}</p>
      <div class="etiles"><div><b>${fmt(k.xp)}</b><span>${esc(t("init.end.xpTotal"))}</span></div><div><b>${k.per == null ? "–" : fmt(k.per)}</b><span>${esc(k.share.length ? t("init.end.perN", { n: k.share.length }) : t("init.end.noShare"))}</span></div></div>
      ${line("init.end.beaten", k.by.length ? esc(byText(k.by)) : esc(t("init.end.nothing")))}
      ${k.noXp.length ? `<p class="hint">${esc(t("init.end.noXp", { names: k.noXp }))}</p>` : ""}
      ${alive.length ? `<details class="eflee" ${ui.endFlee ? "open" : ""}><summary>${esc(t("init.end.flee"))} ${chev(ui.endFlee)}</summary>
        <div class="echips">${alive.map((m) => chip(m.id, counted(m), m.label || m.name)).join("")}</div></details>` : ""}
      ${es.pcs.length ? `<p class="elbl">${esc(t("init.end.share"))}</p><div class="echips">${es.pcs.map((p) => chip(p.id, k.share.includes(p), p.dead ? t("init.end.deadName", { name: p.name }) : p.name)).join("")}</div>` : ""}
      ${line("init.end.down", esc(downTxt(k)))}
      ${k.dead.length ? line("init.end.died", esc(k.dead.join(", "))) : ""}
      ${condBlock()}
      <div class="ifoot"><button type="button" class="btn" data-end="copy">${esc(t("init.end.copy"))}</button>${app.S.list.some((c) => c.kind !== "pc") ? `<button type="button" class="btn primary" data-end="clear">${esc(t("init.end.clear"))}</button>` : ""}</div>
      <p class="hint">${esc(t("init.end.inLog"))}</p>
    </div>`;
  el.hidden = false;
  el.querySelector(".esheet").scrollTop = top;
}

function condBlock() {
  const L = condList(); if (!L.length) return "";
  const n = L.filter(picked).length;
  return `<p class="elbl">${esc(t("init.end.conds"))}</p><div class="echips">${L.map((x) => cchip(x, picked(x))).join("")}</div>
      <div class="bar"><button type="button" class="btn tap" data-end="wipe"${n ? "" : " disabled"}>${esc(t("init.end.wipe", { n }))}</button></div>`;
}

async function copy() {
  const txt = copyText(app.S.endSum);
  try { await navigator.clipboard.writeText(txt); toast(t("init.end.copied")); }
  catch { toastBad(t("init.end.copyFail")); }
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
      toastHtml(`${esc(t("init.end.wiped", { what: done }))} ${undoBtn()}`);
      $("#esheet .esheet")?.focus({ preventScroll: true });
      return;
    }
    if (a === "clear") { ui.end = false; resetMons(); ($("#start") || document.body).focus?.(); }
  });
}
