/* BIP-32 hierarchical deterministic (HD) wallets: one seed → a tree of key pairs.

   master:  I = HMAC-SHA512("Bitcoin seed", seed);  key = I[0:32], chain code = I[32:64]
   child i: I = HMAC-SHA512(chain code, data);       key = (I[0:32] + parent key) mod n
            data = 0x00 ‖ parent key ‖ i   for hardened i (written i')
            data = parent public key ‖ i   for normal i
   Paths like m/44'/60'/0'/0/0 (BIP-44: purpose / coin / account / change / index). */

import { N, mod, getPublicKey, encodePoint } from './secp256k1.js';
import { bigIntToBytes, bytesToBigInt, concatBytes, uint32BE, utf8 } from './bytes.js';

export const HARDENED = 0x80000000;

async function hmacSha512(key, data) {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, data));
}

export async function masterKeyFromSeed(seed) {
  const I = await hmacSha512(utf8('Bitcoin seed'), seed);
  return { privateKey: bytesToBigInt(I.subarray(0, 32)), chainCode: I.slice(32) };
}

export async function deriveChild(parent, index) {
  const data = index >= HARDENED
    ? concatBytes(new Uint8Array([0]), bigIntToBytes(parent.privateKey), uint32BE(index))
    : concatBytes(encodePoint(getPublicKey(parent.privateKey)), uint32BE(index));
  const I = await hmacSha512(parent.chainCode, data);
  return { privateKey: mod(bytesToBigInt(I.subarray(0, 32)) + parent.privateKey, N), chainCode: I.slice(32) };
}

/* "m/44'/60'/0'/0/0" → [44 + 2³¹, 60 + 2³¹, 2³¹, 0, 0] */
export function parsePath(path) {
  const parts = path.trim().split('/');
  if (parts.shift() !== 'm') throw new Error('path must start with m');
  return parts.map((part) => {
    const hardened = /['h]$/.test(part);
    const n = Number(part.replace(/['h]$/, ''));
    if (!Number.isInteger(n) || n < 0 || n >= HARDENED) throw new Error(`bad path segment ${part}`);
    return hardened ? n + HARDENED : n;
  });
}

export async function derivePath(seed, path) {
  let node = await masterKeyFromSeed(seed);
  for (const index of parsePath(path)) node = await deriveChild(node, index);
  return node;
}
