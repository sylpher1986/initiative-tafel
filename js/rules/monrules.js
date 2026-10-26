// RE13: monsterregels die je aan tafel vergeet (5e 2014, alleen de bekende SRD-patronen). Puur: geen DOM.
//   Undead Fortitude: op 0 HP gebracht → CON-save DC 5 + schade, geslaagd = 1 HP (niet bij radiant of een crit).
//   Save-riders: "Hit: … DC 11 Strength saving throw or be knocked prone" na een treffer.
//   Parry: reaction, +N AC tegen één melee-aanval die zou raken.
import { fx, merge, applyDamage, dropConc, say } from "./combat.js";
import { M } from "../i18n/msg.js";
import { t as tt } from "../i18n/boot.js"; // tt: parseRider heeft een lokale t
import { makeDur } from "./turns.js";
import { NO_ACT } from "./legendary.js";
import { saveAdv, rollSave, saveBonus } from "./aoe.js";
import { saveMods } from "./effects.js";

/** Monster-save rollen zoals overal: statblock-bonus, advantage/disadvantage (Rage, Exhaustion, Magic Resistance) en Bless/Bane/cover */
export function monSave(c, m, ab, magic = false, rng = Math.random) {
  const sa = saveAdv(c, ab, magic);
  return rollSave(saveBonus(m, ab), sa.v, rng, saveMods(c, ab), sa.why);
}

/** Undead Fortitude-uitzondering uit een aanvalsuitslag: crit, of radiant-schade die erdoor kwam */
export const ufInfo = (res) => ({ crit: !!res.crit, radiant: (res.types || []).some((t) => t.type === "radiant" && t.dealt > 0) });

const ABIL = { strength: "STR", dexterity: "DEX", constitution: "CON", intelligence: "INT", wisdom: "WIS", charisma: "CHA" };
const traits = (m) => (m && Array.isArray(m.t) ? m.t.filter(Array.isArray) : []);

/* ---------- Undead Fortitude ---------- */
export const hasUF = (m) => traits(m).some(([k]) => /^undead fortitude\b/i.test(String(k)));
export const ufDc = (dealt) => 5 + Math.max(0, dealt | 0);

/**
 * Hoort er een Undead Fortitude-worp bij deze schade? c = monster ná de schade, was = HP ervoor, dealt = schade die
 * eraf ging (na resistance). info.radiant / info.crit: true = uitzondering, false = geen, undefined = onbekend (telt als geen).
 * Geeft null (niet van toepassing), { skip: "radiant"|"kritiek" } of { dc }.
 */
export function ufNeed(c, m, was, dealt, info = {}) {
  if (!c || c.kind !== "monster" || !hasUF(m) || !(was > 0) || c.hp > 0 || !(dealt > 0)) return null;
  if (info.radiant) return { skip: info.why || "radiant" };
  if (info.crit) return { skip: tt("rules.atk.crit") };
  return { dc: ufDc(dealt) };
}

/**
 * Worp verwerken (de UI rolt met rollSave: statblock-save + saveMods). Geslaagd: 1 HP in plaats van 0.
 * Geeft Fx met de logoorzaak; txt = staart voor de melding ("Undead Fortitude CON 19: d20 [17] +3 = 20, blijft op 1 HP").
 */
export function ufApply(c, need, x, rollTxt) {
  const out = fx();
  if (!need) return Object.assign(out, { txt: "" });
  if (need.skip) {
    out.why.push({ t: M("rules.uf.none", { why: need.skip }), id: c.id });
    return Object.assign(out, { txt: say("rules.uf.none", { why: need.skip }) });
  }
  const ok = x.tot >= need.dc;
  if (ok) c.hp = 1;
  const m = M("rules.uf.roll", { dc: String(need.dc), roll: rollTxt, res: M(ok ? "rules.uf.stays" : "rules.aoeRes.down") });
  out.why.push({ t: m, id: c.id });
  return Object.assign(out, { txt: say(m.k, m.p), ok });
}

/* ---------- save-riders na een treffer ---------- */
const CONDS = ["prone", "poisoned", "paralyzed", "frightened", "charmed", "stunned", "blinded", "restrained", "incapacitated", "deafened", "petrified", "unconscious", "grappled"];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const DC_RE = /DC\s*(\d+)\s+(strength|dexterity|constitution|intelligence|wisdom|charisma)\s+saving throw/i;
// "taking 9 (2d8) poison damage on a failed save, or half as much damage on a successful one"; "or take 2 (1d4) poison damage"
const DMG_RE = /(?:taking|take)\s+(?:\d+\s*)?\((\d+d\d+(?:\s*[+−-]\s*\d+)?)\)\s+([a-z]+)\s+damage/i;

