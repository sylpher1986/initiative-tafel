// Acties uit een statblock compact maken voor de monsterkaart: to hit, damage (met type) en save-DC.
// Puur: geen DOM. Statblocktekst kan uit een import komen; de UI escapet alles wat hieruit komt.

const ABIL = { strength: "STR", dexterity: "DEX", constitution: "CON", intelligence: "INT", wisdom: "WIS", charisma: "CHA" };
const DICE = String.raw`(\d+d\d+(?:\s*[+−-]\s*\d+)?)`;
const TYPE = String.raw`([a-z]+(?: or [a-z]+)?)`; // "lightning or thunder" (Djinni)
const DMG_RE = new RegExp(String.raw`(?:\d+\s*)?\(` + DICE + String.raw`\)\s*` + TYPE + String.raw`\s+damage`, "gi");
const FLAT_RE = new RegExp(String.raw`^Hit:\s*(\d+)\s+` + TYPE + String.raw`\s+damage`, "i");
const SAVE = "(strength|dexterity|constitution|intelligence|wisdom|charisma)";
const DC_RE = new RegExp(String.raw`DC\s*(\d+)\s+` + SAVE + String.raw`(?:\s+or\s+` + SAVE + String.raw`)?\s+saving throw`, "i");

/** "2d10 + 6" → "2d10+6" (ook met het echte minteken) */
export const cleanExpr = (e) => String(e).replace(/−/g, "-").replace(/\s/g, "");

/** Naam zonder "(Recharge 5–6)" of "(1/Day)": dat staat al op de recharge-chip */
const shortName = (n) => String(n).replace(/\s*\((?:recharge[^)]*|\d+\/day[^)]*|costs? \d+ actions?)\)/gi, "").trim() || String(n);

/**
 * Damage-delen: bij een aanval alleen de eerste worp na "Hit:" plus wat er met "plus" aan vastzit
 * ("17 (2d10 + 6) piercing damage plus 4 (1d8) acid damage"); "or …" (versatile, op afstand) blijft in het statblock.
 * Zonder "Hit:" (breath weapon, save-actie): de eerste worp in de tekst.
 */
function damage(t, isAtk) {
  const i = isAtk ? t.search(/Hit:/i) : 0;
  if (i < 0) return [];
  const part = t.slice(i);
  const out = [];
  let end = -1, alt = false;
  // vaste schade vooraan ("Hit: 1 piercing damage plus 7 (3d4) poison damage")
  const f = isAtk && part.match(FLAT_RE);
  if (f) { out.push({ flat: +f[1], type: f[2].toLowerCase() }); end = f[0].length; }
  for (const m of part.matchAll(DMG_RE)) {
    const gap = out.length ? part.slice(end, m.index) : "";
    end = m.index + m[0].length;
    if (!out.length || /^[\s,]*plus\s*$/i.test(gap) || (alt && /^[^.]*,\s*plus\s*$/i.test(gap))) {
      out.push({ e: cleanExpr(m[1]), type: m[2].toLowerCase() }); alt = false;
    } else if (/^[\s,]*or\s*$/i.test(gap)) alt = true; // "…, or 8 (1d10 + 3) … if used with two hands, plus 3 (1d6) fire": alternatief overslaan
    else break;
  }
  return out;
}

/** Eén actie → { n, hit, reach, dmg: [{e, type} | {flat, type}], dc: {n, ab} | null, multi, text } */
export function parseAction(name, text) {
  const t = String(text || "");
  const n = String(name || "");
  const hm = t.match(/([+-]\d+)\s+to hit/i);
  const hit = hm ? +hm[1] : null;
  const rm = t.match(/\b(reach \d+ ft\.|range \d+(?:\/\d+)? ft\.)/i);
  const dm = t.match(DC_RE);
  return {
    n: shortName(n), hit,
    reach: rm ? rm[1] : "",
    dmg: damage(t, hit !== null),
    dc: dm ? { n: +dm[1], ab: [dm[2], dm[3]].filter(Boolean).map((x) => ABIL[x.toLowerCase()]).join("/") } : null,
    multi: /^multiattack/i.test(n),
    text: t,
  };
}

/** Heeft iets om te rollen of een DC; anders hoort de actie alleen in het statblock */
export const useful = (a) => a.hit !== null || a.dc !== null || a.dmg.length > 0;

