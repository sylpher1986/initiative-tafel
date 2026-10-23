// Spelersscherm: toont alleen de snapshot die het DM-scherm stuurt (js/playerview.js), nooit eigen data.
import { APP } from "./version.js";
import { cleanView, headHtml, findMe, meState, buzzFor, dsText, logLines, pushLog } from "./playerview.js";
import { ORD } from "./rules/spells.js";
import { localChannel, roomChannel, normCode, fmtCode } from "./share.js";
import { esc } from "./ui/util.js";
import { icon } from "./ui/avatar.js";
import { tvPlan } from "./tvfit.js";
import { qrSvg } from "./qr.js";
import { CINFO } from "./rules/conditions.js";
import { openCond, closeCond, condOpen, condSheetClick } from "./ui/condinfo.js";

const $ = (s) => document.querySelector(s);
const ST_CLS = { Ongedeerd: "ok", Gewond: "ok", Bloodied: "mid", "Bijna dood": "low", Bewusteloos: "low", Stabiel: "mid", Neer: "out", Dood: "out" };

function av(c) {
  if (c.kind === "lair") return `<span class="av" aria-hidden="true"></span>`;
  if (c.img) return `<span class="av img" aria-hidden="true"><img src="${esc(c.img)}" alt=""></span>`;
  return `<span class="av" aria-hidden="true">${icon(c.icon)}</span>`;
}

function hp(c) {
  const h = c.hp;
  if (!h) return "";
  const st = h.st ? `<span class="pvst ${ST_CLS[h.st] || ""}">${esc(h.st)}</span>` : "";
  if (h.max == null) return st;
  const pct = h.max ? Math.max(0, Math.min(1, h.hp / h.max)) : 0;
  const cls = pct <= 0.25 ? "low" : pct <= 0.5 ? "mid" : "";
  return `<div class="hpw"><div class="bar" aria-hidden="true"><i class="${cls}" style="width:${pct * 100}%"></i></div>
    <span class="hpn">${h.hp}/${h.max}${h.temp ? ` <span class="thp">+${h.temp}</span>` : ""}</span></div>${h.hp <= 0 ? st : ""}`;
}

const dsB = (c) => (c.ds ? `<span class="bd r">${dsText(c.ds)}</span>` : "");
/** RE10: welke uitleg bij een tag hoort ("Exhaustion 3" → niveau 3, "Concentrating · Bless" → Concentrating); null = geen */
function tagKey(t) {
  const x = /^Exhaustion (\d)$/.exec(t);
  if (x) return { key: "Exhaustion", lvl: +x[1] };
  const k = String(t).split(" · ")[0];
  return CINFO[k] ? { key: k, lvl: 0 } : null;
}
/** Tags; met uitleg tikbaar (telefoon), op de tv alleen tekst (niet tikbaar, kort) */
const tagsB = (c) => (c.tags || []).map((t, i) => {
  const k = !TV_MQ.matches && tagKey(t);
  return k ? `<button type="button" class="bd cc cinf" data-cinfo="${esc(k.key)}" data-cid="${esc(c.id)}" data-ti="${i}"${k.lvl ? ` data-lvl="${k.lvl}"` : ""} aria-label="${esc(t)}: uitleg">${esc(t)}</button>`
    : `<span class="bd cc">${esc(t)}</span>`;
}).join("");

function row(c, V, meId) {
  const turn = c.id === V.active || (V.group || []).includes(c.id), nxt = c.id === V.next, me = c.id === meId;
  const ds = dsB(c), tags = tagsB(c);
  return `<li class="pvc ${c.kind} ${turn ? "turn" : ""} ${c.out ? "out" : ""}${me ? " me" : ""}">
    <span class="pvi">${c.init != null ? c.init : ""}${turn ? `<span class="tri" aria-hidden="true">▶</span>` : ""}</span>
    <span class="pvn">${av(c)}<span class="nm">${esc(c.name)}</span>${me ? `<span class="pvnext">jij</span>` : nxt ? `<span class="pvnext">volgende</span>` : ""}</span>
    <span class="pvhp">${hp(c)}</span>
    ${tags || ds ? `<div class="badges">${ds}${tags}</div>` : ""}
  </li>`;
}

