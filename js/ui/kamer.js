// "Delen met spelers": spelersscherm op andere apparaten via een kamer op de Worker (js/share.js, worker/room.js).
// Staat in Instellingen → Spelersscherm. Kamer (code + DM-token) in localStorage: na herladen loopt het delen door.
// Alleen UI- en verbindingstoestand: niets hiervan zit in undo, opslag of export.
import { APP } from "../version.js";
import { roomChannel, dmLink, createRoom, normCode, fmtCode } from "../share.js";
import { $, esc, toast, toastHtml, closeToast } from "./util.js";
import { canWrite } from "../storage.js";
import { qrSvg } from "../qr.js";

const KEY = "it-room";
const LOST_MS = 10000; // pas na 10 s kwijt: rode stip op ⚙ en één melding
const ROOM_MS = 12 * 3600e3; // = IDLE_MS in worker/room.js: een gestopte kamer verloopt 12 u na het stoppen

let getView = null, addLink = null;
let room = null, ch = null, link = null, off = null;
let st = "uit", n = 0, err = "", lostT = 0, warned = false;
// pauze: de kamer stopte het delen na 30 min zonder gewijzigde stand. missed = melding "Spelers zien dit niet" al getoond (één per pauze)
let paused = false, resuming = false, missed = false;
// SC7: again = Opnieuw delen na Stop loopt (verlopen kamer → stil een nieuwe); ask = bevestigvak "Nieuwe code…" open
let again = false, ask = false;
// stopping = kanaal dat nog "stop" probeert te sturen (offline: tot 5 s); making = Nieuwe code wordt aangemaakt
let stopping = null, making = false;

function loadRoom() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!(r && normCode(r.code) && typeof r.token === "string" && r.token.length <= 64)) return null;
    const o = { code: normCode(r.code), token: r.token };
    if (r.stopped === true) { o.stopped = true; o.at = Number.isFinite(r.at) ? r.at : 0; }
    return o;
  } catch { return null; }
}
function saveRoom(r) { try { r ? localStorage.setItem(KEY, JSON.stringify(r)) : localStorage.removeItem(KEY); } catch { /* privémodus: alleen deze sessie */ } }

const shareUrl = () => `${location.origin}/speler?k=${room.code}`;
/** Gestopt en (vrijwel zeker) verlopen: niet meer dezelfde code beloven. Klok verzet (at in de toekomst) telt als verlopen. */
export const expired = (r, now = Date.now()) => !!r?.stopped && !(now - r.at < ROOM_MS - 60e3 && r.at <= now + 60e3);

function lost(on) {
  clearTimeout(lostT); lostT = 0;
  if (!on) { document.documentElement.classList.remove("kamer-lost"); warned = false; changed(); return; }
  lostT = setTimeout(() => {
    document.documentElement.classList.add("kamer-lost"); changed();
    if (!warned) { warned = true; toast("Spelersscherm: verbinding kwijt, opnieuw verbinden…"); }
  }, LOST_MS);
}

/** Rode stip op ⚙ tijdens een pauze (zoals bij "verbinding kwijt"): blijft tot de DM hervat of stopt */
function setPaused(on) {
  paused = on; resuming = false; missed = false;
  document.documentElement.classList.toggle("kamer-pauze", on); changed();
}

function resume() {
  if (!ch || !paused || resuming) return;
  resuming = true;
  document.querySelector("#toast-kamer")?.remove();
  ch.hervat();
  paint();
}

function disconnect() {
  if (off) off(); off = null;
  if (link) addLink(link, false); link = null;
  if (ch) ch.close(); ch = null;
  lost(false); n = 0; setPaused(false);
}

function connect() {
  disconnect();
  ch = roomChannel(room.code, room.token, { allow: canWrite });
  off = ch.on((m) => {
    if (m.t === "n") { n = Math.max(0, m.n | 0); paint(); }
    else if (m.t === "pauze") { if (!paused) { setPaused(true); paint(); } }
    else if (m.t === "hervat") { const was = paused || again; again = false; setPaused(false); paint(); if (was) toast("Spelers zien het gevecht weer."); }
    else if (m.t === "gemist") {
      // eenmalig per pauze; samen met een melding met Ongedaan (zelfde render, < 300 ms) wordt het één melding met beide knoppen
      if (!missed && !resuming) { missed = true; toastHtml(`Spelers zien dit niet: delen is gepauzeerd. <button class="tundo" id="toast-kamer">Opnieuw delen</button>`); }
    }
    else if (m.t === "net") {
      st = m.s;
      lost(m.s === "kwijt");
      if (m.s === "weg") {
        disconnect(); room = null; saveRoom(null); st = "uit"; closeQr();
        if (again) { again = false; return void start(true); } // Opnieuw delen na Stop, maar de kamer verliep: stil een nieuwe
        err = "Kamer verlopen. Deel opnieuw voor een nieuwe code.";
      }
      paint();
    }
  });
  link = dmLink(ch, getView);
  addLink(link, true);
}

