#!/usr/bin/env python3
"""Build a deceased-only data.json for the public family tree page.

Reads a private spreadsheet (People tab) and writes only people whose death
is confirmed. Living people, and anyone whose status is unclear, are omitted
here — not in the browser. Parent and partner links are kept only when both
people are included. Sibling links between included people are derived from
shared parents in the spreadsheet, even when those parents are not included.

Usage:
  python3 generate.py /path/to/spreadsheet.xlsx
  python3 generate.py /path/to/spreadsheet.xlsx -o /path/to/data.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit("This script needs openpyxl. Install it with: pip install openpyxl")


UNCERTAIN_MARKERS = (
    "possible",
    "unconfirmed",
    "lead only",
    "not confirmed",
    "not yet confirmed",
    "maybe",
    "perhaps",
    "unverified",
)

# First names that also belong to included or unclear historical people must
# not be blanked as whole words, or we would damage their records.
PROTECTED_NAME_STOP = {
    "william",
    "anthony",
    "tony",
    "michael",
    "john",
    "mick",
    "james",
    "phyllis",
    "phillis",
    "philomena",
    "phillimena",
    "robert",
    "ellen",
    "mary",
    "ann",
    "edward",
    "eddie",
    "billy",
    "george",
    "esther",
    "margaret",
    "pearly",
    "thomas",
    "catherine",
    "kelly",
    "connor",
    "o'connor",
    "oconnor",
    "donaghy",
    "magill",
    "mcconell",
    "mcconell",
    "wilson",
    "jeremiah",
    "bill",
    "sadie",
    "sarah",
    "nevin",
    "burke",
    "cooke",
    "devaney",
}

PLACEHOLDER_RE = re.compile(r"^\(?\s*name unknown\s*\)?$", re.I)


def cell_str(value) -> str:
    if value is None:
        return ""
    return str(value).strip()


def load_people(xlsx_path: Path) -> list[dict]:
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    if "People" not in wb.sheetnames:
        sys.exit("The spreadsheet has no People tab.")
    ws = wb["People"]
    headers = [cell_str(ws.cell(1, c).value) for c in range(1, ws.max_column + 1)]
    if "ID" not in headers or "Status" not in headers:
        sys.exit("The People tab is missing ID or Status columns.")
    people = []
    for r in range(2, ws.max_row + 1):
        row = {headers[c - 1]: ws.cell(r, c).value for c in range(1, ws.max_column + 1)}
        if not cell_str(row.get("ID")):
            continue
        people.append(row)
    return people


def is_uncertain(text: str) -> bool:
    lowered = text.lower()
    return any(marker in lowered for marker in UNCERTAIN_MARKERS)


def is_confirmed_deceased(row: dict) -> bool:
    status = cell_str(row.get("Status")).lower()
    if status == "living":
        return False
    if status == "deceased":
        return True
    death = cell_str(row.get("Death date"))
    if death and not is_uncertain(death):
        return True
    return False


def first_year(text: str) -> str | None:
    match = re.search(r"\b(1[7-9]\d{2}|20\d{2})\b", text or "")
    return match.group(1) if match else None


def parse_known_as(first: str) -> tuple[str, str | None]:
    """Return (legal first names, known-as name)."""
    match = re.search(r"^(.*?)\s*\(([^)]+)\)\s*$", first.strip())
    if not match:
        return first.strip(), None
    legal = match.group(1).strip()
    inner = match.group(2).strip()
    # "Phillis / Philomena" are spelling variants, not a short name.
    if "/" in inner:
        return first.strip(), None
    if re.search(r"\d", inner):
        return first.strip(), None
    if len(inner.split()) > 2:
        return first.strip(), None
    return legal, inner


def display_name(first: str, surname: str, maiden: str) -> tuple[str, str, str | None]:
    legal_first, known_as = parse_known_as(first)
    surname = surname.strip()
    if known_as:
        short = f"{known_as} {surname}".strip()
        full = f"{legal_first} {surname}".strip()
    else:
        # Drop variant spellings in parentheses from the short label.
        short_first = re.sub(r"\s*\([^)]*\)\s*", " ", first).strip()
        short = f"{short_first} {surname}".strip()
        full = short
        if re.search(r"\([^)]*\)", first):
            full = f"{first} {surname}".strip()
    maiden_clean = maiden.strip() or None
    return short, full, maiden_clean


def years_label(row: dict) -> str:
    birth_text = " ".join(
        part
        for part in (
            cell_str(row.get("Birth date")),
            cell_str(row.get("Birth year")),
        )
        if part
    )
    death_text = cell_str(row.get("Death date"))
    by = first_year(birth_text)
    dy = first_year(death_text)
    approx = bool(re.search(r"\b(c\.|approx|about)\b", birth_text, re.I))
    if by and dy:
        return f"{'c. ' if approx else ''}{by}–{dy}"
    if by:
        return f"{'b. c. ' if approx else 'b. '}{by}"
    if dy:
        return f"d. {dy}"
    return ""


def branch_side(branch: str) -> str:
    lowered = branch.lower()
    if "devaney" in lowered:
        return "d"
    if "cooke" in lowered or "donaghy" in lowered:
        return "c"
    if "borrett" in lowered:
        return "b"
    if branch:
        return "i"
    return "i"


def confidence(verified: str) -> str:
    value = verified.strip().lower()
    if value == "yes":
        return "confirmed"
    if value == "partly":
        return "probable"
    return "lead"


def name_tokens(text: str) -> list[str]:
    text = re.sub(r"[?()]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if not text or PLACEHOLDER_RE.match(text):
        return []
    return [part for part in re.split(r"\s+", text) if part and part != "/"]


def living_terms(people: list[dict]) -> list[str]:
    """Unique living-person name phrases, longest first, for redaction."""
    protected_firsts = set(PROTECTED_NAME_STOP)
    for row in people:
        if is_confirmed_deceased(row):
            continue
        status = cell_str(row.get("Status")).lower()
        # Unclear historical people: protect their names from redaction.
        if status != "living":
            for field in (
                "First name(s)",
                "Surname",
                "Birth surname (if different)",
            ):
                for token in name_tokens(cell_str(row.get(field))):
                    cleaned = re.sub(r"[^A-Za-z']", "", token).lower()
                    if cleaned:
                        protected_firsts.add(cleaned)

    phrases: set[str] = set()
    unique_firsts: set[str] = set()
    for row in people:
        if cell_str(row.get("Status")).lower() != "living":
            continue
        first = cell_str(row.get("First name(s)"))
        surname = cell_str(row.get("Surname"))
        maiden = cell_str(row.get("Birth surname (if different)"))
        if PLACEHOLDER_RE.match(first) or not first:
            continue
        first_clean = re.sub(r"\s*\(\?\)\s*", " ", first).strip()
        first_clean = re.sub(r"\s+", " ", first_clean)
        legal, known_as = parse_known_as(first_clean)
        variants = [first_clean, legal]
        if known_as:
            variants.append(known_as)
        # Initials form: "First Middle" -> "First M." / "First M"
        parts = legal.split()
        if len(parts) >= 2 and all(len(p) > 1 for p in parts[1:]):
            initialled = parts[0] + " " + " ".join(p[0] + "." for p in parts[1:])
            variants.append(initialled)
            variants.append(initialled.replace(".", ""))

        surnames = [s for s in (surname, maiden) if s]
        first_token = legal.split()[0] if legal else ""
        if first_token:
            variants.append(first_token)
        for given in variants:
            given = given.strip()
            if not given:
                continue
            for sur in surnames:
                phrases.add(f"{given} {sur}")
            # Bare given names are only listed when no token is a historical name.
            tokens = [re.sub(r"[^A-Za-z']", "", tok).lower() for tok in given.split()]
            if given.lower() not in protected_firsts and all(
                (not tok or tok not in protected_firsts) for tok in tokens
            ):
                phrases.add(given)

        for token in name_tokens(first_clean) + ([known_as] if known_as else []):
            cleaned = re.sub(r"[^A-Za-z']", "", token or "").lower()
            if cleaned and cleaned not in protected_firsts and len(cleaned) > 2:
                unique_firsts.add(token.strip())

    # Prefer longer phrases so full names are removed before a bare first name.
    all_terms = {p for p in phrases if len(p) > 2}
    all_terms.update(unique_firsts)
    return sorted(all_terms, key=lambda s: (-len(s), s.lower()))


def _phrase_cleanup(text: str, terms: list[str]) -> str:
    """Remove attributions that name living people, using terms from the sheet."""
    out = text
    # Longest names first so a full name is removed before a first name.
    names = [term for term in terms if term]
    for name in names:
        esc = re.escape(name)
        out = re.sub(
            rf"this matches {esc}'?s date exactly",
            "this matches the family date exactly",
            out,
            flags=re.I,
        )
        out = re.sub(
            rf"matches {esc}'?s date exactly",
            "matches the family date exactly",
            out,
            flags=re.I,
        )
        out = re.sub(
            rf"Family-confirmed by {esc}(?:\s*\([^)]*\))?",
            "Family-confirmed",
            out,
            flags=re.I,
        )
        out = re.sub(rf"FAMILY-CONFIRMED\s*\({esc}[^)]*\)\s*:?", "Family-confirmed", out, flags=re.I)
        out = re.sub(rf"ask {esc}[^.]*(?:\.|$)", "", out, flags=re.I)
        out = re.sub(rf"{esc} said ", "", out, flags=re.I)
        out = re.sub(rf"{esc} unsure of her name,\s*", "", out, flags=re.I)
        out = re.sub(rf"\+\s*{esc}\s*\([^)]*\)", "", out, flags=re.I)
        out = re.sub(rf"{esc}\s*\([^)]*\)\s*(?:\+)?", "", out, flags=re.I)
        # "(Name, 14 Nov 2026, ...)" — keep any remaining date text.
        out = re.sub(
            rf"\(\s*{esc}(?:,\s*)?([^)]*)\)",
            lambda m: f"({m.group(1).strip()})" if m.group(1).strip() else "",
            out,
            flags=re.I,
        )
        out = re.sub(rf"\bvia {esc}\b", "", out, flags=re.I)
        out = re.sub(rf"\bby {esc}\b", "", out, flags=re.I)
    # "Name via Name" (both living) and leftover empty via clauses.
    out = re.sub(r"\bvia\s+,", ",", out)
    out = re.sub(r"Had a son,[^.]*ex-wife[^.]*\.", "", out, flags=re.I)
    out = re.sub(r"Maiden name also matches[^.]+\.", "", out, flags=re.I)
    out = re.sub(r",?\s*WhatsApp", "", out, flags=re.I)
    return out


def _tidy(text: str) -> str:
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" ?\n ?", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"\bshe typed\b", "a relative typed", text, flags=re.I)
    text = re.sub(r"\( +", "(", text)
    text = re.sub(r" +\)", ")", text)
    text = re.sub(r"\(\s*[,;:./]*\s*\)", "", text)
    text = re.sub(r"\band\s*\)", ")", text)
    text = re.sub(r"[,;]\s*\)", ")", text)
    text = re.sub(r"\(\s*;", "(", text)
    text = re.sub(r"\(\s*,", "(", text)
    text = re.sub(r";\s*;", ";", text)
    text = re.sub(r",\s*,", ",", text)
    text = re.sub(r" +;", ";", text)
    text = re.sub(r"\s+\.", ".", text)
    text = re.sub(r"^\s*[.,;:+]+\s*", "", text)
    text = re.sub(r"\s{2,}", " ", text)
    text = re.sub(r"\(\s+", "(", text)
    text = re.sub(r"\s+:", ":", text)
    text = re.sub(r"\(FreeBMD index;[^)]*\)", "(FreeBMD index)", text)
    text = re.sub(r"Family-confirmed (?=[A-Z])", "Family-confirmed: ", text)
    text = re.sub(r"; Family-confirmed", ". Family-confirmed", text)
    # Capitalise the start of a sentence after we have removed a name.
    text = re.sub(r"(^|[.!?]\s+)([a-z])", lambda m: m.group(1) + m.group(2).upper(), text)
    text = re.sub(r"\s+\)", ")", text)
    text = re.sub(r"\bIrishgenealogy\.ie\b", "irishgenealogy.ie", text)
    return text.strip(" \t,;+/")


def sanitize(text: str, terms: list[str]) -> str:
    if not text:
        return ""
    out = _phrase_cleanup(text, terms)
    for term in terms:
        out = re.sub(rf"\b{re.escape(term)}\b", " ", out, flags=re.I)
    return _tidy(out)


def parse_sources(text: str, terms: list[str]) -> list[dict]:
    sources = []
    if not text:
        return sources
    # Split on newlines or on a URL followed by a new label.
    raw = cell_str(text)
    chunks = re.split(r"\n+", raw)
    for chunk in chunks:
        chunk = chunk.strip()
        if not chunk:
            continue
        match = re.search(r"(https?://\S+)", chunk)
        if match:
            url = match.group(1).rstrip(").,;")
            # Drop the source if the URL itself contains a living person's name.
            url_l = url.lower()
            if any(term.lower() in url_l for term in terms if " " not in term and len(term) > 3):
                # Only skip when a distinctive living first name is in the URL path.
                # Domain-generic words are ignored by the unique-term list.
                if _url_has_living_name(url, terms):
                    continue
            label = _tidy(sanitize(chunk[: match.start()], terms) or chunk[: match.start()])
            label = label.rstrip(":").strip()
            if not label:
                label = "Source"
            sources.append({"label": label, "url": url})
        else:
            label = sanitize(chunk, terms)
            if label:
                sources.append({"label": label, "url": ""})
    return sources


def _url_has_living_name(url: str, terms: list[str]) -> bool:
    hay = url.lower()
    for term in terms:
        token = term.lower().strip()
        if " " in token or len(token) < 4:
            continue
        if re.search(rf"[^a-z]{re.escape(token)}[^a-z]", f"/{hay}/"):
            return True
    return False


def birth_text(row: dict, terms: list[str]) -> str:
    birth_date = sanitize(cell_str(row.get("Birth date")), terms)
    birth_year = sanitize(cell_str(row.get("Birth year")), terms)
    if birth_date and birth_year:
        year_token = first_year(birth_year) or birth_year
        if year_token and year_token in birth_date:
            return birth_date
        if birth_year in birth_date:
            return birth_date
    return birth_date or birth_year


def birth_place(row: dict, terms: list[str]) -> str:
    parts = []
    hospital = sanitize(cell_str(row.get("Hospital of birth")), terms)
    town = sanitize(cell_str(row.get("Town / country of birth")), terms)
    if hospital:
        parts.append(hospital)
    if town:
        parts.append(town)
    return ". ".join(parts)


def record_rows(person: dict) -> list[dict]:
    """Turn source links into records-table rows."""
    rows = []
    for src in person.get("sources") or []:
        label = src.get("label") or "Source"
        url = src.get("url") or ""
        kind = "Record"
        low = label.lower()
        if "birth" in low:
            kind = "Birth"
        elif "death" in low:
            kind = "Death"
        elif "marriage" in low or "married" in low:
            kind = "Marriage"
        elif "probate" in low:
            kind = "Probate"
        elif "census" in low:
            kind = "Census"
        # Pull a trailing reference token such as 5c/869 or a GRO number.
        ref = ""
        ref_match = re.search(
            r"(\d+[a-z]?/\d+|\bGRO\s*\d+|\b\d{6,}\b|cibi-[0-9]+|cima-[0-9]+|cide-[0-9]+)",
            label,
            re.I,
        )
        if ref_match:
            ref = ref_match.group(1)
        rows.append(
            {
                "type": kind,
                "who": person["fullName"],
                "detail": label,
                "reference": ref,
                "confidence": person["conf"],
                "url": url,
            }
        )
    return rows


def living_names_for_check(people: list[dict], terms: list[str]) -> list[str]:
    """Distinctive living names that must not appear in published output."""
    names = []
    for term in terms:
        token = term.strip()
        if len(token) <= 2:
            continue
        # Skip protected / shared historical names (already excluded from unique firsts,
        # but full phrases like "John Smith" should still be checked).
        if token.lower() in PROTECTED_NAME_STOP:
            continue
        names.append(token)
    # Dedup case-insensitively, keep longer first.
    seen = set()
    out = []
    for name in sorted(set(names), key=lambda s: (-len(s), s.lower())):
        key = name.lower()
        if key not in seen:
            seen.add(key)
            out.append(name)
    return out


def find_leaks(blob: str, names: list[str]) -> list[str]:
    hits = []
    for name in names:
        if re.search(rf"\b{re.escape(name)}\b", blob, flags=re.I):
            hits.append(name)
    return hits


def build(xlsx_path: Path) -> tuple[dict, dict]:
    people = load_people(xlsx_path)
    rel_key = next(
        (key for key in (people[0].keys() if people else []) if key.lower().startswith("relationship")),
        "",
    )
    terms = living_terms(people)

    published, excluded_living, excluded_unclear = [], [], []
    for row in people:
        status = cell_str(row.get("Status")).lower()
        pid = cell_str(row.get("ID"))
        first = cell_str(row.get("First name(s)"))
        surname = cell_str(row.get("Surname"))
        label = f"{pid} {first} {surname}".strip()
        if is_confirmed_deceased(row):
            published.append(row)
        elif status == "living":
            excluded_living.append(label)
        else:
            excluded_unclear.append(label)

    included_ids = {cell_str(r.get("ID")) for r in published}

    # Siblings among included people, derived from shared parents in the full sheet.
    children_of: dict[tuple[str, str], list[str]] = defaultdict(list)
    id_to_parents: dict[str, tuple[str, str]] = {}
    for row in people:
        pid = cell_str(row.get("ID"))
        father = cell_str(row.get("Father ID"))
        mother = cell_str(row.get("Mother ID"))
        id_to_parents[pid] = (father, mother)
        if father or mother:
            children_of[(father, mother)].append(pid)
            # Also group on a single shared parent when the other is blank.
            if father:
                children_of[(father, "*")].append(pid)
            if mother:
                children_of[("*", mother)].append(pid)

    siblings_of: dict[str, list[str]] = defaultdict(list)
    for row in published:
        pid = cell_str(row.get("ID"))
        father, mother = id_to_parents.get(pid, ("", ""))
        related = set()
        if father and mother:
            related.update(children_of.get((father, mother), []))
        if father:
            related.update(children_of.get((father, "*"), []))
        if mother:
            related.update(children_of.get(("*", mother), []))
        sibs = sorted(
            sid for sid in related if sid != pid and sid in included_ids
        )
        siblings_of[pid] = sibs

    children_of_included: dict[str, list[str]] = defaultdict(list)
    for row in published:
        pid = cell_str(row.get("ID"))
        father, mother = id_to_parents.get(pid, ("", ""))
        if father in included_ids:
            children_of_included[father].append(pid)
        if mother in included_ids:
            children_of_included[mother].append(pid)

    out_people = []
    for row in published:
        pid = cell_str(row.get("ID"))
        first = cell_str(row.get("First name(s)"))
        surname = cell_str(row.get("Surname"))
        maiden = cell_str(row.get("Birth surname (if different)"))
        short, full, maiden_clean = display_name(first, surname, maiden)
        father = cell_str(row.get("Father ID"))
        mother = cell_str(row.get("Mother ID"))
        partner = cell_str(row.get("Partner ID"))
        person = {
            "id": pid,
            "name": short,
            "fullName": full,
            "maiden": maiden_clean,
            "years": years_label(row),
            "rel": sanitize(cell_str(row.get(rel_key)), terms),
            "side": branch_side(cell_str(row.get("Branch"))),
            "conf": confidence(cell_str(row.get("Verified?"))),
            "birth": birth_text(row, terms),
            "birthPlace": birth_place(row, terms),
            "marriage": sanitize(cell_str(row.get("Marriage details")), terms),
            "death": sanitize(cell_str(row.get("Death date")), terms),
            "note": sanitize(cell_str(row.get("Notes / gaps")), terms),
            "sources": parse_sources(cell_str(row.get("Source link")), terms),
            "father": father if father in included_ids else None,
            "mother": mother if mother in included_ids else None,
            "partner": partner if partner in included_ids else None,
            "siblings": siblings_of.get(pid, []),
            "children": children_of_included.get(pid, []),
        }
        # Drop empty optional strings
        for key in ("maiden", "years", "rel", "birth", "birthPlace", "marriage", "death", "note"):
            if not person[key]:
                person[key] = ""
        out_people.append(person)

    # Stable order: oldest first, then name.
    def sort_key(p: dict) -> tuple:
        year = first_year(p.get("years") or p.get("birth") or "") or "9999"
        return (year, p["name"])

    out_people.sort(key=sort_key)

    records = []
    for person in out_people:
        records.extend(record_rows(person))

    data = {
        "generated": date.today().isoformat(),
        "people": out_people,
        "records": records,
    }

    stats = {
        "published": out_people,
        "excluded_living": excluded_living,
        "excluded_unclear": excluded_unclear,
        "terms": living_names_for_check(people, terms),
    }
    return data, stats


def main() -> int:
    parser = argparse.ArgumentParser(description="Build deceased-only data.json")
    parser.add_argument("xlsx", type=Path, help="Path to the family spreadsheet")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="Where to write data.json (default: data.json next to this script)",
    )
    args = parser.parse_args()
    xlsx = args.xlsx.expanduser().resolve()
    if not xlsx.is_file():
        sys.exit(f"Spreadsheet not found: {xlsx}")
    output = (args.output or (Path(__file__).resolve().parent / "data.json")).resolve()

    data, stats = build(xlsx)
    blob = json.dumps(data, ensure_ascii=False, indent=2) + "\n"

    leaks = find_leaks(blob, stats["terms"])
    if leaks:
        sys.stderr.write(
            "Refusing to write data.json: living names still present: "
            + ", ".join(leaks)
            + "\n"
        )
        return 1

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(blob, encoding="utf-8")

    print(f"Wrote {output}")
    print(f"Published ({len(stats['published'])}):")
    for person in stats["published"]:
        print(f"  {person['id']}  {person['fullName']}  {person['years']}  [{person['conf']}]")
    print(f"Excluded as living: {len(stats['excluded_living'])}")
    print(f"Excluded as unclear: {len(stats['excluded_unclear'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
