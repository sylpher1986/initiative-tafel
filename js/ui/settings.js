// AF5 (1.33.1): Instellingen in inklapbare secties met een statusregel in de kop.
// Alleen UI: niets in undo of opslag. Open/dicht onthoudt de pagina zelf (het paneel staat statisch in index.html).
import { $ } from "./util.js";
import { kamerStat } from "./kamer.js";
import { nudgeState, exportDue, exportStat } from "../exportnudge.js";
import { mountLangPick, pageLang } from "./langpick.js";
import { t } from "../i18n/boot.js";

/** Ingedrukte knop in een seg: de waarde uit zijn data-attribuut (niet de tekst: die verschilt per taal, dev-review WP23) */
const pressedVal = (sel, attr) => $(sel)?.querySelector('[aria-pressed="true"]')?.getAttribute(attr) || "";
const THEME_K = { system: "init.set.system", light: "init.set.light", dark: "init.set.dark" };
const themeTxt = () => { const k = THEME_K[pressedVal("#theme-seg", "data-theme-set")]; return k ? t(k) : ""; };
/** Reaction in de statusregel: "Reaction: knop" / "Reaction: spelers zelf" (kleine letters, eigen sleutel per taal) */
const reactTxt = () => { const v = pressedVal("#react-seg", "data-react"); return v ? t(v === "off" ? "init.set.reactStatOff" : "init.set.reactStatOn") : ""; };

function setStat(key, txt, warn = false, dot = false) {
  const el = document.querySelector(`[data-sstat="${key}"]`);
  if (!el) return;
  el.textContent = txt;
  el.classList.toggle("warn", warn);
  el.classList.toggle("dot", dot);
}

/** Statusregels in de koppen bijwerken (na elke tik in het paneel, bij openen en als de kamer verandert) */
export function paintSetStat() {
  if (!$("#data-panel")) return;
  const r = reactTxt();
  if (langOn) { // WP22 (UX-agent): thema · taal (in haar eigen taal), Reaction alleen bij "Spelers zelf" (anders te breed op 320 px)
    const el = document.querySelector('[data-sstat="look"]'), l = pageLang(), th = themeTxt();
    if (el) {
      const s = document.createElement("span");
      s.lang = l; s.textContent = t(`common.lang.${l}`);
      const off = pressedVal("#react-seg", "data-react") === "off";
      el.replaceChildren(...[th && `${th} · `, s, off && r && ` · ${r}`].filter(Boolean));
      el.classList.remove("warn", "dot");
    }
  } else setStat("look", [themeTxt(), r].filter(Boolean).join(" · "));
  setStat("spells", pressedVal("#rules-seg", "data-rules"));
  const k = kamerStat();
  setStat("player", k.t, false, k.warn);
  setStat("help", t("init.set.tourStat"));
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

let langOn = false;
export function bindSettings() {
  const p = $("#data-panel");
  if (!p) return;
  langOn = mountLangPick($("#lang-seg"), $("#lang-lbl")); // WP22: tot WP33 alleen in de i18n-debugstand
  p.addEventListener("click", () => queueMicrotask(paintSetStat)); // na de handlers van de knoppen zelf
  document.addEventListener("it-kamer", paintSetStat);
}
