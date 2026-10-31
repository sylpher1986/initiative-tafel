# Kev’s Inn: werkinstructies voor Claude

Repo `Sylpher1986/initiative-tafel`, branch `main` = enige bron van waarheid voor beide Claude-accounts (geen forks). Bevat **Kev’s Inn itiative** (D&D 5e initiative/encounter tracker, `/initiative/`) en **Inn Sight** (kaartenmaker, `/maps/`, eigen versie). Live: https://kevs-inn.com (Cloudflare Workers publiceert automatisch bij push naar `main`). Bij tegenspraak wint de repo boven projectinstructies en geheugen.

Dit bestand bevat alleen werkinstructies. Inhoud staat in:

| Bestand | Inhoud |
|---|---|
| `docs/DECISIONS.md` | Alle geldende keuzes: Techniek, Meertaligheid, Gemaakte keuzes per onderdeel (Initiative, Inn Sight), besluiten G1/G4, Bewust niet, open besluiten |
| `docs/ROADMAP.md` | Grote projecten (G-codes) op hoofdlijnen |
| `docs/work-packages/` | Uitgewerkte actieve werkpakketten; index in `README.md` |
| `docs/BACKLOG.md` | Kleine punten (K-codes), op signaal, operationeel |
| `docs/i18n.md` | Hoe meertaligheid werkt; §9 = stappen nieuwe tool/taal en reviewchecklist |
| `docs/g4-inn-the-grid.md` | Inn Sight: architectuur (§2) en projectbestandsformaat (§8) |
| `README.md` | Publieke uitleg, mappenstructuur, licenties |

## Start van een gesprek
- Gaat het gesprek iets wijzigen: `add_repo` (push), clonen, `git push --dry-run origin main`. Alleen vragen of plannen: lezen volstaat, geen push-check.
- Eén werkpakket of backlogpunt per gesprek; een nieuw onderwerp = een nieuw gesprek.
- Nederlands, pragmatisch en technisch direct. Michiel werkt vaak op zijn telefoon: geen stappen die een laptop vragen.

## Leesstrategie (alleen wat de opdracht raakt)
Nooit standaard alle documentatie lezen. Grote bestanden gericht lezen: `grep -n "^##" <bestand>` voor de kopjes, dan Read met offset/limit, of zoeken op functie, bestand of WP-nummer.

| Opdracht | Lees |
|---|---|
| Elke codewijziging | `docs/DECISIONS.md` → "Techniek" en "Meertaligheid (geldt voor elke tool)" (± 7 KB), plus de subsectie(s) onder "Gemaakte keuzes" van het onderdeel dat de diff raakt |
| Werkpakket uitvoeren | Het WP in `docs/work-packages/<onderdeel>.md` + de daar genoemde besluiten. Niet de roadmap |
| Backlogpunt (K-code) | Alleen die regel in `docs/BACKLOG.md` + de raakvlakken in `docs/DECISIONS.md` |
| Project plannen / WP's uitwerken | Het projectpunt in `docs/ROADMAP.md`, relevante besluiten, "Bewust niet"; code alleen zover nodig voor de inventaris |
| Tekst, pagina's, nieuwe tool of taal | `docs/i18n.md`: alleen de genoemde § (§3.2.1 Engelse stijl, §9 conventies) |
| Inn Sight-bestandsformaat of architectuur | `docs/g4-inn-the-grid.md` §2.x of §8 |
| Vraag over status of prioriteit | `docs/ROADMAP.md` en/of `docs/BACKLOG.md` |
| Alleen documentatie | Dit bestand + de te wijzigen bestanden |

Codecommentaar verwijst soms nog naar `CLAUDE.md, "Gemaakte keuzes → …"`: die secties staan nu in `docs/DECISIONS.md` onder dezelfde kopnaam.

## Werkpakket uitvoeren
- Werk zelfstandig door tot de oplevering, zonder tussentijdse bevestigingen of losse analyserondes. Vraag alleen iets als een ontbrekend besluit de uitvoering wezenlijk verandert.
- Verken de code niet breder dan nodig. Zet het WP bij de start op `In uitvoering` (mag in de opleveringscommit).
- Bundel reviewbevindingen, vertaalcontrole en documentatie-update vóór de push; streef naar één push per pakket.
- Herhaal geen geslaagde controles zolang er niets relevants veranderde. Claim nooit dat een test, push of deploy geslaagd is zonder bewijs.

