# G1 — D&D 5e 2024-regels naast 2014

Plan van 27-10-2026 (stand 2.3.1, commit `4622436`). Status: **WP46 klaar (2.4.0), WP47 klaar (2.4.1), WP48 klaar (2.5.0), WP49 klaar (2.6.0), WP50 klaar (2.7.0)**, rest gepland. Werkpakketten WP46–WP55; samenvatting in `ROADMAP.md`. Na elk pakket: keuze naar CLAUDE.md ("Gemaakte keuzes"), regel uit dit plan en de roadmap halen. Dit document vervalt als G1 klaar is.

Legenda: **[B]** = bevestigd in de code, **[A]** = aanname, **[?]** = onbekend, eerst controleren.

---

## 1. Inventaris: wat er nu is

### 1.1 Data
| Wat | Waar | Vorm | Bevinding |
|---|---|---|---|
| Monsters 2014 | `data/monsters.json` (431 KB) | kale array, 322 × `{ n, meta, ac, hp, hd, spd, ab, x, cr, xp, t, a, ba, re, l, ld }` | [B] SRD 5.1 via Open5e. **Geen id, geen editie, geen bronveld; geen generator in `tools/`.** Identiteit = naam `n`. |
| Spells 2014 | `data/spells.json` | `{ ed: "2014", src, spells: [{ n, lv, sch, t, r, c, d, x, h }] }` | [B] 319 SRD 5.1, `tools/spells_srd.py`. |
| Spells 2024 | `data/spells-2024.json` | idem met `ed: "2024"` | [B] 339 SRD 5.2, Open5e, `tools/spells_srd2024.py`. |
| Concentratie | `js/rules/conclist.js` | `CONC[2014]`, `CONC[2024]` | [B] gegenereerd door `tools/conc_lists.py`. |
| Monsters 2024 | — | — | [B] **ontbreekt volledig.** |
| Condities-uitleg | `locales/src/*/dnd.js` (`dnd.cond.*`, `dnd.exh.*`) | eigen samenvatting SRD 5.1 | [B] alleen 2014. |

### 1.2 Hoe edities nu al werken (alleen spells)
- [B] Instelling **Spells 2014 | 2024**: `js/ui/spellrules.js` (`it-spell-rules`, per apparaat, niet in de encounter), seg `#rules-seg` in `pages/initiative.html` r. 130–136, koppeling in `js/ui/actions.js` ~r. 2047.
- [B] Regels krijgen de editie als parameter: `presetsFor(ed)` (`js/rules/effects.js` r. 42–44, `r24`-afwijkingen Haste/Barkskin), `isConc(n, ed)` en `edFor(c, n, instelling)` (`js/rules/spells.js`), `spellFor(sp, ed)` (Sleep 2024, `js/rules/spellcast.js`), `rulesDiffer(n)`.
- [B] Spell-identiteit = genormaliseerde naam (`normSpell`/`keys`, aliassen zoals Feeblemind ↔ Befuddlement). Opzoeken per editie: `findSpell(n, ed)`, `pickEd(n, pref)` (`js/data/spells.js`). Beide edities lazy geladen.
- [B] Per sheet-spell een editie (`spellEd` in `js/ddbjson.js`, `sp.ed` in de sheet, opgeschoond in `cleanSheet`, `js/backup.js` r. 91).
- [B] Aanroepers van de instelling: `rulesEd()` in `js/ui/actions.js` (r. 229, 235, 402–403, 1467, 1612), `js/ui/render.js` r. 326, 1188 (`presetEd`) en 1190 (`edTag`, vergelijkt rechtstreeks met de instelling), `js/ui/spellinfo.js` r. 98. `showRules` (`actions.js` r. 2050) toont bewust de ruwe instelling.

### 1.3 Monsters: opzoeken en identiteit
- [B] `js/data/monsters.js`: `build()` voegt eigen > geïmporteerd > SRD samen en **ontdubbelt op naam (lowercase)**; `findMon(n)` zoekt op exacte naam.
- [B] Deelnemer: `c.ref = m.n` (naam), statblock wordt **bij elk gebruik** opgezocht via `findMon(c.ref)` (± 25 plekken in `js/ui/render.js`, `js/ui/statblock.js`, `js/ui/actions.js`, plus `endSummary(S, findMon)` via `js/ui/einde.js` r. 31 → `js/rules/fight.js` r. 54, `toPlayerView`-meta in `js/main.js` r. 139, `js/ui/encounters.js` r. 170, 178, 208, 299, 310). Niet gekopieerd in de stand.
- [B] Bij toevoegen (`js/ui/actions.js` r. 96–110): initiative = d20 + Dex-mod (`m.ab[1]`, opgeslagen als `c.dex`); `freshRoll` en `rerollMonsters` (`js/rules/turns.js` r. 465/479) gaan uit van `init = roll + dex`; `legInfo`, `rcInfo`, `castInfo` vastgelegd op de deelnemer.
- [B] Zoeken (`parseQuery`/`filterMonsters`): naam/type/subtype + `cr`-filter in één veld; geen filterchips (CLAUDE.md).
- **Gevolg** (geteld op de Open5e-data van §1.7, nog niet in de repo): 283 van de 331 SRD 5.2-monsters hebben **dezelfde naam** als een 2014-monster (Aboleth, Zombie, Adult Red Dragon …). Zonder editieveld zou een bestaande `ref: "Zombie"` na het toevoegen van 2024-data stil een ander statblock krijgen.

