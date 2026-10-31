# G4 · Inn Sight — technische referentie (architectuur en bestandsformaat)

**G4 is afgerond** (WP56–WP75, Maps 0.1.0–1.7.0, 28–30-10-2026). Dit bestand bevat alleen nog de architectuur (§2) en het projectbestandsformaat v1 (§8): codecommentaar verwijst naar deze secties, dus nummering en bestandsnaam blijven. Geldende keuzes per pakket staan in `docs/DECISIONS.md` ("Gemaakte keuzes → Inn Sight"), besluiten E1–E5 en D1–D13 in `docs/DECISIONS.md` ("Besluiten G4"). Inventaris (§1), MVP-plan (§3), werkpakketten (§4), besluitenregister (§5), documentatieplan (§6) en volgende stap (§7) zijn op 31-10-2026 verwijderd (afgerond of verplaatst; volledige tekst in de git-geschiedenis vóór die datum).

Naam: de tool heette tot WP65 **Inn the Grid** (D13); oudere passages hieronder noemen die naam nog. Legenda: **[F]** geverifieerd in de repo · **[C]** conclusie · **[A]** aanbeveling op het moment van plannen (inmiddels uitgevoerd tenzij `docs/DECISIONS.md` iets anders zegt).

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
- **Tokens** (WP74, `toks`): `{ at, list: [{ id, x, y, s, c, l, hide?, p? }] }`, eigen veld (geen objectlaag) omdat ook de kaartviewer het schrijft; "laatste wijziging wint" op `at`, zoals fog. Schema 7; met een gekoppeld token (`p`, WP75) schema 8.
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
- Grotere kaarten als betaalde functie: grenzen staan op één plek (`LIMITS`, sinds WP66 in `js/maps/model/limits.js`).

---

### 2.10 Eigen versienummer (D2)
- **[F]** Nu: één service worker (scope `/`), één cache `initiative-tafel-<VERSION>`; `VERSION` = `js/version.js` = `it-version` (test). Er is al een voorbeeld van een cache met een eigen versie: `VENDOR` (pdf.js), die bij een app-update blijft staan en alleen ontbrekende bestanden ophaalt.
- **[A]** Inn the Grid krijgt hetzelfde patroon: `MAPS_VERSION` in `sw.js` (gelijk aan `js/maps/version.js`, test), eigen cache `kevs-inn-maps-<MAPS_VERSION>` met alleen de Maps-bestanden (pagina's `/maps/`, `/nl/maps/`, `js/maps/*`, `css/maps.css`, assets, catalogus). `activate` ruimt alleen verouderde caches van dezelfde familie op.
- Gevolg 1: `sw.js` verandert bij elke Maps-release (dat moet, anders ziet de browser geen update). Install haalt Initiative-bestanden dan alleen op als ze nog niet in de cache van de huidige Initiative-versie staan (veilig: elke Initiative-wijziging verhoogt die versie). Zo kost een Maps-release Initiative-gebruikers geen nieuwe download van monsterdata.
- Gevolg 2: de catalogus is nu één bestand per taal voor alle tools (`locales/<taal>.js`, §9.2). Een nieuwe Maps-tekst zou dan in de Initiative-cache blijven hangen tot de volgende Initiative-release. Daarom krijgt Maps een **eigen catalogusbestand** (`locales/maps/<taal>.js`), zoals §9.2 al voorziet ("pas splitsen per tool").
- Gedeeld en dus onder het Initiative-nummer blijven: kleurtokens (`css/app.css`), fonts, iconensprite, `js/i18n/*`, `js/theme.js`, homepage. Een wijziging daaraan blijft een Initiative-release. De homepage toont geen versie.

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
- `map` = het kaartdocument zoals in de opslag (§2.3, `cleanMap`), **zonder `id`**: geen verwijzing naar browseropslag; import geeft altijd een nieuwe id, tijden = nu, naam via `uniqueName` (nooit overschrijven). `bg` en dus `assets` alleen als er een achtergrond is (schema 2); objecten (WP61) als optioneel veld `objs` (schema 3, `cleanObjs`; ingebouwde onderdelen alleen als id, niet als afbeelding; een onbekende id blijft bewaard en wordt als plaatshouder getekend); terrein (WP63) als optioneel veld `terr` (schema 4, `cleanTerr`: vast raster, palet van alleen gebruikte id's, onbekende id blijft en wordt een plaatshouder; bestandsversie blijft 1). Eigen assets (WP64): een object met een sha256 als `asset` (schema 5); die afbeelding staat in `assets` zoals de achtergrond, met optioneel `name` (naam in Mijn assets, gebruikersinhoud, max 40); dezelfde controles en foutcodes; ontbreekt hij = `missing`. Fog (WP73) als optioneel veld `fog` (schema 6 als hij aan staat) en tokens (WP74) als optioneel veld `toks` (schema 7 met tokens, 8 met een gekoppeld token `p` (WP75); een tokenveld dat geen object is of meer dan 200 tokens = `badmap`); bestandsversie blijft 1.
- `assets` bevat precies de afbeeldingen waar de kaart naar verwijst (achtergrond en eigen assets op objecten, elk één keer; ongebruikte items uit Mijn assets nooit); sleutel = sha256 (hex) van de bytes in `data`; `w`/`h` = afmetingen van die opgeslagen bytes (≤ 4096 px). `src` (sha256 van het origineel, index in de opslag) gaat bewust niet mee en wordt bij import genegeerd; een bestaande asset met dezelfde sha wordt niet overschreven.
- Bestandsnaam `inn-the-grid-<kaartnaam>-YYYY-MM-DD-HH-MM.json` (lokale tijd, slug van de naam, max 40 tekens, leeg = `map`).
- Schrijven: als Blob uit tekststukken (`buildParts`, base64 per 48 KB), nooit één enorme string. Ontbreekt een afbeelding (opslag gewist), dan geen bestand maar een melding.
- Lezen (`readFile`, volgorde = foutcode `maps.imp.err.<code>`): leeg (`empty`), > 35 MB (`big`, vóór het inlezen), geen JSON (`notjson`), ander `format` of geen geheel `version` ≥ 1 (`format`), `version` > 1 of kaartschema nieuwer dan de app (`newer`), migraties `MIGRATE[v]` per stap (nu leeg), kaart onbruikbaar of `bg` onbruikbaar (`badmap`, een achtergrond gaat nooit stil verloren), afbeelding niet in het bestand (`missing`), kapotte base64 (`b64`), mime buiten PNG/JPEG/WebP, magic bytes ≠ mime, afmetingen uit de kop ≠ `w`/`h` of boven de grenzen (`image`), sha256 ≠ sleutel (`sha`); daarna decodeert de browser de afbeelding (mislukt = `image`) en bewaart asset en kaart (mislukt = `store`). Een versie omhoog = `FILE_VERSION` ophogen en een migratie toevoegen; optionele velden mogen zonder nieuwe versie (een oudere app laat ze via `cleanMap` weg).
