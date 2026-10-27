"""SRD 5.2 (2024) monsters uit Open5e (open5e-api, data/v2/wizards-of-the-coast/srd-2024/) → data/monsters-2024.json.

Gebruik: python3 -I monsters_srd2024.py <map met Creature*.json> <uit.json>
Invoer: Creature.json, CreatureAction.json, CreatureActionAttack.json, CreatureTrait.json uit die map
(gemaakt van open5e-api commit e69ac13, 17-10-2026). De officiële pdf staat in dezelfde repo:
data/raw_sources/srd_5_2/SRD_CC_v5.2.1.pdf. Na een nieuwe Open5e-versie stopt de tool als een correctie niet meer
past (Open5e heeft hem dan zelf verbeterd): die regel uit de tabel halen.
Uitvoer: { ed: "2024", src, monsters: [...] } met dezelfde velden als data/monsters.json
(n, meta, ac, hp, hd, spd, ab, x, cr, xp, t, a, ba, re, l, ld) plus init (Initiative-bonus) en pb.

Herstel ten opzichte van Open5e (gecontroleerd tegen de officiële SRD 5.2.1-pdf):
- aanvallen missen "Hit:" ("Melee Attack Roll: +9, reach 15 ft. 12 (2d6 + 5) …"): ingevoegd na reach/range;
- het aantal legendary actions ontbreekt: altijd 3, "(4 in Lair)" als de Legendary Resistance "in Lair" noemt;
- recharge, uses en vormbeperking staan in een veld, niet in de naam: "(Recharge 5–6)", "(2/Day)", "(Bear Form Only)";
- XP ontbreekt bijna altijd: uit de CR-tabel (Seahorse en Shrieker Fungus: 0); PB idem;
- tekstfouten, spell-lijsten zonder "(level N version)" en de scores van de Octopus: tabellen FIX, LISTS, ABFIX;
- 5etools-restjes ("Sphere [Area of Effect]|XPHB|Sphere", "Cover|XPHB|Total Cover") en markdown (**, _) weg;
- "DM" → "GM", "Hitom" → "Hit or Miss:", "First Failure" zonder dubbele punt, lege of losse spell-lijsten (Imp, Ghost);
- Open5e laat B/P/S-resistances en alle vulnerabilities weg en kent geen Gear of speed-notities: DEF, GEAR, SPEED.
Niet in Open5e en dus niet in de data: subtypes ("(Goblinoid)"), "Medium or Small" en "Swarm of Tiny Beasts" in de metaregel.
"""
import json, os, re, sys

XP = {"0": 10, "1/8": 25, "1/4": 50, "1/2": 100, "1": 200, "2": 450, "3": 700, "4": 1100, "5": 1800, "6": 2300,
      "7": 2900, "8": 3900, "9": 5000, "10": 5900, "11": 7200, "12": 8400, "13": 10000, "14": 11500, "15": 13000,
      "16": 15000, "17": 18000, "18": 20000, "19": 22000, "20": 25000, "21": 33000, "22": 41000, "23": 50000,
      "24": 62000, "25": 75000, "26": 90000, "27": 105000, "28": 120000, "29": 135000, "30": 155000}
CR = {"0.125": "1/8", "0.250": "1/4", "0.500": "1/2"}
ABIL = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"]
SHORT = ["Str", "Dex", "Con", "Int", "Wis", "Cha"]
SKILLS = ["acrobatics", "animal_handling", "arcana", "athletics", "deception", "history", "insight", "intimidation",
          "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion",
          "sleight_of_hand", "stealth", "survival"]
