/* Tests for the protocol and DeFi math in js/lib — run with `bun test`. */

import { describe, expect, test } from 'bun:test';

import {
  bitsToTarget, difficultyFromTarget, exactAttackProbability, MAX_TARGET, nextBaseFee, retarget,
  satoshiAttackProbability, simulateAttack,
} from '../js/lib/chain-math.js';
import {
  bestSandwich, healthFactor, impermanentLoss, liquidationPrice, quote, sandwichOutcome, swapOut,
} from '../js/lib/amm.js';

describe('double-spend race', () => {
  test('reproduces the table in the Bitcoin whitepaper (§11)', () => {
    const table = [
      [0.1, 1, 0.2045873], [0.1, 2, 0.0509779], [0.1, 5, 0.0009137], [0.1, 10, 0.0000012],
      [0.3, 5, 0.1773523], [0.3, 10, 0.0416605], [0.3, 20, 0.0024804], [0.3, 50, 0.0000006],
    ];
    for (const [q, z, p] of table) expect(satoshiAttackProbability(q, z)).toBeCloseTo(p, 7);
  });

  test('the whitepaper\'s "P < 0.1%" confirmation counts', () => {
    const needed = (q) => {
      let z = 0;
      while (satoshiAttackProbability(q, z) >= 0.001) z++;
      return z;
    };
    expect([0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4].map(needed)).toEqual([5, 8, 11, 15, 24, 41, 89]);
  });

  test('Satoshi\'s shortcut understates the risk at the depths that matter', () => {
    // Rosenfeld (2012): 10% attacker, 6 confirmations → 0.0591%, vs the whitepaper's 0.0243%
    expect(exactAttackProbability(0.1, 6)).toBeCloseTo(0.000591, 6);
    for (const q of [0.05, 0.1, 0.25]) {
      for (let z = 3; z <= 12; z++) {
        expect(exactAttackProbability(q, z)).toBeGreaterThan(satoshiAttackProbability(q, z));
      }
    }
    // …though it is slightly pessimistic for a single confirmation, where the exact answer is 2q
    expect(exactAttackProbability(0.1, 1)).toBeCloseTo(0.2, 10);
    expect(satoshiAttackProbability(0.1, 1)).toBeGreaterThan(0.2);
    expect(exactAttackProbability(0.5, 6)).toBe(1);
    expect(exactAttackProbability(0.1, 0)).toBe(1);
  });

  test('Monte Carlo agrees with the exact model', () => {
    let a = 42; // mulberry32: a small PRNG with good statistics, seeded for reproducibility
    const rand = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (const [q, z] of [[0.3, 3], [0.2, 2], [0.25, 4]]) {
      const runs = 100_000;
      let wins = 0;
      for (let i = 0; i < runs; i++) if (simulateAttack(q, z, rand)) wins++;
      expect(Math.abs(wins / runs - exactAttackProbability(q, z))).toBeLessThan(0.006);
    }
  });
});

describe('Bitcoin difficulty', () => {
  test('compact "bits" expand to the 256-bit target', () => {
    expect(bitsToTarget(0x1d00ffff).toString(16).padStart(64, '0'))
      .toBe('00000000ffff0000000000000000000000000000000000000000000000000000');
    expect(difficultyFromTarget(MAX_TARGET)).toBe(1);
    expect(difficultyFromTarget(MAX_TARGET / 1000n)).toBeCloseTo(1000, 3);
  });

  test('retarget scales with elapsed time and clamps at 4×', () => {
    const twoWeeks = 2016 * 600;
    expect(retarget(100, twoWeeks)).toBe(100);
    expect(retarget(100, twoWeeks / 2)).toBe(200);
    expect(retarget(100, twoWeeks * 2)).toBe(50);
    expect(retarget(100, twoWeeks / 10)).toBe(400);
    expect(retarget(100, twoWeeks * 10)).toBe(25);
  });
});

test('EIP-1559 base fee moves at most 12.5% per block', () => {
  expect(nextBaseFee(100, 30e6, 15e6)).toBeCloseTo(112.5, 10);
  expect(nextBaseFee(100, 0, 15e6)).toBeCloseTo(87.5, 10);
  expect(nextBaseFee(100, 15e6, 15e6)).toBe(100);
  expect(nextBaseFee(100, 22.5e6, 15e6)).toBeCloseTo(106.25, 10);
});

describe('constant-product AMM', () => {
  test('swaps follow x·y = k, and fees make k grow', () => {
    const [x, y] = [100, 300_000];
    const out = swapOut(10_000, y, x); // buy ETH with 10k USDC
    expect(out).toBeGreaterThan(0);
    expect((y + 10_000) * (x - out)).toBeGreaterThan(x * y);
    expect(swapOut(10_000, y, x, 0) * 1).toBeCloseTo(x - (x * y) / (y + 10_000), 9);
  });

  test('bigger trades suffer more price impact', () => {
    const small = quote(1_000, 300_000, 100);
    const big = quote(60_000, 300_000, 100);
    expect(big.priceImpact).toBeGreaterThan(small.priceImpact);
    expect(small.priceImpact).toBeGreaterThan(0.003 - 1e-9); // at least the fee
  });

  test('sandwich respects the victim\'s slippage limit and profits less when it is tight', () => {
    const pool = { base: 100, quote: 300_000 };
    const victimIn = 30_000;
    const fair = swapOut(victimIn, pool.quote, pool.base);
    const loose = bestSandwich(pool, victimIn, fair * 0.95);
    const tight = bestSandwich(pool, victimIn, fair * 0.995);
    expect(loose.victimOut).toBeGreaterThanOrEqual(fair * 0.95 - 1e-9);
    expect(tight.victimOut).toBeGreaterThanOrEqual(fair * 0.995 - 1e-9);
    expect(loose.profit).toBeGreaterThan(tight.profit);
    expect(sandwichOutcome(pool, victimIn, 0).profit).toBeCloseTo(0, 9);
    expect(bestSandwich(pool, victimIn, fair * 1.01)).toBeNull(); // would revert regardless
  });

  test('impermanent loss', () => {
    expect(impermanentLoss(1)).toBe(0);
    expect(impermanentLoss(4)).toBeCloseTo(-0.2, 10);
    expect(impermanentLoss(0.25)).toBeCloseTo(-0.2, 10); // symmetric in log-price
    expect(impermanentLoss(2)).toBeCloseTo(-0.0572, 4);
  });

  test('lending health factor and liquidation price', () => {
    expect(healthFactor(30_000, 0.8, 12_000)).toBe(2);
    expect(liquidationPrice(10, 0.8, 12_000)).toBe(1_500);
    expect(healthFactor(15_000, 0.8, 12_000)).toBe(1);
  });
});
