# Roadmap

## Klaar (fase 1)
- Initiative, beurten, rondes, undo, logboek met oorzaken en eigen notities
- 322 SRD-monsters, eigen monsters, monsterimport (Open5e / 5e-bits)
- Spelers handmatig of via D&D Beyond PDF; vaste party met short/long rest
- HP, temp HP, resistance/vulnerability, death saves, condities met duur en herhaal-saves
- Spell slots en innate spells (monsters en spelers), concentration gekoppeld aan spells (incl. upcasting)
- Recharge, legendary actions/resistance, lair actions (zelf in te voeren en bewaard), reactions
- Export/import (JSON, versie 1), offline PWA, Cloudflare-hosting
- Weergave Systeem/Licht/Donker (tab Instellingen, keuze bewaard op het apparaat)
- UX-ronde 1: compacte kaarten (één open), vaste beurtbalk, schade-paneel, meldingen met Ongedaan
- Twee modi: **Voorbereiden** (spelers, monsters, party, lair actions, instellingen) en **Gevecht** (alleen lijst + beurtbalk); modus volgt het gevecht, wisselen kan altijd
- Snel toevoegen in Gevecht (+): monsters die halverwege aansluiten, initiative rollen of invullen

## UX-verbeterpunten (uit review)
- [ ] Logboek dichter bij de beurtbalk: eigen tab, of de laatste 2 gebeurtenissen onder de beurtbalk
- [ ] Statblock-paneel op telefoon versleepbaar (half/heel) en dicht met veeg omlaag
- [ ] Lettertypes zelf meeleveren in plaats van Google Fonts (offline en privacy)
- [ ] Welkomstkaart bovenaan ("Start met voorbeeld" / "Begin leeg") in plaats van de voorbeeld-hint onderaan

## Functies
- [ ] Deelnemer bewerken: naam, AC, max HP (nu alleen initiative)
- [ ] Encounters vooraf klaarzetten en per sessie inladen
- [ ] Moeilijkheid berekenen: XP-budget tegen partylevel (DMG 2014, easy t/m deadly)
- [ ] Herinnering om af en toe een export te maken
- [ ] Spelersscherm voor tv/tablet: alleen volgorde en wie er aan de beurt is, zonder monster-HP

## Fase 2: sync
- [ ] Login en sync tussen apparaten (bijv. Supabase), local-first blijft de basis
- [ ] Delen met een co-DM

## Fase 3: AI (via Cloudflare Worker, sleutel nooit in de browser)
- [ ] AI-gestuurde vijanden: voorgestelde actie op basis van statblock, HP, condities en logboek
- [ ] Battle maps: bij voorkeur als gestructureerde data (grid, muren, terrein) die de app tekent
- [ ] Kostenbeheer: login en een limiet per gebruiker voordat dit publiek gaat

## Technische schuld (uit code-review)
- [ ] pdf.js zelf hosten (nu via CDN, zonder SRI)
- [ ] Character sheets zitten in elke undo-stap; apart opslaan scheelt geheugen
