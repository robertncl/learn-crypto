/* The 80-byte Bitcoin block header: parse, serialize, hash.

   Every multi-byte field is stored little-endian. Hashes are displayed byte-reversed
   (as big-endian numbers), which is why a block hash's famous leading zeros sit at
   the END of the raw SHA-256d output. */

import { bytesToHex, concatBytes, hexToBytes, reverseBytes, uint32LE } from './bytes.js';
import { sha256d } from './sha256.js';

const readLE32 = (b, at) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;

/* Byte ranges of each field, for colour-coding the raw header. */
export const HEADER_LAYOUT = [
  { key: 'version', label: 'version', start: 0, end: 4 },
  { key: 'prevHash', label: 'previous block hash', start: 4, end: 36 },
  { key: 'merkleRoot', label: 'Merkle root', start: 36, end: 68 },
  { key: 'time', label: 'time', start: 68, end: 72 },
  { key: 'bits', label: 'bits (target)', start: 72, end: 76 },
  { key: 'nonce', label: 'nonce', start: 76, end: 80 },
];

export function parseHeader(hex) {
  const b = hexToBytes(hex);
  if (b.length !== 80) throw new Error('a block header is exactly 80 bytes');
  return {
    version: readLE32(b, 0),
    prevHash: bytesToHex(reverseBytes(b.subarray(4, 36))),
    merkleRoot: bytesToHex(reverseBytes(b.subarray(36, 68))),
    time: readLE32(b, 68),
    bits: readLE32(b, 72),
    nonce: readLE32(b, 76),
  };
}

export function serializeHeader(h) {
  return concatBytes(
    uint32LE(h.version),
    reverseBytes(hexToBytes(h.prevHash)),
    reverseBytes(hexToBytes(h.merkleRoot)),
    uint32LE(h.time),
    uint32LE(h.bits),
    uint32LE(h.nonce),
  );
}

/* The block hash as explorers display it. */
export const blockHash = (headerBytes) => bytesToHex(reverseBytes(sha256d(headerBytes)));