/* ---------- "Dit ben ik" (SC5): per apparaat, geen account; de DM weet er niets van ---------- */
const ME_KEY = "it-pv-me";
let me = readMe(), lastV = null, prevMs = null, pickOpen = false;
function readMe() {
  try {
    const o = JSON.parse(localStorage.getItem(ME_KEY) || "null");
    return o && typeof o.id === "string" ? { id: o.id.slice(0, 40), name: typeof o.name === "string" ? o.name.slice(0, 120) : "", buzz: o.buzz !== false } : null;
  } catch { return null; }
}
function saveMe() {
  try { me ? localStorage.setItem(ME_KEY, JSON.stringify(me)) : localStorage.removeItem(ME_KEY); } catch { /* privémodus: alleen deze sessie */ }
}
const canBuzz = () => typeof navigator.vibrate === "function";

/** Eigen kaart: HP, death saves, tags, slots/daily/resources. Alleen-lezen. */
function meCard(c) {
  if (!c) return `<p class="pvmiss">${esc(me.name || "Je personage")} staat nu niet in de lijst. <button type="button" class="link" data-mepick="1">Kies opnieuw</button></p>`;
  const sl = c.sl || { s: [], d: [], r: [] }, b = (t, x) => `<span class="bd b">${esc(t)} ${x.left}/${x.max}</span>`;
  const slots = [...sl.s.map((x) => b(ORD[x.l] || `${x.l}th`, x)), ...sl.d.map((x) => b(x.n, x)), ...sl.r.map((x) => b(x.n, x))].join("");
  const ds = dsB(c), tags = tagsB(c);
  return `<div class="pvmehead">${av(c)}<b class="nm">${esc(c.name)}</b></div>
    <div class="pvhp">${hp(c)}</div>
    ${ds || tags ? `<div class="badges">${ds}${tags}</div>` : ""}
    ${slots ? `<div class="badges pvsl"><span class="l">Slots</span>${slots}</div>` : ""}`;
}

function paintMe(V, row0) {
  const btn = $("#pv-me"), card = $("#pv-mecard");
  const pcs = V ? V.list.filter((c) => c.kind === "pc") : [];
  btn.hidden = !pcs.length && !me;
  btn.textContent = me ? `Jij: ${me.name || "?"}` : "Wie ben jij?";
  btn.setAttribute("aria-expanded", String(pickOpen));
  card.hidden = !me || !V;
  card.innerHTML = me && V ? meCard(row0) : "";
  paintPick(pcs);
}

let pickSig = null; // handtekening van het open paneel: alleen opnieuw opbouwen als de spelers of de keuze veranderen
function paintPick(pcs) {
  const el = $("#pv-mepick");
  el.hidden = !pickOpen;
  if (!pickOpen) { if (pickSig != null) { el.innerHTML = ""; pickSig = null; } return; }
  const sig = pcs.map((c) => `${c.id}|${c.name}`).join("\n") + "\n" + (me ? me.id : "");
  if (sig === pickSig) return; // focus, schermlezer en het vinkje Trillen blijven staan
  const f = document.activeElement && el.contains(document.activeElement) ? document.activeElement.dataset.me : undefined;
  const bz = $("#pv-buzz");
  const buzzOn = bz ? bz.checked : !me || me.buzz;
  pickSig = sig;
  // alfabetisch, niet in initiative-volgorde: een wijziging tijdens het tikken verschuift de knoppen niet
  const list = [...pcs].sort((a, b) => a.name.localeCompare(b.name, "nl"));
  el.innerHTML = `<h2 id="pv-mepick-h">Welk personage ben jij?</h2>
    ${list.length ? list.map((c) => `<button type="button" class="btn tap pvpickb" data-me="${esc(c.id)}" aria-pressed="${!!me && me.id === c.id}">${av(c)}<span class="nm">${esc(c.name)}</span></button>`).join("")
      : `<p class="hint">Er staan nog geen spelers in de lijst.</p>`}
    <button type="button" class="btn tap" data-me="">Niemand, ik kijk alleen mee</button>
    ${canBuzz() ? `<label class="chk"><input type="checkbox" id="pv-buzz" ${buzzOn ? "checked" : ""}> Trillen als ik bijna aan de beurt ben</label>` : ""}
    <button type="button" class="link" data-mepick="0">Sluit</button>`;
  if (f !== undefined) { const b = el.querySelector(`[data-me="${CSS.escape(f)}"]`); if (b) b.focus(); }
}

