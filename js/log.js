// Logboek: vergelijkt elke stap met de vorige en beschrijft wat er veranderde. Puur, dus testbaar.
import { ORD } from "./rules/spells.js";
import { effText } from "./rules/effects.js";
import { pasText } from "./rules/passives.js";
import { M, J } from "./i18n/msg.js";
import { t, tr, known } from "./i18n/boot.js";

export function diffLog(prev, cur) {
  const out = [];
  const add = (e) => out.push({ ...e, msg: tr(e.m) }); // m = descriptor (WP27), msg = tekst in de actieve taal (oudere apps, export)
  const nm = (c) => c.name;
  if (!(cur.list || []).length && (prev.list || []).length && !(cur.log || []).length) return []; // encounter gewist
  const P = new Map((prev.list || []).map((c) => [c.id, c]));
  const C = new Map((cur.list || []).map((c) => [c.id, c]));
  if (cur.round && cur.round > (prev.round || 0)) add({ type: "round", m: M("log.round", { n: cur.round }) });
  if (!cur.round && prev.round) add({ type: "round", m: M("log.stopped") });
  if (cur.active && cur.active !== prev.active && C.get(cur.active)) add({ type: "turn", who: cur.active, m: M("log.turn", { name: nm(C.get(cur.active)) }) });
  const pas = (x) => pasText({ ...{ per: null, ins: null, inv: null }, ...x }) || M("log.fromSheet");

  for (const [id, c] of C) {
    const o = P.get(id);
    if (!o) {
      const base = c.kind === "lair" || c.init == null ? M("log.joins", { name: nm(c) }) : M("log.joinsInit", { name: nm(c), init: String(c.init) });
      add({ who: id, m: J([base, c.hidden && M("log.hidden"), c.anon && M("log.anon")].filter(Boolean), " · ") });
      continue;
    }
    const m = [];
    if (o.name !== c.name) m.push(M("log.renamed", { name: o.name }));
    if ((o.ac || 0) !== (c.ac || 0)) m.push(M("log.ac", { a: String(o.ac || 0), b: String(c.ac || 0) }));
    if (JSON.stringify(o.pas || null) !== JSON.stringify(c.pas || null)) m.push(M("log.pas", { a: pas(o.pas), b: pas(c.pas) })); // SP5
    if ((o.max || 0) !== (c.max || 0)) m.push(M("log.maxHp", { a: String(o.max || 0), b: String(c.max || 0) }));
    if (o.init !== c.init) m.push(o.init == null ? M("log.init", { v: String(c.init) }) : M("log.initCh", { a: String(o.init), b: String(c.init ?? "–") }));
    const oe = o.eff || [], ce = c.eff || [], has = (L, e) => L.some((x) => x.id === e.id), same = (L, e) => L.some((x) => x.n === e.n);
    ce.filter((e) => !has(oe, e)).forEach((e) => {
      const was = oe.find((x) => !has(ce, x) && x.n === e.n);
      // TA17: een ander exhaustion-niveau is geen "vernieuwd"
      m.push(was ? (e.n === "Exhaustion" && was.x !== e.x ? M("log.exhCh", { a: String(was.x || 0), b: String(e.x || 0) }) : M("log.renew", { name: e.n }))
        : e.st ? M("log.getsX", { name: e.n, x: effText(e) }) : M("log.gets", { name: e.n }));
    });
    oe.filter((e) => !has(ce, e) && !same(ce.filter((x) => !has(oe, x)), e)).forEach((e) => m.push(M("log.ends", { name: e.n })));
    if (c.max && o.hp !== c.hp) m.push(M("log.hp", { a: String(o.hp), b: String(c.hp), d: `${c.hp > o.hp ? "+" : "−"}${Math.abs(c.hp - o.hp)}` }));
    if ((o.temp || 0) !== (c.temp || 0)) m.push(M("log.temp", { a: String(o.temp || 0), b: String(c.temp || 0) }));
    const oc = o.cond || [], cc = c.cond || [];
    cc.filter((x) => !oc.includes(x)).forEach((x) => m.push(x === "Concentrating" && c.concSpell ? M("log.concOn", { spell: c.concSpell }) : x === "Unconscious" ? M("log.unc") : M("log.gets", { name: x })));
    oc.filter((x) => !cc.includes(x)).forEach((x) => m.push(x === "Concentrating" ? (o.concSpell ? M("log.concEndOn", { spell: o.concSpell }) : M("log.concEnd")) : M("log.ends", { name: x })));
    if (oc.includes("Concentrating") && cc.includes("Concentrating") && o.concSpell !== c.concSpell && c.concSpell)
      m.push(o.concSpell ? M("log.concNowWas", { spell: c.concSpell, old: o.concSpell }) : M("log.concNow", { spell: c.concSpell }));
    if (o.sur !== true && c.sur === true) m.push(M("log.sur"));
    else if (o.sur === true && !c.sur) m.push(M("log.surOff"));
    else if (!o.reaction && c.reaction) m.push(M("log.react"));
    if (!!o.hidden !== !!c.hidden) m.push(M(c.hidden ? "log.hidden" : "log.shown"));
    if (!!o.anon !== !!c.anon) m.push(M(c.anon ? "log.anon" : "log.named"));
    const cnt = (x) => ({ n: String(x.left), max: String(x.max) });
    if (o.casting && c.casting) {
      c.casting.slots.forEach((x, i) => {
        const y = o.casting.slots[i];
        if (y && y.left !== x.left) m.push(M(x.left < y.left ? "log.slotUsed" : "log.slotBack", { lv: ORD[x.lvl], ...cnt(x) }));
      });
      const P2 = c.casting.pact, Q = o.casting.pact; // RE3
      if (P2 && Q && P2.left !== Q.left) m.push(M(P2.left < Q.left ? "log.pactUsed" : "log.pactBack", cnt(P2)));
      (c.casting.daily || []).forEach((g, gi) => g.items.forEach((x, ii) => {
        const y = o.casting.daily?.[gi]?.items?.[ii];
        if (y && x.left < y.left) m.push(M("log.dailyUsed", { name: x.n, ...cnt(x), per: g.label.split(" ")[0] }));
      }));
    }
    (c.res || []).forEach((x, i) => {
      const y = (o.res || [])[i];
      if (y && y.left !== x.left) m.push(M(x.left < y.left ? "log.resUsed" : "log.resBack", { name: x.n, ...cnt(x) }));
    });
    if (o.la && c.la && c.la.left < o.la.left) m.push(M("log.la", cnt(c.la)));
    if (o.lr && c.lr && c.lr.left < o.lr.left) m.push(M("log.lr", cnt(c.lr)));
    if (o.rc && c.rc) c.rc.forEach((x, i) => {
      const y = o.rc[i];
      if (y && y.ready && !x.ready) m.push(M("log.rcUsed", { name: x.n }));
      if (y && !y.ready && x.ready) m.push(M("log.rcBack", { name: x.n }));
    });
    if (o.ds && c.ds) {
      if (c.ds.s > o.ds.s) m.push(M("log.dsS", { n: String(c.ds.s) }));
      if (c.ds.f > o.ds.f) m.push(M("log.dsF", { n: String(c.ds.f) }));
      if (c.ds.dead && !o.ds.dead) m.push(M("log.dies"));
      if (c.ds.stable && !o.ds.stable) m.push(M("log.stable"));
    }
    if (o.ds && !c.ds && c.hp > 0 && o.hp <= 0) m.push(M("log.up"));
    if (c.kind === "lair" && c.last && c.last !== o.last) m.push(M("log.lair", { name: c.last }));
    if (m.length) add({ who: id, m: M("log.changes", { name: nm(c), what: J(m, ", ") }) });
  }
  for (const [id, o] of P) if (!C.has(id)) add({ who: id, m: M("log.removed", { name: nm(o) }) });
  return out;
}

