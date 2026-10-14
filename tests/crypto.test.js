/* Tests for the hand-written cryptography in js/lib — run with `bun test`.
   Hashes are checked against node:crypto on random inputs; everything else
   against published test vectors (BIPs, EIPs, RFC 6979, libsecp256k1 output). */

import { describe, expect, test } from 'bun:test';
import { createHash, createHmac, randomBytes } from 'node:crypto';

import { bytesToHex, hexToBytes, utf8 } from '../js/lib/bytes.js';
import { sha256, sha256d, sha256Midstate, sha256FromMidstate } from '../js/lib/sha256.js';
import { hmacSha256 } from '../js/lib/hmac.js';
import { keccak256, sha3_256 } from '../js/lib/keccak.js';
import { ripemd160, hash160 } from '../js/lib/ripemd160.js';
import * as secp from '../js/lib/secp256k1.js';
import {
  base58CheckDecode, base58CheckEncode, checkEip55, cidV1Raw, segwitDecode, segwitEncode, toChecksumAddress,
} from '../js/lib/encoding.js';
import { addressesForKey } from '../js/lib/addresses.js';
import { checkMnemonic, entropyToMnemonic, mnemonicToSeed } from '../js/lib/bip39.js';
import { derivePath, masterKeyFromSeed, parsePath, HARDENED } from '../js/lib/bip32.js';

const hex = (bytes) => bytesToHex(bytes);
const nodeHash = (alg, data) => createHash(alg).update(data).digest('hex');
const RANDOM_LENGTHS = [0, 1, 3, 31, 32, 55, 56, 63, 64, 65, 80, 119, 135, 136, 137, 200, 271, 272, 1000];

