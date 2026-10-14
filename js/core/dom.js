/* Shared DOM and browser helpers used by every module. */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const enc = new TextEncoder();
export const SUBTLE_OK = Boolean(globalThis.crypto?.subtle);

export async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* Let the browser paint and run other queued work between slices of a long loop
   (the miner, collision hunts, header search). These loops run for seconds, so they
   yield with an ordinary-priority task — scheduler.yield() would resume them *ahead*
   of everything else and starve timers and other tasks for as long as they run.
   A MessageChannel message is an ordinary task without setTimeout's 4 ms clamp. */
export function yieldToMain() {
  return new Promise((resolve) => {
    const { port1, port2 } = new MessageChannel();
    port1.onmessage = () => {
      port1.close();
      resolve();
    };
    port2.postMessage(null);
  });
}

/* Tiny element factory: el('p', { className: 'x', textContent: 'hi' }, child, 'text').
   Keys starting with "data-" or "aria-" (and "role"/"for") become attributes. */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('data-') || key.startsWith('aria-') || key === 'role' || key === 'for') {
      node.setAttribute(key, value === true ? '' : String(value));
    } else {
      node[key] = value;
    }
  }
  node.append(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

/* SVG elements need the SVG namespace; attributes are always set as attributes. */
const SVG_NS = 'http://www.w3.org/2000/svg';
export function svgEl(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    node.setAttribute(key, String(value));
  }
  node.append(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

/* Formatting helpers shared by the demos. */
export const fmt = (n, digits = 0) =>
  Number(n).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

const SUPERSCRIPT = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

/* 1.2K / 3.4M / 5.6T — and 3.7 × 10²³ beyond that, where "compact" runs out of words. */
export function fmtCompact(n) {
  const x = Number(n);
  if (Math.abs(x) >= 1e15) {
    const [mantissa, exponent] = x.toExponential(1).split('e');
    return `${mantissa} × 10${[...String(Number(exponent))].map((c) => SUPERSCRIPT[c]).join('')}`;
  }
  return x.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 2 });
}

const AGE_OF_UNIVERSE_YEARS = 1.38e10;

/* Human-scale durations, from seconds up to multiples of the age of the universe. */
export function fmtDuration(seconds) {
  const years = seconds / (365.25 * 86400);
  if (seconds < 120) return `${Math.max(1, Math.round(seconds))} seconds`;
  if (seconds < 7200) return `${Math.round(seconds / 60)} minutes`;
  if (seconds < 172800) return `${Math.round(seconds / 3600)} hours`;
  if (years < 2) return `${Math.round(seconds / 86400)} days`;
  if (years < 1000) return `${years < 10 ? years.toFixed(1) : Math.round(years)} years`;
  if (years < AGE_OF_UNIVERSE_YEARS) return `${fmtCompact(years)} years`;
  return `${fmtCompact(years)} years — ${fmtCompact(years / AGE_OF_UNIVERSE_YEARS)}× the age of the universe`;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
