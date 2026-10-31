# Roadmap Kev’s Inn

Grote projecten (G-codes): wat, waarom, status en afhankelijkheden op hoofdlijnen. Geen technische uitwerking: die komt in `docs/work-packages/` zodra een project gepland wordt. Kleine punten staan in `docs/BACKLOG.md`, geldende keuzes in `docs/DECISIONS.md`.

Stand: Initiative **2.18.0**, Inn Sight (Maps) **1.7.0** (30-10-2026).

**Status:** Idee · Plan nodig · Gepland · In uitvoering · Geblokkeerd. **Prioriteit:** alleen ingevuld als Michiel die heeft vastgelegd; anders "—".

## Projecten

| Code | Project | Doel en functionaliteit op hoofdlijnen | Prio | Status | Afhankelijkheden en open besluiten | Werkpakketten |
|---|---|---|---|---|---|---|
| **G2** | **Accounts en sync** (fase 2) | Local-first blijft de basis. Eerste collectie `encounters` (heeft `id` + `updatedAt`, nieuwste wint). Daarna: delen met een co-DM, vaste kamercode per campagne (`isOwner` in `worker/room.js`), taalvoorkeur in het account (nieuwste keuze wint, nooit midden in een sessie). Inn Sight-kaarten zijn sync-klaar (`id` + `updatedAt`, assets op sha256; `docs/g4-inn-the-grid.md` §2.9). | — | Plan nodig | Open: dienst (bijv. Supabase) en kosten; rol van export/import daarna; rate-limit `ROOM_LIMIT` op eigenaar in plaats van IP. | — |
| **G3** | **AI-vijanden** (fase 3) | Voorgestelde actie op basis van statblock, HP, condities en logboek, via de Worker (sleutel nooit in de browser). | — | Plan nodig | Hangt af van **G2**: login en een limiet per gebruiker vóór het publiek gaat. Elke aanroep krijgt `lang`; voorstellen verwijzen naar id's; gegenereerde tekst is daarna inhoud (`docs/i18n.md` §9). | — |
| **G4+** | **Inn Sight: vervolg** | Na G4 (afgerond): muren/deuren op celranden, meervoudige selectie, vrij tekenen, lagenpaneel; later line of sight en licht. | — | Idee | Eerst een vervolgplan als Michiel dat wil. `kevs-inn-maps` (formaat, opslag, cache) blijft de interne naam. Grenzen in `LIMITS` (`js/maps/model/limits.js`). | — |
| **G5** | **Andere Kev’s Inn-tools** | Innhabitants (characters), Inquests (campagnes), Innelligence (AI-companion), naast Initiative en Inn Sight. | — | Idee | Per tool een eigen plan; stappen voor een nieuwe tool in `docs/i18n.md` §9.2. De homepage toont een tool pas als hij bestaat; iconen liggen klaar in `brand/tool-icons/`. Innelligence raakt G3. | — |
| **G6** | **Derde taal** (bijv. Duits) | Volledige app in een derde taal. | — | Idee | Gelokaliseerde D&D-termen pas na licentie-onderzoek (V7, `docs/i18n.md` §4.3); stappen in §9.3. | — |
| **G7** | **Dobbelstenen zichtbaar maken** in Initiative | **Stap 1**: betere visuele weergave van wat er gerold is (nu tekst als "d20 [14, 6] dis +2"): per worp de afzonderlijke stenen, welke telt (advantage/disadvantage), modifiers met naam, crit/nat 1, totaal. **Stap 2** (pas na stap 1): optionele rolanimatie. | — | Plan nodig | Inventaris van alle worpen: aanvalspaneel (`atkHtml` in `js/ui/render.js`, `js/rules/attacks.js`), AoE/saves (`js/rules/aoe.js`, `js/rules/monrules.js`, schade-spells `js/rules/dmgspells.js`), initiative (`js/rules/turns.js`, initiative-paneel), death saves, HP rollen bij toevoegen. Regels blijven codes/descriptoren teruggeven (worpdata, geen tekst); weergave in `js/ui/`. Open: één gedeeld worponderdeel voor alle panelen; leesbaar op 320 px en tikdoelen; kleur alleen volgens de eigenaarschapsregels (geen goud, rood alleen kritiek); log en spelersscherm wel of niet. Animatie: kort, overslaan bij `prefers-reduced-motion`, aan/uit per apparaat, nooit wachten aan tafel. | — |

## Afgerond (alleen voor traceerbaarheid)
- **G1** 2024-regels naast 2014: WP46–WP55, Initiative 2.4.0–2.11.1, 28-10-2026. Keuzes en besluiten B1–B10 in `docs/DECISIONS.md`.
- **G4** Inn Sight (was Inn the Grid): WP56–WP75, Maps 0.1.0–1.7.0 / Initiative 2.18.0, 30-10-2026. Keuzes en besluiten in `docs/DECISIONS.md`; architectuur en bestandsformaat in `docs/g4-inn-the-grid.md`.
- WP1–WP45 en de oude codes (IN, GV, VB, RE, SP, SC, AF, OB, DA, HS, TA, TS, WB): roadmap en CLAUDE.md van commit `4e83db1`.
