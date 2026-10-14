/* The real block headers used by Module 3 must prove themselves. */

import { describe, expect, test } from 'bun:test';

import { REAL_BLOCKS } from '../js/data/bitcoin-blocks.js';
import { blockHash, parseHeader, serializeHeader } from '../js/lib/bitcoin-header.js';
import { bitsToTarget, difficultyFromTarget } from '../js/lib/chain-math.js';
import { bytesToHex } from '../js/lib/bytes.js';

describe('real Bitcoin headers', () => {
  for (const block of REAL_BLOCKS) {
    test(`block #${block.height}`, () => {
      const fields = parseHeader(block.header);
      const bytes = serializeHeader(fields);
      expect(bytesToHex(bytes)).toBe(block.header); // parse/serialize round trip
      expect(blockHash(bytes)).toBe(block.hash); // SHA-256d, byte-reversed
      expect(BigInt(`0x${block.hash}`) <= bitsToTarget(fields.bits)).toBe(true); // valid proof of work
      const wrongNonce = serializeHeader({ ...fields, nonce: fields.nonce + 1 });
      expect(BigInt(`0x${blockHash(wrongNonce)}`) <= bitsToTarget(fields.bits)).toBe(false);
    });
  }

  test('each header links to its parent', () => {
    expect(parseHeader(REAL_BLOCKS[1].header).prevHash).toBe(REAL_BLOCKS[0].hash);
    expect(parseHeader(REAL_BLOCKS[0].header).prevHash).toBe('0'.repeat(64));
  });

  test('facts quoted in the notes', () => {
    const date = (i) => new Date(parseHeader(REAL_BLOCKS[i].header).time * 1000).toISOString().slice(0, 10);
    expect(REAL_BLOCKS.map((_, i) => date(i))).toEqual(['2009-01-03', '2009-01-09', '2009-01-12', '2012-11-28', '2024-04-20']);
    const difficulty = (i) => difficultyFromTarget(bitsToTarget(parseHeader(REAL_BLOCKS[i].header).bits));
    expect(difficulty(0)).toBe(1);
    expect(Math.round(difficulty(3) / 1e5) / 10).toBe(3.4); // ~3.4 million at the first halving
    expect(Math.round(difficulty(4) / 1e12)).toBe(86); // ~86 trillion at the fourth
    expect(parseHeader(REAL_BLOCKS[4].header).version.toString(16)).toBe('2a5fe000');
  });
});
