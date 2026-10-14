import { $, fmt, fmtCompact, fmtDuration, yieldToMain } from '../core/dom.js';
import { createChart } from '../core/chart.js';
import { sha256 } from '../lib/sha256.js';
import { bytesToHex, utf8 } from '../lib/bytes.js';
import { retarget } from '../lib/chain-math.js';

/* ============================== Module 4: mining simulator ============================== */

const leadingHexZeros = (digest) => {
  let zeros = 0;
  for (const b of digest) {
    if (b === 0) { zeros += 2; continue; }
    if (b < 16) zeros++;
    break;
  }
  return zeros;
};

export function initMiningSim() {
  const dataInput = $('#mine-data');
  const diffInput = $('#mine-difficulty');
  const diffLabel = $('#mine-diff-label');
  const startBtn = $('#mine-start');
  const repeatBtn = $('#mine-repeat');
  const stopBtn = $('#mine-stop');
  const statusOut = $('#mine-status');
  const attemptsOut = $('#mine-attempts');
  const timeOut = $('#mine-time');
  const rateOut = $('#mine-rate');
  const luckOut = $('#mine-luck');
  const hashOut = $('#mine-hash');
  const chartHost = $('#mine-luck-chart');

  const history = []; // one entry per mined block: { block, zeros, tries }
  let run = null; // { stop } while mining
  let chart = null;
  let blockNo = 0;

  const expectedTries = (zeros) => 16 ** zeros;
  const luckWord = (ratio) => (ratio < 0.5 ? 'lucky!' : ratio > 2 ? 'unlucky' : 'about average');

  const updateDiffLabel = () => {
    const d = Number(diffInput.value);
    const text = `${d} leading zero${d > 1 ? 's' : ''} (~${fmt(expectedTries(d))} tries on average)`;
    diffLabel.textContent = text;
    diffInput.setAttribute('aria-valuetext', text);
  };
  diffInput.addEventListener('input', updateDiffLabel);
  updateDiffLabel();

  const setRunning = (running) => {
    startBtn.disabled = running;
    repeatBtn.disabled = running;
    stopBtn.disabled = !running;
    diffInput.disabled = running;
    dataInput.disabled = running;
  };

  const showStats = (tries, secs, digest) => {
    attemptsOut.textContent = fmt(tries);
    timeOut.textContent = `${secs.toFixed(1)} s`;
    rateOut.textContent = secs > 0.05 ? `${fmt(tries / secs)} hashes/s` : '–';
    hashOut.textContent = bytesToHex(digest);
  };

  /* Try nonces 0, 1, 2… in ~30 ms slices, yielding between slices so the page stays responsive. */
  async function mineOne(data, zeros) {
    let nonce = 0;
    let digest = null;
    const t0 = performance.now();
    const cap = expectedTries(zeros) * 40; // P(needing 40× the average) ≈ e⁻⁴⁰
    while (nonce < cap) {
      const deadline = performance.now() + 30;
      while (performance.now() < deadline) {
        for (let k = 0; k < 1024; k++, nonce++) {
          digest = sha256(utf8(`${data}|${nonce}`));
          if (leadingHexZeros(digest) >= zeros) {
            const secs = (performance.now() - t0) / 1000;
            showStats(nonce + 1, secs, digest);
            return { nonce, tries: nonce + 1, secs };
          }
        }
      }
      showStats(nonce, (performance.now() - t0) / 1000, digest);
      await yieldToMain();
      if (run.stop) return null;
    }
    return null;
  }

  function recordBlock(zeros, tries) {
    history.push({ block: ++blockNo, zeros, tries });
    if (history.length > 20) history.shift();
    const ratio = tries / expectedTries(zeros);
    luckOut.textContent = `${ratio.toFixed(2)}× expected — ${luckWord(ratio)}`;
    chartHost.hidden = false;
    const ratios = history.map((h) => h.tries / expectedTries(h.zeros));
    const config = {
      title: 'Work needed for each block you mined, relative to the average',
      xs: history.map((h) => h.block),
      series: [{ label: 'work needed (× the average)', values: ratios, color: 'var(--series-1)', type: 'bar' }],
      refs: [{ y: 1, label: 'average' }],
      y: { min: 0, max: Math.max(2, ...ratios) * 1.1, format: (v) => `${Number(v.toFixed(2))}×` },
      x: {
        label: 'block',
        format: (v) => `#${v}`,
        tooltipFormat: (v, i) => `Block #${v} · ${history[i].zeros} zeros · ${fmt(history[i].tries)} tries`,
      },
      height: 180,
    };
    if (chart) chart.update(config);
    else chart = createChart(chartHost, config);
  }

  async function mine(count) {
    const zeros = Number(diffInput.value);
    run = { stop: false };
    setRunning(true);
    statusOut.className = 'verdict neutral';
    statusOut.textContent = count > 1 ? `⛏️ Mining ${count} blocks…` : '⛏️ Mining…';
    const done = [];
    for (let k = 0; k < count && !run.stop; k++) {
      // Each block is a fresh puzzle: different data, so different winning nonces.
      const result = await mineOne(`${dataInput.value} #${blockNo + 1}`, zeros);
      if (!result) break;
      recordBlock(zeros, result.tries);
      done.push(result);
    }
    const stopped = run.stop;
    run = null;
    setRunning(false);

    if (!done.length) {
      statusOut.textContent = stopped ? '⏹️ Stopped before finding a block.' : '😮‍💨 Gave up — try a lower difficulty.';
      return;
    }
    statusOut.className = 'verdict ok';
    if (count === 1) {
      statusOut.textContent = `✅ Block mined! Nonce ${fmt(done[0].nonce)} works — anyone can check it with a single hash.`;
    } else {
      const ratios = done.map((r) => r.tries / expectedTries(zeros));
      const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
      statusOut.textContent = `✅ Mined ${done.length} block${done.length > 1 ? 's' : ''}${stopped ? ' before stopping' : ''}. `
        + `Luckiest needed ${Math.min(...ratios).toFixed(2)}× the average work, unluckiest ${Math.max(...ratios).toFixed(2)}×; overall ${avg.toFixed(2)}×.`;
    }
  }

  startBtn.addEventListener('click', () => mine(1));
  repeatBtn.addEventListener('click', () => mine(10));
  stopBtn.addEventListener('click', () => { if (run) run.stop = true; });
}

