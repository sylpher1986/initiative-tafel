// Verbinding DM-scherm → spelersscherm. Berichten:
//   { t: "dm" }               DM-scherm is (opnieuw) gestart/verbonden: spelersschermen melden zich
//   { t: "hallo" }            spelersscherm meldt zich: DM stuurt de huidige stand
//   { t: "stand", d: view }   snapshot uit toPlayerView (js/playerview.js)
// Twee transporten met dezelfde send/on/close-interface:
//   localChannel()            BroadcastChannel: vensters en tabbladen van dezelfde browser (ook zonder internet)
//   roomChannel(code, token)  WebSocket-kamer op de Worker (worker/room.js): andere apparaten via een kamercode
//                             (de spelerskaart gaat daar in stukken, zie mapParts)
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

/** Snapshot zonder map (WP71; de kamer stuurt de kaart sinds WP72 apart in stukken). Zonder map dezelfde snapshot terug. */
export function noMap(view) {
  if (!view || !("map" in view)) return view;
  const { map, ...rest } = view; // eslint-disable-line no-unused-vars
  return rest;
}

/* ---------- WP72: spelerskaart via de kamer, in stukken ---------- */
// Het platte beeld (Blob) gaat als base64 in stukken van PART tekens ({ t: "mp", k, i, n, ty, d }); de stand zelf draagt
// alleen { k, w, h }. De kamer bewaart de stukken (eigen sleutels), spelers zetten ze samen en tonen de kaart pas als hij
// compleet is. Gelijk aan MAX_PART/MAX_PARTS in worker/room.js (test).
export const PART = 60000;  // tekens = 45 000 bytes (veelvoud van 4: elk stuk los te decoderen)
export const PARTS = 32;
export const ROOM_MAP_MAX = (PARTS * PART * 3) / 4; // bytes (± 1,4 MB); flatMap blijft hieronder
const PART_B = (PART * 3) / 4;
/** Bytes → stukken base64 (elk ≤ PART tekens), of null als het meer dan PARTS stukken worden */
export function mapParts(bytes) {
  const n = Math.max(1, Math.ceil(bytes.length / PART_B));
  if (n > PARTS) return null;
  const out = [];
  for (let i = 0; i < n; i++) {
    const b = bytes.subarray(i * PART_B, (i + 1) * PART_B);
    let s = "";
    for (let j = 0; j < b.length; j += 0x8000) s += String.fromCharCode.apply(null, b.subarray(j, j + 0x8000));
    out.push(btoa(s));
  }
  return out;
}
/** Stukken base64 → Uint8Array, of null als een stuk geen geldige base64 is */
export function joinParts(parts) {
  try {
    const bins = parts.map((p) => atob(p));
    const out = new Uint8Array(bins.reduce((a, b) => a + b.length, 0));
    let o = 0;
    for (const b of bins) for (let j = 0; j < b.length; j++) out[o++] = b.charCodeAt(j);
    return out;
  } catch { return null; }
}
// gelijk aan MAP_TYPES (js/playerview.js) en de kamer (test); hier los gehouden: share.js laadt geen UI-code
const MAP_K = /^[A-Za-z0-9_.-]{1,64}$/;
export const MAP_TY = ["image/jpeg", "image/png", "image/webp"];

/** Backoff voor opnieuw verbinden: 1, 2, 4 … max 30 s, met wat spreiding zodat niet alle schermen tegelijk komen */
export const backoff = (n, rnd = Math.random) => Math.min(30000, 1000 * 2 ** Math.min(n, 5)) * (0.8 + 0.4 * rnd());

// Heartbeat: de DM pingt rustig (rode stip na 10 s kwijt is genoeg); spelers sneller, zodat een speler binnen ±20 s ziet
// dat zijn stand niet meer bijwerkt (SC3). De pong is een auto-response van de kamer: maakt de Durable Object niet wakker.
export const BEAT = { dm: { ping: 25000, dead: 60000 }, p: { ping: 10000, dead: 20000 } };
const PROBE = 5000;

