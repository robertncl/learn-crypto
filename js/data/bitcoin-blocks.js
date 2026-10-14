/* Real Bitcoin block headers (raw 80-byte hex) with their published block hashes.
   Source: mempool.space API (/api/block/:hash/header). Each one proves itself:
   tests/math.test.js checks that SHA-256d of the header equals the hash and that
   the hash is below the target encoded in the header's "bits" field. */

export const REAL_BLOCKS = [
  {
    height: 0,
    label: '#0 — the genesis block (3 Jan 2009)',
    hash: '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f',
    header: '0100000000000000000000000000000000000000000000000000000000000000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a29ab5f49ffff001d1dac2b7c',
    note: 'Its coinbase transaction carries The Times headline “Chancellor on brink of second bailout for banks”. The previous-hash field is all zeros: there was nothing before it.',
  },
  {
    height: 1,
    label: '#1 — the first block after genesis (9 Jan 2009)',
    hash: '00000000839a8e6886ab5951d76f411475428afc90947ee320161bbf18eb6048',
    header: '010000006fe28c0ab6f1b372c1a6a246ae63f74f931e8365e15a089c68d6190000000000982051fd1e4ba744bbbe680e1fee14677ba1a3c3540bf7b1cdb606e857233e0e61bc6649ffff001d01e36299',
    note: 'Look at its previous-hash field: it is the genesis hash, byte-reversed. That field is the chain.',
  },
  {
    height: 170,
    label: '#170 — the first person-to-person payment (12 Jan 2009)',
    hash: '00000000d1145790a8694403d4063f323d499e655c83426834d4ce2f8dd4a2ee',
    header: '0100000055bd840a78798ad0da853f68974f3d183e2bd1db6a842c1feecf222a00000000ff104ccb05421ab93e63f8c3ce5c2c2e9dbb37de2764b3a3175c8166562cac7d51b96a49ffff001d283e9e70',
    note: 'This block confirmed Satoshi sending 10 BTC to the cryptographer Hal Finney — the first bitcoin transaction between two people.',
  },
  {
    height: 210000,
    label: '#210,000 — the first halving (28 Nov 2012)',
    hash: '000000000000048b95347e83192f69cf0366076336c639f9b7228e9ba171342e',
    header: '02000000e13d9a7a0ba7419fac0160842e7fee5d4b29605364649181f300000000000000d803e620d6bdd20ad8c239b43a5b4c7226948e0787096d35c7b12308a640dd3cb62cb650eae0041a64a694f2',
    note: 'The first block paying 25 BTC instead of 50. Difficulty had already climbed about 3.4 million-fold since genesis.',
  },
  {
    height: 840000,
    label: '#840,000 — the fourth halving (20 Apr 2024)',
    hash: '0000000000000000000320283a032748cef8227873ff4872689bf23f1cda83a5',
    header: '00e05f2aab948491071265ad552351d0ad625745668da54b0172010000000000000000004f89a5d73bd4d4887f25981fe81892ccafda10c27f52d6f3dd28183a7c411b03b7072366194203177d9863ea',
    note: 'Subsidy drops to 3.125 BTC. Notice the odd version number: modern miners also flip spare version bits as extra search space (“version rolling”).',
  },
];
