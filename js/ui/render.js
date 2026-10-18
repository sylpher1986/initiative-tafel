// Tekent de encounter, de party en het logboek. Render past de data niet aan.
import { $, esc, n0 } from "./util.js";
import { app, commit, canUndo } from "../state.js";
import { findMon } from "../data/monsters.js";
import { sortOrder, CONDS, DURS, durText, isOut } from "../rules/turns.js";
import { newDs } from "../rules/combat.js";
import { ORD, pickList } from "../rules/spells.js";
import { diceify } from "./statblock.js";

/** UI-toestand die niet in de encounter (en dus niet in undo/opslag) hoort */
export const ui = { dmgMode: {}, condOpt: {}, openCast: new Set(), castPick: null, confirmReset: false, logOpen: false, editLog: null, partyInit: {} };

export function render() {
  commit();
  paintEncounter();
  paintParty();
  paintLog();
}

function pips(o, key, label) {
  if (!o) return "";
  return `<div class="pips"><span class="lbl">${label} ${n0(o.left)}/${n0(o.max)}</span>${Array.from({ length: n0(o.max) }, (_, i) =>
    `<button class="pip" data-pip="${key}" data-i="${i}" aria-pressed="${i >= o.left}" aria-label="${label} ${i + 1}"></button>`).join("")}</div>`;
}

function defLine(c) {
  if (!c.ref) return "";
  const m = findMon(c.ref);
  if (!m || !m.x) return "";
  const get = (l) => (m.x.find((x) => x[0] === l) || [])[1];
  const parts = [["Kwetsbaar", "Damage Vulnerabilities"], ["Resist", "Damage Resistances"], ["Immuun", "Damage Immunities"]]
    .map(([n, l]) => (get(l) ? `${n}: <b>${esc(get(l))}</b>` : "")).filter(Boolean);
  return parts.length ? `<div class="defl">${parts.join(" · ")}</div>` : "";
}

function dsBlock(c) {
  if (c.kind !== "pc" || !c.max || c.hp > 0) return "";
  const d = c.ds || newDs();
  const p = (k, n, l) => Array.from({ length: 3 }, (_, i) => `<button class="dsp ${k}" data-ds="${k}" data-i="${i}" aria-pressed="${i < n}" aria-label="${l} ${i + 1}"></button>`).join("");
  const st = d.dead ? `<span class="st dead">Dood</span>` : d.stable ? `<span class="st ok">Stabiel</span>`
    : `<button class="btn small primary" data-a="ds-roll">Rol death save</button><button class="link" data-a="ds-crit">Kritiek geraakt (+2)</button>`;
  return `<div class="ds"><span class="lbl">Death saves</span>
    <span class="dsg">Success ${p("s", d.s, "Success")}</span><span class="dsg">Failure ${p("f", d.f, "Failure")}</span>${st}</div>`;
}

function castBlock(c) {
  const k = c.casting;
  if (!k || (!k.slots.length && !k.daily.length)) return "";
  const pp = (o, attr) => Array.from({ length: n0(o.max) }, (_, i) => `<button class="pip" ${attr} data-i="${i}" aria-pressed="${i >= o.left}" aria-label="slot ${i + 1}"></button>`).join("");
  const sum = k.slots.length ? k.slots.map((x) => `${x.lvl}:${n0(x.left)}`).join(" · ") : k.daily.map((g) => esc(g.label)).join(", ");
  const pick = (x) => ui.castPick && ui.castPick.id === c.id && ui.castPick.lvl === x.lvl
    ? `<div class="pick"><span class="hint">Welke spell?</span>${pickList(c, x.lvl).map((sp) =>
      `<button class="btn small ${sp.conc ? "conc" : ""}" data-pickspell="${esc(sp.n)}" data-conc="${sp.conc ? 1 : ""}">${esc(sp.n)}${sp.lv < x.lvl ? ` (${sp.lv}e, upcast)` : ""}${sp.conc ? " · conc." : ""}</button>`).join("")}<button class="link" data-pickspell="">Andere / overslaan</button></div>` : "";
  return `<details class="cast" data-cast ${ui.openCast.has(c.id) ? "open" : ""}><summary class="link strong">Spells <span style="font-weight:400">(${sum})</span></summary>
    <div class="castbox">
      ${k.slots.map((x, i) => `<div class="slotrow"><span class="lv">${ORD[x.lvl] || ""}</span><span class="pp">${pp(x, `data-slot="${i}"`)}</span><span class="sp">${esc(x.spells)}</span></div>${pick(x)}`).join("")}
      ${k.daily.map((g, gi) => g.items.map((it, ii) => `<div class="slotrow"><span class="lv">${esc(g.label.split(" ")[0])}</span><span class="pp">${pp(it, `data-daily="${gi}.${ii}"`)}</span><span class="sp">${esc(it.n)}</span></div>`).join("")).join("")}
      <div><button class="link" data-a="cast-reset">Alles herstellen (long rest)</button></div>
    </div></details>`;
}

