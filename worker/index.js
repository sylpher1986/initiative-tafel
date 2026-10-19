// Cloudflare Worker: alleen /api/* komt hier (run_worker_first in wrangler.jsonc); de rest zijn statische assets.
//
// GET /api/ddb/:id          → character-JSON van D&D Beyond (ongewijzigd doorgegeven)
// GET /api/ddb/:id/avatar   → het portret van díé character (url komt uit de character-data, nooit van de client)
// /api/room…                → spelersscherm op andere apparaten (Durable Object, zie worker/room.js)
//
// Bewust geen open proxy: vaste upstream-host, alleen numerieke id's, geen doorgestuurde headers of cookies,
// geen CORS-headers (andere sites kunnen het antwoord in de browser niet lezen), grootte- en tijdslimieten.
// De endpoint van D&D Beyond is onofficieel en kan zonder aankondiging veranderen.

import { Room, roomRoute } from "./room.js";
export { Room };

export const ID_RE = /^[1-9]\d{0,11}$/;
const UPSTREAM = "https://character-service.dndbeyond.com/character/v5/character/";
const TIMEOUT = 8000;
const MAX_JSON = 8 * 1024 * 1024;
const MAX_IMG = 5 * 1024 * 1024;
const IMG_TYPES = /^image\/(jpeg|png|webp|gif)$/;

const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...extra },
});
const fail = (error, status, extra) => json({ error }, status, extra);

/** Alleen https-afbeeldingen van D&D Beyond zelf */
export function avatarOk(u) {
  if (typeof u !== "string" || u.length > 500) return null;
  try {
    const x = new URL(u);
    return x.protocol === "https:" && !x.username && !x.password && !x.port && (x.hostname === "dndbeyond.com" || x.hostname.endsWith(".dndbeyond.com")) ? x.href : null;
  } catch { return null; }
}

/** Body lezen met een harde limiet (content-length kan ontbreken of liegen) */
async function readCapped(res, max) {
  const len = +res.headers.get("content-length");
  if (len > max) return null;
  if (!res.body) { const b = new Uint8Array(await res.arrayBuffer()); return b.byteLength > max ? null : b; }
  const reader = res.body.getReader(), parts = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.byteLength;
    if (n > max) { try { await reader.cancel(); } catch {} return null; }
    parts.push(value);
  }
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.byteLength; }
  return out;
}

/** Character ophalen bij D&D Beyond → { buf } (ruwe JSON-bytes) of { error, status }. Geen cache: net op Public gezet moet direct werken. */
async function fetchCharacter(id) {
  let res;
  try {
    res = await fetch(UPSTREAM + id, {
      headers: { accept: "application/json", "user-agent": "initiative-tafel (DM tool)" },
      redirect: "manual", signal: AbortSignal.timeout(TIMEOUT),
    });
  } catch { return { error: "upstream", status: 502 }; }
  if (res.status === 401 || res.status === 403) return { error: "private", status: 403 };
  if (res.status === 404) return { error: "notfound", status: 404 };
  if (!res.ok) return { error: "upstream", status: 502 };
  const buf = await readCapped(res, MAX_JSON);
  return buf ? { buf } : { error: "upstream", status: 502 };
}

// D&D Beyond geeft bij een privé sheet soms 200 met success:false (staat vooraan in het antwoord)
const looksPrivate = (buf) => /"success"\s*:\s*false/.test(new TextDecoder().decode(buf.subarray(0, 400)));

/** Ongewijzigd doorgeven: niet parsen of inkorten, want dat kost CPU-tijd (gratis plan: 10 ms per verzoek). De browser parset zelf. */
async function character(id) {
  const r = await fetchCharacter(id);
  if (r.error) return fail(r.error, r.status);
  if (looksPrivate(r.buf)) return fail("private", 403);
  return new Response(r.buf, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

/** Voor de avatar-route: één keer parsen om de avatar-url uit de character te halen */
async function getCharacter(id) {
  const r = await fetchCharacter(id);
  if (r.error) return r;
  let body;
  try { body = JSON.parse(new TextDecoder().decode(r.buf)); } catch { return { error: "upstream", status: 502 }; }
  if (!body || body.success === false || !body.data || typeof body.data !== "object") return { error: "private", status: 403 };
  return { data: body.data };
}

async function avatar(id) {
  const r = await getCharacter(id);
  if (r.error) return fail(r.error, r.status);
  const url = avatarOk(r.data.decorations && r.data.decorations.avatarUrl);
  if (!url) return fail("noavatar", 404);
  // doorverwijzingen zelf volgen, met dezelfde hostcontrole per stap (max 3)
  let res, next = url;
  try {
    for (let hop = 0; ; hop++) {
      res = await fetch(next, { headers: { accept: "image/*" }, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT) });
      if (res.status < 300 || res.status > 399) break;
      next = hop < 3 && avatarOk(new URL(res.headers.get("location") || "", next).href);
      if (!next) return fail("upstream", 502);
    }
  } catch { return fail("upstream", 502); }
  const type = String(res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!res.ok || !IMG_TYPES.test(type)) return fail("upstream", 502);
  const buf = await readCapped(res, MAX_IMG);
  if (!buf) return fail("toolarge", 502);
  return new Response(buf, { headers: { "content-type": type, "cache-control": "private, max-age=300", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'" } });
}

export async function handle(req, env) {
  const url = new URL(req.url);
  if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
  if (url.pathname.startsWith("/api/room")) { const r = await roomRoute(req, env, url); if (r) return r; }
  const m = url.pathname.match(/^\/api\/ddb\/([^/]+)(\/avatar)?\/?$/);
  if (!m) return fail("notfound", 404);
  if (req.method !== "GET") return fail("method", 405, { allow: "GET" });
  if (!ID_RE.test(m[1])) return fail("bad-id", 400);
  return m[2] ? avatar(m[1]) : character(m[1]);
}

export default { fetch: (req, env) => handle(req, env).catch(() => fail("server", 500)) };
