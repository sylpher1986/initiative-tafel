// Beurtvolgorde, conditie-duur en alles wat aan het begin/einde van een beurt gebeurt.
import { d, sgn, mod } from "./dice.js";
import { fx, say } from "./combat.js";
import { M, J } from "../i18n/msg.js";
import { t, tr } from "../i18n/boot.js";
import { tickEffects, endFightEffects, rageOf } from "./effects.js";
import { tickSaves, turnSaves, untickSaves } from "./saves.js";
import { exhMod } from "./conditions.js";

export const CONDS = ["Blinded", "Charmed", "Deafened", "Frightened", "Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious", "Concentrating"];

// [waarde, sleutel] (WP27): de UI vertaalt bij het tekenen; durShort = zonder het aantal rondes erachter
export const DURS = [
  ["inf", "rules.dur.inf"],
  ["tend", "rules.dur.tend"],
  ["tstart", "rules.dur.tstart"],
  ["sstart", "rules.dur.sstart"],
  ["r1", "rules.dur.r1"], ["r2", "rules.dur.r2"], ["r3", "rules.dur.r3"],
  ["r10", "rules.dur.r10"], ["r100", "rules.dur.r100"],
];
/** Korte duur in een zin ("1 minuut", "2 rondes"): kleine letters, zonder "(10 rondes)" */
export const durShort = (v) => { const e = DURS.find((x) => x[0] === v); return e ? t(e[1] + "S") : ""; };

/**
 * Volgorde van twee deelnemers: init hoog→laag; lair verliest gelijke stand; dan Dex; dan spelers vóór monsters; dan naam.
 * Zonder initiative (init null: speler toegevoegd vóór het gevecht, SP4) onderaan; die vult zijn worp in bij Start.
 */
export const cmpOrder = (a, b) =>
  (a.init == null) - (b.init == null)
  || (b.init ?? 0) - (a.init ?? 0)
  || ((a.kind === "lair") - (b.kind === "lair"))
  || b.dex - a.dex
  || ((b.kind === "pc") - (a.kind === "pc"))
  || a.name.localeCompare(b.name, undefined, { numeric: true }); // Bugbear 2 vóór Bugbear 10

export const sortOrder = (list) => [...list].sort(cmpOrder);

/**
 * RE9: beurtvolgorde voor beurtwissels (dezelfde objecten als L, anders gesorteerd).
 * - Wijzigt wie aan de beurt is zijn eigen initiative, dan blijft de beurt op de oude plek (S.ai = zijn initiative bij
 *   het begin van de beurt); anders zou Volgende iedereen tussen oud en nieuw overslaan.
 * - Wie nog niet aan de beurt was en door een nieuwe initiative vóór de beurt kwam (nextR = { r: ronde, after: id }),
 *   komt deze ronde direct na `after` (de beurt van toen), niet op zijn nieuwe plek. Volgende ronde gewoon op de nieuwe plek.
 */
export const pending = (c, S) => !!(c.nextR && c.nextR.r === S.round && S.round);
/** RE9: eigen init gewijzigd tijdens de eigen beurt: deze ronde blijft hij op atR.ai (zijn plek toen) */
const held = (c, S) => !!(c.atR && c.atR.r === S.round && S.round && Number.isFinite(c.atR.ai));
export function turnOrder(S, L) {
  const a = S.active ? L.find((c) => c.id === S.active) : null;
  const v = a && Number.isFinite(S.ai) && a.init !== S.ai && !pending(a, S) ? { ...a, init: S.ai } : null;
  // held(x): wijzigde zijn eigen init tijdens zijn beurt → deze ronde nog op de oude plek (‹ Vorige komt er ook langs)
  const key = (x) => (held(x, S) ? { ...x, init: x.atR.ai } : v && x === a ? v : x);
  const M = v || L.some((x) => held(x, S)) ? [...L].sort((x, y) => cmpOrder(key(x), key(y))) : L;
  const P = M.filter((c) => pending(c, S));
  if (!P.length) return M;
  const out = M.filter((c) => !pending(c, S)), ids = new Set(L.map((c) => c.id));
  let todo = P;
  while (todo.length) { // anker kan zelf ingeschoven zijn (ketting): invoegen zodra het anker staat
    const left = [];
    for (const p of todo) {
      const b = ids.has(p.nextR.after) && p.nextR.after !== p.id ? L.find((x) => x.id === p.nextR.after) : null;
      if (!b) { const k = out.findIndex((x) => cmpOrder(p, x) < 0); out.splice(k < 0 ? out.length : k, 0, p); } // anker weg: gewone plek
      else if (!pending(b, S)) { // op de plek van het anker toen (nextR.ai): wijzigt het anker later zijn init, dan schuift p niet mee
        const V = posOf(S, p);
        let k = 0;
        while (k < out.length && (pending(out[k], S) || cmpOrder(V, key(out[k])) >= 0)) k++;
        out.splice(k, 0, p);
      } else {
        const i = out.indexOf(b);
        if (i >= 0) { let j = i + 1; while (out[j] && pending(out[j], S) && out[j].nextR.after === p.nextR.after) j++; out.splice(j, 0, p); }
        else left.push(p);
      }
    }
    if (left.length === todo.length) { for (const p of left) out.push(p); break; } // kring (kan niet, maar nooit vastlopen)
    todo = left;
  }
  return out;
}

