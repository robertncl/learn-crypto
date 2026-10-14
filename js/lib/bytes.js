/* Byte, hex and BigInt conversions shared by the crypto libraries.
   Everything here is pure (no DOM), so it runs in the browser and in `bun test`. */

const utf8Encoder = new TextEncoder();

export const utf8 = (str) => utf8Encoder.encode(str);

export function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex) {
  const clean = hex.replace(/^0x/i, '');
  if (clean.length % 2 || /[^0-9a-f]/i.test(clean)) throw new Error(`invalid hex: ${hex}`);
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function concatBytes(...arrays) {
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

export const bytesToBigInt = (bytes) => (bytes.length ? BigInt(`0x${bytesToHex(bytes)}`) : 0n);

export function bigIntToBytes(n, length = 32) {
  return hexToBytes(n.toString(16).padStart(length * 2, '0'));
}

export const bigIntToHex = (n, length = 32) => n.toString(16).padStart(length * 2, '0');

/* Big-endian 32-bit integer → 4 bytes (BIP-32 child indexes). */
export function uint32BE(n) {
  return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}

/* Little-endian 32-bit integer → 4 bytes (Bitcoin header fields). */
export function uint32LE(n) {
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
}

export const reverseBytes = (bytes) => Uint8Array.from(bytes).reverse();

/* Uniform random integer in [1, max) — rejection sampling, no modulo bias. */
export function randomBigIntBelow(max) {
  const len = Math.ceil(max.toString(16).length / 2);
  for (;;) {
    const candidate = bytesToBigInt(crypto.getRandomValues(new Uint8Array(len)));
    if (candidate > 0n && candidate < max) return candidate;
  }
}
