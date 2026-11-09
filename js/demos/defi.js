import { $, el, fmt, num } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { createChart } from '../core/chart.js';
import { bestSandwich, healthFactor, impermanentLoss, liquidationPrice, quote, swapOut } from '../lib/amm.js';

/* ============================== Module 9: constant-product AMM ============================== */

const POOL = { eth: 100, usdc: 300_000 };
const usd = (n, digits = 0) => `$${fmt(n, digits)}`;
const signedPct = (x, digits = 1) => `${x < 0 ? '−' : x > 0 ? '+' : ''}${fmt(Math.abs(x), digits)}%`;
const usdc = (n) => t('unit.usdc', { v: fmt(n, n < 100 ? 2 : 0) });
const ethAmt = (n) => t('unit.eth', { v: num(n, { maximumFractionDigits: n < 1 ? 4 : 3 }) });

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
    amount.setAttribute('aria-valuetext', t('amm.inOut', { in: buy ? usdc(size) : ethAmt(size), out: buy ? ethAmt(q.out) : usdc(q.out) }));
    $('#amm-out').textContent = size ? (buy ? ethAmt(q.out) : usdc(q.out)) : '–';
    const avgPrice = buy ? size / q.out : q.out / size;
    $('#amm-avg').textContent = size ? t('amm.perEth', { price: usd(avgPrice) }) : t('amm.perEthSpot', { price: usd(spot) });
    $('#amm-impact').textContent = size ? `${fmt(q.priceImpact * 100, 2)}%` : '–';
    $('#amm-after').textContent = t('amm.perEth', { price: usd(after.usdc / after.eth) });

    // The curve x·y = k through the current pool, with the trade as a move along it.
    const k = pool.eth * pool.usdc;
    const xs = [];
    for (let x = 30; x <= 260; x += 5) xs.push(x);
    const config = {
      title: t('amm.chart.title'),
      xs,
      series: [{ label: t('amm.chart.series'), values: xs.map((x) => k / x / 1000), color: 'var(--series-1)', type: 'line' }],
      y: { min: 0, max: 1000, ticks: [0, 250, 500, 750, 1000], format: (v) => t('amm.axisK', { v: fmt(v) }), label: t('amm.axis.y') },
      x: { label: t('amm.axis.x'), format: (v) => `${v}`, tickIndexes: [0, 4, 14, 24, 34, 44] },
      tooltipFormat: (v) => t('unit.usdc', { v: fmt(v * 1000) }),
      // Buying ETH moves up-left along the curve, selling moves down-right: label the two ends on opposite sides.
      points: [
        { x: pool.eth, y: pool.usdc / 1000, label: t('amm.point.now'), color: 'var(--series-1)', place: buy ? 'below-right' : 'above-left' },
        ...(size ? [{ x: after.eth, y: after.usdc / 1000, label: t('amm.point.after'), color: 'var(--series-2)', place: buy ? 'above-left' : 'below-right' }] : []),
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
    verdict.textContent = t('amm.swapped', { in: buy ? usdc(size) : ethAmt(size), out: buy ? ethAmt(q.out) : usdc(q.out), price: usd(pool.usdc / pool.eth) });
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
    const pct = `${fmt(tolerance * 100, tolerance < 0.001 ? 2 : 1)}%`;
    const fair = swapOut(VICTIM_IN, pool.quote, pool.base);
    const minOut = fair * (1 - tolerance);
    const best = bestSandwich(pool, VICTIM_IN, minOut);
    const net = best ? best.profit - BOT_COSTS : -Infinity;
    const attacked = net > 0;
    $('#sw-slip-out').textContent = t('sw.slip', { pct, min: ethAmt(minOut) });

    const got = attacked ? best.victimOut : fair;
    slider.setAttribute('aria-valuetext', attacked ? t('sw.valuetextAttack', { pct, net: usd(net) }) : t('sw.valuetextSafe', { pct }));
    $('#sw-fair').textContent = ethAmt(fair);
    $('#sw-got').textContent = ethAmt(got);
    $('#sw-loss').textContent = attacked ? t('sw.loss', { eth: ethAmt(fair - got), usd: usd((fair - got) * spot) }) : t('sw.lossNone');
    $('#sw-profit').textContent = attacked
      ? usd(net)
      : t('sw.profitNone', { max: usd(Math.max(0, best?.profit ?? 0)) });

    const step = (n, who, text) => el('li', { className: who },
      el('strong', { textContent: t('sw.who', { n, who: t(who === 'is-bot' ? 'sw.bot' : 'sw.trader') }) }), text);
    $('#sw-steps').replaceChildren(...(attacked
      ? [
        step(1, 'is-bot', t('sw.step1', { out: ethAmt(best.frontOut), in: usdc(best.frontIn) })),
        step(2, 'is-victim', t('sw.step2', { out: ethAmt(best.victimOut), in: usdc(VICTIM_IN), min: ethAmt(minOut) })),
        step(3, 'is-bot', t('sw.step3', { eth: ethAmt(best.frontOut), out: usdc(best.backOut), profit: usd(best.profit) })),
      ]
      : [step(1, 'is-victim', t('sw.safe', { out: ethAmt(fair), in: usdc(VICTIM_IN) }))]));
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
    slider.setAttribute('aria-valuetext', t('il.valuetext', { price: usd(price), move: pctMove(r), loss: fmt(il * -100, 1) }));
    $('#il-hold').textContent = usd(hold);
    $('#il-pool').textContent = usd(pool);
    $('#il-tokens').textContent = t('il.tokens', { eth: fmt(eth, 2), usdc: fmt(usdcAmt) });
    $('#il-loss').textContent = `${signedPct(il * 100, 2)} (${usd(hold - pool)})`;

    const xs = [];
    for (let v = -33; v <= 23; v++) xs.push(v);
    const config = {
      title: t('il.chart.title'),
      xs,
      series: [{ label: t('il.chart.series'), values: xs.map((v) => impermanentLoss(ratioOf(v)) * 100), color: 'var(--series-2)', type: 'area' }],
      y: { min: -45, max: 0, ticks: [0, -10, -20, -30, -40], format: (v) => signedPct(v, 0) },
      x: {
        label: t('il.axis'),
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
    $('#ln-borrow-out').textContent = t('ln.borrowed', { amount: usdc(Number(borrow.value)), pct: Math.round((Number(borrow.value) / 30_000) * 100) });
    $('#ln-price-out').textContent = usd(p);
    price.setAttribute('aria-valuetext', t('ln.valuetext', { price: usd(p), hf: Number.isFinite(hf) ? fmt(hf, 2) : t('ln.noDebt') }));
    $('#ln-coll').textContent = t('ln.coll', { eth: fmt(collateral, 3), usd: usd(value) });
    $('#ln-debt').textContent = usdc(debt);
    $('#ln-hf').textContent = Number.isFinite(hf) ? fmt(hf, 2) : t('ln.hfNone');
    $('#ln-liq').textContent = debt > 0 ? usd(liquidationPrice(collateral, THRESHOLD, debt)) : t('ln.never');
    liqBtn.disabled = !(hf < 1);

    if (liquidated) {
      verdict.className = 'verdict bad';
      verdict.textContent = liquidated;
    } else if (!(debt > 0)) {
      verdict.className = 'verdict neutral';
      verdict.textContent = t('ln.v.none');
    } else if (hf < 1) {
      verdict.className = 'verdict bad';
      verdict.textContent = t('ln.v.bad', { hf: fmt(hf, 2) });
    } else if (hf < 1.2) {
      verdict.className = 'verdict warn';
      verdict.textContent = t('ln.v.warn', { hf: fmt(hf, 2), pct: Math.round((1 - 1 / hf) * 100) });
    } else {
      verdict.className = 'verdict ok';
      verdict.textContent = t('ln.v.ok', { hf: fmt(hf, 2), pct: Math.round((1 - 1 / hf) * 100) });
    }
  }

  liqBtn.addEventListener('click', () => {
    const p = Number(price.value);
    const repay = position.debt * CLOSE_FACTOR;
    const seized = Math.min(position.collateral, (repay * (1 + BONUS)) / p);
    position = { collateral: position.collateral - seized, debt: position.debt - repay };
    const bonusEth = seized - repay / p;
    liquidated = t('ln.liquidated', { repay: usdc(repay), seized: fmt(seized, 3), seizedUsd: usd(seized * p), bonus: fmt(bonusEth, 3), bonusUsd: usd(bonusEth * p) });
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