async function start(old) {
  if (st === "maken") return;
  st = "maken"; err = ""; ask = false; again = false; paint();
  try {
    room = await createRoom();
    saveRoom(room);
    connect();
    if (old) toast(`Oude code verlopen. Nieuwe code: ${fmtCode(room.code)}. Tv en telefoons opnieuw koppelen.`);
  } catch (e) {
    st = "uit"; err = errText(e);
  }
  paint();
}
const errText = (e) => e.message === "offline" ? "Geen internet. Het spelersscherm op dit apparaat werkt wel (hieronder)."
  : e.message === "rate" ? "Te veel nieuwe kamers achter elkaar. Probeer het over een minuut opnieuw."
  : "Delen lukt nu niet. Probeer het later opnieuw.";

/** Kanaal loskoppelen zonder het te sluiten (stop/wis sluit het zelf); opnieuw delen krijgt een eigen kanaal */
function detach() {
  const c = ch; ch = null;
  if (off) off(); off = null;
  if (link) addLink(link, false); link = null;
  lost(false); n = 0; setPaused(false);
  return c;
}

/** SC7: Stop met delen = de kamer pauzeert; code en token blijven (12 u), na herladen niet vanzelf weer delen */
async function stop(fromBtn = false) {
  const c = detach();
  room = { code: room.code, token: room.token, stopped: true, at: Date.now() };
  saveRoom(room); st = "uit"; err = ""; ask = false; again = false;
  paint();
  // AF10: geen "Zeker?" (Stop = pauze, omkeerbaar met dezelfde code), wel de weg terug in de melding
  if (fromBtn) toastHtml(`Delen gestopt. Code ${esc(fmtCode(room.code))} blijft. <button class="tundo" id="toast-weer">Opnieuw delen</button>`);
  if (!c) return;
  stopping = c;
  const ok = await c.stop();
  if (stopping !== c) return; // intussen Opnieuw delen of Nieuwe code: dit "stop" telt niet meer
  stopping = null;
  if (!ok) toast("Geen verbinding met de kamer: spelers houden de laatste stand.");
}
/** Een "stop" dat nog wacht op verbinding afbreken: anders pakt dat kanaal de kamer terug (4001) en pauzeert hem opnieuw */
function dropStopping() { const c = stopping; stopping = null; if (c) c.close(); }

/** Opnieuw delen na Stop: zelfde code (hervat); verlopen → nieuwe kamer */
function shareAgain() {
  if (expired(room)) { room = null; saveRoom(null); return void start(); }
  dropStopping();
  room = { code: room.code, token: room.token };
  saveRoom(room); ask = false; again = true; err = "";
  connect();
  ch.hervat();
  paint();
}

/**
 * Nieuwe code: eerst de nieuwe kamer maken; pas als dat lukt de oude opheffen (spelers op de oude code zien "deelt niet
 * meer met deze code"). Mislukt het (offline, te veel kamers), dan blijft de oude code gewoon staan.
 */
async function newCode() {
  if (making) return;
  making = true; err = ""; paint();
  let r;
  try { r = await createRoom(); }
  catch (e) { making = false; err = errText(e); paint(); return; }
  making = false;
  const old = room, c = detach();
  if (c) c.close();
  dropStopping(); closeQr();
  if (old && !expired(old)) roomChannel(old.code, old.token, { allow: canWrite }).stop(5000, "wis");
  room = r; saveRoom(room); ask = false; again = false; st = "verbinden";
  connect();
  paint();
}

async function copy() {
  try { await navigator.clipboard.writeText(shareUrl()); toast("Link gekopieerd"); }
  catch { toast("Kopiëren lukt niet. Houd de link ingedrukt om hem te kopiëren."); }
}