function resBlock(c) {
  if (!c.res || !c.res.length) return "";
  return `<div class="castbox" style="margin-top:6px">${c.res.map((o, i) => `<div class="resrow"><span class="rn">${esc(o.n)}</span>
    <span class="pp">${o.max <= 10 ? Array.from({ length: n0(o.max) }, (_, j) => `<button class="pip" data-res="${i}" data-i="${j}" aria-pressed="${j >= o.left}" aria-label="${esc(o.n)} ${j + 1}"></button>`).join("")
      : `<button class="btn small" data-res="${i}" data-step="-1">−</button><b style="font-variant-numeric:tabular-nums;padding:0 6px">${n0(o.left)}/${n0(o.max)}</b><button class="btn small" data-res="${i}" data-step="1">+</button>`}</span>
    <span class="sp">${o.max <= 10 ? `${n0(o.left)}/${n0(o.max)} · ` : ""}per ${o.rest === "Short Rest" ? "short rest" : "long rest"}</span></div>`).join("")}</div>`;
}

function lairRow(c, S) {
  const acts = app.lairs[c.key] || [];
  const keys = [...new Set([c.key, ...Object.keys(app.lairs), ...S.list.filter((x) => x.la).map((x) => "Lair: " + x.ref)])];
  return `<li class="c lair ${c.id === S.active ? "active" : ""}" data-id="${esc(c.id)}">
    <div class="init"><input aria-label="Initiative lair" data-f="init" type="number" inputmode="numeric" value="${n0(c.init)}"></div>
    <div class="row1"><select class="lairsel" data-f="lairkey" aria-label="Welke lair">${keys.map((k) => `<option ${k === c.key ? "selected" : ""}>${esc(k)}</option>`).join("")}</select><span class="tag l">lair</span></div>
    <div class="lacts">${acts.length ? acts.map((a, i) => `<div class="lact ${c.last === a.n ? "used" : ""}">
        <p><b>${esc(a.n)}.</b> ${diceify(a.t)}</p>
        <div class="bar">${c.last === a.n ? `<span class="hint">Vorige keer gebruikt, nu niet toegestaan</span>` : `<button class="btn small" data-a="lair-use" data-i="${i}">Gebruik</button>`}
        <button class="link" data-a="lair-del" data-i="${i}">Verwijder</button></div></div>`).join("")
      : `<p class="hint">Nog geen lair actions voor deze lair. Voeg ze hieronder toe; ze worden bewaard voor volgende keren.</p>`}</div>
    <details class="conds" ${acts.length ? "" : "open"}><summary class="link">Lair action toevoegen</summary>
      <div class="form" style="margin-top:8px">
        <label>Naam<input data-f="la-n" placeholder="bijv. Magma Eruption"></label>
        <label>Effect<textarea data-f="la-t" style="min-height:80px" placeholder="Magma erupts from a point... DC 15 Dexterity saving throw or take 21 (6d6) fire damage."></textarea></label>
        <button class="btn small primary" data-a="lair-add">Opslaan</button></div></details>
    <div class="row3"><span class="hint">Initiative 20, verliest gelijke stand.</span><button class="link" data-a="del">Lair verwijderen</button></div></li>`;
}