SENSES = ["blindsight", "darkvision", "tremorsense", "truesight"]
MOVES = ["burrow", "climb", "fly", "swim"]
NOUN = {"Mummy Lord": "mummy", "Sphinx of Lore": "sphinx", "Sphinx of Valor": "sphinx"}  # anders: laatste woord
# Tekstfouten in Open5e (oude markdown of import), per (monster, entry) vergeleken met de SRD 5.2.1-pdf.
# Vindt de tool de oude tekst niet meer (Open5e verbeterd), dan stopt hij: regel dan hier weghalen.
FIX = {
    ("Adult Black Dragon", "Pounce"): [("The dragon can move up", "The dragon moves up")],
    ("Awakened Tree", "Slam"): [("13 (2d8 + 4)", "14 (3d6 + 4)")],
    ("Axe Beak", "Beak"): [("5 (1d6 + 2)", "6 (1d8 + 2)")],
    ("Bandit Captain", "Parry"): [("The captain adds 2 to its AC against one melee attack that would hit it. To do so, the "
                                   "captain must see the attacker and be wielding a melee weapon.",
                                   "Trigger: The bandit is hit by a melee attack roll while holding a weapon. Response: The "
                                   "bandit adds 2 to its AC against that attack, possibly causing it to miss.")],
    ("Basilisk", "Petrifying Gaze (Recharge 4-6)"): [("reflection within the Cone", "reflection in the Cone")],
    ("Chain Devil", "Unnerving Gaze"): [("Response––", "Response—")],
    ("Darkmantle", "Darkness Aura"): [("Magical darkness", "Magical Darkness")],
    ("Imp", "Shape-Shift"): [("Its statistics", "Its game statistics")],
    ("Incubus", "Succubus Form"): [("it's wearing", "it is wearing")],
    ("Shadow", "Shadow Stealth"): [("or darkness", "or Darkness")],
    ("Succubus", "Shape-Shift"): [("shape-shifts to resemble a Medium or Small Humanoid or back into its true form",
                                   "shape-shifts into a Medium or Small Humanoid, or it returns to its true form"),
                                  ("it's wearing", "it is wearing")],
}
# Spell-lijsten van Spellcasting waar Open5e afwijkt (mist "(level N version)" en andere voorwaarden, of de volgorde):
# overgenomen uit de SRD 5.2.1-pdf. Andere Spellcasting-lijsten zijn gelijk aan de pdf.
SC = ("Shapechange (Beast or Humanoid form only, no Temporary Hit Points gained from the spell, and no Concentration or "
      "Temporary Hit Points required to maintain the spell)")
