import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";
import { Room, rt, newCode, CODE_RE, CODE_ABC, MAX_MSG, MAX_IMG, MAX_IMGS, IDLE_MS, PAUSE_MS, ROOM_LIMIT_N } from "../worker/room.js";
import { readFileSync } from "node:fs";

/* ---------- nagebootste Durable Object-runtime ---------- */
class FakeWS {
  constructor() { this.sent = []; this.closed = null; this.tags = []; }
  send(s) { if (this.closed != null) throw new Error("dicht"); this.sent.push(s); }
  close(code) { if (this.closed == null) this.closed = code; }
  accept() {}
  // dmnet (SC3: DM-verbinding) komt bij elk nieuw spelersscherm; de oudere tests gaan over iets anders
  all() { return this.sent.filter((s) => s !== "pong").map((s) => JSON.parse(s)); }
  msgs() { return this.all().filter((m) => m.t !== "dmnet"); }
  dmnet() { return this.all().filter((m) => m.t === "dmnet").map((m) => m.on); }
}
rt.pair = () => [new FakeWS(), new FakeWS()];
rt.upgraded = (client) => ({ status: 101, client });

function fakeStorage() {
  const m = new Map(); let alarm = null;
  return {
    m, get alarm() { return alarm; },
    get: async (k) => m.get(k),
    put: async (k, v) => { if (typeof k === "object") for (const [a, b] of Object.entries(k)) m.set(a, b); else m.set(k, v); },
    delete: async (k) => m.delete(k),
    list: async ({ prefix }) => new Map([...m].filter(([k]) => k.startsWith(prefix))),
    deleteAll: async () => m.clear(),
    setAlarm: async (t) => { alarm = t; }, getAlarm: async () => alarm, deleteAlarm: async () => { alarm = null; },
  };
}
let rooms;
function fakeRoom() {
  const socks = [], storage = fakeStorage();
  // de server-kant van een pair: berichten van de client komen via webSocketMessage
  const ctx = {
    storage,
    acceptWebSocket: (ws, tags) => { ws.tags = tags; socks.push(ws); },
    getWebSockets: (tag) => socks.filter((w) => w.closed == null && (!tag || w.tags.includes(tag))),
    getTags: (ws) => ws.tags,
  };
  const r = new Room(ctx, {});
  r.socks = socks; r.storage = storage;
  return r;
}
const env = {
  ASSETS: { fetch: async () => new Response("asset") },
  ROOMS: {
    idFromName: (n) => n,
    get: (id) => ({ fetch: (input, init) => { rooms[id] ||= fakeRoom(); return rooms[id].fetch(input instanceof Request ? input : new Request(input, init)); } }),
  },
};
beforeEach(() => { rooms = {}; });

const call = (path, init) => worker.fetch(new Request("https://app.test" + path, init), env);
const make = async () => (await call("/api/room", { method: "POST" })).json();
/** WebSocket openen → { room, ws (server-kant), say(obj|string) } */
async function open(code, token) {
  const res = await call(`/api/room/${code}/ws${token != null ? "?t=" + encodeURIComponent(token) : ""}`, { headers: { upgrade: "websocket" } });
  assert.equal(res.status, 101);
  const room = rooms[code], ws = room.socks.at(-1);
  // niet geaccepteerd (meteen gesloten): de laatste socket is dan niet deze; geef de sluitcode via de client niet, maar via een losse pair
  return { room, ws, say: (m) => room.webSocketMessage(ws, typeof m === "string" ? m : JSON.stringify(m)) };
}
/** Weigering: de server-kant wordt direct gesloten met een code */
async function refused(code, token) {
  let server;
  const orig = rt.pair;
  rt.pair = () => { const p = orig(); server = p[1]; return p; };
  try { await call(`/api/room/${code}/ws${token != null ? "?t=" + token : ""}`, { headers: { upgrade: "websocket" } }); }
  finally { rt.pair = orig; }
  return server.closed;
}

