// Alle gebruikersacties. Knoppen dragen data-a="naam" (rij-acties) of een id (algemene acties).
import { $, esc, n0, toast, toastHtml, show } from "./util.js";
import { app, because, addWhy, undo, historySize, saveLairs, saveParty, saveLibrary, resetBaseline } from "../state.js";
import { render, ui, openId, paintLog, paintParty, paintQadd } from "./render.js";
import { showSB, showSheet, doRoll } from "./statblock.js";
import { findMon, allMonsters, parseMonsterFile, filterMonsters } from "../data/monsters.js";
import { d, mod, sgn, uid, rollExpr, HD_RE, avgExpr } from "../rules/dice.js";
import { step, startCombat, makeDur, parseInit } from "../rules/turns.js";
import * as R from "../rules/combat.js";
import { castInfo, legInfo, rcInfo, pickList, CONC_SPELLS, cleanSpell } from "../rules/spells.js";
import { logText } from "../log.js";
import { readSheetPdf } from "../ddb.js";
import { buildExport, parseImport } from "../backup.js";

/** Fx uit de regels: meldingen tonen en oorzaken doorgeven aan het logboek */
const apply = (fx) => { if (!fx) return; addWhy(fx.why); show(fx); };

/* ---------- monsters toevoegen ---------- */
/** initmode: "each" (per monster rollen), "group" (één worp) of "fixed" (initiative = fixed, bijv. al aan tafel gerold) */
export function addMonsters(name, n, hpmode, initmode, silent, fixed = null) {
  const S = app.S, m = findMon(name);
  if (!m) return;
  const dx = mod(m.ab ? m.ab[1] : m.dexScore || 10);
  // doornummeren vanaf het hoogste bestaande nummer, zodat "Goblin 2" na verwijderen niet dubbel ontstaat
  const nums = S.list.filter((c) => c.ref === name).map((c) => { const x = c.name.match(/ (\d+)$/); return x ? +x[1] : 1; });
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  const set = initmode === "fixed" && Number.isFinite(fixed);
  const group = initmode === "group" ? d(20) : null;
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = set ? undefined : group ?? d(20);
    let hp = m.hp;
    if (hpmode === "roll" && m.hd) { const x = rollExpr(m.hd); if (x) hp = Math.max(1, x.total); }
    const label = n > 1 || nums.length ? `${m.n} ${next + i}` : m.n;
    const c = { id: uid(), name: label, kind: "monster", ref: m.n, init: set ? fixed : r + dx, roll: r, dex: dx, ac: parseInt(m.ac) || 10, hp, max: hp, cond: [], ...legInfo(m), rc: rcInfo(m), casting: castInfo(m) };
    S.list.push(c); out.push(c);
    because(`${set ? "initiative ingevuld" : `d20 [${r}] ${sgn(dx)}`}${group !== null ? ", groepsworp" : ""}${hpmode === "roll" ? `, HP gerold (${m.hd})` : ""}`, c.id);
  }
  if (!silent) {
    S.sample = false;
    toastHtml(out.map((c) => `${esc(c.name)}: ${c.roll === undefined ? "initiative" : `d20 [${c.roll}] ${sgn(c.dex)} =`} <b>${c.init}</b>`).join("<br>"));
  }
}

/** Vult ontbrekende velden aan bij deelnemers uit oudere versies of imports */
export function normalize(c) {
  c.cond = c.cond || [];
  if (c.kind === "lair") { if (!c.key) c.key = c.name; return; }
  if (!c.ref) return;
  const m = findMon(c.ref);
  if (c.la === undefined && c.lr === undefined) Object.assign(c, legInfo(m));
  if (c.rc === undefined) c.rc = rcInfo(m);
  if (c.casting === undefined) c.casting = castInfo(m);
}

