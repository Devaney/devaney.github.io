import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  FINAL_ID,
  deriveBracket,
  formatSlotLabel,
  formatTeamName,
  isBye,
  listByes,
  listPlayedRound1,
  parseScore,
  slotLabel,
  teamsById,
  winnerOf,
} from './bracket.mjs';

const here = dirname(fileURLToPath(import.meta.url));

function sampleData(overrides = {}) {
  return {
    updated: '2026-11-13T20:00:00Z',
    players: ['Matthew', 'Luke', 'David', 'H', 'Shay', 'Liam', 'Luke B', 'Karim', 'Aman', 'Dave', 'Nathan', 'Steve', 'Eoin', 'Chris', 'Josh', 'Jason', 'Adrian', 'Kieran', 'Jamie', 'Pat', 'David C', 'Simon'],
    teams: [
      { id: 'T1', players: ['Matthew', 'Luke'] },
      { id: 'T2', players: ['David', 'H'] },
      { id: 'T3', players: ['Shay', 'Liam'] },
      { id: 'T4', players: ['Luke B', 'Karim'] },
      { id: 'T5', players: ['Aman', 'Dave'] },
      { id: 'T6', players: ['Nathan', 'Steve'] },
      { id: 'T7', players: ['Eoin', 'Chris'] },
      { id: 'T8', players: ['Josh', 'Jason'] },
      { id: 'T9', players: ['Adrian', 'Kieran'] },
      { id: 'T10', players: ['Jamie', 'Pat'] },
      { id: 'T11', players: ['David C', 'Simon'] },
    ],
    round1: [
      { id: 'R1-1', a: 'T1', b: 'T2' },
      { id: 'R1-2', a: 'T7', b: null },
      { id: 'R1-3', a: 'T3', b: 'T4' },
      { id: 'R1-4', a: 'T8', b: null },
      { id: 'R1-5', a: 'T5', b: 'T6' },
      { id: 'R1-6', a: 'T9', b: null },
      { id: 'R1-7', a: 'T10', b: null },
      { id: 'R1-8', a: 'T11', b: null },
    ],
    scores: {},
    ...overrides,
  };
}

test('byes advance the assigned team with no score needed', () => {
  const { round1, quarterfinals } = deriveBracket(sampleData());
  const byes = listByes(round1);
  assert.equal(byes.length, 5);
  assert.deepEqual(byes.map((m) => m.a), ['T7', 'T8', 'T9', 'T10', 'T11']);
  for (const match of byes) {
    assert.equal(match.winner, match.a);
    assert.equal(match.score, null);
    assert.equal(isBye(match), true);
  }
  // QF-1 is winner of R1-1 (none yet) vs bye T7
  assert.equal(quarterfinals[0].a, null);
  assert.equal(quarterfinals[0].b, 'T7');
  assert.equal(quarterfinals[1].b, 'T8');
  assert.equal(quarterfinals[2].b, 'T9');
  assert.equal(quarterfinals[3].a, 'T10');
  assert.equal(quarterfinals[3].b, 'T11');
});

test('a bye with no team id does not invent a winner', () => {
  const data = sampleData({
    round1: [
      { id: 'R1-1', a: 'T1', b: 'T2' },
      { id: 'R1-2', a: null, b: null },
      { id: 'R1-3', a: 'T3', b: 'T4' },
      { id: 'R1-4', a: 'T8', b: null },
      { id: 'R1-5', a: 'T5', b: 'T6' },
      { id: 'R1-6', a: 'T9', b: null },
      { id: 'R1-7', a: 'T10', b: null },
      { id: 'R1-8', a: 'T11', b: null },
    ],
  });
  const { round1 } = deriveBracket(data);
  assert.equal(round1[1].isBye, true);
  assert.equal(round1[1].winner, null);
});

test('scores decide winners: the higher score advances', () => {
  const data = sampleData({
    scores: {
      'R1-1': [5, 3],
      'R1-3': [2, 6],
    },
  });
  const { round1, quarterfinals } = deriveBracket(data);
  assert.deepEqual(round1[0].score, [5, 3]);
  assert.equal(round1[0].winner, 'T1');
  assert.equal(round1[2].winner, 'T4');
  assert.equal(quarterfinals[0].a, 'T1');
  assert.equal(quarterfinals[0].b, 'T7');
  assert.equal(quarterfinals[1].a, 'T4');
  assert.equal(quarterfinals[1].b, 'T8');
});