test("code: 6 tekens zonder verwarrende tekens", () => {
  assert.equal(CODE_ABC.length, 30);
  assert.doesNotMatch(CODE_ABC, /[01OILU]/);
  for (let i = 0; i < 200; i++) assert.match(newCode(), CODE_RE);
});

test("POST /api/room maakt een kamer met code en token; andere methodes niet", async () => {
  const r = await call("/api/room", { method: "POST" });
  assert.equal(r.status, 201);
  assert.equal(r.headers.get("cache-control"), "no-store");
  const { code, token } = await r.json();
  assert.match(code, CODE_RE);
  assert.ok(token.length >= 30);
  const st = rooms[code].storage;
  assert.equal(st.m.get("owner").kind, "token");
  assert.notEqual(st.m.get("owner").hash, token, "token niet zelf bewaard, alleen de hash");
  assert.ok(st.alarm > Date.now());
  assert.equal((await call("/api/room")).status, 405);
});

/** Nagebootste rate limiter: telt per sleutel (geen tijdvenster nodig voor de test) */
function limiter(max, fail = false) {
  const n = new Map(), keys = [];
  return { keys, limit: async ({ key }) => {
    if (fail) throw new Error("storing");
    keys.push(key); n.set(key, (n.get(key) || 0) + 1);
    return { success: n.get(key) <= max };
  } };
}
const post = (lim, ip) => worker.fetch(new Request("https://app.test/api/room", { method: "POST", headers: ip ? { "cf-connecting-ip": ip } : {} }), { ...env, ROOM_LIMIT: lim });

test("rate-limit: te veel kamers vanaf één IP → 429 met retry-after, ander IP gaat door, geen kamer aangemaakt", async () => {
  const lim = limiter(2);
  assert.equal((await post(lim, "1.2.3.4")).status, 201);
  assert.equal((await post(lim, "1.2.3.4")).status, 201);
  const r = await post(lim, "1.2.3.4");
  assert.equal(r.status, 429);
  assert.equal(r.headers.get("retry-after"), "60");
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.deepEqual(await r.json(), { error: "rate" });
  assert.equal(Object.keys(rooms).length, 2, "geweigerd = geen Durable Object");
  assert.equal((await post(lim, "5.6.7.8")).status, 201);
  assert.deepEqual(lim.keys, ["room:1.2.3.4", "room:1.2.3.4", "room:1.2.3.4", "room:5.6.7.8"]);
});

test("rate-limit: alleen POST telt (ws en GET niet); zonder IP-header één gedeelde sleutel", async () => {
  const lim = limiter(0);
  const e = { ...env, ROOM_LIMIT: lim };
  assert.equal((await worker.fetch(new Request("https://app.test/api/room"), e)).status, 405);
  assert.equal((await worker.fetch(new Request("https://app.test/api/room/K7M3QX/ws"), e)).status, 426);
  assert.deepEqual(lim.keys, []);
  assert.equal((await post(lim)).status, 429);
  assert.deepEqual(lim.keys, ["room:onbekend"]);
});

test("rate-limit: fail-open bij een storing in de limiter of zonder binding", async () => {
  assert.equal((await post(limiter(0, true), "1.2.3.4")).status, 201);
  assert.equal((await post(undefined, "1.2.3.4")).status, 201);
});

test("rate-limit: binding in wrangler.jsonc gelijk aan ROOM_LIMIT_N, period 60 (= retry-after en melding \"over een minuut\")", () => {
  const cfg = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  const m = cfg.match(/"name":\s*"ROOM_LIMIT"[^}]*"limit":\s*(\d+),\s*"period":\s*(\d+)/);
  assert.ok(m, "ROOM_LIMIT-binding ontbreekt");
  assert.equal(+m[1], ROOM_LIMIT_N);
  assert.equal(m[2], "60");
});