### 1.4 Encounters, opslag, delen
- [B] Encounter (`js/rules/encounters.js`): `{ id, updatedAt, name, notes, monsters: [{ ref, n, hidden?, anon?, grp? }], lair?, all? }`. `cleanEncounter` **gooit onbekende velden weg**. `ENC_VERSION = 1`; `parseEncFile` weigert een hogere versie.
- [B] `fromList` voegt opeenvolgende deelnemers met dezelfde `ref` samen; `loadPlan(enc, has)` geeft ontbrekende refs terug; `buildEncFile` stuurt alleen eigen/geïmporteerde statblocks mee (SRD wordt verondersteld aanwezig).
- [B] Backup (`js/backup.js`): `VERSION = 3`, migraties 1→2→3; `cleanCombatant` neemt `ref` mee maar geen editie; `parseImport` bouwt `S` opnieuw op uit een whitelist (een nieuw `S`-veld moet daar expliciet bij).
- [B] Nieuwe stand zonder overname van instellingen: `"reset-yes"` en `"sample-clear"` (`js/ui/actions.js` r. 544, 551), `main.js` r. 130.
- [B] Undo dekt `S` (`js/state.js`); party (`app.party`, incl. `eff`) valt erbuiten.
- [B] Spelersscherm: `toPlayerView` → snapshot `v: 2` (`js/playerview.js` r. 193), whitelist, `cleanView`; condities-uitleg (`js/ui/condinfo.js`) ook op het spelersscherm, nu altijd 2014-tekst.

### 1.5 Regels die van de editie afhangen (wat de app echt implementeert)
| # | Regel | Waar [B] | 2014 (nu) | 2024 | Werk? |
|---|---|---|---|---|---|
| R1 | Exhaustion | `combat.js` `exhEffect`/`reExh` (r. 223–240; aanroepers `combat.js` r. 190/254, `effects.js` r. 125/179/268), `effects.js` `setExh` (r. 254+), `conditions.js` `exhRows`, `attacks.js` `atkAdv` r. 179, `aoe.js` `saveAdv` r. 103–106; UI `render.js` r. 352/358, long rest `actions.js` r. 84/268/270/1959 | niveau 1–6, dis. vanaf 3, max HP ½ vanaf 4, 6 = dood | −2 × niveau op elke d20-test (ook initiative), speed −5 ft × niveau, 6 = dood, geen HP-halvering | ja |
| R2 | Concentration-DC | `combat.js` r. 180 **en dubbel** in het schadepaneel `render.js` r. 912 | max(10, ½ schade) | idem, **max 30** | ja (klein) |
| R3 | Surprise | `turns.js` r. 154–200 (`sur`, `skipsTurn`, `reactUsed`), `legendary.js` r. 47, `monrules.js` r. 201 (`canParry`), initiative-paneel `render.js` r. 248/508/641, `actions.js` r. 463/467/1825 | ronde 1 overslaan, geen reaction | disadvantage op de initiativeworp, geen overgeslagen beurt | ja |
| R4 | Auto-advantage | `attacks.js` r. 166–188 | PHB 2014 | Grappled: disadvantage op aanvallen tegen een ander dan de grappler; rest gelijk voor wat de app modelleert | klein (hint) |
| R5 | Condities-uitleg | `conditions.js` `CINFO`, `dnd.cond.*` | SRD 5.1 | SRD 5.2 (o.a. Exhaustion, Grappled, Invisible, Incapacitated anders verwoord) | ja (tekst) |
| R6 | Moeilijkheid | `encounters.js` `difficulty`/`deadlyTip`, UI `js/ui/encounters.js` r. 27–38, 176 | DMG 2014: drempels × multiplier, Easy–Deadly | XP-budget per level (Low/Moderate/High), geen multiplier | ja |
| R7 | XP na het gevecht | `js/ui/einde.js`, `crXp` | XP per CR | [A] zelfde tabel; label "DMG 2014" | tekst + check |
| R8 | Monster-initiative | `actions.js` r. 96–110, `turns.js` `freshRoll`/`rerollMonsters` r. 465–479 | d20 + Dex-mod | d20 + **Initiative-bonus uit het statblock** | ja |
| R9 | Legendary | `spells.js` `legInfo` r. 80 | "can take 3 legendary actions"; LR "(3/Day)" | "Legendary Action Uses: 3 (4 in Lair)"; LR "(3/Day, or 4/Day in Lair)" → **regex faalt, LR = null** | ja (parser) |
| R10 | Aanvallen/saves uit statblock | `attacks.js` `parseAction` r. 49 (`to hit`, `DC n X saving throw`), `monrules.js` r. 62–110 (riders na "Hit:") | 2014-formulering | "Attack Roll: +4", "Strength Saving Throw: DC 13 … Failure:/Success:" | ja (parser); `classic()` bestaat al in `statparse.js` r. 39 maar alleen voor plaktekst |
| R11 | Spellcasting monster | `castInfo` r. 65 | slots + "3/day each" | geen slots, "At Will / 1/Day Each" | [A] werkt al (regex `gim`), testen |
| R12 | Spell-presets en concentratie | `effects.js`, `spellcast.js`, `spells.js` | via `ed` | via `ed` | **al klaar**, alleen de bron van `ed` wijzigt |
| R13 | Statblock-weergave + bronvermelding | `js/ui/statblock.js`, `init.sb.credit` | "SRD 5.1 (2014)" vast | Initiative, PB, SRD 5.2 | ja |
| R14 | Undead Fortitude, Parry, crits, death saves, recharge | `monrules.js`, `attacks.js`, `combat.js` | — | [A] inhoudelijk gelijk | nee (regressietest) |
| R15 | Rage (barbarian) | `effects.js` RE16 (`startRage`, Frenzy in `removeEffect`), `turns.js` `rageTurnEnd` | max 10 rondes; loopt door bij aanval of schade; Frenzy geeft na afloop 1 Exhaustion | max 10 minuten; loopt door bij aanval, vijand laten saven of bonus action (schade telt niet); Frenzy zonder Exhaustion | ja (WP50, besloten 27-10) |
| R15b | Weapon mastery, Heroic Inspiration | — | — | bestaan niet in de app | **buiten scope** (spelers rollen zelf, CLAUDE.md) |
| R16 | Lair-deelnemer (init 20) | `newLair`, `app.lairs` | lair actions | SRD 5.2 heeft geen lair actions op init 20 | nee: eigen inhoud, editie-neutraal |