/* ============================== Module 4: solo mining odds ============================== */

export function initSoloOdds() {
  const BLOCKS_PER_DAY = 144;
  const SUBSIDY_BTC = 3.125;
  const rig = $('#solo-rig');
  const net = $('#solo-net');

  const update = () => {
    const mine = Number(rig.value);
    const network = Number(net.value) * 1e18;
    if (!(network > 0)) return;
    const share = Math.min(1, mine / network);
    const blocksPerDay = share * BLOCKS_PER_DAY;
    const pYear = 1 - Math.exp(-blocksPerDay * 365.25);
    const btcPerDay = blocksPerDay * SUBSIDY_BTC;

    $('#solo-share').textContent = share >= 0.001 ? `${(share * 100).toFixed(2)}%` : `1 in ${fmtCompact(1 / share)}`;
    $('#solo-wait').textContent = fmtDuration((1 / blocksPerDay) * 86400);
    $('#solo-year').textContent = pYear > 0.9999 ? 'certain'
      : pYear >= 0.01 ? `${(pYear * 100).toFixed(pYear < 0.1 ? 1 : 0)}%`
        : pYear >= 1e-6 ? `${(pYear * 100).toPrecision(2)}%` : '≈ 0%';
    $('#solo-pool').textContent = btcPerDay >= 0.01 ? `${fmt(btcPerDay, 3)} BTC a day`
      : btcPerDay * 1e8 >= 1 ? `${fmt(btcPerDay * 1e8)} sats a day` : 'less than 1 sat a day';
    $('#solo-verdict').textContent =
      blocksPerDay >= 1 ? '🏭 At this scale you find several blocks a day — income is steady even without a pool.'
      : pYear >= 0.5 ? '🎲 A block a year is likely but lumpy: one good month, then nothing. Big operations still smooth this out.'
      : pYear >= 0.001 ? '🎟️ Solo, this is a lottery ticket: most likely you never win. A pool pays the same expected amount as a steady trickle.'
      : '🪨 Solo, you will essentially never find a block — even a pool pays almost nothing. This is why hobby mining moved to ASICs.';
  };

  rig.addEventListener('change', update);
  net.addEventListener('input', update);
  update();
}

/* ============================== Module 4: difficulty retargeting ============================== */

/* Standard normal sample (Box–Muller). */
const gaussian = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());

