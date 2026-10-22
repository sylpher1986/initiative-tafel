import { test } from "node:test";
import assert from "node:assert/strict";
import { roomChannel, dmLink, splitImgs, normCode, fmtCode, backoff, createRoom } from "../js/share.js";
import { cleanView } from "../js/playerview.js";

/* ---------- nagebootste WebSocket en timers ---------- */
let socks = [];
class WS {
  constructor(url) { this.url = url; this.readyState = 0; this.out = []; socks.push(this); }
  send(s) { if (this.readyState !== 1) throw new Error("niet open"); this.out.push(s); }
  close() { if (this.readyState < 2) { this.readyState = 3; } }
  // test-hulpjes
  open() { this.readyState = 1; this.onopen(); }
  recv(m) { this.onmessage({ data: typeof m === "string" ? m : JSON.stringify(m) }); }
  drop(code = 1006) { this.readyState = 3; this.onclose({ code }); }
  msgs() { return this.out.filter((s) => s !== "ping").map((s) => JSON.parse(s)); }
}
function timers() {
  const q = [];
  return {
    q, setTimeout: (f, ms) => (q.push({ f, ms }), q.length), clearTimeout: (i) => { if (q[i - 1]) q[i - 1].f = null; },
    setInterval: () => 0, clearInterval: () => {},
    run() { const t = q.findLast((x) => x.f); const f = t.f; t.f = null; f(); return t.ms; },
  };
}
const chan = async (token, T = timers()) => {
  socks = [];
  const ch = roomChannel("K7M3QX", token, { WS, timers: T, base: "wss://app.test" }), got = [];
  ch.on((m) => got.push(m));
  await null; // eerste verbinding na het abonneren
  return { ch, got, T };
};

test("normCode en fmtCode: spaties, streepjes en kleine letters mogen; verwarrende tekens niet", () => {
  assert.equal(normCode(" k7m 3qx "), "K7M3QX");
  assert.equal(normCode("K7M-3QX"), "K7M3QX");
  assert.equal(normCode("K7M·3QX"), "K7M3QX");
  for (const bad of ["K7M3Q", "K7M3QXA", "K0M3QX", "KOM3QX", "K1M3QX", "KIM3QX", "KLM3QX", "KUM3QX", "", null, undefined, 123456, "<script>"]) assert.equal(normCode(bad), null, String(bad));
  assert.equal(fmtCode("K7M3QX"), "K7M 3QX");
});

test("backoff: oplopend, max 30 s, met spreiding", () => {
  assert.equal(backoff(0, () => 0.5), 1000);
  assert.equal(backoff(1, () => 0.5), 2000);
  assert.equal(backoff(20, () => 0.5), 30000);
  assert.ok(backoff(20, () => 1) < 36001 && backoff(0, () => 0) >= 800);
});

test("url: DM met token, speler zonder", async () => {
  await chan("tok/+=");
  assert.equal(socks[0].url, "wss://app.test/api/room/K7M3QX/ws?t=tok%2F%2B%3D");
  await chan();
  assert.equal(socks[0].url, "wss://app.test/api/room/K7M3QX/ws");
});

test("DM: bij (her)verbinden 'hallo' zodat dmLink opnieuw pusht; portretten één keer apart", async () => {
  const { ch, got, T } = await chan("tok");
  let n = 0;
  const img = "data:image/jpeg;base64,AAAA";
  const view = () => ({ v: 1, n: n++, list: [{ id: "a", kind: "pc", img }, { id: "b", kind: "monster", img: null }] });
  const link = dmLink(ch, view);
  assert.deepEqual(got, [{ t: "net", s: "verbinden" }]);
  link.update(); // nog niet verbonden: niets
  socks[0].open();
  assert.deepEqual(got.at(-1), { t: "hallo" });
  const m = socks[0].msgs();
  assert.deepEqual(m.map((x) => x.t), ["img", "stand"], "'dm' van dmLink gaat niet de kamer in");
  assert.equal(m[1].d.list[0].img, null, "geen data-url in de stand");
  link.update();
  assert.deepEqual(socks[0].msgs().slice(2).map((x) => x.t), ["stand"], "portret niet opnieuw");

  // verbinding weg → backoff → opnieuw: alles nog een keer (de kamer kan leeg zijn)
  socks[0].drop();
  assert.equal(got.at(-1).s, "kwijt");
  const ms = T.run();
  assert.ok(ms >= 800 && ms <= 1200);
  assert.equal(socks.length, 2);
  socks[1].open();
  assert.deepEqual(socks[1].msgs().map((x) => x.t), ["img", "stand"]);
  assert.equal(got.filter((x) => x.s === "open").length, 2);
});

