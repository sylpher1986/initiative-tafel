# Werkpakketten Initiative

Actieve WP's voor Kev’s Inn itiative (`/initiative/`). Index en sjabloon: `README.md`.

## WP76 · Initiative-bugs: foutbalk, monster-hint, mini-log · omvang S — Klaar voor uitvoering
- Roadmap/backlog: K2, K1, K3 (`docs/BACKLOG.md`)
- Doel en scope: drie losse bugs die de DM of spelers aan tafel zien, in één patch. Buiten scope: een foutbalk op het spelersscherm (heeft er geen; niet toevoegen), andere teksten van de foutbalk, K6/K7.
- Functionele eisen:
  - **K2**: na "Oude wissen en starten" (`ui.oldGo === "drop"`) telt het initiative-paneel alleen de monsters die blijven. Dat geldt voor het aantal in de monster-hint (`init.ini.monFixed`, `init.ini.kept`), voor `fresh` (Houden/Opnieuw rollen) en voor de knop "Verrast: monsters" (uit als er geen blijvende monsters zijn). Bij "Toch starten" (`keep`) of zonder oude monsters: ongewijzigd.
  - **K1**: de rode foutbalk toont alleen fouten van de eigen app. Fouten uit browserextensies (`webkit-masked-url://`, `safari-web-extension://`, `chrome-extension://`, `moz-extension://`, of een bestand of stack van een andere origin) gaan naar `console.warn`. "Script error." zonder bestand: niet tonen. Een rejection zonder stack: wel tonen. Geen tekstwijziging.
  - **K3**: de mini-log van het spelersscherm somt toegevoegde condities op zoals weggevallen ("Poisoned and Prone", NL "Poisoned en Prone"), niet met komma's.
- Technische uitwerking:
  - K2: `paintInit`/`monRollHtml` in `js/ui/render.js`. Bepaal de monsterlijst één keer: bij `ui.oldGo === "drop"` zonder `oldMons(app.S)` (`js/rules/fight.js`), en gebruik die voor `mons`, `fresh` en de disabled-check van "Verrast". Liefst een kleine pure helper in `js/rules/fight.js` (bijv. `keptMons(S, drop)`) met een test; render blijft zonder bijwerkingen.
  - K1: de inline foutvanger in `pages/initiative.html` (± r. 16–26). Pure `isOwnError(file, stack, own = location.origin)` als losse functie die de test kan inlezen: bijv. in een klein bestand dat `tools/pages.mjs` inline plaatst, of als functie in het script die `tests/errfilter.test.js` uit de HTML haalt en evalueert. Kies het eenvoudigste dat de syntaxcheck en paginatests heel laat. Daarna `node tools/pages.mjs`.
  - K3: `js/playerview.js` (± r. 383): `add.join(", ")` vervangen door de opsomming uit `js/i18n` (`list`, dezelfde die een array-param in `t()` gebruikt). Geen nieuwe sleutel nodig; als dat toch nodig blijkt, dan een sleutel naast `player.log.gone` in `locales/src/{nl,en}/player.js` en `node tools/i18n-build.mjs`.
- Relevante besluiten: `docs/DECISIONS.md` → "Techniek", "Meertaligheid (geldt voor elke tool)", "Initiative en beurten" (GV5/GV7), "Spelersscherm".
- Afhankelijk van: geen.
- Acceptatiecriteria:
  - `tests/errfilter.test.js`: `webkit-masked-url://hidden/`, `safari-web-extension://…`, `chrome-extension://…`, `moz-extension://…`, andere origin → niet tonen; eigen origin (bestand of stack) → tonen; rejection zonder stack → tonen; "Script error." zonder bestand → niet tonen.
  - Test voor K2: lijst met 2 oude en 1 nieuw monster → bij drop telt de hint 1, bij keep 3; alleen oude monsters en drop → "Verrast: monsters" uit.
  - `tests/playerview.test.js`: twee toegevoegde condities geven een opsomming (NL en EN); één conditie ongewijzigd.
  - `npm test` volledig groen. Browsercheck: nieuw scenario `wp76` (oude monsters → Start → "Oude wissen en starten" → paneel toont het juiste aantal) plus `initp` en `speler`; `--lang=en` voor `speler`.
  - Senior developer reviewt de diff; geen UX- of vertaalagent nodig (geen nieuwe tekst, geen keuze tussen opties).