LISTS = {
    "Adult Black Dragon": ["At Will: Acid Arrow (level 3 version), Detect Magic, Fear", "1/Day Each: Speak with Dead, Vitriolic Sphere"],
    "Adult Bronze Dragon": [f"At Will: Detect Magic, Guiding Bolt (level 2 version), {SC}, Speak with Animals, Thaumaturgy",
                            "1/Day Each: Detect Thoughts, Water Breathing"],
    "Adult Copper Dragon": [f"At Will: Detect Magic, Mind Spike (level 4 version), Minor Illusion, {SC}",
                            "1/Day Each: Greater Restoration, Major Image"],
    "Adult Red Dragon": ["At Will: Command (level 2 version), Detect Magic, Scorching Ray", "1/Day: Fireball"],
    "Ancient Black Dragon": ["At Will: Acid Arrow (level 4 version), Detect Magic, Fear",
                             "1/Day Each: Create Undead, Speak with Dead, Vitriolic Sphere (level 5 version)"],
    "Ancient Blue Dragon": ["At Will: Detect Magic, Invisibility, Mage Hand, Shatter (level 3 version)", "1/Day Each: Scrying, Sending"],
    "Ancient Brass Dragon": [f"At Will: Detect Magic, Minor Illusion, Scorching Ray (level 3 version), {SC}, Speak with Animals",
                             "1/Day Each: Control Weather, Detect Thoughts"],
    "Ancient Bronze Dragon": [f"At Will: Detect Magic, Guiding Bolt (level 2 version), {SC}, Speak with Animals, Thaumaturgy",
                              "1/Day Each: Detect Thoughts, Control Water, Scrying, Water Breathing"],
    "Ancient Copper Dragon": [f"At Will: Detect Magic, Mind Spike (level 5 version), Minor Illusion, {SC}",
                              "1/Day Each: Greater Restoration, Major Image, Project Image"],
    "Ancient Gold Dragon": [f"At Will: Detect Magic, Guiding Bolt (level 4 version), {SC}",
                            "1/Day Each: Flame Strike (level 6 version), Word of Recall, Zone of Truth"],
    "Ancient Green Dragon": ["At Will: Detect Magic, Mind Spike (level 5 version)", "1/Day Each: Geas, Modify Memory"],
    "Ancient Red Dragon": ["At Will: Command (level 2 version), Detect Magic, Scorching Ray (level 3 version)",
                           "1/Day Each: Fireball (level 6 version), Scrying"],
    "Ancient Silver Dragon": [f"At Will: Detect Magic, Hold Monster, Ice Knife (level 2 version), {SC}",
                              "1/Day Each: Control Weather, Ice Storm (level 7 version), Teleport, Zone of Truth"],
    "Archmage": ["At Will: Detect Magic, Detect Thoughts, Disguise Self, Invisibility, Light, Mage Armor (included in AC), "
                 "Mage Hand, Prestidigitation", "2/Day Each: Fly, Lightning Bolt (level 7 version)",
                 "1/Day Each: Cone of Cold (level 9 version), Mind Blank (cast before combat), Scrying, Teleport"],
    "Cultist Fanatic": ["At Will: Light, Thaumaturgy", "2/Day: Command", "1/Day: Hold Person"],
    "Djinni": ["At Will: Detect Evil and Good, Detect Magic",
               "2/Day Each: Create Food and Water (can create wine instead of water), Tongues, Wind Walk",
               "1/Day Each: Creation, Gaseous Form, Invisibility, Major Image, Plane Shift"],
    "Druid": ["At Will: Druidcraft, Speak with Animals", "2/Day Each: Entangle, Thunderwave",
              "1/Day Each: Animal Messenger, Longstrider, Moonbeam"],
    "Giant Owl": ["At Will: Detect Evil and Good, Detect Magic", "1/Day: Clairvoyance"],
    "Green Hag": ["At Will: Dancing Lights, Disguise Self (24-hour duration), Invisibility (self only, and the hag leaves no "
                  "tracks while Invisible), Minor Illusion, Ray of Sickness (level 3 version)"],
    "Guardian Naga": ["At Will: Thaumaturgy", "1/Day Each: Clairvoyance, Cure Wounds (level 6 version), Flame Strike "
                      "(level 6 version), Geas, True Seeing"],
    "Lich": ["At Will: Detect Magic, Detect Thoughts, Dispel Magic, Fireball (level 5 version), Invisibility, Lightning Bolt "
             "(level 5 version), Mage Hand, Prestidigitation", "2/Day Each: Animate Dead, Dimension Door, Plane Shift",
             "1/Day Each: Chain Lightning, Finger of Death, Power Word Kill, Scrying"],
    "Mage": ["At Will: Detect Magic, Light, Mage Armor (included in AC), Mage Hand, Prestidigitation",
             "2/Day Each: Fireball (level 4 version), Invisibility", "1/Day Each: Cone of Cold, Fly"],
    "Night Hag": ["At Will: Detect Magic, Etherealness, Magic Missile (level 4 version)",
                  "2/Day Each: Phantasmal Killer, Plane Shift (self only)"],
    "Oni": ["1/Day Each: Charm Person (level 2 version), Darkness, Gaseous Form, Sleep"],
    "Priest": ["At Will: Light, Thaumaturgy", "1/Day: Spirit Guardians"],
    "Spirit Naga": ["At Will: Detect Magic, Mage Hand, Minor Illusion, Water Breathing",
                    "2/Day Each: Detect Thoughts, Dimension Door, Hold Person (level 3 version), Lightning Bolt (level 4 version)"],
    "Storm Giant": ["At Will: Detect Magic, Light", "1/Day: Control Weather"],
}
ABFIX = {"Octopus": [4, 15, 11, 3, 10, 4]}  # Open5e: scores en saves verschoven (Con 0, Cha −3, Con-save +30); SRD: geen save-proficiency
# Open5e laat Bludgeoning/Piercing/Slashing weg uit resistances en immunities, en heeft geen vulnerabilities:
# volledige regels uit de pdf (de tool controleert dat de regel zonder B/P/S gelijk is aan Open5e).
BPS = "Bludgeoning, Piercing, Slashing"
DEF = {
    "Air Elemental": {"Resistances": "Bludgeoning, Lightning, Piercing, Slashing"},
    "Awakened Shrub": {"Vulnerabilities": "Fire", "Resistances": "Piercing"},
    "Awakened Tree": {"Vulnerabilities": "Fire", "Resistances": "Bludgeoning, Piercing"},
    "Black Pudding": {"Immunities": "Acid, Cold, Lightning, Slashing; Charmed, Deafened, Exhaustion, Frightened, Grappled, Prone, Restrained"},
    "Chain Devil": {"Resistances": "Bludgeoning, Cold, Piercing, Slashing"},
    "Clay Golem": {"Resistances": BPS}, "Couatl": {"Resistances": BPS}, "Fire Elemental": {"Resistances": BPS},
    "Invisible Stalker": {"Resistances": BPS}, "Tarrasque": {"Resistances": BPS},
    "Ghost": {"Resistances": "Acid, Bludgeoning, Cold, Fire, Lightning, Piercing, Slashing, Thunder"},
    "Specter": {"Resistances": "Acid, Bludgeoning, Cold, Fire, Lightning, Piercing, Slashing, Thunder"},
    "Ochre Jelly": {"Immunities": "Lightning, Slashing; Charmed, Deafened, Exhaustion, Frightened, Grappled, Prone, Restrained"},
    "Treant": {"Vulnerabilities": "Fire", "Resistances": "Bludgeoning, Piercing"},
    "Will-o'-Wisp": {"Resistances": "Acid, Bludgeoning, Cold, Fire, Necrotic, Piercing, Slashing"},
    "Wraith": {"Resistances": "Acid, Bludgeoning, Cold, Fire, Piercing, Slashing"},
    "Earth Elemental": {"Vulnerabilities": "Thunder"}, "Ice Mephit": {"Vulnerabilities": "Fire"},
    "Dust Mephit": {"Vulnerabilities": "Fire"}, "Magma Mephit": {"Vulnerabilities": "Cold"}, "Mummy": {"Vulnerabilities": "Fire"},
    "Mummy Lord": {"Vulnerabilities": "Fire"}, "Salamander": {"Vulnerabilities": "Cold"}, "Shadow": {"Vulnerabilities": "Radiant"},
    "Rakshasa": {"Vulnerabilities": "Piercing damage from weapons wielded by creatures under the effect of a Bless spell"},
    "Skeleton": {"Vulnerabilities": "Bludgeoning"}, "Warhorse Skeleton": {"Vulnerabilities": "Bludgeoning"},
    "Minotaur Skeleton": {"Vulnerabilities": "Bludgeoning"},
}
for n in ("Bats", "Crawling Claws", "Insects", "Piranhas", "Rats", "Ravens", "Venomous Snakes"):
    DEF["Swarm of " + n] = {"Resistances": BPS}
