/* Address encodings. Each one wraps the same 20-byte hash in a different human format,
   and each carries a checksum so a mistyped address is rejected instead of paid. */

import { bytesToBigInt, bytesToHex, concatBytes } from './bytes.js';
import { keccak256 } from './keccak.js';
import { sha256d } from './sha256.js';

/* ---- Base58Check (legacy Bitcoin addresses: 1…, 3…) ---- */

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; // no 0 O I l

export function base58Encode(bytes) {
  let n = bytesToBigInt(bytes);
  let out = '';
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = `1${out}`; // each leading zero byte becomes a leading "1"
  }
  return out;
}

export function base58Decode(str) {
  let n = 0n;
  for (const ch of str) {
    const v = B58.indexOf(ch);
    if (v < 0) throw new Error(`invalid base58 character "${ch}"`);
    n = n * 58n + BigInt(v);
  }
  const hex = n === 0n ? '' : n.toString(16);
  const body = (hex.length % 2 ? '0' : '') + hex;
  const leading = str.match(/^1*/)[0].length;
  const bytes = new Uint8Array(leading + body.length / 2);
  for (let i = 0; i < body.length / 2; i++) bytes[leading + i] = parseInt(body.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/* version byte + payload + first 4 bytes of SHA-256d(version + payload) */
export function base58CheckEncode(version, payload) {
  const body = concatBytes(new Uint8Array([version]), payload);
  return base58Encode(concatBytes(body, sha256d(body).subarray(0, 4)));
}

export function base58CheckDecode(str) {
  const bytes = base58Decode(str);
  if (bytes.length < 5) return null;
  const body = bytes.subarray(0, -4);
  const check = sha256d(body).subarray(0, 4);
  if (!check.every((b, i) => b === bytes[bytes.length - 4 + i])) return null;
  return { version: body[0], payload: body.subarray(1) };
}

/* ---- Bech32 (BIP-173, native SegWit v0 addresses: bc1q…) ---- */

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GENERATORS = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function polymod(values) {
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= GENERATORS[i];
  }
  return chk;
}

const hrpExpand = (hrp) => [...hrp].map((c) => c.charCodeAt(0) >> 5)
  .concat([0], [...hrp].map((c) => c.charCodeAt(0) & 31));

/* Regroup a bit stream from `from`-bit to `to`-bit words (8 → 5 for bech32). */
function convertBits(data, from, to, pad) {
  let acc = 0;
  let bits = 0;
  const out = [];
  const maxv = (1 << to) - 1;
  const maxAcc = (1 << (from + to - 1)) - 1;
  for (const value of data) {
    acc = ((acc << from) | value) & maxAcc;
    bits += from;
    while (bits >= to) {
      bits -= to;
      out.push((acc >> bits) & maxv);
    }
  }
  if (pad && bits > 0) out.push((acc << (to - bits)) & maxv);
  else if (!pad && (bits >= from || ((acc << (to - bits)) & maxv))) return null;
  return out;
}

export function segwitEncode(hrp, version, program) {
  const data = [version, ...convertBits(program, 8, 5, true)];
  const mod = polymod([...hrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0]) ^ 1;
  const checksum = Array.from({ length: 6 }, (_, i) => (mod >>> (5 * (5 - i))) & 31);
  return `${hrp}1${[...data, ...checksum].map((d) => BECH32_CHARSET[d]).join('')}`;
}

export function segwitDecode(addr) {
  const lower = addr.toLowerCase();
  if (addr !== lower && addr !== addr.toUpperCase()) return null; // no mixed case
  const sep = lower.lastIndexOf('1');
  if (sep < 1 || sep + 7 > lower.length) return null;
  const hrp = lower.slice(0, sep);
  const data = [...lower.slice(sep + 1)].map((c) => BECH32_CHARSET.indexOf(c));
  if (data.includes(-1)) return null;
  if (polymod([...hrpExpand(hrp), ...data]) !== 1) return null; // checksum failed
  const program = convertBits(data.slice(1, -6), 5, 8, false);
  if (!program) return null;
  return { hrp, version: data[0], program: Uint8Array.from(program) };
}

/* ---- EIP-55 (Ethereum mixed-case checksum: 0x…) ---- */

/* Capitalize hex letter i when the i-th nibble of keccak256(lowercase address) is ≥ 8. */
export function toChecksumAddress(hex40) {
  const lower = hex40.replace(/^0x/i, '').toLowerCase();
  const hash = bytesToHex(keccak256(new TextEncoder().encode(lower)));
  return `0x${[...lower].map((c, i) => (parseInt(hash[i], 16) >= 8 ? c.toUpperCase() : c)).join('')}`;
}

/* 'valid' | 'invalid' | 'unchecked' (all one case: carries no checksum at all). */
export function checkEip55(address) {
  const body = address.replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{40}$/.test(body)) return 'invalid';
  if (body === body.toLowerCase() || body === body.toUpperCase()) return 'unchecked';
  return toChecksumAddress(body) === `0x${body}` ? 'valid' : 'invalid';
}

/* ---- IPFS content identifiers (CIDv1, raw codec, SHA-256) ---- */

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567'; // RFC 4648, lowercase, unpadded

function base32Encode(bytes) {
  let out = '';
  let acc = 0;
  let bits = 0;
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32[(acc >>> bits) & 31];
    }
  }
  if (bits > 0) out += BASE32[(acc << (5 - bits)) & 31];
  return out;
}

/* "b" (base32) + version 1 + raw codec 0x55 + multihash (0x12 = sha2-256, 0x20 = 32 bytes).
   This is the CID `ipfs add --cid-version 1` gives a small file: the address IS the hash. */
export const cidV1Raw = (sha256Digest) =>
  `b${base32Encode(concatBytes(new Uint8Array([0x01, 0x55, 0x12, 0x20]), sha256Digest))}`;
