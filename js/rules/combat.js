// Gevechtsregels (5e 2014). Elke functie past de deelnemer aan en geeft een Fx terug:
//   msgs: korte meldingen voor de gebruiker (platte tekst)
//   why:  oorzaken voor het logboek, [{t, id}]
import { d } from "./dice.js";

export const fx = () => ({ msgs: [], why: [] });
export const merge = (a, b) => { a.msgs.push(...b.msgs); a.why.push(...b.why); return a; };

export const newDs = () => ({ s: 0, f: 0, stable: false, dead: false });

export function setUncon(c, on) {
  c.cond = c.cond.filter((x) => x !== "Unconscious");
  if (on) c.cond.push("Unconscious");
}

/** Drie successen = stabiel, drie failures = dood */
export function checkDs(c) {
  const out = fx(), ds = c.ds;
  if (ds.f >= 3) { ds.dead = true; ds.stable = false; out.msgs.push(`${c.name} is gestorven.`); }
  else if (ds.s >= 3) { ds.stable = true; ds.dead = false; out.msgs.push(`${c.name} is stabiel (bewusteloos, 0 HP).`); }
  else { ds.dead = false; ds.stable = false; }
  return out;
}

export function startConc(c, name) {
  const out = fx();
  const prev = c.cond.includes("Concentrating") ? c.concSpell : null;
  if (!c.cond.includes("Concentrating")) c.cond.push("Concentrating");
  c.concSpell = name;
  out.msgs.push(prev && prev !== name ? `${c.name}: concentratie op ${prev} verbroken, nu op ${name}.` : `${c.name} concentreert op ${name}.`);
  return out;
}

export function dropConc(c, why) {
  const out = fx();
  if (c.cond.includes("Concentrating")) {
    out.why.push({ t: why || "handmatig", id: c.id });
    c.cond = c.cond.filter((x) => x !== "Concentrating");
    if (c.cd) delete c.cd.Concentrating;
    out.msgs.push(`${c.name}: concentratie${c.concSpell ? ` op ${c.concSpell}` : ""} verbroken${why ? ` (${why})` : ""}.`);
  }
  c.concSpell = null;
  return out;
}

/** HP van een speler aanpassen, met 0 HP, death saves en instant death */
export function applyPcHp(c, delta) {
  const out = fx();
  if (delta > 0) {
    if (c.ds && c.ds.dead) { out.msgs.push(`${c.name} is dood; genezen werkt niet zonder revivify of iets vergelijkbaars.`); return out; }
    const was0 = c.hp <= 0;
    c.hp = Math.min(c.max, Math.max(0, c.hp) + delta);
    if (was0) { c.ds = null; setUncon(c, false); out.msgs.push(`${c.name} komt weer bij met ${c.hp} HP.`); }
    return out;
  }
  const v = -delta;
  if (c.hp > 0) {
    const overflow = v - c.hp;
    c.hp = Math.max(0, c.hp - v);
    if (c.hp === 0) {
      c.ds = newDs(); setUncon(c, true);
      merge(out, dropConc(c, "0 HP"));
      if (overflow >= c.max) {
        out.why.push({ t: `instant death: restschade ${overflow} ≥ max HP ${c.max}`, id: c.id });
        c.ds.dead = true; c.ds.f = 3;
        out.msgs.push(`${c.name} sterft direct: restschade ${overflow} ≥ max HP ${c.max}.`);
      } else out.msgs.push(`${c.name} valt op 0 HP en is bewusteloos. Death saves vanaf de volgende beurt.`);
    }
    return out;
  }
  c.ds = c.ds || newDs();
  if (c.ds.dead) return out;
  if (v >= c.max) { c.ds.f = 3; c.ds.dead = true; out.msgs.push(`${c.name} sterft: ${v} schade ≥ max HP op 0 HP.`); return out; }
  out.why.push({ t: "schade op 0 HP", id: c.id });
  c.ds.stable = false; c.ds.f = Math.min(3, c.ds.f + 1);
  out.msgs.push(`${c.name} krijgt schade op 0 HP: één failure. Was het een kritieke treffer, tik dan op "Kritiek".`);
  return merge(out, checkDs(c));
}

export function rollDs(c, rng = Math.random) {
  const out = fx();
  c.ds = c.ds || newDs();
  const r = d(20, rng);
  out.why.push({ t: `death save d20 [${r}]${r === 1 ? ", telt dubbel" : r === 20 ? ", natuurlijke 20" : ""}`, id: c.id });
  if (r === 20) { c.hp = 1; c.ds = null; setUncon(c, false); out.msgs.push(`Death save ${c.name}: 20! Staat op met 1 HP.`); return out; }
  if (r === 1) { c.ds.f = Math.min(3, c.ds.f + 2); out.msgs.push(`Death save ${c.name}: 1, twee failures.`); }
  else if (r >= 10) { c.ds.s++; out.msgs.push(`Death save ${c.name}: ${r}, success.`); }
  else { c.ds.f++; out.msgs.push(`Death save ${c.name}: ${r}, failure.`); }
  return merge(out, checkDs(c));
}

