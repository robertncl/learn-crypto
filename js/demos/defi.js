import { $, el, fmt } from '../core/dom.js';
import { createChart } from '../core/chart.js';
import { bestSandwich, healthFactor, impermanentLoss, liquidationPrice, quote, swapOut } from '../lib/amm.js';

/* ============================== Module 9: constant-product AMM ============================== */

const POOL = { eth: 100, usdc: 300_000 };
const usd = (n, digits = 0) => `$${fmt(n, digits)}`;
const signedPct = (x, digits = 1) => `${x < 0 ? '−' : x > 0 ? '+' : ''}${Math.abs(x).toFixed(digits)}%`;
const usdc = (n) => `${fmt(n, n < 100 ? 2 : 0)} USDC`;
const ethAmt = (n) => `${n.toLocaleString(undefined, { maximumFractionDigits: n < 1 ? 4 : 3 })} ETH`;

export function initAmmDemo() {
  const dir = $('#amm-dir');
  const amount = $('#amm-amount');
  const verdict = $('#amm-verdict');
  let pool = { ...POOL };
  let chart = null;

  /* The slider is quadratic so small trades get fine control. */
  const tradeSize = () => {
    const t = (Number(amount.value) / 100) ** 2;
    return dir.value === 'buy' ? Math.round(300_000 * t) : Math.round(100 * t * 100) / 100;
  };

  function preview() {
    const size = tradeSize();
    const buy = dir.value === 'buy';
    const q = buy ? quote(size, pool.usdc, pool.eth) : quote(size, pool.eth, pool.usdc);
    const after = buy ? { eth: q.reserveOut, usdc: q.reserveIn } : { eth: q.reserveIn, usdc: q.reserveOut };
    return { size, buy, q, after };
  }

  function render() {
    const { size, buy, q, after } = preview();
    const spot = pool.usdc / pool.eth;
    $('#amm-amount-out').textContent = buy ? usdc(size) : ethAmt(size);
    amount.setAttribute('aria-valuetext', `${buy ? usdc(size) : ethAmt(size)} in; ${buy ? ethAmt(q.out) : usdc(q.out)} out`);
    $('#amm-out').textContent = size ? (buy ? ethAmt(q.out) : usdc(q.out)) : '–';
    const avgPrice = buy ? size / q.out : q.out / size;
    $('#amm-avg').textContent = size ? `${usd(avgPrice)} per ETH` : `${usd(spot)} per ETH (spot)`;
    $('#amm-impact').textContent = size ? `${(q.priceImpact * 100).toFixed(2)}%` : '–';
    $('#amm-after').textContent = `${usd(after.usdc / after.eth)} per ETH`;

    // The curve x·y = k through the current pool, with the trade as a move along it.
    const k = pool.eth * pool.usdc;
    const xs = [];
    for (let x = 30; x <= 260; x += 5) xs.push(x);
    const config = {
      title: 'Pool reserves: every trade slides along x · y = k',
      xs,
      series: [{ label: 'x · y = k', values: xs.map((x) => k / x / 1000), color: 'var(--series-1)', type: 'line' }],
      y: { min: 0, max: 1000, ticks: [0, 250, 500, 750, 1000], format: (v) => `${fmt(v)}K`, label: 'USDC in pool' },
      x: { label: 'ETH in pool', format: (v) => `${v}`, tickIndexes: [0, 4, 14, 24, 34, 44] },
      tooltipFormat: (v) => `${fmt(v * 1000)} USDC`,
      // Buying ETH moves up-left along the curve, selling moves down-right: label the two ends on opposite sides.
      points: [
        { x: pool.eth, y: pool.usdc / 1000, label: 'now', color: 'var(--series-1)', place: buy ? 'below-right' : 'above-left' },
        ...(size ? [{ x: after.eth, y: after.usdc / 1000, label: 'after your trade', color: 'var(--series-2)', place: buy ? 'above-left' : 'below-right' }] : []),
      ],
      table: false,
      height: 220,
    };
    if (chart) chart.update(config);
    else chart = createChart($('#amm-chart'), config);
  }

  $('#amm-swap').addEventListener('click', () => {
    const { size, buy, q, after } = preview();
    if (!size) return;
    pool = after;
    verdict.className = 'verdict ok';
    verdict.textContent = `✓ Swapped ${buy ? usdc(size) : ethAmt(size)} for ${buy ? ethAmt(q.out) : usdc(q.out)}. The pool now prices ETH at ${usd(pool.usdc / pool.eth)} — until arbitrageurs pull it back toward the market price.`;
    render();
  });
  $('#amm-reset').addEventListener('click', () => {
    pool = { ...POOL };
    verdict.className = 'verdict';
    verdict.textContent = '';
    render();
  });
  dir.addEventListener('change', render);
  amount.addEventListener('input', render);
  render();
}

