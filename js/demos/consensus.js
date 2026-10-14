import { $, el, fmt, fmtCompact } from '../core/dom.js';
import { createChart } from '../core/chart.js';
import { bytesToHex } from '../lib/bytes.js';
import { exactAttackProbability, satoshiAttackProbability, simulateAttack } from '../lib/chain-math.js';

/* ============================== Module 6: proof-of-stake picker ============================== */

export function initStakeDemo() {
  const validators = [
    { id: 'v1', name: 'Ava' },
    { id: 'v2', name: 'Ben' },
    { id: 'v3', name: 'Cara' },
  ];
  const wins = new Map(validators.map((v) => [v.id, 0]));
  const summary = $('#stake-summary');
  const slashed = new Set();

  const stakeOf = (v) => (slashed.has(v.id) ? 0 : Number($(`#stake-${v.id}`).value));
  const totalPicks = () => [...wins.values()].reduce((a, b) => a + b, 0);

  function render(winnerId = null) {
    const totalStake = validators.reduce((sum, v) => sum + stakeOf(v), 0);
    const picks = totalPicks();

    validators.forEach((v) => {
      $(`#stake-out-${v.id}`).textContent = slashed.has(v.id)
        ? 'slashed — stake burned, ejected'
        : `${stakeOf(v)} coins (${Math.round((stakeOf(v) / totalStake) * 100)}%)`;
      $(`#stake-${v.id}`).disabled = slashed.has(v.id);
      $(`#val-${v.id}`).classList.toggle('slashed', slashed.has(v.id));
      const won = wins.get(v.id);
      const share = picks ? Math.round((won / picks) * 100) : 0;
      $(`#win-fill-${v.id}`).style.inlineSize = `${share}%`;
      $(`#win-text-${v.id}`).textContent = picks
        ? `won ${won} of ${picks} blocks (${share}%)`
        : 'no rounds yet';
      $(`#val-${v.id}`).classList.toggle('winner', v.id === winnerId);
    });

    summary.textContent = slashed.size
      ? `✂️ Ben was slashed for signing two conflicting blocks. He can no longer be chosen; ${picks} block${picks === 1 ? '' : 's'} proposed so far.`
      : picks
        ? `${picks} block${picks > 1 ? 's' : ''} proposed so far — compare each win share to the stake share.`
        : '';
  }

  function pickOne() {
    const totalStake = validators.reduce((sum, v) => sum + stakeOf(v), 0);
    let r = Math.random() * totalStake;
    for (const v of validators) {
      r -= stakeOf(v);
      if (r < 0) return v.id;
    }
    return validators.at(-1).id;
  }

  validators.forEach((v) => {
    $(`#stake-${v.id}`).addEventListener('input', () => render());
  });

  $('#stake-pick').addEventListener('click', () => {
    const winner = pickOne();
    wins.set(winner, wins.get(winner) + 1);
    render(winner);
  });

  $('#stake-run').addEventListener('click', () => {
    for (let i = 0; i < 100; i++) {
      const winner = pickOne();
      wins.set(winner, wins.get(winner) + 1);
    }
    render();
  });

  $('#stake-slash').addEventListener('click', () => {
    slashed.add('v2');
    $('#stake-slash').disabled = true;
    render();
  });

  $('#stake-reset').addEventListener('click', () => {
    validators.forEach((v) => wins.set(v.id, 0));
    slashed.clear();
    $('#stake-slash').disabled = false;
    render();
  });

  render();
}

/* ============================== Module 6: fee-market block builder ============================== */

