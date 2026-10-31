import { $, el, fmt, fmtCompact, fmtDuration, locale, sha256Hex, yieldToMain } from '../core/dom.js';
import { t, tNodes } from '../core/i18n.js';
import { REAL_BLOCKS } from '../data/bitcoin-blocks.js';
import { HEADER_LAYOUT, parseHeader, serializeHeader } from '../lib/bitcoin-header.js';
import { bitsToTarget, difficultyFromTarget } from '../lib/chain-math.js';
import { bytesToHex, reverseBytes } from '../lib/bytes.js';
import { sha256, sha256FromMidstate, sha256Midstate } from '../lib/sha256.js';

/* ============================== Module 3: blockchain demo ============================== */

const CHAIN_DIFFICULTY = '00';
const GENESIS_PREV = '0'.repeat(64);

export function initChainDemo() {
  const container = $('#chain-demo');
  const chain = [
    'Alice → Bob: 5 BTC',
    'Bob → Carol: 2 BTC',
    'Carol → Dan: 1 BTC',
    'Dan → Erin: 4 BTC',
  ].map((data, index) => ({ index, data, nonce: 0, prevHash: '', hash: '', valid: false }));

  const blockHash = (block) =>
    sha256Hex(`${block.index}|${block.prevHash}|${block.data}|${block.nonce}`);

  /* Build the DOM once; inputs are never re-rendered so typing focus is preserved. */
  const cards = chain.map((block, i) => {
    const card = document.createElement('article');
    card.className = 'block';

    const title = document.createElement('h3');
    title.textContent = t(i === 0 ? 'blocks.titleGenesis' : 'blocks.title', { n: i });
    const chip = document.createElement('span');
    chip.className = 'status-chip';
    title.append(chip);

    const dataLabel = document.createElement('label');
    dataLabel.className = 'block-field';
    dataLabel.textContent = t('blocks.data');
    dataLabel.htmlFor = `block-data-${i}`;
    const dataInput = document.createElement('input');
    dataInput.type = 'text';
    dataInput.id = `block-data-${i}`;
    dataInput.value = block.data;
    dataInput.spellcheck = false;

    const prevLabel = document.createElement('p');
    prevLabel.className = 'block-field';
    prevLabel.textContent = t('blocks.prev');
    const prevHash = document.createElement('p');
    prevHash.className = 'block-hash';

    const nonceLabel = document.createElement('p');
    nonceLabel.className = 'block-field';
    nonceLabel.textContent = t('blocks.nonce');
    const nonce = document.createElement('p');
    nonce.className = 'block-hash';

    const hashLabel = document.createElement('p');
    hashLabel.className = 'block-field';
    hashLabel.textContent = t('blocks.hash');
    const hash = document.createElement('p');
    hash.className = 'block-hash';

    const mineBtn = document.createElement('button');
    mineBtn.type = 'button';
    mineBtn.className = 'btn primary';
    mineBtn.textContent = t('blocks.mine');

    card.append(title, dataLabel, dataInput, prevLabel, prevHash, nonceLabel, nonce, hashLabel, hash, mineBtn);

    if (i > 0) {
      const link = document.createElement('span');
      link.className = 'chain-link';
      link.textContent = '→';
      link.setAttribute('aria-hidden', 'true');
      container.append(link);
    }
    container.append(card);

    dataInput.addEventListener('input', async () => {
      chain[i].data = dataInput.value;
      await recompute();
    });
    mineBtn.addEventListener('click', () => mineBlock(i));

    return { card, chip, prevHash, nonce, hash, mineBtn };
  });

  let version = 0;

  function render() {
    chain.forEach((block, i) => {
      const ui = cards[i];
      ui.card.classList.toggle('invalid', !block.valid);
      ui.chip.textContent = t(block.valid ? 'blocks.valid' : 'blocks.invalid');
      ui.prevHash.textContent = block.prevHash;
      ui.prevHash.title = block.prevHash;
      ui.nonce.textContent = String(block.nonce);
      ui.hash.textContent = block.hash;
      ui.hash.title = block.hash;
      ui.mineBtn.hidden = block.valid;
    });
  }

  async function recompute() {
    const current = ++version;
    let prev = GENESIS_PREV;
    for (const block of chain) {
      block.prevHash = prev;
      block.hash = await blockHash(block);
      block.valid = block.hash.startsWith(CHAIN_DIFFICULTY);
      prev = block.hash;
    }
    if (current === version) render();
  }

  async function mineBlock(i) {
    const block = chain[i];
    cards[i].mineBtn.disabled = true;
    block.nonce = 0;
    do {
      block.nonce++;
      block.hash = await blockHash(block);
    } while (!block.hash.startsWith(CHAIN_DIFFICULTY));
    cards[i].mineBtn.disabled = false;
    await recompute();
  }

  (async () => {
    /* Mine the whole chain once at load so it starts in a valid state. */
    let prev = GENESIS_PREV;
    for (const block of chain) {
      block.prevHash = prev;
      do {
        block.nonce++;
        block.hash = await blockHash(block);
      } while (!block.hash.startsWith(CHAIN_DIFFICULTY));
      block.valid = true;
      prev = block.hash;
    }
    render();
  })();
}