### 1.6 Tests en validatie
- [B] `npm test` groen op 2.3.1 (± 680 tests, ± 10 s). Relevant: `tests/spellrules.test.js`, `spells.test.js`, `statparse.test.js`, `encounters.test.js`, `encounter.test.js`, `monsters.test.js`, `legendary.test.js`, `attacks.test.js`, `saves.test.js`, `surprise.test.js`, `rules.test.js`, `playerview.test.js`, `share.test.js`, `i18n*.test.js`, `version.test.js`; gegenereerde bestanden worden op actualiteit getest.
- [B] Migratiepatroon: `migrateNtoN+1` in `js/backup.js`; encounters via `cleanEncounter` bij laden.
- [B] Browsercheck `tools/browsercheck.mjs` met scenario's in `SCEN`.

### 1.7 Bronnen en licentie
- [B] **SRD 5.2 monsters bij Open5e** (`open5e-api`, `data/v2/wizards-of-the-coast/srd-2024/`, document `srd-2024`, licentie `cc-by-40`): `Creature.json` (331), `CreatureAction.json` (989: 807 action, 82 legendary, 76 bonus, 24 reaction), `CreatureActionAttack.json`, `CreatureTrait.json`, `ConditionDescription.json` (15 condities). Zelfde bron als de 2024-spells.
- [B] Datakwaliteit Open5e (steekproef): attacktekst mist "Hit:" ("Melee Attack Roll: +14, reach 10 ft. 13 (1d10 + 8) Slashing…"); **aantal legendary actions ontbreekt** (geen veld, geen tekst); `experience_points_integer` bijna altijd leeg (1 van 331); `initiative_bonus` en saves per ability zijn er wel; LR staat in de traitnaam.
- [A] De XP-budgettabel (Low/Moderate/High) staat in SRD 5.2.1, Gameplay Toolbox → Combat Encounters. **Cijfers controleren tegen de officiële SRD 5.2.1-pdf** (dndbeyond.com/srd); niet uit de DMG 2024 of een derde site overnemen.
- [?] Is Open5e `srd-2024` SRD 5.2 of 5.2.1 (errata)? Bronvermelding noemt de versie die echt gebruikt is.
- Regel: alleen SRD 5.2 (CC-BY-4.0). Geen Monster Manual 2024 of andere niet-SRD-tekst. 2014-data wordt **nooit** als 2024 gelabeld.

---

## 2. Besluiten