/** AF5: korte status voor de kop van de sectie Spelersscherm; warn = zelfde rode stip als op ⚙ */
export function kamerStat() {
  const h = document.documentElement.classList, warn = h.contains("kamer-lost") || h.contains("kamer-pauze");
  if (!room || expired(room)) return { t: "Niet gedeeld", warn };
  const c = fmtCode(room.code);
  if (room.stopped) return { t: `Gestopt · ${c}`, warn }; // bewuste actie: geen stip
  if (paused && st !== "elders") return { t: `Gepauzeerd · ${c}`, warn: true };
  if (st === "kwijt" || h.contains("kamer-lost")) return { t: "Verbinding kwijt", warn: true };
  if (st === "elders") return { t: "In ander tabblad", warn };
  if (st === "open") return { t: `Gedeeld · ${c} · ${n} scherm${n === 1 ? "" : "en"}`, warn };
  return { t: "Verbinden…", warn };
}
const changed = () => document.dispatchEvent(new Event("it-kamer"));

const codeHtml = (dim) => `<p class="kamer-code${dim ? " dim" : ""}" aria-label="Code ${esc(room.code.split("").join(" "))}">${esc(fmtCode(room.code))}</p>
    <p class="kamer-url">${esc(shareUrl())}</p>`;
const qrBtn = `<button type="button" class="btn tap" data-kamer="qr" aria-haspopup="dialog">QR-code</button>`;
/** "Nieuwe code…" alleen als het delen stilstaat (SC7): zeldzaam, en één mistik koppelt alle schermen los */
const newHtml = () => ask
  ? `<div class="confirmbox" role="group" aria-label="Nieuwe code"><p class="hint">Tv en telefoons op ${esc(fmtCode(room.code))} moeten opnieuw koppelen.</p>
      <div class="bar"><button type="button" class="btn primary tap" data-kamer="nieuw-ja" ${making ? "disabled" : ""}>${making ? "Nieuwe code maken…" : "Nieuwe code maken"}</button><button type="button" class="btn tap" data-kamer="nieuw-nee">Annuleer</button></div></div>`
  : `<div><button type="button" class="link" data-kamer="nieuw" aria-expanded="false">Nieuwe code…</button></div>`;

function paint() {
  changed();
  const box = $("#kamer-box");
  if (!box) return;
  if (!room || expired(room)) {
    const exp = !!room; // gestopt en verlopen: de knop belooft geen zelfde code
    box.innerHTML = `<p class="hint">Spelers volgen op hun telefoon of de tv via een code. Vraagt internet.</p>
      ${err ? `<p class="hint kamererr" role="alert">${esc(err)}</p>` : ""}
      <div class="bar"><button type="button" class="btn primary tap" data-kamer="start" ${st === "maken" ? "disabled" : ""}>${st === "maken" ? "Kamer maken…" : exp ? "Delen met spelers (nieuwe code)" : err.startsWith("Kamer verlopen") ? "Opnieuw delen" : "Delen met spelers"}</button></div>`;
    return;
  }
  if (room.stopped || (paused && st !== "elders")) {
    const why = room.stopped ? "Delen gestopt. Spelers blijven gekoppeld en zien „De DM deelt op dit moment niet.”" : "Delen gestopt na 30 minuten zonder wijzigingen.";
    const busy = resuming || again;
    // pauze na 30 min: Stop blijft (haalt de rode stip weg); gestopt: alleen opnieuw of een nieuwe code
    box.innerHTML = `${codeHtml(true)}
    <p class="kamer-st" aria-live="polite">${esc(why)}</p>
    ${err ? `<p class="hint kamererr" role="alert">${esc(err)}</p>` : ""}
    <div class="bar"><button type="button" class="btn primary tap" data-kamer="${room.stopped ? "weer" : "hervat"}" ${busy ? "disabled" : ""}>${busy ? "Opnieuw delen…" : "Opnieuw delen"}</button>${qrBtn}${room.stopped ? "" : `<button type="button" class="btn tap" data-kamer="stop">Stop met delen</button>`}</div>
    ${newHtml()}`;
    return;
  }
  // Opnieuw delen loopt: een verlopen kamer opent eerst en sluit dan met 4004; pas na de bevestiging "Gedeeld" tonen
  const status = again ? "Verbinden…" : st === "open" ? (n ? `${n} scherm${n === 1 ? "" : "en"} verbonden` : "Nog niemand verbonden")
    : st === "elders" ? "Het delen loopt nu in een ander tabblad of venster."
    : st === "kwijt" ? "Verbinding kwijt, opnieuw verbinden…" : "Verbinden…";
  const canShare = typeof navigator.share === "function";
  box.innerHTML = `${codeHtml(false)}
    <p class="kamer-st ${st === "open" && !again ? "on" : ""}" aria-live="polite">${esc(status)}</p>
    <div class="bar">${st === "elders" ? `<button type="button" class="btn primary tap" data-kamer="resume">Hier verder delen</button>` : ""}
      ${qrBtn}${canShare ? `<button type="button" class="btn tap" data-kamer="deel">Deel</button>` : ""}<button type="button" class="btn tap" data-kamer="copy">Kopieer link</button>
      <button type="button" class="btn tap" data-kamer="stop">Stop met delen</button></div>`;
}