/* ---------- acties per deelnemer: (c, knop, rij-element) ---------- */
const row = {
  sb: (c) => showSB(c.ref, c.name),
  sheet: (c) => showSheet(c),
  del(c) {
    if (c.kind !== "lair" && ui.confirmDel !== c.id) { ui.confirmDel = c.id; return; }
    const S = app.S; S.list = S.list.filter((x) => x !== c); if (S.active === c.id) S.active = null; ui.confirmDel = null; ui.panel = null;
  },
  open(c) {
    const isOpen = openId() === c.id;
    ui.open = isOpen ? "" : c.id; ui.panel = null; ui.confirmDel = null; ui.castPick = null;
    return "scroll";
  },
  panel(c, b) { ui.panel = ui.panel === b.dataset.p ? null : b.dataset.p; ui.confirmDel = null; },
  "sheet-open"(c, b) { ui.sheet = { id: c.id, kind: b.dataset.kind, val: "", mode: 1 }; },
  react(c) { c.reaction = !c.reaction; },
  dropconc(c) { apply(R.dropConc(c, "beëindigd")); },
  topty(c) { const ex = app.party.find((m) => m.name.toLowerCase() === c.name.toLowerCase()); c.pid = ex ? ex.pid : uid(); toast(`${c.name} staat nu in de vaste party.`); },
  "ds-roll": (c) => apply(R.rollDs(c)),
  "ds-crit": (c) => apply(R.critAtZero(c)),
  "cast-reset"(c) {
    c.casting.slots.forEach((x) => (x.left = x.max));
    c.casting.daily.forEach((g) => g.items.forEach((x) => (x.left = x.max)));
    (c.res || []).forEach((x) => (x.left = x.max));
  },
  "lair-add"(c, b, li) {
    const n = li.querySelector('[data-f="la-n"]').value.trim(), t = li.querySelector('[data-f="la-t"]').value.trim();
    if (!n || !t) { toast("Vul een naam en een effect in."); return false; }
    app.lairs[c.key] = [...(app.lairs[c.key] || []), { n, t }]; saveLairs();
  },
  "lair-del"(c, b) { app.lairs[c.key].splice(+b.dataset.i, 1); saveLairs(); },
  "lair-use"(c, b) { c.last = app.lairs[c.key][+b.dataset.i].n; },
};

/* ---------- schade-paneel (data-sk) ---------- */
function sheetKey(k, v) {
  const s = ui.sheet;
  if (!s) return;
  if (k === "close") { ui.sheet = null; return; }
  if (k === "d") { if (s.val.length < 4) s.val = (s.val + v).replace(/^0+/, ""); return; }
  if (k === "back") { s.val = s.val.slice(0, -1); return; }
  if (k === "clear") { s.val = ""; return; }
  if (k === "kind") { s.kind = v; return; }
  if (k === "mode") { s.mode = +v; return; }
  if (k === "apply") {
    const c = app.S.list.find((x) => x.id === s.id), n = parseInt(s.val) || 0;
    if (!c || !n) return;
    apply(s.kind === "dmg" ? R.applyDamage(c, n, s.mode) : s.kind === "heal" ? R.heal(c, n) : R.giveTemp(c, n));
    const before = { dmg: `−${Math.floor(n * s.mode)}`, heal: `+${n}`, thp: `+${n} temp` }[s.kind];
    ui.sheet = null;
    return { undoToast: `${c.name} ${before} HP → ${c.hp}/${c.max}${c.temp ? ` (+${c.temp} temp)` : ""}` };
  }
}

/** Klikken op bolletjes, condities en spell-keuzes (herkend aan data-attributen) */
function rowData(c, b) {
  const ds = b.dataset;
  const toggle = (o, i) => { o.left = i < o.left ? o.left - 1 : Math.min(o.max, o.left + 1); };
  if (ds.cond) {
    const k = ds.cond; c.cd = c.cd || {};
    if (c.cond.includes(k)) { c.cond = c.cond.filter((x) => x !== k); delete c.cd[k]; if (k === "Concentrating") c.concSpell = null; }
    else { c.cond = [...c.cond, k]; const e = makeDur(c, ui.condOpt[c.id] || {}, app.S.active); if (e) c.cd[k] = e; }
    return true;
  }
  if (ds.slot !== undefined || ds.daily !== undefined) {
    const o = ds.slot !== undefined ? c.casting.slots[+ds.slot] : (([g, i]) => c.casting.daily[g].items[i])(ds.daily.split(".").map(Number));
    const spend = +ds.i < o.left;
    toggle(o, +ds.i);
    ui.castPick = null;
    if (spend && ds.slot !== undefined && pickList(c, o.lvl).some((x) => x.conc)) ui.castPick = { id: c.id, lvl: o.lvl };
    if (spend && ds.daily !== undefined && CONC_SPELLS.has(cleanSpell(o.n))) apply(R.startConc(c, o.n.replace(/\(.*?\)/g, "").trim()));
    return true;
  }
  if (ds.pickspell !== undefined) { if (ds.conc) apply(R.startConc(c, ds.pickspell)); ui.castPick = null; return true; }
  if (ds.res !== undefined) {
    const o = c.res[+ds.res];
    if (ds.step) o.left = Math.max(0, Math.min(o.max, o.left + +ds.step)); else toggle(o, +ds.i);
    return true;
  }
  if (ds.rc !== undefined) { const r = c.rc[+ds.rc]; r.ready = !r.ready; return true; }
  if (ds.ds) { c.ds = c.ds || R.newDs(); const i = +ds.i; c.ds[ds.ds] = c.ds[ds.ds] === i + 1 ? i : i + 1; apply(R.checkDs(c)); return true; }
  if (ds.pip) { toggle(c[ds.pip], +ds.i); return true; }
  return false;
}

