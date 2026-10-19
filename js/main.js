// Opstarten: data laden, events koppelen, eerste render, service worker.
import { app, load, resetBaseline, setWarn } from "./state.js";
import { loadSrd, findMon } from "./data/monsters.js";
import { render, ui, setAfterRender } from "./ui/render.js";
import { toPlayerView } from "./playerview.js";
import { visNow } from "./ui/playervis.js";
import { localChannel, dmLink } from "./share.js";
import { bindSharing } from "./ui/kamer.js";
import { $, toast } from "./ui/util.js";
import { VERSION } from "./version.js";
import { onClick, onChange, onKey, onToggle, bindForms, bindParty, bindLog, bindBackup, bindQadd, bindAoe, bindAtk, bindInit, normalize, scrollToCard } from "./ui/actions.js";

function start() {
  ui.mode = null; // ook na een import: de modus volgt weer het gevecht
  app.S.list.forEach(normalize);
  bindForms.renderMonList();
  bindForms.impStatus();
  resetBaseline();
  render();
  // lopend gevecht na herladen, app uit de achtergrond of import: wie aan de beurt is in beeld
  if (app.S.round) requestAnimationFrame(() => scrollToCard(app.S.active, true, true));
}

async function boot() {
  setWarn(toast);
  // pagina (index.html) en scripts moeten van dezelfde versie zijn; anders zichtbaar maken
  const pv = document.querySelector('meta[name="it-version"]')?.content;
  $("#app-version").textContent = `Initiative Tafel ${VERSION}${pv === VERSION ? "" : ` · pagina ${pv || "ouder"}`}`;
  try {
    await Promise.all([load(), loadSrd()]);
  } catch (e) {
    $("#order").innerHTML = `<li class="hint" style="padding:20px">De monsterdata kon niet laden (${String(e.message).replace(/</g, "&lt;")}). Ververs de pagina.</li>`;
    return;
  }
  document.addEventListener("click", onClick);
  // tik op een melding (niet op een knop) sluit hem
  $("#toast").addEventListener("click", (e) => { if (!e.target.closest("button")) e.target.closest(".tmsg")?.remove(); });
  document.addEventListener("change", onChange);
  document.addEventListener("keydown", onKey);
  document.addEventListener("toggle", onToggle, true);
  bindForms(); bindParty(); bindLog(); bindQadd(); bindAoe(); bindAtk(); bindInit();
  bindBackup(start);
  // echte hoogte van de beurtbalk: het statblock op de telefoon staat er precies boven
  if ("ResizeObserver" in window) new ResizeObserver(([e]) => document.documentElement.style.setProperty("--dock-h", Math.ceil(e.target.getBoundingClientRect().height) + "px")).observe($("#dock"));

  if (!app.S) app.S = { list: [], round: 0, active: null, sample: false }; // eerste keer: welkomstkaart met "Start met voorbeeld"
  // spelersscherm: krijgt alleen de gefilterde snapshot. Twee wegen: een ander venster op dit apparaat (lokaal)
  // en andere apparaten via een kamer (Instellingen → Delen met spelers). Eén snapshot per render, ook met beide.
  const links = new Set();
  let view = null;
  const getView = () => (view ||= toPlayerView(app.S, (c) => (c.ref ? findMon(c.ref)?.meta : ""), visNow()));
  setAfterRender(() => { view = null; links.forEach((l) => l.update()); });
  const ch = localChannel();
  if (ch) links.add(dmLink(ch, getView));
  // los van de rest: een fout bij het delen mag de app niet tegenhouden, en is zichtbaar in Instellingen
  try { bindSharing(getView, (l, on) => (on ? links.add(l) : links.delete(l))); }
  catch (e) { const b = $("#kamer-box"); if (b) b.textContent = `Delen met spelers kon niet starten: ${e && e.message || e}`; }
  start();

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

// onverwachte fout bij het opstarten: zichtbaar maken in plaats van stil een half werkende app
boot().catch((e) => { toast(`Fout bij opstarten: ${e && e.message || e}`); if (window.__itErr) window.__itErr(`Opstarten: ${e && (e.stack || e.message) || e}`); });
