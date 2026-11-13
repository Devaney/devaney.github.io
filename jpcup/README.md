# JP Cup data file

The page at `/jpcup/` reads **`/jpcup/data.json`**. That file is the only source of truth. Edit it, commit, and merge; the live page picks up the new file on its next poll (every 45 seconds) and animates the changes. There is no on-page editor and no per-device draw.

## Shape

```json
{
  "updated": "2026-11-13T21:30:00Z",
  "players": ["Kieran", "Dave", "Matthew"],
  "teams": [
    { "id": "T1", "players": ["Matthew", "Luke"] },
    { "id": "T2", "players": ["David", "H"] }
  ],
  "round1": [
    { "id": "R1-1", "a": "T1", "b": "T2" },
    { "id": "R1-2", "a": "T7", "b": null }
  ],
  "scores": {
    "R1-1": [5, 3],
    "QF-1": [4, 2],
    "F-1": [6, 1]
  }
}
```

- `updated` is an ISO-8601 timestamp. The page shows it in Europe/London time. Bump it whenever you change the file so it's obvious the publish is fresh.
- `players` is the full entry list (22 names). It is shown as-is; it does not have to stay in sync with team names, but it should.
- `teams` is exactly 11 entries, `T1`–`T11`. Two names in `players`. Empty strings mean the team is still **To be drawn** (the bracket shows **TBD** until both or one name is filled).
- `round1` is exactly 8 slots, which make a 16-place knockout. Later rounds are never written here; the page derives them by position.

## Byes and bracket position

`b: null` means a **bye**. That slot's team (`a`) goes straight through to the quarter-finals. Do not use `""` for a bye — an empty string is a real match whose second team is still TBD.

The default slot order, which matches the approved wireframe, is:

| Slot  | Teams        | Result in the next round      |
|-------|--------------|-------------------------------|
| R1-1  | T1 vs T2     | Winner → QF-1 side A          |
| R1-2  | T7, bye      | T7 → QF-1 side B              |
| R1-3  | T3 vs T4     | Winner → QF-2 side A          |
| R1-4  | T8, bye      | T8 → QF-2 side B              |
| R1-5  | T5 vs T6     | Winner → QF-3 side A          |
| R1-6  | T9, bye      | T9 → QF-3 side B              |
| R1-7  | T10, bye     | T10 → QF-4 side A             |
| R1-8  | T11, bye     | T11 → QF-4 side B             |

Then: QF-1 vs QF-2 → SF-1; QF-3 vs QF-4 → SF-2; the two semi winners → `F-1`; the winner of `F-1` is the champion.

To change who gets a bye, swap the team ids in `round1` (and set `b` to a team id or to `null`). You do not need to add quarter-final rows.

## Entering teams after the hat draw

Fill the two names on each team. Leave `round1` alone unless the bye allocation also changed.

```json
{ "id": "T1", "players": ["Matthew", "Luke"] }
```

## Entering scores

Add an entry to `scores` keyed by the match id. The array is `[side A, side B]` in the same order as the match.

```json
"scores": {
  "R1-1": [5, 3],
  "QF-1": [4, 2],
  "SF-1": [5, 4],
  "F-1": [6, 1]
}
```

Valid match ids: `R1-1`…`R1-8` (played matches only), `QF-1`…`QF-4`, `SF-1`, `SF-2`, `F-1`.

The higher number wins and the team is advanced automatically. A tie (for example `[4, 4]`) or a missing / partial score means no winner yet. Scores on bye slots are ignored.

## Checks

From this folder:

```
node --test bracket.test.mjs
```