test("botsing met een bestaande kamer: nieuwe code", async () => {
  const real = crypto.getRandomValues.bind(crypto);
  let zeros = 2; // de eerste twee codes worden "222222"
  crypto.getRandomValues = (arr) => (arr.length === 12 && zeros-- > 0 ? arr.fill(0) : real(arr));
  try {
    const a = await make(), b = await make();
    assert.equal(a.code, "222222");
    assert.notEqual(b.code, "222222");
    assert.notEqual(a.token, b.token);
    const again = await rooms[a.code].fetch(new Request("https://kamer/init", { method: "POST", body: '{"hash":"x"}' }));
    assert.equal(again.status, 409, "bestaande kamer wordt niet overschreven");
  } finally { crypto.getRandomValues = real; }
});

test("ws: ongeldige code, geen upgrade, verkeerde methode", async () => {
  for (const c of ["abc", "K7M3Q", "K7M3QX1", "K7M3Q0", "K7M3QI"]) assert.equal((await call(`/api/room/${c}/ws`, { headers: { upgrade: "websocket" } })).status, 400, c);
  assert.equal((await call("/api/room/K7M3QX/ws")).status, 426);
  assert.equal((await call("/api/room/K7M3QX/ws", { method: "POST", headers: { upgrade: "websocket" } })).status, 405);
  assert.equal((await call("/api/room/K7M3QX")).status, 404);
  assert.equal((await call("/api/roomx")).status, 404);
});

test("ws: kamer bestaat niet (verlopen) → 4004, verkeerd token → 4003", async () => {
  assert.equal(await refused("K7M3QX"), 4004);
  const { code } = await make();
  assert.equal(await refused(code, "fout"), 4003);
  assert.equal(await refused(code, ""), 4003);
});

test("DM schrijft, speler leest; nieuwe speler krijgt portretten en de laatste stand direct", async () => {
  const { code, token } = await make();
  const dm = await open(code, token);
  assert.deepEqual(dm.ws.tags, ["dm"]);
  assert.deepEqual(dm.ws.msgs(), [{ t: "n", n: 0 }]);
  const p1 = await open(code);
  assert.deepEqual(p1.ws.tags, ["p"]);
  assert.deepEqual(dm.ws.msgs().at(-1), { t: "n", n: 1 }, "DM ziet het aantal schermen");

  await dm.say({ t: "img", id: "a", d: "data:image/jpeg;base64,AAAA" });
  await dm.say({ t: "stand", d: { v: 1, list: [{ id: "a" }] } });
  assert.deepEqual(p1.ws.msgs().map((m) => m.t), ["img", "stand"]);

  const p2 = await open(code);
  await p2.say({ t: "hallo" });
  assert.deepEqual(p2.ws.msgs(), [{ t: "img", id: "a", d: "data:image/jpeg;base64,AAAA" }, { t: "stand", d: { v: 1, list: [{ id: "a" }] } }]);
  assert.equal(dm.ws.msgs().at(-1).n, 2);

  // speler kan niets sturen dat bij anderen of in de kamer komt
  const before = p1.ws.sent.length;
  await p2.say({ t: "stand", d: { v: 1, list: [{ id: "x", name: "nep" }] } });
  await p2.say({ t: "img", id: "a", d: "data:image/png;base64,BBBB" });
  await p2.say({ t: "stop" });
  assert.equal(p1.ws.sent.length, before);
  assert.equal(rooms[code].storage.m.get("img:a"), "data:image/jpeg;base64,AAAA");
  assert.ok(rooms[code].storage.m.get("owner"), "speler kan de kamer niet opheffen");
  // speler weg → DM ziet het
  await rooms[code].webSocketClose(p2.ws, 1001);
  p2.ws.closed = 1001;
  assert.equal(dm.ws.msgs().at(-1).n, 1);
});

