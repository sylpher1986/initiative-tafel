# Werkpakketten Initiative

Actieve WP's voor Kev’s Inn itiative (`/initiative/`). Index en sjabloon: `README.md`.

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
- Volgorde: eerst (vóór WP78).
- Versie: Initiative patch (2.18.x). `sw.js` verandert, dus ook het Maps-scenario `maps` meedraaien als de install- of opruimlogica verandert, niet bij alleen een nieuwe cachenaam.
- Aandachtspunten en risico's: oudere Safari en Workers met `importScripts`/module-varianten; een bestaande installatie moet bij de update de nieuwe cache krijgen zonder dat de app-update vastloopt (best effort zoals nu, `sw.js` r. 216).