/** Focus naar de knop, of naar de wachttekst als die er niet is (geen spelers en geen keuze) */
function focusBack() {
  const b = $("#pv-me");
  if (!b.hidden) b.focus();
  else { const w = $("#pv-wait"); w.tabIndex = -1; w.focus(); }
}

function setPick(open) {
  pickOpen = open;
  paintMe(lastV, findMe(lastV, me));
  if (open) { const el = $("#pv-mepick"); (el.querySelector('[aria-pressed="true"]') || el.querySelector("button")).focus(); }
  else focusBack();
}

function bindMe() {
  $("#pv-me").addEventListener("click", () => setPick(!pickOpen));
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-me],[data-mepick]");
    if (!t) return;
    if (t.dataset.mepick != null) { setPick(t.dataset.mepick === "1"); return; }
    const id = t.dataset.me, c = lastV && lastV.list.find((x) => x.id === id);
    const buzz = $("#pv-buzz") ? $("#pv-buzz").checked : true;
    me = id && c ? { id, name: c.name, buzz } : null;
    saveMe();
    prevMs = null; // geen trilling bij het kiezen zelf
    pickOpen = false;
    if (lastV) paint(lastV); else paintMe(null, null);
    focusBack();
  });
  document.addEventListener("change", (e) => {
    if (e.target.id !== "pv-buzz" || !me) return;
    me.buzz = e.target.checked; saveMe();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (condOpen()) closeCond(); else if (pickOpen) setPick(false);
  });
  // RE10: uitleg bij een conditie; duur en herhaalsave uit de snapshot (de DM-app bepaalt wat spelers zien)
  document.addEventListener("click", (e) => {
    if (condSheetClick(e)) return;
    const b = e.target.closest("button[data-cinfo]");
    if (!b) return;
    const c = lastV && lastV.list.find((x) => x.id === b.dataset.cid), td = c && c.td && c.td[+b.dataset.ti];
    openCond(b, { lvl: +b.dataset.lvl || 0, rows: [["Duur", td && td.d], ["Herhaalsave", td && td.s]] });
  });
}