function row(c, S) {
  if (c.kind === "lair") return lairRow(c, S);
  const pct = c.max ? Math.max(0, c.hp) / c.max : 1;
  const cls = pct <= 0.25 ? "low" : pct <= 0.5 ? "mid" : "";
  const mode = ui.dmgMode[c.id] || 1;
  const opt = ui.condOpt[c.id] || {};
  const chip = (x) => {
    const dt = durText(c, x, S.list);
    const dl = dt ? ` <span class="dl">· ${esc(dt)}</span>` : "";
    return x === "Concentrating"
      ? `<button class="chip cbtn" data-a="dropconc" title="Concentratie beëindigen">${x}${c.concSpell ? ` <span class="dl">· ${esc(c.concSpell)}</span>` : ""}${dl} <span aria-hidden="true">✕</span><span class="vh">beëindigen</span></button>`
      : `<span class="chip">${x}${dl}</span>`;
  };
  return `<li class="c ${c.id === S.active ? "active" : ""} ${isOut(c) ? "down" : ""}" data-id="${esc(c.id)}">
    <div class="init"><input aria-label="Initiative ${esc(c.name)}" data-f="init" type="number" inputmode="numeric" value="${n0(c.init)}">${c.roll ? `<small>d20 ${n0(c.roll)}</small>` : ""}</div>
    <div class="row1"><span class="nm">${esc(c.name)}</span><span class="tag ${c.kind === "monster" ? "m" : ""}">${c.kind === "monster" ? "monster" : "speler"}</span>
      ${c.ac ? `<span class="ac">AC <b>${n0(c.ac)}</b></span>` : ""}
      <button class="react" data-a="react" aria-pressed="${!!c.reaction}" title="Reaction deze ronde gebruikt?">${c.reaction ? "Reaction gebruikt" : "Reaction"}</button></div>
    ${c.max ? `<div class="hp"><div class="hpbar" aria-hidden="true"><i class="${cls}" style="width:${pct * 100}%"></i></div>
      <span class="hpnum">${n0(c.hp)} / ${n0(c.max)}${c.temp ? ` <span class="thp">+${n0(c.temp)} temp</span>` : ""}</span>
      <span class="dmg"><input aria-label="Hoeveelheid voor ${esc(c.name)}" data-f="amt" type="number" inputmode="numeric" min="0" placeholder="0">
      <button class="mode ${mode !== 1 ? "on" : ""}" data-a="mode" title="Resistance (×½) of vulnerability (×2)">${{ 1: "×1", 0.5: "×½", 2: "×2" }[mode]}</button>
      <button class="hit" data-a="dmg" title="Schade">−</button><button class="heal" data-a="heal" title="Genezen">+</button><button class="tmp" data-a="thp" title="Tijdelijke HP geven">THP</button></span></div>
      ${defLine(c)}` : ""}
    ${dsBlock(c)}
    ${castBlock(c)}
    ${resBlock(c)}
    ${c.rc && c.rc.length ? `<div class="rcs">${c.rc.map((r, i) => `<button class="rc" data-rc="${i}" aria-pressed="${!!r.ready}" title="Tik om te markeren als gebruikt of beschikbaar">${esc(r.n)} · ${r.ready ? "klaar" : r.rest ? "na rust" : `recharge ${n0(r.min)}–6`}</button>`).join("")}</div>` : ""}
    ${pips(c.la, "la", "Legendary actions")}${pips(c.lr, "lr", "Legendary resistance")}
    <div class="row3">
      ${c.cond.map(chip).join("")}
      <details class="conds"><summary class="link">Condities</summary>
        <div class="durrow">
          <label>Duur bij aanzetten<select data-f="cdur">${DURS.map(([v, l]) => `<option value="${v}" ${(opt.dur || "inf") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <label>Save aan einde beurt<span style="display:flex;gap:4px"><select data-f="cab"><option value="">geen</option>${["STR", "DEX", "CON", "INT", "WIS", "CHA"].map((a) => `<option ${opt.ab === a ? "selected" : ""}>${a}</option>`).join("")}</select><input data-f="cdc" type="number" inputmode="numeric" placeholder="DC" value="${esc(opt.dc || "")}" style="width:64px"></span></label>
        </div>
        <div class="condgrid">${CONDS.map((x) => `<button type="button" data-cond="${x}" aria-pressed="${c.cond.includes(x)}">${x}</button>`).join("")}</div></details>
      ${c.ref ? `<button class="link strong" data-a="sb">Statblock</button>` : ""}${c.sheet ? `<button class="link strong" data-a="sheet">Sheet</button>` : ""}${c.kind === "pc" && !c.pid ? `<button class="link" data-a="topty">Naar party</button>` : ""}
      <button class="link" data-a="del">Verwijder</button>
    </div></li>`;
}

function paintEncounter() {
  const S = app.S;
  const L = sortOrder(S.list);
  $("#round").textContent = S.round || "–";
  const act = L.find((c) => c.id === S.active);
  const undoBtn = `<button class="btn small" id="undo" ${canUndo() ? "" : "disabled"} title="Laatste wijziging terugdraaien">↶ Undo</button>`;
  $("#now").innerHTML = S.round
    ? `<div><div class="lbl">Aan de beurt</div><div class="who">${act ? esc(act.name) : "–"}</div></div>
       <div class="bar">${undoBtn}<button class="btn small" id="prev">Vorige</button><button class="btn primary" id="next">Volgende beurt</button></div>`
    : `<div><div class="lbl">Encounter</div><div class="who" style="color:var(--fg)">${L.length} deelnemers klaar</div></div>
       <div class="bar">${undoBtn}<button class="btn primary" id="start" ${L.length ? "" : "disabled"}>Start gevecht</button></div>`;
  $("#order").innerHTML = L.map((c) => row(c, S)).join("")
    || `<li class="hint" style="padding:20px;text-align:center">Nog niemand aan tafel. Voeg hieronder spelers en monsters toe.</li>`;
  $("#resetbar").innerHTML = ui.confirmReset
    ? `<div class="confirm">Alles wissen?<button class="btn small primary" id="reset-yes">Ja, wis encounter</button><button class="btn small" id="reset-no">Annuleer</button></div>`
    : `${S.list.some((c) => c.kind === "lair") ? "" : `<button class="btn small" id="addlair">+ Lair actions (init 20)</button>`}${S.list.length ? `<button class="btn small ghost" id="reset">Encounter wissen</button>` : ""}${S.round ? `<button class="btn small ghost" id="stop">Gevecht stoppen</button>` : ""}
       ${S.sample ? `<p class="note">De deelnemers hierboven zijn voorbeelden. Wis ze en voeg je eigen groep toe.</p>` : ""}`;
}

export function paintParty() {
  const el = $("#party-panel");
  const at = new Set(app.S.list.filter((c) => c.pid).map((c) => c.pid));
  if (!app.party.length) {
    el.innerHTML = `<p class="hint">Nog geen vaste party. Spelers die je toevoegt met "Ook opslaan in vaste party" komen hier, inclusief geïmporteerde sheets. HP, spell slots en resources lopen dan door van gevecht naar gevecht tot een rust.</p>`;
    return;
  }
  el.innerHTML = `<div>${app.party.map((m) => {
    const sl = m.casting && m.casting.slots.length ? " · slots " + m.casting.slots.map((x) => `${n0(x.left)}/${n0(x.max)}`).join(" ") : "";
    const rs = (m.res || []).map((r) => ` · ${esc(r.n)} ${n0(r.left)}/${n0(r.max)}`).join("");
    return `<div class="pm"><div><div class="pn">${esc(m.name)}</div><div class="pi">${m.sheet && m.sheet.cls ? esc(m.sheet.cls) + " · " : ""}${m.ac ? `AC ${n0(m.ac)} · ` : ""}${m.max ? `HP ${n0(m.hp)}/${n0(m.max)}${m.temp ? ` +${n0(m.temp)}` : ""}` : ""}${sl}${rs}</div></div>
      <div class="pc">${at.has(m.pid) ? `<span class="here">aan tafel</span>` : `<input data-pinit="${esc(m.pid)}" type="number" inputmode="numeric" placeholder="init" aria-label="Initiative ${esc(m.name)}" value="${esc(ui.partyInit[m.pid] ?? "")}"><button type="button" class="btn small" data-proll="${esc(m.pid)}">Rol</button>`}
        <button type="button" class="link" data-pdel="${esc(m.pid)}">Uit party</button></div></div>`;
  }).join("")}</div>
    <div class="bar"><button type="button" class="btn small" id="p-rollall">Rol voor iedereen</button><button type="button" class="btn primary" id="p-add">Party aan tafel zetten</button></div>
    <div class="bar"><button type="button" class="btn small" id="p-short">Short rest</button><button type="button" class="btn small" id="p-long">Long rest</button></div>
    <p class="hint">Rust geldt voor de hele party, ook wie aan tafel zit. Long rest: volle HP, slots en resources. Short rest: resources met "per short rest".</p>`;
}

export function paintLog() {
  const el = $("#logwrap");
  const L = app.S.log || [];
  const items = !ui.logOpen ? "" : [...L].reverse().map((e) => {
    if (e.type === "round") return `<li class="lg-round">${esc(e.msg)}</li>`;
    if (e.type === "turn") return `<li class="lg-turn">${esc(e.msg)}</li>`;
    return `<li class="lg"><span class="lg-meta">R${n0(e.r) || "–"}${e.turn ? ` · beurt ${esc(e.turn)}` : ""}</span>
      <span class="lg-msg">${esc(e.msg)}</span>
      ${e.why ? `<span class="lg-why">${esc(e.why)}</span>` : ""}
      ${ui.editLog === e.id ? `<input class="lg-in" data-lognote="${esc(e.id)}" value="${esc(e.note || "")}" placeholder="Waarom? bijv. Fireball van Wolfim" aria-label="Reden">`
        : e.note ? `<button class="lg-note" data-logedit="${esc(e.id)}">${esc(e.note)}</button>` : `<button class="link lg-add" data-logedit="${esc(e.id)}">+ reden</button>`}</li>`;
  }).join("");
  el.innerHTML = `<details class="logbox" id="logbox" ${ui.logOpen ? "open" : ""}><summary><span>Logboek</span> <span class="hint">${L.filter((e) => !e.type).length} gebeurtenissen</span></summary>
    ${L.length ? `<div class="bar" style="margin:8px 0"><button class="btn small" id="logcopy">Kopieer als tekst</button></div><ol class="lglist">${items}</ol>`
      : `<p class="hint">Nog niets gebeurd. Schade, condities, spells, death saves en beurten verschijnen hier automatisch, met ronde en oorzaak.</p>`}</details>`;
  if (ui.editLog) { const i = el.querySelector(".lg-in"); if (i) i.focus(); }
}
