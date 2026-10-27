# Roadmap

Stand: **2.9.0** (27-10-2026). Alleen open werk staat hier. Wat klaar is, staat in de code, in CLAUDE.md ("Gemaakte keuzes") en in de git-geschiedenis. De oude roadmap met alle afgevinkte punten (codes IN, GV, VB, RE, SP, SC, AF, OB, DA, HS, TA, TS, WB en WP1–WP45) staat in commit `4e83db1`.

Codes: **K** = kleine fix of optimalisatie (één sessie, patch- of minor-versie), **G** = groot project (eerst een eigen plan met inventaris en besluiten). Een afgerond punt gaat hier weg; de keuze komt in CLAUDE.md.

## Kleine fixes en optimalisaties

Volgorde = voorstel. K1–K3 merkt de gebruiker, K4–K7 zijn technisch.

| Code | Wat | Waar | Opmerking |
|---|---|---|---|
| **K1** | Foutbalk toont fouten van browserextensies als app-fout (Safari: `webkit-masked-url://hidden/`, "runtime.sendMessage(). Tab not found") | inline foutvanger in `pages/initiative.html` (r. 16–26; het spelersscherm heeft er geen) | Pure `isOwnError(file, stack, own = location.origin)`: alleen tonen als bestand of stack bij de eigen origin hoort; rejection zonder stack wel tonen; "Script error." zonder bestand niet. Rest naar `console.warn`. Test `tests/errfilter.test.js` met `webkit-masked-url`, `safari-web-extension://`, `chrome-extension://`, `moz-extension://`. Geen tekstwijziging. |
| **K2** | Initiative-paneel telt monsters uit het vorige gevecht mee in de monster-hint, ook als "Oude wissen en starten" ze weghaalt | `monRollHtml` in `js/ui/render.js` (via `paintInit`) | Telt alle monsters in `S.list`. Bekend sinds 1.37.0. |
| **K3** | Mini-log spelersscherm: toegevoegde condities nog met komma ("Poisoned, Prone"), weggevallen al als opsomming ("Poisoned and Prone ended") | `js/playerview.js` | Array-param aan de sleutel, zoals `player.log.gone`. |
| **K4** | pdf.js als echte Worker laden in plaats van op de hoofdthread | `js/ddb.js` | Kan sinds het zelf hosten (2.2.1). Meten op een oudere iPad. |
| **K5** | pdf.js geminificeerd (nu ± 2,5 MB in een eigen sw-cache, voor iedereen) | `vendor/pdfjs/`, `sw.js` | De release-zip had geen min-build en npm/cdnjs waren niet bereikbaar. Nieuwe cachenaam bij een wissel. |
| **K6** | Undo-opslag verder verkleinen: het logboek helemaal buiten de snapshots | `js/state.js`, `js/log.js` | Eerst besluit Michiel. Nu 147 KB per stap bij 600 logregels (na −23 % in 2.2.1). |
| **K7** | Een sheet die in place wijzigt, wordt bij elke commit opnieuw gestringifyd | `js/histpack.js`, `js/state.js` | Alleen als een meting bij een grote party het rechtvaardigt. |

### Op signaal (pas bouwen als het aan tafel nodig blijkt)
- Delay/Ready-knop (nu: initiative via ⋯ aanpassen, met de RE9-logica).
- Handmatige "Defenses" van de D&D Beyond-sheet (`customDefenseAdjustments`) inlezen; tijdelijke resistances (Rage, Absorb Elements, Protection from Energy) als effect-preset.
- Negatieve waarden typen in initiative-totalen (cijferpad zonder minteken; bewust zo gelaten).
- Undead Fortitude bij rider-schade.
- D&D Beyond-import: condition immunities en vaste aftrek (Heavy Armor Master).
- DM-kant "N schermen (was M)": vraagt een scherm-id per tabblad, anders vals alarm.

### Bekende beperkingen (geaccepteerd)
- Undead Fortitude: `applyDamage` meldt al "is neer" en laat concentratie vallen vóór de save (zombies concentreren niet).
- Een DM-socket die stil wegvalt (geen close), merkt de kamer pas als de runtime hem sluit.
- DM Sans heeft geen tabular-nums: uitlijning komt uit vaste kolombreedtes.

### Operationeel (Michiel, geen code)
- `*.workers.dev`: doorsturen naar `kevs-inn.com` of uitzetten (besluit V1, nog open).
- Live check 2.3.0/2.3.1: `kevs-inn.com/en/initiative/` → 301 naar `/initiative/`; `/` = Engelse homepage; geïnstalleerde iPhone-app start in het Nederlands; versie 2.3.1 onderaan Instellingen; app offline openen vanaf het beginscherm.
- Site vindbaar maken: `HIDDEN = true` in `tools/pages.mjs` (robots `Disallow: /`). Op `false`, `node tools/pages.mjs`, daarna de sitemap in Search Console.
- Projectinstructies op claude.ai verwijzen naar `claude/werkpakketten.md` en `claude/geplande-taken-werkwijze.md`; die bestaan niet meer. De werkwijze staat in CLAUDE.md (reviewers, geplande bouwtaken).

