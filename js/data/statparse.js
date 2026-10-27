// RE14: een geplakt statblock (eigen monster) omzetten naar dezelfde structuur als een SRD-monster:
// traits (t), acties (a), bonus actions (ba), reactions (re), legendary actions (l, ld), ability scores (ab) en
// de regels onder de kop (x: Saving Throws, Damage Resistances …). Puur: geen DOM. De tekst komt van de gebruiker
// (onbetrouwbaar); alles blijft platte tekst, de UI escapet.
// Herkent het klassieke formaat (SRD, D&D Beyond, 5etools) en de 2024-schrijfwijze van aanvallen en saves.
import { M, J } from "../i18n/msg.js";
import { classic } from "../rules/statform.js";
export { classic }; // WP48: verhuisd naar js/rules/statform.js (de parsers gebruiken hem ook)

/** Naam van de trait met niet herkende tekst: een marker, de UI toont hem als "Other"/"Overig" (trName in statblock.js) */
export const REST = "\u0000rest";

const SECT = [
  [/^(?:bonus actions?)$/i, "ba"],
  [/^(?:reactions?)$/i, "re"],
  [/^(?:legendary actions?)$/i, "l"],
  [/^(?:actions?)$/i, "a"],
  [/^(?:traits?|special (?:traits|abilities))$/i, "t"],
  [/^(?:lair actions?|regional effects?|mythic actions?|villain actions?)$/i, "rest"], // niet ondersteund: als vrije tekst
];
// Regels onder de kop, in de volgorde van een statblock. Komen in x (zoals bij een SRD-monster), behalve AC/HP/Speed/CR.
const KEYS = ["Armor Class", "Hit Points", "Speed", "Saving Throws", "Skills", "Damage Vulnerabilities", "Damage Resistances",
  "Damage Immunities", "Condition Immunities", "Senses", "Languages", "Challenge", "Proficiency Bonus", "Initiative"];
const KEY_RE = new RegExp(`^(${KEYS.join("|")}|AC|HP|CR|Saves|Resistances|Immunities|Vulnerabilities|Gear)\\s*:?\\s+(.+)$`, "i");
const ALIAS = { ac: "Armor Class", hp: "Hit Points", cr: "Challenge", saves: "Saving Throws", resistances: "Damage Resistances",
  vulnerabilities: "Damage Vulnerabilities", immunities: "Damage Immunities" };
const IN_X = ["Saving Throws", "Skills", "Damage Vulnerabilities", "Damage Resistances", "Damage Immunities", "Condition Immunities", "Senses", "Languages"];
const LIST_RE = /^(?:[*•-]\s*)?(?:cantrips?|at will|\d+(?:st|nd|rd|th)[- ]level|\d+\/day)\b/i;
const CONDS_RE = /^(?:(?:blinded|charmed|deafened|exhaustion|frightened|grappled|incapacitated|invisible|paralyzed|petrified|poisoned|prone|restrained|stunned|unconscious)(?:,\s*|\s+and\s+|$))+$/i;
const ABN = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
const SMALL = /^(?:of|the|and|or|in|on|with|to|a|an|its|by|for|from|at|per|vs\.?)$/i;

/** Uitgerekte tekens uit pdf's en websites gelijktrekken: echte min/streepjes, harde spaties, dubbele spaties */
const norm = (s) => String(s).replace(/ /g, " ").replace(/[−]/g, "-").replace(/[ \t]+/g, " ").trim();

/** Lijkt op de naam van een entry ("Bite", "Fire Breath (Recharge 5–6)", "Wing Attack (Costs 2 Actions)") en niet op een zin */
function entryName(s) {
  const base = s.replace(/\s*\([^)]*\)/g, "").replace(/^Variant:\s*/i, "").trim(); // "Variant: Summon Demon (1/Day)"
  if (!base || base.length > 48 || /[,:;]/.test(base)) return false;
  const w = base.split(/\s+/);
  if (w.length > 6) return false;
  return w.every((x, i) => /^[A-Z0-9]/.test(x) || (i > 0 && SMALL.test(x)) || /^[a-z]+-[A-Z]/.test(x));
}

/** "Bite. Melee …" → ["Bite", "Melee …"]; een naam die eindigt op ")" mag ook (Recharge, Costs, 3/Day) */
function splitEntry(line) {
  const m = line.match(/^([^.]{1,70}?(?:\([^)]*\))?)\.\s+(\S.*)$/) || line.match(/^([^.:]{1,70}?\([^)]*\))\.?\s*$/);
  if (!m || !entryName(m[1])) return null;
  return [m[1].trim(), (m[2] || "").trim()];
}

