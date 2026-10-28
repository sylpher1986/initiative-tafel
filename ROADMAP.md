# Roadmap

Stand: **2.11.1** (28-10-2026). G1 (2024-regels) is klaar: regelset per tafel onder Instellingen → Regels; keuzes in CLAUDE.md, plan en besluiten als historie in `docs/g1-regels-2024.md`. Alleen open werk staat hier. Wat klaar is, staat in de code, in CLAUDE.md ("Gemaakte keuzes") en in de git-geschiedenis. De oude roadmap met alle afgevinkte punten (codes IN, GV, VB, RE, SP, SC, AF, OB, DA, HS, TA, TS, WB en WP1–WP45) staat in commit `4e83db1`.

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
- 2024-regels (uit G1): "4 in Lair" / "4/Day in Lair" gebruiken (wordt gelezen, niet toegepast); Incapacitated (disadvantage) en Invisible (advantage) op initiative 2024 automatisch (nu alleen in de uitleg); CR 0-monsters met "XP 0" tellen als 10 XP (`crXp` gaat vóór `xp`); Sphinx of Valor "Roar" heeft drie DC's, de app neemt de eerste; Nederlandse zoeksynoniemen voor meer SRD 5.2-namen.

### Bekende beperkingen (geaccepteerd)
- Undead Fortitude: `applyDamage` meldt al "is neer" en laat concentratie vallen vóór de save (zombies concentreren niet).
- Een DM-socket die stil wegvalt (geen close), merkt de kamer pas als de runtime hem sluit.
- DM Sans heeft geen tabular-nums: uitlijning komt uit vaste kolombreedtes.

### Operationeel (Michiel, geen code)
- `*.workers.dev`: doorsturen naar `kevs-inn.com` of uitzetten (besluit V1, nog open).
- Live check 2.3.0/2.3.1: `kevs-inn.com/en/initiative/` → 301 naar `/initiative/`; `/` = Engelse homepage; geïnstalleerde iPhone-app start in het Nederlands; versie 2.3.1 onderaan Instellingen; app offline openen vanaf het beginscherm.
- Live check G1 (2.11.x) op de telefoon: Instellingen → Regels → 2024; "Start met voorbeeld" geeft Goblin Warriors; zoek "zombie 2024" en voeg toe; Exhaustion 4 op een speler halveert max HP niet; wisselen tijdens een gevecht kan niet; spelersscherm (QR) legt Grappled uit volgens 2024; export → import houdt "2024" in Instellingen; terug naar 2014 en offline openen werkt.
- Site vindbaar maken: `HIDDEN = true` in `tools/pages.mjs` (robots `Disallow: /`). Op `false`, `node tools/pages.mjs`, daarna de sitemap in Search Console.
- Projectinstructies op claude.ai verwijzen naar `claude/werkpakketten.md` en `claude/geplande-taken-werkwijze.md`; die bestaan niet meer. De werkwijze staat in CLAUDE.md (reviewers, geplande bouwtaken).

## Grote projecten (lange termijn)

Nog niet uitgewerkt. Elk project begint met een plan: inventaris in de code, open besluiten, werkpakketten.

| Code | Project | Open besluiten en afhankelijkheden |
|---|---|---|
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
