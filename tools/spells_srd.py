"""SRD 5.1 (2014) spells uit 5e-bits/5e-database → compact data/spells.json voor Initiative Tafel.

Gebruik: python3 -I conv_spells.py <5e-SRD-Spells.json> <uit.json>
Velden: n naam, lv level (0 = cantrip), sch school, t casting time, r range, c components,
d duration, conc, rit, x tekst en h higher levels als lijst blokken: alinea (tekst), { b: "1. Red.", t: "..." }
(alinea met vette aanloop) of { tbl: [[kop...], [rij...]] } (tabel). Markdown wordt hier omgezet, niet in de app.
"""
import json, re, sys

# 5e-bits laat de trigger van reaction-spells weg; SRD 5.1 noemt die bij de casting time.
TRIGGER = {
    "Counterspell": "which you take when you see a creature within 60 feet of you casting a spell",
    "Feather Fall": "which you take when you or a creature within 60 feet of you falls",
    "Hellish Rebuke": "which you take in response to being damaged by a creature within 60 feet of you that you can see",
    "Shield": "which you take when you are hit by an attack or targeted by the magic missile spell",
}

# 5e-bits schrijft "dexterity saving throw"; de SRD gebruikt ability-namen met hoofdletter (WP40)
ABIL = re.compile(r"\b(strength|dexterity|constitution|intelligence|wisdom|charisma)\b(?= (?:saving throws?|checks?|scores?|modifiers?)\b| \()")

def cap(t):
    return ABIL.sub(lambda m: m[1].capitalize(), t)


def blocks(paras):
    out, tbl = [], None
    for p in (x.strip() for x in paras):
        if not p:
            continue
        if p.startswith("|"):
            cells = [c.strip() for c in p.strip("|").split("|")]
            if all(re.fullmatch(r":?-+:?", c) for c in cells):
                continue  # scheidingsregel |---|---|
            if tbl is None:
                tbl = {"tbl": []}
                out.append(tbl)
            tbl["tbl"].append([cap(c.replace("*", "")) for c in cells])
            continue
        tbl = None
        m = re.match(r"^\*\*\*(.+?)\*\*\*\s*(.*)$", p)
        out.append({"b": m[1].strip(), "t": cap(m[2].replace("*", ""))} if m else cap(p.replace("*", "")))
    return out


src = json.load(open(sys.argv[1], encoding="utf-8"))
out = []
for s in sorted(src, key=lambda x: x["name"]):
    comp = ", ".join(s["components"])
    if s.get("material"):
        comp += f" ({s['material'].rstrip('.')})"
    t = s["casting_time"]
    if s["name"] in TRIGGER:
        t += ", " + TRIGGER[s["name"]]
    elif t == "1 reaction":
        raise SystemExit(f"reaction zonder trigger: {s['name']}")
    e = {
        "n": s["name"], "lv": s["level"], "sch": s["school"]["name"], "t": t, "r": s["range"],
        "c": comp, "d": s["duration"], "x": blocks(s["desc"]),
    }
    if s["concentration"]: e["conc"] = 1
    if s["ritual"]: e["rit"] = 1
    if s.get("higher_level"): e["h"] = blocks(s["higher_level"])
    out.append(e)

doc = {"ed": "2014", "src": "System Reference Document 5.1 (2014), Wizards of the Coast, CC-BY-4.0, via 5e-bits/5e-database", "spells": out}
with open(sys.argv[2], "w", encoding="utf-8") as f:
    json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
print(len(out), "spells")
