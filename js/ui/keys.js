// Sneltoetsen (GV10, UX-keuze): N of spatie = Volgende, Shift+N = Vorige, "?" = overzicht.
// Alleen in Gevecht (niet Voorbereiden tijdens een gevecht), zonder open paneel, buiten invoervelden.
// De toets volgt altijd de knop in de beurtbalk (zelfde code, uit = niets). N start nooit een gevecht.
import { $ } from "./util.js";
import { mode } from "./render.js";

const panelOpen = () => !!document.querySelector(".sheet-wrap:not([hidden]), .tabstop, #qrfull");
export const MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
const MOD = MAC ? "⌘" : "Ctrl";

let back = null; // waar de focus heen gaat na sluiten

/** Afhandelen als het een sneltoets is; true = afgehandeld (geen verdere verwerking). typing = focus in een invoerveld. */
export function keysKey(e, typing) {
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return false;
  if (e.key === "?") {
    if (panelOpen()) return false;
    e.preventDefault(); openKeys(); return true;
  }
  const n = e.key === "n" || e.key === "N", sp = e.key === " ";
  if (!n && !sp) return false;
  if (mode() !== "fight" || panelOpen()) return false; // fight = er loopt een gevecht
  if (sp && e.target.closest?.("button, a, summary, [role=button]")) return false; // daar klikt spatie al
  if (sp && e.shiftKey) return false;
  e.preventDefault();
  if (e.repeat) return true; // ingedrukt houden slaat geen vijf beurten over
  const b = $(n && e.shiftKey ? "#prev" : "#next");
  if (b && !b.disabled) b.click();
  return true;
}

export const keysOpen = () => !$("#hsheet").hidden;

const kb = (...k) => k.map((x) => `<kbd>${x}</kbd>`).join(" ");
const ROWS = () => [
  [`${kb("N")} of ${kb("spatie")}`, "Volgende beurt"],
  [kb("Shift", "N"), "Vorige beurt"],
  [kb(MOD, "Z"), "Ongedaan maken"],
  [MAC ? kb("⌘", "Shift", "Z") : `${kb("Ctrl", "Y")} of ${kb("Ctrl", "Shift", "Z")}`, "Opnieuw (na Ongedaan)"],
  [kb("Esc"), "Paneel sluiten"],
  [`${kb("0")}–${kb("9")} en ${kb("Enter")}`, "Getal in het schade- en initiativepaneel"],
  [kb("?"), "Dit overzicht"],
];

export function openKeys() {
  const w = $("#hsheet");
  back = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
  w.innerHTML = `<div class="dim" data-keys="close"></div>
    <div class="sheet qsheet hsheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="h-title">
      <div class="grab" aria-hidden="true"></div>
      <div class="shead"><h3 id="h-title">Sneltoetsen</h3><button type="button" class="link" data-keys="close">Sluit</button></div>
      <dl class="keys">${ROWS().map(([k, t]) => `<dt>${k}</dt><dd>${t}</dd>`).join("")}</dl>
      <p class="hint">Volgende en Vorige werken in Gevecht, als er geen paneel open is en niet in een invoerveld.</p>
      <div class="ifoot one"><button type="button" class="btn" data-keys="close">Sluit</button></div>
    </div>`;
  w.hidden = false;
  w.querySelector(".hsheet").focus({ preventScroll: true });
}

export function closeKeys() {
  const w = $("#hsheet");
  if (w.hidden) return;
  w.hidden = true; w.innerHTML = "";
  const f = back && back.isConnected ? back : document.querySelector("#next") || document.querySelector("#start");
  back = null;
  f?.focus({ preventScroll: true });
}

export function bindKeys() {
  $("#hsheet").addEventListener("click", (e) => { if (e.target.closest("[data-keys=close]")) closeKeys(); });
}
