# G4 · Inn Sight (was Inn the Grid) — plan (inventaris, architectuur, MVP, werkpakketten)

Stand: 28-10-2026, op basis van `Sylpher1986/initiative-tafel` `main` @ `52dee49` (Kev's Inn itiative 2.11.1). Status: **D1–D3 besloten (28-10-2026)**; overige aanbevelingen gelden tot een pakket anders beslist.

**Naam (D13, 28-10-2026): Inn the Grid wordt Inn Sight.** De hernoeming zat in WP65 (alles wat de gebruiker ziet) en WP67 (documentatie, pad `/maps/` blijft). Oudere passages in dit plan noemen de tool nog Inn the Grid (historie); de bestandsnaam van dit plan blijft (vaste verwijzingen).

Uitgangspunt van Michiel (28-10): basic beginnen, eerst iets functioneels, daarna mooi maken; tot er iets werkt helemaal los van Initiative.

Legenda bij beweringen: **[F]** geverifieerd in de repo · **[C]** conclusie uit die feiten · **[A]** aanbeveling, wacht op besluit · **[?]** open/onbekend.

---

## 1. Inventaris (wat bestaat er)

### 1.1 Wat is bekeken
- Repo's (lijst van beide accounts): `sylpher1986/initiative-tafel` (bron van waarheid) en `sventastisch/initiative-tafel` (fork, privé; volgens de projectinstructies niet gebruiken, niet geopend). **[F]** Er is **geen** repo, branch of prototype voor Inn the Grid en geen gedeelde bibliotheek of los design-system-project.
- Gelezen: `CLAUDE.md` (volledig), `ROADMAP.md`, `README.md`, `docs/i18n.md` (§9.2 nieuwe tool), `brand/README.md`, `wrangler.jsonc`, `.assetsignore`, `package.json`, `sw.js`, `js/storage.js`, `js/backup.js`, `js/tablock.js`, `js/playerview.js` (exports), `js/share.js` (exports), `worker/room.js` (limieten), `tools/pages.mjs` (APP_PAGES/HIDDEN), `tests/version.test.js`. Codebase verder alleen gezocht (grep), niet volledig gelezen.
- Geen GitHub-issues bekeken (alleen leestoegang via git, geen API). **[?]**

### 1.2 Wat er nu is **[F]**
- **Techniek**: geen build-stap, geen dependencies, gewone ES-modules; geen framework of bundler zonder overleg. Logica puur in `js/rules/`, UI in `js/ui/`. ± 109k regels JS (incl. vendor/data).
- **Hosting**: Cloudflare Workers, statische assets uit de repo-root; Worker alleen voor `/api/*` en `/en*`; Durable Object `Room` voor het spelersscherm. Publiceert automatisch bij push naar `main`.
- **Multi-tool is al voorbereid**: `docs/i18n.md` §9.2 beschrijft stap voor stap een nieuwe tool (catalogus-namespace, sjabloon in `pages/` + `APP_PAGES`, `sw.js`-ASSETS, browsercheck-scenario, eigen export met `format`/`version`). Route-conventie `/{tool}/` (Engels) en `/{lang}/{tool}/`. Icoon `brand/tool-icons/maps.svg` ("Inn the Grid") ligt klaar. ROADMAP G4: "bij voorkeur gestructureerde data (grid, muren, terrein) die de app tekent; eventueel als eigen tool".
- **Opslag**: IndexedDB `initiative-tafel`, één store `kv` (`js/storage.js`), terugval localStorage; één DM-tabblad tegelijk via `it-tab` (`js/tablock.js`).
- **Export/import**: één JSON met `format: "initiative-tafel"`, `version` 1–4, migraties en strenge opschoning (`js/backup.js`). Encounters hebben `id` + `updatedAt` (sync-klaar).
- **Spelersscherm**: krijgt alleen een expliciet opgebouwde snapshot (`toPlayerView`, whitelist, `cleanView` aan ontvangstkant). Transport: `localChannel` (BroadcastChannel, zelfde apparaat) en `roomChannel` (WebSocket via de Worker). Kamerlimieten: **96 KB per DM-bericht, 64 KB per afbeelding, max 40 afbeeldingen** (`worker/room.js`).
- **Tokens/kaarten/canvas**: niets. Geen grid-, kaart-, fog- of tokencode (grep). Avatars zijn alleen icoon of portret (max 60 000 tekens data-url).
- **Huisstijl**: kleurtokens in `css/app.css` met contrasttest (WCAG AA), DM Sans + Newsreader zelf gehost, iconensprite `icons/ui.svg`, tikdoelen ≥ 44 px (test), regels voor oudere iPads (geen `color-mix`/`backdrop-filter`, invoer ≥ 16 px).
- **Kwaliteit**: `npm test` (Node test runner, ± 755 tests); `tools/browsercheck.mjs` (Playwright, 320/360/390 px, licht/donker). **Geen CI** (geen `.github/`). Twee verplichte reviewers (UX vóór, developer na) per CLAUDE.md.
- **Accounts/abonnementen**: geen. Local-first; accounts = G2, AI = G3.
- **Versie**: één versie voor de site: `js/version.js` = `sw.js` `VERSION` = `it-version` in het Initiative-sjabloon (test bewaakt). De service worker heeft scope `/` en dient alle tools.

### 1.3 Beperkingen en onbekend **[?]**
- Issues/discussies op GitHub niet bekeken.
- Of Playwright in elke sessie beschikbaar is, niet getest in deze sessie.
- Werkelijke prestaties van canvas op Michiels oudste iPad: gemeten in WP66 (29-10), 34–41 fps op de meetkaart; waarden in CLAUDE.md.
- Gedrag van Blobs in IndexedDB op oudere iOS-versies: bekend wisselvallig, daarom ArrayBuffer (zie §2.4).

---

## 2. Architectuur

### 2.1 Repo-strategie **[A] zelfde repo, eigen map en eigen opslag**
| | Zelfde repo (`/maps/`) | Nieuwe repo |
|---|---|---|
| Infra (i18n, pagina-generator, sw, tests, huisstijl, hosting) | hergebruikt, procedure §9.2 bestaat **[F]** | alles kopiëren of als pakket afsplitsen (geen build-stap → lastig) |
| Latere koppeling met Initiative | zelfde origin: Initiative kan de kaartenbibliotheek direct lezen, zonder backend **[C]** | ander domein/origin: alleen via bestand of een API |
| Losstaan | via eigen map `js/maps/`, eigen IndexedDB, geen imports uit Initiative-UI | vanzelf |
| Nadeel | gedeelde sw-versie en `npm test`; elke Grid-release raakt de cache van Initiative | dubbel onderhoud, tweede deploy, tweede huisstijl-kopie |

Conclusie **[C]**: zelfde repo. "Helemaal los" wordt technisch afgedwongen: Grid importeert alleen gedeelde infrastructuur (`js/i18n/*`, `js/theme.js`, kleurtokens/fonts/iconen), nooit iets uit `js/rules/`, `js/ui/`, `state.js`, `storage.js` of `tablock.js`. Een test bewaakt die grens (WP56).

### 2.2 Componenten (voorstel)
```
pages/maps.html               sjabloon → /maps/ en /nl/maps/ (tools/pages.mjs)
locales/src/{en,nl}/maps.js   namespace "maps." → locales/maps/{en,nl}.js (eigen bestand, §2.10)
css/maps.css                  editor-opmaak (gebruikt tokens uit app.css)
js/maps/main.js               opstarten (initI18n, opslag, eerste render)
js/maps/model/                PUUR (Node-testbaar, geen DOM)
  map.js        schema, nieuwe kaart, operaties (add/move/remove/paint…) → nieuwe toestand
  grid.js       vierkant + hex: cel↔kaartcoördinaat, celpolygoon, buren, snap
  hit.js        welk object/welke cel onder een punt
  history.js    undo/redo (operatie-stappen)
  file.js       export opbouwen, import valideren (cleanMap), migraties
  assets.js     ingebouwde catalogus (id's), eigen assets (hash, mime, afmetingen)
js/maps/render/canvas.js      tekenen op één viewport-canvas (lagen, culling)
js/maps/ui/                   gereedschappen, panelen, invoer (pointer events), opslagstatus
js/maps/store.js              IndexedDB "kevs-inn-maps": maps, assets
data/maps-assets/             ingebouwde assets (eigen SVG's)
tests/maps-*.test.js
```

### 2.3 Kaartmodel **[A]**
- **Kaarteenheid**: 1 cel = 1 eenheid (vierkant: zijde; hex: afstand tussen middelpunten). Objectposities zijn floats in kaarteenheden, dus onafhankelijk van schermresolutie en achtergrondpixels.
- **Raster**: `{ type: "square" | "hex", orient: "pointy" | "flat" (hex), cols, rows, show, color, alpha }`. Hex-cellen in axiale coördinaten intern, opgeslagen als offset-kolom/rij (eenvoudiger te begrenzen).
- **Achtergrond**: `{ asset, x, y, scale, rot? }` — positie/schaal in kaarteenheden, zodat een geüploade battle map op het raster uitgelijnd kan worden.
- **Terrein** (WP63, `terr`): `{ w, h, ids, cells }`: vast celraster w × h (= `LIMITS.maxCells`, los van kolommen/rijen), `cells` = tekst van w·h tekens rij voor rij, teken = positie in `0-9a-z` (0 = leeg, k = `ids[k − 1]`). Oorspronkelijk advies (schaarse celkaart `{ "c,r": terrainId }`) afgewezen om de kopieerkosten per veeg.
- **Tokens** (WP74, `toks`): `{ at, list: [{ id, x, y, s, c, l, hide? }] }`, eigen veld (geen objectlaag) omdat ook de kaartviewer het schrijft; "laatste wijziging wint" op `at`, zoals fog. Schema 7.
- **Objecten** (WP61, `objs`): `[{ id, asset, x, y, w, h, rot, layer }]`, x/y = middelpunt, w/h in cellen, `layer` ∈ `floor | object`; later `dm` (fog is geen laag maar een eigen veld, zie hieronder). Geen `z`: de lijstvolgorde is de tekenvolgorde binnen een laag.
- **Assets**: `{ id: { kind: "builtin", ref } | { kind: "custom", mime, w, h, sha256, name } }`; bytes los in de assetstore, niet in het kaartdocument.
- Id's en codes in opslag, geen labels (CLAUDE.md, Meertaligheid). Gebruikersinhoud (kaartnaam, objectnamen) wordt nooit vertaald.
- **Fog** (WP73, `fog`): `{ at, on, rev }`, onthulde cellen als bits in een vast 100×100-raster (hex-tekst); schema 6 als fog aan staat. DM-only: gaat alleen ingebakken in het platte spelersbeeld naar spelers (§2.8). Een toekomstige laag `dm` volgt hetzelfde principe: de spelersweergave is een **expliciete whitelist**, net als `toPlayerView`.

### 2.4 Opslag, opslagstatus en dataverlies **[A]**
- Eigen IndexedDB `kevs-inn-maps` (los van `initiative-tafel`): store `maps` (kaartdocument + `id`, `name`, `updatedAt`, `schema`), store `assets` (ArrayBuffer + mime, sleutel = sha256 → automatisch ontdubbeld).
- Autosave: elke wijziging gedebounced (± 500 ms) en bij `visibilitychange`/`pagehide` direct. Status altijd zichtbaar: *Opgeslagen* · *Opslaan…* · *Niet opgeslagen* (rood, met "Exporteer nu").
- `navigator.storage.persist()` aanvragen bij de eerste eigen afbeelding; `storage.estimate()` → waarschuwing boven ± 80 % gebruik.
- Eigen tabblad-bewaking (`maps-tab`, zelfde patroon als `js/tablock.js` maar eigen sleutel), zodat Grid en Initiative elkaar nooit stoppen.
- Exportherinnering zoals Initiative (strook, geen pop-up) — na de MVP.
- Undo/redo: in het geheugen, max ± 100 stappen; niet in de export.

### 2.5 Projectbestand **[A]**
| Optie | Voor | Tegen |
|---|---|---|
| **A. Eén JSON, assets als base64** | zelfde patroon als `js/backup.js`, geen dependency, één bestand, makkelijk te valideren en later door Initiative te lezen | ± 33 % groter; ruw 15–30 MB bij veel grote afbeeldingen |
| B. ZIP-container (`map.json` + `assets/`) | compact, standaard | eigen ZIP-lezer/schrijver nodig (geen dependencies), meer randgevallen |

Advies: **A** voor v1. Na hercodering van uploads (§2.6) blijft een typische kaart ruim onder 10 MB. Herzien als metingen anders uitwijzen.
- Kop: `{ format: "kevs-inn-maps", version: 1, exported, app: "Inn the Grid x.y.z", map: {…}, assets: { sha256: { mime, w, h, data } } }`.
- Bestandsnaam `inn-the-grid-<kaartnaam>-YYYY-MM-DD-HH-MM.json` (lokale tijd, zoals AF11).
- Import: grootte-grens (bijv. 50 MB), JSON-parse in try, `format` controleren, `version` > bekend = weigeren ("gemaakt met een nieuwere versie"), migraties per versie, `cleanMap` (alle velden begrensd en getypeerd, onbekende velden weg, aantallen begrensd), per asset: mime-allowlist, magic bytes, sha256 klopt, decodeerbaar; ontbrekende of kapotte asset = duidelijke melding met objectnamen, niet stil weglaten. Import maakt altijd een **nieuwe** kaart (nooit stil overschrijven).

### 2.6 Uploads veilig **[A]**
- Alleen PNG/JPEG/WebP (controle op magic bytes, niet op extensie). **Geen SVG-uploads** (script-risico); ingebouwde SVG's komen alleen uit de repo.
- Decoderen via `createImageBitmap`, hercoderen via canvas naar WebP (terugval JPEG) met langste zijde ≤ 4096 px (iOS-canvasgrens). Dat verwijdert ook EXIF/locatie.
- Invoergrens bijv. 25 MB; foutmelding noemt de grens.

### 2.7 Tekenen en invoer **[A]**
- **Canvas 2D, eigen code, geen bibliotheek** (no-deps-regel **[F]**; Konva/Pixi zou vendoren + overleg vragen). Eén canvas ter grootte van het scherm met transformatie (pan/zoom), nooit een canvas ter grootte van de hele kaart. Culling: alleen zichtbare cellen/objecten; raster en terrein in een offscreen-buffer per zoomniveau.
- Pointer Events voor muis, pen en touch. Gereedschapsmodus bepaalt wat één vinger doet: **Kijken** (pannen), **Plaatsen**, **Selecteren**, **Verven**, **Gum**. Knijpen = zoomen en twee vingers = pannen, in elke modus. Desktop: wiel = zoom, spatie+slepen = pan, Delete, pijltjes, ⌘Z/⌘⇧Z.
- Indeling: telefoon = canvas vol scherm + dockrij onderaan (patroon Initiative) + paneel van onderen voor bibliotheek/instellingen; tablet/desktop ≥ 768 px = zijpaneel.
- Toegankelijkheid: alle knoppen en panelen met toetsenbord en `aria-label`; het canvas zelf is visueel, maar geselecteerd object is via pijltjes te verplaatsen en via Delete te verwijderen, met een tekstregel "Geselecteerd: Tafel (3,4)".

### 2.8 Koppeling met Initiative (pas na de MVP) **[A]**
- **Kiezen/openen**: Initiative leest de Grid-bibliotheek op hetzelfde apparaat direct uit IndexedDB `kevs-inn-maps` (zelfde origin, alleen lezen) via een gedeelde pure module `js/maps/model/file.js` (`cleanMap`). Terugval en ander apparaat: Grid-bestand importeren. Encounter bewaart alleen een verwijzing (WP69: geen kopie).
- **Spelersscherm**: de DM-kant rendert een **plat spelersbeeld** (achtergrond + raster + spelerszichtbare lagen, fog ingebakken) en stuurt alleen dat beeld. DM-lagen en het fogmasker verlaten het DM-apparaat dus nooit; verbergen in de UI is geen beveiliging.
- **Lokaal** (BroadcastChannel, tv aan hetzelfde apparaat) heeft geen groottegrens **[C]**. **Via de kamer** gelden 96/64 KB per bericht **[F]**: sinds WP72 gaat het beeld daar opgeknipt in stukken (besluit: opknippen, niet verkleinen of R2).
- Geen gedeelde backend, accounts of realtime sync nodig voor deze stappen.

### 2.9 Toekomst (niet nu bouwen)
- Accounts/cloud (G2): kaarten hebben vanaf v1 `id` + `updatedAt` (zoals encounters) en assets een sha256 → later zonder formaatbreuk te synchroniseren.
- Premium assets: `kind: "builtin"` krijgt later een `pack`-veld; eigen assets blijven altijd in de export.
- AI (G3): een AI-kaart is gewoon een kaartdocument dat door `cleanMap` gaat; de Worker-route volgt de bestaande regels (sleutel nooit in de browser, `lang` mee).
- Grotere kaarten als betaalde functie: grenzen staan op één plek (`LIMITS` in `model/map.js`).

---

### 2.10 Eigen versienummer (D2)
- **[F]** Nu: één service worker (scope `/`), één cache `initiative-tafel-<VERSION>`; `VERSION` = `js/version.js` = `it-version` (test). Er is al een voorbeeld van een cache met een eigen versie: `VENDOR` (pdf.js), die bij een app-update blijft staan en alleen ontbrekende bestanden ophaalt.
- **[A]** Inn the Grid krijgt hetzelfde patroon: `MAPS_VERSION` in `sw.js` (gelijk aan `js/maps/version.js`, test), eigen cache `kevs-inn-maps-<MAPS_VERSION>` met alleen de Maps-bestanden (pagina's `/maps/`, `/nl/maps/`, `js/maps/*`, `css/maps.css`, assets, catalogus). `activate` ruimt alleen verouderde caches van dezelfde familie op.
- Gevolg 1: `sw.js` verandert bij elke Maps-release (dat moet, anders ziet de browser geen update). Install haalt Initiative-bestanden dan alleen op als ze nog niet in de cache van de huidige Initiative-versie staan (veilig: elke Initiative-wijziging verhoogt die versie). Zo kost een Maps-release Initiative-gebruikers geen nieuwe download van monsterdata.
- Gevolg 2: de catalogus is nu één bestand per taal voor alle tools (`locales/<taal>.js`, §9.2). Een nieuwe Maps-tekst zou dan in de Initiative-cache blijven hangen tot de volgende Initiative-release. Daarom krijgt Maps een **eigen catalogusbestand** (`locales/maps/<taal>.js`), zoals §9.2 al voorziet ("pas splitsen per tool").
- Gedeeld en dus onder het Initiative-nummer blijven: kleurtokens (`css/app.css`), fonts, iconensprite, `js/i18n/*`, `js/theme.js`, homepage. Een wijziging daaraan blijft een Initiative-release. De homepage toont geen versie.

## 3. MVP

### 3.1 Advies: kleiner dan de brief, in twee mijlpalen
De brief noemt tien punten inclusief Initiative-koppeling, spelersscherm en fog. Dat is te groot voor een betrouwbare eerste versie en strijdig met "eerst helemaal los". Daarom:

**M1 — kleinste echte waarde** (WP56–WP60): nieuwe kaart, vierkant of hex raster, battle-map-afbeelding uploaden en uitlijnen, automatisch lokaal bewaren, volledig exporteren en terug importeren. Dit dekt al de meest voorkomende praktijk (een bestaande map gebruiken met een kloppend raster).

**M2 — losstaande editor-MVP** (WP61–WP67): ingebouwde assetbibliotheek, objecten plaatsen/selecteren/bewerken/verwijderen met undo, terrein per cel verven, eigen assets, responsief afgerond, prestaties gemeten, uitbrengen.

### 3.2 Uitgesteld (en waarom)
| Uitgesteld | Naar | Reden |
|---|---|---|
| Kaart kiezen vanuit Initiative | Fase 3 (WP69–WP70) | Michiel: eerst los; vraagt een stabiel bestandsformaat (na M2) |
| Spelersscherm met kaart | Fase 3 (WP71–WP72) | hangt af van de koppeling; kamerlimieten vragen eigen besluit |
| Fog of war | Fase 4 (WP73) | heeft pas zin met een spelersscherm; veilig alleen als ingebakken spelersbeeld (§2.8) |
| Tokens (vrij en gekoppeld) | Fase 4 (WP74–WP75) | koppeling met deelnemers vraagt Initiative-integratie |
| Muren/deuren op celranden, vrij tekenen, lagenpaneel | later | MVP-tekenen = cellen verven; muren/deuren als objecten |
| Mooi maken (vormgeving, onboarding-polish) | Fase 2 (WP68) | Michiel: eerst functioneel |
| Accounts, cloud, betaalde functies, AI, line of sight, licht | G2/G3/later | buiten de eerste release |

---

## 4. Werkpakketten

Nummering loopt door op de repo-historie (laatste was WP55). Elk pakket = één gesprek, één push, volgens "Bij elke wijziging" in CLAUDE.md. Voor **elk** pakket gelden standaard (niet per pakket herhaald):
- `npm test` volledig groen; nieuwe pure logica heeft tests.
- Browsercheck 320/360/390 licht/donker (+ `--lang=nl,en` en `--i18n=xx`): geen horizontaal scrollen, geen JS-fout, geen `⟦`, tikdoelen ≥ 44 px.
- Teksten via catalogus `maps.*` (Engels eerst, NL), vertaalcontrole volgens CLAUDE.md.
- Grenstest blijft groen: geen import uit Initiative-modules.
- Versie, CLAUDE.md ("Gemaakte keuzes → Inn the Grid") en ROADMAP bijgewerkt.
- Reviewers zoals CLAUDE.md voorschrijft (UX alleen bij meerdere redelijke opties).
- **DoD** = bovenstaande + acceptatiecriteria aantoonbaar + gepusht + live gecontroleerd op de telefoon door Michiel (checklijst in het eindrapport).

### Fase 0 — Plan
**WP-G4.0 · Plan vastleggen** (dit document) · S — klaar (28-10-2026): dit bestand, ROADMAP G4 verwijst ernaar, D1–D3 besloten.

### Fase 1 — M1: kale, bruikbare kaart

**WP56 · Tool-skelet met vierkant raster, pannen en zoomen** · M — **klaar 28-10-2026** (Maps 0.1.0, Initiative 2.11.2; geldende keuzes in CLAUDE.md → Inn the Grid)
- Doel: `/maps/` en `/nl/maps/` openen een lege editor met een vierkant raster dat je kunt verschuiven en zoomen. Basis voor alles.
- Scope: sjabloon `pages/maps.html` (regel in `APP_PAGES`, géén manifest-link en géén `it-version` volgens §9.2 stap 2), namespace `maps.` (`NS`, eigen catalogusbestand), `js/maps/main.js`, `model/grid.js` (alleen vierkant), `render/canvas.js` (viewport, transformatie, culling), invoer pan/zoom (muis, wiel, touch: één vinger pan, knijpen zoom), vaste nieuwe kaart 20×15 in het geheugen, `sw.js`-ASSETS, browsercheck `SCEN`/`START`, `auditFiles`/`codeFiles`, grenstest.
- Niet: opslag, hex, instellingen, homepage-kaart, installeerbare app.
- Besluiten: D1–D3 genomen. Eén keer `sw.js` van Initiative aanpassen voor een eigen maps-cache (§2.10) = Initiative-patchversie; daarna raakt een Maps-release Initiative niet meer.
- Extra scope door D2: `js/maps/version.js` (`VERSION` 0.1.0, getoond in de editor), `MAPS_VERSION` + eigen cache in `sw.js`, eigen catalogusbestand per taal, test die de nummers gelijk houdt.
- Acceptatie: (1) beide adressen laden zonder JS-fout; (2) raster 20×15 zichtbaar, lijnen scherp op devicePixelRatio 1/2/3; (3) pannen met muis en één vinger, zoomen met wiel en knijpen tussen 25 % en 400 %, gecentreerd op cursor/knijppunt; (4) "Passend maken"-knop; (5) `cellAt(x,y)`/`cellRect` getest incl. randen en negatieve coördinaten; (6) geen pagina-scroll of iOS-paginazoom tijdens gebaren (`touch-action: none` alleen op het canvas); (7) een Maps-versie ophogen verandert de Initiative-cache niet en laat Initiative-bestanden niet opnieuw downloaden (test op de cachenamen en install-logica).
- Tests: `tests/maps-math.test.js`, grenstest, pages/i18n/sw-tests; handmatig: iPhone en iPad pan/zoom.
- Risico's: iOS Safari-gebaren (paginazoom) → `touch-action`, `gesturestart` blokkeren; gedeelde sw-versie → D2.
- Grootte M: nieuwe pagina-infrastructuur + eerste canvas en gebaren.

**WP57 · Hexraster en rasterinstellingen** · M — klaar (28-10-2026, Maps 0.2.0; keuzes in CLAUDE.md → Inn the Grid)
- Doel: kiezen tussen vierkant en hex (pointy/flat), afmetingen, raster tonen/verbergen, kleur en transparantie.
- Scope: `model/grid.js` hex (axiaal ↔ offset, celpolygoon, `cellAt`, buren), paneel "Kaart" (type, kolommen, rijen 1–100, zichtbaar, kleur uit vaste set, transparantie), wijzigen werkt direct.
- Niet: opslag, achtergrond.
- Besluiten: maximale kaartgrootte MVP (D10, voorstel 100×100).
- Acceptatie: (1) `cellAt` geeft voor 1000 willekeurige punten de cel waarvan de polygoon het punt bevat (test, beide hex-oriëntaties); (2) wisselen van type behoudt kolommen/rijen; (3) raster uit = alleen kaartrand zichtbaar; (4) ongeldige invoer (0, 101, leeg, tekst) wordt geweigerd met foutregel, veld ≥ 16 px.
- Tests: hex-wiskunde incl. randen; browsercheck paneel; handmatig hex op telefoon.
- Risico: hex-randen off-by-one → eigenschapstests (punt-in-polygoon).
- Grootte M: wiskunde + eerste paneel.

**WP58 · Kaarten lokaal bewaren, kaartenlijst, opslagstatus** · L — klaar (28-10-2026, Maps 0.3.0; keuzes in CLAUDE.md → Inn the Grid)
- Doel: werk gaat nooit stil verloren; meerdere kaarten beheren.
- Scope: `store.js` (IndexedDB `kevs-inn-maps`, stores `maps`/`assets`, versie-upgrade), `model/map.js` schema v1 (alleen raster + naam), autosave + statusindicator, startscherm "Mijn kaarten" (lege toestand met "Nieuwe kaart"), nieuw/openen/hernoemen/dupliceren/verwijderen (verwijderen met Ongedaan), laatste kaart heropenen, `maps-tab`-bewaking, `storage.persist()`, foutstatus als opslaan mislukt.
- Niet: afbeeldingen (komt in WP59, store bestaat al), export.
- Besluiten: tabblad-gedrag (D11: nieuwste wint, zoals Initiative).
- Acceptatie: (1) wijziging → binnen 1 s "Opgeslagen"; (2) herladen of tabblad sluiten direct na een wijziging verliest niets (browsercheck met `idbHas`); (3) opslaan dat faalt (gesimuleerd) toont "Niet opgeslagen" en blijft dat tonen; (4) tweede tabblad neemt over, eerste toont stopscherm; Initiative in een ander tabblad blijft werken; (5) verwijderen is via Ongedaan te herstellen binnen de melding; (6) privémodus zonder IndexedDB: duidelijke melding "wordt niet bewaard", editor werkt.
- Tests: store met nagebootste IndexedDB of alleen pure delen (schema, `cleanMap` v1); browsercheck herlaad-scenario; handmatig iPhone: app op achtergrond → terug.
- Risico: Safari wist opslag na 7 dagen zonder bezoek (zonder persist) → persist-aanvraag + exportherinnering later; uitleg in leeg scherm.
- Grootte L: opslag, levenscyclus en een tweede scherm.

**WP59 · Achtergrondafbeelding uploaden en uitlijnen** · L
- Doel: een bestaande battle map gebruiken met een kloppend raster.
- Scope: knop "Achtergrond kiezen" (`data-file`-patroon), validatie (§2.6), hercodering, opslag in `assets` (sha256), achtergrond verplaatsen/schalen, raster-uitlijning: "cellen per breedte" of celgrootte in pixels, verschuiving met slepen en stappen, rasterafmetingen voorstellen uit de afbeelding, achtergrond verwijderen/vervangen.
- Niet: meerdere afbeeldingen, roteren, AI.
- Besluiten: invoergrens en maximale resolutie (D12, voorstel 25 MB / 4096 px).
- Acceptatie: (1) PNG/JPEG/WebP tot de grens werkt; GIF, SVG, HEIC, een als .png hernoemd tekstbestand en een te groot bestand geven elk een begrijpelijke melding; (2) opgeslagen versie heeft geen EXIF en langste zijde ≤ 4096; (3) een testkaart van 30×20 vakken met getekend raster is in ≤ 1 minuut uit te lijnen (handmatig); (4) na herladen staat alles nog precies; (5) zelfde afbeelding twee keer = één asset.
- Tests: pure validatie (magic bytes, mime, grenzen) en sha256; browsercheck met fixture-afbeelding; handmatig iPhone-foto (HEIC!) en grote PNG.
- Risico: iPhone levert HEIC → `accept`-attribuut zodat iOS converteert, plus duidelijke melding; geheugen bij grote afbeeldingen op oude iPad → verkleinen vóór opslaan.
- Grootte L: bestanden, hercodering, uitlijn-UX.

**WP60 · Projectbestand v1: exporteren en importeren** · L
- Doel: kaart veilig meenemen of bewaren, volledig en zelfstandig.
- Scope: `model/file.js` (opbouwen, `cleanMap`, migratiekader `MIGRATE[v]`), export via deelmenu of download (zoals `exportFile` in Initiative), import maakt nieuwe kaart, meldingen per fouttype, `docs`-sectie formaat.
- Niet: ZIP, deel-links, import in Initiative.
- Besluiten: formaat A of B (D4), bestandsextensie (D5).
- Acceptatie: (1) export → import op een ander apparaat/browser geeft een kaart die bij vergelijking van modeldata gelijk is en pixelgelijk rendert (browsercheck-screenshot); (2) bestand bevat geen URL's of verwijzingen naar browseropslag (test); (3) import weigert met eigen melding: geen JSON, ander `format`, hogere `version`, kapotte base64, sha256-mismatch, te groot, ontbrekende asset; (4) kwaadaardige velden (HTML in naam, enorme arrays, `__proto__`) worden opgeschoond (test); (5) import overschrijft nooit een bestaande kaart.
- Tests: rondreis-test, fuzz-achtige corrupte bestanden (`tests/fixtures/maps/`), browsercheck import; handmatig iOS-bestandskiezer en AirDrop.
- Risico: geheugen bij grote base64-strings → streamen naar Blob bij export; grens bij import.
- Grootte L: formaat, validatie en veel foutgevallen.

→ **Mijlpaal M1.** Live te gebruiken op `/maps/` (niet op de homepage, `noindex`, site is nog verborgen).

### Fase 1 — M2: losstaande editor

**WP61 · Undo/redo-kern en plaatsen uit de ingebouwde bibliotheek** · L
- Doel: kaart opbouwen met kant-en-klare onderdelen.
- Scope: `model/history.js` (operaties als stappen, max 100), `model/assets.js` + `data/maps-assets/` (± 24 eigen, eenvoudige top-down SVG's: vloeren, muurstuk, deur, tafel, stoel, kist, ton, pilaar, trap, boom, rots, struik, water, …), paneel Bibliotheek met categorieën, gereedschap Plaatsen (tik = plaatsen, snap naar cel aan/uit), ⌘Z/⌘⇧Z en knoppen.
- Niet: selecteren/bewerken (WP62), premium of eigen assets.
- Besluiten: herkomst assets (D6: eigen tekeningen, licentieschoon).
- Acceptatie: (1) elk ingebouwd asset is te plaatsen op vierkant en hex en staat na herladen en na export/import op dezelfde plek; (2) undo/redo over plaatsen, raster- en achtergrondwijzigingen werkt; (3) asset-id's zijn stabiel en getest (een hernoemd bestand breekt de test).
- Tests: history, catalogus-integriteit, rondreis; browsercheck bibliotheekpaneel.
- Grootte L: nieuw gereedschapsmodel + eerste assets + undo.

**WP62 · Selecteren, verplaatsen, draaien, schalen, verwijderen** · L — **klaar (Maps 0.7.0)**; besluiten in CLAUDE.md
- Scope: `model/hit.js`, selectie met tik/klik, slepen (met snap), draaien per 90° en vrij, schalen in cellen, laag vloer/object, naar voren/achteren, dupliceren, verwijderen met Ongedaan, toetsenbord (pijltjes, Delete, Esc), tekstregel "Geselecteerd: …".
- Niet: meervoudige selectie (later, op signaal).
- Uit WP61: Plaatsen heeft nog geen toetsenbordweg (bijv. Enter plaatst op een cursorcel); meenemen met de toetsenbordbediening hier of in WP65.
- Acceptatie: (1) hit-test kiest het bovenste object, ook bij gedraaide objecten (test); (2) één sleepbeweging = één undo-stap; (3) alles bedienbaar zonder muis op desktop; (4) op 320 px blijven handgrepen ≥ 44 px tikbaar.
- Risico: verwarring pannen vs. slepen op touch → modus-indicator, slepen alleen op een geselecteerd object.
- Grootte L.

**WP63 · Terrein per cel verven** · M — **klaar (Maps 0.8.0)**; besluiten in CLAUDE.md
- Scope: gereedschap Verven met terreintypen (± 8: steen, hout, gras, aarde, water, zand, lava, leegte), penseelgrootte 1/3, gum, vlakvulling binnen kaartrand, vierkant en hex.
- Niet: vrij tekenen, muren op celranden.
- Gebaren: in Verven vult slepen met één vinger, muis of Apple Pencil elke cel waar je overheen gaat; twee vingers pannen en zoomen (wens Michiel 28-10-2026, eerder K10; slepen in Plaatsen blijft pannen, WP61).
- Acceptatie: (1) één veegbeweging = één undo-stap; (2) vlakvulling stopt bij andere terreintypen en de kaartrand (test op beide rasters); (3) 100×100 volverven blijft vloeiend (zie WP66-budget).
- Opslag bewust anders dan §2.3 (schaarse `{ "c,r": id }`): `{ w, h, ids, cells }`, vast 100×100-raster als tekst (één teken per cel, palet `ids`); een kopie van 10 000 sleutels kost ± 9 ms per veegbeweging, deze vorm ± 0,2 ms. Schema 4 = kaart met terrein.
- Naar WP65: toetsenbordweg voor Verven (cursorcel + Enter, samen met die van Plaatsen). Naar WP66: meten op een echt toestel; terrein kost headless ± 1 ms per frame (één pad per terreintype, aaneengesloten cellen als één veelhoek), het hex-raster zelf ± 27 ms.
- Grootte M.

**WP64 · Eigen assets** · M — **klaar (Maps 0.9.0)**; besluiten in CLAUDE.md
- Scope: eigen afbeelding toevoegen aan "Mijn assets" (zelfde validatie als WP59), plaatsen als object, meenemen in export, verwijderen alleen als ongebruikt (of met waarschuwing).
- Acceptatie: (1) kaart met eigen assets → export → import elders is compleet; (2) ongebruikte assets niet in de export; (3) quota-waarschuwing bij hoog gebruik.
- Grootte M: hergebruikt WP59/WP60.
- Uitvoering: Mijn assets = één bibliotheek per apparaat (store `mine`, DB versie 3), geen asset-record in het kaartdocument zoals §2.3 voorstelde: een object verwijst met de sha, naam en standaardgrootte staan in het item. Verwijderen uit Mijn assets haalt alleen het item weg (kaarten houden de afbeelding, opruimen pas als niets er meer naar verwijst), met gebruik vooraf in de beheerrij en in de melding. Schema 5 = kaart met een eigen asset. Opgeslagen ≤ 1024 px (WP66: meten, zo nodig bijstellen).

**WP65 · Responsief, touch en eerste gebruik afronden** · M — **klaar (Maps 0.10.0)**; besluiten in CLAUDE.md (zijpaneel rechts vanaf 768 px, ?-overzicht + link in paneel Kaart, uitleg in een lege kaart, Enter verft op de cursorcel, foutregels onder de rij, naam Inn Sight; handmatige check (3) door Michiel staat nog open)
- Scope: telefoonindeling (dock), tabletzijpaneel, desktop-sneltoetsen met "?"-overzicht, lege toestanden, korte uitleg bij eerste gebruik (geen pop-up bij opstarten, conform CLAUDE.md), foutmeldingen nalopen. **Actiepunt (melding Michiel 28-10, schermafbeelding Maps 0.4.0):** een foutregel onder een veld in een rij van twee (Kolommen/Rijen, ook Pixels per cel/Cellen in de breedte) duwt het buurveld omlaag, zodat de velden niet meer op één lijn staan en de tekst over twee regels loopt. Oplossing: foutregel buiten het `<label>` en onder de hele rij (één regel over beide kolommen), velden blijven op dezelfde hoogte; geldt voor alle foutregels in paneel Kaart.
- **Hernoemen naar Inn Sight (D13):** alle zichtbare tekst in beide talen (`locales/src/{en,nl}/maps.js`: o.a. `maps.title`, `maps.page.title`, `maps.tab.text`, `maps.exp.title`, `maps.imp.err.format`/`newer`, daarna `node tools/i18n-build.mjs` en `node tools/pages.mjs`), `APP` in `js/maps/version.js` (komt als `app` in het projectbestand) en de exportnaam `fileName` → `inn-sight-<slug>-…json`. Engelse tekst langs de vertaalagent. **Bewust niet hernoemd** (zoals bij Kev’s Inn itiative): `FORMAT` `kevs-inn-maps`, IndexedDB-naam, cachenaam, `maps-*`-sleutels in localStorage, pad `/maps/`, map `js/maps/`, namespace `maps.`. Oude bestanden blijven daardoor importeerbaar (`readFile` kijkt naar `format`, niet naar `app`).
- Acceptatie: (1) kernflow (nieuwe kaart → achtergrond → object → verven → export) op iPhone SE-breedte (320), iPad portret en desktop zonder horizontaal scrollen; (2) alle knoppen hebben `aria-label`, focus zichtbaar; (2b) een foutregel verschuift geen buurveld (browsercheck: velden in een rij houden dezelfde `top` met en zonder fout); (2c) geen "Inn the Grid" meer in de catalogi of op de pagina (test), een bestand met `app: "Inn the Grid 0.x"` importeert nog (fixture); (3) Michiel doet de kernflow op zijn telefoon zonder hulp (handmatig).
- Grootte M.

**WP66 · Prestaties en grenzen** · M — **klaar (Maps 0.11.0)**; besluiten en meetwaarden in CLAUDE.md (kaartbuffer met verschuiven en zoomvoorbeeld, hexranden één keer, `LIMITS` in `model/limits.js`, import > 2000 objecten geweigerd, meetstand `/maps/?bench`, kleine onderdelen tot 512 px). Acceptatie (2) en (3) aangetoond, (1) desktop aangetoond (headless 59–60 fps); (1) iPad aangetoond 29-10: pannen 35/34 fps, zoomen 41 fps, openen 1,8 s (alles Goed; marge klein, zie CLAUDE.md)
- Scope: meetscenario 100×100 + 2000 objecten + achtergrond 4096 px; offscreen-buffers, culling, tekenen alleen bij verandering (`requestAnimationFrame`), `LIMITS` centraal, geheugenmeting.
- Acceptatie: (1) pannen/zoomen ≥ 30 fps op Michiels oudste iPad, ≥ 50 fps desktop (meetscript); (2) openen van de meetkaart < 2 s op desktop; (3) grenzen gehandhaafd met melding.
- Uit WP61: `render/art.js` begrenst de bitmap op 256 px per cel (onscherp bij dpr 3 en 400 %): meten en zo nodig 512 voor kleine onderdelen.
- Risico: tegenvallende iPad → lagere grens voor gratis versie (D10).
- Grootte M.

**WP67 · Uitbrengen losstaande editor** · S · **klaar 29-10-2026 (Maps 1.0.0)**
- Scope: volledige developer-review (x.y.0), README/CLAUDE.md (naam Inn Sight in regel 3, subsectie "Gemaakte keuzes → Inn Sight", stap 3 van "Bij elke wijziging", lijst bewust niet hernoemd), ROADMAP en de titel van dit plan, D13 bevestigen dat het pad `/maps/` blijft (advies: houden, padsegmenten zijn functioneel en Engels; een nieuw pad vraagt redirects en een nieuwe sw-scope voor niets), beslissen over homepage-kaart (met de naam Inn Sight), eigen manifest/installeerbaar en indexeren (§9.2 stap 8, D7).
- Acceptatie: besluiten D7 vastgelegd; live-checklijst afgevinkt.
- Uitkomst: D13 pad `/maps/` bevestigd; D7: toolkaart op de homepage (met label Beta), installeerbaar pas in WP68, `noindex` blijft; documentatie op Inn Sight (CLAUDE.md "Gemaakte keuzes → Inn Sight → Uitbrengen").

→ **Mijlpaal M2.**

### Fase 2 — Mooi maken
**WP68 · Vormgevingsronde Inn Sight** · M–L (pas na M2; eerst mockup ter goedkeuring zoals CLAUDE.md vraagt). Huisstijl-consistentie, betere ingebouwde assets, onboarding-polish. Op te splitsen na de UX-schets.
**Klaar** in vier deelpakketten (68a huisstijl, 68b eerste gebruik + raster-chip, 68c assets hertekend, 68d installeerbaar per taal; Maps 1.1.0–1.4.0). Details en afwijzingen in CLAUDE.md, "Inn Sight".

### Fase 3 — Koppeling met Initiative (pas na M2 en akkoord)
**WP69 · Gedeelde kaartlezer en kaart kiezen bij een encounter** · L — **Klaar (30-10-2026, Initiative 2.12.0, Maps 1.4.1)**: verwijzing `map: { id, name }`, geen kopie; backup blijft v4; import vanuit Initiative komt in de Inn Sight-bibliotheek; brug `js/ui/encmap.js` (dynamisch). Details in CLAUDE.md, "Inn Sight → Koppeling met Initiative".
**WP70 · Kaart tonen in Initiative (DM, alleen kijken)** · M — **Klaar (30-10-2026, Initiative 2.13.0)**: knop Kaart in de encounterstrip, viewer vol scherm tot aan de dock (Volgende blijft bruikbaar), pannen/zoomen met de renderer van Inn Sight via de brug, alleen lezen; `S.enc` neemt de verwijzing mee (backup v4). Details in CLAUDE.md, "Inn Sight → Kaart bekijken in Initiative".
**WP71 · Spelerskaart op hetzelfde apparaat** · L — **Klaar (30-10-2026, Initiative 2.14.0)**: schakelaar "Tonen aan spelers" in de viewer (sessie, één kaart), plat JPEG-beeld als Blob alleen via het lokale kanaal, `map: { k, w, h, img }` (whitelist), tv: kaart links met de lijst als kolom. Details in CLAUDE.md, "Inn Sight → Spelerskaart op hetzelfde apparaat".
**WP72 · Spelerskaart via de kamer** · L–XL — **Klaar (30-10-2026, Initiative 2.15.0)**: besluit Michiel: opknippen (stukken van 60 000 tekens, max 32 ≈ 1,4 MB, eigen sleutels in de kamer, spelers tonen de kaart pas compleet; `flatMap` blijft onder het budget). Details in CLAUDE.md, "Inn Sight → Spelerskaart via de kamer".

### Fase 4 — Zicht en tokens
**WP73 · Handmatige fog of war** · L — **Klaar (30-10-2026, Maps 1.5.0, Initiative 2.16.0)**: bewerken in Inn Sight (paneel Kaart + fogmodus) en in de kaartviewer van Initiative, bewaard in de kaart (schema 6), ingebakken in het spelersbeeld. Details in CLAUDE.md, "Inn Sight → Fog of war".
**WP74 · Vrije tokens** · L — **Klaar (30-10-2026, Maps 1.6.0, Initiative 2.17.0)**: schijf + label, D&D-grootte, verborgen voor spelers per token, geplaatst in Inn Sight (tab Tokens) en te slepen in de kaartviewer; eigen veld `toks` (schema 7, "laatste wijziging wint" zoals fog). Details in CLAUDE.md, "Inn Sight → Vrije tokens".
**WP75 · Tokens gekoppeld aan deelnemers** · L (afhankelijk van WP69, ook `anon`/verborgen-regels van het spelersscherm respecteren).

### Kritiek pad
WP56 → WP57 → WP58 → WP59 → WP60 (**M1**) → WP61 → WP62 → (WP63, WP64 parallel mogelijk) → WP65 → WP66 → WP67 (**M2**) → WP69 → WP71 → WP73.
Kleinste waardevolle eind-tot-eind-release: **M1**.

---

## 5. Besluitenregister

### Onderbouwd door de repo
| # | Besluit | Bewijs |
|---|---|---|
| E1 | Zelfde repo, eigen map `js/maps/`, eigen IndexedDB | §9.2 nieuwe-tool-procedure, gedeelde hosting/i18n/tests; zelfde origin maakt latere koppeling zonder backend mogelijk |
| E2 | Geen framework/bibliotheek, ES-modules, pure model-laag met Node-tests | CLAUDE.md Techniek |
| E3 | JSON-formaat met `format`/`version`, migraties en opschoning | `js/backup.js`-patroon, CLAUDE.md |
| E4 | Spelersscherm alleen via expliciete whitelist; kaart naar spelers als plat beeld | `toPlayerView`/`cleanView`; kamerlimieten 96/64 KB |
| E5 | Teksten via `maps.*`, id's in opslag, gebruikersinhoud onvertaald | docs/i18n.md §9.1 |

### Aanbevelingen, wachten op akkoord
| # | Vraag | Advies |
|---|---|---|
| D1 | Pad | **Besloten 28-10: `/maps/` en `/nl/maps/`** (code, catalogus en opslag heten ook `maps`; de productnaam staat los daarvan, zie D13) |
| D13 | Naam | **Besloten 28-10: Inn Sight** (was Inn the Grid). Zichtbaar in WP65, documentatie in WP67; **pad `/maps/` bevestigd 29-10 (WP67)** |
| D2 | Versie | **Besloten 28-10: Inn the Grid krijgt een eigen versienummer**; de bestaande nummers zijn van Inn itiative; de homepage krijgt geen nummer. Uitwerking zie §2.10. Startversie 0.1.0, 1.0.0 bij M2 (WP67). |
| D3 | Tekentechniek | **Besloten 28-10: Canvas 2D, eigen code, voor nu**; WP66: blijft (met de kaartbuffer ruim binnen de doelen, headless) |
| D4 | Projectbestand | **Besloten in WP60 op het advies: optie A, één JSON met base64-assets** (formaat §8) |
| D5 | Extensie | **Besloten in WP60 op het advies: `.json`** (iOS-bestandskiezer kent die; `format` maakt het herkenbaar) |
| D6 | Ingebouwde assets | **Besloten in WP61 op het advies: eigen eenvoudige SVG's** (licentieschoon, zoals "geen niet-SRD content"), 24 stuks in `data/maps-assets/` |
| D7 | Zichtbaarheid | **Besloten 29-10 (WP67, op het advies): toolkaart op de homepage (label Beta); installeerbaar pas in WP68 (eigen manifest + icoon); `noindex` blijft**. WP68 (Michiel, 29-10): installeren in 68d (klaar, Maps 1.4.0), één app per taal (`/maps/` en `/nl/maps/`) |
| D8 | Koppeling (fase 3) | **Besloten 30-10 (WP69)**: zelfde-origin lezen via de brug `js/ui/encmap.js` + kaartbestand importeren als terugval (in de Inn Sight-bibliotheek); encounter bewaart een verwijzing, geen kopie |
| D9 | Reviewers in de functionele fase | Volgens CLAUDE.md; UX-agent alleen bij echte keuzes, vormgeving pas in WP68 |
| D10 | Grenzen | **Kaart: besloten in WP57 op het advies, max 100×100 cellen**; objecten: 2000, bevestigd in WP66 (headless en op de oudste iPad: 34–41 fps) |
| D11 | Tabbladen | **Besloten in WP58 op het advies: eigen `maps-tab`, nieuwste wint** |
| D12 | Uploads | **Besloten in WP59 op het advies: ≤ 25 MB invoer, opgeslagen ≤ 4096 px, alleen PNG/JPEG/WebP** (daarbij: weigeren boven 16384 px per zijde of 36 MP, vóór het decoderen) |

### Echt blokkerend vóór WP56
Geen meer: D1–D3 zijn besloten. De rest start op het advies en wordt per pakket bevestigd.

---

## 6. Documentatie
- `docs/g4-inn-the-grid.md` (dit bestand, sinds 28-10-2026): plan en besluiten, zoals `docs/g1-regels-2024.md`; bestandsformaat v1 in §8 (WP60).
- Hieronder: wijzigingen die pas met de werkpakketten komen.
- **CLAUDE.md**: regel 3 aanvullen ("De repo bevat ook Inn the Grid op `/maps/`"); nieuwe subsectie "Gemaakte keuzes → Inn the Grid" die per WP groeit; bij "Bij elke wijziging" stap 3 een zin over `GRID_VERSION` (na D2). Bestaande regels niet herschrijven.
- **ROADMAP.md**: G4 → "in uitvoering, plan in `docs/g4-inn-the-grid.md`", met de WP-lijst.
- **README.md**: structuur aanvullen met `js/maps/`, `pages/maps.html`, `data/maps-assets/`.
- **docs/i18n.md**: geen wijziging nodig (procedure wordt gevolgd); §9.2 aanvullen met de catalogus per tool (`locales/maps/<taal>.js`, §2.10).

---

## 7. Volgende stap
WP56–WP74 zijn klaar (M1 en M2 bereikt, fase 3 af, van fase 4 WP73 en WP74); wat geldt staat in CLAUDE.md, "Gemaakte keuzes → Inn Sight". Volgende: WP75 (tokens gekoppeld aan deelnemers).

---

## 8. Bestandsformaat v1 (WP60)
Eén kaart volledig en zelfstandig in één JSON-bestand (`js/maps/model/file.js`, tests `tests/maps-file.test.js`, kapotte en kwaadaardige voorbeelden in `tests/fixtures/maps/`, gemaakt met `tools/maps-fixtures.mjs`).

```json
{
  "format": "kevs-inn-maps",
  "version": 1,
  "exported": "2026-10-28T12:00:00.000Z",
  "app": "Inn the Grid 0.5.0",
  "map": { "schema": 2, "name": "Crypte", "createdAt": 1761600000000, "updatedAt": 1761600000000,
           "grid": { "type": "square", "orient": "pointy", "cols": 30, "rows": 20, "show": true, "color": "auto", "alpha": 50 },
           "bg": { "asset": "<sha256>", "w": 2100, "h": 1400, "ppc": 70, "x": 0, "y": 0 } },
  "assets": { "<sha256>": { "mime": "image/webp", "w": 2100, "h": 1400, "data": "<base64>" } }
}
```
- `map` = het kaartdocument zoals in de opslag (§2.3, `cleanMap`), **zonder `id`**: geen verwijzing naar browseropslag; import geeft altijd een nieuwe id, tijden = nu, naam via `uniqueName` (nooit overschrijven). `bg` en dus `assets` alleen als er een achtergrond is (schema 2); objecten (WP61) als optioneel veld `objs` (schema 3, `cleanObjs`; ingebouwde onderdelen alleen als id, niet als afbeelding; een onbekende id blijft bewaard en wordt als plaatshouder getekend); terrein (WP63) als optioneel veld `terr` (schema 4, `cleanTerr`: vast raster, palet van alleen gebruikte id's, onbekende id blijft en wordt een plaatshouder; bestandsversie blijft 1). Eigen assets (WP64): een object met een sha256 als `asset` (schema 5); die afbeelding staat in `assets` zoals de achtergrond, met optioneel `name` (naam in Mijn assets, gebruikersinhoud, max 40); dezelfde controles en foutcodes; ontbreekt hij = `missing`. Fog (WP73) als optioneel veld `fog` (schema 6 als hij aan staat) en tokens (WP74) als optioneel veld `toks` (schema 7 met tokens; een tokenveld dat geen object is of meer dan 200 tokens = `badmap`); bestandsversie blijft 1.
- `assets` bevat precies de afbeeldingen waar de kaart naar verwijst (achtergrond en eigen assets op objecten, elk één keer; ongebruikte items uit Mijn assets nooit); sleutel = sha256 (hex) van de bytes in `data`; `w`/`h` = afmetingen van die opgeslagen bytes (≤ 4096 px). `src` (sha256 van het origineel, index in de opslag) gaat bewust niet mee en wordt bij import genegeerd; een bestaande asset met dezelfde sha wordt niet overschreven.
- Bestandsnaam `inn-the-grid-<kaartnaam>-YYYY-MM-DD-HH-MM.json` (lokale tijd, slug van de naam, max 40 tekens, leeg = `map`).
- Schrijven: als Blob uit tekststukken (`buildParts`, base64 per 48 KB), nooit één enorme string. Ontbreekt een afbeelding (opslag gewist), dan geen bestand maar een melding.
- Lezen (`readFile`, volgorde = foutcode `maps.imp.err.<code>`): leeg (`empty`), > 35 MB (`big`, vóór het inlezen), geen JSON (`notjson`), ander `format` of geen geheel `version` ≥ 1 (`format`), `version` > 1 of kaartschema nieuwer dan de app (`newer`), migraties `MIGRATE[v]` per stap (nu leeg), kaart onbruikbaar of `bg` onbruikbaar (`badmap`, een achtergrond gaat nooit stil verloren), afbeelding niet in het bestand (`missing`), kapotte base64 (`b64`), mime buiten PNG/JPEG/WebP, magic bytes ≠ mime, afmetingen uit de kop ≠ `w`/`h` of boven de grenzen (`image`), sha256 ≠ sleutel (`sha`); daarna decodeert de browser de afbeelding (mislukt = `image`) en bewaart asset en kaart (mislukt = `store`). Een versie omhoog = `FILE_VERSION` ophogen en een migratie toevoegen; optionele velden mogen zonder nieuwe versie (een oudere app laat ze via `cleanMap` weg).