/* ---------- algemene acties (op id) ---------- */
const global = {
  "toast-undo"() { $("#toast").hidden = true; return global.undo(); },
  undo() { if (undo()) { ui.confirmReset = false; toast(`Ongedaan gemaakt${historySize() ? ` (nog ${historySize()} stappen terug)` : ""}.`); } },
  // na starten of stoppen volgt de modus weer het gevecht (ui.mode = null)
  start() { apply(startCombat(app.S)); ui.mode = null; },
  next() { apply(step(app.S, 1)); },
  prev() { apply(step(app.S, -1)); },
  stop() { app.S.round = 0; app.S.active = null; ui.mode = null; },
  qadd() { ui.qadd = { q: "", sel: null, n: 1, init: "roll", fix: "" }; },
  addlair() {
    const lm = app.S.list.find((x) => x.la);
    const key = lm ? "Lair: " + lm.ref : Object.keys(app.lairs)[0] || "Lair";
    app.S.list.push({ id: uid(), name: key, key, kind: "lair", init: 20, dex: -99, cond: [], last: null });
  },
  reset() { ui.confirmReset = true; },
  "reset-no"() { ui.confirmReset = false; },
  "reset-yes"() { app.S = { list: [], round: 0, active: null, sample: false }; ui.confirmReset = false; ui.mode = null; },
  sbclose() { $("#sbwrap").dataset.open = "false"; return false; },
};

export function scrollToCard(id, onlyIfHidden) {
  const el = id && document.querySelector(`.c[data-id="${CSS.escape(id)}"]`);
  if (!el) return;
  const r = el.getBoundingClientRect(), dock = $("#dock").getBoundingClientRect().top;
  if (onlyIfHidden && r.top >= 0 && r.bottom <= dock) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollBy({ top: r.top - 64, behavior: reduce ? "auto" : "smooth" });
}

export function onClick(e) {
  const sk = e.target.closest("[data-sk]");
  if (sk) {
    const res = sheetKey(sk.dataset.sk, sk.dataset.v);
    render();
    if (res && res.undoToast) toastHtml(`${esc(res.undoToast)} <button class="tundo" id="toast-undo">Ongedaan</button>`);
    return;
  }
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.roll) {
    const lab = b.dataset.label || b.closest(".entry")?.querySelector("i")?.textContent.replace(/\.$/, "");
    return doRoll(b.dataset.roll, lab, !!b.dataset.hit);
  }
  if (b.dataset.setmode) {
    ui.mode = b.dataset.setmode; ui.confirmReset = false;
    render();
    window.scrollTo({ top: 0 });
    return;
  }
  if (b.dataset.tab) {
    document.querySelectorAll(".tabs button").forEach((x) => x.setAttribute("aria-selected", x === b));
    document.querySelectorAll("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== b.dataset.tab));
    return;
  }
  if (b.id && global[b.id]) {
    if (global[b.id]() === false) return;
    if (["start", "next", "prev"].includes(b.id)) { ui.open = null; ui.panel = null; ui.castPick = null; }
    render();
    if (["start", "next", "prev"].includes(b.id)) scrollToCard(app.S.active);
    // focus in de dialog, maar niet op het zoekveld: dat zou op de telefoon meteen het toetsenbord openen
    if (b.id === "qadd") $("#qsheet .qsheet").focus();
    return;
  }
  const li = b.closest(".c");
  if (!li) return;
  const c = app.S.list.find((x) => x.id === li.dataset.id);
  if (!c) return;
  const fn = row[b.dataset.a];
  let res = fn ? fn(c, b, li) : rowData(c, b);
  if (res === false) return;
  if (fn === row.sb || fn === row.sheet) return;
  render();
  if (res === "scroll") scrollToCard(openId(), true);
}

