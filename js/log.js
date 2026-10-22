// Logboek: vergelijkt elke stap met de vorige en beschrijft wat er veranderde. Puur, dus testbaar.
import { ORD } from "./rules/spells.js";
import { effText } from "./rules/effects.js";

export function diffLog(prev, cur) {
  const out = [];
  const nm = (c) => c.name;
  if (!(cur.list || []).length && (prev.list || []).length && !(cur.log || []).length) return []; // encounter gewist
  const P = new Map((prev.list || []).map((c) => [c.id, c]));
  const C = new Map((cur.list || []).map((c) => [c.id, c]));
  if (cur.round && cur.round > (prev.round || 0)) out.push({ type: "round", msg: `Ronde ${cur.round} begint` });
  if (!cur.round && prev.round) out.push({ type: "round", msg: "Gevecht gestopt" });
  if (cur.active && cur.active !== prev.active && C.get(cur.active)) out.push({ type: "turn", who: cur.active, msg: `Beurt van ${nm(C.get(cur.active))}` });

  for (const [id, c] of C) {
    const o = P.get(id);
    if (!o) { out.push({ who: id, msg: `${nm(c)} doet mee${c.kind === "lair" || c.init == null ? "" : ` (initiative ${c.init})`}${c.hidden ? " · verborgen voor spelers" : ""}${c.anon ? " · naam onbekend voor spelers" : ""}` }); continue; }
    const m = [];
    if (o.name !== c.name) m.push(`heette ${o.name}`);
    if ((o.ac || 0) !== (c.ac || 0)) m.push(`AC ${o.ac || 0} → ${c.ac || 0}`);
    if ((o.max || 0) !== (c.max || 0)) m.push(`max HP ${o.max || 0} → ${c.max || 0}`);
    if (o.init !== c.init) m.push(o.init == null ? `initiative ${c.init}` : `initiative ${o.init} → ${c.init ?? "–"}`);
    const oe = o.eff || [], ce = c.eff || [], has = (L, e) => L.some((x) => x.id === e.id), same = (L, e) => L.some((x) => x.n === e.n);
    ce.filter((e) => !has(oe, e)).forEach((e) => m.push(same(oe.filter((x) => !has(ce, x)), e) ? `${e.n} vernieuwd` : `krijgt ${e.n}${e.st ? ` (${effText(e)})` : ""}`));
    oe.filter((e) => !has(ce, e) && !same(ce.filter((x) => !has(oe, x)), e)).forEach((e) => m.push(`${e.n} voorbij`));
    if (c.max && o.hp !== c.hp) m.push(`${o.hp} → ${c.hp} HP (${c.hp > o.hp ? "+" : "−"}${Math.abs(c.hp - o.hp)})`);
    if ((o.temp || 0) !== (c.temp || 0)) m.push(`temp HP ${o.temp || 0} → ${c.temp || 0}`);
    const oc = o.cond || [], cc = c.cond || [];
    cc.filter((x) => !oc.includes(x)).forEach((x) => m.push(x === "Concentrating" && c.concSpell ? `concentreert op ${c.concSpell}` : `krijgt ${x}`));
    oc.filter((x) => !cc.includes(x)).forEach((x) => m.push(x === "Concentrating" ? `concentratie${o.concSpell ? ` op ${o.concSpell}` : ""} voorbij` : `${x} voorbij`));
    if (oc.includes("Concentrating") && cc.includes("Concentrating") && o.concSpell !== c.concSpell && c.concSpell)
      m.push(`concentreert nu op ${c.concSpell}${o.concSpell ? ` (was ${o.concSpell})` : ""}`);
    if (o.sur !== true && c.sur === true) m.push("verrast (geen beurt in ronde 1)");
    else if (o.sur === true && !c.sur) m.push("niet meer verrast");
    else if (!o.reaction && c.reaction) m.push("reaction gebruikt");
    if (!!o.hidden !== !!c.hidden) m.push(c.hidden ? "verborgen voor spelers" : "zichtbaar voor spelers");
    if (!!o.anon !== !!c.anon) m.push(c.anon ? "naam onbekend voor spelers" : "naam bekend voor spelers");
    if (o.casting && c.casting) {
      c.casting.slots.forEach((x, i) => {
        const y = o.casting.slots[i];
        if (y && y.left !== x.left) m.push(x.left < y.left ? `${ORD[x.lvl]}-level slot gebruikt (${x.left}/${x.max} over)` : `${ORD[x.lvl]}-level slot terug (${x.left}/${x.max})`);
      });
      (c.casting.daily || []).forEach((g, gi) => g.items.forEach((x, ii) => {
        const y = o.casting.daily?.[gi]?.items?.[ii];
        if (y && x.left < y.left) m.push(`${x.n} gebruikt (${x.left}/${x.max} ${g.label.split(" ")[0]})`);
      }));
    }
    (c.res || []).forEach((x, i) => {
      const y = (o.res || [])[i];
      if (y && y.left !== x.left) m.push(x.left < y.left ? `${x.n} gebruikt (${x.left}/${x.max})` : `${x.n} hersteld (${x.left}/${x.max})`);
    });
    if (o.la && c.la && c.la.left < o.la.left) m.push(`legendary action (${c.la.left}/${c.la.max} over)`);
    if (o.lr && c.lr && c.lr.left < o.lr.left) m.push(`legendary resistance gebruikt (${c.lr.left}/${c.lr.max} over)`);
    if (o.rc && c.rc) c.rc.forEach((x, i) => {
      const y = o.rc[i];
      if (y && y.ready && !x.ready) m.push(`${x.n} gebruikt`);
      if (y && !y.ready && x.ready) m.push(`${x.n} weer beschikbaar`);
    });
    if (o.ds && c.ds) {
      if (c.ds.s > o.ds.s) m.push(`death save: success (${c.ds.s}/3)`);
      if (c.ds.f > o.ds.f) m.push(`death save: failure (${c.ds.f}/3)`);
      if (c.ds.dead && !o.ds.dead) m.push("sterft");
      if (c.ds.stable && !o.ds.stable) m.push("is stabiel");
    }
    if (o.ds && !c.ds && c.hp > 0 && o.hp <= 0) m.push("staat weer op");
    if (c.kind === "lair" && c.last && c.last !== o.last) m.push(`lair action: ${c.last}`);
    if (m.length) out.push({ who: id, msg: `${nm(c)}: ${m.join(", ")}` });
  }
  for (const [id, o] of P) if (!C.has(id)) out.push({ who: id, msg: `${nm(o)} verwijderd` });
  return out;
}

/** Ronde-label van een logregel: "R3", of "Voorbereiding" vóór het gevecht (ronde 0, leeg of onzin uit oude data). */
export function logRound(r) {
  const n = Math.floor(Number(r));
  return Number.isFinite(n) && n > 0 ? `R${n}` : "Voorbereiding";
}

export function logText(log) {
  return (log || []).map((e) => e.type === "round" ? `\n== ${e.msg} ==` : e.type === "turn" ? `-- ${e.msg} --`
    : `${logRound(e.r)}${e.turn ? ` [${e.turn}]` : ""} ${e.msg}${e.why ? ` (${e.why})` : ""}${e.note ? ` | ${e.note}` : ""}`).join("\n").trim();
}