/* ============================== Module 3: hash a real Bitcoin header ============================== */

const leadingZeroBits = (hex) => {
  let bits = 0;
  for (const ch of hex) {
    const v = parseInt(ch, 16);
    if (v === 0) { bits += 4; continue; }
    return bits + Math.clz32(v) - 28;
  }
  return bits;
};

/* Highlight a hash's leading zeros — the visible side of "below the target". */
function zeroHighlighted(hex) {
  const zeros = hex.match(/^0*/)[0];
  return el('code', { className: 'hash-inline' }, el('mark', { className: 'zeros', textContent: zeros }), hex.slice(zeros.length));
}

export function initHeaderDemo() {
  const SEARCH_WINDOW = 1_500_000;
  const select = $('#hdr-block');
  const fieldsEl = $('#hdr-fields');
  const bytesEl = $('#hdr-bytes');
  const stepsEl = $('#hdr-steps');
  const verdict = $('#hdr-verdict');
  const searchBtn = $('#hdr-search');
  const status = $('#hdr-search-status');

  let fields = null;
  let realNonce = 0;
  let search = null; // { stop: boolean } while a search runs

  const nonceInput = el('input', { type: 'number', id: 'hdr-nonce', min: 0, max: 4294967295, step: 1, className: 'nonce-input' });
  const nudge = (delta, label) => {
    const b = el('button', { type: 'button', className: 'btn ghost', textContent: label, 'aria-label': t(delta > 0 ? 'hdr.nonceAdd' : 'hdr.nonceSub') });
    b.addEventListener('click', () => setNonce(fields.nonce + delta));
    return b;
  };
  const nonceControls = el('span', { className: 'nonce-controls' }, nonceInput, nudge(-1, '−1'), nudge(1, '+1'));

  select.replaceChildren(...REAL_BLOCKS.map((b, i) => el('option', { value: String(i), textContent: t(`btc.block.${b.height}.label`) })));

  function setNonce(n) {
    if (!Number.isFinite(n)) return;
    fields.nonce = Math.min(0xffffffff, Math.max(0, Math.trunc(n)));
    nonceInput.value = String(fields.nonce);
    renderHash();
  }

  function renderBlock() {
    const block = REAL_BLOCKS[Number(select.value)];
    fields = parseHeader(block.header);
    realNonce = fields.nonce;
    $('#hdr-note').textContent = t(`btc.block.${block.height}.note`);
    const difficulty = difficultyFromTarget(bitsToTarget(fields.bits));
    const row = (term, ...value) => [el('dt', {}, term), el('dd', {}, ...value)];
    fieldsEl.replaceChildren(
      ...row(t('hdr.version'), t('hdr.versionValue', { v: fields.version, hex: fields.version.toString(16).padStart(8, '0') })),
      ...row(t('hdr.prev'), el('code', { className: 'hash-inline', textContent: fields.prevHash })),
      ...row(t('hdr.merkle'), el('code', { className: 'hash-inline', textContent: fields.merkleRoot })),
      ...row(t('hdr.time'), t('hdr.timeValue', {
        unix: fields.time,
        date: `${new Date(fields.time * 1000).toLocaleString(locale(), { timeZone: 'UTC', dateStyle: 'full', timeStyle: 'medium' })} UTC`,
      })),
      ...row(t('hdr.bits'), t('hdr.bitsValue', {
        hex: fields.bits.toString(16).padStart(8, '0'),
        difficulty: difficulty < 1e6 ? fmt(difficulty, difficulty < 10 ? 2 : 0) : fmtCompact(difficulty),
      })),
      ...row(el('label', { htmlFor: 'hdr-nonce', textContent: t('blocks.nonce') }), nonceControls),
    );
    nonceInput.value = String(fields.nonce);
    status.textContent = '';
    renderHash();
  }

  function renderHash() {
    const bytes = serializeHeader(fields);
    const hex = bytesToHex(bytes);
    bytesEl.replaceChildren(...HEADER_LAYOUT.map((f) => el('span', { className: `hb-field hb-${f.key}` },
      el('span', { className: 'hb-label', textContent: `${t(`hdr.field.${f.key}`)} · ${f.end - f.start} B` }),
      el('span', { className: 'hb-hex', textContent: hex.slice(f.start * 2, f.end * 2) }))));

    const h1 = sha256(bytes);
    const h2 = sha256(h1);
    const display = bytesToHex(reverseBytes(h2));
    const target = bitsToTarget(fields.bits);
    const targetHex = target.toString(16).padStart(64, '0');
    stepsEl.replaceChildren(
      el('li', {}, ...tNodes('hdr.step1', { hash: el('code', { className: 'hash-inline', textContent: bytesToHex(h1) }) })),
      el('li', {}, ...tNodes('hdr.step2', { hash: el('code', { className: 'hash-inline', textContent: bytesToHex(h2) }) })),
      el('li', {}, ...tNodes('hdr.step3', { hash: zeroHighlighted(display) })),
      el('li', {}, ...tNodes('hdr.step4', { hash: zeroHighlighted(targetHex) })),
    );

    const ok = BigInt(`0x${display}`) <= target;
    const hashZeros = leadingZeroBits(display);
    const needZeros = leadingZeroBits(targetHex);
    verdict.className = `verdict ${ok ? 'ok' : 'bad'}`;
    const matches = display === REAL_BLOCKS[Number(select.value)].hash;
    verdict.textContent = ok
      ? t(matches ? 'hdr.validMatch' : 'hdr.valid', { zeros: hashZeros, need: needZeros })
      : t('hdr.invalid', { zeros: hashZeros, need: needZeros });
  }

  async function runSearch() {
    if (search) { search.stop = true; return; }
    const start = Math.max(0, realNonce - SEARCH_WINDOW);
    const bytes = serializeHeader({ ...fields, nonce: start });
    const mid = sha256Midstate(bytes.subarray(0, 64)); // first 64 bytes never change
    const tail = bytes.slice(64); // time, bits, nonce (+ padding added inside)
    const target = bitsToTarget(fields.bits);
    const height = REAL_BLOCKS[Number(select.value)].height;
    search = { stop: false };
    searchBtn.textContent = t('hdr.stop');
    select.disabled = true;

    let nonce = start;
    let found = null;
    const t0 = performance.now();
    while (found === null && !search.stop && nonce <= 0xffffffff) {
      const deadline = performance.now() + 30;
      while (found === null && nonce <= 0xffffffff && performance.now() < deadline) {
        for (let k = 0; k < 256 && nonce <= 0xffffffff; k++, nonce++) {
          tail[12] = nonce & 0xff; tail[13] = (nonce >>> 8) & 0xff; tail[14] = (nonce >>> 16) & 0xff; tail[15] = nonce >>> 24;
          const h = sha256(sha256FromMidstate(mid, tail));
          // Every real target has ≥ 32 leading zero bits: cheap byte test first, exact compare after.
          if (h[31] === 0 && h[30] === 0 && h[29] === 0 && h[28] === 0
            && BigInt(`0x${bytesToHex(reverseBytes(h))}`) <= target) { found = nonce; break; }
        }
      }
      const secs = (performance.now() - t0) / 1000;
      status.textContent = t('hdr.trying', { nonce: fmt(nonce), tried: fmt(nonce - start), rate: fmt((nonce - start) / Math.max(secs, 0.001)) });
      await yieldToMain();
    }

    const secs = (performance.now() - t0) / 1000;
    const rate = (nonce - start) / Math.max(secs, 0.001);
    search = null;
    searchBtn.textContent = t('hdr.remine');
    select.disabled = false;
    if (found === null) {
      status.textContent = t('hdr.stopped', { n: nonce - start, nonce: fmt(nonce), tried: fmt(nonce - start) });
      return;
    }
    setNonce(found);
    const expected = difficultyFromTarget(target) * 2 ** 32;
    status.textContent = t('hdr.found', {
      n: found - start + 1,
      nonce: fmt(found),
      tries: fmt(found - start + 1),
      secs: fmt(secs, 1),
      rate: fmt(rate),
      height: fmt(height),
      expected: fmtCompact(expected),
      duration: fmtDuration(expected / rate),
    });
  }

  select.addEventListener('change', renderBlock);
  nonceInput.addEventListener('input', () => {
    const n = Number(nonceInput.value);
    if (nonceInput.value !== '' && Number.isFinite(n)) {
      fields.nonce = Math.min(0xffffffff, Math.max(0, Math.trunc(n)));
      renderHash();
    }
  });
  searchBtn.addEventListener('click', runSearch);
  $('#hdr-restore').addEventListener('click', () => setNonce(realNonce));
  renderBlock();
}