test("DM: kamer weg (4004) of geen toegang (4003) → 'weg', niet opnieuw verbinden; ander tabblad (4001) → 'elders' tot resume", async () => {
  for (const code of [4003, 4004]) {
    const { got, T } = await chan("tok");
    socks[0].open(); socks[0].drop(code);
    assert.equal(got.at(-1).s, "weg");
    assert.equal(T.q.filter((x) => x.f).length, 0);
  }
  const { ch, got, T } = await chan("tok");
  socks[0].open(); socks[0].drop(4001);
  assert.equal(got.at(-1).s, "elders");
  assert.equal(T.q.filter((x) => x.f).length, 0);
  ch.resume();
  assert.equal(socks.length, 2);
});

test("speler: na (her)verbinden 'dm' (speler zegt hallo); portretten worden weer in de stand gezet, cleanView controleert", async () => {
  const { ch, got } = await chan();
  ch.on((m) => { if (m.t === "dm") ch.send({ t: "hallo" }); });
  socks[0].open();
  assert.deepEqual(socks[0].msgs(), [{ t: "hallo" }]);
  const good = "data:image/jpeg;base64,AAAA";
  socks[0].recv({ t: "img", id: "a", d: good });
  socks[0].recv({ t: "img", id: "b", d: "javascript:alert(1)" });
  socks[0].recv({ t: "stand", d: { v: 1, round: 1, active: "a", list: [{ id: "a", kind: "pc", name: "Ayla" }, { id: "b", kind: "pc", name: "Bo" }, { id: "c", kind: "monster", name: "Goblin" }] } });
  const st = got.find((m) => m.t === "stand");
  const V = cleanView(st.d);
  assert.equal(V.list[0].img, good);
  assert.equal(V.list[1].img, null, "onveilig portret eruit");
  assert.equal(V.list[2].img, null);
  assert.equal(got.some((m) => m.t === "img"), false, "portretten blijven in het kanaal");
  // wissen
  socks[0].recv({ t: "img", id: "a", d: null });
  socks[0].recv({ t: "stand", d: { v: 1, list: [{ id: "a", kind: "pc", name: "Ayla" }] } });
  assert.equal(cleanView(got.at(-1).d).list[0].img, null);
  // onzin en pong
  socks[0].recv("pong"); socks[0].recv("{kapot"); socks[0].recv({ x: 1 });
  assert.equal(got.at(-1).t, "stand");
  assert.equal(cleanView({ v: 2, list: [] }), null);
});

test("dode verbinding of sluiten: geen dubbele sockets, close stopt herverbinden", async () => {
  const { ch, T } = await chan("tok");
  socks[0].open();
  socks[0].drop();
  socks[0].drop(); // tweede close van dezelfde socket telt niet
  assert.equal(T.q.filter((x) => x.f).length, 1);
  ch.close();
  assert.equal(T.q.filter((x) => x.f).length, 0);
  assert.equal(socks.length, 1);
});

test("splitImgs: nieuw, gewijzigd en weg", () => {
  const sent = new Map();
  const v = (a, b) => ({ v: 1, list: [{ id: "a", img: a }, { id: "b", img: b }] });
  let r = splitImgs(v("x", null), sent);
  assert.deepEqual(r.imgs, [{ id: "a", d: "x" }]);
  assert.equal(r.d.list[0].img, null);
  assert.deepEqual(splitImgs(v("x", null), sent).imgs, []);
  assert.deepEqual(splitImgs(v("y", "z"), sent).imgs, [{ id: "a", d: "y" }, { id: "b", d: "z" }]);
  r = splitImgs({ v: 1, list: [{ id: "b", img: "z" }] }, sent);
  assert.deepEqual(r.imgs, [{ id: "a", d: null }]);
});

test("createRoom: offline, serverfout, rare antwoorden", async () => {
  await assert.rejects(createRoom(async () => { throw new TypeError("net"); }), /offline/);
  await assert.rejects(createRoom(async () => new Response("x", { status: 503 })), /server/);
  await assert.rejects(createRoom(async () => new Response('{"error":"rate"}', { status: 429 })), /rate/);
  await assert.rejects(createRoom(async () => new Response('{"code":"<b>","token":"t"}')), /server/);
  await assert.rejects(createRoom(async () => new Response("geen json")), /server/);
  assert.deepEqual(await createRoom(async () => new Response('{"code":"k7m3qx","token":"t"}', { status: 201 })), { code: "K7M3QX", token: "t" });
});

