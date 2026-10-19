// Verbinding DM-scherm → spelersscherm. Berichten:
//   { t: "dm" }               DM-scherm is (opnieuw) gestart/verbonden: spelersschermen melden zich
//   { t: "hallo" }            spelersscherm meldt zich: DM stuurt de huidige stand
//   { t: "stand", d: view }   snapshot uit toPlayerView (js/playerview.js)
// Twee transporten met dezelfde send/on/close-interface:
//   localChannel()            BroadcastChannel: vensters en tabbladen van dezelfde browser (ook zonder internet)
//   roomChannel(code, token)  WebSocket-kamer op de Worker (worker/room.js): andere apparaten via een kamercode
const NAME = "initiative-tafel-spelers";

/** Kanaal op dit apparaat, of null als de browser het niet kan */
export function localChannel() {
  if (typeof BroadcastChannel === "undefined") return null;
  const ch = new BroadcastChannel(NAME);
  const subs = new Set();
  ch.onmessage = (e) => { const m = e.data; if (m && typeof m.t === "string") subs.forEach((f) => f(m)); };
  return {
    send: (m) => { try { ch.postMessage(m); } catch { /* gesloten of niet te kopiëren: negeren */ } },
    on: (f) => { subs.add(f); return () => subs.delete(f); },
    close: () => ch.close(),
  };
}

/**
 * DM-kant. getView() maakt de snapshot. Rekent pas als er een spelersscherm is gezien,
 * en verstuurt alleen als er iets veranderde.
 */
const JSONS = new WeakMap(); // dezelfde snapshot (lokaal + kamer) maar één keer naar tekst
const toJson = (v) => { let j = JSONS.get(v); if (j == null) { j = JSON.stringify(v); JSONS.set(v, j); } return j; };

export function dmLink(ch, getView) {
  let live = false, last = "";
  const push = (force) => {
    if (!live) return;
    const v = getView(), j = toJson(v);
    if (!force && j === last) return;
    last = j;
    ch.send({ t: "stand", d: v });
  };
  ch.on((m) => { if (m.t === "hallo") { live = true; push(true); } });
  ch.send({ t: "dm" });
  return { update: () => push(false) };
}

/* ---------- kamer op de Worker ---------- */

export const CODE_RE = /^[2-9A-HJKMNP-TV-Z]{6}$/; // gelijk aan worker/room.js
/** Wat een speler intypt of in de link staat → code, of null. Spaties, streepjes en kleine letters mogen. */
export function normCode(v) {
  const c = String(v ?? "").toUpperCase().replace(/[\s\-·.]/g, "");
  return CODE_RE.test(c) ? c : null;
}
/** "K7M3QX" → "K7M 3QX" (voorlezen aan tafel) */
export const fmtCode = (c) => (c ? c.slice(0, 3) + " " + c.slice(3) : "");

/**
 * Portretten (data-url's) niet in elke snapshot: eruit halen en alleen nieuwe of gewijzigde apart sturen.
 * sent: Map id → laatst verstuurd portret (wordt bijgewerkt). Geeft { d, imgs: [{ id, d }] } terug; d: null = gewist.
 */
export function splitImgs(view, sent) {
  const imgs = [], now = new Set();
  const list = (view.list || []).map((c) => {
    if (!c.img) return c;
    now.add(c.id);
    if (sent.get(c.id) !== c.img) { imgs.push({ id: c.id, d: c.img }); sent.set(c.id, c.img); }
    return { ...c, img: null };
  });
  for (const id of [...sent.keys()]) if (!now.has(id)) { imgs.push({ id, d: null }); sent.delete(id); }
  return { d: { ...view, list }, imgs };
}

/** Backoff voor opnieuw verbinden: 1, 2, 4 … max 30 s, met wat spreiding zodat niet alle schermen tegelijk komen */
export const backoff = (n, rnd = Math.random) => Math.min(30000, 1000 * 2 ** Math.min(n, 5)) * (0.8 + 0.4 * rnd());

const PING = 25000, DEAD = 60000, PROBE = 5000;

