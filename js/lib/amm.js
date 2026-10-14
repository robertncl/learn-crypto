/* DeFi math: constant-product AMMs (Uniswap v2 style), sandwich attacks,
   impermanent loss and over-collateralized lending. Pure functions on plain numbers. */

export const SWAP_FEE = 0.003; // 0.3%, kept by the pool for liquidity providers

/* x · y = k: sell `amountIn` of one token, receive `out` of the other.
   The fee is taken from the input, so k grows slightly with every trade. */
export function swapOut(amountIn, reserveIn, reserveOut, fee = SWAP_FEE) {
  if (amountIn <= 0) return 0;
  const inAfterFee = amountIn * (1 - fee);
  return (inAfterFee * reserveOut) / (reserveIn + inAfterFee);
}

/* Full quote for a trade, including price impact relative to the pre-trade spot price. */
export function quote(amountIn, reserveIn, reserveOut, fee = SWAP_FEE) {
  const out = swapOut(amountIn, reserveIn, reserveOut, fee);
  const spot = reserveOut / reserveIn; // output tokens per input token, before the trade
  const effective = amountIn > 0 ? out / amountIn : spot;
  return {
    out,
    spot,
    effective,
    priceImpact: 1 - effective / spot, // includes the fee
    reserveIn: reserveIn + amountIn,
    reserveOut: reserveOut - out,
  };
}

/* Sandwich: the attacker buys right before the victim (pushing the price up), lets the
   victim buy at the worse price, then sells right after. The victim's slippage limit
   (`minOut`) caps how far the attacker can push. Pool is (base, quote) — the victim
   pays `victimIn` of the quote token to buy the base token. */
export function sandwichOutcome(pool, victimIn, frontIn) {
  const frontOut = swapOut(frontIn, pool.quote, pool.base);
  const afterFront = { base: pool.base - frontOut, quote: pool.quote + frontIn };
  const victimOut = swapOut(victimIn, afterFront.quote, afterFront.base);
  const afterVictim = { base: afterFront.base - victimOut, quote: afterFront.quote + victimIn };
  const backOut = swapOut(frontOut, afterVictim.base, afterVictim.quote);
  return { frontOut, victimOut, backOut, profit: backOut - frontIn, afterFront, afterVictim };
}

/* Largest profitable front-run that still lets the victim's trade clear its minimum. */
export function bestSandwich(pool, victimIn, minOut) {
  if (swapOut(victimIn, pool.quote, pool.base) < minOut) return null; // would revert anyway
  let lo = 0;
  let hi = pool.quote * 10;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (sandwichOutcome(pool, victimIn, mid).victimOut >= minOut) lo = mid;
    else hi = mid;
  }
  // Profit rises with the front-run size until the cap in practice, but scan to be safe.
  let best = { frontIn: 0, ...sandwichOutcome(pool, victimIn, 0) };
  for (let i = 1; i <= 200; i++) {
    const frontIn = (lo * i) / 200;
    const outcome = sandwichOutcome(pool, victimIn, frontIn);
    if (outcome.profit > best.profit) best = { frontIn, ...outcome };
  }
  return best;
}

/* Liquidity provider value vs simply holding, after the price moves by ratio r.
   LP / HODL = 2√r / (1 + r); impermanent loss is that minus 1 (≤ 0). Fees not included. */
export const impermanentLoss = (r) => (2 * Math.sqrt(r)) / (1 + r) - 1;

/* Lending: health factor = collateral value × liquidation threshold ÷ debt. Below 1 → liquidatable. */
export const healthFactor = (collateralValue, liquidationThreshold, debt) =>
  debt > 0 ? (collateralValue * liquidationThreshold) / debt : Infinity;

/* Collateral price at which the health factor hits exactly 1. */
export const liquidationPrice = (collateralAmount, liquidationThreshold, debt) =>
  debt / (collateralAmount * liquidationThreshold);
