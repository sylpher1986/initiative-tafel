// Spelersscherm op andere apparaten: één Durable Object per kamer (SQLite-backend, WebSocket Hibernation API).
//
// POST /api/room              → { code, token }: nieuwe kamer. De code is voor spelers, het token is van de DM.
//                               429 (retry-after: 60) bij te veel nieuwe kamers vanaf één IP (roomAllowed).
// GET  /api/room/:code/ws     → WebSocket. ?t=<token> geldig = DM (schrijft), anders speler (alleen lezen).
//
// Berichten (JSON, zie ook js/share.js):
//   DM → kamer   { t: "stand", d }        snapshot uit toPlayerView, portretten eruit (die gaan apart)
//                { t: "img", id, d }      portret van één speler (data-url), of d: null om het te wissen
//                { t: "stop" }            stoppen met delen: spelers krijgen "einde", de kamer wordt gewist
//                { t: "hervat" }          na een pauze weer delen (zelfde code en token); de DM pusht daarna de stand
//   speler →     { t: "hallo" }           kamer stuurt de bewaarde portretten en de laatste stand
//   kamer → DM   { t: "n", n }            aantal verbonden spelersschermen
//                { t: "hervat" }          bevestiging van "hervat"
//                { t: "pauze" }           delen gepauzeerd (PAUSE_MS zonder gewijzigde stand); ook bij verbinden tijdens een pauze
//   kamer → speler: de doorgestuurde "img"/"stand", { t: "stop" } (pauze: socket blijft open) en { t: "einde" } (kamer weg)
// Pauze: alleen een stand die inhoudelijk verschilt van de bewaarde telt als DM-activiteit (`act`); een identieke herpush
// (na herverbinden), "img" en spelersberichten niet. Na PAUSE_MS: `paused`, spelers krijgen "stop", standen worden genegeerd
// tot "hervat". Eén alarm voor pauze én opruimen (IDLE_MS na `at`): steeds het eerstvolgende moment.
// De kamer parset de snapshot niet (CPU-limiet); spelersschermen schonen alles op met cleanView/cleanImg.
// Sluitcodes: 4001 = DM verder in een ander tabblad, 4003 = token klopt niet, 4004 = kamer bestaat niet (meer).

export const CODE_ABC = "23456789ABCDEFGHJKMNPQRSTVWXYZ"; // geen 0 O 1 I L U
export const CODE_RE = /^[2-9A-HJKMNP-TV-Z]{6}$/;
export const MAX_MSG = 96 * 1024;     // één bericht van de DM (snapshot zonder portretten is ± 20 KB)
export const MAX_IMG = 64 * 1024;     // één portret (cleanImg staat 60 000 tekens toe)
export const MAX_IMGS = 40;
export const MAX_PLAYER_MSG = 256;    // spelers sturen alleen "hallo"
export const IDLE_MS = 12 * 3600e3;   // kamer weg na 12 uur zonder iets van de DM
export const PAUSE_MS = 30 * 60e3;    // delen pauzeert na 30 min zonder gewijzigde stand (vast, niet instelbaar)
export const MAX_SOCKETS = 60;
export const HALLO_MS = 2000;

/** Hooks voor de runtime, in tests te vervangen (Node kent geen WebSocketPair of status 101) */
export const rt = {
  pair: () => { const p = new WebSocketPair(); return [p[0], p[1]]; },
  upgraded: (client) => new Response(null, { status: 101, webSocket: client }),
};

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** 6 tekens uit CODE_ABC, zonder modulo-scheefheid */
export function newCode() {
  let s = "";
  while (s.length < 6) {
    for (const b of crypto.getRandomValues(new Uint8Array(12))) if (b < 240 && s.length < 6) s += CODE_ABC[b % 30];
  }
  return s;
}
export const newToken = () => b64url(crypto.getRandomValues(new Uint8Array(24)));

async function sha(s) {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s)))));
}

/**
 * Eigenaarscontrole: de ENIGE plek die bepaalt wie DM van een kamer is.
 * Nu: het token dat de DM bij het aanmaken kreeg (bewaard als hash). Fase 2: hier de ingelogde eigenaar controleren
 * (owner = { kind: "account", id }) zonder dat code, kamer of berichten veranderen.
 */
export async function isOwner(owner, req) {
  if (!owner || owner.kind !== "token") return false;
  const t = new URL(req.url).searchParams.get("t");
  return !!t && t.length <= 64 && (await sha(t)) === owner.hash;
}