/**
 * Kanaal via de kamer. token = DM (schrijft), zonder token = speler (alleen lezen).
 * Zelfde send/on/close als localChannel. Daarnaast komen via on():
 *   { t: "net", s }  s = "verbinden" | "open" | "kwijt" | "weg" (kamer bestaat niet/verlopen/geen toegang) | "elders" (DM in ander tabblad)
 *   { t: "n", n }    (DM) aantal verbonden spelersschermen
 *   { t: "pauze" }   (DM) kamer pauzeerde het delen (30 min zonder wijziging); tot hervat() gaat er geen stand meer heen
 *   { t: "hervat" }  (DM) kamer bevestigt hervat(); daarna volgt "hallo" (dmLink pusht)
 *   { t: "gemist" }  (DM) een gewijzigde stand tijdens de pauze: spelers zien hem niet
 *   { t: "stop" }    (speler) de DM deelt op dit moment niet; de verbinding blijft open, een nieuwe stand komt vanzelf
 * Bij elke (nieuwe) verbinding: DM-kant meldt { t: "hallo" } (dmLink pusht opnieuw), spelerskant { t: "dm" } (speler zegt hallo).
 * Spelerskant: portretten die apart binnenkomen worden weer in de stand gezet (cleanView controleert ze daarna).
 * opts: { base, WS, timers } voor tests.
 */
