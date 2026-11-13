/**
 * JP Cup bracket logic.
 * Shared by the page (page.js) and by bracket.test.mjs.
 *
 * Data conventions are documented in README.md:
 *   - b: null  means a bye; that side's team (a) auto-advances.
 *   - Empty team players means the team is still "To be drawn".
 *   - Later rounds are derived from round1 by position.
 *   - A match winner is the strictly higher score; a tie has no winner.
 */

export const QF_IDS = Object.freeze(['QF-1', 'QF-2', 'QF-3', 'QF-4']);
export const SF_IDS = Object.freeze(['SF-1', 'SF-2']);
export const FINAL_ID = 'F-1';
export const ROUND1_SLOTS = 8;

export function teamsById(data) {
  const map = new Map();
  for (const team of data?.teams ?? []) {
    if (team && team.id) map.set(String(team.id), team);
  }
  return map;
}

export function teamPlayers(team) {
  if (!team) return [];
  return (team.players ?? [])
    .map((name) => String(name ?? '').trim())
    .filter(Boolean);
}

export function formatTeamName(team, { empty = 'To be drawn', missing = 'TBD' } = {}) {
  if (!team) return missing;
  const names = teamPlayers(team);
  if (names.length === 0) return empty;
  if (names.length === 1) return names[0];
  return names.join(' & ');
}

/** Bracket slot label: undrawn teams and empty slots both read as TBD. */
export function formatSlotLabel(team) {
  return formatTeamName(team, { empty: 'TBD', missing: 'TBD' });
}

export function slotLabel(teamId, teamMap) {
  if (!teamId) return 'TBD';
  const team = teamMap.get(teamId);
  if (!team) return String(teamId);
  return formatSlotLabel(team);
}

/**
 * A match is a bye when `b` is null or omitted.
 * `b: ""` is treated as a real match whose second team is still TBD.
 */
export function isBye(match) {
  if (!match) return false;
  return !Object.prototype.hasOwnProperty.call(match, 'b') || match.b === null;
}

export function normalizeSide(value) {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

export function parseScore(scores, id) {
  const raw = scores?.[id];
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const a = raw[0];
  const b = raw[1];
  if (a === null || a === undefined || a === '' || b === null || b === undefined || b === '') {
    return null;
  }
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return null;
  return [na, nb];
}

/**
 * Winner of a single match: a team id, or null if none yet.
 * Byes auto-advance side a once a team id is set. Scores are ignored on byes.
 * A strictly higher score wins. Ties have no winner.
 */
export function winnerOf(match, score) {
  if (!match) return null;
  const a = normalizeSide(match.a);
  if (isBye(match)) return a;
  const b = normalizeSide(match.b);
  if (!a || !b) return null;
  if (!score) return null;
  const [sa, sb] = score;
  if (sa > sb) return a;
  if (sb > sa) return b;
  return null;
}

function buildMatch(id, a, b, scores, bye) {
  const score = bye ? null : parseScore(scores, id);
  const match = {
    id,
    a: normalizeSide(a),
    b: bye ? null : normalizeSide(b),
    score,
    isBye: Boolean(bye),
  };
  match.winner = winnerOf(match, score);
  return match;
}

/**
 * Derive the full knockout from the committed data file.
 * Always returns 8 Round 1 slots, 4 quarter-finals, 2 semi-finals, one final,
 * and a champion id (or null). Safe to call with empty or partial data.
 */
export function deriveBracket(data) {
  const scores = data?.scores ?? {};
  const rows = Array.isArray(data?.round1) ? data.round1 : [];

  const round1 = [];
  for (let i = 0; i < ROUND1_SLOTS; i += 1) {
    const raw = rows[i] ?? {};
    const id = raw.id || `R1-${i + 1}`;
    const bye = isBye(raw);
    round1.push(buildMatch(id, raw.a, raw.b, scores, bye));
  }

  const pairRound = (ids, sources) =>
    ids.map((id, i) =>
      buildMatch(id, sources[i * 2]?.winner ?? null, sources[i * 2 + 1]?.winner ?? null, scores, false),
    );

  const quarterfinals = pairRound(QF_IDS, round1);
  const semifinals = pairRound(SF_IDS, quarterfinals);
  const final = buildMatch(
    FINAL_ID,
    semifinals[0]?.winner ?? null,
    semifinals[1]?.winner ?? null,
    scores,
    false,
  );

  return {
    round1,
    quarterfinals,
    semifinals,
    final,
    champion: final.winner ?? null,
  };
}

export function listByes(round1) {
  return (round1 ?? []).filter((match) => match.isBye);
}

export function listPlayedRound1(round1) {
  return (round1 ?? []).filter((match) => !match.isBye);
}