function paint(V) {
  $("#pv-wait").hidden = true;
  // "stand van" = laatste wijziging, niet ontvangst: de herpush na herverbinden telt niet. Een (bewaarde) stand zegt niets
  // over de DM: dat doet alleen dmnet.
  const j = JSON.stringify(V);
  if (j !== lastJson) { lastJson = j; lastAt = Date.now(); }
  const wasLost = netLost; // vóór netOk(): na verbinding kwijt niet trillen om een oude overgang
  paused = false; netOk();
  log = V.nolog ? [] : pushLog(log, logLines(lastV, V), V.round); // SC9
  lastV = V;
  const mine = findMe(V, me);
  if (mine && (mine.id !== me.id || mine.name !== me.name)) { me.id = mine.id; me.name = mine.name; saveMe(); } // id (op naam gevonden) of naam (DM hernoemde) bijwerken
  const meId = mine ? mine.id : null, ms = meState(V, meId);
  const pat = me && me.buzz && !wasLost ? buzzFor(prevMs, ms) : null;
  prevMs = ms;
  if (pat && canBuzz()) try { navigator.vibrate(pat); } catch { /* geen probleem */ }
  $("#pv-now").innerHTML = headHtml(V, meId);
  $("#pv-now").classList.toggle("me", ms === "turn");
  paintLog();
  stickOff();
  paintMe(V, mine);
  // dode monsters niet in de volgorde maar als één regel onderaan (zoals het blok "Neer" bij de DM)
  // (buiten de lijst, zodat hij bij twee kolommen onder beide kolommen staat)
  const down = V.list.filter((c) => c.kind === "monster" && c.out);
  const rows = V.list.filter((c) => !down.includes(c));
  const L = $("#pv-list");
  L.innerHTML = rows.map((c) => row(c, V, meId)).join("");
  $("#pv-down").hidden = !down.length;
  $("#pv-down").innerHTML = down.length ? `<span class="l">Neer</span> ${down.map((c) => esc(c.name)).join(", ")}` : "";
  tvQr(); fitTv();
  const el = document.querySelector(".pvc.turn");
  if (el) {
    const r = el.getBoundingClientRect(), top = $("#pv-stick").getBoundingClientRect().bottom; // onder de vaste kop (SC4)
    if (r.top < top || r.bottom > innerHeight) el.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
}

/* ---------- SC9: wat er net gebeurde (telefoon 2 regels in de vaste kop, tv 3) ---------- */
let log = [];
function paintLog() {
  const el = $("#pv-log"), L = log.slice(TV_MQ.matches ? -3 : -2);
  el.hidden = !L.length;
  el.innerHTML = L.map((e) => `<li>${esc(e.t)}</li>`).join("");
}

/* ---------- tv (SC6): één brede regel per deelnemer, letter passend op de hoogte; QR vóór het gevecht (SC1) ---------- */
const TV_MQ = matchMedia("(orientation:landscape) and (min-width:900px) and (min-height:501px)");
let tvSig = "";
const vis = (s) => !$(s).hidden;
/** Opnieuw passend maken alleen als de opbouw verandert (of het overloopt): een beurtwissel laat de letter staan */
function fitTv(force) {
  const b = document.body, tv = TV_MQ.matches;
  b.classList.toggle("tv", tv);
  if (!tv) { b.classList.remove("cols"); b.style.removeProperty("--tvfs"); tvSig = ""; return; }
  const n = $("#pv-list").children.length;
  const sig = [n, vis("#pv-mecard"), vis("#pv-log"), vis("#pv-down"), vis("#pv-net"), vis("#pv-wait"), vis("#pv-tag"), vis("#pv-qr"), !!$("#pv-now").innerHTML, !!document.fullscreenElement, innerWidth, innerHeight].join();
  const doc = document.documentElement, over = () => doc.scrollHeight > innerHeight + 1;
  // past het niet eens op de kleinste maat, dan is overlopen geaccepteerd (geen nieuwe zoektocht bij elke stand)
  if (!force && (sig === tvSig || sig + "|over" === tvSig) && (tvSig.endsWith("|over") || !over())) return;
  b.style.setProperty("--rows", Math.max(1, Math.ceil(n / 2)));
  const set = (f, cols) => { b.style.setProperty("--tvfs", f + "px"); b.classList.toggle("cols", cols); };
  const { f, cols } = tvPlan(innerHeight, (f, cols) => { set(f, cols); return !over(); });
  set(f, cols);
  tvSig = over() ? sig + "|over" : sig;
}
let tvRaf = 0;
const refit = () => { cancelAnimationFrame(tvRaf); tvRaf = requestAnimationFrame(() => fitTv(true)); };

/** Tagline (overal) en QR op de tv, beide alleen in de wachtstand: geen stand, geen ronde of pauze.
 *  De QR alleen via een kamer (het lokale kanaal heeft geen code). */
let qrFor = "";
function tvQr() {
  const idle = paused || !lastV || !lastV.round;
  $("#pv-tag").hidden = !idle; // WP16: tagline alleen in de wachtstand, weg zodra er een gevecht is
  const el = $("#pv-qr"), on = TV_MQ.matches && !!room && !!code && idle;
  el.hidden = !on;
  document.body.classList.toggle("qr", on);
  if (!on || qrFor === code) return;
  qrFor = code;
  const url = `${location.origin}/speler?k=${code}`;
  el.innerHTML = `${qrSvg(url, `QR-code om mee te kijken, kamer ${code.split("").join(" ")}`)}<p>Meekijken op je telefoon · <b>${esc(fmtCode(code))}</b></p>`;
}

/* ---------- scherm aan houden en volledig scherm (tv/tablet) ---------- */
let lock = null;
async function keepAwake() {
  try { if ("wakeLock" in navigator && document.visibilityState === "visible") lock = await navigator.wakeLock.request("screen"); } catch { /* niet toegestaan: geen probleem */ }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && (!lock || lock.released)) keepAwake(); });