test('ties have no winner, and missing or partial scores have no winner', () => {
  const tied = winnerOf({ id: 'R1-1', a: 'T1', b: 'T2' }, [4, 4]);
  assert.equal(tied, null);

  const data = sampleData({
    scores: {
      'R1-1': [4, 4],
      'R1-3': [1],
      'R1-5': [null, 2],
    },
  });
  const { round1, quarterfinals } = deriveBracket(data);
  assert.equal(round1[0].winner, null);
  assert.equal(round1[2].winner, null);
  assert.equal(round1[4].winner, null);
  assert.equal(quarterfinals[0].a, null);
  assert.equal(parseScore({ 'R1-3': [1] }, 'R1-3'), null);
});

test('every later round is derived from the previous winners by position', () => {
  const data = sampleData({
    scores: {
      'R1-1': [5, 3],
      'R1-3': [2, 6],
      'R1-5': [7, 1],
      'QF-1': [4, 2],
      'QF-2': [1, 5],
      'QF-3': [3, 0],
      'QF-4': [6, 4],
      'SF-1': [5, 4],
      'SF-2': [2, 3],
    },
  });
  const { quarterfinals, semifinals, final, champion } = deriveBracket(data);

  assert.deepEqual(quarterfinals.map((m) => [m.a, m.b]), [
    ['T1', 'T7'],
    ['T4', 'T8'],
    ['T5', 'T9'],
    ['T10', 'T11'],
  ]);
  assert.equal(quarterfinals[0].winner, 'T1');
  assert.equal(quarterfinals[1].winner, 'T8');
  assert.equal(quarterfinals[2].winner, 'T5');
  assert.equal(quarterfinals[3].winner, 'T10');

  assert.equal(semifinals[0].a, 'T1');
  assert.equal(semifinals[0].b, 'T8');
  assert.equal(semifinals[1].a, 'T5');
  assert.equal(semifinals[1].b, 'T10');
  assert.equal(semifinals[0].winner, 'T1');
  assert.equal(semifinals[1].winner, 'T10');

  assert.equal(final.id, FINAL_ID);
  assert.equal(final.a, 'T1');
  assert.equal(final.b, 'T10');
  assert.equal(final.winner, null);
  assert.equal(champion, null);
});

test('the champion is the winner of the final', () => {
  const data = sampleData({
    scores: {
      'R1-1': [5, 3],
      'R1-3': [2, 6],
      'R1-5': [7, 1],
      'QF-1': [4, 2],
      'QF-2': [1, 5],
      'QF-3': [3, 0],
      'QF-4': [6, 4],
      'SF-1': [5, 4],
      'SF-2': [2, 3],
      'F-1': [6, 2],
    },
  });
  const { final, champion } = deriveBracket(data);
  assert.equal(final.winner, 'T1');
  assert.equal(champion, 'T1');
});

test('the empty or TBD state derives without errors and names render safely', async () => {
  const empty = deriveBracket({});
  assert.equal(empty.round1.length, 8);
  assert.equal(empty.quarterfinals.length, 4);
  assert.equal(empty.semifinals.length, 2);
  assert.equal(empty.final.id, FINAL_ID);
  assert.equal(empty.champion, null);
  for (const match of empty.round1) {
    assert.equal(match.winner, null);
  }

  const raw = await readFile(join(here, 'data.json'), 'utf8');
  const initial = JSON.parse(raw);
  assert.equal(initial.players.length, 22);
  assert.equal(initial.teams.length, 11);
  assert.equal(initial.round1.length, 8);
  assert.equal(Object.keys(initial.scores).length, 0);
  for (const team of initial.teams) {
    assert.deepEqual(team.players, ['', '']);
    assert.equal(formatTeamName(team), 'To be drawn');
    assert.equal(formatSlotLabel(team), 'TBD');
  }

  const bracket = deriveBracket(initial);
  assert.equal(listPlayedRound1(bracket.round1).length, 3);
  assert.equal(listByes(bracket.round1).length, 5);
  assert.equal(bracket.champion, null);
  // Byes still advance a team id, even while names are undrawn
  assert.equal(bracket.round1[1].winner, 'T7');
  assert.equal(bracket.quarterfinals[0].b, 'T7');

  const map = teamsById(initial);
  assert.equal(slotLabel(null, map), 'TBD');
  assert.equal(slotLabel('T1', map), 'TBD');
  assert.equal(formatTeamName(null), 'TBD');
  assert.equal(formatTeamName(map.get('T1')), 'To be drawn');
  assert.equal(formatSlotLabel(null), 'TBD');
});

test('team labels join two names, and a single name stands alone', () => {
  assert.equal(formatTeamName({ id: 'T1', players: ['Matthew', 'Luke'] }), 'Matthew & Luke');
  assert.equal(formatTeamName({ id: 'T1', players: ['H', ''] }), 'H');
  assert.equal(formatSlotLabel({ id: 'T1', players: ['David C', 'Simon'] }), 'David C & Simon');
});
