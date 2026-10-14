/* secp256k1 — the elliptic curve behind Bitcoin and Ethereum keys — plus ECDSA.

   Curve: y² = x³ + 7 over the prime field F_p. G generates a group of prime order n.
   A private key is an integer d in [1, n); its public key is the point d × G.

   This is a teaching implementation with BigInt: correct (it is checked against
   libsecp256k1 in tests/crypto.test.js), but NOT constant-time — never use it to
   protect real funds. */

import { bigIntToBytes, bytesToBigInt, concatBytes } from './bytes.js';
import { hmacSha256 } from './hmac.js';

export const P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
export const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
export const G = {
  x: 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n,
  y: 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n,
};

export const mod = (a, m = P) => {
  const r = a % m;
  return r >= 0n ? r : r + m;
};

/* Modular inverse via the extended Euclidean algorithm. */
export function invert(a, m = P) {
  let [oldR, r] = [mod(a, m), m];
  let [oldS, s] = [1n, 0n];
  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }
  if (oldR !== 1n) throw new Error('not invertible');
  return mod(oldS, m);
}

/* ---- Point arithmetic in Jacobian coordinates: (X, Y, Z) ↔ affine (X/Z², Y/Z³). ---- */

const INFINITY = { X: 0n, Y: 1n, Z: 0n };

function jacDouble({ X, Y, Z }) {
  if (Z === 0n || Y === 0n) return INFINITY;
  const YY = mod(Y * Y);
  const S = mod(4n * X * YY);
  const M = mod(3n * X * X); // a = 0 for secp256k1
  const X3 = mod(M * M - 2n * S);
  const Y3 = mod(M * (S - X3) - 8n * YY * YY);
  const Z3 = mod(2n * Y * Z);
  return { X: X3, Y: Y3, Z: Z3 };
}

function jacAdd(p1, p2) {
  if (p1.Z === 0n) return p2;
  if (p2.Z === 0n) return p1;
  const Z1Z1 = mod(p1.Z * p1.Z);
  const Z2Z2 = mod(p2.Z * p2.Z);
  const U1 = mod(p1.X * Z2Z2);
  const U2 = mod(p2.X * Z1Z1);
  const S1 = mod(p1.Y * p2.Z * Z2Z2);
  const S2 = mod(p2.Y * p1.Z * Z1Z1);
  if (U1 === U2) return S1 === S2 ? jacDouble(p1) : INFINITY;
  const H = mod(U2 - U1);
  const R = mod(S2 - S1);
  const HH = mod(H * H);
  const HHH = mod(H * HH);
  const V = mod(U1 * HH);
  const X3 = mod(R * R - HHH - 2n * V);
  const Y3 = mod(R * (V - X3) - S1 * HHH);
  const Z3 = mod(H * p1.Z * p2.Z);
  return { X: X3, Y: Y3, Z: Z3 };
}

const toJac = (p) => (p ? { X: p.x, Y: p.y, Z: 1n } : INFINITY);

function toAffine({ X, Y, Z }) {
  if (Z === 0n) return null; // the point at infinity
  const zInv = invert(Z);
  const zInv2 = mod(zInv * zInv);
  return { x: mod(X * zInv2), y: mod(Y * zInv2 * zInv) };
}

/* Affine helpers (null = point at infinity). */
export const pointAdd = (a, b) => toAffine(jacAdd(toJac(a), toJac(b)));
export const pointDouble = (a) => toAffine(jacDouble(toJac(a)));

/* Double-and-add: ~256 doublings plus one addition per set bit of k. */
export function multiply(k, point = G) {
  let result = INFINITY;
  let addend = toJac(point);
  let scalar = mod(k, N);
  while (scalar > 0n) {
    if (scalar & 1n) result = jacAdd(result, addend);
    addend = jacDouble(addend);
    scalar >>= 1n;
  }
  return toAffine(result);
}

export const isOnCurve = ({ x, y }) => mod(y * y - x * x * x - 7n) === 0n;

export const getPublicKey = (privateKey) => multiply(privateKey, G);

/* SEC1 encodings: 33-byte compressed (02/03 + x) and 65-byte uncompressed (04 + x + y). */
export function encodePoint(point, compressed = true) {
  const x = bigIntToBytes(point.x);
  if (compressed) return concatBytes(new Uint8Array([point.y & 1n ? 0x03 : 0x02]), x);
  return concatBytes(new Uint8Array([0x04]), x, bigIntToBytes(point.y));
}

/* ---- ECDSA ---- */

/* RFC 6979 deterministic nonce: k derived from the private key and the message hash,
   so it is unpredictable to outsiders yet never accidentally repeats. */
export function rfc6979Nonce(privateKey, msgHash) {
  const x = bigIntToBytes(privateKey);
  const h = bigIntToBytes(mod(bytesToBigInt(msgHash), N));
  let V = new Uint8Array(32).fill(0x01);
  let K = new Uint8Array(32);
  K = hmacSha256(K, concatBytes(V, new Uint8Array([0x00]), x, h));
  V = hmacSha256(K, V);
  K = hmacSha256(K, concatBytes(V, new Uint8Array([0x01]), x, h));
  V = hmacSha256(K, V);
  for (;;) {
    V = hmacSha256(K, V);
    const k = bytesToBigInt(V);
    if (k > 0n && k < N) return k;
    K = hmacSha256(K, concatBytes(V, new Uint8Array([0x00])));
    V = hmacSha256(K, V);
  }
}

/* Sign a 32-byte message hash with nonce k: r = (k·G).x mod n, s = k⁻¹(z + r·d) mod n.
   (Bitcoin additionally normalizes s to the lower half of the range — "low-s" — which
   is omitted here so the algebra in the nonce-reuse demo stays textbook.) */
export function sign(msgHash, privateKey, k = rfc6979Nonce(privateKey, msgHash)) {
  const z = bytesToBigInt(msgHash);
  const R = multiply(k, G);
  const r = mod(R.x, N);
  const s = mod(invert(k, N) * (z + r * privateKey), N);
  if (r === 0n || s === 0n) throw new Error('bad nonce, pick another k');
  return { r, s };
}

export function verify(msgHash, { r, s }, publicKey) {
  if (r <= 0n || r >= N || s <= 0n || s >= N) return false;
  const z = bytesToBigInt(msgHash);
  const w = invert(s, N);
  const u1 = mod(z * w, N);
  const u2 = mod(r * w, N);
  const X = toAffine(jacAdd(toJac(multiply(u1, G)), toJac(multiply(u2, publicKey))));
  return X !== null && mod(X.x, N) === r;
}

/* The nonce-reuse attack: two signatures that share k (hence share r) leak the key.
     s1 − s2 = k⁻¹(z1 − z2)  ⇒  k = (z1 − z2) / (s1 − s2)
     s1 = k⁻¹(z1 + r·d)      ⇒  d = (s1·k − z1) / r                          */
export function recoverFromNonceReuse(z1, sig1, z2, sig2) {
  if (sig1.r !== sig2.r) return null;
  const k = mod((z1 - z2) * invert(mod(sig1.s - sig2.s, N), N), N);
  const d = mod((sig1.s * k - z1) * invert(sig1.r, N), N);
  return { k, d };
}

