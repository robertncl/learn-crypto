/* One private key, many address formats. */

import { getPublicKey, encodePoint } from './secp256k1.js';
import { bigIntToBytes, bytesToHex, concatBytes } from './bytes.js';
import { keccak256 } from './keccak.js';
import { hash160 } from './ripemd160.js';
import { base58CheckEncode, segwitEncode, toChecksumAddress } from './encoding.js';

/* Ethereum: last 20 bytes of keccak256(x ‖ y), shown with the EIP-55 checksum. */
export function ethereumAddress(publicKey) {
  const hash = keccak256(concatBytes(bigIntToBytes(publicKey.x), bigIntToBytes(publicKey.y)));
  return toChecksumAddress(bytesToHex(hash.subarray(12)));
}

/* Bitcoin: HASH160 of the 33-byte compressed public key, then either Base58Check
   with version 0x00 (legacy P2PKH, "1…") or Bech32 SegWit v0 (P2WPKH, "bc1q…"). */
export function bitcoinAddresses(publicKey) {
  const h160 = hash160(encodePoint(publicKey, true));
  return {
    hash160: h160,
    p2pkh: base58CheckEncode(0x00, h160),
    p2wpkh: segwitEncode('bc', 0, h160),
  };
}

export const addressesForKey = (privateKey) => {
  const publicKey = getPublicKey(privateKey);
  return { publicKey, ethereum: ethereumAddress(publicKey), ...bitcoinAddresses(publicKey) };
};