/** Herinnering bij een rider die de app niet zelf toepast */
function riderNote(s) {
  const n = (k) => tt(`rules.rd.n.${k}`); // tekst in de taal van nu (rider staat hooguit twee beurten open)
  if (/hit point maximum (?:is )?reduced by an amount equal to the damage/i.test(s)) return n("maxLr");
  if (/hit point maximum reduced by an amount equal to the damage/i.test(s)) return n("max");
  if (/swallowed/i.test(s)) return n("swallow");
  if (/disease|cursed|lycanthropy|mummy rot/i.test(s)) return n("curse");
  if (/infernal wound|lose \d+ \(\d+d\d+\) hit points at the start/i.test(s)) return n("wound");
  if (/\bdie\b|drops to 0 hit points/i.test(s)) return n("die");
  if (/pulled|pushed/i.test(s)) return n("moved");
  if (/unconscious/i.test(s)) return n("uncon");
  return n("see");
}

/**
 * Rider uit de tekst van een aanval: alleen wat na "Hit:" staat en een DC met saving throw heeft.
 * { ab, dc, conds: ["Prone"], dur: "r10"|"", rep, dmg: { e, type, half } | null, note, only } of null.
 * conds/dmg leeg = alleen herinnering (note). only = beperking op het doel ("Medium or smaller").
 */
export function parseRider(text) {
  const t = String(text || "");
  const h = t.search(/\bHit:/i);
  if (h < 0) return null;
  const after = t.slice(h);
  const dm = after.match(DC_RE);
  if (!dm) return null;
  const from = after.slice(Math.max(0, dm.index - 160), dm.index); // de zin ervoor ("If the target is a creature, it must …")
  const rest = after.slice(dm.index);
  const sent = rest.split(/(?<=\.)\s+(?=[A-Z])/)[0]; // de zin met de DC
  const conds = [];
  if (/knocked prone/i.test(sent)) conds.push("Prone");
  for (const m of sent.matchAll(/\b(?:be|become|is|and)\s+(?:magically\s+)?(poisoned|paralyzed|frightened|charmed|stunned|blinded|restrained|incapacitated|deafened|petrified)\b/gi))
    if (!conds.includes(cap(m[1].toLowerCase()))) conds.push(cap(m[1].toLowerCase()));
  if (/against being magically petrified/i.test(sent) && /restrained/i.test(rest)) conds.push("Restrained"); // Cockatrice: eerst restrained
  const dmx = sent.match(DMG_RE);
  const dmg = dmx ? { e: dmx[1].replace(/−/g, "-").replace(/\s/g, ""), type: dmx[2].toLowerCase(), half: /half as much/i.test(sent) } : null;
  // ziekte, vloek, max HP: geen conditie die de app kent (Death Dog "become poisoned until the disease is cured" wel)
  const noteOnly = /disease|cursed|lycanthropy|hit point maximum|swallowed|infernal wound/i.test(sent) && !dmg;
  const only = (from.match(/If the target is (?!a creature,)(?:a |an )?([^,]+?),\s*it must[^.]*$/i) || [])[1] || "";
  const dur = /for 1 minute/i.test(sent) ? "r10" : "";
  const rep = /repeat the saving throw at the end of each of its turns/i.test(rest.slice(0, 400));
  const out = { ab: ABIL[dm[2].toLowerCase()], dc: +dm[1], conds: noteOnly ? [] : conds, dur, rep: rep && !noteOnly && conds.length > 0, dmg: noteOnly ? null : dmg, note: "", only };
  if (!out.conds.length && !out.dmg) out.note = riderNote(rest.slice(0, 400));
  else if (/fails by 5 or more|saving throw result is 5 or lower/i.test(rest.slice(0, 300))) out.note = tt("rules.rd.n.bigFail");
  else if (/unconscious/i.test(sent)) out.note = tt("rules.rd.n.alsoUncon");
  else if (/damage at the start of each of its turns/i.test(rest.slice(0, 300))) out.note = tt("rules.rd.n.alsoDmg");
  return out;
}

/** Korte omschrijving: "of Prone", "of Paralyzed 1 min", "9 poison (2d8), half bij geslaagd", "max HP daalt met de schade" */
export function riderWhat(r) {
  if (!r) return "";
  const p = [];
  if (r.dmg) p.push(r.dmg.half ? tt("rules.rd.halfOk", { e: r.dmg.e, type: r.dmg.type }) : `${r.dmg.e} ${r.dmg.type}`);
  if (r.conds.length) p.push(tt(r.dur === "r10" ? "rules.rd.or1m" : "rules.rd.or", { what: r.conds.join(" + ") }));
  if (r.note) p.push(r.note);
  return p.join(" · ");
}

/** Doel is immuun voor alle condities van de rider (monster: Condition Immunities uit het statblock) */
export function riderImmune(r, m) {
  if (!r || !r.conds.length || r.dmg) return false;
  const ci = String(((m && m.x || []).find((x) => x[0] === "Condition Immunities") || [])[1] || "").toLowerCase();
  return r.conds.every((k) => ci.includes(k.toLowerCase()));
}

/**
 * Rider toepassen na de save. ok = geslaagd. rd = { ...parseRider, n (naam aanval), by (id aanvaller), roll: {total, txt}
 * (vooraf gerolde rider-schade), mode (resistance van het doel tegen dat type) }. active = wie aan de beurt is (duur).
 * Gefaald: condities (met duur en herhaalsave) en volle schade; geslaagd: halve schade of niets. Geeft Fx (+ saves).
 */