/**
 * Kanaal via de kamer. token = DM (schrijft), zonder token = speler (alleen lezen).
 * Zelfde send/on/close als localChannel. Daarnaast komen via on():
 *   { t: "net", s }  s = "verbinden" | "open" | "kwijt" | "gone" (kamer bestaat niet/verlopen/geen toegang) | "elders" (DM in ander tabblad)
 *   { t: "n", n }    (DM) aantal verbonden spelersschermen
 *   { t: "pauze" }   (DM) kamer pauzeerde het delen (30 min zonder wijziging); tot hervat() gaat er geen stand meer heen
 *   { t: "hervat" }  (DM) kamer bevestigt hervat(); daarna volgt "hallo" (dmLink pusht)
 *   { t: "gemist" }  (DM) een gewijzigde stand tijdens de pauze: spelers zien hem niet
 *   { t: "stop" }    (speler) de DM deelt op dit moment niet; de verbinding blijft open, een nieuwe stand komt vanzelf
 *   { t: "dmnet", on } (speler) DM-verbinding met de kamer weg (on: 0) of terug (on: 1); bij elke verbinding de huidige status
 *   { t: "mapst", busy } (DM, WP72) kaartbeeld wordt naar de kamer gestuurd (busy: true) of is verstuurd/gestopt (false)
 * Bij elke (nieuwe) verbinding: DM-kant meldt { t: "hallo" } (dmLink pusht opnieuw), spelerskant { t: "dm" } (speler zegt hallo).
 * Spelerskant: portretten die apart binnenkomen worden weer in de stand gezet (cleanView controleert ze daarna); de kaart
 * (WP72) alleen als alle stukken binnen zijn, anders krijgt de stand mapWait: 1 (oude kaart laten staan). Is de kaart
 * later compleet, dan komt de laatste stand nog eens.
 * opts: { base, WS, timers } voor tests; allow(): false = niet (meer) verbinden (DA3: tabblad niet meer de eigenaar).
 */
