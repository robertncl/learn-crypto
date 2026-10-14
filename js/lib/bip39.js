/* BIP-39 seed phrases: random entropy + a SHA-256 checksum, written as words.

   128 bits of entropy + 4 checksum bits = 132 bits = 12 groups of 11 bits, and each
   11-bit number (0–2047) picks one word from the fixed list. The phrase is then
   stretched into a 64-byte seed with PBKDF2-HMAC-SHA512 (2,048 rounds). */

import { BIP39_ENGLISH } from '../data/bip39-english.js';
import { sha256 } from './sha256.js';
import { utf8 } from './bytes.js';

export const WORDLIST = BIP39_ENGLISH;

const toBits = (bytes) => [...bytes].map((b) => b.toString(2).padStart(8, '0')).join('');

/* Returns every intermediate value so the demo can show the whole pipeline. */
export function entropyToMnemonic(entropy) {
  if (![16, 20, 24, 28, 32].includes(entropy.length)) throw new Error('entropy must be 128–256 bits');
  const entropyBits = toBits(entropy);
  const checksumBits = toBits(sha256(entropy)).slice(0, entropy.length / 4); // ENT / 32 bits
  const allBits = entropyBits + checksumBits;
  const indices = allBits.match(/.{11}/g).map((chunk) => parseInt(chunk, 2));
  return { words: indices.map((i) => WORDLIST[i]), indices, entropyBits, checksumBits };
}

/* Recompute the checksum from the words. Unknown words → { ok: false, unknown }. */
export function checkMnemonic(words) {
  const indices = words.map((w) => WORDLIST.indexOf(w));
  const unknown = words.filter((_, i) => indices[i] < 0);
  if (unknown.length) return { ok: false, unknown };
  if (![12, 15, 18, 21, 24].includes(words.length)) return { ok: false, unknown: [] };

  const bits = indices.map((i) => i.toString(2).padStart(11, '0')).join('');
  const csLen = words.length / 3; // 12 words → 4 checksum bits, 24 words → 8
  const entropyBits = bits.slice(0, -csLen);
  const entropy = Uint8Array.from(entropyBits.match(/.{8}/g), (byte) => parseInt(byte, 2));
  const expected = toBits(sha256(entropy)).slice(0, csLen);
  const actual = bits.slice(-csLen);
  return { ok: expected === actual, expected, actual, unknown: [] };
}

export async function mnemonicToSeed(mnemonic, passphrase = '') {
  const key = await crypto.subtle.importKey('raw', utf8(mnemonic.normalize('NFKD')), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-512', salt: utf8(`mnemonic${passphrase}`.normalize('NFKD')), iterations: 2048 },
    key,
    512,
  );
  return new Uint8Array(bits);
}
