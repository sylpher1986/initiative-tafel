import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import worker, { avatarOk } from "../worker/index.js";

// Nagebootste D&D Beyond: houdt bij welke url's de Worker opvraagt
const real = globalThis.fetch;
let calls = [];
const env = { ASSETS: { fetch: async () => new Response("asset", { status: 200 }) } };
const call = (path, init) => worker.fetch(new Request("https://app.test" + path, init), env);
function mock(routes) {
  calls = [];
  globalThis.fetch = async (u, init) => {
    const url = String(u); calls.push({ url, init });
    const r = routes(url);
    if (r instanceof Error) throw r;
    return r;
  };
}
afterEach(() => { globalThis.fetch = real; });

const CHAR = "https://character-service.dndbeyond.com/character/v5/character/";
const ok = (data) => new Response(JSON.stringify({ success: true, data }), { headers: { "content-type": "application/json" } });
const jpeg = () => new Response(new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]), { headers: { "content-type": "image/jpeg" } });

test("niet-/api gaat naar de statische assets", async () => {
  mock(() => assert.fail("geen upstream verwacht"));
  assert.equal(await (await call("/index.html")).text(), "asset");
});

test("alleen numerieke id's; geen andere paden, methodes of hosts", async () => {
  mock(() => assert.fail("geen upstream verwacht"));
  for (const p of ["/api/ddb/abc", "/api/ddb/0", "/api/ddb/12a", "/api/ddb/1234567890123", "/api/ddb/-5", "/api/ddb/1%2F2"])
    assert.equal((await call(p)).status, 400, p);
  for (const p of ["/api/ddb/12/x", "/api/ddb", "/api/other/12", "/api/ddb/12/avatar/x", "/api/ddb/%2e%2e", "/api/ddb/https:%2F%2Fevil.com"])
    assert.ok([400, 404].includes((await call(p)).status), p);
  assert.equal((await call("/api/ddb/12", { method: "POST" })).status, 405);
  assert.equal(calls.length, 0);
});

test("character: vaste upstream, ongewijzigd doorgegeven, geen cache, zonder client-headers of CORS", async () => {
  const data = { name: "Testa", stats: [], decorations: { avatarUrl: "https://www.dndbeyond.com/avatars/1/2/a.jpeg" } };
  mock((u) => (u === CHAR + "36954411" ? ok(data) : assert.fail(u)));
  const res = await call("/api/ddb/36954411", { headers: { cookie: "geheim=1", authorization: "Bearer x" } });
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).data, data);
  assert.equal(res.headers.get("access-control-allow-origin"), null);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const h = new Headers(calls[0].init.headers);
  assert.equal(h.get("cookie"), null); assert.equal(h.get("authorization"), null);
  assert.equal(calls[0].init.cf, undefined, "geen upstream-cache: net op Public gezet werkt direct");
});

test("privé, niet gevonden, fout en time-out", async () => {
  const cases = [
    [new Response("no", { status: 403 }), 403, "private"],
    [new Response("no", { status: 401 }), 403, "private"],
    [new Response(JSON.stringify({ success: false, message: "Unauthorized" }), { status: 200 }), 403, "private"],
    [new Response("x", { status: 404 }), 404, "notfound"],
    [new Response("x", { status: 500 }), 502, "upstream"],
    [new Response("", { status: 302, headers: { location: "https://evil.example/" } }), 502, "upstream"],
    [new Error("timeout"), 502, "upstream"],
  ];
  for (const [r, st, err] of cases) {
    mock(() => r);
    const res = await call("/api/ddb/5");
    assert.equal(res.status, st, err); assert.equal((await res.json()).error, err);
  }
});

test("te grote character-JSON wordt geweigerd", async () => {
  mock(() => new Response("x", { headers: { "content-length": String(20 * 1024 * 1024) } }));
  assert.equal((await call("/api/ddb/5")).status, 502);
});

test("avatar: url komt uit de character, alleen dndbeyond.com, alleen afbeeldingen", async () => {
  const av = "https://www.dndbeyond.com/avatars/1/2/a.jpeg";
  mock((u) => (u === CHAR + "7" ? ok({ name: "A", decorations: { avatarUrl: av } }) : u === av ? jpeg() : assert.fail(u)));
  const res = await call("/api/ddb/7/avatar?url=https://evil.example/x.png");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/jpeg");
  assert.deepEqual(calls.map((c) => c.url), [CHAR + "7", av], "query van de client wordt genegeerd");

  for (const bad of ["https://evil.example/a.jpg", "http://www.dndbeyond.com/a.jpg", "https://dndbeyond.com.evil.example/a.jpg", "https://user@www.dndbeyond.com/a.jpg", "javascript:alert(1)", null]) {
    mock((u) => (u.startsWith(CHAR) ? ok({ name: "A", decorations: { avatarUrl: bad } }) : assert.fail("mag niet opvragen: " + u)));
    assert.equal((await call("/api/ddb/7/avatar")).status, 404, String(bad));
  }
  // geen afbeelding terug
  mock((u) => (u.startsWith(CHAR) ? ok({ name: "A", decorations: { avatarUrl: av } }) : new Response("<svg onload=x>", { headers: { "content-type": "image/svg+xml" } })));
  assert.equal((await call("/api/ddb/7/avatar")).status, 502);
  // doorverwijzing naar een vreemde host wordt niet gevolgd
  mock((u) => (u.startsWith(CHAR) ? ok({ name: "A", decorations: { avatarUrl: av } }) : u === av ? new Response("", { status: 302, headers: { location: "https://evil.example/a.jpg" } }) : assert.fail("gevolgd: " + u)));
  assert.equal((await call("/api/ddb/7/avatar")).status, 502);
  // doorverwijzing binnen dndbeyond.com mag
  const cdn = "https://media.dndbeyond.com/a.jpeg";
  mock((u) => (u.startsWith(CHAR) ? ok({ name: "A", decorations: { avatarUrl: av } }) : u === av ? new Response("", { status: 301, headers: { location: cdn } }) : u === cdn ? jpeg() : assert.fail(u)));
  assert.equal((await call("/api/ddb/7/avatar")).status, 200);
});

test("avatarOk", () => {
  assert.ok(avatarOk("https://www.dndbeyond.com/avatars/1.png"));
  assert.ok(avatarOk("https://dndbeyond.com/x.png"));
  assert.equal(avatarOk("https://www.dndbeyond.com:8443/x.png"), null);
  assert.equal(avatarOk("https://xdndbeyond.com/x.png"), null);
});

test("review: body zonder stream boven de limiet wordt geweigerd", async () => {
  const big = { headers: new Headers(), body: null, ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(9 * 1024 * 1024) };
  mock(() => big);
  assert.equal((await call("/api/ddb/5")).status, 502);
});
