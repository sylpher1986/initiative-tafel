// Opstarten: data laden, events koppelen, eerste render, service worker.
import { app, load, resetBaseline, setWarn } from "./state.js";
import { loadSrd, findMon } from "./data/monsters.js";
import { render, ui, setAfterRender, mode } from "./ui/render.js";
import { initTour, tourTick, tourKey, killTour } from "./ui/tour.js";
import { toPlayerView } from "./playerview.js";
import { visNow } from "./ui/playervis.js";
import { pcReact } from "./ui/pcreact.js";
import { localChannel, dmLink } from "./share.js";
import { bindSharing, dropSharing } from "./ui/kamer.js";
import { setWriteGuard } from "./storage.js";
import { initI18n, i18nDebug, t } from "./i18n/boot.js";
import { claimTab } from "./tablock.js";
import { $, esc, toastBad } from "./ui/util.js";
import { VERSION, APP } from "./version.js";
import { bindEnc } from "./ui/encounters.js";
import { bindEnd } from "./ui/einde.js";
import { bindSettings } from "./ui/settings.js";
import { bindKeys } from "./ui/keys.js";
import { onClick, onChange, onKey, onToggle, bindForms, bindParty, bindLog, bindBackup, bindQadd, bindAoe, bindAtk, bindInit, normalize, scrollToCard, resetMons } from "./ui/actions.js";

function start(boot = false) {
  ui.mode = null; // ook na een import: de modus volgt weer het gevecht
  Object.assign(ui, { end: false, encDraft: null, encEdit: null, encImp: null, encAsk: null, encMenu: null, encWhy: null }); // na een import: geen verouderd concept
  app.S.list.forEach(normalize);
  bindForms.renderMonList();
  bindForms.impStatus();
  resetBaseline(boot); // herladen: undo-geschiedenis terug (DA2); import: nieuw vertrekpunt
  render();
  // lopend gevecht na herladen, app uit de achtergrond of import: wie aan de beurt is in beeld
  if (app.S.round) requestAnimationFrame(() => scrollToCard(app.S.active, true, true));
}

/* DA3: een ander tabblad nam het over. Niets meer opslaan of naar spelers sturen; de app eronder is onbruikbaar
   (inert), zodat er geen werk verloren gaat dat toch niet bewaard wordt. "Hier verder werken" herlaadt: dan de
   nieuwste stand uit IndexedDB en dit tabblad claimt weer (het andere stopt). UX-agent koos dit scherm boven een
   strook met een alleen-lezen lijst (die veroudert en lijkt te werken). Geen melding in het nieuwe tabblad. */
let stopTab = () => {}, gone = false, i18nP = null; // i18nP: vertalingen laden (tabLost kan vóór het eind van het laden komen)
function tabLost() {
  gone = true;
  killTour();
  stopTab();
  for (const el of document.body.children) el.inert = true;
  const d = document.createElement("div");
  d.className = "tabstop";
  d.setAttribute("role", "alertdialog");
  d.setAttribute("aria-modal", "true");
  d.setAttribute("aria-labelledby", "ts-t");
  d.setAttribute("aria-describedby", "ts-d");
  const fill = () => { d.innerHTML = `<div class="tabstop-card">
    <h2 id="ts-t">${esc(t("init.tab.title"))}</h2>
    <p id="ts-d">${esc(t("init.tab.text", { app: APP }))}</p>
    <button type="button" class="btn primary tap">${esc(t("init.tab.here"))}</button>
    <p class="hint">${esc(t("init.tab.hint"))}</p>
  </div>`; };
  fill();
  if (i18nP) i18nP.then(() => { const f = document.activeElement === d.querySelector("button"); fill(); d.querySelector("button").addEventListener("click", () => location.reload()); if (f) d.querySelector("button").focus(); }); // tekst opnieuw zodra de catalogus er is
  d.querySelector("button").addEventListener("click", () => location.reload());
  document.body.append(d);
  d.querySelector("button").focus();
}

