# G7 · Dobbelstenen zichtbaar maken (gedeelde module)

Werkpakketten WP80–WP83; het fundament (WP79: `js/dice/roll.js`, adapters `js/ui/rolls.js`) staat er. Eerste gebruiker is Initiative; de module is vanaf het begin gedeeld zodat Innhabitants en andere Kev’s Inn-tools (G5) hem kunnen hergebruiken zonder hem opnieuw te bouwen. Architectuur en besluiten: `docs/DECISIONS.md` → "Techniek" (bullet **Gedeelde dobbelsteenmodule (G7)**).

## Inventaris (31-10-2026)
- `js/rules/dice.js`: alleen `d`, `rollExpr`, `HD_RE`, `avgExpr` en de hulpjes `mod`, `sgn`, `uid`.
- Elke worpsoort heeft een eigen vorm en tekstfunctie:
  - aanval: `rollAttack`/`withAdv` → `{ dd, d, adv, nat, bo, m, tot }`, tekst `atkText` (`js/rules/attacks.js`), HTML `atkHtml` (`js/ui/render.js`, doorgestreepte d20);
  - schade: `rollDmg`/`rollDmgCrit` → `parts[{ e, type, rolls, mod, total, xr }]`, tekst `partText`; AoE-actie `actionAoe().roll` (tekst);
  - save: `rollSave` → `{ r, r2, bo, x, av, aw, tot }`, tekst `rollText` (`js/rules/aoe.js`);
  - initiative: `initThrow` → `{ r, v, txt }`, `rerollMonsters` (`js/rules/turns.js`);
  - death save: `rollDs` (`js/rules/combat.js`) en `ds-roll` in `js/ui/actions.js`;
  - direct in de UI: party-initiative (`actions.js` ± r. 1127 en 1961), initiative-paneel (± r. 1885), monsters toevoegen (± r. 103–107), statblock-tikken (`.dice`/`data-roll`, `diceify` in `js/ui/statblock.js`).
- Precedent voor gedeelde code: `js/theme.js` en `js/i18n/*` (in `ASSETS` van `sw.js`, wijzigen = Initiative-release; instelling per apparaat in localStorage, `it-theme`).

## Architectuur (besloten 31-10-2026)
Drie lagen, gewone functies, geen framework, registry of event-bus:
1. **Logica** `js/dice/roll.js` (puur, rng injecteerbaar): worpformaat + rollen.
2. **Weergave** `js/dice/view.js` + `css/dice.css`: worp → HTML (pure functie). Stap 2: `js/dice/anim.js` + `js/dice/pref.js`.
3. **Integratie per tool**: adapters van de eigen regelvormen naar het worpformaat, in de code van de tool (Initiative: `js/ui/rolls.js`). `js/rules/` blijft ongewijzigd.

Afhankelijkheden lopen alleen naar binnen: `js/dice/*` importeert uitsluitend `js/i18n/*` (en elkaar). Nooit `js/rules`, `js/ui`, `js/state.js`, `js/maps` of een andere tool.

**Worpformaat** (niet opgeslagen; alleen in het geheugen en in de weergave):
```
{ label?,                      // "Bite", "Dex save", vrije tekst van de tool (escapen bij tonen)
  g: [{ c, die, vals, keep, kn?, s?, x?, t? }], // c = aantal stenen (1d20 → 1, advantage → 2), vals = alle gerolde waarden,
                               //   keep = "all" | "high" | "low", kn = hoeveel er tellen bij high/low (standaard 1; welke: kept()),
                               //   s = -1 afgetrokken groep, x = extra waarden (crit-dice), los zichtbaar, t = damage type (id)
  m: [{ n, b, t? } | { n, die, v }], // modifiers met naam: vast (+5 Strength) of een steen (Bless 1d4 → 3; negatief die = aftrek);
                               //   n "" = bonus zonder naam; een bonus 0 laten de adapters weg
  tot,                         // totaal (tool-uitkomst wint: de module rekent niet opnieuw als tot is gegeven)
  nat?,                        // de d20 die telt (alleen bij één d20-groep)
  adv?,                        // 1 | -1 | 0
  vs?,                         // { k: "AC" | "DC", n } optioneel doel
  ok? }                        // true/false/undefined: geslaagd/mislukt/onbekend
```
Nieuwe velden zijn altijd optioneel; de weergave negeert wat ze niet kent. Een tool met regels (Initiative) levert `tot` en `ok` zelf; de module beslist geen spelregels behalve nat 20/nat 1 als markering.

---