export function initFeeMarketDemo() {
  const BLOCK_LIMIT = 1000; // vBytes
  /* fee in sats, size in vBytes. #9aa pays the biggest *total* fee but a mediocre rate — the trap. */
  const TXS = [
    { id: 'tx-c52', fee: 12000, size: 150 },
    { id: 'tx-9aa', fee: 21000, size: 350 },
    { id: 'tx-7e1', fee: 9000, size: 180 },
    { id: 'tx-6d0', fee: 6600, size: 220 },
    { id: 'tx-3b9', fee: 5000, size: 250 },
    { id: 'tx-a04', fee: 4000, size: 400 },
    { id: 'tx-1f8', fee: 3000, size: 300 },
  ];

  const pool = $('#fm-pool');
  const block = $('#fm-block');
  const capFill = $('#fm-cap-fill');
  const verdict = $('#fm-verdict');

  let placement = new Map(TXS.map((t) => [t.id, 'pool'])); // id -> 'pool' | 'block'

  const txById = (id) => TXS.find((t) => t.id === id);
  const rate = (t) => t.fee / t.size;
  const byRate = (a, b) => rate(b) - rate(a);
  const inBlock = () => TXS.filter((t) => placement.get(t.id) === 'block');
  const usedSpace = () => inBlock().reduce((s, t) => s + t.size, 0);
  const totalFees = () => inBlock().reduce((s, t) => s + t.fee, 0);

  /* The strategy real miners use: greedily take the best fee-rate txs that still fit.
     For this dataset that also happens to be the true fee-maximizing block. */
  function bestFees() {
    let space = BLOCK_LIMIT;
    let fees = 0;
    for (const t of [...TXS].sort(byRate)) {
      if (t.size <= space) { space -= t.size; fees += t.fee; }
    }
    return fees;
  }

  function makeChip(t) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tx-chip';
    btn.dataset.id = t.id;

    const id = document.createElement('span');
    id.className = 'tx-id';
    id.textContent = t.id;

    const meta = document.createElement('span');
    meta.className = 'tx-meta';
    meta.textContent = `${t.fee.toLocaleString()} sat · ${t.size} vB`;

    const r = document.createElement('span');
    r.className = 'tx-rate';
    r.append(`${rate(t).toFixed(0)}`, Object.assign(document.createElement('small'), { textContent: 'sat/vB' }));

    // The visible text stays the start of the accessible name (so voice control can target it);
    // the action hint is extra, screen-reader-only text.
    const hint = document.createElement('span');
    hint.className = 'visually-hidden';
    hint.textContent = placement.get(t.id) === 'block' ? ' — in your block; activate to remove' : ' — in the mempool; activate to add';

    btn.append(id, meta, r, hint);
    btn.addEventListener('click', () => {
      if (btn._dragged) { btn._dragged = false; return; } // swallow the click synthesized after a drag
      toggle(t.id);
    });
    btn.addEventListener('pointerdown', (e) => startDrag(e, t, btn));

    li.append(btn);
    return li;
  }

  function flashTooBig(id) {
    const chip = pool.querySelector(`[data-id="${id}"]`);
    if (!chip) return;
    chip.classList.remove('too-big');
    void chip.offsetWidth; // restart the shake animation
    chip.classList.add('too-big');
  }

  function addToBlock(id) {
    if (placement.get(id) !== 'pool') return false;
    const t = txById(id);
    if (usedSpace() + t.size > BLOCK_LIMIT) {
      flashTooBig(id);
      verdict.textContent = `⛔ ${id} (${t.size} vB) doesn’t fit — only ${(BLOCK_LIMIT - usedSpace()).toLocaleString()} vB left in the block.`;
      return false;
    }
    placement.set(id, 'block');
    return true;
  }

  function removeFromBlock(id) {
    if (placement.get(id) !== 'block') return false;
    placement.set(id, 'pool');
    return true;
  }

  function toggle(id) {
    const moved = placement.get(id) === 'block' ? removeFromBlock(id) : addToBlock(id);
    if (moved) { render(); showStanding(); }
  }

  function showStanding() {
    const mine = totalFees();
    if (mine === 0) { verdict.textContent = ''; return; }
    const best = bestFees();
    verdict.textContent = mine >= best
      ? `🏆 ${mine.toLocaleString()} sat — that’s the fee-maximizing block. No selection of these transactions pays more.`
      : `${mine.toLocaleString()} sat collected. A miner optimizing fee rate earns ${best.toLocaleString()} sat — swap a bulky transaction for a higher-rate one.`;
  }

  function render() {
    const poolTxs = TXS.filter((t) => placement.get(t.id) === 'pool').sort(byRate);
    const blockTxs = inBlock().sort(byRate);
    pool.replaceChildren(...poolTxs.map(makeChip));
    block.replaceChildren(...blockTxs.map(makeChip));

    const used = usedSpace();
    capFill.style.inlineSize = `${(used / BLOCK_LIMIT) * 100}%`;
    capFill.classList.toggle('full', used >= BLOCK_LIMIT);

    $('#fm-pool-sub').textContent = `${poolTxs.length} waiting`;
    $('#fm-space').textContent = `${used.toLocaleString()} / ${BLOCK_LIMIT.toLocaleString()} vB`;
    $('#fm-count').textContent = String(blockTxs.length);
    $('#fm-fees').textContent = `${totalFees().toLocaleString()} sat`;
  }

  /* Pointer-based drag — one path for mouse, pen and touch, because native HTML5
     drag-and-drop never fires on touchscreens. A press that doesn't move past a
     small threshold falls through to the click handler, which toggles the tx. */
  let dragActive = false;

  function listUnder(x, y) {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest('#fm-pool, #fm-block') : null;
  }

  function moveGhost(ghost, x, y) {
    ghost.style.transform = `translate(${x - Number(ghost.dataset.offX)}px, ${y - Number(ghost.dataset.offY)}px)`;
  }

  function makeGhost(btn, x, y) {
    const rect = btn.getBoundingClientRect();
    const ghost = btn.cloneNode(true);
    ghost.classList.add('tx-ghost');
    ghost.classList.remove('dragging');
    ghost.setAttribute('aria-hidden', 'true'); // a purely visual stand-in while dragging
    ghost.tabIndex = -1;
    ghost.style.inlineSize = `${rect.width}px`;
    ghost.dataset.offX = String(x - rect.left);
    ghost.dataset.offY = String(y - rect.top);
    moveGhost(ghost, x, y);
    document.body.append(ghost);
    return ghost;
  }

  function startDrag(e, t, btn) {
    if (e.pointerType === 'mouse' && e.button !== 0) return; // primary button only
    if (dragActive) return;                                  // ignore a second finger mid-drag

    const originListId = placement.get(t.id) === 'block' ? 'fm-block' : 'fm-pool';
    const startX = e.clientX;
    const startY = e.clientY;
    let started = false;
    let ghost = null;
    let overList = null;
    btn._dragged = false;

    const setOver = (list) => {
      if (list === overList) return;
      overList?.classList.remove('drop-target');
      if (list && list.id !== originListId) list.classList.add('drop-target'); // invite a drop on the other list only
      overList = list;
    };

    const onMove = (ev) => {
      if (!started) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
        started = true;
        dragActive = true;
        btn._dragged = true;
        ghost = makeGhost(btn, ev.clientX, ev.clientY); // clone before fading the original
        btn.classList.add('dragging');
      }
      ev.preventDefault();
      moveGhost(ghost, ev.clientX, ev.clientY);
      setOver(listUnder(ev.clientX, ev.clientY));
    };

    const onUp = (ev) => {
      const dropList = started ? listUnder(ev.clientX, ev.clientY) : null;
      cleanup();
      if (!started) return; // a tap — let the click handler toggle
      if (dropList) {
        const moved = dropList.id === 'fm-block' ? addToBlock(t.id) : removeFromBlock(t.id);
        if (moved) { render(); showStanding(); }
      }
    };

    const cleanup = () => {
      dragActive = false;
      setOver(null);
      ghost?.remove();
      btn.classList.remove('dragging');
      try { btn.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      btn.removeEventListener('pointermove', onMove);
      btn.removeEventListener('pointerup', onUp);
      btn.removeEventListener('pointercancel', cleanup);
    };

    try { btn.setPointerCapture(e.pointerId); } catch { /* capture unsupported — drag still works */ }
    btn.addEventListener('pointermove', onMove);
    btn.addEventListener('pointerup', onUp);
    btn.addEventListener('pointercancel', cleanup);
  }

  $('#fm-mine').addEventListener('click', () => {
    placement = new Map(TXS.map((t) => [t.id, 'pool']));
    let space = BLOCK_LIMIT;
    for (const t of [...TXS].sort(byRate)) {
      if (t.size <= space) { placement.set(t.id, 'block'); space -= t.size; }
    }
    render();
    verdict.textContent = `🤖 The miner took the highest fee-rate transactions that fit: ${totalFees().toLocaleString()} sat in ${usedSpace().toLocaleString()} vB. That’s the strategy real miners use.`;
  });

  $('#fm-clear').addEventListener('click', () => {
    placement = new Map(TXS.map((t) => [t.id, 'pool']));
    verdict.textContent = '';
    render();
  });

  render();
}