/**
 * Plek van c in de beurtvolgorde als sorteersleutel: wie aan de beurt is op S.ai; ingeschoven op de plek van zijn anker
 * toen het inschuiven gebeurde (nextR.ai, zonder: de plek van het anker nu; ketting: die van het anker).
 */
function posOf(S, c, n = 0) {
  if (pending(c, S) && n < 20) {
    const b = S.list.find((x) => x.id === c.nextR.after);
    if (b && b !== c) return !pending(b, S) && Number.isFinite(c.nextR.ai) ? { ...b, init: c.nextR.ai } : posOf(S, b, n + 1);
  }
  if (held(c, S)) return { ...c, init: c.atR.ai };
  return c.id === S.active && Number.isFinite(S.ai) ? { ...c, init: S.ai } : c;
}

/** Plek van de beurt: wie aan de beurt is (met zijn initiative bij het begin van de beurt), of het anker als hij er via nextR tussen kwam */
function cursorOf(S) {
  const a = S.list.find((c) => c.id === S.active);
  return a ? posOf(S, a) : null;
}

/**
 * RE9: wat een nieuwe initiative v voor c deze ronde betekent (puur, ook voor de live hint in ⋯).
 * own = c is aan de beurt (beurt loopt door, nieuwe plek vanaf volgende ronde);
 * skip = c was deze ronde al aan de beurt (of is het nu) en komt door v ná de beurt: deze ronde overgeslagen (skipR);
 * next = c moest nog en komt door v vóór de beurt: speelt deze ronde direct na wie nu aan de beurt is (nextR);
 * back = de eerdere skipR/nextR is niet meer nodig. Buiten een gevecht, of zonder verschil: alles false.
 */
export function initPlan(S, c, v) {
  const no = { own: false, skip: false, next: false, back: false };
  if (!S.round || !S.active || c.kind === "lair" || v === c.init) return no;
  const cur = cursorOf(S);
  if (!cur) return no;
  const after = (x) => cmpOrder(cur, x) < 0, nu = { ...c, init: v };
  const own = c.id === S.active;
  if (pending(c, S) && !c.nextR.done && !own) return { ...no, next: !after(nu), back: after(nu) };
  const acted = own || c.skipR === S.round || !after(posOf(S, c));
  if (own) return { ...no, own }; // houdt deze ronde zijn plek (atR), nieuwe plek vanaf volgende ronde
  if (acted) return { ...no, skip: after(nu), back: (c.skipR === S.round || held(c, S)) && !after(nu) };
  return { ...no, next: !after(nu) && !skipsTurn(c, S.round) };
}

/** Initiative tijdens het spel aanpassen (⋯, kaartveld). Muteert c (init, skipR, nextR). Geeft { msgs, why, plan }. */
export function setInit(S, c, v) {
  const out = Object.assign(fx(), { plan: initPlan(S, c, v) }), p = out.plan;
  if (v === c.init) return out;
  const cur = S.list.find((x) => x.id === S.active), at = cursorOf(S);
  c.init = v;
  if (p.own && !pending(c, S) && !held(c, S)) c.atR = { r: S.round, ai: at.init }; // beurtplek van deze ronde vasthouden
  else if (!p.own && c.atR) delete c.atR; // al geweest en opnieuw gewijzigd: gewone regels (skipR)
  if (p.skip) c.skipR = S.round; else if (c.skipR != null) delete c.skipR;
  if (p.next && !pending(c, S)) c.nextR = { r: S.round, after: S.active, ...(cur && !pending(cur, S) ? { ai: at.init } : {}) }; // ai: plek van het anker nu
  else if (!p.next && c.nextR && !(p.own && pending(c, S))) delete c.nextR;
  const it = initText(p, v, cur && cur.name);
  if (it) { out.msgs.push(say("rules.initMsg", { name: c.name, what: it })); out.why.push({ t: it, id: c.id }); }
  return out;
}

