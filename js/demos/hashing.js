import { $, el, fmt, sha256Hex, yieldToMain } from '../core/dom.js';
import { t, tNodes } from '../core/i18n.js';
import { sha256 } from '../lib/sha256.js';
import { bytesToHex, utf8 } from '../lib/bytes.js';

/* ============================== Module 2: hash playground & avalanche ============================== */

export function initHashPlayground() {
  const input = $('#hash-input');
  const output = $('#hash-output');
  const sizes = $('#hash-sizes');
  let token = 0;

  const update = async () => {
    const current = ++token;
    const hash = await sha256Hex(input.value);
    if (current !== token) return;
    output.textContent = hash;
    const n = utf8(input.value).length;
    sizes.textContent = t('hash.sizes', { n, v: fmt(n) });
  };

  input.addEventListener('input', update);
  update();
}

export function initAvalanche() {
  const inputA = $('#ava-a');
  const inputB = $('#ava-b');
  const outA = $('#ava-out-a');
  const outB = $('#ava-out-b');
  const stats = $('#ava-stats');
  const grid = $('#ava-bits');
  const cells = Array.from({ length: 256 }, () => grid.appendChild(el('span')));
  let token = 0;

  const renderDiff = (output, hash, other) => {
    output.replaceChildren(
      ...[...hash].map((char, i) => {
        const span = document.createElement('span');
        span.textContent = char;
        if (char !== other[i]) span.className = 'diff';
        return span;
      }),
    );
  };

  const update = async () => {
    const current = ++token;
    const [hashA, hashB] = await Promise.all([sha256Hex(inputA.value), sha256Hex(inputB.value)]);
    if (current !== token) return;

    renderDiff(outA, hashA, hashB);
    renderDiff(outB, hashB, hashA);

    let bitsDiff = 0;
    for (let i = 0; i < 64; i++) {
      const xor = parseInt(hashA[i], 16) ^ parseInt(hashB[i], 16);
      for (let b = 0; b < 4; b++) {
        const flipped = Boolean((xor >> (3 - b)) & 1);
        cells[i * 4 + b].classList.toggle('flip', flipped);
        if (flipped) bitsDiff++;
      }
    }
    stats.textContent = inputA.value === inputB.value
      ? t('hash.ava.same')
      : t('hash.ava.diff', { bits: bitsDiff, pct: Math.round((bitsDiff / 256) * 100) });
  };

  inputA.addEventListener('input', update);
  inputB.addEventListener('input', update);
  update();
}

/* ============================== Module 2: Merkle tree + proof ============================== */

