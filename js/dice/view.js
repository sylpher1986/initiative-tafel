// Gedeelde dobbelsteenmodule (G7, WP80): worp (worpformaat uit ./roll.js) → HTML en platte tekst. Puur: geen DOM, rekent niets uit.
// Importeert alleen ../i18n/* en ./* (tests/dice.test.js). Opmaak in css/dice.css; ontwerp optie C (groepslabel + waardeblokjes,
// totaal in een eigen kolom), goedgekeurd door Michiel 31-10-2026. De stenen zelf zijn geen tikdoelen.
import { t } from "../i18n/boot.js";
import { kept, natFlags } from "./roll.js";

// Eigen kopie: js/dice mag js/ui/util.js niet importeren (importgrens).
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (n) => (n < 0 ? "−" : "") + Math.abs(n);
const sgn = (n) => (n < 0 ? "−" : "+") + Math.abs(n);
const okNum = (n) => Number.isFinite(n);
/** "d20" bij één steen of houden (adv/dis, kh), anders "2d10" */
const gLbl = (g) => (g.c === 1 || (g.keep !== "all" && g.keep) ? `d${g.die}` : `${g.c}d${g.die}`);
const vals = (g) => (Array.isArray(g.vals) ? g.vals.filter(okNum) : []);
const xs = (g) => (Array.isArray(g.x) ? g.x.filter(okNum) : []);
const objs = (a) => (Array.isArray(a) ? a.filter((x) => x && typeof x === "object") : []);
/** Opgeschoonde kopie: rommel in g/m geeft geen uitzondering (roll.js verwacht een geldig formaat) */
const die = (n) => Number.isInteger(n) && n >= 2 && n <= 1000;
const norm = (r) => (r && typeof r === "object"
  ? { ...r, g: objs(r.g).filter((g) => die(g.die)).map((g) => { const v = vals(g); return { ...g, c: v.length, vals: v }; }), m: objs(r.m).filter((m) => okNum(m.b) || (Number.isInteger(m.die) && die(Math.abs(m.die)))) }
  : { g: [], m: [] });

/** Index van de tellende nat-d20 in de enige d20-groep, of -1 */
function natAt(r, g) {
  const f = natFlags(r);
  if ((!f.nat20 && !f.nat1) || g.die !== 20 || g.s === -1) return -1;
  const k = kept(g);
  return k.length === 1 ? k[0] : -1;
}

function groupHtml(r, g, noLbl = false) {
  const v = g.vals, k = new Set(kept(g)), at = natAt(r, g), f = natFlags(r);
  const dice = v.map((x, i) => {
    if (!k.has(i)) return `<s class="drd no">${num(x)}</s>`;
    if (i !== at) return `<span class="drd">${num(x)}</span>`;
    return `<span class="drd ${f.nat20 ? "n20" : "n1"}">${num(x)}</span><span class="drn${f.nat1 ? " bad" : ""}">${esc(t(f.nat20 ? "dice.nat20" : "dice.nat1"))}</span>`;
  }).join("");
  const x = xs(g);
  const crit = x.length ? `<span class="drc"><span class="drcw">${esc(t("dice.crit"))}</span>${x.map((y) => `<span class="drd">${num(y)}</span>`).join("")}</span>` : "";
  return `<span class="drg">${g.s === -1 ? "−" : ""}${noLbl ? "" : `<span class="drl">${gLbl(g)}</span>`}${dice}</span>${crit}`;
}

/** Som van de modifiers (vast + gerolde modifier-stenen), zoals total() in roll.js */
const mSum = (m) => (okNum(m.b) ? m.b : okNum(m.die) && m.die && okNum(m.v) ? Math.sign(m.die) * m.v : 0);

/**
 * Compacte variant (WP81): één regel voor lange lijsten (AoE per doel), het initiative-paneel en meldingen.
 * Geen groepslabel bij alleen een d20, modifiers opgeteld met hun namen klein erachter (volledig in het aria-label),
 * totaal inline en ✓/✗ als tekst. toast: kleuren op de --toast-*-tokens.
 */
function compactHtml(r, opts) {
  const one = r.g.length === 1 && r.g[0].die === 20 && r.g[0].s !== -1;
  const names = r.m.map((m) => m.n).filter(Boolean);
  const mods = r.m.length ? `<span class="drm"><b>${sgn(r.m.reduce((s, m) => s + mSum(m), 0))}</b>${names.length ? `<span class="drmn">${esc(names.join(", "))}</span>` : ""}</span>` : "";
  const h = opts.head && opts.head.txt ? `<span class="drh${opts.head.cls === "ok" || opts.head.cls === "bad" ? " " + opts.head.cls : ""}">${esc(opts.head.txt)}</span>` : "";
  const ok = r.ok === true ? `<span class="drk ok">✓</span>` : r.ok === false ? `<span class="drk bad">✗</span>` : "";
  // één tellende steen zonder modifiers en crit-dice: "= 15" herhaalt alleen de steen (death save)
  // alleen een vaste waarde zonder naam (vaste schade "28"): alleen het getal, geen "+28 = 28"
  if (!r.g.length && r.m.length === 1 && !r.m[0].n && okNum(r.m[0].b) && r.m[0].b === r.tot)
    return `<span class="droll cp${opts.toast ? " drts" : ""}" role="img" aria-label="${esc(diceText(r, opts))}">${r.label ? `<span class="drl drlab">${esc(r.label)}</span>` : ""}${h}<span class="drq"><b class="drnum">${num(r.tot)}</b>${ok}</span></span>`;
  const bare = !r.m.length && r.g.length === 1 && !xs(r.g[0]).length && r.g[0].s !== -1 && kept(r.g[0]).length === 1 && r.g[0].vals[kept(r.g[0])[0]] === r.tot;
  return `<span class="droll cp${opts.toast ? " drts" : ""}" role="img" aria-label="${esc(diceText(r, opts))}">`
    + `${r.label ? `<span class="drl drlab">${esc(r.label)}</span>` : ""}${r.g.map((g) => groupHtml(r, g, one)).join("")}${mods}${h}`
    + `<span class="drq">${bare ? "" : `=<b class="drnum">${okNum(r.tot) ? num(r.tot) : "?"}</b>`}${ok}</span></span>`;
}

