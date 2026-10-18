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
- Scope: standaard de diff plus wat er direct aan raakt (aanroepers van gewijzigde functies, bijbehorende regels in `js/rules/` en hun tests). Volledige review alleen bij een `1.x.0`- of `x.0.0`-versie, een formaatwijziging in `js/backup.js`, of op verzoek. `npm test` draait wel altijd volledig (± 1 s).
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
- Spelers: handmatig, via een **D&D Beyond-link** (alleen publieke sheets) of via de PDF-export (formuliervelden, `js/ddb.js`) als terugval.
- D&D Beyond-link: Worker `GET /api/ddb/:id` haalt de onofficiële endpoint `character-service.dndbeyond.com/character/v5/character/{id}` op (kan zonder aankondiging veranderen) en geeft de JSON ongewijzigd door (niet parsen in de Worker: CPU-limiet van 10 ms op het gratis plan; geen upstream-cache, zodat een net publiek gemaakte sheet direct werkt); `/api/ddb/:id/avatar` haalt het portret, met de url uit de character-data (nooit van de client). Geen open proxy: alleen numerieke id's, vaste hosts, geen CORS, limieten op grootte en tijd. Parser puur in `js/ddbjson.js`: AC en HP worden berekend; onzekere waarden krijgen een reden en worden in het formulier gemarkeerd ("· controleer"). Opnieuw ophalen werkt de bestaande speler bij (op `ddbId`, anders unieke naam) via een bevestigvak; schade en verbruik blijven staan.
- Twee modi: **Voorbereiden** (toevoegen, party, instellingen) en **Gevecht** (alleen lijst + beurtbalk). De modus volgt het gevecht (`ui.mode = null`), de DM kan altijd wisselen. In Gevecht voegt de **+** halverwege monsters toe; wie vóór de actieve beurt invoegt, doet pas volgende ronde mee.
- Bewerken: ⋯ → naam, basis-AC, max HP (zonder effecten) en initiative met Opslaan; max HP wijzigen houdt schade aan (`setMax`). Een niet-opgeslagen concept blijft open bij een beurtwissel.
- Tijdelijke effecten (`js/rules/effects.js`): knop **Effect** in de actiebalk (Temp HP zit als tab in het cijferpaneel). Presets (SRD) met één tik, of een eigen effect: AC + / AC wordt / AC minimaal, max HP ±, of alleen een notitie. Duur zoals condities plus "tot begin volgende beurt (doelwit)" en "tot long rest"; telt af in `turnBoundary`. Concentratie-effecten hangen aan de caster (standaard wie aan de beurt is; zonder beurt "Wie cast?") en verdwijnen in `commit()` via `endConcEffects` als die concentratie weg is. Basis-AC blijft `c.ac`, de kaart toont `effAc(c)`; max HP-effecten passen `c.max` aan en onthouden `hpd`. Zelfde naam stapelt niet (vervangen); Half/Three-quarters cover vervangen elkaar (`grp`). Cover (op DEX) en Bless/Bane (±1d4) tellen mee bij monster-saves in het AoE-paneel (`saveMods` via preset-naam; spelers krijgen een hintregel). Opnieuw casten: doelen in dezelfde beurt (`cast` = `ronde:actieve id`) horen bij dezelfde cast, een latere beurt is een nieuwe cast en de oude doelen vervallen; de melding heeft "Hoort erbij" (alleen zolang dat de laatste stap is). Haste voorbij (duur, concentratie, handmatig, nieuwe cast) → effect **Lethargy** via `after` op de preset: t/m einde van de volgende beurt van het doelwit (midden in de eigen beurt: de volgende telt), rode chip vooraan (`isWarn`); niet bij vernieuwen, gevecht stoppen, long rest of als het doelwit neer/dood is. Max HP-effect tot 0 = dood (speler als 3 failures); `c.max` blijft ≥ 1 omdat 0 "HP onbekend" betekent. Gevecht stoppen: ronde-effecten weg; long rest: alle effecten weg. `eff` synct naar de party.
- Gevechtsweergave: compacte kaarten, **maar één kaart tegelijk open** (standaard wie aan de beurt is); beurtbalk vast onderaan; schade via cijferpaneel.
- AoE via de knop **AoE** in de beurtbalk: één schadeworp, per doel save (Gefaald / Geslaagd ½ / 0 voor Evasion) en Normaal/Resist/×2/Immuun. Volgorde volgens PHB: eerst de save, daarna resistance/vulnerability (27 → 13 → 6). Resist/immuun komt automatisch uit het statblock bij een onvoorwaardelijke regel; voorwaardelijke regels ("from nonmagical attacks") alleen als hint. Spelers hebben (nog) geen opgeslagen resistances: handmatig aantikken. Regels in `js/rules/aoe.js`.
- Avatars (`js/ui/avatar.js`): portret uit de D&D Beyond-link (via de Worker) of -PDF (vak "CHARACTER IMAGE"), max 128 px jpeg, > icoon op ras (`race`, anders `sheet.race`) > algemeen spelersicoon. Monsters: icoon op creature type uit `meta`. Iconen uit game-icons.net (CC BY 3.0, vermelding in README) in de sprite `icons/creatures.svg`. Echte monsterafbeeldingen: geen vrij bruikbare bron, dus (nog) niet.
- Lettertypes: Alegreya SC (koppen) en Alegreya Sans (tekst), zelf meegeleverd in `fonts/` als latin-subset woff2 (OFL). Geen externe font-diensten; een nieuw gewicht = bestand toevoegen + `@font-face` + `sw.js`.
- Hosting: Cloudflare Workers (statische assets via `wrangler.jsonc`, uitsluitingen in `.assetsignore`; alleen `/api/*` gaat langs `worker/index.js` via `run_worker_first`). Gekozen omdat later serverfuncties nodig zijn voor AI (API-sleutel mag nooit in de browser).
- Spelersscherm (`speler.html`): krijgt alleen de snapshot uit `toPlayerView` (`js/playerview.js`), nooit de volledige toestand; zichtbaarheid centraal in `VIS` (monster-HP als status, spelers exact, geen initiativegetallen). Transport `js/share.js`: nu BroadcastChannel (zelfde browser), later een WebSocket-kamer met dezelfde interface. Ontvangen data altijd door `cleanView`. Verborgen monsters (`c.hidden`, via ⋯) bestaan niet voor spelers, ook hun beurt niet.
- Fase 1 is local-first zonder accounts. Sync/login (bijv. Supabase) pas in fase 2.

Zie `ROADMAP.md` voor wat er nog openstaat.