/** Ronde-label van een logregel: "R3", of "Voorbereiding" vóór het gevecht (ronde 0, leeg of onzin uit oude data). */
export function logRound(r) {
  const n = Math.floor(Number(r));
  return Number.isFinite(n) && n > 0 ? t("log.r", { n: String(n) }) : t("log.prep");
}

/** Tekst van een logregel in de actieve taal: descriptor (m, WP27) als die er is, anders de bewaarde tekst (oude regels).
 *  TS5: kent de catalogus een sleutel niet (nieuwere app, catalogus niet geladen), dan wint een bewaarde msg. */
export const logMsg = (e) => {
  if (!e) return "";
  if (e.m && (!e.msg || known(e.m))) return tr(e.m);
  return e.msg || "";
};
const whyD = (e) => Array.isArray(e.w) && e.w.length > 0;
/** Oorzaak van een logregel: descriptoren (w) als die er zijn, anders de bewaarde tekst (TS5: ook bij onbekende sleutels) */
export const logWhy = (e) => {
  if (!e) return "";
  if (whyD(e) && (!e.why || known(e.w))) return e.w.map(tr).filter(Boolean).join("; ");
  return e.why || "";
};

export function logText(log) {
  return (log || []).map((e) => { const msg = logMsg(e), why = logWhy(e); return e.type === "round" ? `\n== ${msg} ==` : e.type === "turn" ? `-- ${msg} --`
    : `${logRound(e.r)}${e.turn ? ` [${e.turn}]` : ""} ${msg}${why ? ` (${why})` : ""}${e.note ? ` | ${e.note}` : ""}`; }).join("\n").trim();
}

