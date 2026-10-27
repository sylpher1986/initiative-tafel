// Gevechtsregels (5e 2014). Elke functie past de deelnemer aan en geeft een Fx terug:
//   msgs: korte meldingen voor de gebruiker (tekst in de actieve taal, meteen getoond: say())
//   why:  oorzaken voor het logboek, [{t, id}]; t is een descriptor M(sleutel, waarden) (WP27), zodat het logboek
//         in een andere taal opnieuw te lezen is. Oude aanroepers mogen nog tekst geven.
import { pactRest } from "./slots.js";
import { M, J } from "../i18n/msg.js";
import { tr } from "../i18n/boot.js";
import { d } from "./dice.js";
import { EXH_NAME, isExh, exhLevel } from "./conditions.js";

export const fx = () => ({ msgs: [], why: [] });
/** Melding: descriptor meteen als tekst in de actieve taal (meldingen worden direct getoond, niet bewaard) */
export const say = (k, p) => tr(M(k, p));
const s = (n) => String(n); // getal als tekst: zoals vroeger, zonder duizendtalscheiding
//   saves: (optioneel) nieuwe concentration saves, [{ id, kind: "conc", ab, dc }]; de UI zet ze in S.saves
export const merge = (a, b) => { a.msgs.push(...b.msgs); a.why.push(...b.why); if (b.saves) (a.saves = a.saves || []).push(...b.saves); return a; };

export const newDs = () => ({ s: 0, f: 0, stable: false, dead: false });

/** Speler op 0 HP (levend of dood): Unconscious hoort bij de 0 HP, niet bij een spell; die mag hem dus niet weghalen */
export const downPc = (c) => c.kind === "pc" && c.max > 0 && c.hp <= 0;

export function setUncon(c, on) {
  c.cond = c.cond.filter((x) => x !== "Unconscious");
  if (on) c.cond.push("Unconscious");
}

/** Stabiel en toch schade (PHB 2014): opnieuw death saves, tellers vanaf nul */
function restartDs(c) { if (c.ds.stable) { c.ds.s = 0; c.ds.f = 0; } c.ds.stable = false; }

/** Drie successen = stabiel, drie failures = dood */
export function checkDs(c) {
  const out = fx(), ds = c.ds;
  if (ds.f >= 3) { ds.dead = true; ds.stable = false; out.msgs.push(say("rules.dsDead", { name: c.name })); }
  else if (ds.s >= 3) { ds.stable = true; ds.dead = false; out.msgs.push(say("rules.dsStable", { name: c.name })); }
  else { ds.dead = false; ds.stable = false; }
  return out;
}

export function startConc(c, name) {
  const out = fx();
  const prev = c.cond.includes("Concentrating") ? c.concSpell : null;
  if (!c.cond.includes("Concentrating")) c.cond.push("Concentrating");
  c.concSpell = name;
  out.msgs.push(prev && prev !== name ? say("rules.concSwap", { name: c.name, old: prev, spell: name }) : say("rules.concStart", { name: c.name, spell: name }));
  return out;
}

export function dropConc(c, why) {
  const out = fx();
  if (c.cond.includes("Concentrating")) {
    out.why.push({ t: why || M("rules.manual"), id: c.id });
    c.cond = c.cond.filter((x) => x !== "Concentrating");
    if (c.cd) delete c.cd.Concentrating;
    const k = c.concSpell ? (why ? "rules.concDropOnWhy" : "rules.concDropOn") : why ? "rules.concDropWhy" : "rules.concDrop";
    out.msgs.push(say(k, { name: c.name, spell: c.concSpell || "", why: why || "" }));
  }
  c.concSpell = null;
  return out;
}