| # | Besluit | Waarom | Afgewezen |
|---|---|---|---|
| **B1** | **Eén regelset per tafel: `S.rules`** (`"2014"` \| `"2024"`; ontbreekt = `"2014"`). In de lopende stand, dus in undo, opslag en export. Alleen te wijzigen **zonder lopend gevecht**. Blijft staan bij "Encounter wissen → Alles", "Begin leeg" en voorbeeld wissen. Wisselen rekent **alleen de tafel** om (één undo-stap); partyleden buiten de tafel worden **niet** omgerekend: `reExh(c, ed)` is idempotent en draait bij aan tafel zetten en bij de party-sync tegen `rulesOf(S)`. | Mechaniek (exhaustion, surprise, moeilijkheid) geldt voor de hele tafel; een gevecht mag niet halverwege van regels wisselen; export/import neemt de keuze mee; undo blijft consistent, ook omdat er buiten `S` niets mee verandert (de party valt buiten undo). | Per apparaat (`localStorage`): niet in export, wisselen tijdens gevecht. Per opgeslagen encounter: een encounter is een monsterlijst zonder party/gevecht; twee bronnen zouden elkaar tegenspreken. |
| **B2** | **Spells volgen de regelset.** Bij `S.rules = "2024"` zijn spells altijd 2024 (instelling Spells verborgen, uitleg "volgt Regels 2024"). Bij `"2014"` blijft de bestaande instelling **Spells 2014 \| 2024** (`it-spell-rules`) werken zoals nu. Eén pure functie `spellEdOf(rules, spellSetting)`; sheet-spells (`edFor`) gaan er nog steeds boven. | Hiërarchisch, dus nooit tegenstrijdig; bestaande gebruikers met Spells 2024 merken niets. | Instelling schrappen (verandert stil gedrag van bestaande gebruikers); twee losse instellingen naast elkaar. |
| **B3** | **Monster-editie is data, geen instelling.** Bibliotheken: SRD 5.1 (`data/monsters.json`, ongewijzigd), SRD 5.2 (`data/monsters-2024.json`, nieuw), eigen + geïmporteerd (editie-neutraal). Deelnemer en encounterregel krijgen optioneel `ed: "2024"`; **ontbreekt = precies het huidige gedrag** (eigen > geïmporteerd > SRD 5.1 op naam). `findMon(ref, ed)`; bij `ed: "2024"` alleen SRD 5.2, geen schaduw door eigen monsters. | Alle bestaande refs, encounters en backups behouden hun betekenis zonder migratie van inhoud. Gemengd gebruik (2014-monster aan een 2024-tafel) blijft mogelijk. | Unieke refs ("Zombie (2024)"): gebruikersinhoud en namen op het spelersscherm vervuild. Eén samengevoegde lijst: botst op 283 namen. |
| **B4** | **Ontbrekende 2024-data = expliciet.** `ed: "2024"` zonder geladen SRD 5.2 → geen statblock, melding/markering "statblock 2024 niet beschikbaar", nooit terugvallen op 2014. In `loadPlan` als ontbrekend ("Zombie · 2024"). | Eis: geen stille terugval. | Stille terugval naar de 2014-naam. |
| **B5** | **Formaatversie alleen omhoog als het nodig is**: backup schrijft `version: has2024 ? 4 : 3`, encounterbestand `has2024 ? 2 : 1` (één expressie; `has2024` = `S.rules`, een deelnemer of encounterregel met `ed: "2024"`). Lezen accepteert t/m 4 resp. 2, migratie no-op (ontbreekt = 2014). | Een oudere app moet een bestand met 2024-inhoud **weigeren** in plaats van het stil als 2014 te lezen; exports van 2014-gebruikers blijven leesbaar voor een oudere app (tweede apparaat met oude sw). | Optioneel veld zonder versie (oude app leest 2024 als 2014); altijd ophogen (weigert zonder reden alle 2014-exports). |
| **B6** | **Regels krijgen de editie als parameter** (bestaand principe), nooit uit `S` of `localStorage` in `js/rules/`. 2024-afwijkingen naast de 2014-code (zoals `r24`), geen generieke rules engine. | Klein, testbaar, past op wat er is. | Rules engine / strategy-objecten per editie: speculatief voor ± 8 verschilpunten. |
| **B7** | **Statblock-tekst blijft letterlijk**; de parsers worden editiebestendig door dezelfde normalisatie als plaktekst (`classic()`, verplaatst naar `js/rules/`). De converter herstelt alleen wat Open5e kwijt is ("Hit:", legendary-aantal). | Weergave blijft trouw aan SRD 5.2; één parserpad voor SRD, plaktekst en import. | 2024-tekst in de converter omschrijven naar 2014-zinnen. |
| **B8** | **Spelersscherm**: snapshot krijgt optioneel `ed` (alleen `"2024"` meegestuurd), `v` blijft 2; `cleanView` whitelist. Spelers zien condities-uitleg van de tafelregels. | Taalneutraal, codes over de lijn (CLAUDE.md). | Uitleg alleen op de DM-kant. |
| **B9** | **Data offline**: `data/monsters-2024.json` in de sw-precache (zoals `spells-2024.json`), geladen bij de eerste behoefte (regelset 2024, een `ed: "2024"`-deelnemer of zoeken op 2024). | Aan tafel soms zonder internet. | Alleen runtime-cache: faalt offline bij de eerste keer. |
| **B10** | Lair, weapon mastery, Heroic Inspiration, "4 in Lair": **buiten G1** (zie R15b/R16, V5). Rage 2024 zit wel in G1 (WP50). | App modelleert spelersaanvallen bewust niet; lair is eigen inhoud. | — |

