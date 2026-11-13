import {
  deriveBracket,
  formatTeamName,
  listByes,
  listPlayedRound1,
  slotLabel,
  teamsById,
} from './bracket.mjs';

const POLL_MS = 45000;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const els = {
  status: document.getElementById('status'),
  players: document.getElementById('players'),
  teamList: document.getElementById('team-list'),
  byeNote: document.getElementById('bye-note'),
  round1: document.getElementById('round1-matches'),
  qf: document.getElementById('qf-matches'),
  sf: document.getElementById('sf-matches'),
  final: document.getElementById('final-match'),
  champions: document.getElementById('champions'),
  champName: document.getElementById('champ-name'),
  updated: document.getElementById('updated'),
  celebration: document.getElementById('celebration'),
};

let previous = null;
let lastJson = '';
let celebratedChampion = null;
let scoreTimers = new Map();

function prefersReduced() {
  return reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isTbdLabel(label) {
  return label === 'TBD' || label === 'To be drawn';
}

function formatUpdated(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
  return `Updated ${formatted} Europe/London`;
}

function namesDrawn(data) {
  return (data.teams ?? []).some((team) =>
    (team.players ?? []).some((name) => String(name ?? '').trim()),
  );
}

function statusText(data, bracket) {
  if (bracket.champion) {
    const map = teamsById(data);
    return `Champions: ${slotLabel(bracket.champion, map)}`;
  }
  if (!namesDrawn(data)) return 'Waiting for the hat draw.';
  const open = [...bracket.round1, ...bracket.quarterfinals, ...bracket.semifinals, bracket.final]
    .filter((match) => !match.isBye && match.a && match.b && !match.winner);
  if (open.length === 0) return 'Every played match has a winner.';
  return 'Live scores — this page updates itself.';
}

function renderPlayers(data) {
  const names = data.players ?? [];
  els.players.replaceChildren(
    ...names.map((name) => {
      const li = document.createElement('li');
      li.textContent = name;
      return li;
    }),
  );
}

function renderTeams(data, teamMap) {
  const frag = document.createDocumentFragment();
  for (const team of data.teams ?? []) {
    const li = document.createElement('li');
    const id = document.createElement('span');
    id.className = 'tid';
    id.textContent = team.id;
    const name = document.createElement('span');
    const label = formatTeamName(teamMap.get(team.id) ?? team);
    name.textContent = label;
    if (isTbdLabel(label)) name.classList.add('tbd');
    li.append(id, name);
    frag.append(li);
  }
  els.teamList.replaceChildren(frag);
}

function byeNote(round1, teamMap) {
  const byes = listByes(round1).filter((match) => match.a);
  if (!byes.length) {
    return 'Five teams get a bye straight to the quarter-finals, once the draw is in.';
  }
  const labels = byes.map((match) => {
    const name = slotLabel(match.a, teamMap);
    return name === 'TBD' ? match.a : `${match.a} ${name}`;
  });
  return `Byes straight to the quarter-finals: ${labels.join(', ')}.`;
}

function matchHeading(match, index, kind) {
  if (kind === 'r1') return `Match ${index + 1}`;
  if (kind === 'qf') return `QF${index + 1}`;
  if (kind === 'sf') return `SF${index + 1}`;
  return 'Final';
}

function previousSide(prev, matchId, side) {
  if (!prev) return { team: null, score: null, winner: false, label: 'TBD' };
  const match = prev.matches.get(matchId);
  if (!match) return { team: null, score: null, winner: false, label: 'TBD' };
  return {
    team: side === 'a' ? match.a : match.b,
    score: match.score ? match.score[side === 'a' ? 0 : 1] : null,
    winner: match.winner != null && match.winner === (side === 'a' ? match.a : match.b),
    label: side === 'a' ? match.labelA : match.labelB,
  };
}

function animateScore(node, from, to) {
  const key = node;
  if (scoreTimers.has(key)) {
    cancelAnimationFrame(scoreTimers.get(key));
    scoreTimers.delete(key);
  }
  if (to == null) {
    node.textContent = '–';
    return;
  }
  if (prefersReduced() || from == null || from === to) {
    node.textContent = String(to);
    return;
  }
  const start = performance.now();
  const dur = 650;
  const fromN = Number(from) || 0;
  const toN = Number(to);
  const tick = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - (1 - t) ** 3;
    node.textContent = String(Math.round(fromN + (toN - fromN) * eased));
    if (t < 1) {
      const id = requestAnimationFrame(tick);
      scoreTimers.set(key, id);
    } else {
      scoreTimers.delete(key);
    }
  };
  const id = requestAnimationFrame(tick);
  scoreTimers.set(key, id);
}

function renderSide(row, match, side, teamMap, prev) {
  const teamId = side === 'a' ? match.a : match.b;
  const label = side === 'b' && match.isBye ? 'Bye' : slotLabel(teamId, teamMap);
  const scoreVal = match.score ? match.score[side === 'a' ? 0 : 1] : null;
  const isWinner = Boolean(teamId && match.winner === teamId);
  const was = previousSide(prev, match.id, side);

  row.dataset.side = side;
  if (teamId) row.dataset.team = teamId;
  else delete row.dataset.team;

  let name = row.querySelector('.name');
  if (!name) {
    name = document.createElement('span');
    name.className = 'name';
    row.append(name);
  }
  name.textContent = label;
  name.classList.toggle('tbd', isTbdLabel(label) || label === 'Bye');

  const arrived = teamId && teamId !== was.team && label !== was.label;
  name.classList.remove('arrive');
  if (arrived && !prefersReduced() && prev) {
    // Retrigger the CSS animation.
    void name.offsetWidth;
    name.classList.add('arrive');
  }

  if (match.isBye) {
    row.querySelector('.score')?.remove();
  } else {
    let score = row.querySelector('.score');
    if (!score) {
      score = document.createElement('span');
      score.className = 'score';
      score.dataset.score = '';
      row.append(score);
    }
    if (prev) animateScore(score, was.score, scoreVal);
    else score.textContent = scoreVal == null ? '–' : String(scoreVal);
  }

  const becameWinner = isWinner && !was.winner;
  row.classList.toggle('winner', isWinner);
  row.classList.toggle('winner-pulse', Boolean(becameWinner && prev && !prefersReduced()));
}