function boot() {
  const fs = $("#pv-full");
  if (!document.documentElement.requestFullscreen) fs.hidden = true;
  fs.addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  });
  keepAwake();
  bindMe();
  addEventListener("resize", refit);
  document.addEventListener("fullscreenchange", refit);
  TV_MQ.addEventListener?.("change", () => { tvQr(); refit(); }); // tags: tikbaar of niet volgt bij de volgende stand (paint heeft bijwerkingen: pauze, net)
  document.fonts?.ready.then(refit); // meten vóór de letters geladen zijn is te vroeg
  paintMe(null, null);
  // SC4: hoogte van de vaste kop, zodat scrollIntoView de beurt er niet onder zet (scroll-margin-top)
  const stick = $("#pv-stick");
  const setStick = () => document.documentElement.style.setProperty("--stick", `${Math.ceil(stick.getBoundingClientRect().height)}px`);
  if ("ResizeObserver" in window) new ResizeObserver(setStick).observe(stick);
  setStick();

  // lokaal (ander venster op dit apparaat) luistert altijd mee; een kamercode (?k= of invoeren) verbindt via internet
  const ch = localChannel();
  if (ch) {
    ch.on(handler(ch));
    ch.send({ t: "hallo" });
  }
  $("#pv-join").addEventListener("submit", (e) => { e.preventDefault(); tryJoin(true); });
  $("#pv-code").addEventListener("input", () => tryJoin(false));
  const k = normCode(new URLSearchParams(location.search).get("k"));
  if (k) join(k);
  else showJoin(ch ? "" : "Deze browser kan geen tweede venster koppelen; vul de code van de DM in.");
}

/* ---------- kamer (andere apparaten) ---------- */
let room = null, code = "";

/* ---------- verbinding kwijt / DM weg (SC3) ----------
 * Eigen verbinding kwijt: meteen een opvallende balk en de lijst gedimd, na LOST_MS de lijst weg (een oude stand leest op
 * een tv als live). DM weg (kamer meldt dmnet on:0): pas na DM_MS een neutrale balk, lijst blijft (er gebeurt alleen niets).
 * Bij een pauze geen balken: daar geldt de pauzetekst. */
const LOST_MS = 120000, DM_MS = 45000;
let lastAt = 0, lastJson = "", paused = false, netLost = false, lostT = 0, dmT = 0, dmGone = false;
const hhmm = (t) => new Date(t).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
const since = () => (lastAt ? ` · stand van ${hhmm(lastAt)}` : "");

function bar() {
  const el = $("#pv-net");
  const kind = paused ? "" : netLost ? "lost" : dmGone && lastAt ? "dm" : ""; // pauze: alleen de pauzetekst
  el.hidden = !kind;
  el.className = "pvnet" + (kind ? " " + kind : "");
  el.innerHTML = kind === "lost" ? `<b>Geen verbinding${since()}</b><span>Opnieuw verbinden…</span>`
    : kind === "dm" ? `<b>De DM is even weg${since()}</b><span>Het gevecht gaat hier verder zodra de DM terug is.</span>` : "";
  document.body.classList.toggle("stale", kind === "lost" && !!lastAt);
  stickOff();
  fitTv();
}
/** Lege vaste kop (geen beurt, geen balk) neemt geen ruimte in (geen :has, oudere iPads) */
const stickOff = () => $("#pv-stick").classList.toggle("off", !$("#pv-now").innerHTML && $("#pv-net").hidden);
function netLostNow() {
  if (netLost) return;
  netLost = true; prevMs = null; bar(); // na herverbinden niet trillen om een oude overgang
  clearTimeout(lostT);
  lostT = setTimeout(() => {
    if (!netLost || paused || !lastAt) return;
    clear();
    $("#pv-wait").hidden = false;
    $("#pv-wait").textContent = "Geen verbinding. Zodra die terug is, verschijnt het gevecht hier vanzelf.";
    tvQr(); fitTv();
  }, LOST_MS);
}
function netOk() { clearTimeout(lostT); if (netLost) { netLost = false; bar(); } }
function dmAway() { if (dmGone || dmT) return; dmT = setTimeout(() => { dmT = 0; dmGone = true; bar(); }, DM_MS); } // na herverbinden niet opnieuw beginnen
function dmBack() { clearTimeout(dmT); dmT = 0; if (dmGone) { dmGone = false; bar(); } }