export function initMerkleDemo() {
  const DEFAULT_TXS = [
    'Alice → Bob: 5 BTC',
    'Bob → Carol: 2 BTC',
    'Carol → Dan: 1 BTC',
    'Dan → Erin: 4 BTC',
  ];
  const NAMES = ['H(A)', 'H(B)', 'H(C)', 'H(D)', 'H(AB)', 'H(CD)', 'root'];
  const inputs = [0, 1, 2, 3].map((i) => $(`#mk-tx${i}`));
  const nodeEls = ['mk-h0', 'mk-h1', 'mk-h2', 'mk-h3', 'mk-h01', 'mk-h23', 'mk-root']
    .map((id) => $(`#${id}`));
  const proveSelect = $('#mk-prove');
  const proofList = $('#mk-proof');
  const proofVerdict = $('#mk-proof-verdict');

  let baseline = null; // the block as mined: its hashes, root included, are fixed
  let token = 0;

  async function computeTree() {
    const leaves = await Promise.all(inputs.map((inp) => sha256Hex(inp.value)));
    const left = await sha256Hex(leaves[0] + leaves[1]);
    const right = await sha256Hex(leaves[2] + leaves[3]);
    const root = await sha256Hex(left + right);
    return [...leaves, left, right, root];
  }

  const short = (h) => `${h.slice(0, 10)}…`;

  /* The full node supplies the siblings from the real block; the wallet hashes the
     transaction it was shown and climbs to the root. */
  async function renderProof(current) {
    const i = Number(proveSelect.value);
    const sibling = i ^ 1;
    const parent = 4 + (i >> 1);
    const uncle = 4 + ((i >> 1) ^ 1);
    const leafHash = current[i];
    const pair = (a, b, aIsLeft) => (aIsLeft ? a + b : b + a);
    const parentHash = await sha256Hex(pair(leafHash, baseline[sibling], i % 2 === 0));
    const rootHash = await sha256Hex(pair(parentHash, baseline[uncle], parent === 4));
    if (current !== latest) return;

    const tx = inputs[i].value;
    const order = (mine, theirs, mineLeft) => (mineLeft ? `${mine} ‖ ${theirs}` : `${theirs} ‖ ${mine}`);
    const code = (text) => el('code', { textContent: text });
    proofList.replaceChildren(
      el('li', {}, ...tNodes('hash.proof.leaf', { formula: code(`${NAMES[i]} = SHA-256("${tx}")`), hash: code(short(leafHash)) })),
      el('li', {}, ...tNodes('hash.proof.sibling', {
        sibling: el('strong', { textContent: NAMES[sibling] }),
        formula: code(`${NAMES[parent]} = SHA-256(${order(NAMES[i], NAMES[sibling], i % 2 === 0)})`),
        hash: code(short(parentHash)),
      })),
      el('li', {}, ...tNodes('hash.proof.sibling', {
        sibling: el('strong', { textContent: NAMES[uncle] }),
        formula: code(`root = SHA-256(${order(NAMES[parent], NAMES[uncle], parent === 4)})`),
        hash: code(short(rootHash)),
      })),
    );

    const ok = rootHash === baseline[6];
    proofVerdict.className = `verdict ${ok ? 'ok' : 'bad'}`;
    proofVerdict.textContent = t(ok ? 'hash.proof.ok' : 'hash.proof.bad', { tx });

    nodeEls.forEach((node, n) => {
      node.classList.toggle('proof-target', n === i);
      node.classList.toggle('proof-sibling', n === sibling || n === uncle);
      node.classList.toggle('proof-path', n === parent || n === 6);
    });
  }

  let latest = null;
  async function update() {
    const current = ++token;
    const hashes = await computeTree();
    if (current !== token) return;
    baseline ??= hashes;
    latest = hashes;
    $('#mk-committed').textContent = baseline[6];

    hashes.forEach((hash, i) => {
      const node = nodeEls[i];
      $('.merkle-hash', node).textContent = `${hash.slice(0, 10)}…`;
      node.title = hash;
      node.classList.toggle('changed', hash !== baseline[i]);
    });
    renderProof(hashes);
  }

  inputs.forEach((inp) => inp.addEventListener('input', update));
  proveSelect.addEventListener('change', () => latest && renderProof(latest));
  $('#mk-reset').addEventListener('click', () => {
    inputs.forEach((inp, i) => { inp.value = DEFAULT_TXS[i]; });
    update();
  });
  update();
}

/* ============================== Module 2: preimage vs collision hunt ============================== */

const prefixBits = (d, n) => ((((d[0] << 24) | (d[1] << 16) | (d[2] << 8) | d[3]) >>> 0) >>> (32 - n));
const randomTag = () => bytesToHex(crypto.getRandomValues(new Uint8Array(2)));

