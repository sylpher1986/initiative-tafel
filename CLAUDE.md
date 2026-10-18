# Initiative Tafel: werkafspraken

Initiative/encounter tracker voor D&D 5e (2014) van Michiel. Eén DM, aan tafel op telefoon of tablet.
Live: https://initiative-tafel.ft4mgzj72j.workers.dev (Cloudflare Workers, publiceert automatisch bij push naar `main`).

## Communicatie
- Nederlands, pragmatisch en technisch direct. Teksten in de app zijn Nederlands; D&D-termen blijven Engels (Concentrating, Recharge, Legendary actions).
- Michiel werkt vaak vanaf zijn telefoon: geef instructies die zonder laptop uitvoerbaar zijn.

## Techniek
- Geen build-stap, geen dependencies: gewone ES-modules die de browser direct laadt. Voeg geen framework of bundler toe zonder overleg.
- Spelregels staan puur en testbaar in `js/rules/` (geen DOM). UI in `js/ui/`. Toestand, undo en logboek in `js/state.js`.
- Regels-functies passen een deelnemer aan en geven `{ msgs, why }` terug (meldingen en logboek-oorzaken).
- Render past nooit data aan. UI-toestand (open kaart, panelen, schade-paneel) staat in `ui` in `js/ui/render.js` en hoort niet in undo/opslag.
- Data lokaal in IndexedDB (`js/storage.js`). Export/import als JSON met `format`/`version` (`js/backup.js`); bij een formaatwijziging: versie ophogen en een migratie toevoegen.
- Alles uit een bestand of import is onbetrouwbaar: opschonen (`cleanCombatant`, `sanitizeOwn`) en altijd `esc()` bij HTML.

## Twee vaste reviewers (verplicht)
Bij elk nieuw idee of elke wijziging kijken twee rollen mee. Waar mogelijk als **aparte agent** die het werk niet zelf maakte, zodat het werk zichzelf niet beoordeelt.

**Senior UX-designer: vóór het bouwen**
- Bekijkt elk nieuw idee vanuit het gebruik aan tafel: één DM, telefoon in de hand, snel, soms zonder internet.
- Zet minstens twee opties naast elkaar, kiest de meest geschikte en zegt waarom (aantal tikken, duimbereik, tikdoelen ≥ 44 px, leesbaarheid, wat er weg kan).
- Maakt bij grotere wijzigingen eerst een schets of mockup ter goedkeuring.
- Bewaakt consistentie met de bestaande keuzes hieronder.

**Senior developer: na het bouwen, vóór de push**
- Test de logica: klopt het met de 5e 2014-regels, randgevallen (0 HP, dood, lege lijst, undo, import van oude of rare data), en dekken de tests het af?
- Kiest de meest efficiënte en eenvoudigste oplossing: geen dubbele code, geen onnodig werk per tik, regels puur in `js/rules/`, render zonder bijwerkingen.
- Controleert veiligheid (escapen, opschonen van import) en dat bestaande functionaliteit niet verloren gaat.
- Rapporteert kort wat er gevonden en verbeterd is.

Meld bij oplevering in één of twee regels wat beide reviewers vonden en besloten.

## Bij elke wijziging
1. `npm test` (Node 18+, geen installatie nodig) en nieuwe regels-logica krijgt een test.
2. Controleer in een browser op 320, 360 en 390 px breed: geen horizontaal scrollen. Ook licht en donker.
3. Verhoog de versie in `js/version.js` én `sw.js` (de test bewaakt dat ze gelijk zijn), anders zien geïnstalleerde apps de update niet. Schema: `1.0.x` kleine aanpassingen, `1.x.0` grotere aanpassingen, `x.0.0` volledig nieuwe functionaliteit. De app toont het nummer onderaan Instellingen.
4. Commit in het Nederlands, push naar `main`.

## Gemaakte keuzes
- Regels: D&D 5e **2014**. Monsters: alle 322 SRD 5.1-monsters (CC-BY-4.0, via Open5e) in `data/monsters.json`. Geen niet-SRD content in de repo.
- Spelers: handmatig of via D&D Beyond PDF-export (formuliervelden, `js/ddb.js`).
- Twee modi: **Voorbereiden** (toevoegen, party, instellingen) en **Gevecht** (alleen lijst + beurtbalk). De modus volgt het gevecht (`ui.mode = null`), de DM kan altijd wisselen. In Gevecht voegt de **+** halverwege monsters toe; wie vóór de actieve beurt invoegt, doet pas volgende ronde mee.
- Gevechtsweergave: compacte kaarten, **maar één kaart tegelijk open** (standaard wie aan de beurt is); beurtbalk vast onderaan; schade via cijferpaneel.
- AoE via de knop **AoE** in de beurtbalk: één schadeworp, per doel save (Gefaald / Geslaagd ½ / 0 voor Evasion) en Normaal/Resist/×2/Immuun. Volgorde volgens PHB: eerst de save, daarna resistance/vulnerability (27 → 13 → 6). Resist/immuun komt automatisch uit het statblock bij een onvoorwaardelijke regel; voorwaardelijke regels ("from nonmagical attacks") alleen als hint. Spelers hebben (nog) geen opgeslagen resistances: handmatig aantikken. Regels in `js/rules/aoe.js`.
- Lettertypes: Alegreya SC (koppen) en Alegreya Sans (tekst), zelf meegeleverd in `fonts/` als latin-subset woff2 (OFL). Geen externe font-diensten; een nieuw gewicht = bestand toevoegen + `@font-face` + `sw.js`.
- Hosting: Cloudflare Workers (statische assets via `wrangler.jsonc`, uitsluitingen in `.assetsignore`). Gekozen omdat later serverfuncties nodig zijn voor AI (API-sleutel mag nooit in de browser).
- Fase 1 is local-first zonder accounts. Sync/login (bijv. Supabase) pas in fase 2.

Zie `ROADMAP.md` voor wat er nog openstaat.