export function initRetargetDemo() {
  const BLOCKS = 2016;
  const MAX_SHOWN = 24;
  const slider = $('#rt-hash');
  const verdict = $('#rt-verdict');
  let difficulty;
  let periods;
  let timeChart = null;
  let diffChart = null;

  const syncSlider = () => {
    $('#rt-hash-out').textContent = `${slider.value}`;
    slider.setAttribute('aria-valuetext', `hashpower ${slider.value}, where 100 is the starting level`);
  };

  /* One 2,016-block period. 2,016 exponential block times sum to almost exactly
     2,016 × the mean, with ~2.2% noise (1/√2016). */
  function runPeriod(hash) {
    const meanMinutes = (10 * difficulty) / hash;
    const minutes = BLOCKS * meanMinutes * (1 + gaussian() / Math.sqrt(BLOCKS));
    const next = retarget(difficulty, minutes * 60);
    periods.push({ hash, difficulty, blockMinutes: minutes / BLOCKS, days: minutes / 1440, change: next / difficulty - 1 });
    if (periods.length > MAX_SHOWN) periods.shift();
    difficulty = next;
  }

  const describe = (p) => `blocks averaged ${p.blockMinutes.toFixed(1)} min and the period took ${p.days.toFixed(1)} days`;
  const adjustment = (p) => `${p.change >= 0 ? '+' : '−'}${Math.abs(p.change * 100).toFixed(1)}%`;

  function render(message) {
    const last = periods.at(-1);
    $('#rt-period').textContent = String(last.n);
    $('#rt-time').textContent = `${last.blockMinutes.toFixed(1)} min`;
    $('#rt-days').textContent = `${last.days.toFixed(1)} days`;
    $('#rt-adjust').textContent = adjustment(last);
    // Even at steady state a period wanders ±0.3 min (its own noise plus the last retarget's error),
    // so only flag deviations beyond ~3σ.
    const slow = last.blockMinutes > 11;
    const fast = last.blockMinutes < 9;
    verdict.className = `verdict ${slow || fast ? 'warn' : 'ok'}`;
    verdict.textContent = message ?? (slow || fast
      ? `${slow ? '🐢' : '🐇'} Last period ${describe(last)}. Difficulty adjusts ${adjustment(last)} — run another period to see the rhythm return.`
      : `✓ On target: ${describe(last)}. Difficulty adjusts ${adjustment(last)}.`);

    const xs = periods.map((p) => p.n);
    const timeConfig = {
      title: 'Average time between blocks in each 2,016-block period',
      xs,
      series: [{ label: 'average block time', values: periods.map((p) => p.blockMinutes), color: 'var(--series-1)', type: 'bar' }],
      refs: [{ y: 10, label: '10-minute target' }],
      y: { min: 0, max: Math.max(22, ...periods.map((p) => p.blockMinutes)) * 1.05, format: (v) => `${Number(v.toFixed(1))} min`, label: 'minutes per block' },
      x: { label: 'period', format: (v) => `${v}`, tooltipFormat: (v, i) => `Period ${v} · ${periods[i].days.toFixed(1)} days` },
      height: 170,
    };
    const diffConfig = {
      title: 'Difficulty versus hashpower in each period (both start at 100)',
      xs,
      series: [
        { label: 'hashpower', values: periods.map((p) => p.hash), color: 'var(--series-2)', type: 'line', markers: true },
        { label: 'difficulty', values: periods.map((p) => p.difficulty), color: 'var(--series-1)', type: 'line', markers: true },
      ],
      y: { min: 0, format: (v) => fmt(v) },
      x: { label: 'period', format: (v) => `${v}`, tooltipFormat: (v) => `Period ${v}` },
      tooltipFormat: (v) => fmt(v, 1),
      height: 170,
    };
    if (timeChart) { timeChart.update(timeConfig); diffChart.update(diffConfig); } else {
      timeChart = createChart($('#rt-time-chart'), timeConfig);
      diffChart = createChart($('#rt-diff-chart'), diffConfig);
    }
  }

  let counter = 0;
  const step = (hash) => {
    runPeriod(hash);
    periods.at(-1).n = ++counter;
  };

  function reset() {
    difficulty = 100;
    periods = [];
    counter = 0;
    slider.value = '100';
    syncSlider();
    for (let i = 0; i < 3; i++) step(100);
    render();
  }

  function shock(factor, label) {
    const hash = Math.min(400, Math.max(10, Math.round((Number(slider.value) * factor) / 5) * 5));
    slider.value = String(hash);
    syncSlider();
    step(hash);
    const hit = periods.at(-1);
    step(hash);
    const after = periods.at(-1);
    render(`${label} Period ${hit.n}: ${describe(hit)}. The retarget moved difficulty ${adjustment(hit)}, so in period ${after.n} ${describe(after)}.`);
  }

  slider.addEventListener('input', syncSlider);
  $('#rt-step').addEventListener('click', () => { step(Number(slider.value)); render(); });
  $('#rt-ban').addEventListener('click', () => shock(0.5, '📉 Half the hashpower vanished.'));
  $('#rt-boom').addEventListener('click', () => shock(2, '📈 Hashpower doubled.'));
  $('#rt-reset').addEventListener('click', reset);
  reset();
}

