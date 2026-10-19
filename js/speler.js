// Spelersscherm: toont alleen de snapshot die het DM-scherm stuurt (js/playerview.js), nooit eigen data.
import { cleanView } from "./playerview.js";
import { localChannel, roomChannel, normCode, fmtCode } from "./share.js";
import { esc } from "./ui/util.js";
import { icon } from "./ui/avatar.js";

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

function row(c, V) {
  const turn = c.id === V.active || (V.group || []).includes(c.id), nxt = c.id === V.next;
  const ds = c.ds ? `<span class="bd r">Death saves ✓${c.ds.s} ✗${c.ds.f}</span>` : "";
  const tags = (c.tags || []).map((t) => `<span class="bd cc">${esc(t)}</span>`).join("");
  return `<li class="pvc ${c.kind} ${turn ? "turn" : ""} ${c.out ? "out" : ""}">
    <span class="pvi">${c.init != null ? c.init : ""}${turn ? `<span class="tri" aria-hidden="true">▶</span>` : ""}</span>
    <span class="pvn">${av(c)}<span class="nm">${esc(c.name)}</span>${nxt ? `<span class="pvnext">volgende</span>` : ""}</span>
    <span class="pvhp">${hp(c)}</span>
    ${tags || ds ? `<div class="badges">${ds}${tags}</div>` : ""}
  </li>`;
}

function paint(V) {
  $("#pv-wait").hidden = true;
  const act = V.list.find((c) => c.id === V.active), nxt = V.list.find((c) => c.id === V.next);
  $("#pv-now").innerHTML = V.round
    ? `<div><span class="l">Ronde ${V.round} · aan de beurt</span><b>${V.gname ? esc(V.gname) : act ? esc(act.name) : "…"}</b></div>${nxt ? `<div class="r"><span class="l">Daarna</span>${esc(nxt.name)}</div>` : ""}`
    : `<div><span class="l">Nog geen gevecht</span><b>Rol initiative</b></div>`;
  // dode monsters niet in de volgorde maar als één regel onderaan (zoals het blok "Neer" bij de DM)
  // (buiten de lijst, zodat hij bij twee kolommen onder beide kolommen staat)
  const down = V.list.filter((c) => c.kind === "monster" && c.out);
  const rows = V.list.filter((c) => !down.includes(c));
  const L = $("#pv-list");
  L.innerHTML = rows.map((c) => row(c, V)).join("");
  // tv/tablet liggend: vanaf 7 regels twee kolommen (eerst links van boven naar beneden, dan rechts); CSS bepaalt wanneer
  document.body.classList.toggle("two", rows.length >= 7);
  $("#pv-down").hidden = !down.length;
  $("#pv-down").innerHTML = down.length ? `<span class="l">Neer</span> ${down.map((c) => esc(c.name)).join(", ")}` : "";
  const el = document.querySelector(".pvc.turn");
  if (el) {
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) el.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
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

function handler(c) {
  return (m) => {
    if (m.t === "dm") c.send({ t: "hallo" }); // DM-scherm (opnieuw) gestart, of kamer (opnieuw) verbonden
    else if (m.t === "stand") { const V = cleanView(m.d); if (V) { $("#pv-join").hidden = true; paint(V); } }
    else if (c === room && m.t === "einde") leave("De DM deelt niet meer.");
    else if (c === room && m.t === "net") {
      $("#pv-net").hidden = m.s !== "kwijt";
      $("#pv-net").textContent = "Verbinding kwijt, opnieuw verbinden…";
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
}

function leave(msg) {
  if (room) room.close();
  room = null;
  $("#pv-net").hidden = true;
  $("#pv-now").innerHTML = ""; $("#pv-list").innerHTML = "";
  $("#pv-down").hidden = true; $("#pv-down").innerHTML = ""; document.body.classList.remove("two");
  try { history.replaceState(null, "", location.pathname); } catch { /* geen probleem */ }
  showJoin(msg);
}

function showJoin(msg) {
  $("#pv-wait").hidden = !msg;
  $("#pv-wait").textContent = msg || "";
  $("#pv-join").hidden = false;
  $("#pv-joinmsg").classList.remove("err");
  $("#pv-joinmsg").textContent = "Of open Initiative Tafel in een ander venster van deze browser.";
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