test("review: na herverbinden krijgt een intussen verdwenen portret null; spelerskant begint met een lege portrettenlijst", async () => {
  const T = timers(), timersOf = T;
  const { ch } = await chan("tok", T);
  let withImg = true;
  const link = dmLink(ch, () => ({ v: 1, list: [{ id: "a", img: withImg ? "data:x" : null }] }));
  socks[0].open();
  socks[0].drop();
  withImg = false;
  timersOf.run();
  socks[1].open();
  assert.deepEqual(socks[1].msgs()[0], { t: "img", id: "a", d: null });
  link.update();

  const p = await chan();
  socks[0].open();
  socks[0].recv({ t: "img", id: "a", d: "data:oud" });
  socks[0].drop(); p.T.run(); socks[1].open();
  socks[1].recv({ t: "stand", d: { v: 1, list: [{ id: "a", kind: "pc", name: "A" }] } });
  assert.equal(p.got.at(-1).d.list[0].img, undefined, "oud portret niet meer geplakt");
});

test("review: stop wacht kort op de verbinding; zonder verbinding false", async () => {
  let c = await chan("tok");
  socks[0].open();
  assert.equal(await c.ch.stop(), true);
  assert.deepEqual(socks[0].msgs(), [{ t: "stop" }]);
  assert.equal(socks[0].readyState, 3);

  // SC7: Nieuwe code = "wis"
  c = await chan("tok");
  socks[0].open();
  assert.equal(await c.ch.stop(5000, "wis"), true);
  assert.deepEqual(socks[0].msgs(), [{ t: "wis" }]);

  c = await chan("tok");
  socks[0].open(); socks[0].drop();
  const pr = c.ch.stop();
  // wake verbindt meteen opnieuw (geen backoff)
  assert.equal(socks.length, 2);
  socks[1].open();
  assert.equal(await pr, true);
  assert.deepEqual(socks[1].msgs(), [{ t: "stop" }]);

  c = await chan("tok");
  const pr2 = c.ch.stop(10);
  c.T.q.filter((x) => x.f && x.ms === 10).forEach((x) => { const f = x.f; x.f = null; f(); });
  assert.equal(await pr2, false);
});

test("DM: pauze → geen standen meer, gewijzigde stand = 'gemist'; herverbinden pusht niet; hervat wacht op bevestiging", async () => {
  const { ch, got, T } = await chan("tok");
  let n = 0;
  const link = dmLink(ch, () => ({ v: 1, n, list: [] }));
  socks[0].open();
  assert.equal(socks[0].msgs().length, 1);
  socks[0].recv({ t: "pauze" });
  assert.deepEqual(got.at(-1), { t: "pauze" });
  n++; link.update();
  assert.equal(socks[0].msgs().length, 1, "niets naar de kamer");
  assert.deepEqual(got.at(-1), { t: "gemist" });
  link.update(); // niets veranderd: geen nieuwe 'gemist'
  assert.equal(got.filter((m) => m.t === "gemist").length, 1);
  // herverbinden tijdens de pauze: geen 'hallo', dus geen herpush
  socks[0].drop(); T.run(); socks[1].open();
  assert.equal(got.at(-1).s, "open");
  assert.equal(socks[1].msgs().length, 0);
  ch.hervat();
  assert.deepEqual(socks[1].msgs(), [{ t: "hervat" }]);
  assert.equal(got.at(-1).t, "net", "pas pushen na bevestiging");
  socks[1].recv({ t: "hervat" });
  assert.deepEqual(got.slice(-2), [{ t: "hervat" }, { t: "hallo" }]);
  assert.deepEqual(socks[1].msgs().map((m) => m.t), ["hervat", "stand"]);
});

test("DM: hervat zonder verbinding gaat mee zodra er weer verbinding is (vóór de herpush)", async () => {
  const { ch, got } = await chan("tok");
  dmLink(ch, () => ({ v: 1, list: [] }));
  socks[0].open();
  socks[0].recv({ t: "pauze" });
  socks[0].drop();
  ch.hervat(); // verbindt direct, niet op de backoff wachten
  assert.equal(socks.length, 2);
  socks[1].open();
  assert.deepEqual(socks[1].msgs().map((m) => m.t), ["hervat"], "herpush pas na de bevestiging");
  // kamer stuurde bij verbinden nog "pauze" (vóór het verwerken van hervat): genegeerd, de bevestiging erna wint
  socks[1].recv({ t: "pauze" });
  assert.equal(got.filter((m) => m.t === "pauze").length, 1, "verouderde pauze niet doorgegeven");
  socks[1].recv({ t: "hervat" });
  assert.equal(got.at(-1).t, "hallo");
  assert.deepEqual(socks[1].msgs().map((m) => m.t), ["hervat", "stand"]);
});