/** Ability scores: "STR DEX CON …" met eronder "18 (+4) 14 (+2) …", of per regel "STR 18 (+4)" / "STR\n18 (+4)" (D&D Beyond) */
function abilities(lines) {
  const ab = [], used = new Set();
  for (let i = 0; i < lines.length && ab.length < 6; i++) {
    const s = lines[i];
    // kop met alle zes afkortingen op één regel: de getallen staan op dezelfde of de volgende regel(s)
    if (/^STR\b.*\bDEX\b.*\bCON\b.*\bINT\b.*\bWIS\b.*\bCHA\b/i.test(s)) {
      let j = i;
      const pick = (t) => [...t.replace(/\([^)]*\)/g, " ").matchAll(/\b(\d{1,2})\b/g)].map((x) => +x[1]); // modifiers tussen haakjes tellen niet
      const nums = pick(s.replace(/STR|DEX|CON|INT|WIS|CHA/gi, " "));
      while (nums.length < 6 && j + 1 < lines.length && j - i < 6) { j++; nums.push(...pick(lines[j])); }
      if (nums.length >= 6) { for (let k = i; k <= j; k++) used.add(k); return { ab: nums.slice(0, 6), used }; }
    }
    // "STR 18 (+4)" per regel, of 2024 "Str 13 +1 +1 Dex 6 −2 −2 …" (meerdere paren op één regel)
    if (/^(STR|DEX|CON|INT|WIS|CHA)\b\s*:?\s*\d{1,2}\b/i.test(s)) {
      const before = ab.length;
      for (const x of s.matchAll(/\b(STR|DEX|CON|INT|WIS|CHA)\b\s*:?\s*(\d{1,2})\b/gi)) if (ABN.indexOf(x[1].toUpperCase()) === ab.length) ab.push(+x[2]);
      if (ab.length > before) { used.add(i); continue; }
    }
    if (new RegExp(`^${ABN[ab.length]}$`, "i").test(s) && /^\d{1,2}\b/.test(lines[i + 1] || "")) {
      ab.push(+lines[i + 1].match(/^\d+/)[0]); used.add(i); used.add(i + 1); i++; continue;
    }
  }
  return ab.length === 6 && ab.every((v) => v >= 1 && v <= 30) ? { ab, used } : { ab: null, used: new Set() };
}

/**
 * Plaktekst → { t, a, ba, re, l, ld, x, ab, n, meta, ac, hp, hd, spd, cr, rest, found }.
 * found = herkende onderdelen (aantallen) voor de terugmelding in het formulier; rest = wat niet herkend is (vrije tekst).
 * Zonder kop "Actions": entries met "to hit", een DC met schade of de naam Multiattack zijn acties, de rest traits.
 */
