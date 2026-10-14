/* HMAC-SHA256 (RFC 2104), synchronous — used to derive deterministic ECDSA nonces
   (RFC 6979). HMAC-SHA512 for HD wallets comes from WebCrypto instead (see bip32.js). */

import { sha256 } from './sha256.js';
import { concatBytes } from './bytes.js';

const BLOCK = 64;

export function hmacSha256(key, message) {
  const k = key.length > BLOCK ? sha256(key) : key;
  const padded = new Uint8Array(BLOCK);
  padded.set(k);
  const ipad = padded.map((b) => b ^ 0x36);
  const opad = padded.map((b) => b ^ 0x5c);
  return sha256(concatBytes(opad, sha256(concatBytes(ipad, message))));
}
