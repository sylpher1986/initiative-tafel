// Opstarten: data laden, events koppelen, eerste render, service worker.
import { app, load, resetBaseline, setWarn } from "./state.js";
import { loadSrd } from "./data/monsters.js";
import { render } from "./ui/render.js";
import { $, toast } from "./ui/util.js";
import { VERSION } from "./version.js";
import { onClick, onChange, onKey, onToggle, bindForms, bindParty, bindLog, bindBackup, addMonsters, normalize } from "./ui/actions.js";

const sample = () => ({
  list: [
    { id: "ex1", name: "Thalia (voorbeeld)", kind: "pc", init: 17, dex: 3, ac: 15, hp: 24, max: 24, cond: [] },
    { id: "ex2", name: "Brom (voorbeeld)", kind: "pc", init: 9, dex: 0, ac: 18, hp: 31, max: 31, cond: [] },
  ],
  round: 0, active: null, sample: true,
});

function start() {
  app.S.list.forEach(normalize);
  bindForms.renderMonList();
  bindForms.impStatus();
  resetBaseline();
  render();
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
  bindForms(); bindParty(); bindLog();
  bindBackup(start);

  if (!app.S) {
    app.S = sample();
    addMonsters("Goblin", 2, "avg", "each", true);
    addMonsters("Hobgoblin", 1, "avg", "each", true);
  }
  start();

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

boot();
