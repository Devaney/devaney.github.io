# Family tree

This page lists only people whose death is recorded in the family spreadsheet: a death date, a death year, or an explicit deceased status. Anyone living, or whose status is unclear, is left out when the data file is built — not in the browser. Parent and partner links are kept only when both people are included. Sibling links between included people are derived from shared parents, even if those parents are not themselves included.

The spreadsheet is not in this repository.

## Regenerate the data

From this folder, with Python 3 and `openpyxl` installed:

```
python3 generate.py /path/to/spreadsheet.xlsx
```

That writes `data.json` here. Use `-o` to choose a different output path. The script refuses to write the file if a living person's name is still present in the output.