### Open besluiten voor Michiel
| # | Vraag | Advies | Blokkeert |
|---|---|---|---|
| V1 | Standaard regelset voor een nieuwe installatie | **Besloten 27-10: 2014** | — |
| V2 | Release: stapsgewijs in 2.x of één 3.0.0 | **Besloten 27-10: stapsgewijs in 2.x** (WP46–WP53 onzichtbaar, keuze zichtbaar in WP54 als 2.x.0) | — |
| V3 | Bestaande "Spells 2024 onder regels 2014" behouden (B2) | **Besloten 27-10: ja** | — |
| V4 | Andere-editie-monsters in de zoeklijst | **Besloten in WP49**: zoekwoord `2014`/`2024` (zoals `cr 5`) plus de regel "Zoek in SRD 5.2 (2024) ▸" onder de lijst | — |
| V5 | Rage 2024 / "4 in Lair" | **Besloten 27-10: Rage 2024 mee in WP50**; "4 in Lair" op signaal | — |

Geen open vraag blokkeert **WP46**.

---

## 3. Volgorde

```
WP46 Fundament (regelset + editievelden + formaten) ──┬── WP48 Parsers ── WP49 Monsterkeuze & statblock ──┐
WP47 SRD 5.2-monsterdata (tool + data) ───────────────┘                                                  │
WP46 ── WP50 Exhaustion 2024 ───────────────────────────────────────────────────────────────────────────┤
WP48 ── WP51 Conc-DC, surprise, Grappled 2024 ─────────────────────────────────────────────────────────────┤
WP46 ── WP52 Condities-uitleg 2024 + spelersscherm ───────────────────────────────────────────────────────┤
WP46 ── WP53 Moeilijkheid 2024 ──────────────────────────────────────────────────────────────────────────┤
                                                                         WP54 Regelkeuze zichtbaar ◄───────┘
                                                                         WP55 Integratie en release
```
- Eerst **WP46**. **WP47** kan direct ernaast (tool en data raken geen app-code; alleen het laden komt in WP48/49).
- Na WP46 zijn **WP50, WP52, WP53** onafhankelijk van elkaar en van WP47–49.
- **WP51 na WP48**: beide raken `js/rules/turns.js` (`freshRoll`, initiative), dus na elkaar, niet parallel.
- Tot WP54 is er niets zichtbaar: `S.rules` is altijd `"2014"`; 2024-paden zijn alleen via tests bereikbaar.

Omvang: S ≈ één korte sessie (K-formaat), M ≈ één volle sessie, L ≈ grens van één sessie.

---

## 4. Werkpakketten

### WP46 — Fundament: klaar in 2.4.0
Zie CLAUDE.md ("Opslag en data") en `js/rules/edition.js`. Voor latere pakketten: `findMon(ref, ed)`, `allMonsters(ed)`, `setSrd24(list)` (laden in WP48/49), `spellEd()` in `js/ui/spellrules.js`, `addMonsters(…, ed)`, `loadPlan` geeft `missing` als `[{ ref, ed? }]` (tekst via `missNames`).

---