test("berichtlimieten en onzin", async () => {
  const { code, token } = await make();
  const dm = await open(code, token), p = await open(code);
  await dm.say("x".repeat(MAX_MSG + 1));
  await dm.say(JSON.stringify({ t: "stand", d: { v: 1, list: [], pad: "x".repeat(MAX_MSG) } }));
  await dm.say("geen json");
  await dm.say({ t: "stand", d: "tekst" });
  await dm.say({ t: "iets" });
  await dm.say({ t: "img", id: "a", d: "data:" + "A".repeat(MAX_IMG) });
  await dm.say({ t: "img", id: "x".repeat(41), d: "data:A" });
  assert.equal(p.ws.msgs().length, 0);
  // max aantal portretten
  for (let i = 0; i < MAX_IMGS + 3; i++) await dm.say({ t: "img", id: "p" + i, d: "data:A" });
  assert.equal(rooms[code].storage.m.size - [...rooms[code].storage.m.keys()].filter((k) => !k.startsWith("img:")).length, MAX_IMGS);
  // bestaand portret vervangen of wissen mag nog wel
  await dm.say({ t: "img", id: "p0", d: "data:B" });
  assert.equal(rooms[code].storage.m.get("img:p0"), "data:B");
  await dm.say({ t: "img", id: "p0", d: null });
  assert.equal(rooms[code].storage.m.has("img:p0"), false);
  // ping zonder auto-response
  await p.say("ping");
  assert.equal(p.ws.sent.at(-1), "pong");
});

test("dubbele DM-tabs: de nieuwste wint, de oude krijgt 4001", async () => {
  const { code, token } = await make();
  const a = await open(code, token), b = await open(code, token);
  assert.equal(a.ws.closed, 4001);
  assert.equal(b.ws.closed, null);
});

test("stoppen: spelers krijgen einde, kamer is weg", async () => {
  const { code, token } = await make();
  const dm = await open(code, token), p = await open(code);
  await dm.say({ t: "stand", d: { v: 1, list: [] } });
  await dm.say({ t: "stop" });
  assert.deepEqual(p.ws.msgs().at(-1), { t: "einde" });
  assert.equal(p.ws.closed, 4004);
  assert.equal(rooms[code].storage.m.size, 0);
  assert.equal(rooms[code].storage.alarm, null);
  assert.equal(await refused(code), 4004);
});

test("alarm: na 12 uur zonder DM weg, anders opnieuw gepland", async () => {
  const { code, token } = await make();
  const room = rooms[code], st = room.storage;
  const p = await open(code);
  st.m.set("at", Date.now() - 1000);
  st.m.set("paused", true); // gepauzeerd: alleen het opruimmoment telt
  await room.alarm();
  assert.ok(st.alarm >= Date.now() + IDLE_MS - 2000, "nog actief: later opnieuw");
  assert.ok(st.m.get("owner"));
  st.m.set("at", Date.now() - IDLE_MS - 1);
  await room.alarm();
  assert.equal(st.m.size, 0);
  assert.equal(p.ws.closed, 4004);
  assert.equal(await refused(code, token), 4004);
});

test("review: hallo hooguit één keer per 2 s per scherm", async () => {
  const { code, token } = await make();
  const dm = await open(code, token), p = await open(code);
  let att = null;
  p.ws.serializeAttachment = (v) => { att = v; };
  p.ws.deserializeAttachment = () => att;
  await dm.say({ t: "stand", d: { v: 1, list: [] } });
  const n0 = p.ws.sent.length;
  await p.say({ t: "hallo" }); await p.say({ t: "hallo" }); await p.say({ t: "hallo" });
  assert.equal(p.ws.sent.length, n0 + 1);
  att.h -= 3000;
  await p.say({ t: "hallo" });
  assert.equal(p.ws.sent.length, n0 + 2);
});

/* ---------- pauze na 30 min zonder gewijzigde stand ---------- */
const V1 = { v: 1, list: [{ id: "a" }] }, V2 = { v: 1, list: [{ id: "a" }, { id: "b" }] };