- Volgorde: eerst (vóór WP77 en WP78).
- Versie: Initiative patch (2.18.0 → 2.18.1 als dit de eerstvolgende release is).
- Aandachtspunten en risico's: de foutvanger draait vóór alle modules en zonder build; houd hem ES5-achtig en klein. Een te strenge filter verbergt echte fouten: liever één keer te veel tonen dan een eigen fout missen.

## WP77 · pdf.js als Worker en geminificeerd · omvang M — Klaar voor uitvoering
- Roadmap/backlog: K4, K5 (`docs/BACKLOG.md`)
- Doel en scope: de PDF-import (D&D Beyond-sheet) laat de hoofdthread vrij en de pdf.js-download wordt kleiner. Buiten scope: een andere pdf.js-versie dan 3.11.174 (alleen met reden, dan in `docs/DECISIONS.md` vastleggen), wijzigingen aan `parseDdbFields`.
- Functionele eisen:
  - **K4**: pdf.js parset in een echte Web Worker; de UI blijft tijdens de import reageren. Import online en offline werkt als nu.
  - **K5**: de min-builds (`pdf.min.js`, `pdf.worker.min.js`) van dezelfde versie, ongewijzigd uit een officiële bron, met licentie en herkomst in `vendor/pdfjs/README.md`.
- Technische uitwerking:
  - K4: `js/ddb.js` (`pdfjsReady`, r. 60–80): het worker-script niet meer als `<script>` laden, alleen `pdf.js` laden en `GlobalWorkerOptions.workerSrc` laten verwijzen; controleren dat pdf.js geen "fake worker" valt (bijv. via `pdfjsLib`-waarschuwing of een check in de browsercheck).
  - K5: bron zoeken binnen de netwerkbeperking (npm en cdnjs waren eerder niet bereikbaar; ook in de sessie van 31-10 gaf npm een netwerkfout). Kandidaat: de git-historie van `github.com/mozilla/pdfjs-dist` (`build/pdf.min.js`), die via git wel bereikbaar is; de tag v3.11.174 staat daar niet als tag, dus de commit van die versie zoeken en de bestanden tegen de release vergelijken. Lukt geen ongewijzigde min-build: K5 open laten met de reden in de backlog en alleen K4 opleveren.
  - `sw.js`: bij een bestandswissel een nieuwe map of naam én een nieuwe `VENDOR`-cachenaam en `VENDOR_ASSETS`; oude pdf.js-cache opruimen zoals de bestaande logica doet.
- Relevante besluiten: `docs/DECISIONS.md` → "Techniek" (TS1: pdf.js zelf gehost), "Spelers en D&D Beyond", "Opslag en data".
- Afhankelijk van: geen.
- Acceptatiecriteria:
  - `npm test` volledig groen (incl. de test op `sw.js`/versies en de vendor-bestanden).
  - Browsercheck `wp43` (aangepast: nieuwe cachenaam en bestandsnamen; online en offline import) en `pcform`. Nieuw scenario `wp77`: tijdens de import reageert de pagina (bijv. een `requestAnimationFrame`-teller blijft lopen met CPU-throttling via CDP) en er draait een echte Worker.
  - Meting vóór en na (importtijd en langste blokkade van de hoofdthread, met throttling) in het eindrapport. De handcheck op een oudere iPad door Michiel komt onder "Operationeel" in de backlog.
  - Senior developer reviewt de diff; geen UX- of vertaalagent nodig.
- Volgorde: na WP76.
- Versie: Initiative patch (2.18.x). `sw.js` verandert, dus ook het Maps-scenario `maps` meedraaien als de install- of opruimlogica verandert, niet bij alleen een nieuwe cachenaam.
- Aandachtspunten en risico's: oudere Safari en Workers met `importScripts`/module-varianten; een bestaande installatie moet bij de update de nieuwe cache krijgen zonder dat de app-update vastloopt (best effort zoals nu, `sw.js` r. 216).