/** TS3: in de stand staat m (descriptor) óf msg (tekst), w óf why; weg met de tekst als de descriptor er is (in place). */
export function slimLog(log) {
  if (!Array.isArray(log)) return;
  // TS5: alleen als de catalogus elke sleutel kent; anders blijft de tekst de terugval (nieuwere app, catalogus te laat)
  for (const e of log) if (e && typeof e === "object") { if (e.m && known(e.m)) delete e.msg; if (whyD(e) && known(e.w)) delete e.why; }
}

/** TS3: logregel voor de export met msg en why als tekst in de actieve taal (oudere apps lezen alleen die), zelfde
 *  sleutelvolgorde als vóór 2.2.1. Muteert de regel niet. */
export function exportLog(log) {
  return (log || []).map((e) => {
    if (!e || typeof e !== "object") return e;
    const { id, r, turn, type, msg, why, note, ...rest } = e;
    // TS5: zonder bruikbare vertaling geen kale sleutel in msg/why, maar de bewaarde tekst (of niets)
    const okM = !e.m || known(e.m), okW = !whyD(e) || known(e.w);
    return { id, r, turn, type, msg: okM ? logMsg(e) : msg, why: okW ? logWhy(e) : why, note, ...rest };
  });
}

/** Logregels van één stap: wat in newer staat en niet in older (op id; inkorten tot 600 haalt alleen oude regels weg). */
export function stepEntries(newer, older) {
  const sig = (e) => (e && e.m ? JSON.stringify(e.m) : e && e.msg); // TS3: m óf msg
  const m = new Map((older || []).map((e) => [e && e.id, sig(e)]));
  return (newer || []).filter((e) => e && (!m.has(e.id) || m.get(e.id) !== sig(e))); // relog (afronden-chips) herschrijft een regel
}

const CUT = 70; // ± twee regels in een melding op 320 px
const cut = (s) => (s.length > CUT ? s.slice(0, CUT - 1).trimEnd() + "…" : s);

/**
 * Melding na Ongedaan of Opnieuw (GV8, puur). entries = logregels van de stap (stepEntries), S = stand ná de actie,
 * verb = "undo" | "redo". Beurtwissel: waar je nu staat ("Terug naar beurt van Aram (ronde 2)"), want "beurt
 * van Noor ongedaan" laat de DM terugrekenen. Anders de eerste regel van de stap met "+N meer" (AoE: het eerste doel).
 * Geeft { text, more } (more = aantal regels dat niet getoond wordt).
 */
export function stepText(entries, S, verb) {
  const L = (entries || []).filter((e) => e && (typeof e.msg === "string" || e.m));
  const back = verb === "undo";
  const pre = (what) => t(back ? "log.undoW" : "log.redoW", { what });
  const lines = L.filter((e) => !e.type);
  const k = (e) => (e.m && e.m.k) || "";
  if (L.some((e) => e.type === "turn" || e.type === "round")) {
    const act = S && S.round ? (S.list || []).find((c) => c.id === S.active) : null;
    const at = act ? t("log.atTurn", { name: act.name, n: String(S.round) }) : "";
    // codes uit de descriptor (de regels van een stap zijn altijd van deze versie: de undo-geschiedenis hoort bij één VERSION)
    const stopped = (e) => e.type === "round" && k(e) === "log.stopped";
    const first = (e) => e.type === "round" && k(e) === "log.round" && String(e.m.p && e.m.p.n) === "1";
    if (L.some(stopped)) return { text: back ? (at ? t("log.fightAgain", { at }) : pre(t("log.stopped"))) : pre(t("log.stopped")), more: 0 }; // Gevecht afronden
    if (L.some(first) && (back ? !S || !S.round : true)) return { text: pre(t("log.start")), more: 0 };
    // condities die aflopen noemt de melding niet (UX); een verwijderde deelnemer (aan de beurt, GV6) wel
    if (at) {
      const x = lines.find((e) => (k(e) ? k(e) === "log.removed" : / verwijderd$/.test(e.msg)));
      const where = back ? t("log.backTo", { at }) : pre(at);
      return { text: `${where}${x ? ` · ${cut(logMsg(x))}` : ""}`, more: 0 };
    }
  }
  const pick = lines.length ? lines : L;
  if (!pick.length) return { text: t(back ? "log.undone" : "log.redone"), more: 0 };
  return { text: pre(cut(logMsg(pick[0]))), more: pick.length - 1 };
}