describe('SHA-256 (sync)', () => {
  test('matches node:crypto on random inputs of tricky lengths', () => {
    for (const len of RANDOM_LENGTHS) {
      const data = randomBytes(len);
      expect(hex(sha256(data))).toBe(nodeHash('sha256', data));
    }
  });

  test('known vectors', () => {
    expect(hex(sha256(utf8('abc')))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(hex(sha256(new Uint8Array()))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  test('midstate path equals the one-shot hash for 80-byte headers', () => {
    const header = randomBytes(80);
    const mid = sha256Midstate(header.subarray(0, 64));
    expect(hex(sha256FromMidstate(mid, header.subarray(64)))).toBe(hex(sha256(header)));
    expect(hex(sha256d(header))).toBe(nodeHash('sha256', createHash('sha256').update(header).digest()));
  });
});

describe('HMAC-SHA256', () => {
  test('matches node:crypto, including keys longer than one block', () => {
    for (const keyLen of [0, 16, 64, 65, 200]) {
      const key = randomBytes(keyLen);
      const msg = randomBytes(77);
      expect(hex(hmacSha256(key, msg))).toBe(createHmac('sha256', key).update(msg).digest('hex'));
    }
  });
});

describe('Keccak-256', () => {
  test('the permutation and sponge match standard SHA3-256 (padding 0x06)', () => {
    for (const len of RANDOM_LENGTHS) {
      const data = randomBytes(len);
      expect(hex(sha3_256(data))).toBe(nodeHash('sha3-256', data));
    }
  });

  test('Ethereum Keccak padding (0x01) vectors', () => {
    expect(hex(keccak256(new Uint8Array()))).toBe('c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
    expect(hex(keccak256(utf8('abc')))).toBe('4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45');
  });

  test('ERC-20 function selectors', () => {
    const selector = (sig) => hex(keccak256(utf8(sig)).subarray(0, 4));
    expect(selector('transfer(address,uint256)')).toBe('a9059cbb');
    expect(selector('approve(address,uint256)')).toBe('095ea7b3');
    expect(selector('balanceOf(address)')).toBe('70a08231');
    expect(selector('transferFrom(address,address,uint256)')).toBe('23b872dd');
    expect(selector('totalSupply()')).toBe('18160ddd');
    expect(selector('allowance(address,address)')).toBe('dd62ed3e');
    expect(selector('safeTransferFrom(address,address,uint256)')).toBe('42842e0e');
    expect(selector('setApprovalForAll(address,bool)')).toBe('a22cb465');
    expect(selector('ownerOf(uint256)')).toBe('6352211e');
  });
});

describe('RIPEMD-160', () => {
  test('known vectors', () => {
    expect(hex(ripemd160(new Uint8Array()))).toBe('9c1185a5c5e9fc54612808977ee8f548b2258d31');
    expect(hex(ripemd160(utf8('abc')))).toBe('8eb208f7e05d987a9b044a8e98c6b087f15a0bfc');
    expect(hex(ripemd160(utf8('message digest')))).toBe('5d0689ef49d2fae572b881b123a85ffa21595f36');
  });

  test('matches node:crypto on random inputs', () => {
    for (const len of RANDOM_LENGTHS) {
      const data = randomBytes(len);
      expect(hex(ripemd160(data))).toBe(nodeHash('ripemd160', data));
    }
  });
});

describe('secp256k1 + ECDSA', () => {
  test('generator multiples (checked against libsecp256k1)', () => {
    expect(secp.isOnCurve(secp.G)).toBe(true);
    const two = secp.multiply(2n);
    expect(two.x.toString(16)).toBe('c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5');
    expect(two.y.toString(16)).toBe('1ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a');
    expect(secp.pointAdd(secp.G, secp.G)).toEqual(two);
    expect(secp.pointDouble(secp.G)).toEqual(two);
    expect(secp.multiply(3n).x.toString(16)).toBe('f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9');
    expect(secp.multiply(secp.N)).toBeNull(); // n·G = point at infinity
    expect(secp.multiply(secp.N - 1n).x).toBe(secp.G.x); // (n−1)·G = −G
  });

  test('RFC 6979 deterministic signature (key 1, "Satoshi Nakamoto")', () => {
    const h = sha256(utf8('Satoshi Nakamoto'));
    expect(secp.rfc6979Nonce(1n, h).toString(16)).toBe('8f8a276c19f4149656b280621e358cce24f5f52542772691ee69063b74f15d15');
    const { r, s } = secp.sign(h, 1n);
    const lowS = s > secp.N / 2n ? secp.N - s : s;
    expect(r.toString(16)).toBe('934b1ea10a4b3c1757e2b0c017d0b6143ce3c9a7e6a4a49860d7a6ab210ee3d8');
    expect(lowS.toString(16)).toBe('2442ce9d2b916064108014783e923ec36b49743e2ffa1c4496f01a512aafd9e5');
  });

  test('sign/verify round trip; tampering fails', () => {
    const d = 0x1234567890abcdefn;
    const pub = secp.getPublicKey(d);
    const h = sha256(utf8('Pay Bob 1 BTC'));
    const sig = secp.sign(h, d);
    expect(secp.verify(h, sig, pub)).toBe(true);
    expect(secp.verify(sha256(utf8('Pay Bob 9 BTC')), sig, pub)).toBe(false);
    expect(secp.verify(h, sig, secp.getPublicKey(d + 1n))).toBe(false);
  });

  test('reusing a nonce leaks the private key', () => {
    const d = 0xc0ffee1234n;
    const k = 0x5eedn;
    const z1 = sha256(utf8('Pay Bob 1 BTC'));
    const z2 = sha256(utf8('Pay Carol 2 BTC'));
    const sig1 = secp.sign(z1, d, k);
    const sig2 = secp.sign(z2, d, k);
    expect(sig1.r).toBe(sig2.r);
    const toInt = (b) => BigInt(`0x${hex(b)}`);
    const recovered = secp.recoverFromNonceReuse(toInt(z1), sig1, toInt(z2), sig2);
    expect(recovered.k).toBe(k);
    expect(recovered.d).toBe(d);
  });
});

describe('address encodings', () => {
  test('private key 1 → well-known Bitcoin and Ethereum addresses', () => {
    const a = addressesForKey(1n);
    expect(a.ethereum).toBe('0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf');
    expect(hex(a.hash160)).toBe('751e76e8199196d454941c45d1b3a323f1433bd6');
    expect(a.p2pkh).toBe('1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH');
    expect(a.p2wpkh).toBe('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'); // BIP-173 example
  });

  test('Base58Check round trip and checksum', () => {
    const payload = hexToBytes('751e76e8199196d454941c45d1b3a323f1433bd6');
    const addr = base58CheckEncode(0, payload);
    expect(hex(base58CheckDecode(addr).payload)).toBe(hex(payload));
    const typo = `${addr.slice(0, 10)}${addr[10] === 'x' ? 'y' : 'x'}${addr.slice(11)}`;
    expect(base58CheckDecode(typo)).toBeNull();
  });

  test('Bech32 decode and typo detection', () => {
    const decoded = segwitDecode('BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4');
    expect(decoded.version).toBe(0);
    expect(hex(decoded.program)).toBe('751e76e8199196d454941c45d1b3a323f1433bd6');
    expect(segwitEncode('bc', 0, decoded.program)).toBe('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
    expect(segwitDecode('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5')).toBeNull();
  });

  test('IPFS CIDv1 of "hello\\n" (raw codec, SHA-256)', () => {
    expect(cidV1Raw(sha256(utf8('hello\n')))).toBe('bafkreicysg23kiwv34eg2d7qweipxwosdo2py4ldv42nbauguluen5v6am');
  });

  test('EIP-55 checksums (vectors from the EIP)', () => {
    for (const addr of [
      '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
      '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
      '0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB',
      '0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb',
    ]) {
      expect(toChecksumAddress(addr.toLowerCase())).toBe(addr);
      expect(checkEip55(addr)).toBe('valid');
    }
    expect(checkEip55('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed')).toBe('unchecked');
    expect(checkEip55('0x5AAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')).toBe('invalid');
  });
});

describe('BIP-39 seed phrases', () => {
  const VECTORS = [
    ['00000000000000000000000000000000', 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'],
    ['7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f', 'legal winner thank year wave sausage worth useful legal winner thank yellow'],
    ['80808080808080808080808080808080', 'letter advice cage absurd amount doctor acoustic avoid letter advice cage above'],
    ['ffffffffffffffffffffffffffffffff', 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong'],
  ];

  test('entropy → mnemonic (official vectors)', () => {
    for (const [entropy, phrase] of VECTORS) {
      expect(entropyToMnemonic(hexToBytes(entropy)).words.join(' ')).toBe(phrase);
      expect(checkMnemonic(phrase.split(' ')).ok).toBe(true);
    }
  });

  test('checksum catches a swapped word', () => {
    const words = VECTORS[1][1].split(' ');
    words[3] = 'zoo';
    expect(checkMnemonic(words).ok).toBe(false);
    expect(checkMnemonic(['abandon', 'notaword']).unknown).toEqual(['notaword']);
  });

  test('mnemonic → seed with passphrase "TREZOR" (official vector)', async () => {
    const seed = await mnemonicToSeed(VECTORS[0][1], 'TREZOR');
    expect(hex(seed)).toBe('c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e53495531f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04');
  });
});

describe('BIP-32 HD derivation', () => {
  test('test vector 1: master key and m/0\'', async () => {
    const seed = hexToBytes('000102030405060708090a0b0c0d0e0f');
    const master = await masterKeyFromSeed(seed);
    expect(master.privateKey.toString(16)).toBe('e8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35');
    expect(hex(master.chainCode)).toBe('873dff81c02f525623fd1fe5167eac3a55a049de3d314bb42ee227ffed37d508');
    const child = await derivePath(seed, "m/0'");
    expect(child.privateKey.toString(16)).toBe('edb2e14f9ee77d26dd93b4ecede8d16ed408ce149b6cd80b0715a2d911a0afea');
  });

  test('path parsing', () => {
    expect(parsePath("m/44'/60'/0'/0/7")).toEqual([44 + HARDENED, 60 + HARDENED, HARDENED, 0, 7]);
    expect(() => parsePath('44/0')).toThrow();
  });

  test('phrase → Ethereum accounts (Hardhat / MetaMask default path)', async () => {
    const seed = await mnemonicToSeed('test test test test test test test test test test test junk');
    const acct0 = await derivePath(seed, "m/44'/60'/0'/0/0");
    expect(acct0.privateKey.toString(16)).toBe('ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
    expect(addressesForKey(acct0.privateKey).ethereum).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    const acct1 = await derivePath(seed, "m/44'/60'/0'/0/1");
    expect(addressesForKey(acct1.privateKey).ethereum).toBe('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');

    const abandon = await mnemonicToSeed(`${'abandon '.repeat(11)}about`);
    const first = await derivePath(abandon, "m/44'/60'/0'/0/0");
    expect(addressesForKey(first.privateKey).ethereum).toBe('0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
  });

  test('phrase → Bitcoin native SegWit address (BIP-84 test vector)', async () => {
    const seed = await mnemonicToSeed(`${'abandon '.repeat(11)}about`);
    const node = await derivePath(seed, "m/84'/0'/0'/0/0");
    expect(addressesForKey(node.privateKey).p2wpkh).toBe('bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');
  });
});

test('hash160 = RIPEMD-160(SHA-256(x))', () => {
  const data = randomBytes(33);
  expect(hex(hash160(data))).toBe(nodeHash('ripemd160', createHash('sha256').update(data).digest()));
});