async function boot() {
  // vóór het laden: het vorige tabblad stopt met opslaan voordat dit tabblad de stand leest
  setWriteGuard(claimTab(tabLost));
  setWarn(toastBad); // opslaan mislukt = de belangrijkste fout (WP17-review)
  // pagina (index.html) en scripts moeten van dezelfde versie zijn; anders zichtbaar maken
  const pv = document.querySelector('meta[name="it-version"]')?.content;
  // versieregel na het laden van de vertalingen (WP26); "· pagina X" bij een andere versie van index.html
  const version = () => { $("#app-version").textContent = `${APP} ${VERSION}${pv === VERSION ? "" : ` · ${t("init.boot.page", { v: pv || t("init.boot.older") })}`}${i18nDebug() ? ` · i18n ${i18nDebug()} (?i18n=off)` : ""}`; }; // debugstand blijft bewaard: altijd zichtbaar
  i18nP = initI18n(); // vertalingen vóór de eerste render (WP20; gooit nooit, wacht max. 3 s)
  try {
    await Promise.all([load(), loadSrd(), i18nP]);
    version();
  } catch (e) {
    await i18nP; version();
    $("#order").innerHTML = `<li class="hint" style="padding:20px">${esc(t("init.boot.srdFail", { reason: String(e.message) }))}</li>`;
    return;
  }
  // tijdens het laden overgenomen (bv. twee tabbladen tegelijk hersteld): niets starten, zeker geen kamer (die zou het
  // nieuwe tabblad met 4001 afsluiten). Hierna loopt boot synchroon, dus later kan gone niet meer veranderen.
  if (gone) return;
  document.addEventListener("click", onClick);
  // tik op een melding (niet op een knop) sluit hem
  $("#toast").addEventListener("click", (e) => { if (!e.target.closest("button")) e.target.closest(".tmsg")?.remove(); });
  document.addEventListener("change", onChange);
  document.addEventListener("keydown", (e) => { if (!gone && !tourKey(e)) onKey(e); }); // inert ontbreekt op Safari < 15.5: toetsenbord zou anders doorlopen
  document.addEventListener("toggle", onToggle, true);
  // velden op de kaart in Voorbereiden slaan op bij change (zonder render); na het verlaten één render voor de rest van
  // het scherm. Tijdens een tik pas na pointerup, anders vervangt de render de knop vóór zijn click. Naar een ander
  // invoerveld: niet renderen, anders verdwijnt de focus (de volgende tik of het volgende veld rendert vanzelf).
  let down = false, sync = false;
  const resync = () => { if (sync) { sync = false; setTimeout(render, 0); } };
  addEventListener("pointerdown", () => { down = true; }, true);
  addEventListener("pointerup", () => { down = false; resync(); }, true);
  addEventListener("pointercancel", () => { down = false; resync(); }, true);
  document.addEventListener("focusout", (e) => {
    if (!e.target.dataset || !(e.target.dataset.pf || "dlvl" in e.target.dataset || "encn" in e.target.dataset)) return; // encn: aantal in Encounter bewerken (VB5)
    if (e.relatedTarget && e.relatedTarget.matches("input, select, textarea")) return;
    sync = true;
    if (!down) resync();
  });
  bindForms(); bindParty(); bindLog(); bindQadd(); bindAoe(); bindAtk(); bindInit(); bindEnc(); bindEnd(resetMons); bindSettings(); bindKeys();
  bindBackup(start);
  // echte hoogte van de beurtbalk: het statblock op de telefoon staat er precies boven
  if ("ResizeObserver" in window) new ResizeObserver(([e]) => document.documentElement.style.setProperty("--dock-h", Math.ceil(e.target.getBoundingClientRect().height) + "px")).observe($("#dock"));

  // OB1: bestaande gebruikers (al data op dit apparaat) krijgen de rondleiding niet vanzelf
  let exported = false; try { exported = localStorage.getItem("it-exp") != null; } catch { /* privémodus */ }
  initTour(mode, !!(app.S && app.S.list.length) || app.party.length > 0 || app.encounters.length > 0 || app.custom.length > 0 || exported);
  if (!app.S) app.S = { list: [], round: 0, active: null, sample: false }; // eerste keer: welkomstkaart met "Start met voorbeeld"
  // spelersscherm: krijgt alleen de gefilterde snapshot. Twee wegen: een ander venster op dit apparaat (lokaal)
  // en andere apparaten via een kamer (Instellingen → Delen met spelers). Eén snapshot per render, ook met beide.
  const links = new Set();
  let view = null, prevTurn = null; // prevTurn: laatste zichtbare beurt, zodat een verborgen beurt hem laat staan (SC2b)
  const getView = () => {
    if (view) return view;
    const S = app.S;
    if (!S.round) prevTurn = null;
    view = toPlayerView(S, (c) => (c.ref ? findMon(c.ref)?.meta : ""), visNow(), prevTurn, { pcReact: pcReact() });
    if (view.active && view.active === S.active) prevTurn = { id: view.active, round: view.round };
    return view;
  };
  setAfterRender(() => { view = null; links.forEach((l) => l.update()); tourTick(); });
  const ch = localChannel();
  if (ch) links.add(dmLink(ch, getView));
  stopTab = () => { links.clear(); if (ch) ch.close(); dropSharing(); };
  // los van de rest: een fout bij het delen mag de app niet tegenhouden, en is zichtbaar in Instellingen
  try { bindSharing(getView, (l, on) => (on ? links.add(l) : links.delete(l))); }
  catch (e) { const b = $("#kamer-box"); if (b) b.textContent = t("init.boot.shareFail", { reason: String(e && e.message || e) }); }
  start(true);

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }
}

// onverwachte fout bij het opstarten: zichtbaar maken in plaats van stil een half werkende app
boot().catch((e) => { toastBad(t("init.boot.fail", { reason: String(e && e.message || e) })); if (window.__itErr) window.__itErr(`Boot: ${e && (e.stack || e.message) || e}`); });