/* ============================== Module 6: UTXO wallet ============================== */

export function initUtxoDemo() {
  const SATS = 100_000_000;
  const DUST = 546; // outputs smaller than this cost more to spend than they're worth
  const INITIAL = [
    { id: 'a1f3…e2:0', owner: 'Alice', sats: 5_000_000 },
    { id: '7c22…9b:1', owner: 'Alice', sats: 20_000_000 },
    { id: 'e4b9…41:0', owner: 'Alice', sats: 12_000_000 },
    { id: '3d8a…07:2', owner: 'Alice', sats: 1_500_000 },
    { id: '91ce…5a:0', owner: 'Carol', sats: 40_000_000 },
  ];
  const list = $('#utxo-list');
  const payInput = $('#utxo-pay');
  const rateInput = $('#utxo-rate');
  const changeBox = $('#utxo-change');
  const preview = $('#utxo-tx');
  const verdict = $('#utxo-verdict');
  const sendBtn = $('#utxo-send');
  const replayBtn = $('#utxo-replay');
  let utxos = [];
  let selected = new Set();
  let lastTx = null;
  let fresh = new Set(); // coins created by the latest transaction

  const btc = (sats) => `${(sats / SATS).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })} BTC`;
  const newTxid = () => {
    const h = bytesToHex(crypto.getRandomValues(new Uint8Array(3)));
    return `${h.slice(0, 4)}…${h.slice(4)}`;
  };
  const vsizeFor = (inputs, outputs) => 11 + 68 * inputs + 31 * outputs;
  const aliceCoins = () => utxos.filter((u) => u.owner === 'Alice');

  /* Build the transaction the current choices describe, and judge it. */
  function draft() {
    const inputs = utxos.filter((u) => selected.has(u.id));
    const inTotal = inputs.reduce((sum, u) => sum + u.sats, 0);
    const pay = Math.round(Number(payInput.value) * SATS);
    const rate = Math.max(1, Number(rateInput.value) || 1);
    const tx = { inputs, inTotal, pay, change: 0, fee: 0, ok: false, warn: false, message: '' };
    if (!inputs.length) { tx.message = 'Tick at least one coin to spend.'; return tx; }
    if (!(pay > 0)) { tx.message = '✗ The payment must be more than zero.'; return tx; }

    if (changeBox.checked) {
      tx.vsize = vsizeFor(inputs.length, 2);
      tx.fee = rate * tx.vsize;
      tx.change = inTotal - pay - tx.fee;
      if (tx.change < 0) {
        tx.message = `✗ Not enough: the inputs hold ${btc(inTotal)}, but the payment plus a ${fmt(tx.fee)}-sat fee needs ${btc(pay + tx.fee)}. Tick more coins.`;
        return tx;
      }
      if (tx.change < DUST) {
        tx.fee += tx.change; // a dust-sized change output isn't worth creating
        tx.change = 0;
        tx.vsize = vsizeFor(inputs.length, 1);
        tx.note = ` The change would be below the ${DUST}-sat dust limit, so it is added to the fee.`;
      }
    } else {
      tx.vsize = vsizeFor(inputs.length, 1);
      tx.fee = inTotal - pay;
      if (tx.fee < 0) {
        tx.message = `✗ Not enough: the inputs hold ${btc(inTotal)}, less than the ${btc(pay)} payment. Tick more coins.`;
        return tx;
      }
    }
    tx.ok = true;
    const normalFee = rate * tx.vsize;
    tx.warn = tx.fee > normalFee * 10;
    tx.message = tx.warn
      ? `⚠️ Valid, but look at the fee: with no change output, the whole leftover — ${btc(tx.fee)} — goes to the miner. That’s ${fmt(tx.fee / normalFee)}× a normal fee.`
      : `✓ Valid: ${inputs.length} coin${inputs.length > 1 ? 's' : ''} in (${btc(inTotal)}) = ${btc(pay)} to Bob${tx.change ? ` + ${btc(tx.change)} change` : ''} + a ${fmt(tx.fee)}-sat fee (${(tx.fee / tx.vsize).toFixed(1)} sat/vB).${tx.note ?? ''}`;
    return tx;
  }

  function renderPreview(tx) {
    const row = (label, amount, cls = '') => el('li', { className: cls }, el('span', { textContent: label }), el('strong', { textContent: amount }));
    preview.replaceChildren(
      el('ul', { className: 'tx-ins', 'aria-label': 'Inputs' },
        ...(tx.inputs.length ? tx.inputs.map((u) => row(u.id, btc(u.sats))) : [row('no inputs yet', '–')])),
      el('span', { className: 'tx-arrow', 'aria-hidden': 'true', textContent: '→' }),
      el('ul', { className: 'tx-outs', 'aria-label': 'Outputs' },
        row('Bob', btc(Math.max(0, tx.pay))),
        tx.change > 0 ? row('Alice (change)', btc(tx.change)) : null,
        row('Fee → miner', tx.ok ? btc(tx.fee) : '–', tx.warn ? 'is-warn' : 'is-fee')),
    );
  }

  function render() {
    const mine = aliceCoins();
    const balance = mine.reduce((sum, u) => sum + u.sats, 0);
    list.replaceChildren(
      el('p', { className: 'stat-line', textContent: `Balance (sum of her coins): ${btc(balance)}` }),
      ...mine.map((u) => {
        const box = el('input', { type: 'checkbox', value: u.id, checked: selected.has(u.id) });
        box.addEventListener('change', () => {
          if (box.checked) selected.add(u.id);
          else selected.delete(u.id);
          update();
        });
        return el('label', { className: 'utxo-coin' }, box, el('code', { textContent: u.id }), el('strong', { textContent: btc(u.sats) }));
      }),
    );
    $('#utxo-set').replaceChildren(...utxos.map((u) => el('tr', { className: fresh.has(u.id) ? 'is-new' : '' },
      el('td', {}, el('code', { textContent: u.id })),
      el('td', { textContent: u.owner }),
      el('td', { textContent: btc(u.sats) }))));
    update();
  }

  function update() {
    const tx = draft();
    renderPreview(tx);
    verdict.className = `verdict ${!tx.inputs.length ? 'neutral' : tx.ok ? (tx.warn ? 'warn' : 'ok') : 'bad'}`;
    verdict.textContent = tx.message;
    sendBtn.disabled = !tx.ok;
  }

  $('#utxo-auto').addEventListener('click', () => {
    // Largest-first coin selection: add coins until payment + fee is covered.
    const pay = Math.round(Number(payInput.value) * SATS);
    const rate = Math.max(1, Number(rateInput.value) || 1);
    selected = new Set();
    let total = 0;
    for (const u of [...aliceCoins()].sort((a, b) => b.sats - a.sats)) {
      if (total >= pay + rate * vsizeFor(selected.size, 2)) break;
      selected.add(u.id);
      total += u.sats;
    }
    changeBox.checked = true;
    render();
  });

  sendBtn.addEventListener('click', () => {
    const tx = draft();
    if (!tx.ok) return;
    const txid = newTxid();
    const spent = tx.inputs.map((u) => u.id);
    utxos = utxos.filter((u) => !selected.has(u.id));
    const outputs = [{ id: `${txid}:0`, owner: 'Bob', sats: tx.pay }];
    if (tx.change > 0) outputs.push({ id: `${txid}:1`, owner: 'Alice', sats: tx.change });
    utxos.push(...outputs);
    fresh = new Set(outputs.map((o) => o.id));
    lastTx = { txid, spent };
    selected = new Set();
    render();
    verdict.className = 'verdict ok';
    verdict.textContent = `✅ Confirmed in tx ${txid}: ${spent.length} coin${spent.length > 1 ? 's' : ''} destroyed, ${outputs.length} created, ${btc(tx.fee)} to the miner. The spent coins are gone from the UTXO set.`;
    replayBtn.disabled = false;
  });

  replayBtn.addEventListener('click', () => {
    verdict.className = 'verdict bad';
    verdict.textContent = `✗ Rejected by every node: coin ${lastTx.spent[0]} was already spent in tx ${lastTx.txid}. It no longer exists in the UTXO set, so there is nothing left to spend — no double-spend.`;
  });

  $('#utxo-reset').addEventListener('click', () => {
    utxos = INITIAL.map((u) => ({ ...u }));
    selected = new Set();
    fresh = new Set();
    lastTx = null;
    replayBtn.disabled = true;
    changeBox.checked = true;
    render();
  });

  [payInput, rateInput].forEach((i) => i.addEventListener('input', update));
  changeBox.addEventListener('change', update);
  utxos = INITIAL.map((u) => ({ ...u }));
  render();
}

