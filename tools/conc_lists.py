"""Concentratie-spells per editie uit data/spells.json en data/spells-2024.json → js/rules/conclist.js.

De app heeft deze lijst direct nodig (slot-menu, x/day), terwijl de spelldata pas bij de eerste tik laadt.
Draai opnieuw na het bijwerken van de spelldata; tests/spells.test.js bewaakt dat het klopt.
Gebruik (in de repo): python3 -I tools/conc_lists.py
"""
import json

out = {}
for ed, f in (("2014", "data/spells.json"), ("2024", "data/spells-2024.json")):
    out[ed] = sorted(s["n"].lower() for s in json.load(open(f, encoding="utf-8"))["spells"] if s.get("conc"))

with open("js/rules/conclist.js", "w", encoding="utf-8") as fh:
    fh.write("// Gegenereerd door tools/conc_lists.py uit de SRD-spelldata: niet met de hand aanpassen.\n")
    fh.write("// Concentratie-spells per editie (kleine letters).\n")
    fh.write("export const CONC = {\n")
    for ed, names in out.items():
        fh.write(f'  {ed}: {json.dumps(names, ensure_ascii=False)},\n')
    fh.write("};\n")
print({k: len(v) for k, v in out.items()})