/** HP van een speler aanpassen, met 0 HP, death saves en instant death */
export function applyPcHp(c, delta) {
  const out = fx();
  if (delta > 0) {
    if (c.ds && c.ds.dead) { out.msgs.push(say("rules.healDead", { name: c.name })); return out; }
    const was0 = c.hp <= 0;
    c.hp = Math.min(c.max, Math.max(0, c.hp) + delta);
    if (was0) { c.ds = null; setUncon(c, false); out.msgs.push(say("rules.wakes", { name: c.name, hp: s(c.hp) })); }
    return out;
  }
  const v = -delta;
  if (c.hp > 0) {
    const overflow = v - c.hp;
    c.hp = Math.max(0, c.hp - v);
    if (c.hp === 0) {
      c.ds = newDs(); setUncon(c, true);
      merge(out, dropConc(c, M("rules.hp0")));
      if (overflow >= c.max) {
        out.why.push({ t: M("rules.instantWhy", { n: s(overflow), max: s(c.max) }), id: c.id });
        c.ds.dead = true; c.ds.f = 3;
        out.msgs.push(say("rules.instant", { name: c.name, n: s(overflow), max: s(c.max) }));
      } else out.msgs.push(say("rules.drops", { name: c.name }));
    }
    return out;
  }
  c.ds = c.ds || newDs();
  if (c.ds.dead) return out;
  if (v >= c.max) { c.ds.f = 3; c.ds.dead = true; out.msgs.push(say("rules.dies0", { name: c.name, n: s(v) })); return out; }
  out.why.push({ t: M("rules.dmg0Why"), id: c.id });
  restartDs(c); c.ds.f = Math.min(3, c.ds.f + 1);
  out.msgs.push(say("rules.dmg0", { name: c.name }));
  return merge(out, checkDs(c));
}

export const rollDs = (c, rng = Math.random) => dsResult(c, d(20, rng), true);

/**
 * Death save met een worp (RE15: ook een getypte worp van de speler; byApp = de app rolde). 20 = 1 HP, 1 = twee
 * failures, 10+ = success. Een worp buiten 1–20, of niemand die een save nodig heeft, doet niets.
 */
export function dsResult(c, r, byApp = false) {
  const out = fx();
  if (!Number.isInteger(r) || r < 1 || r > 20 || c.hp > 0 || c.ds?.dead || c.ds?.stable) return out;
  c.ds = c.ds || newDs();
  out.why.push({ t: J([`death save ${byApp ? "d20 " : ""}[${r}]`, !byApp && M("rules.dsByPc"), r === 1 && M("rules.dsDouble"), r === 20 && M("rules.dsNat20")].filter(Boolean), ", "), id: c.id });
  if (r === 20) { c.hp = 1; c.ds = null; setUncon(c, false); out.msgs.push(say("rules.ds20", { name: c.name })); return out; }
  if (r === 1) { c.ds.f = Math.min(3, c.ds.f + 2); out.msgs.push(say("rules.ds1", { name: c.name })); }
  else if (r >= 10) { c.ds.s++; out.msgs.push(say("rules.dsOk", { name: c.name, r: s(r) })); }
  else { c.ds.f++; out.msgs.push(say("rules.dsFail", { name: c.name, r: s(r) })); }
  return merge(out, checkDs(c));
}

export function critAtZero(c) {
  const out = fx();
  out.why.push({ t: M("rules.crit0Why"), id: c.id });
  c.ds = c.ds || newDs(); restartDs(c); c.ds.f = Math.min(3, c.ds.f + 2);
  out.msgs.push(say("rules.crit0", { name: c.name }));
  return merge(out, checkDs(c));
}

/** Temp HP stapelt niet: de hoogste waarde blijft */
export function giveTemp(c, raw) {
  const out = fx(), old = c.temp || 0;
  c.temp = Math.max(old, raw);
  out.msgs.push(old > raw ? say("rules.tempKeep", { name: c.name, n: s(old) }) : say("rules.tempGet", { name: c.name, n: s(c.temp) }));
  return out;
}

export function heal(c, raw) {
  if (c.kind === "pc") return applyPcHp(c, raw);
  c.hp = Math.min(c.max, c.hp + raw);
  return fx();
}

/**
 * Condities die bij schade vervallen (cd[k].brk: Hypnotic Pattern, Sleep): per doel weg zodra het schade krijgt.
 * Ook schade die temp HP opvangt telt (het doel "neemt schade").
 */
export function wakeByDamage(c) {
  const out = fx(), all = Object.keys(c.cd || {}).filter((k) => c.cd[k] && c.cd[k].brk && c.cond.includes(k));
  if (!all.length) return out;
  const sp = [...new Set(all.map((k) => c.cd[k].spell).filter(Boolean))].join(", "); // spellnamen: inhoud
  for (const k of all) delete c.cd[k]; // koppeling weg; Unconscious van een speler op 0 HP blijft (hoort bij de 0 HP)
  const K = all.filter((k) => !(k === "Unconscious" && downPc(c)));
  c.cond = c.cond.filter((x) => !K.includes(x));
  if (!K.length) return out;
  out.why.push({ t: M(sp ? "rules.wakeWhySp" : "rules.wakeWhy", { what: K.join(" + "), sp }), id: c.id });
  out.msgs.push(say(sp ? "rules.wakeSp" : "rules.wake", { name: c.name, what: K.join(" + "), sp }));
  return out;
}