/* ============================== Module 9: sandwich attack ============================== */

export function initSandwichDemo() {
  const VICTIM_IN = 30_000; // USDC
  const BOT_COSTS = 20; // USD for gas on two swaps plus the builder tip — a stated assumption
  const slider = $('#sw-slip');
  const pool = { base: POOL.eth, quote: POOL.usdc };
  const spot = POOL.usdc / POOL.eth;

  function render() {
    const tolerance = 10 ** (Number(slider.value) / 10) / 10_000; // log scale: 0.01% … 10%
    const pct = `${(tolerance * 100).toFixed(tolerance < 0.001 ? 2 : 1)}%`;
    const fair = swapOut(VICTIM_IN, pool.quote, pool.base);
    const minOut = fair * (1 - tolerance);
    const best = bestSandwich(pool, VICTIM_IN, minOut);
    const net = best ? best.profit - BOT_COSTS : -Infinity;
    const attacked = net > 0;
    $('#sw-slip-out').textContent = `${pct} — accepts at least ${ethAmt(minOut)}`;

    const got = attacked ? best.victimOut : fair;
    slider.setAttribute('aria-valuetext', `${pct} tolerance; ${attacked ? `bot nets ${usd(net)}` : 'not worth attacking'}`);
    $('#sw-fair').textContent = ethAmt(fair);
    $('#sw-got').textContent = ethAmt(got);
    $('#sw-loss').textContent = attacked ? `${ethAmt(fair - got)} ≈ ${usd((fair - got) * spot)}` : 'nothing';
    $('#sw-profit').textContent = attacked
      ? usd(net)
      : `none — at most ${usd(Math.max(0, best?.profit ?? 0))} before costs, so it doesn’t bother`;

    const step = (n, who, text) => el('li', { className: who },
      el('strong', { textContent: `${n} · ${who === 'is-bot' ? '🤖 Bot' : '🙂 Trader'}: ` }), text);
    $('#sw-steps').replaceChildren(...(attacked
      ? [
        step(1, 'is-bot', `buys ${ethAmt(best.frontOut)} for ${usdc(best.frontIn)}, pushing the price up.`),
        step(2, 'is-victim', `buys ${ethAmt(best.victimOut)} for ${usdc(VICTIM_IN)} — just above the ${ethAmt(minOut)} minimum.`),
        step(3, 'is-bot', `sells its ${ethAmt(best.frontOut)} back for ${usdc(best.backOut)}: ${usd(best.profit)} before costs, in seconds.`),
      ]
      : [step(1, 'is-victim', `buys ${ethAmt(fair)} for ${usdc(VICTIM_IN)}. The tolerance leaves so little room that a sandwich wouldn’t cover the bot’s costs, so it leaves this swap alone.`)]));
  }

  slider.addEventListener('input', render);
  render();
}

/* ============================== Module 9: impermanent loss ============================== */

export function initImpermanentLossDemo() {
  const slider = $('#il-move');
  const START_PRICE = 3000;
  const ETH0 = 10;
  const USDC0 = 30_000;
  let chart = null;

  const ratioOf = (v) => 2 ** (v / 10);
  const pctMove = (r) => (Math.abs(r - 1) < 1e-9 ? '0%' : `${r > 1 ? '+' : '−'}${Math.round(Math.abs(r - 1) * 100)}%`);

  function render() {
    const r = ratioOf(Number(slider.value));
    const price = START_PRICE * r;
    const hold = ETH0 * price + USDC0;
    // A constant-product position keeps eth · usdc constant and is rebalanced to the new price.
    const k = ETH0 * USDC0;
    const eth = Math.sqrt(k / price);
    const usdcAmt = Math.sqrt(k * price);
    const pool = eth * price + usdcAmt;
    const il = impermanentLoss(r);

    $('#il-move-out').textContent = `${usd(price)} (${pctMove(r)})`;
    slider.setAttribute('aria-valuetext', `ETH at ${usd(price)}, ${pctMove(r)}; impermanent loss ${(il * -100).toFixed(1)}%`);
    $('#il-hold').textContent = usd(hold);
    $('#il-pool').textContent = usd(pool);
    $('#il-tokens').textContent = `${eth.toFixed(2)} ETH + ${fmt(usdcAmt)} USDC`;
    $('#il-loss').textContent = `${signedPct(il * 100, 2)} (${usd(hold - pool)})`;

    const xs = [];
    for (let v = -33; v <= 23; v++) xs.push(v);
    const config = {
      title: 'Impermanent loss versus how far the price moved',
      xs,
      series: [{ label: 'impermanent loss', values: xs.map((v) => impermanentLoss(ratioOf(v)) * 100), color: 'var(--series-2)', type: 'area' }],
      y: { min: -45, max: 0, ticks: [0, -10, -20, -30, -40], format: (v) => signedPct(v, 0) },
      x: {
        label: 'ETH price change',
        format: (v) => pctMove(ratioOf(v)),
        tickIndexes: [3, 13, 23, 33, 43, 53].filter((i) => i < xs.length),
      },
      tooltipFormat: (v) => signedPct(v, 2),
      points: [{ index: xs.indexOf(Number(slider.value)), y: il * 100, label: signedPct(il * 100), color: 'var(--series-2)' }],
      table: false,
      height: 190,
    };
    if (chart) chart.update(config);
    else chart = createChart($('#il-chart'), config);
  }

  slider.addEventListener('input', render);
  render();
}

