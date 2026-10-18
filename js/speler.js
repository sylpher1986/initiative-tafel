// Spelersscherm: toont alleen de snapshot die het DM-scherm stuurt (js/playerview.js), nooit eigen data.
import { cleanView } from "./playerview.js";
import { localChannel } from "./share.js";
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
  const turn = c.id === V.active, nxt = c.id === V.next;
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
    ? `<div><span class="l">Ronde ${V.round} · aan de beurt</span><b>${act ? esc(act.name) : "…"}</b></div>${nxt ? `<div class="r"><span class="l">Daarna</span>${esc(nxt.name)}</div>` : ""}`
    : `<div><span class="l">Nog geen gevecht</span><b>Rol initiative</b></div>`;
  $("#pv-list").innerHTML = V.list.map((c) => row(c, V)).join("");
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

  const ch = localChannel();
  if (!ch) { $("#pv-wait").textContent = "Deze browser kan geen tweede venster koppelen. Gebruik een recente versie van Chrome, Edge, Firefox of Safari."; return; }
  ch.on((m) => {
    if (m.t === "dm") ch.send({ t: "hallo" }); // DM-scherm (opnieuw) gestart
    else if (m.t === "stand") { const V = cleanView(m.d); if (V) paint(V); }
  });
  ch.send({ t: "hallo" });
}

boot();