/* ---------- SC1: QR-code schermvullend ("Laat scannen"), altijd zwart op wit ---------- */
let qrFrom = null;
const QR_N = 45; // modules incl. stille zone bij de spelerslink (versie 5); bij een langere link schaalt het mee
function qrSize(n) {
  const max = Math.min(innerWidth - 32, innerHeight - 200, 640);
  return Math.max(n, Math.floor(max / n) * n); // heel aantal px per module: scherpe randen
}
function fitQr() {
  const svg = document.querySelector("#qrfull svg");
  if (!svg) return;
  const n = +svg.getAttribute("viewBox").split(" ")[2] || QR_N, px = qrSize(n);
  svg.style.width = px + "px"; // hoogte volgt (height:auto, viewBox)
}
function openQr(from) {
  if (!room || document.querySelector("#qrfull")) return;
  qrFrom = from || null;
  const code = fmtCode(room.code), still = room.stopped || paused;
  const el = document.createElement("div");
  el.id = "qrfull"; el.className = "qrfull";
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "qrfull-h");
  el.innerHTML = `<div class="qrin"><h2 id="qrfull-h">Scan om mee te kijken</h2>
    ${qrSvg(shareUrl(), `QR-code naar het spelersscherm, kamer ${room.code.split("").join(" ")}`)}
    <p class="qrcode" aria-hidden="true">${esc(code)}</p>
    <p class="qrurl">${esc(shareUrl())}</p>
    ${still ? `<p class="qrnote">Delen staat stil: spelers zien het gevecht na Opnieuw delen.</p>` : ""}
    <button type="button" class="btn qrclose" data-qr="sluit">Sluit</button></div>`;
  el.addEventListener("click", (e) => { if (e.target.closest("[data-qr=sluit]")) closeQr(); });
  el.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeQr(); } else e.stopPropagation(); });
  for (const x of document.body.children) if (!x.inert) { x.inert = true; x.dataset.qrInert = "1"; } // rest van de pagina dicht (Tab, N/spatie)
  document.body.append(el);
  fitQr();
  addEventListener("resize", fitQr);
  el.querySelector(".qrclose").focus();
}
function closeQr() {
  const el = document.querySelector("#qrfull");
  if (!el) return;
  el.remove(); removeEventListener("resize", fitQr);
  for (const x of document.querySelectorAll("[data-qr-inert]")) { x.inert = false; delete x.dataset.qrInert; }
  const f = qrFrom && qrFrom.isConnected ? qrFrom : document.querySelector('#kamer-box [data-kamer="qr"]');
  qrFrom = null;
  f?.focus();
}

/** Tabblad gestopt (DA3): verbinding dicht zonder de kamer te vergeten; het andere tabblad deelt verder met dezelfde code */
export function dropSharing() { disconnect(); }

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
    if (k === "start") { room = null; saveRoom(null); start(); }
    else if (k === "stop") stop(true);
    else if (k === "weer") shareAgain();
    else if (k === "qr") openQr(b);
    else if (k === "nieuw") { ask = true; paint(); $('#kamer-box [data-kamer="nieuw-nee"]')?.focus(); } // focus niet op de knop die alles loskoppelt
    else if (k === "nieuw-nee") { ask = false; paint(); $('#kamer-box [data-kamer="nieuw"]')?.focus(); }
    else if (k === "nieuw-ja") newCode();
    else if (k === "copy") copy();
    else if (k === "resume") ch && ch.resume();
    else if (k === "hervat") resume();
    else if (k === "deel") navigator.share({ title: `${APP} · spelersscherm`, text: `Volg het gevecht: code ${fmtCode(room.code)}`, url: shareUrl() }).catch(() => {});
  });
  $("#toast")?.addEventListener("click", (e) => {
    if (e.target.closest("#toast-kamer")) resume();
    else if (e.target.closest("#toast-weer")) { closeToast(); if (room && room.stopped) shareAgain(); }
  });
  room = loadRoom();
  if (room && !room.stopped) connect(); // gestopt (SC7): niet vanzelf weer delen
  paint();
}
