// WP76 (K1): de inline foutvanger in pages/initiative.html toont alleen fouten van de eigen app
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../pages/initiative.html", import.meta.url), "utf8");
const src = html.match(/function isOwnError\([\s\S]*?\n  \}\n/);
assert.ok(src, "isOwnError staat in de foutvanger");
const isOwnError = new Function(`${src[0]}; return isOwnError;`)();
const own = "https://kevs-inn.com";

test("foutvanger: extensies en andere origins niet tonen", () => {
  for (const f of ["webkit-masked-url://hidden/", "safari-web-extension://ABC/content.js", "chrome-extension://abc/inject.js",
    "moz-extension://abc/x.js", "https://ads.example.com/x.js", "https://kevs-inn.com.evil.io/x.js"]) {
    assert.equal(isOwnError(f, "", own), false, f);
  }
  assert.equal(isOwnError("", "sendMessage@webkit-masked-url://hidden/:1:2", own), false, "rejection met stack van een extensie");
  assert.equal(isOwnError("", "at x (chrome-extension://abc/a.js:1:1)", own), false);
});

test("foutvanger: eigen fouten wel tonen", () => {
  assert.equal(isOwnError("https://kevs-inn.com/js/main.js", "", own), true, "bestand eigen origin");
  assert.equal(isOwnError("", "TypeError: x\n    at f (https://kevs-inn.com/js/ui/render.js:12:3)", own), true, "stack eigen origin");
  assert.equal(isOwnError("", "", own), true, "rejection zonder stack");
  assert.equal(isOwnError("", "Error: kapot", own), true, "stack zonder adressen");
  assert.equal(isOwnError("", "f@webkit-masked-url://hidden/:1\ng@https://kevs-inn.com/js/a.js:2:1", own), true, "gemengd: eigen code in de stack");
});

test('foutvanger: "Script error." zonder bestand niet tonen', () => {
  assert.equal(isOwnError("", "", own, "Script error."), false);
  assert.equal(isOwnError("", null, own, "Script error"), false);
  assert.equal(isOwnError("", "", own, "Out of memory"), true, "andere melding zonder bestand: tonen");
  assert.equal(isOwnError("", 1, own), true, "stack geen string: geen fout in de vanger");
});

test("foutvanger: ook in de gegenereerde pagina's", () => {
  for (const p of ["initiative/index.html", "nl/initiative/index.html"]) {
    assert.match(readFileSync(new URL(`../${p}`, import.meta.url), "utf8"), /function isOwnError\(/, p);
  }
});