export function applyRider(c, rd, ok, active) {
  const out = fx();
  const lbl = `${rd.n || "Rider"} ${rd.ab} ${rd.dc}`;
  if (rd.dmg && rd.roll) {
    const raw = ok ? (rd.dmg.half ? Math.floor(rd.roll.total / 2) : 0) : rd.roll.total;
    out.why.push({ t: M(!ok ? "rules.rd.dmg" : rd.dmg.half ? "rules.rd.dmgHalf" : "rules.rd.dmgNone", { lbl, res: M(ok ? "rules.rd.ok" : "rules.rd.fail"), roll: rd.roll.txt, n: String(raw) }), id: c.id });
    if (raw > 0) merge(out, applyDamage(c, raw, rd.mode ?? 1, true));
  } else out.why.push({ t: M(!ok && rd.note ? "rules.rd.resNote" : "rules.rd.res", { lbl, res: M(ok ? "rules.rd.ok" : "rules.rd.fail"), note: rd.note || "" }), id: c.id });
  if (!ok && rd.conds.length) {
    c.cd = c.cd || {};
    rd.conds.forEach((k, i) => {
      if (!c.cond.includes(k)) c.cond = [...c.cond, k];
      const save = rd.rep && i === 0 ? { ab: rd.ab, dc: rd.dc } : {};
      const d = makeDur(c, { dur: rd.dur, ...save }, active);
      if (d) c.cd[k] = d; else delete c.cd[k];
    });
    const na = rd.conds.find((k) => NO_ACT.includes(k));
    if (na) merge(out, dropConc(c, M("rules.condBy", { cond: na, name: rd.n || "rider" })));
    out.msgs.push(say(rd.dur === "r10" ? "rules.rd.got1m" : "rules.rd.got", { name: c.name, what: rd.conds.join(" + ") }));
  }
  return out;
}

const AUTO_FAIL = ["Paralyzed", "Stunned", "Unconscious", "Petrified"]; // PHB 2014: falen STR- en DEX-saves vanzelf

/**
 * Rider van een aanval tegen dit doel na de treffer, of null (geen rider, doel neer of dood).
 * sim = het doel ná de schade (kopie); choice = keuze van de DM ("fail"|"ok"|"na"|null).
 * { rd, act (conditie/schade toe te passen), immune, auto ("fail": faalt STR/DEX vanzelf), choice }.
 */
export function riderFor(rd, c, m, sim, choice = null) {
  if (!rd || !c || !sim) return null;
  if (sim.ds && sim.ds.dead) return null; // gestorven door de treffer
  if (c.kind === "monster" && c.max && sim.hp <= 0) return null; // monster neer: geen rider meer
  const down = c.kind === "pc" && c.max > 0 && sim.hp <= 0;
  if (down && !rd.dmg && rd.conds.length && rd.conds.every((k) => k === "Prone")) return null; // bewusteloos = al prone
  if (riderImmune(rd, m)) return { rd, act: false, immune: true, auto: null, choice: null };
  const act = !!(rd.conds.length || rd.dmg);
  const out = (rd.ab === "STR" || rd.ab === "DEX") && (down || (c.cond || []).some((k) => AUTO_FAIL.includes(k)));
  const auto = act && out ? "fail" : null;
  return { rd, act, immune: false, auto, choice: auto || choice || null };
}

/** Uitkomst als korte tekst: "Prone", "−9 poison", "half: −4 HP", "geen gevolg" (melding na toepassen) */
export function riderOutcome(rd, ok, lost) {
  const p = [];
  if (!ok && rd.conds.length) p.push(rd.conds.join(" + "));
  if (lost > 0) { const x = `−${lost} ${rd.dmg ? rd.dmg.type : "HP"}`; p.push(ok && rd.dmg && rd.dmg.half ? tt("rules.rd.half", { what: x }) : x); }
  if (!ok && !rd.conds.length && !rd.dmg && rd.note) p.push(rd.note);
  return p.join(", ") || tt("rules.rd.nothing");
}

/* ---------- Parry ---------- */
/** Parry-bonus uit de reactions van het statblock ("adds 2 to its AC against one melee attack"), anders 0 */
export function parryOf(m) {
  const re = m && Array.isArray(m.re) ? m.re.filter(Array.isArray) : [];
  for (const [k, v] of re) {
    if (!/^parry\b/i.test(String(k))) continue;
    const x = String(v).match(/adds (\d+) to (?:its|his|her|their) AC/i);
    if (x) return +x[1];
  }
  return 0;
}

/** Kan dit monster nu parryen? Reaction vrij, niet verrast in ronde 1 (zoals isSurprised), niet incapacitated, levend */
export const canParry = (c, round = 0) => !!c && c.kind === "monster" && c.hp > 0 && !c.reaction && !(c.sur === true && round === 1)
  && !(c.cond || []).some((k) => NO_ACT.includes(k));

/** Parry gebruikt: reaction weg, logoorzaak. Geeft Fx */
export function useParry(c, n) {
  const out = fx();
  c.reaction = true;
  out.why.push({ t: M("rules.parry", { n: String(n) }), id: c.id });
  return out;
}