### WP47 — SRD 5.2-monsterdata: klaar in 2.4.1
Zie CLAUDE.md ("Opslag en data") en de kop van `tools/monsters_srd2024.py`. Voor WP48/49:
- Bron is Open5e `srd-2024` (commit `e69ac13`), **volledig** vergeleken met de officiële SRD 5.2.1-pdf (in open5e-api: `data/raw_sources/srd_5_2/SRD_CC_v5.2.1.pdf`); §1.7-vraag beantwoord: de tekst volgt 5.2.1 ("GM", Awakened Tree 14 (3d6 + 4)). Bronvermelding: SRD 5.2.1.
- Velden als `monsters.json` + `init` (statblock-Initiative, voor R8) en `pb`. `ld` begint met "Legendary Action Uses: 3" of "3 (4 in Lair)" (30 monsters, 27 met lair; LR-trait "(3/Day, or 4/Day in Lair)").
- Attacktekst 2024-vorm: "Melee or Ranged Attack Roll: +9 (with Advantage if …), reach 5 ft. or range 150 ft. Hit: 27 (4d10 + 5) Force damage." (geen "to hit", geen "one target"). Saves: "Dexterity Saving Throw: DC 18, … Failure: … Success: Half damage." Riders: "has the Grappled condition (escape DC 14)". Spellcasting is een **actie** met regels "• At Will: …", "• 2/Day Each: …", "• 1/Day: …" en "(level N version)".
- Gebruik en vorm in de naam: "(Recharge 5–6)" (en-dash), "(Recharge after a Short or Long Rest)", "(3/Day)", "(Bear or Hybrid Form Only)", "(1/Day; Requires Soul Bag)". Nooit "(Costs N Actions)".
- Statregels: "Resistances", "Immunities" (schade; condities), "Vulnerabilities", "Gear", "Senses" ("…; Passive Perception N"), "Saving Throws" alleen waar de save afwijkt van de modifier.
- Ontbreekt (niet in Open5e): subtypes en "Swarm of Tiny Beasts" in `meta`. Grootte wel compleet (Tiny, "Medium or Small"). Speed-notities alleen bij de weerdieren en Swarm of Insects.
- **Voor WP48**: bestaande code leest de 2014-rijnamen ("Condition Immunities" in `monrules.js` r. 128 voor riders, "Damage Immunities/Resistances" in `render.js` r. 283 en `statblock.js` r. 351); 2024 heeft "Immunities" (schade; condities na `;`), "Resistances", "Vulnerabilities". `legInfo` leest nog geen "Legendary Action Uses: N" en geen "(3/Day, or 4/Day in Lair)". `loadSrd` (2014) controleert `ed` niet: bij het laden van 2024 via `setSrd24` het omhulsel op `ed: "2024"` controleren.

---

### WP48 — Statblock-parsers en monster-initiative: klaar in 2.5.0
Zie CLAUDE.md ("Opslag en data", "Parsers editiebestendig"). Voor latere pakketten:
- `loadSrd24()`/`srd24Status()` in `js/data/monsters.js`; `start()` laadt alleen als de tafel 2024-monsters heeft. WP49 roept het aan bij het kiezen/inladen van 2024-monsters en toont "fail" expliciet (B4/B9).
- Nog 2014-rijnamen in de **statblock-weergave**: `DEF` in `js/ui/statblock.js` (preview `monCard`) leest alleen "Damage …" → in WP49 `defRows()` gebruiken.
- Geplakte eigen monsters: `statparse` zet 2024 "Immunities: Poison; Poisoned" om naar "Damage Immunities" inclusief condities (bestaand gedrag, niet aangeraakt).
- Vaste condities uit een 2024-treffer staan als hint (`rd.fix`) in het aanvalspaneel; WP51 (Grappled-hint) kan daarop voortbouwen.
- Eigen/geplakte monsters met "Initiative +N" krijgen nog geen `initBonus` (`sanitizeOwn` neemt `init` niet over; statparse zet de regel alleen in `x`): bestaand gedrag, in WP49 meenemen.
- Eén DC per actie: Sphinx of Valor "Roar" (drie brullen) geeft de eerste.
- Lair-waarden ("4 in Lair", "4/Day in Lair") worden gelezen maar niet gebruikt (V5, op signaal).

### WP49 — Monsterkeuze, dubbele namen, statblock en encounters: klaar in 2.6.0
Zie CLAUDE.md ("Voorbereiden: monsters en encounters", "Editie in de keuze"). Voor latere pakketten:
- `searchList(table, want)`, `monSearch` (laadt SRD 5.2 bij de eerste behoefte) en `edTagOf(m, table)` lezen de regelset al via `rulesOf(app.S)`: in WP54 volgt alles vanzelf als `S.rules` "2024" wordt. Voor WP54 nog: voorbeeld (`loadSample`) bij 2024 met Goblin Warrior.
- De melding bij een ontbrekend 2024-statblock is de bestaande zin met "Zombie · 2024" (`init.enc.missing`); de bewerkregel toont "2024 · ontbreekt".
- Nederlandse zoeksynoniemen: aangevuld voor SRD 5.2-namen (Tough, Warrior …, Pirate, Hippopotamus, Seahorse); demon/duergar/gnome/orc bestaan in SRD 5.2 niet. Verder op signaal.

