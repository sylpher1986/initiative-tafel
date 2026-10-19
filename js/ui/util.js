// Kleine DOM-hulpjes en meldingen.
export const $ = (s) => document.querySelector(s);
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const n0 = (v) => (Number.isFinite(+v) ? +v : 0);

let tLast = 0, tEl = null;
const TMAX = 3;
/** Meldingen-stapel boven de beurtbalk (#toast). Nieuwste onderaan, max 3; alleen de nieuwste houdt knoppen
 *  (Ongedaan draait altijd de laatste stap terug, dus een oudere knop zou iets anders terugdraaien).
 *  Binnen 300 ms = dezelfde melding (als die er nog staat). html moet al geëscaped zijn. */
export function toastHtml(html) {
  const box = $("#toast");
  const now = Date.now();
  let m = now - tLast < 300 && tEl?.isConnected ? tEl : null;
  tLast = now;
  if (m) m.insertAdjacentHTML("beforeend", "<br>" + html);
  else {
    m = document.createElement("div");
    m.className = "tmsg";
    m.innerHTML = html;
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
export const toast = (text) => toastHtml(esc(text));
/** Fx-meldingen uit de regels tonen */
export const show = (fx) => fx && fx.msgs.forEach((m) => toast(m));
/**
 * Tikbare spellnaam: opent de spell-uitleg (js/ui/spellinfo.js). label = getoonde tekst (ook met annotatie),
 * name = naam om op te zoeken, cid = speler van wie de sheet-gegevens als terugval dienen (niet-SRD-spell).
 */
export const spellLink = (name, label = name, cid = "") =>
  `<button type="button" class="spl" data-spell="${esc(name)}"${cid ? ` data-cid="${esc(cid)}"` : ""}>${esc(label)}</button>`;
