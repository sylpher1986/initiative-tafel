import { test } from "node:test";
import assert from "node:assert/strict";
import { stillMine, claimTab, TAB_KEY } from "../js/tablock.js";

// gedeelde localStorage van één browser; elk tabblad heeft zijn eigen window/document (EventTarget)
function browser() {
  const m = new Map();
  return {
    ls: { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) },
    tab: () => {
      const win = new EventTarget(), doc = new EventTarget();
      doc.visibilityState = "visible";
      return { win, doc };
    },
  };
}
const storageEv = (key) => Object.assign(new Event("storage"), { key });

test("stillMine: eigen id, ander id, leeg of onleesbaar", () => {
  assert.equal(stillMine(JSON.stringify({ id: "a" }), "a"), true);
  assert.equal(stillMine(JSON.stringify({ id: "b" }), "a"), false);
  assert.equal(stillMine(null, "a"), true, "gewist (localStorage.clear): niet stoppen");
  assert.equal(stillMine("{kapot", "a"), true);
  assert.equal(stillMine(JSON.stringify({ id: 5 }), "a"), true, "rare waarde telt niet als een ander tabblad");
});

test("nieuwste tabblad wint: het oude stopt bij het storage-event, één keer", () => {
  const b = browser(), A = b.tab(), B = b.tab();
  let lostA = 0, lostB = 0;
  const okA = claimTab(() => lostA++, { ls: b.ls, ...A, now: 1 });
  assert.equal(okA(), true);
  const okB = claimTab(() => lostB++, { ls: b.ls, ...B, now: 2 });
  A.win.dispatchEvent(storageEv(TAB_KEY)); // de browser stuurt het event alleen naar de andere tabbladen
  assert.equal(lostA, 1);
  assert.equal(okA(), false, "gestopt blijft gestopt");
  assert.equal(okB(), true);
  A.win.dispatchEvent(storageEv(TAB_KEY));
  assert.equal(lostA, 1, "onLost maar één keer");
  assert.equal(lostB, 0);
});

test("event gemist (bevroren tabblad): de volgende opslag-check of zichtbaar worden merkt het alsnog", () => {
  const b = browser(), A = b.tab(), B = b.tab();
  let lostA = 0;
  const okA = claimTab(() => lostA++, { ls: b.ls, ...A, now: 1 });
  claimTab(() => {}, { ls: b.ls, ...B, now: 2 });
  assert.equal(lostA, 0, "nog geen event gezien");
  A.doc.dispatchEvent(new Event("visibilitychange"));
  assert.equal(lostA, 1);
  assert.equal(okA(), false);

  const C = b.tab();
  let lostC = 0;
  const okC = claimTab(() => lostC++, { ls: b.ls, ...C, now: 3 });
  claimTab(() => {}, { ls: b.ls, ...b.tab(), now: 4 });
  assert.equal(okC(), false, "check vóór het schrijven stopt het tabblad");
  assert.equal(lostC, 1);
});

test("bfcache: terug via de knop Vorige telt alleen bij persisted", () => {
  const b = browser(), A = b.tab();
  let lostA = 0;
  claimTab(() => lostA++, { ls: b.ls, ...A, now: 1 });
  claimTab(() => {}, { ls: b.ls, ...b.tab(), now: 2 });
  A.win.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: false }));
  assert.equal(lostA, 0);
  A.win.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
  assert.equal(lostA, 1);
});

test("tegelijk geclaimd: alleen het tabblad dat niet de laatste schrijver is stopt", () => {
  const b = browser(), A = b.tab(), B = b.tab();
  let lostA = 0, lostB = 0;
  claimTab(() => lostA++, { ls: b.ls, ...A, now: 1 });
  claimTab(() => lostB++, { ls: b.ls, ...B, now: 1 });
  // beide events komen pas daarna binnen: B ziet het event van A's claim, maar de huidige waarde is van B
  B.win.dispatchEvent(storageEv(TAB_KEY));
  A.win.dispatchEvent(storageEv(TAB_KEY));
  assert.equal(lostB, 0);
  assert.equal(lostA, 1);
});

test("andere sleutels negeren; geen localStorage = geen bewaking", () => {
  const b = browser(), A = b.tab();
  let lostA = 0;
  claimTab(() => lostA++, { ls: b.ls, ...A, now: 1 });
  b.ls.setItem(TAB_KEY, JSON.stringify({ id: "ander" }));
  A.win.dispatchEvent(storageEv("it-room"));
  assert.equal(lostA, 0, "event voor een andere sleutel");
  A.win.dispatchEvent(storageEv(null)); // localStorage.clear() in een ander tabblad
  assert.equal(lostA, 1);

  const kapot = { getItem() { throw new Error("geblokkeerd"); }, setItem() { throw new Error("geblokkeerd"); } };
  const ok = claimTab(() => assert.fail("mag niet stoppen"), { ls: kapot, ...b.tab(), now: 1 });
  assert.equal(ok(), true);
});
