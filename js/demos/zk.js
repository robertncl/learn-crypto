import { $, $$, el, svgEl } from '../core/dom.js';
import { bytesToHex, utf8 } from '../lib/bytes.js';
import { sha256 } from '../lib/sha256.js';

const fmtOdds = (p) => (p >= 0.01 ? `${+(p * 100).toPrecision(3)}%` : p >= 1e-6 ? `1 in ${Math.round(1 / p).toLocaleString()}` : `1 in ${(1 / p).toExponential(1)}`);
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n) => [...String(n)].map((d) => SUP[d]).join('');

/* ============================== Module 10: the magic cave ============================== */

export function initCaveDemo() {
  const svg = $('#cave-svg');
  const log = $('#cave-log');
  const verdict = $('#cave-verdict');
  const knows = $('#cave-knows');
  let rounds = [];
  let caught = false;

  const PATHS = {
    A: 'M110,132 C38,132 34,30 103,26',
    B: 'M110,132 C182,132 186,30 117,26',
  };

  function draw(last) {
    const pathEl = (side) => {
      const cls = ['cave-path'];
      if (last?.went === side) cls.push('is-in');
      if (last?.out === side) cls.push('is-out');
      return svgEl('path', { d: PATHS[side], class: cls.join(' ') });
    };
    svg.replaceChildren(
      svgEl('title', {}, 'A ring-shaped cave: the entrance splits into paths A and B, which meet at a magic door at the far end.'),
      svgEl('path', { d: 'M110,174 L110,132', class: `cave-path${last ? ' is-in' : ''}` }),
      pathEl('A'),
      pathEl('B'),
      svgEl('rect', { x: 103, y: 17, width: 14, height: 18, rx: 2, class: `cave-door${last?.door ? ' is-open' : ''}` }),
      svgEl('text', { x: 110, y: 11, 'text-anchor': 'middle', class: 'cave-label' }, last?.door ? 'door opened' : 'magic door'),
      svgEl('text', { x: 30, y: 84, 'text-anchor': 'middle', class: 'cave-label is-big' }, 'A'),
      svgEl('text', { x: 190, y: 84, 'text-anchor': 'middle', class: 'cave-label is-big' }, 'B'),
      svgEl('text', { x: 110, y: 192, 'text-anchor': 'middle', class: 'cave-label' }, 'Victor waits at the entrance'),
      last && svgEl('text', { x: 110, y: 84, 'text-anchor': 'middle', class: 'cave-label is-call' }, `Victor calls “${last.call}!”`),
    );
  }

  function runRound() {
    if (caught) return false;
    const went = Math.random() < 0.5 ? 'A' : 'B';
    const call = Math.random() < 0.5 ? 'A' : 'B';
    const ok = knows.checked || went === call;
    const round = { n: rounds.length + 1, went, call, ok, out: ok ? call : went, door: ok && went !== call };
    rounds.push(round);
    caught = !ok;
    log.prepend(el('li', { className: ok ? 'log-ok' : 'log-bad' },
      `Round ${round.n}: went in by ${went}, Victor called ${call} → `,
      ok ? `came out of ${call}${round.door ? ' (through the door)' : ''} ✓` : `stuck — she can only come back out of ${went} ✗`));
    draw(round);
    return ok;
  }

  function summarize() {
    const passed = rounds.filter((r) => r.ok).length;
    if (caught) {
      verdict.className = 'verdict bad';
      verdict.textContent = `✗ Caught in round ${rounds.length}: without the word, Peggy couldn’t come out where Victor called. Proof rejected.`;
    } else {
      verdict.className = 'verdict ok';
      verdict.textContent = `✓ ${passed} round${passed === 1 ? '' : 's'} passed. A bluffer would survive all of them with probability (1/2)${sup(passed)} = ${fmtOdds(0.5 ** passed)}.`;
    }
  }

  $('#cave-round').addEventListener('click', () => { runRound(); summarize(); });
  $('#cave-ten').addEventListener('click', () => {
    for (let i = 0; i < 10 && runRound(); i++);
    summarize();
  });
  const reset = () => {
    rounds = [];
    caught = false;
    log.replaceChildren();
    verdict.className = 'verdict';
    verdict.textContent = '';
    draw(null);
  };
  $('#cave-reset').addEventListener('click', reset);
  knows.addEventListener('change', reset);
  reset();
}

