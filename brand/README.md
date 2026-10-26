# Kev's Inn: bronbestanden logo

Aangeleverd door Michiel (23-10-2026). Niet gepubliceerd (`.assetsignore`); de app gebruikt een vereenvoudigd embleem (zonder d20): inline in de h1 en via `node tools/icons.mjs` in `icons/` (WP16).

- `kevs-inn-emblem.svg`: embleem (zeshoek, lantaarn, d20), alleen lijnen in goud #D4A448.
- `kevs-inn-logo.svg`: embleem + woordmerk + tagline. Woordmerk is `<text>` in Georgia, crèmekleurig: alleen voor een donkere ondergrond.

Plan en huisstijl: projectdoc `claude/huisstijl.md`.

## Huisstijl 2.0 (WP37, aangeleverd 26-10-2026)

Bronnen voor de homepage; niet gepubliceerd (`brand/` staat in `.assetsignore`). WP37 maakt hier de publieke varianten van.

- `hero-tavern.png`: hero-illustratie (taverne, lantaarn, raam op een kasteel), 1347×1168, ± 3,5 MB. Grootste breedte is dus 1347 (geen 1600-variant). Gemeten 26-10: WebP q78 800 px ± 83 kB, 1347 px ± 163 kB; AVIF q55 800 px ± 51 kB, 1347 px ± 109 kB. Mobiel blijft daarmee onder de 150 kB uit WP37.
- `tool-icons/*.svg`: lijn-iconen per tool, 64-grid, lijn 2.8, ronde uiteinden, `currentColor`. `initiative` (gekruiste zwaarden), `characters` (Innhabitants), `campaigns` (Inquests), `maps` (Inn the Grid), `ai-companion` (Innelligence), `lantern`, `inn-sign`. Op de homepage nu alleen `initiative` (besluit 26-10: alleen bestaande tools); de rest ligt klaar voor later.