const sendTo = (ws, s) => { try { ws.send(s); } catch { /* al dicht */ } };
const closeWs = (ws, code, why) => { try { ws.close(code, why); } catch { /* al dicht */ } };
const STOP = JSON.stringify({ t: "stop" }), PAUZE = JSON.stringify({ t: "pauze" });
const msgOf = (raw) => { try { const m = JSON.parse(raw); return m && typeof m === "object" ? m : null; } catch { return null; } };

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env;
    // "ping" → "pong" zonder de kamer wakker te maken: houdt telefoonverbindingen open en laat de client een dode verbinding zien
    if (typeof WebSocketRequestResponsePair !== "undefined" && ctx.setWebSocketAutoResponse) ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch(req) {
    const url = new URL(req.url), st = this.ctx.storage;
    if (url.pathname === "/init") { // alleen vanuit de Worker (POST /api/room)
      if (await st.get("owner")) return new Response("bestaat", { status: 409 });
      const { hash } = await req.json();
      const now = Date.now();
      await st.put({ owner: { kind: "token", hash }, at: now, act: now });
      await st.setAlarm(now + PAUSE_MS);
      return new Response("ok", { status: 201 });
    }
    const [client, server] = rt.pair();
    const owner = await st.get("owner");
    if (!owner) { server.accept(); closeWs(server, 4004, "kamer bestaat niet"); return rt.upgraded(client); }
    const dm = url.searchParams.has("t");
    if (dm && !(await isOwner(owner, req))) { server.accept(); closeWs(server, 4003, "geen toegang"); return rt.upgraded(client); }
    if (!dm && this.ctx.getWebSockets("p").length >= MAX_SOCKETS) { server.accept(); closeWs(server, 1013, "vol"); return rt.upgraded(client); }
    if (dm) {
      // dubbele DM-tabs: de nieuwste wint, de oude stopt (en verbindt niet vanzelf opnieuw)
      for (const old of this.ctx.getWebSockets("dm")) closeWs(old, 4001, "ander tabblad");
      // kamers van vóór de pauze-timer: geen act (anders schuift act ?? at mee met elke identieke herpush) en alleen het 12-uursalarm
      const now = Date.now();
      await st.put((await st.get("act")) == null ? { at: now, act: now } : { at: now });
      await this.plan();
    }
    this.ctx.acceptWebSocket(server, [dm ? "dm" : "p"]);
    if (dm) {
      // "pauze" vóór "n": de DM-kant weet bij "n" dat de kamer niet gepauzeerd is (oude pauze in een ander tabblad opgeheven)
      if (await st.get("paused")) sendTo(server, PAUZE);
      sendTo(server, JSON.stringify({ t: "n", n: this.players().length }));
    } else this.count();
    return rt.upgraded(client);
  }

  players(except) { return this.ctx.getWebSockets("p").filter((w) => w !== except); }
  isDm(ws) { return this.ctx.getTags(ws).includes("dm"); }
  count(except) {
    const s = JSON.stringify({ t: "n", n: this.players(except).length });
    for (const w of this.ctx.getWebSockets("dm")) if (w !== except) sendTo(w, s);
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== "string") return;
    if (raw === "ping") return sendTo(ws, "pong"); // als de auto-response er niet is
    const st = this.ctx.storage;
    if (!this.isDm(ws)) {
      if (raw.length > MAX_PLAYER_MSG) return;
      const m = msgOf(raw);
      if (!m || m.t !== "hallo") return;
      // hooguit één "hallo" per 2 s per scherm: elk antwoord leest en stuurt alle portretten
      const last = ws.deserializeAttachment ? ws.deserializeAttachment() : null;
      if (last && Date.now() - last.h < HALLO_MS) return;
      if (ws.serializeAttachment) ws.serializeAttachment({ h: Date.now() });
      const imgs = await st.list({ prefix: "img:" });
      for (const [k, d] of imgs) sendTo(ws, JSON.stringify({ t: "img", id: k.slice(4), d }));
      if (await st.get("paused")) return sendTo(ws, STOP);
      const s = await st.get("stand");
      if (s) sendTo(ws, s);
      return;
    }
    if (raw.length > MAX_MSG) return;
    const m = msgOf(raw);
    if (!m) return;
    if (m.t === "stand") {
      if (!m.d || typeof m.d !== "object") return;
      if (await st.get("paused")) return; // pas weer na "hervat"
      const s = JSON.stringify({ t: "stand", d: m.d }), now = Date.now();
      // alleen een inhoudelijk andere stand is activiteit; het alarm staat al op of vóór act + PAUSE_MS en schuift zelf op
      await st.put(s === (await st.get("stand")) ? { at: now } : { stand: s, at: now, act: now });
      for (const w of this.players()) sendTo(w, s);
    } else if (m.t === "img") {
      const id = typeof m.id === "string" && m.id.length && m.id.length <= 40 ? m.id : null;
      if (!id) return;
      const key = "img:" + id;
      if (m.d == null) await st.delete(key);
      else if (typeof m.d === "string" && m.d.length <= MAX_IMG) {
        if ((await st.get(key)) == null && (await st.list({ prefix: "img:" })).size >= MAX_IMGS) return;
        await st.put(key, m.d);
      } else return;
      const s = JSON.stringify({ t: "img", id, d: m.d == null ? null : m.d });
      for (const w of this.players()) sendTo(w, s);
    } else if (m.t === "stop") {
      await this.wipe(ws);
    } else if (m.t === "hervat") {
      const now = Date.now();
      await st.put({ paused: false, at: now, act: now });
      await this.plan();
      sendTo(ws, JSON.stringify({ t: "hervat" })); // de DM pusht hierna de stand; die gaat naar alle spelers, ook als hij gelijk is
    }
  }

  /** Eerstvolgende alarm: pauze (act + PAUSE_MS, niet tijdens een pauze) of opruimen (at + IDLE_MS) */
  async due() {
    const st = this.ctx.storage, at = await st.get("at");
    if (await st.get("paused")) return at + IDLE_MS;
    return Math.min(((await st.get("act")) ?? at) + PAUSE_MS, at + IDLE_MS);
  }
  /** Alarm vervroegen als dat nodig is (een te vroeg alarm plant zichzelf opnieuw) */
  async plan() {
    const st = this.ctx.storage, due = await this.due(), a = await st.getAlarm();
    if (a == null || a > due) await st.setAlarm(due);
  }

  /** Pauze: spelers krijgen "stop" (verbinding blijft open), DM krijgt "pauze"; code, stand en portretten blijven */
  async pause() {
    await this.ctx.storage.put("paused", true);
    for (const w of this.players()) sendTo(w, STOP);
    for (const w of this.ctx.getWebSockets("dm")) sendTo(w, PAUZE);
  }

  /** Kamer opheffen: spelers krijgen "einde" en 4004, alles weg */
  async wipe(except) {
    const end = JSON.stringify({ t: "einde" });
    for (const w of this.players()) { sendTo(w, end); closeWs(w, 4004, "gestopt"); }
    for (const w of this.ctx.getWebSockets("dm")) if (w !== except) closeWs(w, 4004, "gestopt");
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    if (except) closeWs(except, 1000, "gestopt");
  }

  async webSocketClose(ws, code) {
    closeWs(ws, code === 1005 || code === 1006 || !code ? 1000 : code, "dicht");
    if (!this.isDm(ws)) this.count(ws);
  }
  async webSocketError(ws) { if (!this.isDm(ws)) this.count(ws); }

  async alarm() {
    const st = this.ctx.storage, at = await st.get("at");
    if (!at) return;
    const now = Date.now();
    if (now >= at + IDLE_MS) return this.wipe();
    if (!(await st.get("paused")) && now >= ((await st.get("act")) ?? at) + PAUSE_MS) await this.pause();
    await st.setAlarm(await this.due());
  }
}

