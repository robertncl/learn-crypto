/* Keccak-256 — the hash Ethereum uses for addresses, function selectors and storage.

   Ethereum adopted Keccak before NIST finalized it as SHA-3, and NIST then changed one
   padding byte (0x01 → 0x06). Same permutation, different output, so "SHA3-256" and
   Ethereum's "keccak256" are NOT interchangeable. Both are exported; the tests check
   the permutation against a standard SHA3-256 and the padding against Ethereum vectors.

   Lanes are BigInts for readability: 25 × 64-bit words, 24 rounds of θ ρ π χ ι. */

const MASK = (1n << 64n) - 1n;

const ROUND_CONSTANTS = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];

/* Rotation offsets for lane (x, y), stored at index x + 5y. */
const ROTATIONS = [
  0, 1, 62, 28, 27,
  36, 44, 6, 55, 20,
  3, 10, 43, 25, 39,
  41, 45, 15, 21, 8,
  18, 2, 61, 56, 14,
];

const rotl = (x, n) => (n === 0 ? x : ((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK);

function keccakF1600(A) {
  const C = new Array(5);
  const B = new Array(25);
  for (let round = 0; round < 24; round++) {
    // θ: mix each column's parity into its neighbours
    for (let x = 0; x < 5; x++) C[x] = A[x] ^ A[x + 5] ^ A[x + 10] ^ A[x + 15] ^ A[x + 20];
    for (let x = 0; x < 5; x++) {
      const D = C[(x + 4) % 5] ^ rotl(C[(x + 1) % 5], 1);
      for (let y = 0; y < 25; y += 5) A[x + y] ^= D;
    }
    // ρ + π: rotate every lane, then move lane (x, y) to (y, 2x + 3y)
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        B[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(A[x + 5 * y], ROTATIONS[x + 5 * y]);
      }
    }
    // χ: the only non-linear step
    for (let y = 0; y < 25; y += 5) {
      for (let x = 0; x < 5; x++) {
        A[x + y] = B[x + y] ^ (~B[((x + 1) % 5) + y] & B[((x + 2) % 5) + y]);
      }
    }
    // ι: break symmetry between rounds
    A[0] ^= ROUND_CONSTANTS[round];
  }
}

/* Sponge with a 1088-bit rate (136 bytes) and 256-bit output. */
function sponge(message, domainByte) {
  const RATE = 136;
  const A = new Array(25).fill(0n);
  const padded = new Uint8Array((Math.floor(message.length / RATE) + 1) * RATE);
  padded.set(message);
  padded[message.length] ^= domainByte;
  padded[padded.length - 1] ^= 0x80;

  for (let off = 0; off < padded.length; off += RATE) {
    for (let i = 0; i < RATE / 8; i++) {
      let lane = 0n;
      for (let b = 7; b >= 0; b--) lane = (lane << 8n) | BigInt(padded[off + i * 8 + b]);
      A[i] ^= lane;
    }
    keccakF1600(A);
  }

  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = Number((A[i >> 3] >> BigInt(8 * (i & 7))) & 0xffn);
  return out;
}

export const keccak256 = (bytes) => sponge(bytes, 0x01);
export const sha3_256 = (bytes) => sponge(bytes, 0x06);
