// Conditie-uitleg (RE10): tik op een conditiechip → paneel #csheet met de Nederlandse uitleg, duur, herhaalsave en bron.
// Gedeeld door de DM-app en het spelersscherm (speler.html); alleen UI, niets in de encounter, undo of opslag.
// Zelfde patroon als de spell-uitleg (#rsheet): Sluit bovenaan, achtergrond en Escape sluiten, focus terug naar de chip.
import { esc } from "./util.js";
import { t } from "../i18n/boot.js";
import { condInfo } from "../rules/conditions.js";

let cur = null;   // { key, cid } van de geopende chip
let from = null;  // knop die het paneel opende

export const condOpen = () => !!cur;

/**
 * Paneel openen. btn = de chip (data-cinfo = conditie, data-cid = deelnemer); info = { lvl, rows: [[label, waarde]] }.
 * Regels zonder waarde vallen weg; zonder uitleg in CINFO gebeurt er niets.
 */
export function openCond(btn, info = {}) {
  const key = btn.dataset.cinfo, ci = condInfo(key, info.lvl || 0);
  if (!ci) return false;
  cur = { key, cid: btn.dataset.cid || "" };
  from = btn;
  const el = document.getElementById("csheet");
  const rows = (info.rows || []).filter(([, v]) => v);
  el.innerHTML = `<div class="dim" data-csh="close"></div>
    <div class="sheet qsheet rsheet csheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="c-title">
      <div class="grab" aria-hidden="true"></div>
      <div class="shead rhead"><h3 id="c-title">${esc(ci.name)}</h3><button type="button" class="link" data-csh="close">${esc(t("common.close"))}</button></div>
      <div class="rtext">${ci.lines.map((l) => `<p>${esc(l)}</p>`).join("")}</div>
      ${rows.length ? `<dl class="cgrid">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""}
    </div>`;
  el.hidden = false;
  el.querySelector(".csheet").focus();
  return true;
}

export function closeCond() {
  if (!cur) return;
  const { key, cid } = cur;
  cur = null;
  const el = document.getElementById("csheet");
  el.hidden = true; el.innerHTML = "";
  // de chip kan opnieuw getekend zijn (render of nieuwe stand): dezelfde conditie bij dezelfde deelnemer zoeken
  const sel = `[data-cinfo="${CSS.escape(key)}"]${cid ? `[data-cid="${CSS.escape(cid)}"]` : ""}`;
  const b = from && from.isConnected ? from : document.querySelector(sel);
  from = null;
  b?.focus();
}

/** Klik in het paneel (sluiten); true = afgehandeld. Openen doet de aanroeper (die kent duur en bron). */
export function condSheetClick(e) {
  if (e.target.closest('[data-csh="close"]')) { closeCond(); return true; }
  return !!(cur && e.target.closest("#csheet"));
}