/* ============================== Module 9: lending & liquidation ============================== */

export function initLendingDemo() {
  const COLLATERAL_ETH = 10;
  const THRESHOLD = 0.8; // liquidation threshold
  const CLOSE_FACTOR = 0.5; // a liquidator may repay up to half the debt
  const BONUS = 0.05; // and receives 5% extra collateral
  const borrow = $('#ln-borrow');
  const price = $('#ln-price');
  const verdict = $('#ln-verdict');
  const liqBtn = $('#ln-liquidate');
  let position; // { collateral, debt } — diverges from the sliders after a liquidation
  let liquidated = null;

  const reset = () => {
    position = { collateral: COLLATERAL_ETH, debt: Number(borrow.value) };
    liquidated = null;
  };

  function render() {
    const p = Number(price.value);
    const { collateral, debt } = position;
    const value = collateral * p;
    const hf = healthFactor(value, THRESHOLD, debt);
    $('#ln-borrow-out').textContent = `${usdc(Number(borrow.value))} (${Math.round((Number(borrow.value) / 30_000) * 100)}% of the collateral’s value)`;
    $('#ln-price-out').textContent = usd(p);
    price.setAttribute('aria-valuetext', `ETH ${usd(p)}; health factor ${Number.isFinite(hf) ? hf.toFixed(2) : 'no debt'}`);
    $('#ln-coll').textContent = `${collateral.toFixed(3)} ETH = ${usd(value)}`;
    $('#ln-debt').textContent = usdc(debt);
    $('#ln-hf').textContent = Number.isFinite(hf) ? `${hf < 1 ? '⚠️' : hf < 1.2 ? '⚠️' : '✓'} ${hf.toFixed(2)}` : '∞ (no debt)';
    $('#ln-liq').textContent = debt > 0 ? usd(liquidationPrice(collateral, THRESHOLD, debt)) : 'never';
    liqBtn.disabled = !(hf < 1);

    if (liquidated) {
      verdict.className = 'verdict bad';
      verdict.textContent = liquidated;
    } else if (!(debt > 0)) {
      verdict.className = 'verdict neutral';
      verdict.textContent = 'No loan, no risk — drag “You borrowed” to take one.';
    } else if (hf < 1) {
      verdict.className = 'verdict bad';
      verdict.textContent = `✗ Health factor ${hf.toFixed(2)}: the loan is under-collateralized and anyone may now liquidate it.`;
    } else if (hf < 1.2) {
      verdict.className = 'verdict warn';
      verdict.textContent = `⚠️ Health factor ${hf.toFixed(2)}: a ${Math.round((1 - 1 / hf) * 100)}% fall in ETH triggers liquidation.`;
    } else {
      verdict.className = 'verdict ok';
      verdict.textContent = `✓ Healthy (${hf.toFixed(2)}). ETH can fall ${Math.round((1 - 1 / hf) * 100)}% before you can be liquidated.`;
    }
  }

  liqBtn.addEventListener('click', () => {
    const p = Number(price.value);
    const repay = position.debt * CLOSE_FACTOR;
    const seized = Math.min(position.collateral, (repay * (1 + BONUS)) / p);
    position = { collateral: position.collateral - seized, debt: position.debt - repay };
    const bonusEth = seized - repay / p;
    liquidated = `⚡ A bot repaid ${usdc(repay)} of your debt and took ${seized.toFixed(3)} ETH (${usd(seized * p)}) of your collateral. `
      + `${bonusEth.toFixed(3)} ETH of that — ${usd(bonusEth * p)} — is the 5% bonus: pure profit for the bot, paid by you.`;
    render();
  });
  borrow.addEventListener('input', () => { reset(); render(); });
  price.addEventListener('input', () => { liquidated = null; render(); });
  $('#ln-reset').addEventListener('click', () => {
    borrow.value = '15000';
    price.value = '3000';
    reset();
    render();
  });
  reset();
  render();
}
