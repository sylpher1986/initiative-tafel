// Inn the Grid (G4, WP58): kleine DOM-hulpjes en meldingen. Eigen kopie van wat Initiative in js/ui/util.js heeft
// (grens: js/maps/ importeert niets van Initiative). Meldingen gebruiken de opmaak .toast/.tmsg/.tundo uit css/app.css.
import { t } from "../../i18n/boot.js";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/**
 * Melding in #m-toast (max 3, nieuwste onderaan). btn = { label, run } geeft één knop (Ongedaan, Opnieuw); alleen de
 * nieuwste melding houdt een knop. bad = foutmelding (rood icoon, "Let op:" voor schermlezers). Tekst wordt geëscapet.
 */
export function toast(text, { btn, bad = false } = {}) {
  const box = document.getElementById("m-toast");
  if (!box) return;
  const m = document.createElement("div");
  m.className = bad ? "tmsg bad" : "tmsg";
  m.innerHTML = (bad ? `<svg class="tico" aria-hidden="true" focusable="false"><use href="/icons/ui.svg#i-alert"/></svg><span class="vh">${esc(t("maps.msg.attn"))} </span>` : "") + esc(text)
    + (btn ? ` <button type="button" class="tundo">${esc(btn.label)}</button>` : "");
  for (const o of box.children) o.querySelectorAll("button").forEach((b) => b.remove());
  box.appendChild(m);
  while (box.children.length > 3) box.firstElementChild.remove();
  const b = m.querySelector("button");
  if (b) b.addEventListener("click", () => { m.remove(); btn.run(); });
  m._t = setTimeout(() => m.remove(), b ? 7000 : 5000);
  return m;
}