function handler(c) {
  return (m) => {
    if (m.t === "dm") c.send({ t: "hallo" }); // DM-scherm (opnieuw) gestart, of kamer (opnieuw) verbonden
    else if (m.t === "stand") { const V = cleanView(m.d); if (V) { $("#pv-join").hidden = true; paint(V); } }
    else if (c === room && m.t === "einde") leave("De DM deelt niet meer met deze code. Vraag de nieuwe code.");
    else if (c === room && m.t === "stop") pause();
    else if (c === room && m.t === "dmnet") m.on ? dmBack() : dmAway();
    else if (c === room && m.t === "net") {
      if (m.s === "kwijt") netLostNow();
      else if (m.s === "open") { // de kamer stuurt bij verbinden de DM-status (dmnet)
        netOk();
        if (!lastAt && !paused && !$("#pv-wait").hidden) $("#pv-wait").textContent = "Verbonden, wacht op de DM…";
      }
      if (m.s === "weg") leave(`Kamer ${fmtCode(code)} bestaat niet (meer). Vraag de DM om een nieuwe code.`);
    }
  };
}

function join(k) {
  if (room) room.close();
  code = k;
  room = roomChannel(k);
  room.on(handler(room));
  $("#pv-join").hidden = true;
  $("#pv-wait").hidden = false;
  $("#pv-wait").textContent = `Verbinden met kamer ${fmtCode(k)}…`;
  try { history.replaceState(null, "", `?k=${k}`); } catch { /* geen probleem */ }
  tvQr(); fitTv();
}

/** Stand weg (verouderd of gestopt) */
function clear() {
  clearTimeout(lostT); clearTimeout(dmT); dmT = 0; netLost = dmGone = false; lastAt = 0; lastJson = ""; bar();
  $("#pv-now").innerHTML = ""; $("#pv-list").innerHTML = "";
  $("#pv-down").hidden = true; $("#pv-down").innerHTML = "";
  log = []; paintLog();
  const had = $("#pv-mepick").contains(document.activeElement);
  $("#pv-now").classList.remove("me"); lastV = null; prevMs = null; pickOpen = false; paintMe(null, null);
  stickOff();
  if (had) focusBack();
}

/**
 * DM pauzeerde het delen (30 min zonder wijziging): verbinding blijft open, geen invoerveld, ?k= blijft.
 * De oude stand gaat weg: op een tv leest een gedimde lijst nog als live. De volgende stand verschijnt vanzelf (paint).
 */
function pause() {
  clear(); paused = true;
  $("#pv-join").hidden = true;
  $("#pv-wait").hidden = false;
  $("#pv-wait").innerHTML = `<b class="pvpause">De DM deelt op dit moment niet.</b><br>Zodra de DM weer deelt, verschijnt het gevecht hier vanzelf. · Kamer ${esc(fmtCode(code))}`;
  tvQr(); fitTv();
}

function leave(msg) {
  if (room) room.close();
  room = null;
  clear();
  try { history.replaceState(null, "", location.pathname); } catch { /* geen probleem */ }
  showJoin(msg);
  tvQr(); fitTv();
}

function showJoin(msg) {
  $("#pv-wait").hidden = !msg;
  $("#pv-wait").textContent = msg || "";
  $("#pv-join").hidden = false;
  $("#pv-joinmsg").classList.remove("err");
  $("#pv-joinmsg").textContent = `Of open ${APP} in een ander venster van deze browser.`;
}

/** submit: ook een foutmelding; tijdens het typen: alleen verbinden zodra er 6 geldige tekens staan */
function tryJoin(submit) {
  const k = normCode($("#pv-code").value);
  if (k) { $("#pv-code").blur(); join(k); return; }
  if (!submit) return;
  $("#pv-joinmsg").classList.add("err");
  $("#pv-joinmsg").textContent = "Een code heeft 6 tekens, bijvoorbeeld K7M 3QX.";
}

boot();