## Reviewers en agents
Bij elk nieuw idee of elke wijziging kijken twee rollen mee, waar mogelijk als **aparte agent** die het werk niet zelf maakte. Geen andere agents, tenzij een afgebakende deeltaak aantoonbaar sneller of beter wordt.

**Senior UX-designer: vóór het bouwen** (alleen bij een zichtbare wijziging met meerdere redelijke opties)
- Bekijkt het vanuit het gebruik aan tafel: één DM, telefoon in de hand, snel, soms zonder internet.
- Zet minstens twee opties naast elkaar, kiest en zegt waarom (aantal tikken, duimbereik, tikdoelen ≥ 44 px, leesbaarheid, wat er weg kan). Bij grotere wijzigingen eerst een schets of mockup ter goedkeuring.
- Bewaakt consistentie met `docs/DECISIONS.md`, inclusief wat daar als afgewezen of "Bewust niet" staat.

**Senior developer: na het bouwen, vóór de push**
- Krijgt de diff, de acceptatiecriteria en de relevante tests mee, niet de volledige analyse.
- Scope: de diff plus wat er direct aan raakt (aanroepers, bijbehorende regels in `js/rules/` en hun tests). Volledige review bij een `x.y.0`- of `x.0.0`-versie, een formaatwijziging in `js/backup.js`, of op verzoek. `npm test` draait altijd volledig.
- Logica tegen de regels van de editie (5e 2014, en SRD 5.2.1 waar de code `ed` meekrijgt) en randgevallen (0 HP, dood, lege lijst, undo, import van oude of rare data); dekken de tests het?
- Eenvoudigste oplossing: geen dubbele code, geen onnodig werk per tik, regels puur, render zonder bijwerkingen.
- Veiligheid (escapen, import opschonen) en geen verlies van bestaande functionaliteit.
- Bij tekst, pagina's of opgeslagen data: checklist `docs/i18n.md` §9.5.

**Vertaalagent** (bij nieuwe of gewijzigde tekst): een aparte agent met kennis van D&D 5e leest Engels en Nederlands na (juiste termen, consistente woordkeus, lengte op 320 px; `docs/i18n.md` §0 V6 en §3.2.1).

Uitzondering: een wijziging die alleen documentatie raakt en niets aan de app, krijgt geen reviewer-agent; wel `npm test` vóór de push.

## Bij elke wijziging
1. `npm test` (Node 18+, geen installatie); nieuwe regels-logica krijgt een test.
2. Browsercheck op 320, 360 en 390 px, licht en donker: geen horizontaal scrollen (`node tools/browsercheck.mjs`, per pakket een scenario in `SCEN`). Draai **alleen wat de wijziging raakt**: het scenario van het pakket plus de scenario's van de onderdelen die de diff echt aanraakt (bijv. een wijziging in Verven: ook `wp63`). Een volledige regressierun alleen bij een `x.y.0`- of `x.0.0`-versie, en dan alleen de scenario's van de tool die verandert (Maps: `maps`, `wp57`…; Initiative: de rest); scenario's van de andere tool alleen als gedeelde bestanden veranderen (`css/app.css`, `js/i18n/*`, `js/theme.js`, fonts, iconen, `sw.js`-logica, homepage). `--lang=en` alleen voor scenario's waarvan de zichtbare tekst veranderde; `--i18n=xx` bij nieuwe tekst (een `⟦` op het scherm is FOUT). `npm test` blijft altijd volledig.
3. Versie ophogen in `js/version.js`, `sw.js` én `<meta name="it-version">` in `pages/initiative.html`, daarna `node tools/pages.mjs` (tests bewaken gelijkheid). Schema: `x.y.z` kleine aanpassing, `x.y.0` grotere, `x.0.0` volledig nieuw. Alleen documentatie of bestanden buiten de app: geen versie. **Inn Sight** heeft een eigen nummer: alleen `js/maps/version.js` en `MAPS_VERSION` in `sw.js` (test); een Maps-wijziging verhoogt de Initiative-versie niet, een wijziging aan gedeelde bestanden (`css/app.css`, fonts, iconen, `js/i18n/*`, `js/theme.js`, homepage) wel.
4. Documentatie bijwerken (zie Documentatiebeheer), in dezelfde commit.
5. Commit in het Nederlands, push naar `main` (Cloudflare publiceert automatisch). Deploy pas als geslaagd melden met bewijs (bijv. de versie live).

