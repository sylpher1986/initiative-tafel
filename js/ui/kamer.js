// "Delen met spelers": spelersscherm op andere apparaten via een kamer op de Worker (js/share.js, worker/room.js).
// Staat in Instellingen → Spelersscherm. Kamer (code + DM-token) in localStorage: na herladen loopt het delen door.
// Alleen UI- en verbindingstoestand: niets hiervan zit in undo, opslag of export.
import { roomChannel, dmLink, createRoom, normCode, fmtCode } from "../share.js";
import { $, esc, toast } from "./util.js";

const KEY = "it-room";
const LOST_MS = 10000; // pas na 10 s kwijt: rode stip op ⚙ en één melding

let getView = null, addLink = null;
let room = null, ch = null, link = null, off = null;
let st = "uit", n = 0, err = "", lostT = 0, warned = false;

function loadRoom() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || "null");
    return r && normCode(r.code) && typeof r.token === "string" && r.token.length <= 64 ? { code: normCode(r.code), token: r.token } : null;
  } catch { return null; }
}
function saveRoom(r) { try { r ? localStorage.setItem(KEY, JSON.stringify(r)) : localStorage.removeItem(KEY); } catch { /* privémodus: alleen deze sessie */ } }

const shareUrl = () => `${location.origin}/speler?k=${room.code}`;

function lost(on) {
  clearTimeout(lostT); lostT = 0;
  if (!on) { document.documentElement.classList.remove("kamer-lost"); warned = false; return; }
  lostT = setTimeout(() => {
    document.documentElement.classList.add("kamer-lost");
    if (!warned) { warned = true; toast("Spelersscherm: verbinding kwijt, opnieuw verbinden…"); }
  }, LOST_MS);
}

function disconnect() {
  if (off) off(); off = null;
  if (link) addLink(link, false); link = null;
  if (ch) ch.close(); ch = null;
  lost(false); n = 0;
}

function connect() {
  disconnect();
  ch = roomChannel(room.code, room.token);
  off = ch.on((m) => {
    if (m.t === "n") { n = Math.max(0, m.n | 0); paint(); }
    else if (m.t === "net") {
      st = m.s;
      lost(m.s === "kwijt");
      if (m.s === "weg") { disconnect(); room = null; saveRoom(null); st = "uit"; err = "Kamer verlopen. Deel opnieuw voor een nieuwe code."; }
      paint();
    }
  });
  link = dmLink(ch, getView);
  addLink(link, true);
}

async function start() {
  if (st === "maken") return;
  st = "maken"; err = ""; paint();
  try {
    room = await createRoom();
    saveRoom(room);
    connect();
  } catch (e) {
    st = "uit";
    err = e.message === "offline" ? "Geen internet. Het spelersscherm op dit apparaat werkt wel (hieronder)." : "Delen lukt nu niet. Probeer het later opnieuw.";
  }
  paint();
}

async function stop() {
  const c = ch; // eerst loskoppelen: opnieuw delen tijdens het stoppen krijgt een eigen kanaal
  ch = null;
  if (off) off(); off = null;
  if (link) addLink(link, false); link = null;
  lost(false); n = 0;
  room = null; saveRoom(null); st = "uit"; err = "";
  paint();
  if (c && !(await c.stop())) toast("Geen verbinding met de kamer: spelers zien de laatste stand tot de kamer verloopt (12 uur).");
}

async function copy() {
  try { await navigator.clipboard.writeText(shareUrl()); toast("Link gekopieerd"); }
  catch { toast("Kopiëren lukt niet. Houd de link ingedrukt om hem te kopiëren."); }
}

function paint() {
  const box = $("#kamer-box");
  if (!box) return;
  if (!room) {
    box.innerHTML = `<p class="hint">Spelers volgen op hun telefoon of de tv via een code. Vraagt internet.</p>
      ${err ? `<p class="hint kamererr" role="alert">${esc(err)}</p>` : ""}
      <div class="bar"><button type="button" class="btn primary tap" data-kamer="start" ${st === "maken" ? "disabled" : ""}>${st === "maken" ? "Kamer maken…" : err.startsWith("Kamer verlopen") ? "Opnieuw delen" : "Delen met spelers"}</button></div>`;
    return;
  }
  const status = st === "open" ? (n ? `${n} scherm${n === 1 ? "" : "en"} verbonden` : "Nog niemand verbonden")
    : st === "elders" ? "Het delen loopt nu in een ander tabblad of venster."
    : st === "kwijt" ? "Verbinding kwijt, opnieuw verbinden…" : "Verbinden…";
  const canShare = typeof navigator.share === "function";
  box.innerHTML = `<p class="kamer-code" aria-label="Code ${esc(room.code.split("").join(" "))}">${esc(fmtCode(room.code))}</p>
    <p class="kamer-url">${esc(shareUrl())}</p>
    <p class="kamer-st ${st === "open" ? "on" : ""}" aria-live="polite">${esc(status)}</p>
    <div class="bar">${st === "elders" ? `<button type="button" class="btn primary tap" data-kamer="resume">Hier verder delen</button>` : ""}
      ${canShare ? `<button type="button" class="btn tap" data-kamer="deel">Deel</button>` : ""}<button type="button" class="btn tap" data-kamer="copy">Kopieer link</button>
      <button type="button" class="btn tap" data-kamer="stop">Stop met delen</button></div>`;
}

/**
 * Koppelen bij het opstarten. view(): snapshot (toPlayerView); links(link, aan): dmLink in- of uitschakelen bij
 * de render-updates. Een bewaarde kamer gaat direct weer open.
 */
export function bindSharing(view, links) {
  getView = view; addLink = links;
  if (!$("#kamer-box") && window.__itErr) window.__itErr("Delen: #kamer-box ontbreekt in de pagina (oude index.html?)");
  $("#kamer-box")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-kamer]");
    if (!b) return;
    const k = b.dataset.kamer;
    if (k === "start") start();
    else if (k === "stop") stop();
    else if (k === "copy") copy();
    else if (k === "resume") ch && ch.resume();
    else if (k === "deel") navigator.share({ title: "Initiative Tafel · spelersscherm", text: `Volg het gevecht: code ${fmtCode(room.code)}`, url: shareUrl() }).catch(() => {});
  });
  room = loadRoom();
  if (room) connect();
  paint();
}