### WP50 — Exhaustion en Rage volgens 2024: klaar in 2.7.0
Zie CLAUDE.md ("Gevecht: kaarten en panelen", "Exhaustion en Rage per editie"). Voor latere pakketten:
- WP54: bij de regelwissel `reExhAll(app.S.list, ed)` in dezelfde undo-stap (geeft de logregels); partyleden volgen bij aan tafel zetten (`seatMember`); bij de party-sync zelf is geen `reExh` nodig (die kopieert de tafel).
- WP52: `exhRows(x, ed)`/`exhSummary(lvl, ed)` en de sleutels `dnd.exh24.d20`/`dnd.exh24.speed` bestaan; `condInfo` krijgt `ed` nog niet mee.
- WP51: `exhMod`/`initModText` zijn het patroon voor een vaste modifier op een worp; surprise 2024 (disadvantage op initiative) kan naast de Exhaustion-straf.

### WP51 — Concentration-DC, surprise en Grappled: klaar in 2.8.0
Zie CLAUDE.md ("Gevecht: kaarten en panelen", "Concentration-DC, surprise en Grappled per editie"). Voor latere pakketten:
- WP54: alles leest al `rulesOf(app.S)`; de paneelhint (`SUR_HINT`) volgt vanzelf. Bij een regelwissel midden in ronde 1 blijft een 2014-`sur` staan tot `startCombat`/ronde 2 (geen omrekening nodig: de wissel hoort vóór het gevecht).
- WP52: de conditie-uitleg van Grappled 2024 kan de hint `rules.adv.grap24` aanvullen; surprise heeft geen conditie-uitleg.

### WP52 — Condities-uitleg 2024 en spelersscherm: klaar in 2.9.0
Zie CLAUDE.md ("Gevecht: kaarten en panelen", "Spelersscherm"). Voor latere pakketten:
- WP54: niets extra; DM-kant leest `rulesOf(app.S)`, het spelersscherm krijgt `ed` vanzelf zodra `S.rules` "2024" is.
- Afwijkend in 2024 (SRD 5.2.1 vergeleken): Charmed, Grappled, Incapacitated, Invisible, Petrified, Prone (niet opstaan bij speed 0), Stunned, Concentrating (max 30), Exhaustion. Gelijk: Blinded, Deafened, Frightened, Paralyzed, Poisoned, Restrained, Unconscious.
- WP54: het spelersscherm legt Exhaustion uit volgens de tafel (`ed` in de snapshot), de DM-kant volgens het effect (`condEd`). Gelijk zolang de regelwissel `reExhAll` in dezelfde stap draait; zo niet, dan de editie per tag meesturen.
- Op signaal: Incapacitated (disadvantage) en Invisible (advantage) op initiative 2024 staan alleen in de uitleg.

### WP53 — Moeilijkheid en XP volgens 2024
1. **Doel**: de moeilijkheidsuitleg in Voorbereiden rekent met de regels van de tafel.
2. **Huidige stand**: R6–R7; `difficulty`, `deadlyTip`, `noRatingCode`, UI `js/ui/encounters.js` r. 27–38 en 176.
3. **Scope**: `difficulty(mons, who, all, ed)`: bij 2024 XP-budget per level uit SRD 5.2.1 (Low/Moderate/High, geen multiplier, geen "lage CR telt niet"), zelfde uitvoervorm met `rating` 0–2 en een "boven High"-stand; tip "wat weg moet voor High" (generalisatie van `deadlyTip`); labels via catalogus; "Toch meetellen" alleen bij 2014; XP-label in het afrondpaneel zonder "DMG 2014" bij 2024.
4. **Buiten scope**: andere encounterfuncties.
5. **Aanpak**: tabel als constante naast `THRESH`; cijfers alleen uit de officiële SRD 5.2.1-pdf, met paginaverwijzing in het commentaar.
6. **Afhankelijk van**: WP46.
7. **Acceptatie**: 2014-uitkomsten ongewijzigd (bestaande tests); 2024: **vóór het bouwen** de tabel uit de pdf in dit plan zetten (level 1–20 × Low/Moderate/High, met pagina) plus drie testsets met verwacht oordeel (bijv. vier spelers level 3 tegen één CR 2, tegen vier CR 1/2, tegen één CR 5); die sets zijn de test; zonder level geen oordeel (zelfde codes).
8. **Tests**: `encounters.test.js` (2024-tabel, randen 0/1 monster, onbekende CR).
9. **Klaar als**: tests groen, developer-review, versie, push.
10. **Risico's**: tabel niet in SRD 5.2.1 → dan geen 2024-oordeel tonen (code `"cr"`-achtig "niet beschikbaar"), niet terugvallen op 2014.
11. **Omvang**: M.