function renderMatch(container, match, index, kind, teamMap, prev) {
  let article = container.querySelector(`[data-match="${match.id}"]`);
  if (!article) {
    article = document.createElement('article');
    article.className = 'match';
    article.dataset.match = match.id;
    const label = document.createElement('div');
    label.className = 'match-label';
    article.append(label, document.createElement('div'), document.createElement('div'));
    article.children[1].className = 'side';
    article.children[2].className = 'side';
    container.append(article);
  }
  article.dataset.bye = match.isBye ? 'true' : 'false';
  article.querySelector('.match-label').textContent = matchHeading(match, index, kind);
  renderSide(article.children[1], match, 'a', teamMap, prev);
  renderSide(article.children[2], match, 'b', teamMap, prev);
}

function renderMatchList(container, matches, kind, teamMap, prev) {
  const ids = new Set(matches.map((match) => match.id));
  for (const node of [...container.querySelectorAll('[data-match]')]) {
    if (!ids.has(node.dataset.match)) node.remove();
  }
  matches.forEach((match, index) => renderMatch(container, match, index, kind, teamMap, prev));
}

function snapshot(data, bracket, teamMap) {
  const matches = new Map();
  const record = (match) => {
    matches.set(match.id, {
      a: match.a,
      b: match.b,
      score: match.score ? [...match.score] : null,
      winner: match.winner,
      labelA: slotLabel(match.a, teamMap),
      labelB: match.isBye ? 'Bye' : slotLabel(match.b, teamMap),
    });
  };
  bracket.round1.forEach(record);
  bracket.quarterfinals.forEach(record);
  bracket.semifinals.forEach(record);
  record(bracket.final);
  return { matches, champion: bracket.champion, updated: data.updated };
}

const BALL_COLOURS = ['#ffce00', '#0050b5', '#d00', '#4b0082', '#f70', '#0a7a2f', '#7a1010', '#111', '#f6ecd0', '#d4af37'];

function celebrate() {
  const layer = els.celebration;
  layer.replaceChildren();
  layer.hidden = false;
  const count = 36;
  for (let i = 0; i < count; i += 1) {
    const bit = document.createElement('span');
    const isBall = i % 3 === 0;
    bit.className = isBall ? 'bit orb' : 'bit dot';
    bit.style.left = `${Math.random() * 100}%`;
    bit.style.background = BALL_COLOURS[i % BALL_COLOURS.length];
    bit.style.animationDuration = `${1.8 + Math.random() * 1.8}s`;
    bit.style.animationDelay = `${Math.random() * 0.5}s`;
    layer.append(bit);
  }
  window.setTimeout(() => {
    layer.replaceChildren();
    layer.hidden = true;
  }, 4000);
}

function renderChampions(data, bracket, teamMap, prev) {
  const champ = bracket.champion;
  if (!champ) {
    els.champName.textContent = 'Winner of the final appears here';
    els.champName.classList.add('empty');
    els.champions.classList.remove('won');
    return;
  }
  const label = slotLabel(champ, teamMap);
  els.champName.textContent = label;
  els.champName.classList.remove('empty');
  const justWon = !prev || prev.champion !== champ;
  els.champions.classList.toggle('won', Boolean(justWon && !prefersReduced()));
  if (justWon && champ !== celebratedChampion) {
    celebratedChampion = champ;
    if (!prefersReduced()) celebrate();
  }
}

function render(data) {
  const teamMap = teamsById(data);
  const bracket = deriveBracket(data);
  const prev = previous;

  els.status.textContent = statusText(data, bracket);
  renderPlayers(data);
  renderTeams(data, teamMap);
  els.byeNote.textContent = byeNote(bracket.round1, teamMap);
  renderMatchList(els.round1, listPlayedRound1(bracket.round1), 'r1', teamMap, prev);
  renderMatchList(els.qf, bracket.quarterfinals, 'qf', teamMap, prev);
  renderMatchList(els.sf, bracket.semifinals, 'sf', teamMap, prev);
  renderMatchList(els.final, [bracket.final], 'final', teamMap, prev);
  renderChampions(data, bracket, teamMap, prev);

  const stamp = formatUpdated(data.updated);
  els.updated.textContent = stamp;
  els.updated.classList.remove('refresh-error');

  previous = snapshot(data, bracket, teamMap);
  return bracket;
}

async function fetchData() {
  const response = await fetch(`data.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`data.json returned ${response.status}`);
  return response.json();
}

async function poll() {
  try {
    const data = await fetchData();
    const serial = JSON.stringify(data);
    if (serial === lastJson && previous) return;
    lastJson = serial;
    render(data);
  } catch (error) {
    if (!previous) {
      els.status.textContent = 'Could not load the draw.';
    }
    els.updated.textContent = previous
      ? `${formatUpdated(previous.updated)} · couldn’t refresh`
      : 'Could not load data.json';
    els.updated.classList.add('refresh-error');
    console.error(error);
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') poll();
});

poll();
window.setInterval(poll, POLL_MS);

// Used by the local animation check; harmless on the live page.
window.__jpcup = { render, deriveBracket, prefersReduced };
