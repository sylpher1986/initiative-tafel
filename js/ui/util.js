// Kleine DOM-hulpjes en meldingen.
import { ico } from "./icons.js";
import { t } from "../i18n/boot.js";
/** TA18: markdown-resten uit de SRD-data (Open5e) als opmaak: **Fire Breath.** vet, _mage armor_ cursief; op ge-escapete tekst */
export const mdLite = (h) => h.replace(/\*\*([^*<\n]{1,60})\*\*/g, "<b>$1</b>").replace(/(^|[\s(])_([^_<\n]{1,40})_(?=[\s).,;:]|$)/g, "$1<i>$2</i>");
export const $ = (s) => document.querySelector(s);
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/** Vertaalde tekst als HTML met één vet deel: {b} in de catalogus wordt <b>b</b> (geen HTML in een catalogus, WP24) */
export const tb = (key, p, b, cls = "") => esc(t(key, { ...p, b: "\u0001" })).replace("\u0001", () => `<b${cls ? ` class="${cls}"` : ""}>${esc(b)}</b>`); // functie: geen $-patronen uit de naam; cls bijv. "bad" (rood)
/** Knop Ongedaan in een melding (id toast-undo: alleen de nieuwste melding houdt hem) */
export const undoBtn = () => `<button class="tundo" id="toast-undo">${esc(t("common.undo"))}</button>`;
export const n0 = (v) => (Number.isFinite(+v) ? +v : 0);

let tLast = 0, tEl = null;
const TMAX = 3;
/** Meldingen-stapel boven de beurtbalk (#toast). Nieuwste onderaan, max 3; alleen de nieuwste houdt knoppen
 *  (Ongedaan draait altijd de laatste stap terug, dus een oudere knop zou iets anders terugdraaien).
 *  Binnen 300 ms = dezelfde melding (als die er nog staat). html moet al geëscaped zijn. */
export function toastHtml(html, bad = false) {
  const box = $("#toast");
  const now = Date.now();
  let m = now - tLast < 300 && tEl?.isConnected && tEl.classList.contains("bad") === bad ? tEl : null; // fout en gewoon niet samenvoegen
  tLast = now;
  if (m) m.insertAdjacentHTML("beforeend", "<br>" + html);
  else {
    m = document.createElement("div");
    m.className = bad ? "tmsg bad" : "tmsg";
    // WP17 (HS6): weigering of fout met icoon; de rest zonder (geen ruis aan tafel). Geen role="alert": #toast is al een
    // live-regio en geneste regio's worden op iOS/NVDA soms dubbel voorgelezen (dev-review); "Let op:" alleen voor schermlezers.
    m.innerHTML = (bad ? ico("alert", "tico") + `<span class="vh">${esc(t("init.msg.attn"))} </span>` : "") + html;
    box.appendChild(m);
  }
  tEl = m;
  for (const o of box.children) if (o !== m) o.querySelectorAll("button").forEach((b) => b.remove());
  while (box.children.length > TMAX) box.firstElementChild.remove();
  clearTimeout(m._t);
  m._t = setTimeout(() => m.remove(), m.querySelector("button") ? 7000 : 5000);
}
/** De melding met knoppen sluiten (er is er hooguit één): na Ongedaan, Hoort erbij, Legendary Resistance … */
export function closeToast() {
  const b = document.querySelector("#toast .tmsg button");
  if (b) b.closest(".tmsg").remove();
}
/** Hele stapel weg (WP39: na Gevecht afronden staat alleen die melding, oude meldingen over de lijst zeggen niets meer) */
export function clearToasts() {
  const box = $("#toast");
  for (const o of [...box.children]) { clearTimeout(o._t); o.remove(); }
  tEl = null;
}
export const toast = (text) => toastHtml(esc(text));
/** Melding voor een weigering of fout (validatie, laden mislukt): icoon + "Let op:" voor schermlezers */
export const toastBad = (text) => toastHtml(esc(text), true);
/** Fx-meldingen uit de regels tonen */
export const show = (fx) => fx && fx.msgs.forEach((m) => toast(m));
/**
 * Tikbare spellnaam: opent de spell-uitleg (js/ui/spellinfo.js). label = getoonde tekst (ook met annotatie),
 * name = naam om op te zoeken, cid = speler van wie de sheet-gegevens als terugval dienen (niet-SRD-spell).
 */
export const spellLink = (name, label = name, cid = "") =>
  `<button type="button" class="spl" data-spell="${esc(name)}"${cid ? ` data-cid="${esc(cid)}"` : ""}>${esc(label)}</button>`;