export function onChange(e) {
  const t = e.target, f = t.dataset.f;
  const li = t.closest(".c");
  if (["cdur", "cab", "cdc"].includes(f)) {
    const o = (ui.condOpt[li.dataset.id] = ui.condOpt[li.dataset.id] || {});
    o[{ cdur: "dur", cab: "ab", cdc: "dc" }[f]] = t.value;
    return;
  }
  const c = li && app.S.list.find((x) => x.id === li.dataset.id);
  if (!c) return;
  if (f === "lairkey") { c.key = c.name = t.value; c.last = null; render(); }
  if (f === "init") { c.init = parseInt(t.value) || 0; render(); }
}

export function onKey(e) {
  if (ui.qadd && e.key === "Escape") { e.preventDefault(); closeQadd(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) { e.preventDefault(); ui.qadd = null; global.undo(); render(); return; }
  if (ui.sheet && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) {
    const k = /^\d$/.test(e.key) ? ["d", e.key] : e.key === "Backspace" ? ["back"] : e.key === "Escape" ? ["close"] : e.key === "Enter" ? ["apply"] : null;
    if (k) { e.preventDefault(); const res = sheetKey(...k); render(); if (res && res.undoToast) toastHtml(`${esc(res.undoToast)} <button class="tundo" id="toast-undo">Ongedaan</button>`); }
  }
}

export function onToggle(e) {
  const t = e.target;
  if (t.matches && t.matches("details[data-cast]")) { const id = t.closest(".c")?.dataset.id; if (id) t.open ? ui.openCast.add(id) : ui.openCast.delete(id); }
  if (t.id === "logbox" && ui.logOpen !== t.open) { ui.logOpen = t.open; paintLog(); }
}

/* ---------- formulieren: speler, monster, eigen monster ---------- */
let pendingSheet = null, selMon = "Goblin";

export function bindForms() {
  $("#f-pc").addEventListener("submit", (e) => {
    e.preventDefault();
    const max = parseInt($("#pc-hp").value) || 0;
    const manual = (() => {
      const sl = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => ({ lvl: l, max: parseInt($("#pc-sl" + l).value) || 0 })).filter((x) => x.max > 0).map((x) => ({ ...x, left: x.max, spells: "" }));
      return sl.length ? { slots: sl, daily: [] } : null;
    })();
    const sh = pendingSheet, nm = $("#pc-name").value.trim();
    let pid = null;
    if ($("#pc-party").checked) { const ex = app.party.find((m) => m.name.toLowerCase() === nm.toLowerCase()); pid = ex ? ex.pid : uid(); }
    const dex = parseInt($("#pc-dex").value) || 0;
    app.S.list.push({
      id: uid(), pid, name: nm, kind: "pc", init: parseInt($("#pc-init").value) || 0, dex, ac: parseInt($("#pc-ac").value) || 0, hp: max, max, cond: [],
      casting: manual || (sh && sh.casting ? structuredClone(sh.casting) : null), res: sh ? structuredClone(sh.res || []) : [], sheet: sh || null, initBonus: sh ? sh.initBonus : dex,
    });
    pendingSheet = null; $("#pc-sheetinfo").textContent = ""; app.S.sample = false;
    e.target.reset(); $("#pc-dex").value = 0; render(); $("#pc-name").focus();
  });
  $("#pc-roll").addEventListener("click", () => {
    const b = pendingSheet ? pendingSheet.initBonus : parseInt($("#pc-dex").value) || 0, r = d(20);
    $("#pc-init").value = r + b; toastHtml(`Initiative: d20 [${r}] ${sgn(b)} = <b>${r + b}</b>`);
  });
  $("#pc-pdf").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    $("#pc-sheetinfo").textContent = "Sheet wordt gelezen…";
    try {
      const h = await readSheetPdf(f);
      if (!h) { $("#pc-sheetinfo").textContent = "Geen D&D Beyond-formuliervelden gevonden. Is dit een PDF-export van D&D Beyond?"; return; }
      pendingSheet = h;
      $("#pc-name").value = h.name; $("#pc-ac").value = h.ac || ""; $("#pc-hp").value = h.max || ""; $("#pc-dex").value = h.dex;
      const sl = h.casting ? h.casting.slots.map((x) => `${x.lvl}e: ${x.max}`).join(", ") : "geen";
      $("#pc-sheetinfo").innerHTML = `<b>${esc(h.name)}</b> geladen (${esc(h.cls)}). Spell slots: ${esc(sl)}${h.res.length ? `. Resources: ${esc(h.res.map((r) => r.n + " " + r.max).join(", "))}` : ""}. Vul initiative in of tik op Rol.`;
    } catch { $("#pc-sheetinfo").textContent = "De PDF-lezer kon niet laden of het bestand niet openen. Controleer je verbinding en probeer het opnieuw."; }
    e.target.value = "";
  });

  const renderMonList = () => {
    const f = filterMonsters(allMonsters(), $("#mon-q").value, selMon), L = f.L;
    selMon = f.sel; // UI-toestand, geen data: de selectie volgt wat zichtbaar is
    const btn = $("#mon-add");
    btn.disabled = !selMon;
    btn.textContent = selMon ? `${selMon} toevoegen` : "Kies een monster";
    $("#mon-list").innerHTML = L.map((m) => `<button type="button" data-pick="${esc(m.n)}" aria-pressed="${m.n === selMon}"><span>${esc(m.n)}${m.custom ? " · eigen" : ""}</span><span class="cr">CR ${esc(m.cr || "?")} · AC ${parseInt(m.ac) || "?"} · ${n0(m.hp) || "?"} HP</span></button>`).join("")
      || `<p class="hint" style="padding:10px">Niets gevonden. Voeg het toe onder "Eigen monster".</p>`;
  };
  bindForms.renderMonList = renderMonList;
  $("#mon-q").addEventListener("input", renderMonList);
  $("#mon-list").addEventListener("click", (e) => { const b = e.target.closest("[data-pick]"); if (!b) return; selMon = b.dataset.pick; renderMonList(); });
  $("#f-mon").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!selMon) { toast("Tik eerst een monster in de lijst aan."); return; }
    $("#mon-q").blur();
    addMonsters(selMon, Math.min(20, Math.max(1, parseInt($("#mon-n").value) || 1)), $("#mon-hpmode").value, $("#mon-initmode").value);
    render();
  });

  $("#f-custom").addEventListener("submit", (e) => {
    e.preventDefault();
    const hpIn = $("#cu-hp").value.replace(/\s/g, "");
    let hp = parseInt(hpIn), hd = null;
    if (/d/i.test(hpIn)) {
      if (!HD_RE.test(hpIn)) { toast("HP als getal (22) of als dobbelstenen (5d8 of 5d8+10)."); return; }
      hd = hpIn; hp = avgExpr(hpIn);
    }
    if (!(hp > 0)) { toast("Vul geldige HP in."); return; }
    const m = { n: $("#cu-name").value.trim(), cr: $("#cu-cr").value.trim(), ac: $("#cu-ac").value, hp, hd, dexScore: parseInt($("#cu-dex").value) || 10, text: $("#cu-text").value };
    if (!m.n) return;
    app.custom = [m, ...app.custom.filter((x) => x.n !== m.n)]; saveLibrary();
    e.target.reset(); selMon = m.n; $("#mon-q").value = ""; renderMonList();
    document.querySelector('[data-tab="mon"]').click(); toast(`${m.n} opgeslagen. Kies aantal en voeg toe.`);
  });

  const impStatus = () => {
    $("#imp-status").innerHTML = app.imported.length ? `${app.imported.length} geïmporteerde monsters actief. <button type="button" class="link" id="imp-clear">Import verwijderen</button>` : "";
  };
  bindForms.impStatus = impStatus;
  $("#imp-status").addEventListener("click", (e) => { if (e.target.id === "imp-clear") { app.imported = []; saveLibrary(); renderMonList(); impStatus(); } });
  $("#imp-file").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    let j;
    try { j = JSON.parse(await f.text()); } catch { toast("Dit bestand is geen geldige JSON. Kies het .json-bestand met monsters."); return; }
    const conv = parseMonsterFile(j);
    if (!conv.length) { toast("Geen monsters gevonden in dit bestand."); return; }
    const before = app.imported.length;
    const map = new Map(app.imported.map((m) => [m.n.toLowerCase(), m]));
    conv.forEach((m) => map.set(m.n.toLowerCase(), m));
    app.imported = [...map.values()]; saveLibrary(); renderMonList(); impStatus();
    toast(`${conv.length} monsters ingelezen, ${app.imported.length - before} nieuw.`);
    e.target.value = "";
  });
}