### Gereedschap
- `tests/`: `npm test` (± 880 tests, ± 15 s), end-to-end over G1 in `tests/wp55.test.js` en de kamer-test "G1" in `tests/room.test.js`; Inn Sight in `tests/maps-*.test.js`; o.a. syntaxcheck van alle JS, contrast, fonts, iconen, tikdoelen, pagina's, i18n, versies.
- `tools/browsercheck.mjs`: matrix 320/360/390 × licht/donker met touch, telt horizontaal scrollen en JS-fouten (FOUT) en tikdoelen < 44 px; `--lang=nl,en,xx`, `--shots=naam` → `shots/` (gitignored). Playwright via `PW_MODULE` of `/opt/npm-tools`, niet in package.json. Na een schrijfactie in IndexedDB pas herladen als de waarde er echt staat (`idbHas`). Losse breedte(s) met `BC_W=1200` (of `BC_W=360,1200`), bijv. voor een desktopcheck.
- Gegenereerde bestanden: pagina's/manifests/robots/sitemap (`tools/pages.mjs`), catalogi (`tools/i18n-build.mjs`), iconen (`tools/icons.mjs`), spelldata (`tools/spells_srd*.py`), SRD 5.2-monsters (`tools/monsters_srd2024.py`, invoer Open5e: niet in de tests opnieuw gedraaid, de test controleert inhoud en correcties), concentratielijst (`tools/conc_lists.py`), schade-spells (`tools/dmg_spells.mjs`). Tests bewaken dat ze actueel zijn.
- Lokaal de kamer testen zonder wrangler: nagebootste runtime in `tests/room.test.js`.

## Documentatiebeheer
Elke informatie heeft één primaire plek; elders alleen een verwijzing.
- **Backlog** (`docs/BACKLOG.md`): bug, kleine verbetering of los idee dat in één sessie past. Volgende vrije K-code gebruiken.
- **Roadmap** (`docs/ROADMAP.md`): meerdere sessies, eigen plan of open besluiten nodig, of een nieuwe tool/fase. Alleen doel, status, prioriteit (als Michiel die geeft) en afhankelijkheden. Bijwerken bij start, statuswissel, blokkade of afronding van een project.
- **Werkpakketten** (`docs/work-packages/`): zodra een roadmapproject gepland wordt: inventaris + open besluiten, dan WP's volgens het sjabloon in `README.md`, met doorlopende nummering. Status: Gepland · Klaar voor uitvoering · In uitvoering · Geblokkeerd. Index in `README.md` bijwerken.
- **Besluiten** (`docs/DECISIONS.md`): elke blijvende keuze kort onder de juiste kop (wat geldt, waar het zit, waarom bij belangrijke keuzes, wat is afgewezen). Een vervangen besluit niet verwijderen: markeer **[Vervallen → nieuwe kop/ID]**. Open vraag of tegenspraak: tabel "Open besluiten en tegenstrijdigheden"; nooit zelf beslissen.
- **Na afronding van een WP of K-punt** (in dezelfde commit): keuzes naar `docs/DECISIONS.md`; het WP verwijderen uit het werkpakketbestand en de index (of het K-punt uit de backlog); is het laatste WP van een project af, dan het project in de roadmap naar "Afgerond" met één regel (WP-reeks, versies, datum). Geen lijsten met afgeronde items en geen archief: git is de historie.

## Geplande taken en mislukte push
- Een geplande taak die een **nieuwe sessie** start, krijgt de repo niet en kan niet pushen (403). Vervolgwerk met `send_later` in hetzelfde gesprek, waar de repo gekoppeld is en `git push --dry-run` slaagt.
- Lukt pushen niet: werk als patch opslaan in het claude.ai-project, **NIET GEPUSHT** in het eindrapport met de reden, en een melding sturen.

## Eindrapport (kort)
1. Wat er gewijzigd is en de nieuwe versie(s).
2. Uitgevoerde tests en hun werkelijke resultaat.
3. Wat de reviewers (en vertaalagent) vonden en wat ermee gedaan is.
4. Status van push en deploy.
5. Resterende risico's, blokkades of open besluiten.