export function initHuntDemo() {
  const PREIMAGE_MAX_BITS = 24; // 2²⁴ ≈ 17 million tries — seconds; 2²⁸ would be minutes
  const bitsInput = $('#hunt-bits');
  const preBtn = $('#pre-run');
  const colBtn = $('#col-run');
  const logBody = $('#hunt-log');
  const target = sha256(utf8('ChainLab'));
  let running = null; // { kind, stop }
  let hashRate = 0; // measured, for time estimates

  const bits = () => Number(bitsInput.value);
  const expectedPre = (n) => 2 ** n;
  const expectedCol = (n) => Math.sqrt((Math.PI / 2) * 2 ** n);

  const hashView = (digest, n) => {
    const hex = bytesToHex(digest);
    return el('span', { className: 'hash-mini' }, el('mark', { textContent: hex.slice(0, n / 4) }), `${hex.slice(n / 4, 16)}…`);
  };

  function renderSettings() {
    const n = bits();
    $('#hunt-bits-out').textContent = t('hash.hunt.bits', { n, hex: n / 4 });
    bitsInput.setAttribute('aria-valuetext', t('hash.hunt.bitsValue', { n }));
    $('#pre-target').textContent = `${bytesToHex(target).slice(0, n / 4)}…`;
    $('#pre-expect').textContent = fmt(expectedPre(n));
    $('#col-expect').textContent = fmt(Math.round(expectedCol(n)));
    if (!running) {
      const tooBig = n > PREIMAGE_MAX_BITS;
      preBtn.disabled = tooBig;
      const minutes = Math.round(expectedPre(n) / hashRate / 60);
      $('#pre-skip').textContent = !tooBig ? ''
        : hashRate ? t('hash.hunt.skip', { n: minutes, bits: n, tries: fmt(expectedPre(n)), minutes: fmt(minutes) })
          : t('hash.hunt.skipUnknown', { bits: n, tries: fmt(expectedPre(n)) });
    }
  }

  function setRunning(kind, stopFn) {
    running = stopFn ? { kind, stop: stopFn } : null;
    preBtn.textContent = t(running?.kind === 'pre' ? 'hash.hunt.stop' : 'hash.hunt.start');
    colBtn.textContent = t(running?.kind === 'col' ? 'hash.hunt.stop' : 'hash.hunt.start');
    preBtn.disabled = Boolean(running && running.kind !== 'pre') || (!running && bits() > PREIMAGE_MAX_BITS);
    colBtn.disabled = Boolean(running && running.kind !== 'col');
    bitsInput.disabled = Boolean(running);
  }

  function logRun(n, kind, tries, expected) {
    $('.hunt-log-wrap').hidden = false;
    logBody.prepend(el('tr', {},
      el('td', { textContent: `${n}` }),
      el('td', { textContent: t(kind === 'pre' ? 'hash.hunt.kindPre' : 'hash.hunt.kindCol') }),
      el('td', { textContent: fmt(tries) }),
      el('td', { textContent: t('hash.hunt.logExpected', { expected: fmt(Math.round(expected)), ratio: fmt(tries / expected, 2) }) })));
  }

  /* Hash in ~30 ms slices, yielding between them so the page stays responsive. */
  async function hunt(kind, btn) {
    if (running?.kind === kind) { running.stop(); return; }
    const n = bits();
    const out = $(`#${kind}-result`);
    const progress = $(`#${kind}-progress`);
    const tag = randomTag();
    const want = prefixBits(target, n);
    const seen = new Map();
    let stopped = false;
    let tries = 0;
    let found = null;
    setRunning(kind, () => { stopped = true; });
    out.textContent = '';
    const t0 = performance.now();

    while (!found && !stopped) {
      const deadline = performance.now() + 30;
      while (!found && performance.now() < deadline) {
        for (let k = 0; k < 512; k++) {
          tries++;
          const input = `${kind === 'pre' ? 'guess' : 'msg'} ${tag}-${tries}`;
          const digest = sha256(utf8(input));
          const p = prefixBits(digest, n);
          if (kind === 'pre') {
            if (p === want) { found = { input, digest }; break; }
          } else {
            const prev = seen.get(p);
            if (prev) { found = { a: { input: prev, digest: sha256(utf8(prev)) }, b: { input, digest } }; break; }
            seen.set(p, input); // keep only the text; re-hash the one we need at the end
          }
        }
      }
      const secs = (performance.now() - t0) / 1000;
      progress.textContent = t('hash.hunt.progress', { n: tries, v: fmt(tries), secs: fmt(secs, 1) });
      await yieldToMain();
    }

    const secs = (performance.now() - t0) / 1000;
    if (secs > 0.2) hashRate = tries / secs;
    const expected = kind === 'pre' ? expectedPre(n) : expectedCol(n);
    progress.textContent = t('hash.hunt.progressDone', { n: tries, v: fmt(tries), secs: fmt(secs, 1) });
    setRunning(kind, null);
    if (!found) {
      out.replaceChildren(el('p', { textContent: t('hash.hunt.stopped', { n: tries, v: fmt(tries) }) }));
      renderSettings();
      return;
    }
    const pairs = kind === 'pre' ? [found] : [found.a, found.b];
    out.replaceChildren(
      el('p', { className: 'hunt-found', textContent: t('hash.hunt.found', { n: tries, v: fmt(tries), ratio: fmt(tries / expected, 2) }) }),
      ...pairs.map((x) => el('p', { className: 'hunt-pair' }, el('code', { textContent: `"${x.input}"` }), ' → ', hashView(x.digest, n))),
    );
    logRun(n, kind, tries, expected);
    renderSettings();
    btn.focus();
  }

  preBtn.addEventListener('click', () => hunt('pre', preBtn));
  colBtn.addEventListener('click', () => hunt('col', colBtn));
  bitsInput.addEventListener('input', renderSettings);
  renderSettings();
}