## G1 D&D 2024-regels: werkpakketten (gepland)

Plan met inventaris, besluiten (B1–B10) en per pakket scope en acceptatiecriteria: [`docs/g1-regels-2024.md`](docs/g1-regels-2024.md). Kern: één regelset per tafel (`S.rules`, alleen buiten een gevecht te wijzigen), monster-editie als data (`ed: "2024"`, ontbreekt = huidig gedrag), SRD 5.2-monsters via Open5e, backup v4 / encounterbestand v2 alleen bij 2024-inhoud. Tot WP54 niets zichtbaar. WP46 (fundament) is klaar in 2.4.0, WP47 (SRD 5.2-monsterdata) in 2.4.1, WP48 (parsers en monster-initiative) in 2.5.0 (CLAUDE.md, "Opslag en data"), WP49 (monsterkeuze per editie) in 2.6.0 (CLAUDE.md, "Voorbereiden"), WP50 (Exhaustion en Rage 2024) in 2.7.0, WP51 (conc-DC, surprise, Grappled) in 2.8.0 (CLAUDE.md, "Gevecht"), WP52 (condities-uitleg 2024, `ed` in de spelerssnapshot) in 2.9.0 (CLAUDE.md, "Gevecht" en "Spelersscherm").

| Code | Wat | Na | Omvang |
|---|---|---|---|
| **WP53** | Moeilijkheid 2024 (XP-budget SRD 5.2.1) en XP-label | WP46 | M |
| **WP54** | Instellingen → Regels 2014 \| 2024 zichtbaar, Spells als subinstelling bij 2014 (UX-agent) | WP46–WP53 | M |
| **WP55** | Integratie, regressie, documentatie, G1 afsluiten | WP54 | S |

Besloten (27-10): standaard regelset 2014, release stapsgewijs in 2.x, Spells 2024 onder regels 2014 blijft. V4 besloten in WP49: zoekwoord `2014`/`2024` plus regel onder de lijst. Nog open: "4 in Lair" op signaal.

## Grote projecten (lange termijn)

Nog niet uitgewerkt. Elk project begint met een plan: inventaris in de code, open besluiten, werkpakketten.

| Code | Project | Open besluiten en afhankelijkheden |
|---|---|---|
| **G1** | **D&D 2024-regels** naast 2014. **Uitgewerkt**: zie "G1 D&D 2024-regels: werkpakketten" hierboven en `docs/g1-regels-2024.md`. Weapon mastery valt erbuiten (spelers rollen zelf). | Besloten: één regelset per tafel, wel SRD 5.2-monsters. Nog open: V1–V5 in het plan. |
| **G2** | **Accounts en sync** (fase 2), local-first blijft de basis. Eerste collectie `encounters` (heeft `id` + `updatedAt`, nieuwste wint). Daarna: delen met een co-DM, vaste kamercode per campagne (`isOwner` in `worker/room.js`), taalvoorkeur in het account (nieuwste keuze wint, nooit midden in een sessie). | Dienst (bijv. Supabase) en kosten; rol van export/import daarna; rate-limit `ROOM_LIMIT` op eigenaar in plaats van IP. |
| **G3** | **AI-vijanden** (fase 3): voorgestelde actie op basis van statblock, HP, condities en logboek, via de Worker (sleutel nooit in de browser). | Hangt af van G2: login en een limiet per gebruiker vóór het publiek gaat. Elke aanroep krijgt `lang`; voorstellen verwijzen naar id's; gegenereerde tekst is daarna inhoud (`docs/i18n.md` §9). |
| **G4** | **Battle maps**: bij voorkeur gestructureerde data (grid, muren, terrein) die de app tekent; eventueel als eigen tool "Inn the Grid". | Losse tool of onderdeel van Initiative; handmatig of met AI (G3). |
| **G5** | **Andere Kev's Inn-tools**: Innhabitants (characters), Inquests (campagnes), Innelligence (AI-companion), naast Inn the Grid (G4). | Per tool een eigen plan; stappen voor een nieuwe tool in `docs/i18n.md` §9.2. De homepage toont een tool pas als hij bestaat; iconen liggen klaar in `brand/tool-icons/`. |
| **G6** | **Derde taal** (bijv. Duits). | Gelokaliseerde D&D-termen pas na licentie-onderzoek (V7, `docs/i18n.md` §4.3); stappen in §9.3. |

## Bewust niet (niet opnieuw voorstellen zonder nieuwe aanleiding)
- "Groep blijft hangen" bij monsters toevoegen: de keuze wordt bewust per sessie onthouden (`ui.addOpts`).
- Groepsbeurt als één beurt op het DM-scherm: groepen zijn alleen weergave (recharge, saves, condities per lid).
- Kleur als speler/monster-identiteit (Forest/Copper botsen met Success/Warning); de vorm draagt het verschil.
- Automatische taalredirect op browsertaal of voorkeur (behalve de geïnstalleerde app, `launchRedirect`).
- Resist én kwetsbaar op hetzelfde damage type (komt bijna niet voor).
- Echte monsterafbeeldingen: geen vrij bruikbare bron.
- Op het spelersscherm: encounternaam of -notitie, verborgen monsters of hun beurt.