/* ============================== Module 10: 3-colouring with commitments ============================== */

const NODES = [
  { x: 50, y: 6 }, { x: 18, y: 32 }, { x: 82, y: 32 }, { x: 50, y: 52 },
  { x: 22, y: 76 }, { x: 78, y: 76 }, { x: 50, y: 96 },
];
const EDGES = [[0, 1], [0, 2], [1, 2], [1, 3], [2, 3], [3, 4], [3, 5], [4, 5], [4, 6], [5, 6], [1, 4], [2, 5]];
const VALID = [0, 1, 2, 0, 2, 1, 0]; // a proper 3-colouring: every edge joins different colours
const BLUFF = [0, 1, 2, 0, 2, 1, 2]; // one bad edge: 4–6 (nodes 5 and 7 to humans)
const COLOURS = [
  { name: 'violet', css: 'var(--series-1)' },
  { name: 'orange', css: 'var(--series-2)' },
  { name: 'aqua', css: 'var(--series-3)' },
];

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export function initColoringDemo() {
  const svg = $('#zk-graph');
  const edgeSelect = $('#zk-edge');
  const challengeBtn = $('#zk-challenge');
  const revealList = $('#zk-reveal');
  const verdict = $('#zk-verdict');
  let round = null; // { colours, salts, commits, opened, edge }
  let passed = 0;
  let caught = false;

  const edgeLabel = ([a, b]) => `${a + 1}–${b + 1}`;
  edgeSelect.replaceChildren(...EDGES.map((e, i) => el('option', { value: String(i), textContent: `line ${edgeLabel(e)}` })));

  const base = () => ($('input[name="zk-mode"]:checked').value === 'honest' ? VALID : BLUFF);
  const commitment = (colour, salt) => bytesToHex(sha256(utf8(`${COLOURS[colour].name}|${salt}`)));

  /* Peggy relabels the three colours at random, then seals every node’s colour in a salted hash. */
  function commit() {
    const perm = shuffle([0, 1, 2]);
    const colours = base().map((c) => perm[c]);
    const salts = colours.map(() => bytesToHex(crypto.getRandomValues(new Uint8Array(8))));
    round = { colours, salts, commits: colours.map((c, i) => commitment(c, salts[i])), opened: false, edge: null };
  }

  function open(edgeIndex) {
    round.edge = edgeIndex;
    round.opened = true;
    const [a, b] = EDGES[edgeIndex];
    const hashesOk = [a, b].every((n) => commitment(round.colours[n], round.salts[n]) === round.commits[n]);
    const differ = round.colours[a] !== round.colours[b];
    const ok = hashesOk && differ;
    if (ok) passed++;
    else caught = true;
    const desc = (n) => `node ${n + 1} = ${COLOURS[round.colours[n]].name}`;
    revealList.prepend(el('li', { className: ok ? 'log-ok' : 'log-bad' },
      `Round ${passed + (ok ? 0 : 1)} · line ${edgeLabel(EDGES[edgeIndex])}: ${desc(a)}, ${desc(b)} — hashes match ✓, `,
      differ ? 'different colours ✓' : 'SAME colour ✗'));
    return ok;
  }

  function render() {
    const opened = round?.opened ? EDGES[round.edge] : [];
    const edges = EDGES.map(([a, b], i) => {
      const cls = ['zk-edge'];
      if (round?.opened && round.edge === i) cls.push(caught ? 'is-bad' : 'is-picked');
      else if (!round?.opened && Number(edgeSelect.value) === i) cls.push('is-selected');
      return svgEl('g', { class: 'zk-edge-group', 'data-edge': i },
        svgEl('line', { x1: NODES[a].x, y1: NODES[a].y, x2: NODES[b].x, y2: NODES[b].y, class: cls.join(' ') }),
        svgEl('line', { x1: NODES[a].x, y1: NODES[a].y, x2: NODES[b].x, y2: NODES[b].y, class: 'zk-edge-hit' },
          svgEl('title', {}, `line ${edgeLabel([a, b])}`)));
    });
    const nodes = NODES.map((n, i) => {
      const revealed = opened.includes(i);
      return svgEl('g', {},
        svgEl('circle', {
          cx: n.x, cy: n.y, r: 6.5,
          class: `zk-node${revealed ? ' is-open' : ''}`,
          style: revealed ? `fill:${COLOURS[round.colours[i]].css}` : null,
        }),
        svgEl('text', { x: n.x, y: n.y + 2.4, 'text-anchor': 'middle', class: `zk-node-num${revealed ? ` on-${COLOURS[round.colours[i]].name}` : ''}` }, String(i + 1)),
        svgEl('text', { x: n.x + (n.x > 50 ? 9 : n.x < 50 ? -9 : 0), y: n.y + (n.x === 50 ? (n.y < 50 ? -9 : 12) : 2), 'text-anchor': n.x > 50 ? 'start' : n.x < 50 ? 'end' : 'middle', class: 'zk-commit' },
          !round ? '' : revealed ? COLOURS[round.colours[i]].name : `🔒${round.commits[i].slice(0, 6)}`));
    });
    svg.replaceChildren(...edges, ...nodes);
    $$('.zk-edge-group', svg).forEach((g) => g.addEventListener('click', () => {
      if (!round || round.opened || caught) return;
      edgeSelect.value = g.dataset.edge;
      render();
    }));

    challengeBtn.disabled = !round || round.opened || caught;
    edgeSelect.disabled = !round || round.opened || caught;
    $('#zk-commit').disabled = caught || Boolean(round && !round.opened);
    $('#zk-rounds').textContent = String(passed);
    $('#zk-odds').textContent = fmtOdds((11 / 12) ** passed);
    if (caught) {
      verdict.className = 'verdict bad';
      verdict.textContent = `✗ Caught! Both ends of line ${edgeLabel(EDGES[round.edge])} are ${COLOURS[round.colours[EDGES[round.edge][0]]].name}. Peggy’s colouring is invalid — proof rejected.`;
    } else if (!round) {
      verdict.className = 'verdict neutral';
      verdict.textContent = 'Start a round: Peggy shuffles her colours and publishes seven sealed commitments.';
    } else if (!round.opened) {
      verdict.className = 'verdict neutral';
      verdict.textContent = 'Seven commitments published. Pick any line — Peggy must open both of its ends.';
    } else {
      verdict.className = 'verdict ok';
      verdict.textContent = `✓ Round passed. Victor’s confidence grows: a bluffer survives ${passed} round${passed === 1 ? '' : 's'} with probability at most (11/12)${sup(passed)} = ${fmtOdds((11 / 12) ** passed)}.`;
    }
  }

  $('#zk-commit').addEventListener('click', () => { commit(); render(); });
  challengeBtn.addEventListener('click', () => { open(Number(edgeSelect.value)); render(); });
  edgeSelect.addEventListener('change', render);
  $('#zk-auto').addEventListener('click', () => {
    for (let i = 0; i < 25 && !caught; i++) {
      commit();
      open(Math.floor(Math.random() * EDGES.length));
    }
    render();
  });
  const reset = () => {
    round = null;
    passed = 0;
    caught = false;
    revealList.replaceChildren();
    render();
  };
  $('#zk-reset').addEventListener('click', reset);
  $$('input[name="zk-mode"]').forEach((r) => r.addEventListener('change', reset));
  reset();
}