export function roomChannel(code, token, opts = {}) {
  const WS = opts.WS || globalThis.WebSocket;
  const T = opts.timers || globalThis;
  const base = opts.base || (location.protocol === "https:" ? "wss://" : "ws://") + location.host;
  const url = `${base}/api/room/${code}/ws${token ? "?t=" + encodeURIComponent(token) : ""}`;
  const subs = new Set(), sent = new Map(), imgs = new Map();
  let ws = null, tries = 0, retry = 0, ping = 0, lastIn = 0, done = false, state = "", paused = false, want = false, check = false;
  const emit = (m) => subs.forEach((f) => f(m));
  const net = (s) => { if (s !== state) { state = s; emit({ t: "net", s }); } };
  const raw = (s) => { if (ws && ws.readyState === 1) { try { ws.send(s); return true; } catch { /* dicht */ } } return false; };

  function connect() {
    if (done || (ws && ws.readyState <= 1)) return;
    T.clearTimeout(retry); retry = 0;
    net(tries ? "kwijt" : "verbinden");
    let s;
    try { s = new WS(url); } catch { return later(); }
    ws = s;
    s.onopen = () => {
      if (ws !== s) return;
      tries = 0; lastIn = Date.now();
      if (!token) imgs.clear(); // kamer stuurt bij "hallo" alle portretten opnieuw, vóór de stand
      net("open");
      T.clearInterval(ping);
      ping = T.setInterval(() => (Date.now() - lastIn > DEAD ? dead(s) : raw("ping")), PING);
      if (!token) return emit({ t: "dm" });
      // hervat() nog niet bevestigd (ook als hij onderweg verloren ging): opnieuw sturen; "hallo" volgt na de bevestiging
      if (want) return void raw(JSON.stringify({ t: "hervat" }));
      // gepauzeerd: geen herpush (de kamer negeert hem). De kamer stuurt "pauze" vóór "n"; komt "n" zonder "pauze",
      // dan is de pauze intussen opgeheven (bijv. in een ander tabblad) en gaat het hier ook weer verder.
      check = paused;
      if (!paused) emit({ t: "hallo" });
    };
    s.onmessage = (e) => {
      if (ws !== s) return;
      lastIn = Date.now();
      if (typeof e.data !== "string" || e.data === "pong") return;
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (!m || typeof m.t !== "string") return;
      if (!token && m.t === "img") { if (typeof m.id === "string") m.d ? imgs.set(m.id, m.d) : imgs.delete(m.id); return; }
      if (token && m.t === "pauze") { check = false; if (want) return; paused = true; } // tijdens hervat(): verouderd (van vóór de bevestiging)
      if (token && m.t === "hervat") { want = check = false; paused = false; emit(m); return emit({ t: "hallo" }); } // bevestiging: nu pas pushen
      if (token && m.t === "n" && check) { check = false; paused = false; emit(m); emit({ t: "hervat" }); return emit({ t: "hallo" }); }
      if (!token && m.t === "stand" && m.d && Array.isArray(m.d.list)) m.d.list.forEach((c) => { if (c && imgs.has(c.id)) c.img = imgs.get(c.id); });
      emit(m);
    };
    s.onclose = (e) => {
      if (ws !== s) return;
      ws = null; T.clearInterval(ping);
      // na herverbinden alle portretten opnieuw (onderweg verloren?) en wat intussen weg is als null: markeren, niet legen
      sent.forEach((_, k) => sent.set(k, ""));
      if (done) return;
      const c = e && e.code;
      if (c === 4003 || c === 4004) { done = true; return net("weg"); }
      if (c === 4001) return net("elders");
      later();
    };
    s.onerror = () => { /* onclose volgt */ };
  }
  /** Dode verbinding (wifi weg, telefoon sliep): dicht en opnieuw */
  function dead(s) {
    if (ws !== s) return;
    try { s.close(); } catch { /* al dicht */ }
    s.onclose({ code: 1006 });
  }
  function later() {
    if (done) return;
    net("kwijt");
    T.clearTimeout(retry);
    retry = T.setTimeout(connect, backoff(tries++));
  }
  // terug uit de achtergrond of weer online: niet op de backoff wachten
  // Een socket die na slapen of een netwerkwissel nog "open" lijkt, is vaak dood: even pingen en na 5 s zonder antwoord opnieuw.
  const wake = () => {
    if (done || state === "elders") return;
    if (ws && ws.readyState === 1) {
      if (Date.now() - lastIn > PING) { const s = ws; raw("ping"); T.setTimeout(() => { if (Date.now() - lastIn > PROBE) dead(s); }, PROBE); }
      return;
    }
    if (!(ws && ws.readyState === 0)) { tries = Math.min(tries, 1); connect(); }
  };
  const onVis = () => { if (document.visibilityState === "visible") wake(); };
  if (typeof addEventListener === "function") addEventListener("online", wake);
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVis);

  queueMicrotask(connect); // eerst laten abonneren, dan pas de eerste status
  return {
    send(m) {
      if (!token) return void raw(JSON.stringify(m)); // speler: alleen "hallo" doet iets in de kamer
      if (m.t === "stand") {
        if (paused) return emit({ t: "gemist" }); // dmLink stuurt alleen gewijzigde standen (of na "hallo", en die komt niet tijdens een pauze)
        if (!ws || ws.readyState !== 1) return; // bij herverbinden pusht dmLink opnieuw
        const { d, imgs: ps } = splitImgs(m.d, sent);
        for (const p of ps) if (!raw(JSON.stringify({ t: "img", id: p.id, d: p.d }))) { sent.clear(); return; }
        raw(JSON.stringify({ t: "stand", d }));
      }
    },
    on: (f) => { subs.add(f); return () => subs.delete(f); },
    close() {
      done = true; T.clearTimeout(retry); T.clearInterval(ping);
      if (typeof removeEventListener === "function") removeEventListener("online", wake);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVis);
      const s = ws; ws = null;
      if (s) try { s.close(1000); } catch { /* al dicht */ }
    },
    /**
     * Stoppen met delen: "stop" naar de kamer (spelers krijgen "einde", kamer weg), daarna dicht.
     * Is de verbinding net kwijt, dan max. wait ms wachten tot hij terug is. → true als "stop" verstuurd is.
     */
    stop(wait = 5000) {
      return new Promise((done_) => {
        const go = () => { const ok = raw(JSON.stringify({ t: "stop" })); this.close(); done_(ok); };
        if (ws && ws.readyState === 1) return go();
        if (done) return done_(false);
        const t = T.setTimeout(() => { off(); this.close(); done_(false); }, wait);
        const f = (m) => { if (m.t === "net" && m.s === "open") { T.clearTimeout(t); off(); go(); } };
        subs.add(f);
        const off = () => subs.delete(f);
        wake();
      });
    },
    /** Na een pauze weer delen: zelfde code en token. "hervat" naar de kamer (of zodra er verbinding is), dan "hallo" zodat dmLink pusht */
    hervat() {
      if (done) return;
      paused = false; want = true; // want blijft tot de bevestiging: na herverbinden opnieuw sturen
      if (!raw(JSON.stringify({ t: "hervat" }))) wake();
    },
    /** DM in een ander tabblad verder → hier weer overnemen */
    resume() { if (!done && state === "elders") { tries = 0; connect(); } },
  };
}

/** Kamer aanmaken → { code, token }. Gooit Error("offline" | "rate" | "server"). */
export async function createRoom(fetchFn = fetch) {
  let r;
  try { r = await fetchFn("/api/room", { method: "POST" }); } catch { throw new Error("offline"); }
  if (r.status === 429) throw new Error("rate");
  if (!r.ok) throw new Error("server");
  const j = await r.json().catch(() => null);
  const code = j && normCode(j.code);
  if (!code || typeof j.token !== "string") throw new Error("server");
  return { code, token: j.token };
}
