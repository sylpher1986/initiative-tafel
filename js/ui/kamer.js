// "Delen met spelers": spelersscherm op andere apparaten via een kamer op de Worker (js/share.js, worker/room.js).
// Staat in Instellingen → Spelersscherm. Kamer (code + DM-token) in localStorage: na herladen loopt het delen door.
// Alleen UI- en verbindingstoestand: niets hiervan zit in undo, opslag of export.
import { APP } from "../version.js";
import { roomChannel, dmLink, createRoom, normCode, fmtCode } from "../share.js";
import { $, esc, toast, toastHtml, closeToast, toastBad } from "./util.js";
import { canWrite } from "../storage.js";
import { qrSvg } from "../qr.js";
import { t } from "../i18n/boot.js";
import { joinUrl } from "../i18n/lang.js";

const KEY = "it-room";
const LOST_MS = 10000; // pas na 10 s kwijt: rode stip op ⚙ en één melding
const ROOM_MS = 12 * 3600e3; // = IDLE_MS in worker/room.js: een gestopte kamer verloopt 12 u na het stoppen

let getView = null, addLink = null;
let room = null, ch = null, link = null, off = null;
let st = "off", n = 0, err = "", lostT = 0, warned = false; // st = verbindingscode (geen tekst); err = catalogussleutel of ""
// pauze: de kamer stopte het delen na 30 min zonder gewijzigde stand. missed = melding "Spelers zien dit niet" al getoond (één per pauze)
let paused = false, resuming = false, missed = false;
let mapBusy = false; // WP72: kaartbeeld onderweg naar de kamer (hint in de kaartviewer)
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

const shareUrl = () => joinUrl(location.origin, document.documentElement.lang, room.code); // WP44: pagina van de eigen taal, zonder doorverwijzing
/** Gestopt en (vrijwel zeker) verlopen: niet meer dezelfde code beloven. Klok verzet (at in de toekomst) telt als verlopen. */
export const expired = (r, now = Date.now()) => !!r?.stopped && !(now - r.at < ROOM_MS - 60e3 && r.at <= now + 60e3);

