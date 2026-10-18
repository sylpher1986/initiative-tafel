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

## Bij elke wijziging
1. `npm test` (Node 18+, geen installatie nodig) en nieuwe regels-logica krijgt een test.
2. Controleer in een browser op 320, 360 en 390 px breed: geen horizontaal scrollen. Ook licht en donker.
3. Verhoog `VERSION` in `sw.js`, anders zien geïnstalleerde apps de update niet.
4. Commit in het Nederlands, push naar `main`.

## Gemaakte keuzes
- Regels: D&D 5e **2014**. Monsters: alle 322 SRD 5.1-monsters (CC-BY-4.0, via Open5e) in `data/monsters.json`. Geen niet-SRD content in de repo.
- Spelers: handmatig of via D&D Beyond PDF-export (formuliervelden, `js/ddb.js`).
- Gevechtsweergave: compacte kaarten, **maar één kaart tegelijk open** (standaard wie aan de beurt is); beurtbalk vast onderaan; schade via cijferpaneel.
- Hosting: Cloudflare Workers (statische assets via `wrangler.jsonc`, uitsluitingen in `.assetsignore`). Gekozen omdat later serverfuncties nodig zijn voor AI (API-sleutel mag nooit in de browser).
- Fase 1 is local-first zonder accounts. Sync/login (bijv. Supabase) pas in fase 2.

Zie `ROADMAP.md` voor wat er nog openstaat.