const MODE_TXT = { 0.5: ["×½", "rules.mResist"], 2: ["×2", "rules.mVuln"], 0: ["×0", "rules.mImm"] }; // [teken, sleutel]

/**
 * Schade met resistance (×½, naar beneden afgerond), vulnerability (×2) of immunity (×0), eerst van temp HP af.
 * mode: 1, 0.5, 2 of 0. quiet: geen rekenmelding en geen rekenregel in het logboek (de AoE geeft die zelf).
 */
export function applyDamage(c, raw, mode = 1, quiet = false) {
  const out = fx();
  const v = Math.floor(raw * mode);
  if (v > 0) merge(out, wakeByDamage(c)); // vóór de HP: wie op 0 valt is daarna gewoon bewusteloos
  if (v > 0) for (const e of c.eff || []) if (e.rg && e.ed !== "2024") e.hit = 1; // RE16: schade sinds de vorige beurt = rage loopt door (2024: telt niet, WP50)
  const absorb = Math.min(c.temp || 0, v);
  if (absorb) c.temp -= absorb;
  const rest = v - absorb;
  const mt = MODE_TXT[mode];
  if (!quiet || absorb) out.why.push({ t: J([!quiet && (mt ? M("rules.dmgMode", { n: s(raw), x: mt[0], mode: M(mt[1]), v: s(v) }) : M("rules.dmg", { n: s(raw) })), absorb && M("rules.absorbWhy", { n: s(absorb) })].filter(Boolean), ", "), id: c.id });
  const parts = [];
  if (mt && !quiet) parts.push(`${raw} ${mt[0]} = ${v}`);
  if (absorb && !quiet) parts.push(say("rules.absorb", { n: s(absorb), rest: s(rest) }));
  if (parts.length) out.msgs.push(`${c.name}: ${parts.join(", ")}`);
  if (rest > 0) {
    if (c.kind === "pc") merge(out, applyPcHp(c, -rest));
    else {
      c.hp = Math.max(0, c.hp - rest);
      if (c.hp === 0) { out.msgs.push(say("rules.down", { name: c.name })); merge(out, dropConc(c, M("rules.hp0"))); }
    }
  }
  if (v > 0 && c.hp > 0 && c.cond.includes("Concentrating")) out.saves = [{ id: c.id, kind: "conc", n: c.concSpell || "", ab: "CON", dc: Math.max(10, Math.floor(v / 2)) }];
  return out;
}

/** Max HP instellen (bewerken, bijgewerkte sheet): opgelopen schade blijft; wie op 0 staat blijft daar, levend minstens 1 */
export function setMax(c, nMax) {
  nMax = Math.max(1, Math.min(9999, Math.round(+nMax) || 1));
  if (!c.max) c.hp = nMax;
  else if (c.hp > 0) c.hp = Math.max(1, nMax - Math.max(0, c.max - c.hp));
  c.max = nMax;
  reExh(c); // Exhaustion 4+: halvering op de nieuwe max
}

/**
 * Huidige HP direct instellen (Voorbereiden: genezen of schade tussen gevechten), 0 t/m max.
 * Geen temp HP, geen concentration save en geen instant death: dit is bijwerken, geen treffer.
 * Speler van/naar 0 HP via applyPcHp (bewusteloos, death saves, concentratie weg; dood blijft dood).
 */
export function setHp(c, v) {
  const out = fx();
  if (!c.max || !Number.isFinite(+v)) return out; // ongeldige invoer verandert niets (nooit stil naar 0)
  v = Math.max(0, Math.min(c.max, Math.round(+v)));
  if (v === c.hp) return out;
  if (c.kind === "pc") {
    if (v < c.hp && v > 0) { c.hp = v; return out; } // geen 0: geen gevolgen
    return merge(out, applyPcHp(c, v - Math.max(0, c.hp)));
  }
  c.hp = v;
  if (v === 0) { out.msgs.push(say("rules.down", { name: c.name })); merge(out, dropConc(c, M("rules.hp0"))); }
  return out;
}