UNIMPEDED = {"Barbed Devil", "Bearded Devil", "Bone Devil", "Chain Devil", "Horned Devil", "Imp", "Lemure"}  # "(unimpeded by magical Darkness)"
SPEED = {  # speed-notities die Open5e niet kent
    "Werebear": "30 ft., 40 ft. (bear form only), Climb 30 ft. (bear form only)", "Wereboar": "30 ft., 40 ft. (boar form only)",
    "Weretiger": "30 ft., 40 ft. (tiger form only)", "Werewolf": "30 ft., 40 ft. (wolf form only)",
    "Swarm of Insects": "20 ft., Climb or Fly 20 ft. (GM's choice)",
}
GEAR = {  # Open5e heeft geen Gear
    "Archmage": "Wand", "Assassin": "Light Crossbow, Shortsword, Studded Leather Armor", "Bandit": "Leather Armor, Light Crossbow, Scimitar",
    "Bandit Captain": "Pistol, Scimitar, Studded Leather Armor", "Berserker": "Greataxe, Hide Armor",
    "Bugbear Stalker": "Chain Shirt, Javelins (6), Morningstar", "Bugbear Warrior": "Hide Armor, Light Hammers (3)",
    "Centaur Trooper": "Breastplate, Longbow, Pike", "Commoner": "Club", "Cultist": "Leather Armor, Sickle",
    "Cultist Fanatic": "Holy Symbol, Leather Armor", "Druid": "Studded Leather Armor", "Ettin": "Battleaxe, Morningstar",
    "Gladiator": "Shield, Spears (3), Studded Leather Armor", "Goblin Boss": "Chain Shirt, Scimitar, Shield, Shortbow",
    "Goblin Minion": "Daggers (3)", "Goblin Warrior": "Leather Armor, Scimitar, Shield, Shortbow", "Guard": "Chain Shirt, Shield, Spear",
    "Guard Captain": "Breastplate, Javelins (6), Longsword, Shield", "Hobgoblin Captain": "Greatsword, Half Plate Armor, Longbow",
    "Hobgoblin Warrior": "Half Plate Armor, Longbow, Longsword, Shield", "Knight": "Greatsword, Heavy Crossbow, Plate Armor",
    "Kobold Warrior": "Daggers (3)", "Lich": "Component Pouch", "Mage": "Wand", "Noble": "Breastplate, Rapier",
    "Ogre": "Greatclub, Javelins (3)", "Pirate": "Daggers (6), Leather Armor", "Pirate Captain": "Pistol, Rapier",
    "Priest": "Chain Shirt, Holy Symbol, Mace", "Priest Acolyte": "Chain Shirt, Holy Symbol, Mace", "Scout": "Leather Armor, Longbow, Shortsword",
    "Skeleton": "Shortbow, Shortsword", "Spy": "Hand Crossbow, Shortsword, Thieves' Tools", "Tough": "Heavy Crossbow, Leather Armor, Mace",
    "Tough Boss": "Chain Mail, Heavy Crossbow, Warhammer", "Vampire Familiar": "Daggers (10)", "Warrior Infantry": "Chain Shirt, Spear",
    "Warrior Veteran": "Greatsword, Heavy Crossbow, Splint Armor", "Werebear": "Handaxes (4)", "Wereboar": "Javelins (6)",
    "Wererat": "Hand Crossbow", "Weretiger": "Longbow", "Werewolf": "Longbow", "Wight": "Studded Leather Armor",
}
XSET = {  # losse statregels die in Open5e afwijken van de pdf
    "Blink Dog": {"Languages": "Blink Dog; understands Elvish and Sylvan but can't speak them"},
    "Mage": {"Languages": "Common plus three other languages"},
    "Panther": {"Skills": "Perception +4, Stealth +7"},
}
XP0 = {"Seahorse", "Shrieker Fungus"}  # CR 0 met XP 0 in de SRD (de andere CR 0-monsters: XP 10)
RENAME = {("Black Pudding", "Parry"): "Split"}  # reaction heet in Open5e "Parry", tekst is Split
KIND = {"ACTION": "a", "BONUS_ACTION": "ba", "REACTION": "re", "LEGENDARY_ACTION": "l"}
U = r"(?:ft|feet)\.?"  # Open5e: soms "feet" of "ft" zonder punt
HIT = re.compile(r"^((?:Melee|Ranged|Melee or Ranged) Attack Roll: [+-]\d+(?: \([^)]*\))?, "
                 rf"(?:reach \d+ {U}(?: or range \d+(?:/\d+)? {U})?|range \d+(?:/\d+)? {U})) (?!Hit:)")


