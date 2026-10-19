"""SRD 5.2 (2024) spells uit Open5e (open5e-api, data/v2/wizards-of-the-coast/srd-2024/Spell.json) → data/spells-2024.json.

Gebruik: python3 -I spells_srd2024.py <Spell.json> <uit.json>
Zelfde velden als data/spells.json (zie tools/spells_srd.py). 5e-bits heeft voor 2024 tekst uit een PDF-extractie
(tabellen kwijt, spells door elkaar), daarom Open5e. Open5e heeft markdown: alinea's, "**Kop.**", "- " lijsten en
tabellen; vier tabellen staan plat op één regel ("Table: Omens | Omen | ... | |---|---| | Weal | Good |").
"""
import json, re, sys

CAST = {"action": "Action", "bonus-action": "Bonus Action", "reaction": "Reaction",
        "1minute": "1 minute", "10minutes": "10 minutes", "1hour": "1 hour", "8hours": "8 hours", "12hours": "12 hours", "24hours": "24 hours"}


def clean(t):
    t = re.sub(r"(?<![A-Za-z0-9])_([^_]+?)_(?![A-Za-z0-9])", r"\1", t)  # _cursief_
    return re.sub(r"\s+", " ", t.replace("**", "").replace("*", "")).strip()


def para(p):
    p = p.strip()
    if p.startswith("- "):
        r = para(p[2:])
        return {"b": "• " + r["b"], "t": r["t"]} if isinstance(r, dict) else "• " + r
    p = re.sub(r"^(?:\*\*)?_([^_]+?)_(?:\*\*)?(?=\s)", r"**\1**", p)  # "**_Kop._**" of "_Kop._" → "**Kop.**"
    m = re.match(r"^\*\*(.+?)\*\*\s*(.*)$", p, re.S)
    if m and m[1].rstrip().endswith((".", ":")):
        return {"b": clean(m[1]), "t": clean(m[2])}
    return clean(p)


def table_rows(lines):
    rows = []
    for l in lines:
        cells = [clean(c) for c in l.strip().strip("|").split("|")]
        if all(re.fullmatch(r":?-+:?", c) for c in cells):
            continue
        rows.append(cells)
    return {"tbl": rows}


def flat(p):
    """Platte tabellen ("Table: Titel | kop | kop | |---|---| | a | b |") → blokken; tekst ervoor en erna blijft alinea."""
    out = []
    parts = re.split(r"Table: ([^|]+?)\s*(?=\|)", p)
    if parts[0].strip():
        out.append(para(parts[0]))
    for title, seg in zip(parts[1::2], parts[2::2]):
        last = seg.rindex("|")
        body, rest = seg[: last + 1], seg[last + 1:]
        rows = re.split(r"\|\s+\|", body.strip().strip("|"))
        out.append({"b": clean(title), "t": ""})
        out.append(table_rows(["|" + r + "|" for r in rows]))
        if rest.strip():
            out.append(para(rest))
    return out


def blocks(text):
    out, buf = [], []
    def flush():
        if buf:
            out.append(table_rows(buf))
            buf.clear()
    for line in (text or "").split("\n"):
        s = line.strip()
        if s.startswith("|") and s.endswith("|") and "Table:" not in s:
            buf.append(s)
            continue
        flush()
        if not s:
            continue
        if "Table:" in s:
            out.extend(flat(s))
        else:  # Alter Self: "... different one. _Aquatic Adaptation._ You ..." in één alinea → losse koppen
            out.extend(para(x) for x in re.split(r"(?<=\.) (?=_[A-Z][^_]*\._ )", s))
    flush()
    return out


src = json.load(open(sys.argv[1], encoding="utf-8"))
out = []
for f in sorted((x["fields"] for x in src), key=lambda f: f["name"]):
    ct = CAST.get(f["casting_time"])
    if not ct:
        raise SystemExit(f"onbekende casting time {f['casting_time']}: {f['name']}")
    if f["casting_time"] == "reaction":
        if not f.get("reaction_condition"):
            raise SystemExit(f"reaction zonder trigger: {f['name']}")
        ct += ", " + f["reaction_condition"].strip()
    comp = ", ".join(k for k, on in (("V", f["verbal"]), ("S", f["somatic"]), ("M", f["material"])) if on)
    if f["material"] and f.get("material_specified"):
        comp += f" ({f['material_specified'].strip().rstrip('.')})"
    dur = f["duration"].strip()
    dur = dur[:1].upper() + dur[1:]
    if f["concentration"]:
        dur = "Concentration, up to " + dur[:1].lower() + dur[1:]
    e = {"n": f["name"], "lv": f["level"], "sch": f["school"].capitalize(), "t": ct, "r": f["range_text"],
         "c": comp, "d": dur, "x": blocks(f["desc"])}
    if f["concentration"]: e["conc"] = 1
    if f["ritual"]: e["rit"] = 1
    if (f.get("higher_level") or "").strip(): e["h"] = blocks(f["higher_level"])
    out.append(e)

doc = {"ed": "2024", "src": "System Reference Document 5.2 (2024), Wizards of the Coast, CC-BY-4.0, via Open5e", "spells": out}
with open(sys.argv[2], "w", encoding="utf-8") as fh:
    json.dump(doc, fh, ensure_ascii=False, separators=(",", ":"))
print(len(out), "spells")