test("review: hervat onderweg verloren (verbinding weg vóór de bevestiging) → na herverbinden opnieuw, niet vast op 'Opnieuw delen…'", async () => {
  const { ch, got, T } = await chan("tok");
  dmLink(ch, () => ({ v: 1, list: [] }));
  socks[0].open();
  socks[0].recv({ t: "pauze" });
  ch.hervat();
  assert.deepEqual(socks[0].msgs().map((m) => m.t), ["stand", "hervat"]);
  socks[0].drop(); T.run(); socks[1].open();
  assert.deepEqual(socks[1].msgs().map((m) => m.t), ["hervat"]);
  socks[1].recv({ t: "pauze" }); // kamer had hem niet gekregen: nog gepauzeerd bij verbinden
  socks[1].recv({ t: "n", n: 0 });
  socks[1].recv({ t: "hervat" });
  assert.deepEqual(got.slice(-2), [{ t: "hervat" }, { t: "hallo" }]);
  assert.deepEqual(socks[1].msgs().map((m) => m.t), ["hervat", "stand"]);
});

test("review: pauze in dit tabblad, intussen elders hervat → bij verbinden 'n' zonder 'pauze' = weer delen", async () => {
  const { ch, got, T } = await chan("tok");
  dmLink(ch, () => ({ v: 1, list: [] }));
  socks[0].open();
  socks[0].recv({ t: "pauze" });
  socks[0].drop(); T.run(); socks[1].open();
  assert.equal(socks[1].msgs().length, 0);
  socks[1].recv({ t: "n", n: 2 });
  assert.deepEqual(got.slice(-3), [{ t: "n", n: 2 }, { t: "hervat" }, { t: "hallo" }]);
  assert.deepEqual(socks[1].msgs().map((m) => m.t), ["stand"]);
  // nog steeds gepauzeerd: "pauze" vóór "n" houdt de pauze vast
  socks[1].recv({ t: "pauze" });
  socks[1].drop(); T.run(); socks[2].open();
  socks[2].recv({ t: "pauze" }); socks[2].recv({ t: "n", n: 2 });
  assert.equal(got.at(-1).t, "n");
  assert.equal(socks[2].msgs().length, 0);
});

test("speler: 'stop' (pauze) komt door, verbinding blijft open en verbindt niet opnieuw", async () => {
  const { got, T } = await chan();
  socks[0].open();
  socks[0].recv({ t: "stop" });
  assert.deepEqual(got.at(-1), { t: "stop" });
  assert.equal(socks.length, 1);
  assert.equal(T.q.filter((x) => x.f).length, 0);
});

test("DA3: niet meer de eigenaar (ander tabblad) = niet opnieuw verbinden, ook niet na een herverbind-timer", async () => {
  socks = [];
  let mine = true;
  const T = timers();
  roomChannel("K7M3QX", "tok", { WS, timers: T, base: "wss://app.test", allow: () => mine });
  await null;
  assert.equal(socks.length, 1);
  socks[0].open();
  mine = false; // ander tabblad nam het over terwijl dit tabblad bevroren was
  socks[0].drop();
  T.run(); // herverbind-timer gaat af vóór visibilitychange
  assert.equal(socks.length, 1, "geen nieuwe DM-verbinding die de kamer van het nieuwe tabblad afpakt");
});

test("SC3: spelers pingen elke 10 s en zijn na 20 s stilte kwijt; de DM blijft op 25/60 s", async () => {
  for (const [token, ping, dead] of [[undefined, 10000, 20000], ["tok", 25000, 60000]]) {
    const T = timers(); let iv = null;
    T.setInterval = (f, ms) => { iv = { f, ms }; return 1; };
    const { got } = await chan(token, T);
    const t0 = Date.now(), now = Date.now;
    socks[0].open();
    assert.equal(iv.ms, ping);
    try {
      Date.now = () => t0 + dead - 1; iv.f();
      assert.ok(!got.some((m) => m.t === "net" && m.s === "kwijt"), "nog niet dood");
      Date.now = () => t0 + dead + 1; iv.f();
      assert.ok(got.some((m) => m.t === "net" && m.s === "kwijt"), `${token ? "DM" : "speler"} na ${dead} ms kwijt`);
    } finally { Date.now = now; }
  }
});

test("SC3: 'offline' van de browser = meteen kwijt (niet op de heartbeat wachten); close haalt de listener weg", async () => {
  const subs = {}, had = globalThis.addEventListener;
  globalThis.addEventListener = (n, f) => { subs[n] = f; };
  globalThis.removeEventListener = (n, f) => { if (subs[n] === f) delete subs[n]; };
  try {
    const { ch, got } = await chan();
    socks[0].open();
    subs.offline();
    assert.equal(got.at(-1).s, "kwijt");
    assert.equal(socks[0].readyState, 3);
    ch.close();
    assert.equal(subs.offline, undefined); assert.equal(subs.online, undefined);
  } finally { if (had) globalThis.addEventListener = had; else { delete globalThis.addEventListener; delete globalThis.removeEventListener; } }
});
