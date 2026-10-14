/* Protocol math used by the mining, consensus and Ethereum demos. Pure functions. */

/* ---- Double-spend race: how likely is an attacker with hashpower share q to
   overturn a payment buried under z confirmations? "Catching up" = drawing level
   with the honest chain; from z blocks behind that happens with probability (q/p)^z. */

/* Bitcoin whitepaper §11 (2008): the attacker's progress during the z honest blocks
   is approximated as Poisson with mean λ = z·q/p. */
export function satoshiAttackProbability(q, z) {
  const p = 1 - q;
  if (q >= p) return 1;
  const lambda = z * (q / p);
  let sum = 1;
  let poisson = Math.exp(-lambda);
  for (let k = 0; k <= z; k++) {
    if (k > 0) poisson *= lambda / k;
    sum -= poisson * (1 - (q / p) ** (z - k));
  }
  return Math.min(1, Math.max(0, sum));
}

const binomial = (n, k) => {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
};

/* Exact version (M. Rosenfeld, 2012): attacker blocks found while the honest chain
   finds z blocks follow a negative binomial distribution, not a Poisson one.
   Satoshi's estimate is optimistic — the exact risk is higher. */
export function exactAttackProbability(q, z) {
  const p = 1 - q;
  if (q >= p || z === 0) return 1;
  let sum = 0;
  for (let m = 0; m <= z; m++) sum += binomial(m + z - 1, m) * (p ** z * q ** m - q ** z * p ** m);
  return Math.min(1, Math.max(0, 1 - sum));
}

/* Play one race block by block. Gives up when the attacker is `cutoff` blocks behind
   (the chance of recovering from there is (q/p)^cutoff — negligible). */
export function simulateAttack(q, z, rand = Math.random, cutoff = 80) {
  let honest = 0;
  let attacker = 0;
  while (honest < z) {
    if (rand() < q) attacker++;
    else honest++;
  }
  let deficit = honest - attacker;
  while (deficit > 0 && deficit < cutoff) deficit += rand() < q ? -1 : 1;
  return deficit <= 0;
}

/* ---- Bitcoin difficulty ---- */

/* "bits" is a compact float: 1 byte exponent, 3 bytes mantissa. target = m · 256^(e−3) */
export function bitsToTarget(bits) {
  const exponent = BigInt(bits >>> 24);
  const mantissa = BigInt(bits & 0x007fffff);
  return exponent <= 3n ? mantissa >> (8n * (3n - exponent)) : mantissa << (8n * (exponent - 3n));
}

/* Difficulty 1 = the genesis target (bits 0x1d00ffff). */
export const MAX_TARGET = bitsToTarget(0x1d00ffff);

export const difficultyFromTarget = (target) => Number((MAX_TARGET * 1_000_000n) / target) / 1_000_000;

/* Every 2,016 blocks: scale difficulty by (expected time / actual time), clamped to 4× either way. */
export const RETARGET_BLOCKS = 2016;
export const TARGET_SPACING = 600; // seconds

export function retarget(difficulty, actualSeconds) {
  const ratio = (RETARGET_BLOCKS * TARGET_SPACING) / actualSeconds;
  return difficulty * Math.min(4, Math.max(0.25, ratio));
}

/* ---- Ethereum EIP-1559 ---- */

/* The base fee moves by at most 1/8 per block, in proportion to how far the block
   was from the gas target: full block (2× target) → +12.5%, empty → −12.5%. */
export const nextBaseFee = (baseFee, gasUsed, gasTarget) =>
  baseFee * (1 + (gasUsed - gasTarget) / gasTarget / 8);
