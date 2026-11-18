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


# Family testimony of 15 Nov 2026. For each root, treat as confirmed deceased:
# the person, their siblings, every ancestor, and those ancestors' siblings.
# Do not infer anyone outside these lines.
# P058 and P059 are the two roots on the maternal side (both grandparents).
# PATERNAL_NEWER_ANCHOR is a later generation: only that person's parents and
# older (including those ancestors' siblings) are added, not the anchor's
# own siblings or anyone in the same generation.
CONFIRMED_LINE_ROOTS = ("P058", "P059")
PATERNAL_NEWER_ANCHOR = "P002"

# People already on the public tree. Regeneration may update their details,
# but must not add anyone else without an explicit change to this set.
PUBLIC_TREE_IDS = frozenset({
    "P002", "P020", "P056", "P057", "P058", "P059",
    "P087", "P088", "P089", "P090", "P091", "P092", "P093", "P094", "P095", "P096",
    "P097", "P098", "P100", "P101", "P102", "P103", "P104", "P105", "P106", "P107",
    "P108", "P109", "P110", "P111", "P112", "P113", "P114", "P115",
})


def is_confirmed_deceased(row: dict) -> bool:
    """Sheet-only rule: explicit deceased status, or a death date/year that is not uncertain."""
    status = cell_str(row.get("Status")).lower()
    if status == "living":
        return False
    if status == "deceased":
        return True
    death = cell_str(row.get("Death date"))
    if death and not is_uncertain(death):
        return True
    return False


def _parent_child_indexes(people: list[dict]):
    known = {cell_str(row.get("ID")) for row in people}
    parents: dict[str, tuple[str, str]] = {}
    children: dict[str, list[str]] = defaultdict(list)
    for row in people:
        pid = cell_str(row.get("ID"))
        father = cell_str(row.get("Father ID"))
        mother = cell_str(row.get("Mother ID"))
        parents[pid] = (father, mother)
        if father:
            children[father].append(pid)
        if mother:
            children[mother].append(pid)
    return known, parents, children


def _siblings_of(pid: str, parents: dict, children: dict) -> set[str]:
    father, mother = parents.get(pid, ("", ""))
    sibs: set[str] = set()
    if father:
        sibs.update(children.get(father, []))
    if mother:
        sibs.update(children.get(mother, []))
    sibs.discard(pid)
    return sibs