export function critAtZero(c) {
  const out = fx();
  out.why.push({ t: "kritieke treffer op 0 HP", id: c.id });
  c.ds = c.ds || newDs(); c.ds.stable = false; c.ds.f = Math.min(3, c.ds.f + 2);
  out.msgs.push(`${c.name}: kritieke treffer op 0 HP, twee failures.`);
  return merge(out, checkDs(c));
}

/** Temp HP stapelt niet: de hoogste waarde blijft */
export function giveTemp(c, raw) {
  const out = fx(), old = c.temp || 0;
  c.temp = Math.max(old, raw);
  out.msgs.push(old > raw ? `${c.name} houdt ${old} temp HP (temp HP stapelt niet).` : `${c.name} krijgt ${c.temp} temp HP.`);
  return out;
}

export function heal(c, raw) {
  if (c.kind === "pc") return applyPcHp(c, raw);
  c.hp = Math.min(c.max, c.hp + raw);
  return fx();
}

const MODE_TXT = { 0.5: ["×½", "resistance"], 2: ["×2", "vulnerability"], 0: ["×0", "immuun"] };

/**
 * Schade met resistance (×½, naar beneden afgerond), vulnerability (×2) of immunity (×0), eerst van temp HP af.
 * mode: 1, 0.5, 2 of 0. quiet: geen rekenmelding en geen rekenregel in het logboek (de AoE geeft die zelf).
 */
export function applyDamage(c, raw, mode = 1, quiet = false) {
  const out = fx();
  const v = Math.floor(raw * mode);
  const absorb = Math.min(c.temp || 0, v);
  if (absorb) c.temp -= absorb;
  const rest = v - absorb;
  const mt = MODE_TXT[mode];
  if (!quiet || absorb) out.why.push({ t: `${quiet ? "" : `${raw} schade${mt ? ` ${mt[0]} (${mt[1]}) = ${v}` : ""}`}${absorb ? `${quiet ? "" : ", "}${absorb} opgevangen door temp HP` : ""}`, id: c.id });
  const parts = [];
  if (mt && !quiet) parts.push(`${raw} ${mt[0]} = ${v}`);
  if (absorb && !quiet) parts.push(`${absorb} door temp HP, ${rest} op HP`);
  if (parts.length) out.msgs.push(`${c.name}: ${parts.join(", ")}`);
  if (rest > 0) {
    if (c.kind === "pc") merge(out, applyPcHp(c, -rest));
    else {
      c.hp = Math.max(0, c.hp - rest);
      if (c.hp === 0) { out.msgs.push(`${c.name} is neer.`); merge(out, dropConc(c, "0 HP")); }
    }
  }
  if (v > 0 && c.hp > 0 && c.cond.includes("Concentrating")) out.msgs.push(`${c.name}: concentration save DC ${Math.max(10, Math.floor(v / 2))}`);
  return out;
}

/** Max HP instellen (bewerken, bijgewerkte sheet): opgelopen schade blijft; wie op 0 staat blijft daar, levend minstens 1 */
export function setMax(c, nMax) {
  nMax = Math.max(1, Math.min(9999, Math.round(+nMax) || 1));
  if (!c.max) c.hp = nMax;
  else if (c.hp > 0) c.hp = Math.max(1, nMax - Math.max(0, c.max - c.hp));
  c.max = nMax;
}

/** Max HP-effect terugdraaien (Aid voorbij: max −5, huidige HP alleen omlaag als die erboven zit) */
export function revertMax(c, hpd) {
  c.max = Math.max(1, (c.max || 0) - hpd);
  c.hp = Math.min(c.hp, c.max);
}

/** Short of long rest voor een speler (party-lid of deelnemer aan tafel) */
export function restMember(m, long) {
  if (long) {
    for (const e of m.eff || []) if (e.hpd) revertMax(m, e.hpd); // long rest: alle tijdelijke effecten voorbij
    m.eff = [];
    m.hp = m.max; m.temp = 0; m.ds = null;
    if (m.cond) m.cond = m.cond.filter((x) => x !== "Unconscious");
    if (m.casting) {
      m.casting.slots.forEach((x) => (x.left = x.max));
      (m.casting.daily || []).forEach((g) => g.items.forEach((x) => (x.left = x.max)));
    }
  }
  (m.res || []).forEach((r) => { if (long || r.rest === "Short Rest") r.left = r.max; });
}
