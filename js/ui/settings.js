// AF5 (1.33.1): Instellingen in inklapbare secties met een statusregel in de kop.
// Alleen UI: niets in undo of opslag. Open/dicht onthoudt de pagina zelf (het paneel staat statisch in index.html).
import { $ } from "./util.js";
import { kamerStat } from "./kamer.js";
import { nudgeState, exportDue, exportStat } from "../exportnudge.js";

const pressed = (sel) => $(sel)?.querySelector('[aria-pressed="true"]')?.textContent.trim() || "";

function setStat(key, t, warn = false, dot = false) {
  const el = document.querySelector(`[data-sstat="${key}"]`);
  if (!el) return;
  el.textContent = t;
  el.classList.toggle("warn", warn);
  el.classList.toggle("dot", dot);
}

/** Statusregels in de koppen bijwerken (na elke tik in het paneel, bij openen en als de kamer verandert) */
export function paintSetStat() {
  if (!$("#data-panel")) return;
  const r = pressed("#react-seg");
  setStat("look", [pressed("#theme-seg"), r && `Reaction: ${r.toLowerCase()}`].filter(Boolean).join(" · "));
  setStat("spells", pressed("#rules-seg"));
  const k = kamerStat();
  setStat("player", k.t, false, k.warn);
  setStat("help", "Rondleiding");
  const ns = nudgeState();
  setStat("store", exportStat(ns.exp), exportDue(ns));
}

/** Bij elke opening van ⚙: de sectie waarvoor de DM waarschijnlijk komt openzetten (andere niet dichtklappen) */
export function openSettings() {
  paintSetStat();
  const h = document.documentElement.classList, sec = (k) => document.querySelector(`.setsec[data-sec="${k}"]`);
  const kamer = h.contains("kamer-lost") || h.contains("kamer-pauze");
  if (kamer && sec("player")) sec("player").open = true;
  if (exportDue(nudgeState()) && sec("store")) sec("store").open = true;
  if (kamer) $("#kamer-box")?.scrollIntoView({ block: "nearest" });
}

export function bindSettings() {
  const p = $("#data-panel");
  if (!p) return;
  p.addEventListener("click", () => queueMicrotask(paintSetStat)); // na de handlers van de knoppen zelf
  document.addEventListener("it-kamer", paintSetStat);
}