test("pauze: alleen een inhoudelijk gewijzigde stand is activiteit (identieke herpush en img niet)", async () => {
  const { code, token } = await make();
  const st = rooms[code].storage;
  assert.ok(st.alarm <= Date.now() + PAUSE_MS, "eerste alarm = pauzemoment");
  const dm = await open(code, token);
  await dm.say({ t: "stand", d: V1 });
  st.m.set("act", 1000); st.m.set("at", Date.now() - 5000);
  await dm.say({ t: "stand", d: V1 }); // herpush na herverbinden
  assert.equal(st.m.get("act"), 1000, "identiek: timer loopt door");
  assert.ok(st.m.get("at") > Date.now() - 1000, "opruimklok (12 u) loopt wel bij");
  await dm.say({ t: "img", id: "a", d: "data:A" });
  assert.equal(st.m.get("act"), 1000, "portret telt niet");
  const p = await open(code);
  let att = null; p.ws.serializeAttachment = (v) => { att = v; }; p.ws.deserializeAttachment = () => att;
  await p.say({ t: "hallo" });
  assert.equal(st.m.get("act"), 1000, "spelersbericht telt niet");
  const dm2 = await open(code, token); // DM herverbindt
  assert.equal(st.m.get("act"), 1000, "verbinden telt niet");
  await dm2.say({ t: "stand", d: V2 });
  assert.ok(st.m.get("act") > Date.now() - 1000, "gewijzigd: timer op nul");
});

test("pauze: na 30 min stop naar spelers, pauze naar DM; code, stand en portretten blijven; standen genegeerd", async () => {
  const { code, token } = await make();
  const room = rooms[code], st = room.storage;
  const dm = await open(code, token), p = await open(code);
  await dm.say({ t: "img", id: "a", d: "data:A" });
  await dm.say({ t: "stand", d: V1 });
  // alarm te vroeg (act schoof op): niets, opnieuw gepland op act + 30 min
  await room.alarm();
  assert.ok(!st.m.get("paused"));
  assert.ok(Math.abs(st.alarm - (st.m.get("act") + PAUSE_MS)) < 5);
  st.m.set("act", Date.now() - PAUSE_MS - 1);
  await room.alarm();
  assert.equal(st.m.get("paused"), true);
  assert.deepEqual(p.ws.msgs().at(-1), { t: "stop" });
  assert.equal(p.ws.closed, null, "speler blijft verbonden (geen herverbindlus)");
  assert.deepEqual(dm.ws.msgs().at(-1), { t: "pauze" });
  assert.ok(st.m.get("owner") && st.m.get("stand") && st.m.get("img:a"));
  assert.ok(Math.abs(st.alarm - (st.m.get("at") + IDLE_MS)) < 5, "gepauzeerd: volgende alarm = opruimen");
  // tijdens de pauze: stand genegeerd, portret wel bewaard (de DM-kant denkt dat hij verstuurd is)
  const n0 = p.ws.sent.length;
  await dm.say({ t: "stand", d: V2 });
  assert.equal(p.ws.sent.length, n0);
  assert.equal(JSON.parse(st.m.get("stand")).d.list.length, 1);
  // nieuw scherm of herverbonden speler: portretten en stop, geen oude stand
  const p2 = await open(code);
  await p2.say({ t: "hallo" });
  assert.deepEqual(p2.ws.msgs(), [{ t: "img", id: "a", d: "data:A" }, { t: "stop" }]);
  // DM herlaadt de pagina: krijgt meteen pauze
  const dm2 = await open(code, token);
  assert.deepEqual(dm2.ws.msgs(), [{ t: "pauze" }, { t: "n", n: 2 }]);
  // alarm tijdens de pauze pauzeert niet nog eens
  const n1 = p.ws.sent.length;
  await room.alarm();
  assert.equal(p.ws.sent.length, n1);
  // na 12 uur toch weg
  st.m.set("at", Date.now() - IDLE_MS - 1);
  await room.alarm();
  assert.equal(st.m.size, 0);
  assert.deepEqual(p.ws.msgs().at(-1), { t: "einde" });
});