### WP54 — Regelkeuze zichtbaar: Instellingen → Regels 2014 | 2024
1. **Doel**: de DM kiest de regelset; alles uit WP46–52 wordt bereikbaar.
2. **Huidige stand**: sectie Spells in Instellingen (`pages/initiative.html` r. 130–136, `actions.js` r. 2047, `settings.js` r. 38); hinttekst `init.set.spellsRest`; teksten met "(2014)" (`init.welcome.text`, `page.app.desc`, `page.home.desc`, `page.manifest.desc`).
3. **Scope**: sectie **Regels** met seg "2014 | 2024" (status in de kop), uitgeschakeld tijdens een gevecht met uitleg; Spells als subinstelling alleen bij 2014 (B2); wisselen = één undo-stap + logregel, alleen de tafel omgerekend via `reExh` (B1; party volgt bij aan tafel zetten); standaard volgens V1; welkomstkaart/rondleiding/pagina-omschrijvingen editie-neutraal; `S.rules` naar het spelersscherm (`ed`); voorbeeld (`loadSample`, `actions.js` r. 606, voegt "Goblin" toe, die in SRD 5.2 niet bestaat) bij 2024 met Goblin Warrior en `ed: "2024"`, bij 2014 ongewijzigd.
4. **Buiten scope**: nieuwe mechaniek.
5. **Aanpak**: **senior UX-agent vóór het bouwen** (plek: Instellingen-sectie vs welkomstkaart vs kop; aantal tikken; status zichtbaar in Voorbereiden?). Bestaande `.seg`-patroon, `<details class="setsec">`, geen melding bij opstarten.
6. **Afhankelijk van**: WP46–WP53.
7. **Acceptatie**: bestaande gebruiker ziet na update "Regels: 2014" en exact het oude gedrag (incl. Spells 2024 als hij dat had); omzetten naar 2024 verandert zoeken, statblocks, exhaustion, surprise, conc-DC, moeilijkheid, condities-uitleg en spells; tijdens een gevecht is de keuze niet te wijzigen; Ongedaan zet hem terug; export/import neemt hem mee; spelersscherm volgt.
8. **Tests**: `spellrules.test.js`, `tour.test.js`, `pages.test.js`, i18n; browsercheck-scenario `g1-rules` op 320/360/390 licht/donker, `--lang=nl,en`, `--i18n=xx`.
9. **Klaar als**: alles groen, UX- en developer-review gemeld, vertaalagent, versie volgens V2, CLAUDE.md "Basis" en "Gevecht" bijgewerkt, push.
10. **Risico's**: verwarring Regels vs Spells → B2-uitleg in één zin, details onder "Meer".
11. **Omvang**: M.

### WP55 — Integratie, regressie en afronding G1
1. **Doel**: G1 als geheel geverifieerd en gedocumenteerd.
2. **Huidige stand**: na WP54.
3. **Scope**: end-to-endtests (oude backup v3 → v4 zonder betekenisverschil; 2024-encounter exporteren → importeren → inladen; gemengde tafel 2024 met een 2014-monster; kamer/spelersscherm met `ed`); volledige browsercheck; CLAUDE.md-keuzes compleet (geen dubbelingen met dit plan); README/home-bronvermelding; `ROADMAP.md` G1 weg; dit document verwijderen of als historie markeren.
4. **Buiten scope**: nieuwe functies.
5. **Aanpak**: **volledige developer-review** (x.y.0 en formaatwijzigingen samen).
6. **Afhankelijk van**: WP46–WP54.
7. **Acceptatie**: alle punten uit §5 aantoonbaar gedekt door een test of browsercheck; live-check op telefoon (Michiel) in de roadmap onder Operationeel.
8. **Tests**: `npm test` volledig, browsercheck volledig.
9. **Klaar als**: bovenstaande, push en deployment geverifieerd.
11. **Omvang**: S.

---

## 5. Achterwaartse compatibiliteit: risico's en dekking

| Risico | Dekking |
|---|---|
| Bestaande encounter/deelnemer krijgt na 2024-data een ander statblock | B3: zonder `ed` exact oude opzoekvolgorde; test WP46 |
| Oude app leest een 2024-bestand als 2014 | B5: versie omhoog alleen bij 2024-inhoud, oude app weigert die; 2014-exports blijven leesbaar |
| Legacy-data zonder regelset | `rulesOf` → 2014 (WP46) |
| Gebruiker met Spells 2024 verliest gedrag | B2 (WP46/WP54) |
| Wisselen halverwege een gevecht | B1: alleen zonder gevecht (WP54) |
| Exhaustion-HP klopt niet na wisselen | idempotente `reExh(c, ed)`; tafel in de wisselstap, party bij aan tafel zetten/sync (B1, WP50/WP54) |
| 2024-data niet geladen/offline | B4 + B9 |
| 2014-parseruitkomsten veranderen door normalisatie | byte-gelijk-test over 322 monsters (WP48) |
| Spelersscherm van een oudere versie | `ed` optioneel; zonder `ed` 2014-uitleg (WP52) |
| Gedeelde spelerslink/kamer | protocol ongewijzigd (`v: 2`), alleen een extra codeveld |

Geen datamigratie van inhoud nodig: alleen versienummers met een no-op-migratie.
