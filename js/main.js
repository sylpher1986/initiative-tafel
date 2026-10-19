// Opstarten: data laden, events koppelen, eerste render, service worker.
import { app, load, resetBaseline, setWarn } from "./state.js";
import { loadSrd, findMon } from "./data/monsters.js";
import { render, ui, setAfterRender } from "./ui/render.js";
import { toPlayerView } from "./playerview.js";
import { localChannel, dmLink } from "./share.js";
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
  $("#app-version").textContent = `Initiative Tafel ${VERSION}`;
  try {
    await Promise.all([load(), loadSrd()]);
  } catch (e) {
    $("#order").innerHTML = `<li class="hint" style="padding:20px">De monsterdata kon niet laden (${String(e.message).replace(/</g, "&lt;")}). Ververs de pagina.</li>`;
    return;
  }
  document.addEventListener("click", onClick);
  document.addEventListener("change", onChange);
  document.addEventListener("keydown", onKey);
  document.addEventListener("toggle", onToggle, true);
  bindForms(); bindParty(); bindLog(); bindQadd(); bindAoe(); bindAtk(); bindInit();
  bindBackup(start);
  // echte hoogte van de beurtbalk: het statblock op de telefoon staat er precies boven
  if ("ResizeObserver" in window) new ResizeObserver(([e]) => document.documentElement.style.setProperty("--dock-h", Math.ceil(e.target.getBoundingClientRect().height) + "px")).observe($("#dock"));

  if (!app.S) app.S = { list: [], round: 0, active: null, sample: false }; // eerste keer: welkomstkaart met "Start met voorbeeld"
  // spelersscherm (ander venster op dit apparaat): krijgt alleen de gefilterde snapshot
  const ch = localChannel();
  if (ch) {
    const link = dmLink(ch, () => toPlayerView(app.S, (c) => (c.ref ? findMon(c.ref)?.meta : "")));
    setAfterRender(link.update);
  }
  start();

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

boot();