export function parseStatText(text) {
  const raw = String(text || "").replace(/\r/g, "").split("\n").map(norm).filter(Boolean);
  const out = { t: [], a: [], ba: [], re: [], l: [], ld: "", x: [], ab: null, n: "", meta: "", ac: "", hp: "", hd: "", spd: "", cr: "", rest: "" };
  const { ab, used } = abilities(raw);
  out.ab = ab;
  // met minstens één sectiekop zijn entries vóór de eerste kop traits; zonder koppen beslist de tekst
  const hasSec = raw.some((l) => SECT.some(([re]) => re.test(l.replace(/[:.]$/, ""))));
  let sec = hasSec ? "t0" : null, cur = null, head = true, ents = false; // ents: kopregels (Speed, Skills) alleen vóór de eerste entry
  const rest = [];
  const push = (k, e) => { out[k].push(e); cur = e; };
  raw.forEach((line, i) => {
    if (used.has(i)) { cur = null; return; }
    const sx = SECT.find(([re]) => re.test(line.replace(/[:.]$/, "")));
    if (sx) { sec = sx[1]; cur = null; head = false; return; }
    if (sec === "rest") { rest.push(line); return; }
    const e0 = splitEntry(line), kv = !(e0 && e0[1] && !/\d/.test(e0[0])) && line.match(KEY_RE); // "Speed Burst. The …" is een trait
    if (kv && !ents && (sec === null || sec === "t0")) {
      const k = ALIAS[kv[1].toLowerCase()] || KEYS.find((x) => x.toLowerCase() === kv[1].toLowerCase()) || kv[1], v = kv[2].trim();
      if (k === "Armor Class") out.ac = v;
      else if (k === "Hit Points") { const m = v.match(/^(\d+)\s*(?:\(([^)]*)\))?/); if (m) { out.hp = m[1]; out.hd = (m[2] || "").replace(/\s/g, "").replace(/−/g, "-"); } }
      else if (k === "Speed") out.spd = v;
      else if (k === "Challenge") out.cr = (v.match(/^(\d+\/\d+|\d+)/) || [""])[0];
      else if (k === "Damage Immunities" && kv[1].toLowerCase() === "immunities") { // 2024: "Immunities Poison; Exhaustion, Poisoned"
        const [dmg, cond] = v.includes(";") ? v.split(";").map((x) => x.trim()) : CONDS_RE.test(v) ? ["", v] : [v, ""];
        if (dmg) out.x.push(["Damage Immunities", dmg.toLowerCase()]);
        if (cond) out.x.push(["Condition Immunities", cond.toLowerCase()]);
      }
      else if (IN_X.includes(k)) out.x.push([k, v]);
      cur = null; head = false; return;
    }
    if (head && !out.meta && /^(?:tiny|small|medium|large|huge|gargantuan)\b/i.test(line)) { out.meta = line; return; }
    if (head && !out.n && i === 0 && !/\.\s+\S/.test(line)) { out.n = line; return; } // eerste regel zonder zin: de naam
    const e = e0;
    if (e) {
      head = false; ents = true;
      const tx = classic(e[1]);
      const k = sec === "t0" ? "t" : sec || (/^multiattack/i.test(e[0]) || /Attack:\s*[+-]\d+\s+to hit/i.test(tx) ? "a" : "t");
      push(k, [e[0], tx]);
      return;
    }
    if (sec === "l" && !out.l.length) { out.ld = out.ld ? `${out.ld} ${line}` : line; return; } // inleiding van de legendary actions
    // volgende regel van de vorige entry: midden in een zin (pdf-afbreking) met een spatie, anders een nieuwe alinea
    // spell-lijsten ("Cantrips (at will): …", "1st level (4 slots): …", "3/day each: …") blijven eigen regels (castInfo, linkSpells)
    if (cur) {
      const mid = !LIST_RE.test(line) && !/^[*•]/.test(line)
        && (/^[a-z(]/.test(line) || (/[\w,(-]$/.test(cur[1]) && !LIST_RE.test(cur[1].split("\n").pop()))); // na een spell-lijst: kleine letter = afgebroken
      cur[1] = classic(`${cur[1]}${mid ? " " : "\n"}${line}`); return;
    }
    head = false;
    rest.push(line);
  });
  out.rest = rest.join("\n");
  out.found = { a: out.a.length + out.ba.length, re: out.re.length, l: out.l.length, t: out.t.length, ab: !!out.ab, x: out.x.length };
  return out;
}

const cut = (v, n = 40) => (v.length > n ? v.slice(0, n - 1).trimEnd() + "…" : v);
/**
 * Terugmelding onder de plaktekst (RE14): wat er herkend is, in de volgorde van het formulier.
 * "AC 18 · 52 HP (8d8+16) · CR 3 · Dex 14 · 3 acties · 2 legendary actions · resist fire, cold"
 */
export function foundText(p) {
  if (!p) return "";
  const n = (v, k) => (v ? M(`init.custom.f.${k}`, { n: v }) : "");
  const xv = (k) => (p.x.find(([n]) => n === k) || [])[1];
  return J([ // WP32: descriptor, de UI vertaalt (t vertaalt een descriptor als waarde zelf)
    parseInt(p.ac) ? `AC ${parseInt(p.ac)}` : "",
    p.hp ? `${p.hp} HP${p.hd ? ` (${p.hd})` : ""}` : "",
    p.cr ? `CR ${p.cr}` : "",
    p.ab ? `Dex ${p.ab[1]}` : "",
    n(p.a.length + p.ba.length, "act"), n(p.re.length, "re"), n(p.l.length, "la"), n(p.t.length, "tr"),
    xv("Damage Resistances") ? M("init.custom.f.resist", { list: cut(xv("Damage Resistances")) }) : "",
    xv("Damage Immunities") ? M("init.custom.f.immune", { list: cut(xv("Damage Immunities")) }) : "",
  ].filter(Boolean), " · ");
}
/** Is er iets herkend dat het monster structuur geeft (anders blijft het vrije tekst, zoals vroeger) */
export const hasStructure = (p) => !!(p && (p.a.length || p.ba.length || p.re.length || p.l.length || p.t.length || p.ab || p.x.length));

const cache = new WeakMap();
/**
 * Eigen monster met plaktekst → monster met structuur (findMon gebruikt dit). Velden uit het formulier (AC, HP, CR,
 * Dex) gaan voor; een monster dat al structuur heeft (import, eigen formaat) blijft zoals het is.
 * De plaktekst blijft de bron (bewaard en geëxporteerd); niet herkende regels worden de trait REST (getoond als
 * "Overig"/"Other" in de taal van de pagina, ook als de catalogus pas na het opbouwen binnenkwam), text leeg.
 */
export function withParsed(m) {
  if (!m || !m.text || (Array.isArray(m.a) && m.a.length) || (Array.isArray(m.t) && m.t.length)) return m;
  if (cache.has(m)) return cache.get(m);
  const p = parseStatText(m.text);
  const r = !hasStructure(p) ? m : {
    ...m, t: p.rest ? [...p.t, [REST, p.rest]] : p.t, a: p.a, ba: p.ba, re: p.re, l: p.l, ld: p.ld, // niet herkend: trait REST (naam bij het tekenen)
    x: [...(Array.isArray(m.x) ? m.x : []), ...p.x],
    // getypte Dex gaat voor (initiative leest ab[1]); 10 is de oude standaardwaarde van het formulier, die telt niet
    ...(p.ab && !m.ab ? { ab: m.dexScore && m.dexScore !== 10 ? [p.ab[0], +m.dexScore, ...p.ab.slice(2)] : p.ab } : {}),
    ...(p.meta && !m.meta ? { meta: p.meta } : {}),
    ...(p.spd && !m.spd ? { spd: p.spd } : {}),
    text: "",
  };
  cache.set(m, r);
  return r;
}