/** Descriptor bij een plan (melding, logoorzaak en live hint in ⋯; kleine letter vooraan); "" als er niets bijzonders is */
export function initText(p, v, curName) {
  const n = String(v);
  if (p.own) return M("rules.initOwn", { v: n });
  if (p.skip) return M("rules.initSkip", { v: n });
  if (p.next) return curName ? M("rules.initNext", { name: curName, v: n }) : M("rules.initNextCur", { v: n });
  return "";
}

/** Ingevulde initiative ("14", 14, "-1") → heel getal binnen -10..40; leeg of ongeldig → null */
export function parseInit(v) {
  const s = String(v ?? "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Math.max(-10, Math.min(40, Math.round(+s)));
}

export const isOut = (c) => (c.kind === "monster" && c.hp <= 0) || !!(c.ds && c.ds.dead);

/**
 * Surprise (PHB 2014): wie verrast is (`sur`) doet in ronde 1 niets; zijn beurt wordt overgeslagen
 * (beurtgrenzen tellen wel af) en hij heeft geen reaction tot die beurt voorbij is.
 * sur: true = nog verrast, 2 = beurt is overgeslagen (blijft in ronde 1 overgeslagen, ook bij ‹ Vorige).
 * Vanaf ronde 2 en bij Gevecht stoppen verdwijnt `sur`.
 */
export const skipsTurn = (c, round) => isOut(c) || (round === 1 && !!c.sur) || (!!round && c.skipR === round); // skipR: RE9, al geweest deze ronde
/** Nog verrast: geen reaction, geen legendary actions */
export const isSurprised = (c, S) => c.sur === true && S.round === 1 && !isOut(c);
/** GV12: label overal gelijk (dichte kaart, knop, live-blok, spelersscherm), in de actieve taal */
export const reactTag = () => t("rules.reactTag");
/** GV12: reaction gebruikt en nog niet terug (begin eigen beurt). Verrast heeft een eigen badge; pcr = false (GV4 "Spelers
 *  zelf"): niet bij spelers. Eén voorwaarde voor kaart, live-blok en spelersscherm. */
export const reactUsed = (c, S, pcr = true) => !!c.reaction && !(c.max && c.hp <= 0) && !(c.ds && c.ds.dead) /* dood = 0 HP; verdediging tegen rare data */ && !isSurprised(c, S) && (c.kind !== "pc" || pcr);
const clearSur = (list) => { for (const c of list) delete c.sur; };
const clearSkip = (list) => { for (const c of list) { delete c.skipR; delete c.nextR; delete c.atR; } };

/** Hoort c bij de verraste kant (who: "none" | "mon" | "pc")? Lair en wie al neer of dood is, niet. */
export const surWho = (c, who) => c.kind !== "lair" && !isOut(c) && ((who === "mon" && c.kind === "monster") || (who === "pc" && c.kind === "pc"));

/**
 * Bij Start gevecht (initiative-paneel): wie is verrast. who: "none" | "mon" | "pc".
 * Wie al neer of dood is, telt niet. startCombat zet daarna reaction en het overslaan.
 * 2024 (WP51): verrast = alleen disadvantage op de initiativeworp (surDis); er wordt geen `sur` gezet, dus geen
 * overgeslagen beurt en geen blokkade van reaction, legendary actions of Parry.
 */
export function setSurprise(list, who, ed = "2014") {
  const out = fx();
  for (const c of list) {
    delete c.sur;
    if (ed !== "2024" && surWho(c, who)) c.sur = true;
  }
  return out;
}

/**
 * Verrast aan/uit voor één deelnemer in ronde 1 (⋯): alleen zolang zijn beurt nog moet komen.
 * Uit: reaction weer beschikbaar. Geeft null als het nu niet kan.
 */
export function canToggleSurprise(c, S, ed = "2014") {
  if (ed === "2024" || S.round !== 1 || c.kind === "lair" || isOut(c) || c.id === S.active) return false;
  if (c.sur === true) return true;
  if (c.sur) return false; // beurt al overgeslagen
  const L = turnOrder(S, sortOrder(S.list));
  return L.findIndex((x) => x.id === c.id) > L.findIndex((x) => x.id === S.active);
}
export function toggleSurprise(c, S, ed = "2014") {
  if (!canToggleSurprise(c, S, ed)) return null;
  const out = fx();
  if (c.sur === true) { delete c.sur; c.reaction = false; out.why.push({ t: M("rules.surNot"), id: c.id }); }
  else { c.sur = true; c.reaction = true; out.why.push({ t: M("rules.sur"), id: c.id }); }
  return out;
}

/** Wie is na `id` aan de beurt (overslaan van wie neer is en, in ronde 1, wie verrast is). skip(c) = extra overslaan. */
export function nextUp(S, L, id, skip = () => false) {
  if (id === S.active) L = turnOrder(S, L); // RE9: beurt op de oude plek, ingeschoven deelnemers direct erna
  const i = L.findIndex((c) => c.id === id);
  for (let k = 1; k <= L.length; k++) {
    const j = i + k, c = L[j % L.length], r = S.round + (j >= L.length ? 1 : 0);
    if (c && c.id !== id && !skipsTurn(c, r) && !skip(c)) return c;
  }
  return null;
}

/**
 * Zijkolom (GV3): welk monster de DM kan voorlezen naast een speler zonder sheet.
 * Actieve beurt als dat een monster is (now), anders de volgende monsterbeurt (zoals nextUp: neer en verrast in ronde 1 overgeslagen).
 * ok(c) = heeft een statblock (lair en monsters zonder statblock tellen niet). n = levende leden van de groep (anders 1).
 * Alleen tijdens een gevecht; geeft null als er geen monster meer aan de beurt komt.
 */
export function readAhead(S, L, ok) {
  if (!S.round || !S.active) return null;
  const a = L.find((c) => c.id === S.active);
  const now = !!(a && ok(a) && !skipsTurn(a, S.round));
  const c = now ? a : nextUp(S, L, S.active, (x) => !ok(x));
  if (!c) return null;
  const T = turnOrder(S, L), r = !now && T.indexOf(c) <= T.findIndex((x) => x.id === S.active) ? S.round + 1 : S.round; // na de rondegrens: verrast telt niet meer
  const g = groupOf(L, c.id, r);
  return { c, now, n: g ? g.live.length : 1 };
}

/**
 * Groepsbeurt: monsters die samen met één groepsworp (of ingevulde initiative) zijn toegevoegd (`grp`).
 * Elk lid houdt zijn eigen beurt (beurtgrenzen, recharge, saves per lid); dit is alleen voor de weergave.
 * Groep = aaneengesloten reeks in sortOrder met dezelfde grp én initiative (ander initiative = uit de groep).
 * round: ronde (in ronde 1 tellen verraste leden niet mee). Geeft { live, k } (levende leden en positie 1..n van id daarin) of null als id zelf neer is of er geen groep van 2+ levende leden is.
 */
export function groupOf(L, id, round = 0) {
  const i = L.findIndex((c) => c.id === id), c = L[i];
  if (!c || !c.grp || skipsTurn(c, round)) return null; // wie zelf neer is (bijv. in de eigen beurt gedood) staat los: geen "0/2"
  const same = (x) => x && x.grp === c.grp && x.init === c.init;
  let a = i, b = i;
  while (same(L[a - 1])) a--;
  while (same(L[b + 1])) b++;
  const live = L.slice(a, b + 1).filter((x) => !skipsTurn(x, round)); // ronde 1: verraste leden doen niet mee
  return live.length > 1 ? { live, k: live.indexOf(c) + 1 } : null;
}

/**
 * Duur van een nieuwe conditie. Teltrigger: begin of einde van de beurt van `who`.
 * opt: { dur, ab, dc }
 */
export function makeDur(c, opt, activeId) {
  const dur = opt.dur || "inf";
  const act = activeId || c.id;
  let e = null;
  if (dur === "tend") e = { kind: "tend", who: c.id, at: "end", count: activeId === c.id ? 2 : 1 };
  else if (dur === "tstart") e = { kind: "tstart", who: c.id, at: "start", count: 1 };
  else if (dur === "sstart") e = { kind: "sstart", who: act, at: "start", count: 1 };
  else if (dur[0] === "r") e = { kind: "rounds", who: act, at: "start", count: +dur.slice(1) };
  if (opt.ab && opt.dc) (e = e || { kind: "inf" }).save = { ab: opt.ab, dc: +opt.dc };
  return e;
}

export const durText = (c, n, list) => durLabel(c.cd && c.cd[n], list);

/** Resterende duur als korte tekst (condities en effecten) */
export function durLabel(e, list, short = false) {
  if (!e) return "";
  const who = list.find((x) => x.id === e.who);
  // tekst in de actieve taal (alleen weergave)
  let x = e.kind === "rounds" ? t("rules.dl.rounds", { n: e.count })
    : e.kind === "tend" ? t(short ? "rules.dl.tendS" : e.count > 1 ? "rules.dl.tend2" : "rules.dl.tend")
    : e.kind === "tstart" ? t(short ? "rules.dl.tstartS" : "rules.dl.tstart")
    : e.kind === "sstart" ? t(short ? "rules.dl.sstartS" : "rules.dl.sstart", { name: who ? who.name : "?" }) : "";
  if (e.save) x += `${x ? ", " : ""}${e.save.ab} ${e.save.dc}`;
  return x;
}

/**
 * Resterende duur voor de conditie-uitleg (RE10) als descriptor (WP28): "nog 3 rondes", "t/m einde van zijn beurt".
 * name(id) = naam die getoond mag worden (spelersscherm: leeg bij een verborgen of anonieme deelnemer). null = geen duur.
 * De snapshot naar spelers bevat de descriptor (tdx), zodat elk spelersscherm hem in de eigen taal toont.
 */
export function durDesc(e, list, name = (id) => (list.find((x) => x.id === id) || {}).name || "") {
  if (!e) return null;
  if (e.kind === "rounds") return M("rules.dw.rounds", { n: e.count });
  if (e.kind === "tend") return M(e.count > 1 ? "rules.dw.tend2" : "rules.dw.tend");
  if (e.kind === "tstart") return M("rules.dw.tstart");
  if (e.kind === "sstart") { const n = name(e.who); return n ? M("rules.dw.sstart", { name: n }) : M("rules.dw.sstartX"); }
  return null;
}
/** Zelfde als tekst in de actieve taal; leeg = geen duur */
export const durWords = (e, list, name) => { const x = durDesc(e, list, name); return x ? tr(x) : ""; };
/** Herhaalsave als descriptor: "STR DC 13 aan het einde van zijn beurt"; null = geen */
export const saveDesc = (e) => (e && e.save ? M("rules.saveWords", { ab: String(e.save.ab), dc: String(e.save.dc) }) : null);
/** Zelfde als tekst in de actieve taal */
export const saveWords = (e) => { const x = saveDesc(e); return x ? tr(x) : ""; };

/** Een beurtgrens ("start" of "end" van deelnemer id): duur aftellen (herhaal-saves: saves.js, open bij het begin van de beurt) */
export function turnBoundary(list, at, id) {
  const out = fx();
  for (const c of list) {
    if (!c.cd) continue;
    for (const [n, e] of Object.entries(c.cd)) {
      if (!c.cond.includes(n)) { delete c.cd[n]; continue; }
      if (e.who === id && e.at === at && e.count) {
        e.count--;
        if (e.count <= 0) {
          out.why.push({ t: M("rules.durEnd"), id: c.id });
          c.cond = c.cond.filter((x) => x !== n);
          delete c.cd[n];
          if (n === "Concentrating") c.concSpell = null;
          out.msgs.push(say("rules.over", { name: c.name, what: n }));
        }
      }
    }
  }
  const r = tickEffects(list, at, id);
  out.msgs.push(...r.msgs); out.why.push(...r.why);
  return out;
}

/**
 * Naar de volgende (dir=1) of vorige (dir=-1) beurt. Slaat wie neer is over.
 * Vooruit: einde vorige beurt, begin nieuwe beurt (reaction, legendary, recharge, death save-herinnering).
 */
export function step(state, dir, rng = Math.random) {
  const out = fx();
  let L = turnOrder(state, sortOrder(state.list));
  if (!L.length) return out;
  let i = L.findIndex((c) => c.id === state.active);
  const was = L[i];
  const passed = [], sur = [];
  if (dir > 0 && state.active && i >= 0) passed.push(["end", state.active]);
  // met verraste deelnemers kan ronde 1 helemaal overgeslagen worden: dan nog één rondgang in ronde 2
  const lim = L.length * (L.some((c) => c.sur) ? 2 : 1);
  for (let n = 0; n < lim; n++) {
    i += dir;
    if (dir > 0 && n > 0) {
      const skipped = L[(i - 1 + L.length) % L.length];
      // RE9: wie deze ronde al aan de beurt was en naar achteren is verplaatst, heeft zijn beurtgrenzen al gehad
      if (skipped.skipR !== state.round) passed.push(["start", skipped.id], ["end", skipped.id]);
      if (skipped.sur === true) { skipped.sur = 2; skipped.reaction = false; if (!isOut(skipped)) sur.push(skipped); } // verrassing voorbij (ook als hij nu neer is en later geheald wordt): reaction weer beschikbaar
    }
    // nieuwe (of vorige) ronde: gewone volgorde, zonder ingeschoven beurten (RE9)
    if (i >= L.length) { i = 0; state.round++; clearSkip(state.list); if (state.round > 1) clearSur(state.list); L = sortOrder(state.list); }
    else if (i < 0) { state.round = Math.max(1, state.round - 1); L = sortOrder(state.list); i = L.length - 1; }
    if (!skipsTurn(L[i], state.round)) break;
  }
  if (sur.length) {
    out.msgs.push(say("rules.surSkip", { names: sur.map((c) => c.name).join(", ") }));
    for (const c of sur) out.why.push({ t: M("rules.surSkipWhy"), id: c.id });
  }
  const cur = L[i];
  if (dir > 0 && was && was !== cur && pending(was, state)) was.nextR.done = 1; // ingeschoven beurt is gespeeld (RE9)
  state.active = cur.id;
  state.ai = cur.init; // RE9: plek van de beurt, ook als hij tijdens zijn beurt zijn initiative wijzigt
  if (dir < 0) { untickSaves(state); rageTurnBack(cur); return out; }

  passed.push(["start", cur.id]);
  if (was && was !== cur) rageTurnEnd(was, out);
  const ts = tickSaves(state); out.why.push(...ts.why); out.msgs.push(...ts.msgs); // RE12: vervallen saves melden
  for (const [at, id] of passed) {
    const r = turnBoundary(state.list, at, id);
    out.msgs.push(...r.msgs); out.why.push(...r.why);
  }
  turnSaves(state, cur.id);
  cur.reaction = false;
  if (cur.la) cur.la.left = cur.la.max;
  const rc = [];
  for (const r of cur.rc || []) {
    if (r.ready || r.rest) continue;
    const x = d(6, rng);
    r.ready = x >= r.min;
    rc.push(say(r.ready ? "rules.rcYes" : "rules.rcNo", { name: r.n, x: String(x) }));
    if (r.ready) out.why.push({ t: `recharge d6 [${x}]`, id: cur.id });
  }
  if (rc.length) out.msgs.push(say("rules.rc", { name: cur.name, what: rc.join("; ") }));
  if (cur.kind === "pc" && cur.max && cur.hp <= 0 && cur.ds && !cur.ds.stable && !cur.ds.dead) out.msgs.push(say("rules.dsTurn", { name: cur.name }));
  return out;
}

/**
 * RE16: einde van de beurt van een barbarian in rage. Geen schade sinds zijn vorige beurt en de DM tikte niet op
 * Voorbij: rage loopt door (de app weet niet of hij aanviel), maar niet stil. Daarna telt de schade opnieuw.
 */
function rageTurnEnd(c, out) {
  const e = rageOf(c);
  if (!e) return;
  if (!e.hit) out.msgs.push(say("rules.rageOn", { name: c.name }));
  e.ph = e.hit ? 1 : 0; // ‹ Vorige terug in zijn beurt: de schade-markering komt terug
  delete e.hit;
}
/** ‹ Vorige: terug in de beurt van een barbarian in rage → markering van vóór Volgende */
function rageTurnBack(c) {
  const e = rageOf(c);
  if (!e || !("ph" in e)) return;
  if (e.ph) e.hit = 1; else delete e.hit;
  delete e.ph;
}

/**
 * Deelnemer weghalen (⋯ → Verwijder). Is hij tijdens een gevecht aan de beurt, dan is zijn beurt voorbij:
 * eerst gewoon door naar de volgende (beurtgrenzen, ronde erbij als de volgorde rondgaat), dan weg.
 * Zonder dit begon Volgende bij index −1: beurt naar de eerste in de volgorde, ronde bleef staan (GV6).
 */
export function removeCombatant(state, id, rng = Math.random) {
  let out = fx();
  if (state.round && state.active === id && state.list.some((c) => c.id !== id && !isOut(c))) out = step(state, 1, rng);
  // RE9: ingeschoven beurten die direct na deze deelnemer kwamen, komen na zijn voorganger (anders vallen ze terug op hun plek vóór de beurt)
  const T = turnOrder(state, sortOrder(state.list)), k = T.findIndex((c) => c.id === id);
  const prev = T.slice(0, Math.max(0, k)).reverse().find((c) => !pending(c, state));
  for (const c of state.list) if (pending(c, state) && c.nextR.after === id) { c.nextR.after = prev ? prev.id : null; if (prev) c.nextR.ai = posOf(state, prev).init; }
  state.list = state.list.filter((c) => c.id !== id);
  if (state.active === id) state.active = null;
  return out;
}

/** Gevecht starten: ronde 1, eerste deelnemer die niet neer is, met start-van-beurt-effecten. ed: 2024 kent geen `sur`. */
export function startCombat(state, rng = Math.random, ed = "2014") {
  for (const c of state.list) {
    if (c.la) c.la.left = c.la.max; // nieuw gevecht: legendary actions vol, ook vóór de eigen beurt
    if (c.sur && !isOut(c) && ed !== "2024") { c.sur = true; c.reaction = true; } else delete c.sur; // verrast: geen reaction tot de eigen beurt voorbij is (2024: vangnet tegen rare data)
  }
  state.round = 1;
  state.active = null;
  return step(state, 1, rng);
}

/** Gevecht stoppen: ronde-effecten weg, geen ronde of beurt, open saves vervallen */
export function stopCombat(state) {
  const out = endFightEffects(state.list);
  state.round = 0; state.active = null; state.saves = []; delete state.ai;
  clearSur(state.list); clearSkip(state.list);
  return out;
}

/**
 * Volgende encounter: gevecht stoppen en alle monsters en lairs weghalen (ook verborgen monsters).
 * Spelers blijven met HP, slots, condities, death saves en lange effecten; het logboek blijft.
 * Concentratie-effecten van een weggehaalde caster verdwijnen in commit() (endConcEffects).
 */
export function clearMonsters(state) {
  const out = stopCombat(state);
  delete state.endSum; delete state.enc; // samenvatting en ingeladen encounter horen bij de vorige encounter
  const gone = new Set(state.list.filter((c) => c.kind === "monster" || c.kind === "lair").map((c) => c.id));
  const n = state.list.filter((c) => c.kind === "monster").length;
  dropIds(state, gone);
  out.why.push({ t: M("rules.nextEnc"), id: null });
  return Object.assign(out, { n, lairs: gone.size - n });
}

/**
 * Deelnemers weghalen buiten een gevecht (monsters wissen, GV7 oude monsters). Conditieduur die aan de beurt van een
 * weggehaalde hing telt nooit meer af: conditie blijft, zonder duur (save en concentratie-koppeling blijven).
 */
export function dropIds(state, gone) {
  state.list = state.list.filter((c) => !gone.has(c.id));
  for (const c of state.list) for (const [k, e] of Object.entries(c.cd || {})) if (e && gone.has(e.who)) {
    const { kind, who, at, count, ...keep } = e;
    if (Object.keys(keep).length) c.cd[k] = { kind: "inf", ...keep }; else delete c.cd[k];
  }
}

/** WP50: " − 4 Exhaustion 2" achter een initiativeworp, of "" (em = exhMod) */
export const initModText = (em) => (em ? ` − ${-em.b} ${em.n}` : "");
/**
 * Initiativeworp uit één of twee d20's (twee = disadvantage, WP51 surprise 2024: de laagste telt), bonus bo en
 * Exhaustion-straf em. → { r (de d20 die telt), v (totaal), txt: "d20 [14, 6] dis +2 − 4 Exhaustion 2" }
 */
export function initThrow(dd, bo, em = null) {
  const r = Math.min(...dd);
  return { r, v: r + bo + (em ? em.b : 0), txt: `d20 [${dd.join(", ")}]${dd.length > 1 ? " dis" : ""} ${sgn(bo)}${initModText(em)}` };
}
/**
 * Initiative-bonus van een deelnemer: c.initBonus als die er is (speler uit de sheet; 2024-monster uit het statblock,
 * WP48), anders Dex. De tiebreak blijft c.dex (sortOrder).
 */
export const initBo = (c) => (Number.isFinite(c && c.initBonus) ? c.initBonus : c && Number.isFinite(c.dex) ? c.dex : 0);
/** WP48: initiative-bonus uit een statblock (SRD 5.2 "Initiative +12" = m.init), of null (2014: dan Dex) */
export const statInit = (m) => (m && Number.isFinite(m.init) ? m.init : null);
/**
 * Initiative-velden van een nieuw monster uit zijn statblock: r = d20-worp, of undefined bij een vaste waarde (fixed).
 * { init, roll, dex, initBonus? }: dex = Dex-modifier (tiebreak); initBonus alleen als het statblock een eigen
 * Initiative heeft (2024), zodat 2014-monsters er precies zo uitzien als voorheen.
 */
export function monInit(m, r, fixed = null) {
  const dex = mod(m && m.ab ? m.ab[1] : (m && m.dexScore) || 10), si = statInit(m);
  return { init: r === undefined ? fixed : r + (si ?? dex), roll: r, dex, ...(si !== null ? { initBonus: si } : {}) };
}

/** Levend monster met een worp die niemand heeft aangeraakt (niet ingevuld, niet via ⋯ of de kaart aangepast) */
export const freshRoll = (c) => c.kind === "monster" && !isOut(c) && Number.isFinite(c.roll) && Number.isFinite(c.dex) && c.init === c.roll + initBo(c);

/**
 * GV5: initiative van monsters opnieuw rollen bij Start gevecht. Alleen onaangeroerde worpen (freshRoll), ook verborgen
 * monsters; ingevuld of aangepast blijft. Groep (zelfde grp én init) krijgt één worp, zodat groupOf blijft kloppen.
 * Lair en spelers niet. Geeft { msgs, why, n }.
 * WP51 (surprise 2024): dis(c) = deze deelnemer rolt met disadvantage (twee d20's, laagste telt). keep = niet opnieuw
 * rollen ("Houden"): alleen wie disadvantage heeft krijgt een tweede d20 naast zijn bestaande worp (zelfde kans).
 * Bewust: na Houden + disadvantage telt de worp nog als onaangeroerd; opnieuw starten met dezelfde monsters en weer
 * verrast stapelt dan (zeldzaam). Monsters met Exhaustion-straf zijn niet fresh en krijgen dus geen disadvantage.
 */
export function rerollMonsters(list, rng = Math.random, { dis = null, keep = false } = {}) {
  const out = Object.assign(fx(), { n: 0 }), groups = new Map();
  for (const c of list) {
    if (!freshRoll(c)) continue;
    const sd = !!(dis && dis(c));
    if (keep && !sd) continue;
    const k = c.grp ? `${c.grp}|${c.init}` : null;
    let dd = k ? groups.get(k) : undefined;
    if (dd === undefined) { const a = keep ? c.roll : d(20, rng); dd = sd ? [a, d(20, rng)] : [a]; if (k) groups.set(k, dd); }
    const bo = initBo(c), em = exhMod(c); // WP50: Exhaustion 2024 −2 × niveau (de worp telt daarna niet meer als onaangeroerd)
    const ir = initThrow(dd, bo, em);
    c.roll = ir.r; c.init = ir.v; out.n++;
    out.why.push({ t: J([ir.txt, !keep && M("rules.rerollWhy"), sd && M("rules.surDisWhy"), k && M("rules.grpRoll")].filter(Boolean), ", "), id: c.id });
  }
  if (out.n) out.msgs.push(say(keep ? "rules.surDis" : "rules.reroll", { n: String(out.n) }));
  return out;
}

/** Spelers die bij Start gevecht hun initiative opgeven: levend (niet dood), ook verborgen of op 0 HP */
export const initPcs = (list) => sortOrder(list.filter((c) => c.kind === "pc" && !(c.ds && c.ds.dead)));

/**
 * Initiative van spelers vastleggen (paneel bij Start gevecht). map = { id: tekst }.
 * Alles of niets: missing = namen van spelers zonder geldige waarde (parseInit); dan verandert er niets
 * (de UI start het gevecht niet en Annuleer moet daarna echt niets veranderd hebben).
 */
export function setInits(list, map) {
  const L = initPcs(list), vals = L.map((c) => parseInit(map[c.id]));
  const out = Object.assign(fx(), { missing: L.filter((c, i) => vals[i] === null).map((c) => c.name) });
  if (!out.missing.length) L.forEach((c, i) => { if (vals[i] !== c.init) c.init = vals[i]; }); // het logboek noemt de wijziging zelf ("initiative 12 → 17")
  return out;
}