def title(s):
    return " ".join(w if w in ("or", "of", "and") else w[:1].upper() + w[1:] for w in s.split(" "))


def items(s):
    return ", ".join(title(x.strip()) for x in s.split(",") if x.strip())


def num(n):
    return f"+{n}" if n >= 0 else str(n)


def clean(t):
    # kopjes als in de SRD ("Forbiddance. …", "1–4. …", "First Roar. …"), geen opsomming; spell-lijsten blijven "• At Will: …"
    t = re.sub(r"^- (?:\*\*)?(?!At Will|\d+/Day)([A-Z][\w ]*?|\d+-\d+):(?:\*\*)? ", lambda m: m[1].replace("-", "–") + ". ", t, flags=re.M)
    t = re.sub(r" - (?:\*\*)?(\w+ Roar):(?:\*\*)? ", r"\n\1. ", t)  # Sphinx of Valor: kopjes midden in één alinea
    t = re.sub(r"^- \*\*(?:At Will|\d+/Day(?: Each)?):\*\*\s*$", "", t, flags=re.M)  # lege lijstregel (Oni, Ice Mephit)
    t = re.sub(r"\w+(?: \[[^\]]*\])?\|[A-Za-z]+\|", "", t)  # 5etools-tag: alleen de weergavetekst blijft
    t = re.sub(r"(?<![A-Za-z0-9])_([^_\n]+?)_(?![A-Za-z0-9])", r"\1", t).replace("**", "")
    t = re.sub(r"^- ", "• ", t, flags=re.M)  # spell-lijsten: "- At Will: …" → "• At Will: …"
    t = re.sub(r"\bDM(?=\b|'s)", "GM", t)  # Open5e-rest uit de oude markdown; SRD 5.2 en 5.2.1 zeggen GM
    t = re.sub(r"\(Recharge (\d)-6\)", r"(Recharge \1–6)", t)
    t = t.replace("Hitom", "Hit or Miss: ").replace("Hitazard ", "").replace("Short Short or", "Short or")  # Open5e-rommel
    t = re.sub(r"\b(First|Second) Failure (?=[A-Z])", r"\1 Failure: ", t)
    t = re.sub(r"D20 Test(?=[ .,] ?(?:and|$|\.))", "D20 Tests", t)
    t = t.replace("provoke Opportunity Attacks", "provoke an Opportunity Attack")
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n{2,}", "\n", t).strip()
    if re.search(r"[|*_#]", t):
        raise SystemExit(f"opmaak over: {t[:80]}")
    return t