/* ---------- snel toevoegen tijdens het gevecht (+ in Gevecht-modus) ---------- */
function closeQadd() {
  ui.qadd = null; paintQadd();
  $("#qadd").focus();
}

export function bindQadd() {
  const el = $("#qsheet");
  // invoer: alleen het paneel bijwerken (geen volledige render), zodat het zoekveld focus houdt
  el.addEventListener("input", (e) => {
    const q = ui.qadd; if (!q) return;
    if (e.target.id === "q-q") q.q = e.target.value;
    else if (e.target.id === "q-fix") q.fix = e.target.value;
    else return;
    paintQadd();
  });
  el.addEventListener("click", (e) => {
    const q = ui.qadd; if (!q) return;
    const p = e.target.closest("[data-qpick]");
    if (p) { q.sel = p.dataset.qpick; paintQadd(); return; }
    const b = e.target.closest("[data-q]"); if (!b) return;
    const k = b.dataset.q;
    if (k === "close") { closeQadd(); return; }
    if (k === "n") q.n = Math.min(20, Math.max(1, q.n + +b.dataset.v));
    if (k === "init") q.init = b.dataset.v;
    if (k === "go") { qGo(); return; }
    paintQadd();
    if (k === "init" && q.init === "fixed") $("#q-fix").focus();
  });
  // Enter (zoekknop van het toetsenbord) voegt toe zodra er een monster gekozen is
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.target.id === "q-q" || e.target.id === "q-fix")) { e.preventDefault(); qGo(); }
  });
}

