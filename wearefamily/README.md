# Family tree

This page lists only people whose death is confirmed. Confirmation comes from the family spreadsheet (a death date, a death year that is not marked possible or unconfirmed, or an explicit deceased status) or from family testimony recorded in `generate.py`.

The testimony rule, dated 15 Nov 2026, is keyed by person ID. For roots `P058` and `P059`, the generator includes that person, their siblings, every ancestor, and those ancestors' siblings. From `P002` it includes only that person's parents and older (including those ancestors' siblings), not anyone in the same generation. Anyone explicitly marked Living in the spreadsheet is not published, even if they fall inside a testimony line.

Anyone else whose status is unclear is left out when the data file is built — not in the browser. Parent and partner links are kept only when both people are included. Sibling links between included people are derived from shared parents, even if those parents are not themselves included.

The spreadsheet is not in this repository.

## Regenerate the data

From this folder, with Python 3 and `openpyxl` installed:

```
python3 generate.py /path/to/spreadsheet.xlsx
```

That writes `data.json` here. Use `-o` to choose a different output path. The script refuses to write the file if a living person's name is still present in the output.