## WP80 · Worpweergave en het aanvalspaneel · M — Gepland
- Roadmap: G7 stap 1.
- Doel en scope: `js/dice/view.js` + `css/dice.css` en toepassing in het aanvalspaneel (`#xsheet`: to-hit en schade). Buiten scope: andere panelen (WP81), log en spelersscherm (besluit: blijven tekst).
- Functionele eisen: per groep de afzonderlijke stenen met hun soort (d20, d6…); bij advantage/disadvantage beide d20's met duidelijk welke telt (de andere gedimd/doorgestreept, niet alleen door kleur); modifiers met naam; crit-dice (`x`) apart zichtbaar; nat 20/nat 1 gemarkeerd; totaal en doel ("vs AC 16"). Alles leesbaar op 320 px zonder horizontaal scrollen. Schermlezer: één `aria-label` met de hele worp als tekst.
- Technische uitwerking: `diceHtml(roll, opts)` (alles via `esc()`), `diceText(roll)` (zelfde inhoud als platte tekst voor `aria-label`); i18n-namespace **`dice.`** (`NS` in `tools/i18n-build.mjs`, `locales/src/{en,nl}/dice.js`, in de hoofdcatalogus); de notatie (`2d10 + 6`, `d20`) is taalneutraal (`docs/i18n.md` §4). `css/dice.css` laden in `pages/initiative.html` en in `ASSETS`. `atkHtml` in `render.js` vervangen door `diceHtml(fromAtk(…))`; tekst voor log en toast blijft `atkText`/`partText`.
- **UX vóór het bouwen**: UX-agent zet minstens twee opties naast elkaar (bijv. stenen als vormpjes vs. compacte chips), mockup ter goedkeuring aan Michiel. Kleur volgens de eigenaarschapsregels: geen goud, rood alleen voor kritiek (DECISIONS → "Huisstijl").
- Relevante besluiten: DECISIONS → "Techniek", "Huisstijl", "Gevecht: kaarten en panelen" (aanvalspaneel), "Meertaligheid (geldt voor elke tool)".
- Afhankelijk van: goedgekeurde mockup (WP79 is af).
- Acceptatiecriteria: unit-test op `diceHtml`/`diceText` (escapen van `label` en modifiernamen, adv/dis, crit, nat 1, onbekend veld genegeerd); bestaande aanvalstests ongewijzigd; contrasttest dekt de nieuwe kleuren; browsercheck nieuw scenario `wp80` (aanvalspaneel met advantage + crit) op 320/360/390 licht/donker, `--lang=en` en `--i18n=xx`; vertaalagent.
- Volgorde: eerst.
- Versie: Initiative x.y.0 (zichtbaar nieuw onderdeel).
- Aandachtspunten: de weergave rekent niets uit; werkt zonder JS-animatie; geen nieuwe tikdoelen in de worp zelf (alleen weergave).

## WP81 · Uitrol naar de overige worpen · M — Gepland
- Roadmap: G7 stap 1.
- Doel en scope: dezelfde weergave in saves/AoE (`rollSave`, `actionAoe`, schade-spells), initiative-paneel (`initThrow`, party-rol), death saves, HP rollen bij toevoegen, en de toast na een statblock-tik (`data-roll`). Buiten scope: log en spelersscherm.
- Functionele eisen: elke worp toont stenen, welke telt, modifiers met naam (Bless/Bane-d4, cover, Exhaustion 2024), totaal en ✓/✗ tegen de DC waar die bekend is. Lange lijsten (AoE met veel doelen) blijven compact: per doel één regel.
- Technische uitwerking: de directe `d(20)`-aanroepen in `js/ui/actions.js` lopen via `js/dice/roll.js` (`d20(…)`), resultaat via de adapters in `js/ui/rolls.js`; tekst voor log en meldingen ongewijzigd (`rollText`, `initThrow().txt`).
- Relevante besluiten: DECISIONS → "Initiative en beurten", "Gevecht: kaarten en panelen", besluiten G1 (Exhaustion/surprise per editie).
- Afhankelijk van: WP80.
- Acceptatiecriteria: adapters per worpsoort getest; G1-tests (`wp55`, `room` "G1") ongewijzigd groen; browsercheck-scenario `wp81` (AoE met save + Bless, initiative-paneel met 2024-disadvantage, death save) plus de geraakte bestaande scenario's; `--lang=en`, `--i18n=xx`; vertaalagent bij nieuwe tekst.
- Volgorde: na WP80.
- Versie: Initiative x.y.z.
- Aandachtspunten: het initiative-paneel heeft een eigen cijferpad; de weergave mag het niet wegduwen op 320 px.