def _ancestors_of(pid: str, parents: dict, known: set[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    stack = [item for item in parents.get(pid, ("", "")) if item]
    while stack:
        current = stack.pop()
        if not current or current in seen or current not in known:
            continue
        seen.add(current)
        out.append(current)
        father, mother = parents.get(current, ("", ""))
        if father:
            stack.append(father)
        if mother:
            stack.append(mother)
    return out


def _line_from_root(root: str, parents: dict, children: dict, known: set[str]) -> set[str]:
    ids: set[str] = set()
    if root not in known:
        return ids
    ids.add(root)
    ids.update(_siblings_of(root, parents, children))
    ancestors = _ancestors_of(root, parents, known)
    ids.update(ancestors)
    for ancestor in ancestors:
        ids.update(_siblings_of(ancestor, parents, children))
    return ids


def testimony_confirmed_ids(people: list[dict]) -> tuple[set[str], list[str]]:
    """IDs to treat as deceased from family testimony, plus any Living conflicts.

    Conflicts (explicitly Living, so not published) are returned as IDs only.
    """
    by_id = {cell_str(row.get("ID")): row for row in people}
    known, parents, children = _parent_child_indexes(people)
    ids: set[str] = set()
    for root in CONFIRMED_LINE_ROOTS:
        ids |= _line_from_root(root, parents, children, known)
    father, mother = parents.get(PATERNAL_NEWER_ANCHOR, ("", ""))
    for root in (father, mother):
        if root:
            ids |= _line_from_root(root, parents, children, known)

    confirmed: set[str] = set()
    conflicts: list[str] = []
    for pid in sorted(ids, key=lambda value: int(value[1:]) if value[1:].isdigit() else value):
        row = by_id.get(pid)
        if not row:
            continue
        if cell_str(row.get("Status")).lower() == "living":
            conflicts.append(pid)
        else:
            confirmed.add(pid)
    return confirmed, conflicts


def is_publishable(row: dict, testimony_ids: set[str]) -> bool:
    if cell_str(row.get("Status")).lower() == "living":
        return False
    pid = cell_str(row.get("ID"))
    if pid not in PUBLIC_TREE_IDS:
        return False
    if is_confirmed_deceased(row):
        return True
    return pid in testimony_ids


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
    first_clean = first.strip()
    if PLACEHOLDER_RE.match(first_clean) or PLACEHOLDER_RE.match(first_clean.strip("()").strip()):
        label = "Name not yet known"
        if surname.strip():
            return label, f"{surname.strip()} ({label.lower()})", None
        return label, label, None
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
    after = bool(re.search(r"\bafter\b", birth_text, re.I))
    if after and by and not dy:
        return f"after {by}"
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
                given_tok = re.sub(r"[^A-Za-z']", "", (given.split()[0] if given else "")).lower()
                # Skip a living first-name + family-surname phrase when both
                # also belong to historical people (keeps period source leads).
                if given_tok in protected_firsts and sur.lower() in protected_firsts:
                    continue
                phrases.add(f"{given} {sur}")
            # Multi-word givens are always listed (for example a first name
            # plus an initial). Bare given names are listed only when no token
            # is also a historical name.
            tokens = [re.sub(r"[^A-Za-z']", "", tok).lower() for tok in given.split()]
            if " " in given:
                phrases.add(given)
            elif given.lower() not in protected_firsts and all(
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


# Filled during build() so "X's 1949 birth" clauses can be removed even when
# the first name is also used by a historical person. Not a publish list.
_BIRTH_CLAUSE_FIRSTS: list[str] = []
_LIVING_SURNAMES: set[str] = set()

_SAINT_PLACE_RE = re.compile(r"\bSt\.?\s+[A-Za-z]+(?:'s)?\b")


def _stash_saint_places(text: str) -> tuple[str, dict[str, str]]:
    held: dict[str, str] = {}

    def stash(match: re.Match) -> str:
        key = f"[[PLACE{len(held)}]]"
        held[key] = match.group(0)
        return key

    return _SAINT_PLACE_RE.sub(stash, text), held


def _restore_saint_places(text: str, held: dict[str, str]) -> str:
    for key, value in held.items():
        text = text.replace(key, value)
    return text


def _set_birth_clause_firsts(people: list[dict]) -> None:
    names: set[str] = set()
    for row in people:
        if cell_str(row.get("Status")).lower() != "living":
            continue
        first = cell_str(row.get("First name(s)"))
        first = re.sub(r"\s*\(\?\)\s*", " ", first).strip()
        if not first or PLACEHOLDER_RE.match(first):
            continue
        legal, _known = parse_known_as(first)
        token = legal.split()[0] if legal else ""
        token = re.sub(r"[^A-Za-z']", "", token)
        if len(token) > 2:
            names.add(token)
    global _BIRTH_CLAUSE_FIRSTS
    _BIRTH_CLAUSE_FIRSTS = sorted(names, key=lambda value: (-len(value), value.lower()))


def _set_living_surnames(people: list[dict]) -> None:
    surnames: set[str] = set()
    for row in people:
        if cell_str(row.get("Status")).lower() != "living":
            continue
        for key in ("Surname", "Birth surname (if different)"):
            value = re.sub(r"[^A-Za-z']", "", cell_str(row.get(key)))
            if len(value) > 2:
                surnames.add(value.lower())
    global _LIVING_SURNAMES
    _LIVING_SURNAMES = surnames


def _follows_historical_surname(match: re.Match) -> bool:
    """True when a bare first name is followed by a historical (not living) surname."""
    after = match.string[match.end():]
    followed = re.match(r"\s+([A-Z][A-Za-z']+)", after)
    if not followed:
        return False
    return followed.group(1).lower() not in _LIVING_SURNAMES


def _replace_living_term(text: str, term: str) -> str:
    pattern = re.compile(rf"\b{re.escape(term)}\b", re.I)
    if " " in term or not _LIVING_SURNAMES:
        return pattern.sub(" ", text)

    def repl(match: re.Match) -> str:
        return match.group(0) if _follows_historical_surname(match) else " "

    return pattern.sub(repl, text)


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
    for name in _BIRTH_CLAUSE_FIRSTS:
        esc = re.escape(name)
        out = re.sub(rf"and {esc}'s births?", "", out, flags=re.I)
        out = re.sub(rf"{esc}'s \d{{4}} birth", "", out, flags=re.I)
    out = re.sub(r"Mentioned\s*,\s*", "Mentioned ", out, flags=re.I)
    out = re.sub(r",\s*courtesy of\.?", "", out, flags=re.I)
    out = re.sub(r"courtesy of\.?", "", out, flags=re.I)
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
    # Do not treat "c." (circa) as a sentence start.
    def _cap(match: re.Match) -> str:
        if match.group(2) == "c" and match.string[match.end():].startswith("."):
            return match.group(0)
        return match.group(1) + match.group(2).upper()
    text = re.sub(r"(^|[.!?]\s+)([a-z])", _cap, text)
    text = re.sub(r"\s+\)", ")", text)
    text = re.sub(r"\bIrishgenealogy\.ie\b", "irishgenealogy.ie", text)
    text = re.sub(r"and\s+'s\s+\d{4} birth", "", text)
    text = re.sub(r"\s+'s\s+\d{4} birth", "", text)
    text = re.sub(r"fits (\w+'s)\s*,", r"fits \1 birth,", text, flags=re.I)
    text = re.sub(r"\s+or [A-Z][A-Za-z]+/\s*\.", ".", text)
    text = re.sub(r": believes ", ": a relative believes ", text, flags=re.I)
    text = re.sub(r"\bBelieves ", "A relative believes ", text)
    text = re.sub(r"\s+\.", ".", text)
    text = re.sub(r"\s{2,}", " ", text)
    return text.strip(" \t,;+/")


def sanitize(text: str, terms: list[str]) -> str:
    if not text:
        return ""
    out, saint_places = _stash_saint_places(text)
    out = _phrase_cleanup(out, terms)
    for term in terms:
        out = _replace_living_term(out, term)
    out = _tidy(out)
    return _restore_saint_places(out, saint_places)


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
    return [src for src in sources if _keep_source(src)]


# Research-only links (candidate lists, people not on the public tree).
_DROP_SOURCE = re.compile(
    r"lead only|not on the tree|not added|competing lead|possible sibling|"
    r"as a lead|"
    r"probable (?:daughter|son) (?:Mary, 1886|Josephine|Martin, 8 Nov 1902|James, 25 May 1906)",
    re.I,
)


def _keep_source(src: dict) -> bool:
    label = (src.get("label") or "").strip()
    # A bare "Source" label is a leftover after a research-lead heading
    # was removed; do not publish an unexplained link.
    if not label or label.lower() == "source":
        return False
    return not _DROP_SOURCE.search(label)


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



# Card notes, rewritten for a family reader. These replace the raw research
# text from the spreadsheet so regeneration stays consistent. Only facts from
# the source are kept; research housekeeping and unconfirmed candidate lists
# are dropped. Review this map if the spreadsheet notes change substantially.
FAMILY_NOTES = {
    "P100": (
        "He married Mary Ann McConell on 29 October 1871 in Larne, and lived "
        "on Agnew's Lane. Their son Robert was born there on 19 October 1879, "
        "when William was recorded as a labourer. He died on 19 March 1903 on "
        "Main Street, Larne, aged 53, so he was born about 1850. He may also "
        "be the father named at Robert's probable 1906 marriage; the family "
        "has not yet confirmed that link."
    ),
    "P089": (
        "Family-confirmed as Phyllis's father. He was born on 19 October 1879 "
        "on Agnew's Lane, Larne, to William John and Mary Ann Donaghy. A civil "
        "record shows a Robert Donaghy, a labourer of Newtown, Carnlough, "
        "marrying Ellen Magill on 30 September 1906 at the Roman Catholic "
        "chapel in Carnlough. That match is probable but not yet confirmed by "
        "the family. Five later Larne births with those parents are treated as "
        "Phyllis's probable siblings. A family member has said Nan's mum's "
        "maiden name may have been Magill, and remembered talk of well-to-do "
        "Magill cousins in Belfast; that supports the identification but does "
        "not confirm it."
    ),
    "P090": (
        "Family-confirmed as Phyllis's mother. Her maiden name was Magill, "
        "also recorded as McGill. A civil birth for Ellen McGill on 4 October "
        "1880 in Carnlough names her parents as Thomas McGill, a carpenter, "
        "and Mary formerly Wilson, confirming the 1879 Glenarm marriage of "
        "Thomas Magill and Mary Wilson as her parents. A civil record shows "
        "Ellen Magill, of Newtown, Carnlough, marrying Robert Donaghy on 30 "
        "September 1906 at the Roman Catholic chapel in Carnlough; her father "
        "was Thomas Magill, a labourer. That marriage match is probable but "
        "not yet confirmed by the family. The 1906 record described her as a "
        "minor, which would imply a birth about 1886 to 1888, so it sits "
        "awkwardly with an 1880 birth (she would have been about 25). Five "
        "later Larne births with those parents are treated as Phyllis's "
        "probable siblings. A family member has said Nan's mum's maiden name "
        "may have been Magill, and remembered talk of well-to-do Magill "
        "cousins in Belfast; that supports the identification but does not "
        "confirm it."
    ),
    "P088": (
        "Family-confirmed from the 1926 Irish census, when she was 37. She was "
        "Mary Bridget Connor, also recorded as O'Connor, of Crossdrum, and "
        "married William Cooke on 17 March 1915 at the Roman Catholic chapel "
        "of Ballinacree, near Oldcastle in County Meath. She was 26; her "
        "father was John Connor, a labourer. She was born about 1888 or 1889. "
        "Her death, and her own birth record, have not yet been found."
    ),
    "P087": (
        "Family-confirmed from the 1926 Irish census, when he was 37. He "
        "married Mary Bridget Connor on 17 March 1915 at the Roman Catholic "
        "chapel of Ballinacree, near Oldcastle in County Meath. He was 26, a "
        "postman living in Castlerea; his father was Edward Cooke, a labourer. "
        "He died on 26 March 1947 at Church Road, Castlerea, aged 58, an "
        "ex-postman; his son Eddie was present. A probable civil birth in 1888 "
        "in the Roscommon district names his parents as Edward Cooke and Ellen "
        "Kelly."
    ),
    "P102": (
        "A probable brother of Phyllis: a Larne civil birth names the parents "
        "as Donaghy and Magill. The family has not yet confirmed the link."
    ),
    "P103": (
        "A probable sister of Phyllis: a Larne civil birth names the parents "
        "as Donaghy and Magill. The family has not yet confirmed the link."
    ),
    "P104": (
        "A probable brother of Phyllis: a Larne civil birth names the parents "
        "as Donaghy and Magill. The family has not yet confirmed the link."
    ),
    "P105": (
        "A probable sister of Phyllis: a Larne civil birth names the parents "
        "as Donaghy and Magill. The family has not yet confirmed the link."
    ),
    "P106": (
        "A probable sister of Phyllis: a Larne civil birth names the parents "
        "as Donaghy and Magill. The family has not yet confirmed the link."
    ),
    "P091": (
        "Brother of John James Cooke. Known as Eddie. Born in Castlerea, "
        "County Roscommon, and recorded as 10 on the 1926 Irish census. He was "
        "present when his father William died on 26 March 1947 at Church Road, "
        "Castlerea."
    ),
    "P092": (
        "Brother of John James Cooke. Known as Billy. Born in Castlerea, "
        "County Roscommon, and recorded as 9 on the 1926 Irish census."
    ),
    "P093": (
        "Brother of John James Cooke. Born in Castlerea, County Roscommon, and "
        "recorded as 4 on the 1926 Irish census."
    ),
    "P094": (
        "Sister of John James Cooke. Known as Pearly. Born on 17 April 1924 in "
        "Castlerea (the birth was registered as Ester) and recorded as 2 on "
        "the 1926 Irish census. She married Thomas Burke on 8 September 1941 "
        "at the Roman Catholic church in Castlerea. She was of St Kevin's "
        "Terrace; her father William Cooke was a postman."
    ),
    "P095": (
        "A younger sister of John, the first of two born after the 1926 "
        "census. Her name is not yet known."
    ),
    "P096": (
        "A younger sister of John, the second of two born after the 1926 "
        "census. Her name is not yet known."
    ),
    "P056": (
        "Family-confirmed as Bill, Tony's father. An index records a marriage "
        "to Sarah A Nevin in Bournemouth in July to September 1947, which fits "
        "Tony's birth (mother's maiden name Nevin). A possible, unconfirmed "
        "index match is William Joseph Devaney, born 22 March 1917, died 1983 "
        "in Hammersmith. A relative believes dad's family came from "
        "Strandhill, County Sligo."
    ),
    "P057": (
        "Family-confirmed as Sadie, Tony's mother (Sadie is a usual nickname "
        "for Sarah). An index records her marriage to William J Devaney in "
        "Bournemouth in July to September 1947; Nevin matches the mother's "
        "maiden name on Tony's 1957 birth. A possible, unconfirmed index "
        "match is Sarah Devaney, born 14 February 1917, died 1993 in "
        "Westminster. A relative believes dad's family came from Strandhill. "
        "A possible Irish birth on 11 February 1917 at Carrowmore, near "
        "Strandhill, has not been confirmed."
    ),
    "P058": (
        "Family-confirmed. Born on 14 January 1919 in Castlerea, County "
        "Roscommon; his mother's maiden surname was O'Connor. He was 7 on the "
        "1926 Irish census. His parents were William and Mary Cooke (née "
        "O'Connor). His siblings were Eddie, Billy, George, Pearly, and two "
        "younger sisters born after 1926. He died on 28 October 1976. He and "
        "Phyllis married on 14 October 1943; the place is not yet known, and "
        "may have been in Northern Ireland."
    ),
    "P059": (
        "Family-confirmed. Her birth certificate spells her name Phillis, and "
        "she insisted her name was Phillimena. Official records also use "
        "Philomena and Phyllis. Born on 7 July 1923, died on 15 August 2014; "
        "her death was registered in Hounslow. Her parents were Ellen and "
        "Robert Donaghy. She and John married on 14 October 1943; the place "
        "is not yet known and may have been in Northern Ireland. Her own "
        "birth was not found in Irish records, which fits a Northern Ireland "
        "birth. Her parents are a probable match for a 1906 Carnlough marriage "
        "of Robert Donaghy and Ellen Magill, not yet confirmed by the family."
    ),
    "P020": (
        "A brother of Tony. A birth index for Michael J Devaney, mother's "
        "maiden name recorded as Nevan (likely Nevin), in Hammersmith in late "
        "1954, fits the family. He died in January 2020; the death index names "
        "him Michael John Devaney, born 1954, registered in Kensington and "
        "Chelsea. The exact day is not yet known."
    ),
    "P002": (
        "Known as Tony. The death index gives William Anthony J Devaney, born "
        "1957. A birth index for William A Devaney, mother's maiden name "
        "Nevin, in Hammersmith in July to September 1957, fits the family. He "
        "died in July to September 2011, registered in Hounslow; the exact "
        "day is not yet known."
    ),
    "P097": (
        "A labourer. A probable marriage to Ellen Kelly took place on 27 "
        "February 1886 at Bissara, in the Athleague district of County "
        "Roscommon. His father was Edward Cooke, a miller. A probable 1888 "
        "birth of William Cooke names these parents, and he is also named as "
        "father on William's confirmed 1915 marriage."
    ),
    "P108": (
        "A miller. Named as father at the probable 27 February 1886 marriage "
        "of his son Edward Cooke, a labourer, to Ellen Kelly, at Bissara, in "
        "the Athleague district of County Roscommon. His wife's name is not "
        "yet known."
    ),
    "P107": (
        "Maiden name Kelly. A probable marriage to Edward Cooke, a labourer, "
        "took place on 27 February 1886 at Bissara, in the Athleague district "
        "of County Roscommon. Her father was James Kelly, a farmer. A "
        "probable 1888 Roscommon-district birth of William Cooke names her as "
        "the mother."
    ),
    "P109": (
        "A farmer. Named as father at the probable 27 February 1886 marriage "
        "of his daughter Ellen Kelly to Edward Cooke, at Bissara, in the "
        "Athleague district of County Roscommon. His wife's name is not yet "
        "known."
    ),
    "P112": (
        "A labourer. Named as father at the 29 October 1871 Larne marriage of "
        "his daughter Mary Ann McConell to William John Donaghy. His wife's "
        "name is not yet known."
    ),
    "P115": (
        "A farmer. Named as father at the 27 November 1879 Glenarm marriage "
        "of his daughter Mary Wilson to Thomas Magill. His wife's name is not "
        "yet known. That couple are confirmed as Ellen Magill's parents by "
        "Ellen's civil birth on 4 October 1880 in Carnlough."
    ),
    "P114": (
        "A tailor. Named as father at the 27 November 1879 Glenarm marriage "
        "of his son Thomas Magill to Mary Wilson. His wife's name is not yet "
        "known. That couple are confirmed as Ellen Magill's parents by Ellen's "
        "civil birth on 4 October 1880 in Carnlough."
    ),
    "P098": (
        "A labourer. Named as father at the confirmed 17 March 1915 marriage "
        "of his daughter Mary Bridget Connor, of Crossdrum, to William Cooke, "
        "at the Roman Catholic chapel of Ballinacree, near Oldcastle in "
        "County Meath. His wife's name is not yet known."
    ),
    "P110": (
        "Maiden name McConell. She married William John Donaghy on 29 October "
        "1871 in Larne; her father was James McConell, a labourer. Their son "
        "Robert was born on 19 October 1879 on Agnew's Lane, Larne. She "
        "reported her husband's death on 19 March 1903 on Main Street, Larne."
    ),
    "P113": (
        "Maiden name Wilson. She married Thomas Magill, an agricultural "
        "labourer of Carnlough, on 27 November 1879 at Glenarm, in the parish "
        "of Tickmacrevan. Her father was James Wilson, a farmer. Ellen's civil "
        "birth on 4 October 1880 in Carnlough names the mother as Mary McGill "
        "formerly Wilson, confirming this couple as Ellen's parents."
    ),
    "P111": (
        "A carter. Named as father at the 29 October 1871 Larne marriage of "
        "his son William John Donaghy to Mary Ann McConell. His wife's name "
        "is not yet known."
    ),
    "P101": (
        "An agricultural labourer of Carnlough at his marriage to Mary Wilson "
        "on 27 November 1879 at Glenarm, in the parish of Tickmacrevan. His "
        "father was Jeremiah Magill, a tailor. Ellen's civil birth on 4 "
        "October 1880 in Carnlough names him as Thomas McGill, a carpenter, "
        "and confirms this couple as her parents. He is also named as father, "
        "a labourer, at the probable 1906 Carnlough marriage of Ellen Magill "
        "to Robert Donaghy. That 1906 record called Ellen a minor, which would "
        "not fit an 1880 birth (she would have been about 25)."
    ),
}


# Leftover holes after a living name was removed, e.g. "testimony from , 14 Nov".
REDACTION_ARTIFACTS = (
    re.compile(r"\bfrom\s+,"),
    re.compile(r"\bvia\s+,"),
    re.compile(r"\bby\s+,"),
    re.compile(r"testimony from\s*,"),
)


def tidy_public_field(text: str) -> str:
    """Strip research housekeeping from a card field, without adding facts."""
    if not text:
        return ""
    out = text
    # Remove a parenthesised URL first so the brackets do not dangle.
    out = re.sub(r"\(\s*https?://[^)]+\)", "", out)
    out = re.sub(r"https?://\S+", "", out)
    # "a relative typed 2043, meaning 1943" and any wrapping research date.
    out = re.sub(
        r"\(?\s*(?:\d{1,2}\s+\w+\s+202[5-9]\s*;\s*)?a relative typed \d{4},"
        r"(?: clearly)? meaning \d{4}"
        r"(?:, the same sort of typo as [^).]+)?\)?\.?",
        "",
        out,
        flags=re.I,
    )
    # Research-session dates such as "(14 Nov 2026)" or "Mentioned 14 Nov 2026".
    out = re.sub(r"\(?\s*\d{1,2}\s+\w+\s+202[5-9]\s*;?\s*\)", "", out)
    out = re.sub(r",?\s*\d{1,2}\s+\w+\s+202[5-9]\b", "", out)
    out = re.sub(r"\b(?:from|via|by)\s+,", ",", out)
    out = re.sub(r"Supporting testimony\s*:?\s*", "", out, flags=re.I)
    # Testimony remnants belong in the family note, not the marriage line.
    out = re.sub(
        r"possible that Nan's mum's maiden name was Magill;?\s*",
        "",
        out,
        flags=re.I,
    )
    out = re.sub(r"[^.]*\bare a lead only[^.]*\.", "", out, flags=re.I)
    out = re.sub(r"[^.]*\blead only[^.]*\.", "", out, flags=re.I)
    out = re.sub(r"\bMentioned\.?", "", out, flags=re.I)
    out = re.sub(r"\(\s*[,;:./]*\s*\)", "", out)
    out = re.sub(r"\(\s*$", "", out)
    out = re.sub(r"(Married \d{1,2} \w+ \d{4})\s+(Place not known)", r"\1. \2", out)
    out = re.sub(r"\s{2,}", " ", out)
    out = re.sub(r"\s+\.", ".", out)
    out = re.sub(r"\.\s*\.", ".", out)
    return _tidy(out)


def general_note_tidy(text: str) -> str:
    """Fallback when a person has no hand-written family note."""
    if not text:
        return ""
    out = tidy_public_field(text)
    out = re.sub(
        r"LEAD[S]? ONLY, NOT ADDED[^.]*\.",
        "",
        out,
        flags=re.I,
    )
    out = re.sub(
        r"A lead(?: only)?, not (?:added|linked)[^.]*\.",
        "",
        out,
        flags=re.I,
    )
    out = re.sub(r"A competing lead[^.]*\.", "", out, flags=re.I)
    out = re.sub(r"Confirm dates with a certificate\.", "", out, flags=re.I)
    out = re.sub(r"[^.]*confirm before ordering\.", "", out, flags=re.I)
    out = re.sub(r"[^.]*quote the cost before searching[^.]*\.", "", out, flags=re.I)
    out = re.sub(r"INDEX MATCH, FITS FAMILY INFO\s*:?\s*", "", out, flags=re.I)
    out = re.sub(r"\b(?:HIGH CONFIDENCE|PROBABLE(?: / MODERATE)?|CONFIRMED)\.\s*", "", out, flags=re.I)
    out = re.sub(r"HubSpot/family notes[^.]*\.", "", out, flags=re.I)
    return _tidy(out)


def family_note(pid: str, raw: str, terms: list[str]) -> str:
    """Publish a short family-readable note, still passed through the leak filter."""
    if pid in FAMILY_NOTES:
        text = FAMILY_NOTES[pid]
    else:
        text = general_note_tidy(raw)
    return sanitize(text, terms)


def find_artifacts(blob: str) -> list[str]:
    """Catch leftover redaction holes so living names are not hinted at."""
    hits = []
    for pattern in REDACTION_ARTIFACTS:
        if pattern.search(blob):
            hits.append(pattern.pattern)
    return hits


def find_leaks(blob: str, names: list[str]) -> list[str]:
    # Ignore saint or place forms such as "St Kevin's" so a street on a
    # historical record is not treated as a living person's name.
    masked, _held = _stash_saint_places(blob)
    hits = []
    for name in names:
        pattern = re.compile(rf"\b{re.escape(name)}\b", re.I)
        for match in pattern.finditer(masked):
            if " " in name or not _follows_historical_surname(match):
                hits.append(name)
                break
    return hits


def build(xlsx_path: Path) -> tuple[dict, dict]:
    people = load_people(xlsx_path)
    rel_key = next(
        (key for key in (people[0].keys() if people else []) if key.lower().startswith("relationship")),
        "",
    )
    terms = living_terms(people)
    _set_birth_clause_firsts(people)
    _set_living_surnames(people)
    testimony_ids, testimony_conflicts = testimony_confirmed_ids(people)

    published, excluded_living, excluded_unclear = [], [], []
    for row in people:
        status = cell_str(row.get("Status")).lower()
        pid = cell_str(row.get("ID"))
        first = cell_str(row.get("First name(s)"))
        surname = cell_str(row.get("Surname"))
        label = f"{pid} {first} {surname}".strip()
        if is_publishable(row, testimony_ids):
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
            "marriage": tidy_public_field(sanitize(cell_str(row.get("Marriage details")), terms)),
            "death": sanitize(cell_str(row.get("Death date")), terms),
            "note": family_note(pid, sanitize(cell_str(row.get("Notes / gaps")), terms), terms),
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
        "testimony_conflicts": testimony_conflicts,
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
    artifacts = find_artifacts(blob)
    if artifacts:
        sys.stderr.write(
            "Refusing to write data.json: redaction artifacts still present: "
            + ", ".join(artifacts)
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
    if stats["testimony_conflicts"]:
        print("Testimony conflicts (marked Living, not published):")
        for pid in stats["testimony_conflicts"]:
            print(f"  {pid}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