def suffix(f):
    """Gebruik en vormbeperking als in de SRD: "(Recharge 5–6)", "(2/Day)", "(1/Day; Requires Soul Bag)" """
    u, p = f.get("uses_type"), f.get("uses_param")
    parts = []
    if re.search(r"\((?:Recharge|\d+/Day)", f["name"]):  # staat al in de naam (Basilisk, Blink Dog, Cloaker)
        u = None
    if u in ("RECHARGE", "RECHARGE_ON_ROLL"):
        parts.append("Recharge after a Short or Long Rest" if p is None else f"Recharge {p}–6" if p < 6 else "Recharge 6")
    elif u == "PER_DAY":
        parts.append(f"{p}/Day")
    elif u:
        raise SystemExit(f"onbekend uses_type {u}: {f['name']}")
    if f.get("limited_to_form"):
        parts.append(title(f["limited_to_form"]))
    if (f.get("legendary_action_cost") or 1) > 1:
        raise SystemExit(f"legendary_action_cost > 1 bestaat niet in SRD 5.2: {f['name']}")
    return f" ({'; '.join(parts)})" if parts else ""


def load(d, name):
    return json.load(open(os.path.join(d, name + ".json"), encoding="utf-8"))


d = sys.argv[1]
creatures = load(d, "Creature")
acts, traits = {}, {}
attacks = {a["fields"]["parent"] for a in load(d, "CreatureActionAttack")}
for a in load(d, "CreatureAction"):
    acts.setdefault(a["fields"]["parent"], []).append((a["pk"], a["fields"]))
for t in load(d, "CreatureTrait"):
    traits.setdefault(t["fields"]["parent"], []).append(t["fields"])

def fix(mn, en, txt):
    for old, new in FIX.pop((mn, en), []):
        if old not in txt:
            raise SystemExit(f"FIX klopt niet meer: {mn} / {en}: {old[:40]}")
        txt = txt.replace(old, new)
    return txt