## WP82 · Vrije dobbelsteenworp in Initiative · M — Gepland
- Roadmap: G7 stap 1 (besluit Michiel 31-10-2026: meenemen).
- Doel en scope: een vrije worp voor de DM aan tafel (bijv. `1d20+5`, `4d6kh3`, `8d6`, d20 met advantage), met dezelfde weergave. Buiten scope: worpen bewaren, delen met spelers, macro's.
- Functionele eisen: snelknoppen voor de gangbare stenen (d4, d6, d8, d10, d12, d20, d100) en aantal/modifier, plus vrije invoer; advantage/disadvantage voor d20; laatste worpen alleen in deze sessie (UI-toestand, niet in undo, opslag of export); werkt offline. Geen logregel (vrije worpen zijn geen gevechtsstand).
- Technische uitwerking: paneel in een `.sheet-wrap` (rondleiding, sneltoetsen, meldingen); `parseExpr`/`dice` uit `js/dice/roll.js`; tekst `dice.*` (gedeeld) en de Initiative-knop onder `init.*`; invoerveld ≥ 16 px en zonder `inputmode="numeric"` (minteken).
- **UX vóór het bouwen**: plek van de ingang (bijv. knop in de kopbalk vs. in het ⋯-menu vs. sneltoets) en indeling van het paneel, met mockup ter goedkeuring. Bewaakt: geen stippen of meldingen bij opstarten, tikdoelen ≥ 44 px, duimbereik.
- Relevante besluiten: DECISIONS → "Techniek" (panelen, invoervelden, UI-toestand), "Modi en indeling".
- Afhankelijk van: WP80 (weergave); kan parallel aan WP81.
- Acceptatiecriteria: parser- en rolltests (in `tests/dice.test.js`); paneel getest op ongeldige invoer (melding, geen fout in de console); `tests/tap.test.js` groen; browsercheck-scenario `wp82` op 320/360/390 licht/donker, `--lang=en`, `--i18n=xx`; rondleiding/sneltoetsen kennen het paneel; vertaalagent.
- Volgorde: na WP80.
- Versie: Initiative x.y.0.
- Aandachtspunten: het paneel staat in Initiative-code; de rollogica blijft in `js/dice/`, zodat Innhabitants later alleen een eigen ingang hoeft te bouwen.

## WP83 · Optionele rolanimatie (stap 2) · M — Gepland
- Roadmap: G7 stap 2.
- Doel en scope: korte rolanimatie op de bestaande weergave, met één instelling voor alle Kev’s Inn-tools. Buiten scope: 3D, geluid, animatie op het spelersscherm.
- Functionele eisen: de uitslag staat direct in de DOM en is meteen leesbaar en tikbaar; de animatie is alleen versiering (≤ ± 400 ms) en wacht nooit; uit bij `prefers-reduced-motion`; instelling aan/uit per apparaat, gedeeld door alle tools (besluit Michiel 31-10-2026), te wijzigen in Instellingen van Initiative.
- Technische uitwerking: `js/dice/pref.js` (`diceAnim()`, `setDiceAnim(on)`, localStorage-sleutel `kevs-dice-anim`, try/catch zoals `js/theme.js`); `js/dice/anim.js` (`animate(el)`: CSS-klassen op het element uit `diceHtml`, geen timers die de flow blokkeren); schakelaar in `js/ui/settings.js`. Standaardwaarde: zie open besluit **G7-O1**.
- **UX vóór het bouwen**: twee animatievarianten naast elkaar (bijv. waarden die doortellen vs. steen die kantelt), duur en wat er gebeurt bij snel achter elkaar tikken.
- Relevante besluiten: DECISIONS → "Techniek", "Huisstijl".
- Afhankelijk van: WP80 (en bij voorkeur WP81/WP82, zodat alle worpen meedoen); besluit G7-O1.
- Acceptatiecriteria: test op `pref.js` (onbruikbare localStorage → valt terug zonder fout); test dat `animate` niets doet bij reduced motion of uit; browsercheck met de instelling aan en uit (geen JS-fouten, geen horizontaal scrollen, uitslag direct zichtbaar); volledige Initiative-regressie (x.y.0).
- Volgorde: laatste.
- Versie: Initiative x.y.0.
- Aandachtspunten: een tool met eigen cache (Inn Sight) die later dobbelstenen gebruikt, neemt `js/dice/*` en `css/dice.css` op in zijn eigen assets en catalogus (`dice.` dan ook in die lader); de sleutel `kevs-dice-anim` blijft gelijk.
