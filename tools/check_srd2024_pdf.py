"""Controle van data/monsters-2024.json tegen de officiële SRD 5.2.1-pdf (WP47). Niet in npm test: de pdf zit niet in de repo.

Gebruik:
  pdftotext <open5e-api>/data/raw_sources/srd_5_2/SRD_CC_v5.2.1.pdf srd.txt
  python3 -I tools/check_srd2024_pdf.py srd.txt data/monsters-2024.json

Vergelijkt genormaliseerde tekst (zonder witruimte en koppeltekens, ’ → '), dus de kolom- en paginalay-out van de pdf
telt niet: elke entry (naam + tekst) en `ld` moet in de pdf staan, met hoogstens een paar lange onderbrekingen
(andere kolom); een kort gat is een echt verschil. Verder moeten per monster deze regels ergens in de pdf staan (niet
per statblock verankerd, de lay-out is daarvoor te grillig): AC, Initiative, HP + hit dice, CR + XP, PB, ability
scores met modifier en save, de statregels, speed en grootte + type uit `meta`.
Bekende meldingen (27-10-2026, Open5e e69ac13): Ancient Gold Dragon Rend ("+17 to hit" in de pdf, bewust "+17,") en
een handvol entries die over een paginagrens lopen (Bulette Deadly Leap, Djinni Create Whirlwind/Spellcasting,
Kraken Swallow, Unicorn Shimmering Shield, Vampire Spawn Vampire Weakness, enkele Spellcasting-lijsten).
"""
import json, re, sys

raw = open(sys.argv[1], encoding="utf-8").read()
raw = re.sub(r"\n\d{1,3}\n|System Reference Document 5\.2\.1", " ", raw)


def norm(s):
    s = s.replace("’", "'").replace("−", "-").replace("–", "-").replace("“", '"').replace("”", '"')
    return re.sub(r"[\s•\-]", "", s)


P = norm(raw)


def found(q, start=0, gaps=4):
    """q staat in P vanaf start, met hoogstens `gaps` lay-outonderbrekingen (≥ 25 en < 2500 tekens)"""
    if not q:
        return True
    end = start + 2500 if start else None
    if P.find(q, start, end) >= 0:
        return True
    if not gaps:
        return False
    lo, hi = 12, len(q)
    while lo <= hi:
        mid = (lo + hi) // 2
        if P.find(q[:mid], start, end) >= 0:
            lo = mid + 1
        else:
            hi = mid - 1
    L = lo - 1
    if L < 12:
        return False
    s = start
    while True:
        j = P.find(q[:L], s, end)
        if j < 0:
            return False
        if found(q[L:], j + L + 25, gaps - 1):
            return True
        s = j + 1


d = json.load(open(sys.argv[2], encoding="utf-8"))["monsters"]
SH = ["Str", "Dex", "Con", "Int", "Wis", "Cha"]
bad = []
for m in d:
    for k in ("t", "a", "ba", "re", "l"):
        for n, t in m[k]:
            if not found(norm(n + ". " + t)):
                bad.append(f"{m['n']} | {k} | {n}")
    if m["ld"] and not found(norm(m["ld"])):
        bad.append(f"{m['n']} | ld")
    sv = dict(x.split(" ") for x in dict(m["x"]).get("Saving Throws", "").split(", ") if x)
    sign = lambda v: f"+{v}" if v >= 0 else str(v)
    stat = [f"AC {m['ac']}", f"Initiative {sign(m['init'])} ({10 + m['init']})",
            f"HP {m['hp']} ({m['hd'].replace('+', ' + ').replace('-', ' - ')})",
            f"CR {m['cr']} (XP {m['xp']:,}", f"PB +{m['pb']})", "Speed " + m["spd"],
            m["meta"].split(",")[0].split(" (")[0]]
    for i, s in enumerate(SH):
        mod = (m["ab"][i] - 10) // 2
        stat.append(f"{s} {m['ab'][i]} {sign(mod)} {sign(int(sv.get(s, mod)))}")
    stat += [f"{k} {v}" for k, v in m["x"] if k != "Saving Throws"]
    for s in stat:
        if norm(s) not in P:
            bad.append(f"{m['n']} | stat | {s}")
print(len(bad), "afwijkingen")
for b in bad:
    print(" ", b)