/* ============================== Module 6: confirmations race ============================== */

const fmtProb = (p) => (p >= 0.9995 ? '≈ 100%'
  : p >= 0.1 ? `${(p * 100).toFixed(0)}%`
    : p >= 0.01 ? `${(p * 100).toFixed(1)}%`
      : p >= 1e-4 ? `${(p * 100).toFixed(3)}%`
        : p > 0 ? `1 in ${fmtCompact(1 / p)}` : '0');

export function initRaceDemo() {
  const FLOOR = 1e-8; // the log axis stops here
  const qInput = $('#race-q');
  const zInput = $('#race-z');
  const verdict = $('#race-verdict');
  const zs = Array.from({ length: 13 }, (_, z) => z);
  let chart = null;

  const confirmationsNeeded = (q) => {
    if (q >= 0.5) return null;
    for (let z = 0; z < 5000; z++) if (exactAttackProbability(q, z) < 0.001) return z;
    return null;
  };

  function update() {
    const q = Number(qInput.value) / 100;
    const z = Number(zInput.value);
    const exact = exactAttackProbability(q, z);
    const satoshi = satoshiAttackProbability(q, z);
    const needed = confirmationsNeeded(q);
    const hours = (n) => (n * 10 >= 120 ? `~${fmt(n / 6)} hours` : `~${n * 10} minutes`);

    $('#race-q-out').textContent = `${qInput.value}%`;
    $('#race-z-out').textContent = z === 0 ? '0 (accept it unconfirmed)' : `${z} (${hours(z)} on Bitcoin)`;
    qInput.setAttribute('aria-valuetext', `${qInput.value}% of hashpower; attacker success ${fmtProb(exact)}`);
    zInput.setAttribute('aria-valuetext', `${z} confirmations; attacker success ${fmtProb(exact)}`);
    $('#race-exact').textContent = fmtProb(exact);
    $('#race-satoshi').textContent = fmtProb(satoshi);
    $('#race-needed').textContent = needed === null ? 'never — majority wins' : `${needed} block${needed === 1 ? '' : 's'} (${hours(needed)})`;
    verdict.className = 'verdict';
    verdict.textContent = '';

    const clip = (p) => (p >= FLOOR ? p : NaN);
    const config = {
      title: `Chance a ${qInput.value}% attacker reverses a payment, by confirmations`,
      xs: zs,
      series: [
        { label: 'exact', values: zs.map((n) => clip(exactAttackProbability(q, n))), color: 'var(--series-1)', type: 'line', markers: true },
        { label: 'Satoshi’s estimate', values: zs.map((n) => clip(satoshiAttackProbability(q, n))), color: 'var(--series-2)', type: 'line', dashed: true },
      ],
      y: { log: true, min: FLOOR, max: 1, ticks: [1, 1e-2, 1e-4, 1e-6, 1e-8], format: (v) => (v >= 1e-4 ? `${+(v * 100).toPrecision(2)}%` : `1 in ${fmtCompact(1 / v)}`) },
      x: { label: 'confirmations', format: (v) => `${v}`, tooltipFormat: (v) => `${v} confirmation${v === 1 ? '' : 's'}` },
      refs: [{ y: 0.001, label: '0.1% risk' }],
      points: exact >= FLOOR ? [{ index: z, y: exact, label: fmtProb(exact), color: 'var(--series-1)' }] : [],
      tooltipFormat: (v) => fmtProb(v),
      height: 210,
    };
    if (chart) chart.update(config);
    else chart = createChart($('#race-chart'), config);
  }

  $('#race-sim').addEventListener('click', () => {
    const q = Number(qInput.value) / 100;
    const z = Number(zInput.value);
    const runs = 10_000;
    let wins = 0;
    for (let i = 0; i < runs; i++) if (simulateAttack(q, z)) wins++;
    const exact = exactAttackProbability(q, z);
    verdict.className = 'verdict neutral';
    verdict.textContent = `🏁 Played ${fmt(runs)} races block by block: the attacker won ${fmt(wins)} (${fmtProb(wins / runs)}). The exact model predicts ${fmtProb(exact)}${exact * runs < 3 ? ' — too rare to show up reliably in 10,000 tries' : ''}.`;
  });

  [qInput, zInput].forEach((i) => i.addEventListener('input', update));
  update();
}
