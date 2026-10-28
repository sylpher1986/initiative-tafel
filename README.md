# Kev’s Inn itiative

**English** · Initiative and encounter tracker for D&D 5e (2014 or 2024 rules, chosen per table), built for running combat at the table on a phone or tablet. Works offline, keeps all data in your browser, and comes in English and Dutch (`/initiative/`, `/nl/initiative/`; switch under Settings → Display). The rest of this README and the code comments are in Dutch.

**Nederlands** · Voorheen Initiative Tafel; onderdeel van Kev’s Inn ("Your home between adventures."). Initiative tracker voor D&D 5e om gevechten aan tafel te draaien, met de regels van 2014 of 2024 (per tafel te kiezen onder Instellingen → Regels): spelers (ook via een D&D Beyond-link of PDF), alle SRD-monsters (322 uit SRD 5.1, 331 uit SRD 5.2.1), uitleg van alle SRD-spells (2014 en 2024), condities met duur, spell slots, concentration, death saves, recharge, legendary en lair actions, vaste party, logboek en undo.

Werkt offline als app op je beginscherm (PWA). Alle data staat lokaal in je browser; via **Opslag → Exporteer** maak je een backup of neem je alles mee naar een ander apparaat. Klaargezette encounters deel je los via **+ Monster → Encounters → ⋯ → Delen**.

## Structuur

```
index.html            pagina
css/app.css           opmaak (licht en donker)
js/main.js            opstarten
js/state.js           toestand, undo, logboek vastleggen, party-sync
js/storage.js         IndexedDB (met localStorage als terugval)
js/backup.js          export/import (JSON met versienummer: 3, of 4 bij 2024-inhoud)
js/log.js             logboek: verschil tussen twee stappen
js/ddb.js             D&D Beyond: PDF-sheets inlezen, online sheet ophalen
js/ddbjson.js         D&D Beyond character-JSON → sheet (puur, getest)
worker/index.js       Cloudflare Worker: /api/ddb (alleen D&D Beyond-sheets) en /api/room
worker/room.js        Durable Object: spelersscherm-kamer (kamercode, WebSocket)
js/data/monsters.js   monsterbibliotheek en import (Open5e / 5e-bits)
js/data/spells.js     spellbibliotheek voor de spell-uitleg (laden bij de eerste tik, naam-aliassen)
js/rules/             spelregels, puur en getest (editie 2014/2024 als parameter, `edition.js`)
js/ui/                tekenen en gebruikersacties
pages/maps.html       Inn the Grid (kaartenmaker, /maps/): sjabloon; eigen versie js/maps/version.js
js/maps/              Inn the Grid: model/ (puur: raster, viewport, kaart, achtergrond, objecten, catalogus, undo/redo, projectbestand), render/ (canvas, tekeningen), ui/ (invoer, upload, export); los van Initiative
data/maps-assets/     Inn the Grid: ingebouwde onderdelen (eigen top-down SVG's, id = bestandsnaam, bevroren)
css/maps.css          opmaak Inn the Grid (tokens uit css/app.css)
locales/maps/         eigen catalogus per taal voor Inn the Grid (gebouwd uit locales/src/*/maps.js)
data/monsters.json    SRD 5.1 monsters
data/monsters-2024.json SRD 5.2 monsters (gemaakt met tools/monsters_srd2024.py uit open5e-api, gecontroleerd tegen de SRD 5.2.1-pdf)
data/spells.json      SRD 5.1 spells (gemaakt met tools/spells_srd.py uit 5e-bits/5e-database)
data/spells-2024.json SRD 5.2 spells (gemaakt met tools/spells_srd2024.py uit open5e-api)
sw.js                 service worker (offline)
tests/                tests voor de regels
```

Geen build-stap: de browser laadt de modules direct.

## Lokaal draaien en testen

```
python3 -m http.server 8000     # of: npx serve (zonder Worker: link-import werkt dan niet)
npx wrangler dev                # met Worker en kamers, zoals live
npm test                        # Node 18+, geen installatie nodig
```

## Publiceren

Cloudflare Workers publiceert automatisch bij elke push naar `main` (instellingen in `wrangler.jsonc`, uitgesloten bestanden in `.assetsignore`).

## Nieuwe versie uitbrengen

Verhoog `VERSION` in `sw.js`, `js/version.js` én `<meta name="it-version">` in `pages/initiative.html` (daarna `node tools/pages.mjs`), anders blijven geïnstalleerde apps de oude bestanden uit hun cache gebruiken.

## Licentie van de monsterdata

Bevat materiaal uit het System Reference Document 5.1 (2014) van Wizards of the Coast LLC, beschikbaar onder [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/legalcode), via [Open5e](https://open5e.com) (monsters) en [5e-bits/5e-database](https://github.com/5e-bits/5e-database) (spells), en uit het System Reference Document 5.2 en 5.2.1 (2024) van Wizards of the Coast LLC onder [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/legalcode), via [Open5e](https://open5e.com) (spells en monsters; de monsters gecontroleerd en verbeterd tegen de officiële SRD 5.2.1-pdf). Dungeons & Dragons is een handelsmerk van Wizards of the Coast; dit project is daar niet aan verbonden.

Icoontjes voor rassen en creature types (`icons/creatures.svg`) komen van [game-icons.net](https://game-icons.net), door Lorc, Delapouite, Sbed en Cathelineau, onder [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Lettertypes DM Sans en Newsreader: SIL Open Font License (`fonts/OFL.txt`). Interface-iconen (`icons/ui.svg`): eigen tekeningen, behalve pen en tandwiel naar [Feather Icons](https://feathericons.com) (MIT, Cole Bemis). PDF-import met [pdf.js](https://mozilla.github.io/pdf.js/) 3.11.174 van Mozilla, zelf gehost in `vendor/pdfjs/` (Apache License 2.0).
