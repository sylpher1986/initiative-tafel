// 1.48.3: korte klassenamen botsen. `.dim` is de achtergrond van een paneel (`.sheet-wrap .dim`: absolute, inset 0);
// de grijze kamercode droeg dezelfde klasse en dekte na Stop met delen de helft van Instellingen af (eerder: `.lg`, WP17).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const files = ["index.html", "speler.html", ...readdirSync(new URL("../js/", import.meta.url), { recursive: true }).filter((f) => f.endsWith(".js")).map((f) => "js/" + f)];

test("klasse dim alleen op de paneel-achtergrond <div class=\"dim\" data-…>", () => {
  const bad = [];
  for (const f of files) read(f).split("\n").forEach((l, i) => {
    if (!/class/.test(l)) return;
    const rest = l.replace(/<div class="dim" data-[a-z-]+=/g, "");
    if (/["' ]dim["' ]/.test(rest) || /classList\.\w+\(\s*["']dim["']/.test(rest)) bad.push(`${f}:${i + 1}`);
  });
  assert.deepEqual(bad, []);
});

// Streng: ook een toekomstige .dim-x of een herhaling in een @media laat hem falen; dan bewust aanpassen.
test("CSS: .dim alleen als paneel-achtergrond", () => {
  const sel = [...read("css/app.css").replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]*)\{/g)].map((m) => m[1].trim()).filter((s) => /\.dim\b/.test(s));
  assert.deepEqual(sel, [".sheet-wrap .dim"]);
});
