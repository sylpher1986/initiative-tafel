# Initiative Tafel

Initiative tracker voor D&D 5e (2014) om gevechten aan tafel te draaien: spelers (ook via een D&D Beyond-link of PDF), alle 322 SRD-monsters, uitleg van alle SRD-spells (2014 en 2024), condities met duur, spell slots, concentration, death saves, recharge, legendary en lair actions, vaste party, logboek en undo.

Werkt offline als app op je beginscherm (PWA). Alle data staat lokaal in je browser; via **Opslag → Exporteer** maak je een backup of neem je alles mee naar een ander apparaat.

## Structuur

```
index.html            pagina
css/app.css           opmaak (licht en donker)
js/main.js            opstarten
js/state.js           toestand, undo, logboek vastleggen, party-sync
js/storage.js         IndexedDB (met localStorage als terugval)
js/backup.js          export/import (JSON met versienummer)
js/log.js             logboek: verschil tussen twee stappen
js/ddb.js             D&D Beyond: PDF-sheets inlezen, online sheet ophalen
js/ddbjson.js         D&D Beyond character-JSON → sheet (puur, getest)
worker/index.js       Cloudflare Worker: /api/ddb (alleen D&D Beyond-sheets) en /api/room
worker/room.js        Durable Object: spelersscherm-kamer (kamercode, WebSocket)
js/data/monsters.js   monsterbibliotheek en import (Open5e / 5e-bits)
js/data/spells.js     spellbibliotheek voor de spell-uitleg (laden bij de eerste tik, naam-aliassen)
js/rules/             spelregels, puur en getest
js/ui/                tekenen en gebruikersacties
data/monsters.json    SRD 5.1 monsters
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

Verhoog `VERSION` in `sw.js` én `js/version.js`, anders blijven geïnstalleerde apps de oude bestanden uit hun cache gebruiken.

## Licentie van de monsterdata

Bevat materiaal uit het System Reference Document 5.1 (2014) van Wizards of the Coast LLC, beschikbaar onder [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/legalcode), via [Open5e](https://open5e.com) (monsters) en [5e-bits/5e-database](https://github.com/5e-bits/5e-database) (spells), en uit het System Reference Document 5.2 (2024) van Wizards of the Coast LLC onder [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/legalcode), via [Open5e](https://open5e.com) (spells). Dungeons & Dragons is een handelsmerk van Wizards of the Coast; dit project is daar niet aan verbonden.

Icoontjes voor rassen en creature types (`icons/creatures.svg`) komen van [game-icons.net](https://game-icons.net), door Lorc, Delapouite, Sbed en Cathelineau, onder [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Lettertypes Alegreya SC en Alegreya Sans: SIL Open Font License (`fonts/OFL.txt`).
