"""School names for the MLH export (src/organizer/mlhSchools.json).

Usage: python3 scripts/mlh-school-names.py [path/to/schools.csv]

MLH asks Member Events for schools from its list of verified schools
(https://github.com/MLH/mlh-policies/blob/main/schools.csv; downloaded when no
path is given). For each school on the hacker form's list
(src/staff-portal/schools.json) that MLH spells differently, this writes our
name -> MLH's name, matching when the two are the same ignoring case, accents,
punctuation, "&" vs "and" and a leading "The". MLH's spelling is copied as it
is, quirks included. It also writes the nickname targets
(src/staff-portal/schoolSearch.ts NICKNAMES) that MLH spells the same, so a typed
"MIT" or "UCSD" exports as MLH's name. Schools MLH spells in more than one way
are left out.
"""
import csv
import io
import json
import re
import sys
import unicodedata
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MLH_CSV = "https://raw.githubusercontent.com/MLH/mlh-policies/main/schools.csv"


def key(name):
    text = unicodedata.normalize("NFD", name.lower())
    text = "".join(c for c in text if not unicodedata.combining(c)).replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", " ", text).strip()
    return re.sub(r"^the ", "", text)


def main():
    if len(sys.argv) > 1:
        raw = Path(sys.argv[1]).read_text(encoding="utf-8")
    else:
        raw = urllib.request.urlopen(MLH_CSV).read().decode("utf-8")
    rows = list(csv.reader(io.StringIO(raw)))[1:]  # the first row is MLH's note
    mlh = list(dict.fromkeys(r[0].strip() for r in rows if r and r[0].strip()))
    by_key = {}
    for name in mlh:
        by_key.setdefault(key(name), []).append(name)

    ours = json.loads((ROOT / "src/staff-portal/schools.json").read_text(encoding="utf-8"))
    search = (ROOT / "src/staff-portal/schoolSearch.ts").read_text(encoding="utf-8")
    nicknames = search[search.index("export const NICKNAMES"):]
    nicknames = nicknames[: nicknames.index("};")]
    targets = set(re.findall(r'"([^"]+)"', nicknames.split("=", 1)[1]))

    exact = set(mlh)
    out, skipped = {}, []
    for name in ours:
        if name in exact:
            if name in targets:
                out[name] = name
            continue
        found = by_key.get(key(name), [])
        # Several spellings that differ only in case: take one that isn't all lower case.
        found = list(dict.fromkeys([f for f in found if f != f.lower()] or found))
        if len(found) > 1:
            skipped.append(name)
        elif found:
            out[name] = found[0]

    path = ROOT / "src/organizer/mlhSchools.json"
    path.write_text(json.dumps(dict(sorted(out.items())), ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    print(f"{len(out)} schools ({sum(k != v for k, v in out.items())} renamed) -> {path.relative_to(ROOT)}")
    if skipped:
        print("MLH spells these more than one way, left out:", ", ".join(skipped))


if __name__ == "__main__":
    main()
