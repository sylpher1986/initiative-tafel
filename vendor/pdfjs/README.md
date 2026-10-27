# pdf.js 3.11.174 (TS1, 2.2.1)

Voor de PDF-import van D&D Beyond-sheets (`js/ddb.js`). Zelf gehost in plaats van via cdnjs, zodat er geen CDN meer is en de import offline werkt (`sw.js`, cache `VENDOR`).

- Bron: officiële release van Mozilla, `https://github.com/mozilla/pdf.js/releases/download/v3.11.174/pdfjs-3.11.174-dist.zip` (sha256 `ba1b54ba0d26618776c036e68d61ea20f76120a616251817b09fa133150da635`).
- Ongewijzigd overgenomen uit die zip: `build/pdf.js` → `pdf.js`, `build/pdf.worker.js` → `pdf.worker.js`, `LICENSE`. Geen source maps (de verwijzing onderaan de bestanden blijft staan; een browser haalt die alleen met de ontwikkelaarstools open).
- Licentie: Apache License 2.0 (`LICENSE`).
- Dezelfde versie als vóór TS1 via cdnjs, maar de niet-geminificeerde build: de release-zip bevat geen `.min.js` en npm/cdnjs zijn vanuit de bouwomgeving niet bereikbaar. Cloudflare comprimeert de bestanden bij verzending.

| Bestand | sha256 |
|---|---|
| `pdf.js` | `d83766f20a4c31fbce5a29d98789cdfbef781b147441da45be1d1079e8e0f81c` |
| `pdf.worker.js` | `e3f005b22146f290af16ac0dc16ab45f0df898173de1cc539d6e4092832da9d8` |
| `LICENSE` | `0d542e0c8804e39aa7f37eb00da5a762149dc682d7829451287e11b938e94594` |

Nieuwe versie: nieuwe bestanden hier, de hashes in deze tabel (`tests/wp43.test.js` controleert ze), en `VENDOR` in `sw.js` een nieuwe naam geven (anders blijft de oude in de cache).