const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...extra },
});

/**
 * Rate-limit op kamers aanmaken (binding ROOM_LIMIT in wrangler.jsonc: ROOM_LIMIT_N per 60 s per IP, per Cloudflare-locatie).
 * IP als sleutel: er zijn geen accounts, en alleen de DM maakt een kamer (één per sessie, bewaard in localStorage),
 * dus een gedeeld IP (wifi aan tafel) raakt in de praktijk niemand. Fase 2: sleutel = ingelogde eigenaar.
 * Fail-open: zonder binding (lokaal, tests) of bij een storing in de limiter gaat het gewoon door.
 */
export const ROOM_LIMIT_N = 10;
export async function roomAllowed(req, env) {
  if (!env.ROOM_LIMIT) return true;
  const ip = req.headers.get("cf-connecting-ip") || "onbekend";
  try { return (await env.ROOM_LIMIT.limit({ key: "room:" + ip })).success !== false; }
  catch { return true; }
}

/** /api/room… → antwoord, of null als het pad er niet bij hoort */
export async function roomRoute(req, env, url) {
  if (url.pathname === "/api/room" || url.pathname === "/api/room/") {
    if (req.method !== "POST") return json({ error: "method" }, 405);
    if (!env.ROOMS) return json({ error: "noroom" }, 503);
    if (!(await roomAllowed(req, env))) return json({ error: "rate" }, 429, { "retry-after": "60" });
    const token = newToken(), hash = await sha(token);
    for (let i = 0; i < 5; i++) { // botsing (al bestaande kamer) is zeldzaam: nieuwe code
      const code = newCode();
      const r = await env.ROOMS.get(env.ROOMS.idFromName(code)).fetch("https://kamer/init", { method: "POST", body: JSON.stringify({ hash }) });
      if (r.status === 201) return json({ code, token }, 201);
    }
    return json({ error: "server" }, 503);
  }
  const m = url.pathname.match(/^\/api\/room\/([^/]+)\/ws\/?$/);
  if (!m) return null;
  if (req.method !== "GET") return json({ error: "method" }, 405);
  if (!CODE_RE.test(m[1])) return json({ error: "bad-code" }, 400);
  if ((req.headers.get("upgrade") || "").toLowerCase() !== "websocket") return json({ error: "upgrade" }, 426);
  if (!env.ROOMS) return json({ error: "noroom" }, 503);
  return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(req);
}