/** Max HP-effect terugdraaien (Aid voorbij: max −5, huidige HP alleen omlaag als die erboven zit) */
export function revertMax(c, hpd) {
  c.max = Math.max(1, (c.max || 0) - hpd);
  c.hp = Math.min(c.hp, c.max);
}

/**
 * Exhaustion-effect op niveau x (1–6) toevoegen (RE11). Het oude Exhaustion-effect moet al weg zijn.
 * Niveau 4+: max HP gehalveerd (naar beneden afgerond, minstens 1), als max-HP-verschil `hpd` zoals Aid, zodat het
 * vanzelf terugdraait. ed "2024" (WP50) wordt op het effect vastgelegd: geen halvering, wel −2 × niveau op d20-tests
 * (exhMod). Geeft het effect; de dood bij niveau 6 regelt de aanroeper.
 */
export function exhEffect(c, x, ed = "2014") {
  const e = { id: Math.random().toString(36).slice(2, 9), n: EXH_NAME, x, st: "", op: "+", v: 0, txt: "", end: "", d: null, lr: false, by: null, spell: null, hpd: 0 };
  c.eff = [...(c.eff || []).filter((y) => !isExh(y)), e];
  reExh(c, ed);
  return e;
}

/**
 * Exhaustion 4+ (2014): max HP gehalveerd (PHB: naar beneden afgerond) op de huidige max, ook na Aid, bewerken of een
 * bijgewerkte sheet. Eerst de oude halvering terug, dan opnieuw rekenen; aanroepen na elke wijziging van max HP.
 * Idempotent (WP50, B1): twee keer achter elkaar = zelfde uitkomst. ed = de regels om mee te rekenen; zonder ed de
 * regels die op het effect staan. Met ed worden die regels op het effect gezet (2024 = geen halvering).
 * Zonder bekende max HP (0) alleen het niveau; de halvering volgt zodra max HP bekend is.
 */
export function reExh(c, ed) {
  const e = (c.eff || []).find(isExh);
  if (!e) return;
  if (ed !== undefined) { if (ed === "2024") e.ed = "2024"; else delete e.ed; }
  if (e.hpd) c.max = Math.max(1, (c.max || 0) - e.hpd);
  e.st = ""; e.v = 0; e.hpd = 0;
  if ((e.x | 0) >= 4 && c.max > 0 && e.ed !== "2024") {
    const nm = Math.max(1, Math.floor(c.max / 2));
    e.st = "max"; e.v = e.hpd = nm - c.max;
    c.max = nm;
  }
  if (c.max > 0) c.hp = Math.min(c.hp, c.max);
}

/**
 * WP50 (B1, voor de regelwissel van WP54): Exhaustion van iedereen aan tafel naar regels ed omrekenen.
 * Logregel per deelnemer van wie max HP verandert ("Exhaustion 4 · 2024: max HP 20 → 40").
 */
export function reExhAll(list, ed) {
  const out = fx();
  for (const c of list) {
    const x = exhLevel(c);
    if (!x) continue;
    const was = c.max;
    reExh(c, ed);
    if (c.max !== was) out.why.push({ t: M("rules.exhEd", { n: x, ed: ed === "2024" ? "2024" : "2014", from: String(was), to: String(c.max) }), id: c.id });
  }
  return out;
}

/** Short of long rest voor een speler (party-lid of deelnemer aan tafel) */
export function restMember(m, long, ed) {
  if (long) {
    const ex = exhLevel(m); // Exhaustion: één niveau minder (PHB/SRD 5.2.1: long rest)
    const xe = ed !== undefined ? ed : (m.eff || []).some((e) => isExh(e) && e.ed === "2024") ? "2024" : "2014"; // WP50
    for (const e of m.eff || []) if (e.hpd) revertMax(m, e.hpd); // long rest: alle tijdelijke effecten voorbij
    m.eff = [];
    if (ex > 1) exhEffect(m, ex - 1, xe);
    m.hp = m.max; m.temp = 0; m.ds = null;
    if (m.cond) m.cond = m.cond.filter((x) => x !== "Unconscious");
    if (m.casting) {
      m.casting.slots.forEach((x) => (x.left = x.max));
      (m.casting.daily || []).forEach((g) => g.items.forEach((x) => (x.left = x.max)));
    }
  }
  pactRest(m); // RE3: Pact Magic terug na elke rust
  (m.res || []).forEach((r) => { if (long || r.rest === "Short Rest") r.left = r.max; });
}