/* ============================== Module 4: halving & supply explorer ============================== */

export function initHalvingDemo() {
  const eraInput = $('#halving-era');
  const BLOCKS_PER_ERA = 210_000;
  const SATS_PER_BTC = 100_000_000;
  const CAP_SATS = 21_000_000 * SATS_PER_BTC;
  const LAST_ERA = Number(eraInput.max);

  /* Integer satoshi math, like the protocol: floor() is why the cap is just under 21 M. */
  const rewardSats = (era) => Math.floor((50 * SATS_PER_BTC) / 2 ** era);
  /* Real halvings landed 2012, 2016, 2020, 2024… era n starts ≈ 2008 + 4n (genesis era starts 2009). */
  const endYear = (era) => 2008 + (era + 1) * 4;

  const mintedByEra = [];
  let running = 0;
  for (let era = 0; era <= LAST_ERA; era++) {
    running += BLOCKS_PER_ERA * rewardSats(era);
    mintedByEra.push(running);
  }
  const chart = createChart($('#supply-chart'), {
    title: 'Total bitcoin in existence at the end of each halving era',
    xs: mintedByEra.map((_, era) => endYear(era)),
    series: [{ label: 'bitcoin minted', values: mintedByEra.map((s) => s / SATS_PER_BTC / 1e6), color: 'var(--series-1)', type: 'area' }],
    refs: [{ y: 21, label: '21 million cap' }],
    y: { min: 0, max: 22, ticks: [0, 5, 10, 15, 20], format: (v) => `${v}M` },
    x: { label: 'year', format: (v) => `${v}`, tickIndexes: [0, 4, 9, 14, 19, 24, 29, 33] },
    tooltipFormat: (v) => `${v.toLocaleString(undefined, { maximumFractionDigits: 6 })} million BTC`,
    height: 190,
  });

  const update = () => {
    const era = Number(eraInput.value);
    const mintedSats = mintedByEra[era];
    const reward = rewardSats(era);
    const pct = (mintedSats / CAP_SATS) * 100;
    const yearFrom = era === 0 ? 2009 : 2008 + era * 4;
    const rewardText = reward === 0
      ? '0 — fees only'
      : reward < SATS_PER_BTC / 100
        ? `${reward.toLocaleString()} sat${reward > 1 ? 's' : ''}`
        : `${(reward / SATS_PER_BTC).toLocaleString(undefined, { maximumFractionDigits: 8 })} BTC`;
    const pctText = `${pct.toFixed(pct > 99.99 ? 7 : pct > 99.9 ? 4 : 1)}%`;

    $('#halving-era-out').textContent = era === 0 ? 'era 0 (genesis — no halvings yet)' : `era ${era} (after halving #${era})`;
    $('#halving-years').textContent = `${yearFrom}–${endYear(era)}`;
    $('#halving-reward').textContent = rewardText;
    $('#halving-minted').textContent = `${(mintedSats / SATS_PER_BTC).toLocaleString(undefined, { maximumFractionDigits: 4 })} BTC`;
    $('#halving-pct').textContent = pctText;
    eraInput.setAttribute('aria-valuetext', `era ${era}, ${yearFrom} to ${endYear(era)}: ${rewardText} per block, ${pctText} of all bitcoin minted`);
    chart.update({ points: [{ index: era, y: mintedSats / SATS_PER_BTC / 1e6, label: `${pctText} by ${endYear(era)}`, color: 'var(--series-1)' }] });

    $('#halving-note').textContent =
      era === 0 ? 'Every block mints 50 BTC: half of all bitcoin that will ever exist is created in this first era.'
      : era === 4 ? 'The April 2024 halving — the era we are in now: 3.125 BTC per block.'
      : reward === 1 ? 'The last era with a subsidy: each block mints exactly 1 satoshi.'
      : reward === 0 ? 'The subsidy rounds to zero around 2140. From here on, security must be paid for entirely by transaction fees.'
      : '';
  };

  eraInput.addEventListener('input', update);
  update();
}