/* ============================== Module 2: commit & reveal ============================== */

export function initCommitDemo() {
  const msg = $('#commit-msg');
  const useSalt = $('#commit-use-salt');
  const saltOut = $('#commit-salt');
  const hashOut = $('#commit-hash');
  const revealBtn = $('#commit-reveal');
  const crackBtn = $('#commit-crack');
  const verdict = $('#commit-verdict');

  const COMMON = ['Heads', 'Tails', 'Yes', 'No', 'True', 'False', 'Rock', 'Paper', 'Scissors', 'Win', 'Lose', 'Draw',
    'Up', 'Down', 'Red', 'Black', 'Rain', 'Sun', 'Snow', 'A', 'B', 'C', 'D', 'Alice', 'Bob', 'Carol'];
  const newSalt = () => bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  let salt = newSalt();
  let published = null;

  const commit = (text, s) => sha256(utf8(s ? `${text}|${s}` : text));
  const same = (a, b) => a.every((byte, i) => byte === b[i]);

  const renderSalt = () => {
    saltOut.textContent = useSalt.checked ? t('hash.commit.salt', { salt }) : t('hash.commit.noSalt');
  };

  $('#commit-seal').addEventListener('click', () => {
    salt = newSalt();
    renderSalt();
    published = { digest: commit(msg.value, useSalt.checked ? salt : null), salt: useSalt.checked ? salt : null };
    hashOut.textContent = bytesToHex(published.digest);
    revealBtn.disabled = false;
    crackBtn.disabled = false;
    verdict.className = 'verdict neutral';
    verdict.textContent = t('hash.commit.published');
  });

  revealBtn.addEventListener('click', () => {
    const ok = same(commit(msg.value, published.salt), published.digest);
    verdict.className = `verdict ${ok ? 'ok' : 'bad'}`;
    verdict.textContent = ok
      ? t(published.salt ? 'hash.commit.openedSalt' : 'hash.commit.opened', { msg: msg.value })
      : t('hash.commit.mismatch', { msg: msg.value });
  });

  crackBtn.addEventListener('click', async () => {
    crackBtn.disabled = true;
    verdict.className = 'verdict neutral';
    verdict.textContent = t('hash.commit.snoop');
    const guesses = [...COMMON, ...COMMON.map((w) => w.toLowerCase())];
    for (let i = 0; i <= 99_999; i++) guesses.push(String(i));
    let hit = null;
    let deadline = performance.now() + 30;
    for (const [i, g] of guesses.entries()) {
      if (same(commit(g, null), published.digest)) { hit = { g, tries: i + 1 }; break; }
      if (performance.now() > deadline) { await yieldToMain(); deadline = performance.now() + 30; }
    }
    crackBtn.disabled = false;
    if (hit) {
      verdict.className = 'verdict bad';
      verdict.textContent = t('hash.commit.cracked', { n: hit.tries, v: fmt(hit.tries), guess: hit.g });
    } else if (published.salt) {
      verdict.className = 'verdict ok';
      verdict.textContent = t('hash.commit.resisted', { n: guesses.length, v: fmt(guesses.length) });
    } else {
      verdict.className = 'verdict warn';
      verdict.textContent = t('hash.commit.lucky', { n: guesses.length, v: fmt(guesses.length) });
    }
  });

  useSalt.addEventListener('change', renderSalt);
  renderSalt();
}