test("pauze: hervatten met dezelfde code en hetzelfde token; timer op nul, stand weer naar spelers", async () => {
  const { code, token } = await make();
  const room = rooms[code], st = room.storage;
  const dm = await open(code, token), p = await open(code);
  await dm.say({ t: "stand", d: V1 });
  st.m.set("act", Date.now() - PAUSE_MS - 1);
  await room.alarm();
  await dm.say({ t: "hervat" });
  assert.equal(st.m.get("paused"), false);
  assert.ok(st.m.get("act") > Date.now() - 1000);
  assert.deepEqual(dm.ws.msgs().at(-1), { t: "hervat" });
  assert.ok(st.alarm <= Date.now() + PAUSE_MS && st.alarm > Date.now(), "alarm weer op het pauzemoment");
  await dm.say({ t: "stand", d: V1 }); // identiek, maar spelers zagen "stop": wel doorsturen
  assert.deepEqual(p.ws.msgs().at(-1), { t: "stand", d: V1 });
  // speler kan niet hervatten
  st.m.set("act", Date.now() - PAUSE_MS - 1);
  await room.alarm();
  await p.say({ t: "hervat" });
  assert.equal(st.m.get("paused"), true);
});

test("pauze: kamer van vóór de timer (geen act, alarm over 12 u) krijgt bij DM-verbinding het pauzealarm", async () => {
  const { code, token } = await make();
  const st = rooms[code].storage;
  st.m.delete("act");
  await st.setAlarm(Date.now() + IDLE_MS);
  const dm = await open(code, token);
  assert.ok(st.alarm <= Date.now() + PAUSE_MS + 5);
  // act wordt bij verbinden gezet, zodat een identieke herpush hem daarna niet meer opschuift
  const act = st.m.get("act");
  assert.ok(act > 0);
  await dm.say({ t: "stand", d: { v: 1, list: [] } });
  const act2 = st.m.get("act");
  await new Promise((r) => setTimeout(r, 3));
  await dm.say({ t: "stand", d: { v: 1, list: [] } });
  assert.equal(st.m.get("act"), act2, "identieke herpush telt niet");
});

test("SC3: dmnet: nieuw scherm krijgt altijd de status; DM verbindt → on 1; laatste DM-socket weg → on 0; 4001 niet", async () => {
  const { code, token } = await make();
  const p = await open(code);
  assert.deepEqual(p.ws.dmnet(), [0], "nog geen DM");
  const dm = await open(code, token);
  assert.deepEqual(p.ws.dmnet(), [0, 1]);
  const q = await open(code);
  assert.deepEqual(q.ws.dmnet(), [1], "DM is er");
  assert.equal(q.ws.all()[0].t, "dmnet", "status vóór iets anders");
  // ander tabblad neemt over: oude DM-socket dicht, nieuwe is er → geen on 0
  const dm2 = await open(code, token);
  await rooms[code].webSocketClose(dm.ws, 4001);
  assert.ok(!p.ws.dmnet().slice(2).includes(0));
  // DM weg
  dm2.ws.closed = 1006;
  await rooms[code].webSocketClose(dm2.ws, 1006);
  assert.equal(p.ws.dmnet().at(-1), 0); assert.equal(q.ws.dmnet().at(-1), 0);
  // speler weg: geen dmnet
  const m = p.ws.sent.length;
  q.ws.closed = 1001; await rooms[code].webSocketClose(q.ws, 1001);
  assert.equal(p.ws.sent.length, m);
  // DM terug
  await open(code, token);
  assert.equal(p.ws.dmnet().at(-1), 1);
});