out, bad = [], []
for c in sorted(creatures, key=lambda c: c["fields"]["name"]):
    pk, f = c["pk"], c["fields"]
    if f["document"] != "srd-2024":
        raise SystemExit(f"ander document: {pk}")
    cr = CR.get(f["challenge_rating"]) or str(int(float(f["challenge_rating"])))
    ab = ABFIX.get(f["name"]) or [f["ability_score_" + a] for a in ABIL]
    mod = [(s - 10) // 2 for s in ab]
    x = []
    saves = [f"{SHORT[i]} {num(f['saving_throw_' + a])}" for i, a in enumerate(ABIL) if f["name"] not in ABFIX
             and f["saving_throw_" + a] is not None and f["saving_throw_" + a] != mod[i]]
    if saves: x.append(["Saving Throws", ", ".join(saves)])
    sk = [f"{title(s.replace('_', ' '))} {num(f['skill_bonus_' + s])}" for s in SKILLS if f["skill_bonus_" + s] is not None]
    if sk: x.append(["Skills", ", ".join(sk)])
    dfx = DEF.pop(f["name"], {})
    if f["damage_vulnerabilities_display"]: raise SystemExit(f"Open5e heeft nu vulnerabilities: {f['name']}")
    if "Vulnerabilities" in dfx: x.append(["Vulnerabilities", dfx["Vulnerabilities"]])
    imm = "; ".join(items(s) for s in (f["damage_immunities_display"], f["condition_immunities_display"]) if s)
    for k, o5 in (("Resistances", items(f["damage_resistances_display"])), ("Immunities", imm)):
        v = dfx.get(k, o5)
        if k in dfx and re.sub(r", (?=;|$)", "", re.sub(r"(?:Bludgeoning|Piercing|Slashing)(?:, )?", "", v)) != o5:
            raise SystemExit(f"DEF klopt niet meer met Open5e: {f['name']} {k}: {v} / {o5}")
        if v: x.append([k, v])
    if f["name"] in GEAR: x.append(["Gear", GEAR.pop(f["name"])])
    sen = [f"{title(s)} {f[s + '_range']} ft." + (" (unimpeded by magical Darkness)" if s == "darkvision" and f["name"] in UNIMPEDED else "")
           for s in SENSES if f[s + "_range"]]
    x.append(["Senses", "; ".join([", ".join(sen)] if sen else []) + ("; " if sen else "") + f"Passive Perception {f['passive_perception']}"])
    x.append(["Languages", (f["languages_desc"].strip() or "None").replace("Thieves' cant", "Thieves' Cant").replace(", And ", ", and ")])
    for k, v in XSET.pop(f["name"], {}).items():
        row = next((r for r in x if r[0] == k), None)
        if not row or row[1] == v:
            raise SystemExit(f"XSET klopt niet meer: {f['name']} {k}")
        row[1] = v
    spd = [f"{f['walk'] or 0} ft."] + [f"{title(m)} {f[m]} ft." + (" (hover)" if m == "fly" and f["hover"] else "") for m in MOVES if f[m]]
    m = {"n": f["name"], "meta": f"{title(f['size'])} {title(f['type'])}, {title(f['alignment'])}",
         "ac": str(f["armor_class"]), "hp": f["hit_points"], "hd": f["hit_dice"].replace(" ", ""), "spd": SPEED.pop(f["name"], ", ".join(spd)),
         "ab": ab, "x": x, "cr": cr, "xp": 0 if f["name"] in XP0 else XP[cr], "init": f["initiative_bonus"], "pb": 2 + max(0, int(float(f["challenge_rating"])) - 1) // 4,
         "t": [[clean(t["name"]), fix(f["name"], t["name"], clean(t["desc"]))] for t in sorted(traits.get(pk, []), key=lambda t: t["name"])],
         "a": [], "ba": [], "re": [], "l": [], "ld": ""}
    for apk, a in sorted(acts.get(pk, []), key=lambda p: (p[1]["order_in_statblock"], p[1]["name"])):
        txt = fix(f["name"], a["name"], clean(a["desc"]))
        if a["name"] == "Spellcasting" and f["name"] in LISTS:
            txt = "\n".join([txt.split("\n")[0]] + ["• " + x for x in LISTS.pop(f["name"])])
        txt = re.sub(r"(Attack Roll: [+-]\d+) to hit,", r"\1,", txt)  # 2014-rest (Bat; de SRD heeft hem zelf bij Ancient Gold Dragon)
        if "Spellcasting" not in a["name"]:  # Open5e plakt een spell-lijst achter losse spell-acties (Imp, Ghost, Night Hag)
            txt = re.sub(r"\n• (?:At Will|\d+/Day(?: Each)?):.*", "", txt)
        if apk in attacks or re.match(r"^(?:Melee|Ranged|Melee or Ranged) Attack Roll:", txt):
            txt, n = HIT.subn(r"\1 Hit: ", txt)
            if (not n and "Hit:" not in txt) or "Hit: or " in txt:
                bad.append(f"geen Hit: in {apk}: {txt[:90]}")
        m[KIND[a["action_type"]]].append([RENAME.get((f["name"], a["name"]), clean(a["name"])) + suffix(a), txt])
    if m["l"]:
        lair = any("in Lair" in t[0] for t in m["t"])
        who = "the " + NOUN.get(f["name"], f["name"].split()[-1].lower())
        m["ld"] = (f"Legendary Action Uses: 3{' (4 in Lair)' if lair else ''}. Immediately after another creature's turn, "
                   f"{who} can expend a use to take one of the following actions. {who[:1].upper() + who[1:]} regains all "
                   "expended uses at the start of each of its turns.")
    out.append(m)

if FIX or LISTS or DEF or GEAR or SPEED or XSET:
    raise SystemExit(f"tabel niet gebruikt: {list(FIX)} {list(LISTS)} {list(DEF)} {list(GEAR)} {list(SPEED)} {list(XSET)}")
if False:
    raise SystemExit(f"FIX niet gebruikt: {list(FIX)}")
if bad:
    raise SystemExit("\n".join(bad))
doc = {"ed": "2024", "src": "System Reference Document 5.2.1 (2024), Wizards of the Coast, CC-BY-4.0, via Open5e, checked against the "
       "official SRD 5.2.1 PDF", "monsters": out}
with open(sys.argv[2], "w", encoding="utf-8") as fh:
    json.dump(doc, fh, ensure_ascii=False, separators=(",", ":"))
print(len(out), "monsters")