export function roomChannel(code, token, opts = {}) {
  const WS = opts.WS || globalThis.WebSocket;
  const T = opts.timers || globalThis;
  const allow = opts.allow || (() => true);
  const base = opts.base || (location.protocol === "https:" ? "wss://" : "ws://") + location.host;
  const url = `${base}/api/room/${code}/ws${token ? "?t=" + encodeURIComponent(token) : ""}`;
  const { ping: PING, dead: DEAD } = token ? BEAT.dm : BEAT.p;
  const subs = new Set(), sent = new Map(), imgs = new Map();
  let ws = null, tries = 0, retry = 0, ping = 0, lastIn = 0, done = false, state = "", paused = false, want = false, check = false;
  // WP72 DM: mapSent = kaart die (voor zover bekend) compleet in de kamer staat, mapBusy = kaart die nu verstuurd wordt
  let mapSent = "", mapBusy = "", mapBad = ""; // mapBad: beeld dat niet past/niet te lezen is (niet bij elke stand opnieuw)
  // WP72 speler: stukken van kaart pk, samengezet beeld blob (sleutel bk), laatste ruwe stand (opnieuw na compleet)
  let pk = "", pn = 0, pty = "", parts = [], bk = "", blob = null, lastStand = "";
  const emit = (m) => subs.forEach((f) => f(m));
  const net = (s) => { if (s !== state) { state = s; emit({ t: "net", s }); } };
  const raw = (s) => { if (ws && ws.readyState === 1) { try { ws.send(s); return true; } catch { /* dicht */ } } return false; };

  function connect() {
    if (done || (ws && ws.readyState <= 1)) return;
    // een tabblad dat terugkomt uit de achtergrond (timer of "online" vóór visibilitychange) pakt de kamer niet af (4001)
    if (!allow()) return;
    T.clearTimeout(retry); retry = 0;
    net(tries ? "kwijt" : "verbinden");
    let s;
    try { s = new WS(url); } catch { return later(); }
    ws = s;
    s.onopen = () => {
      if (ws !== s) return;
      tries = 0; lastIn = Date.now();
      if (!token) { imgs.clear(); pk = ""; parts = []; } // kamer stuurt bij "hallo" alle portretten en kaartstukken opnieuw, vóór de stand
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
      if (!token && m.t === "mp") return part(m);
      if (token && m.t === "mk") { // kamer meldt welke kaart compleet bij hem staat
        const k = typeof m.k === "string" ? m.k : "";
        if (mapBusy || mapSent === k) return;
        mapSent = k; // de kamer weet het: afwijkende kaart = opnieuw sturen, kaart zonder dat hier iets gedeeld wordt = opruimen
        if (!paused && !check && !want) emit({ t: "hallo" }); // tijdens een pauze niet (geen "gemist" bij het opstarten); hervat pusht toch
        return;
      }
      if (token && m.t === "pauze") { check = false; if (want) return; paused = true; mapSent = ""; if (mapBusy) { mapBusy = ""; emit({ t: "mapst", busy: false }); } } // kamer negeert stukken tijdens de pauze: na hervat opnieuw // tijdens hervat(): verouderd (van vóór de bevestiging)
      if (token && m.t === "hervat") { want = check = false; paused = false; emit(m); return emit({ t: "hallo" }); } // bevestiging: nu pas pushen
      if (token && m.t === "n" && check) { check = false; paused = false; emit(m); emit({ t: "hervat" }); return emit({ t: "hallo" }); }
      if (!token && m.t === "stand") return stand(m, e.data);
      emit(m);
    };
    s.onclose = (e) => {
      if (ws !== s) return;
      ws = null; T.clearInterval(ping);
      if (mapBusy) { mapBusy = ""; emit({ t: "mapst", busy: false }); } // afgebroken: na herverbinden opnieuw (mk/hallo)
      // na herverbinden alle portretten opnieuw (onderweg verloren?) en wat intussen weg is als null: markeren, niet legen
      sent.forEach((_, k) => sent.set(k, ""));
      if (done) return;
      const c = e && e.code;
      if (c === 4003 || c === 4004) { done = true; return net("gone"); }
      if (c === 4001) return net("elders");
      later();
    };
    s.onerror = () => { /* onclose volgt */ };
  }
  /** Speler: stand met portretten en (als hij compleet is) de kaart terug erin */
  function stand(m, txt) {
    if (!m.d || !Array.isArray(m.d.list)) return emit(m);
    lastStand = txt;
    m.d.list.forEach((c) => { if (c && imgs.has(c.id)) c.img = imgs.get(c.id); });
    const mm = m.d.map;
    delete m.d.map;
    if (mm && typeof mm === "object") {
      if (blob && mm.k === bk) m.d.map = { k: bk, w: mm.w, h: mm.h, img: blob };
      else m.mapWait = 1; // nog niet (helemaal) binnen: oude kaart laten staan
    }
    emit(m);
  }
  /** Speler: één kaartstuk. Compleet = Blob; stond de stand al op deze kaart te wachten, dan die stand nog eens. */
  function part(m) {
    if (m.k === null) { pk = ""; parts = []; bk = ""; blob = null; return; } // de volgende stand (zonder kaart) haalt hem weg
    const { k, i, n, ty, d } = m;
    if (typeof k !== "string" || !MAP_K.test(k) || !Number.isInteger(n) || n < 1 || n > PARTS || !Number.isInteger(i) || i < 0 || i >= n) return;
    if (!MAP_TY.includes(ty) || typeof d !== "string" || !d.length || d.length > PART) return;
    if (k === bk) return; // al compleet (opnieuw gestuurd na herverbinden)
    if (k !== pk || n !== pn || ty !== pty) { pk = k; pn = n; pty = ty; parts = []; }
    parts[i] = d;
    for (let j = 0; j < n; j++) if (parts[j] == null) return;
    const bytes = joinParts(parts);
    pk = ""; parts = [];
    if (!bytes) return;
    bk = k; blob = new Blob([bytes], { type: ty });
    if (lastStand) { let s; try { s = JSON.parse(lastStand); } catch { return; } if (s && s.d && s.d.map && s.d.map.k === k) stand(s, lastStand); }
  }
  /** DM: kaartbeeld als stukken naar de kamer (asynchroon: Blob lezen). Mislukt of afgebroken = later opnieuw via mk/hallo. */
  async function ship(mp) {
    mapBusy = mp.k;
    emit({ t: "mapst", busy: true });
    let ps = null;
    try { ps = mapParts(new Uint8Array(await mp.img.arrayBuffer())); } catch { ps = null; }
    if (mapBusy !== mp.k) return; // intussen een andere kaart, gestopt of verbinding weg
    mapBusy = "";
    let ok = !!ps;
    for (let i = 0; ok && i < ps.length; i++) ok = raw(JSON.stringify({ t: "mp", k: mp.k, i, n: ps.length, ty: mp.img.type, d: ps[i] }));
    if (ok) mapSent = mp.k;
    else if (!ps) mapBad = mp.k;
    emit({ t: "mapst", busy: false });
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
  // netwerk weg (browser weet het): meteen als kwijt melden in plaats van op de heartbeat te wachten; "online" verbindt weer
  const offline = () => { if (ws) dead(ws); };
  if (typeof addEventListener === "function") { addEventListener("online", wake); addEventListener("offline", offline); }
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVis);

  queueMicrotask(connect); // eerst laten abonneren, dan pas de eerste status
  return {
    send(m) {
      if (!token) return void raw(JSON.stringify(m)); // speler: alleen "hallo" doet iets in de kamer
      if (m.t === "stand") {
        if (paused) return emit({ t: "gemist" }); // dmLink stuurt alleen gewijzigde standen (of na "hallo", en die komt niet tijdens een pauze)
        if (!ws || ws.readyState !== 1) return; // bij herverbinden pusht dmLink opnieuw
        const mp = m.d && m.d.map && typeof Blob !== "undefined" && m.d.map.img instanceof Blob && MAP_TY.includes(m.d.map.img.type) ? m.d.map : null;
        if (mp && mp.k !== mapSent && mp.k !== mapBusy && mp.k !== mapBad) ship(mp); // WP72: eerst de stand, het beeld volgt (spelers wachten met mapWait)
        if (!mp && (mapSent || mapBusy)) {
          if (mapBusy) { mapBusy = ""; emit({ t: "mapst", busy: false }); }
          if (raw(JSON.stringify({ t: "mp", k: null }))) mapSent = "";
        }
        const { d, imgs: ps } = splitImgs(noMap(m.d), sent);
        for (const p of ps) if (!raw(JSON.stringify({ t: "img", id: p.id, d: p.d }))) { sent.clear(); return; }
        if (mp) d.map = { k: mp.k, w: mp.w, h: mp.h };
        raw(JSON.stringify({ t: "stand", d }));
      }
    },
    on: (f) => { subs.add(f); return () => subs.delete(f); },
    close() {
      done = true; T.clearTimeout(retry); T.clearInterval(ping);
      if (typeof removeEventListener === "function") { removeEventListener("online", wake); removeEventListener("offline", offline); }
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVis);
      const s = ws; ws = null;
      if (s) try { s.close(1000); } catch { /* al dicht */ }
    },
    /**
     * Stoppen met delen, daarna dicht. kind "stop" (SC7): de kamer pauzeert, code en token blijven (hervat() later met
     * dezelfde code); "wis": kamer opheffen (spelers krijgen "einde").
     * Is de verbinding net kwijt, dan max. wait ms wachten tot hij terug is. → true als het bericht verstuurd is.
     */
    stop(wait = 5000, kind = "stop") {
      return new Promise((done_) => {
        const go = () => { const ok = raw(JSON.stringify({ t: kind === "wis" ? "wis" : "stop" })); this.close(); done_(ok); };
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