function lost(on) {
  clearTimeout(lostT); lostT = 0;
  if (!on) { document.documentElement.classList.remove("kamer-lost"); warned = false; changed(); return; }
  lostT = setTimeout(() => {
    document.documentElement.classList.add("kamer-lost"); changed();
    if (!warned) { warned = true; toastBad(t("init.room.lostToast")); }
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
  lost(false); n = 0; mapBusy = false; setPaused(false);
}

function connect() {
  disconnect();
  ch = roomChannel(room.code, room.token, { allow: canWrite });
  off = ch.on((m) => {
    if (m.t === "n") { n = Math.max(0, m.n | 0); paint(); }
    else if (m.t === "mapst") { if (mapBusy !== !!m.busy) { mapBusy = !!m.busy; changed(); } }
    else if (m.t === "pauze") { if (!paused) { setPaused(true); paint(); } }
    else if (m.t === "hervat") { const was = paused || again; again = false; setPaused(false); paint(); if (was) toast(t("init.room.back")); }
    else if (m.t === "gemist") {
      // eenmalig per pauze; samen met een melding met Ongedaan (zelfde render, < 300 ms) wordt het één melding met beide knoppen
      if (!missed && !resuming) { missed = true; toastHtml(`${esc(t("init.room.missed"))} <button class="tundo" id="toast-kamer">${esc(t("init.room.again"))}</button>`); }
    }
    else if (m.t === "net") {
      st = m.s;
      lost(m.s === "kwijt");
      if (m.s === "gone") {
        disconnect(); room = null; saveRoom(null); st = "off"; closeQr();
        if (again) { again = false; return void start(true); } // Opnieuw delen na Stop, maar de kamer verliep: stil een nieuwe
        err = "init.room.expired";
      }
      paint();
    }
  });
  link = dmLink(ch, getView);
  addLink(link, true);
}

async function start(old) {
  if (st === "making") return;
  st = "making"; err = ""; ask = false; again = false; paint();
  try {
    room = await createRoom();
    saveRoom(room);
    connect();
    if (old) toast(t("init.room.oldExpired", { code: fmtCode(room.code) }));
  } catch (e) {
    st = "off"; err = errText(e);
  }
  paint();
}
/** Foutcode van createRoom → catalogussleutel (vertaald bij het tekenen) */
const errText = (e) => (e.message === "offline" ? "init.room.offline" : e.message === "rate" ? "init.room.rate" : "init.room.fail");

/** Kanaal loskoppelen zonder het te sluiten (stop/wis sluit het zelf); opnieuw delen krijgt een eigen kanaal */
function detach() {
  const c = ch; ch = null;
  if (off) off(); off = null;
  if (link) addLink(link, false); link = null;
  lost(false); n = 0; mapBusy = false; setPaused(false);
  return c;
}

/** SC7: Stop met delen = de kamer pauzeert; code en token blijven (12 u), na herladen niet vanzelf weer delen */
async function stop(fromBtn = false) {
  const c = detach();
  room = { code: room.code, token: room.token, stopped: true, at: Date.now() };
  saveRoom(room); st = "off"; err = ""; ask = false; again = false;
  paint();
  // AF10: geen "Zeker?" (Stop = pauze, omkeerbaar met dezelfde code), wel de weg terug in de melding
  if (fromBtn) toastHtml(`${esc(t("init.room.stopped", { code: fmtCode(room.code) }))} <button class="tundo" id="toast-weer">${esc(t("init.room.again"))}</button>`);
  if (!c) return;
  stopping = c;
  const ok = await c.stop();
  if (stopping !== c) return; // intussen Opnieuw delen of Nieuwe code: dit "stop" telt niet meer
  stopping = null;
  if (!ok) toastBad(t("init.room.stopFail"));
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
  try { await navigator.clipboard.writeText(shareUrl()); toast(t("init.room.copied")); }
  catch { toastBad(t("init.room.copyFail")); }
}

/** AF5: korte status voor de kop van de sectie Spelersscherm; warn = zelfde rode stip als op ⚙ */
export function kamerStat() {
  const h = document.documentElement.classList, warn = h.contains("kamer-lost") || h.contains("kamer-pauze");
  if (!room || expired(room)) return { t: t("init.room.stNone"), warn };
  const c = fmtCode(room.code);
  if (room.stopped) return { t: t("init.room.stStopped", { code: c }), warn }; // bewuste actie: geen stip
  if (paused && st !== "elders") return { t: t("init.room.stPaused", { code: c }), warn: true };
  if (st === "kwijt" || h.contains("kamer-lost")) return { t: t("init.room.stLost"), warn: true };
  if (st === "elders") return { t: t("init.room.stElse"), warn };
  if (st === "open") return { t: t("init.room.stOpen", { code: c, n }), warn };
  return { t: t("init.room.connecting"), warn };
}
const changed = () => document.dispatchEvent(new Event("it-kamer"));
/** WP72: kamer waar spelers nu meekijken ({ code, busy: kaartbeeld onderweg }), of null (geen, gestopt, gepauzeerd, verbinding weg) */
export function roomMap() {
  if (!room || room.stopped || paused || st !== "open" || document.documentElement.classList.contains("kamer-lost")) return null;
  return { code: fmtCode(room.code), busy: mapBusy };
}

const codeHtml = (still) => `<p class="kamer-code${still ? " stil" : ""}" aria-label="${esc(t("init.room.codeAria", { code: room.code.split("").join(" ") }))}">${esc(fmtCode(room.code))}</p>
    <p class="kamer-url">${esc(shareUrl())}</p>`;
const qrBtn = () => `<button type="button" class="btn tap" data-kamer="qr" aria-haspopup="dialog">${esc(t("init.room.qr"))}</button>`;
/** "Nieuwe code…" alleen als het delen stilstaat (SC7): zeldzaam, en één mistik koppelt alle schermen los */
const newHtml = () => ask
  ? `<div class="confirmbox" role="group" aria-label="${esc(t("init.room.newAria"))}"><p class="hint">${esc(t("init.room.newWarn", { code: fmtCode(room.code) }))}</p>
      <div class="bar"><button type="button" class="btn primary tap" data-kamer="new-yes" ${making ? "disabled" : ""}>${esc(t(making ? "init.room.newBusy" : "init.room.newGo"))}</button><button type="button" class="btn tap" data-kamer="new-no">${esc(t("common.cancel"))}</button></div></div>`
  : `<div><button type="button" class="link" data-kamer="new" aria-expanded="false">${esc(t("init.room.new"))}</button></div>`;

function paint() {
  changed();
  const box = $("#kamer-box");
  if (!box) return;
  if (!room || expired(room)) {
    const exp = !!room; // gestopt en verlopen: de knop belooft geen zelfde code
    box.innerHTML = `<p class="hint">${esc(t("init.room.hint"))}</p>
      ${err ? `<p class="hint kamererr" role="alert">${esc(t(err))}</p>` : ""}
      <div class="bar"><button type="button" class="btn primary tap" data-kamer="start" ${st === "making" ? "disabled" : ""}>${esc(t(st === "making" ? "init.room.making" : exp ? "init.room.shareNew" : err === "init.room.expired" ? "init.room.again" : "init.room.share"))}</button></div>`;
    return;
  }
  if (room.stopped || (paused && st !== "elders")) {
    const why = t(room.stopped ? "init.room.whyStopped" : "init.room.whyPaused");
    const busy = resuming || again;
    // pauze na 30 min: Stop blijft (haalt de rode stip weg); gestopt: alleen opnieuw of een nieuwe code
    box.innerHTML = `${codeHtml(true)}
    <p class="kamer-st" aria-live="polite">${esc(why)}</p>
    ${err ? `<p class="hint kamererr" role="alert">${esc(t(err))}</p>` : ""}
    <div class="bar"><button type="button" class="btn primary tap" data-kamer="${room.stopped ? "weer" : "hervat"}" ${busy ? "disabled" : ""}>${esc(t(busy ? "init.room.againBusy" : "init.room.again"))}</button>${qrBtn()}${room.stopped ? "" : `<button type="button" class="btn tap" data-kamer="stop">${esc(t("init.room.stop"))}</button>`}</div>
    ${newHtml()}`;
    return;
  }
  // Opnieuw delen loopt: een verlopen kamer opent eerst en sluit dan met 4004; pas na de bevestiging "Gedeeld" tonen
  const status = t(again ? "init.room.connecting" : st === "open" ? (n ? "init.room.screens" : "init.room.nobody")
    : st === "elders" ? "init.room.else" : st === "kwijt" ? "init.room.lost" : "init.room.connecting", { n });
  const canShare = typeof navigator.share === "function";
  box.innerHTML = `${codeHtml(false)}
    <p class="kamer-st ${st === "open" && !again ? "on" : ""}" aria-live="polite">${esc(status)}</p>
    <div class="bar">${st === "elders" ? `<button type="button" class="btn primary tap" data-kamer="resume">${esc(t("init.room.resume"))}</button>` : ""}
      ${qrBtn()}${canShare ? `<button type="button" class="btn tap" data-kamer="deel">${esc(t("init.room.deel"))}</button>` : ""}<button type="button" class="btn tap" data-kamer="copy">${esc(t("init.room.copy"))}</button>
      <button type="button" class="btn tap" data-kamer="stop">${esc(t("init.room.stop"))}</button></div>`;
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
  el.innerHTML = `<div class="qrin"><h2 id="qrfull-h">${esc(t("init.room.scan"))}</h2>
    ${qrSvg(shareUrl(), t("init.room.qrAria", { code: room.code.split("").join(" ") }))}
    <p class="qrcode" aria-hidden="true">${esc(code)}</p>
    <p class="qrurl">${esc(shareUrl())}</p>
    ${still ? `<p class="qrnote">${esc(t("init.room.still"))}</p>` : ""}
    <button type="button" class="btn qrclose" data-qr="sluit">${esc(t("common.close"))}</button></div>`;
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
  // WP72: de kamer krijgt de snapshot mét kaart; roomChannel stuurt het beeld apart in stukken
  getView = view;
  addLink = links;
  if (!$("#kamer-box") && window.__itErr) window.__itErr("Sharing: the share box is missing from the page (old index.html?)"); // diagnose voor de ontwikkelaar, niet vertaald
  $("#kamer-box")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-kamer]");
    if (!b) return;
    const k = b.dataset.kamer;
    if (k === "start") { room = null; saveRoom(null); start(); }
    else if (k === "stop") stop(true);
    else if (k === "weer") shareAgain();
    else if (k === "qr") openQr(b);
    else if (k === "new") { ask = true; paint(); $('#kamer-box [data-kamer="new-no"]')?.focus(); } // focus niet op de knop die alles loskoppelt
    else if (k === "new-no") { ask = false; paint(); $('#kamer-box [data-kamer="new"]')?.focus(); }
    else if (k === "new-yes") newCode();
    else if (k === "copy") copy();
    else if (k === "resume") ch && ch.resume();
    else if (k === "hervat") resume();
    else if (k === "deel") navigator.share({ title: t("init.room.shareTitle", { app: APP }), text: t("init.room.shareText", { code: fmtCode(room.code) }), url: shareUrl() }).catch(() => {});
  });
  $("#toast")?.addEventListener("click", (e) => {
    if (e.target.closest("#toast-kamer")) resume();
    else if (e.target.closest("#toast-weer")) { closeToast(); if (room && room.stopped) shareAgain(); }
  });
  room = loadRoom();
  if (room && !room.stopped) connect(); // gestopt (SC7): niet vanzelf weer delen
  paint();
}