function qGo() {
  const q = ui.qadd; if (!q || !q.sel) return;
  const fix = parseInit(q.fix);
  if (q.init === "fixed" && fix === null) { $("#q-fix").focus(); return; }
  because("tijdens het gevecht toegevoegd");
  addMonsters(q.sel, q.n, "avg", q.init === "fixed" ? "fixed" : "each", false, fix);
  ui.qadd = null;
  render();
  $("#qadd").focus();
}

/* ---------- party-tab ---------- */
export function bindParty() {
  const panel = $("#party-panel");
  panel.addEventListener("input", (e) => { if (e.target.dataset.pinit) ui.partyInit[e.target.dataset.pinit] = e.target.value; });
  panel.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const rollFor = (m) => { const r = d(20), bo = m.initBonus ?? m.dex ?? 0; ui.partyInit[m.pid] = r + bo; return `${esc(m.name)}: d20 [${r}] ${sgn(bo)} = <b>${r + bo}</b>`; };
    const at = new Set(app.S.list.filter((c) => c.pid).map((c) => c.pid));
    if (b.dataset.proll) { toastHtml(rollFor(app.party.find((x) => x.pid === b.dataset.proll))); paintParty(); return; }
    if (b.dataset.pdel) {
      const m = app.party.find((x) => x.pid === b.dataset.pdel);
      if (b.dataset.sure) { app.party = app.party.filter((x) => x !== m); app.S.list.forEach((c) => { if (c.pid === m.pid) c.pid = null; }); saveParty(); render(); }
      else { b.dataset.sure = "1"; b.textContent = "Zeker? Tik nogmaals"; }
      return;
    }
    if (b.id === "p-rollall") { toastHtml(app.party.filter((m) => !at.has(m.pid)).map(rollFor).join("<br>") || "Iedereen zit al aan tafel."); paintParty(); return; }
    if (b.id === "p-add") {
      const todo = app.party.filter((m) => !at.has(m.pid));
      const missing = todo.filter((m) => ui.partyInit[m.pid] === undefined || ui.partyInit[m.pid] === "");
      if (missing.length) { toast(`Nog geen initiative voor: ${missing.map((m) => m.name).join(", ")}. Vul in of tik op "Rol voor iedereen".`); return; }
      because("party aan tafel gezet");
      todo.forEach((m) => {
        const c = structuredClone(m); delete c.pid;
        app.S.list.push({ ...c, id: uid(), pid: m.pid, kind: "pc", init: parseInt(ui.partyInit[m.pid]) || 0, cond: c.hp > 0 ? [] : ["Unconscious"], reaction: false });
        delete ui.partyInit[m.pid];
      });
      app.S.sample = false; toast(`${todo.length} speler${todo.length === 1 ? "" : "s"} aan tafel gezet.`); render(); return;
    }
    if (b.id === "p-short" || b.id === "p-long") {
      const long = b.id === "p-long";
      because(long ? "long rest" : "short rest");
      app.party.forEach((m) => R.restMember(m, long));
      app.S.list.forEach((c) => { if (c.pid) R.restMember(c, long); });
      saveParty(); toast(long ? "Long rest: HP, spell slots en resources hersteld." : "Short rest: short-rest resources hersteld."); render();
    }
  });
}