const cache = new WeakMap();

/**
 * Compacte acties van een monster (uit findMon):
 * main = Multiattack + acties en bonus actions met een worp of DC; other = alle reactions en legendary actions
 * (ook zonder worp: "Detect", "Parry" wil je wel zien). Per monster-object onthouden.
 */
export function monsterActions(m) {
  if (!m) return null;
  if (cache.has(m)) return cache.get(m);
  const list = (arr, tag) => (Array.isArray(arr) ? arr : []).filter(Array.isArray).map(([k, v]) => {
    const c = tag === "Legendary" && String(k).match(/\(costs? (\d+) actions?\)/i);
    return { ...parseAction(k, v), tag: c ? `${tag} · ${c[1]} LA` : tag };
  });
  const acts = [...list(m.a, ""), ...list(m.ba, "Bonus")];
  const res = {
    multi: acts.find((a) => a.multi) || null,
    main: acts.filter((a) => !a.multi && useful(a)),
    other: [...list(m.re, "Reaction"), ...list(m.l, "Legendary")],
  };
  if (!res.multi && !res.main.length && !res.other.length) return cache.set(m, null), null;
  cache.set(m, res);
  return res;
}

/** Damage-knop: "2d10+6:piercing|1d8:acid"; vaste delen tellen mee ("1:piercing|3d4:poison"). Alleen vaste schade: geen knop. */
export const dmgKey = (dmg) => (dmg.some((x) => x.e) ? dmg.map((x) => `${x.e || x.flat}:${x.type}`).join("|") : "");

/** Rolt een dmgKey: { parts: [{e, type, rolls, mod, total}], total } of null bij een onleesbare sleutel */
export function rollDmg(key, roll) {
  const parts = [];
  for (const p of String(key).split("|")) {
    const [e, type = ""] = p.split(":");
    const r = /^\d+$/.test(e) ? { rolls: [], mod: +e, total: +e } : roll(e);
    if (!r) return null;
    parts.push({ e, type, rolls: r.rolls, mod: r.mod, total: r.total });
  }
  return parts.length ? { parts, total: parts.reduce((a, b) => a + b.total, 0) } : null;
}

/** Save-actie met schade (breath weapon, Fire Ray): kan via het AoE-paneel op meerdere doelen */
export const isSaveAoe = (a) => !!a && a.hit === null && !!a.dc && a.dmg.length > 0;

/** Recharge-chip die bij een actie hoort (op naam, zonder "(Recharge 5–6)"); -1 als er geen is */
export const rcIndex = (rc, n) => (Array.isArray(rc) ? rc.findIndex((r) => r && String(r.n).toLowerCase() === String(n).toLowerCase()) : -1);

/**
 * Een save-actie klaarmaken voor het AoE-paneel: schade gerold, type, save-ability en DC uit de actie.
 * Delen met hetzelfde type als het eerste tellen samen; een ander type ("plus 2d6 fire") komt als hint (apart toepassen).
 * half = de tekst noemt halve schade bij een geslaagde save; anders is geslaagd = geen schade.
 * types = bekende damage types (anders type leeg, bijv. "lightning or thunder"). roll = rollExpr.
 */
export function actionAoe(a, roll, types = []) {
  if (!isSaveAoe(a)) return null;
  const r = rollDmg(a.dmg.map((x) => `${x.e || x.flat}:${x.type}`).join("|"), roll);
  if (!r) return null;
  const t0 = r.parts[0].type;
  const same = r.parts.filter((p) => p.type === t0), other = r.parts.filter((p) => p.type !== t0);
  const txt = (p) => (p.rolls.length ? `${p.e} [${p.rolls.join(", ")}] = ${p.total}` : String(p.total));
  return {
    dmg: Math.min(999, same.reduce((s, p) => s + p.total, 0)),
    type: types.includes(t0) ? t0 : "",
    ab: a.dc.ab.split("/")[0],
    dc: a.dc.n,
    half: /\bhalf (?:as much|(?:the|that)(?: [a-z]+)?) damage/i.test(a.text),
    roll: same.map(txt).join(" + ") + (same.length > 1 ? ` = ${same.reduce((s, p) => s + p.total, 0)}` : ""),
    extra: other.map((p) => `plus ${p.e} ${p.type}`).join(", "),
  };
}
