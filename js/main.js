// Opstarten: data laden, events koppelen, eerste render, service worker.
import { app, load, resetBaseline, setWarn } from "./state.js";
import { loadSrd, findMon } from "./data/monsters.js";
import { render, ui, setAfterRender } from "./ui/render.js";
import { toPlayerView } from "./playerview.js";
import { localChannel, dmLink } from "./share.js";
import { $, toast } from "./ui/util.js";
import { VERSION } from "./version.js";
import { onClick, onChange, onKey, onToggle, bindForms, bindParty, bindLog, bindBackup, bindQadd, bindAoe, addMonsters, normalize } from "./ui/actions.js";

const sample = () => ({
  list: [
    { id: "ex1", name: "Thalia (voorbeeld)", kind: "pc", race: "Elf", init: 17, dex: 3, ac: 15, hp: 24, max: 24, cond: [] },
    { id: "ex2", name: "Brom (voorbeeld)", kind: "pc", race: "Dwarf", init: 9, dex: 0, ac: 18, hp: 31, max: 31, cond: [] },
  ],
  round: 0, active: null, sample: true,
});

function start() {
  ui.mode = null; // ook na een import: de modus volgt weer het gevecht
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
  bindForms(); bindParty(); bindLog(); bindQadd(); bindAoe();
  bindBackup(start);

  if (!app.S) {
    app.S = sample();
    addMonsters("Goblin", 2, "avg", "each", true);
    addMonsters("Hobgoblin", 1, "avg", "each", true);
  }
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