/* ---------- logboek ---------- */
export function bindLog() {
  const wrap = $("#logwrap");
  wrap.addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.logedit) { ui.editLog = b.dataset.logedit; paintLog(); return; }
    if (b.id === "logcopy") copyText(logText(app.S.log), "Logboek gekopieerd.", $("#logbox"));
  });
  const commitNote = (inp) => { const e = (app.S.log || []).find((x) => x.id === inp.dataset.lognote); if (e) e.note = inp.value.trim(); ui.editLog = null; render(); };
  wrap.addEventListener("keydown", (e) => {
    if (!e.target.dataset.lognote) return;
    if (e.key === "Enter") { e.preventDefault(); commitNote(e.target); }
    if (e.key === "Escape") { ui.editLog = null; paintLog(); }
  });
  wrap.addEventListener("focusout", (e) => { if (e.target.dataset.lognote && ui.editLog) commitNote(e.target); });
}

async function copyText(t, okMsg, box) {
  try { await navigator.clipboard.writeText(t); toast(okMsg); }
  catch {
    const ta = document.createElement("textarea");
    ta.value = t; ta.readOnly = true; ta.style.cssText = "width:100%;min-height:200px;margin-top:8px";
    box.appendChild(ta); ta.select();
    toast("Kopiëren lukte niet automatisch; de tekst staat geselecteerd.");
  }
}

/* ---------- opslag-tab: export en import ---------- */
export function bindBackup(afterImport) {
  const seg = $("#theme-seg");
  const showTheme = (mode) => seg.querySelectorAll("[data-theme-set]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.themeSet === mode));
  showTheme(window.itTheme?.get() ?? "system");
  seg.addEventListener("click", (e) => {
    const b = e.target.closest("[data-theme-set]");
    if (b && window.itTheme) showTheme(window.itTheme.set(b.dataset.themeSet));
  });
  const json = () => JSON.stringify(buildExport(app));
  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  $("#exp-file").addEventListener("click", () => {
    const blob = new Blob([json()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `initiative-tafel-${stamp()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast("Export gemaakt.");
  });
  $("#exp-copy").addEventListener("click", () => copyText(json(), "Export gekopieerd als tekst.", $("#data-panel")));

  let pending = null;
  const ask = (data) => {
    pending = data;
    const nMon = data.custom.length + data.imported.length, nLair = Object.keys(data.lairs).length;
    $("#imp-confirm").innerHTML = `<div class="confirmbox"><p style="margin:0">Deze export bevat <b>${data.party.length}</b> partyleden, <b>${data.S.list.length}</b> deelnemers aan tafel, <b>${nMon}</b> eigen/geïmporteerde monsters en <b>${nLair}</b> lairs.
      Importeren <b>vervangt</b> alles wat nu in de app staat.</p>
      <div class="bar"><button type="button" class="btn primary" id="imp-yes">Vervang en importeer</button><button type="button" class="btn small" id="imp-no">Annuleer</button></div></div>`;
  };
  const read = (text) => {
    try { ask(parseImport(JSON.parse(text))); }
    catch (err) { toast(err instanceof SyntaxError ? "Dit is geen geldige export (geen JSON)." : err.message); }
  };
  $("#imp-backup").addEventListener("change", async (e) => { const f = e.target.files[0]; if (f) read(await f.text()); e.target.value = ""; });
  $("#imp-text-go").addEventListener("click", () => { const t = $("#imp-text").value.trim(); if (t) read(t); });
  $("#imp-confirm").addEventListener("click", (e) => {
    if (e.target.id === "imp-no") { pending = null; $("#imp-confirm").innerHTML = ""; }
    if (e.target.id === "imp-yes" && pending) {
      Object.assign(app, { S: pending.S, party: pending.party, lairs: pending.lairs, custom: pending.custom, imported: pending.imported });
      pending = null; $("#imp-confirm").innerHTML = ""; $("#imp-text").value = "";
      afterImport();
      toast("Import klaar.");
    }
  });
}