function modHtml(m) {
  const n = m.n ? `${esc(m.n)} ` : "";
  if (okNum(m.b)) return `<span class="drm">${n}<b>${sgn(m.b)}</b></span>`;
  if (!okNum(m.die) || !m.die) return "";
  return `<span class="drm">${n}${m.die < 0 ? "−" : ""}<span class="drl">d${Math.abs(m.die)}</span><span class="drd sm">${okNum(m.v) ? m.v : "?"}</span></span>`;
}

/**
 * Worp → HTML. opts: { head: { txt, cls: "ok"|"bad" } (uitslagwoord van de tool, boven het totaal), sub (tekst onder het totaal
 * in plaats van "vs AC 16", bijv. een damage type), sm (kleiner totaal, bijv. schadedelen), compact (één regel, WP81),
 * toast (bij compact: in een melding) }. Alles via esc(); onbekende velden genegeerd.
 */
export function diceHtml(r, opts) {
  r = norm(r); opts = opts || {};
  if (opts.compact) return compactHtml(r, opts);
  const terms = [
    r.label ? `<span class="drl drlab">${esc(r.label)}</span>` : "",
    ...r.g.map((g) => groupHtml(r, g)),
    ...r.m.map(modHtml),
  ].join("");
  const h = opts.head && opts.head.txt ? `<span class="drh${opts.head.cls === "ok" || opts.head.cls === "bad" ? " " + opts.head.cls : ""}">${esc(opts.head.txt)}</span>` : "";
  const sub = opts.sub != null && opts.sub !== "" ? esc(opts.sub) : r.vs && okNum(r.vs.n) ? esc(t("dice.vs", { k: r.vs.k, n: r.vs.n })) : "";
  return `<div class="droll${opts.sm ? " sm" : ""}" role="img" aria-label="${esc(diceText(r, opts))}"><div class="drterm">${terms}</div>`
    + `<div class="drtot">${h}<b class="drnum">${okNum(r.tot) ? num(r.tot) : "?"}</b>${sub ? `<span class="drv">${sub}</span>` : ""}</div></div>`;
}

/** Dezelfde worp als platte tekst (aria-label): "Hit: d20 20 nat 20, 6 not counted; +11; Bless d4 3; total 32 vs AC 16" */
export function diceText(r, opts) {
  r = norm(r); opts = opts || {};
  const f = natFlags(r), out = [];
  if (r.label) out.push(String(r.label));
  for (const g of r.g) {
    const v = g.vals, k = new Set(kept(g)), at = natAt(r, g);
    const ds = v.map((x, i) => `${num(x)}${i === at ? ` ${t(f.nat20 ? "dice.nat20" : "dice.nat1")}` : ""}${k.has(i) ? "" : ` ${t("dice.no")}`}`).join(", ");
    const x = xs(g);
    out.push(`${g.s === -1 ? "−" : ""}${gLbl(g)} ${ds}${x.length ? `, ${t("dice.crit")} ${x.map(num).join(", ")}` : ""}`);
  }
  for (const m of r.m) {
    const n = m.n ? `${m.n} ` : "";
    if (okNum(m.b)) out.push(`${n}${sgn(m.b)}`);
    else if (okNum(m.die) && m.die) out.push(`${n}${m.die < 0 ? "−" : ""}d${Math.abs(m.die)} ${okNum(m.v) ? m.v : "?"}`);
  }
  const sub = opts.sub != null && opts.sub !== "" ? ` ${opts.sub}` : r.vs && okNum(r.vs.n) ? ` ${t("dice.vsSr", { k: r.vs.k, n: r.vs.n })}` : "";
  // compact zonder uitslagwoord: ✓/✗ staat alleen als teken op het scherm, dus hier voluit
  const ok = opts.compact && !(opts.head && opts.head.txt) && typeof r.ok === "boolean" ? `, ${t(r.ok ? "dice.okSr" : "dice.failSr")}` : "";
  out.push(`${t("dice.total")} ${okNum(r.tot) ? num(r.tot) : "?"}${sub}${ok}`);
  return `${opts.head && opts.head.txt ? `${opts.head.txt}: ` : ""}${out.join("; ")}`;
}
