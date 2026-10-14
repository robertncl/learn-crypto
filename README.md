# ⛓️ ChainLab — learn blockchain interactively

An interactive, single-page course on blockchain and cryptocurrency. Ten modules
with nearly forty live, hands-on demos running entirely in your browser — no
build step required, no dependencies, no real coins.

## Run it

The project builds and serves with [Bun](https://bun.sh):

```sh
bun run dev      # dev server with hot reload  → http://localhost:3000
bun run build    # bundle + minify into dist/
bun run preview  # build, then serve dist/     → http://localhost:8000
bun test         # run the test suite in tests/
```

`bun run dev` treats `index.html` as the bundler entrypoint, bundling its
referenced CSS/JS on the fly and hot-reloading on save. `bun run build` emits a
minified, content-hashed bundle to `dist/`; `bun run preview` serves that build
with the small Bun server in `serve.js`.

A few demos use the Web Crypto API (the SHA-256 playground, P-256 signing, and
PBKDF2/HMAC-SHA512 for seed phrases), which needs a secure context —
`localhost` qualifies, so all the commands work out of the box.

> No build is strictly required: the source is plain HTML/CSS/JS with native ES
> modules, so any static file server (`python3 -m http.server 8000`,
> `npx serve`, …) can serve `index.html` directly. Bun just adds bundling,
> minification and hot reload.

## What's inside

| Module | Interactive demos |
| --- | --- |
| 1 · Blockchain basics | Corrupt nodes until a forged history wins the vote (51% attacks, Sybil resistance) · a three-question “do you need a blockchain?” tool |
| 2 · Hashing | Live SHA-256 with byte counts · avalanche effect as a 256-bit grid · Merkle tree with inclusion proofs · preimage vs collision hunt (the birthday bound) · commit–reveal with and without a salt |
| 3 · Blocks & the chain | Break and re-mine a 4-block chain · hash real Bitcoin headers (genesis, #1, #170, #210,000, #840,000) with SHA-256d and re-mine Satoshi’s genesis nonce |
| 4 · Mining & proof of work | Miner (difficulty 1–6) with per-block luck chart · solo-mining vs pool odds · difficulty-retarget simulator · halving supply curve |
| 5 · Keys, wallets & signatures | ECDSA sign/verify · elliptic curve y² = x³ + 7 (mod 97) with a brute-force discrete log · one key → Ethereum and Bitcoin addresses, with checksum typo tests · BIP-39 phrase → BIP-32/44/84 addresses · private-key recovery from a reused nonce |
| 6 · Transactions & consensus | UTXO wallet (coin selection, change, fees, double-spends) · fee-rate block builder · double-spend race (whitepaper vs exact odds, Monte Carlo) · stake-weighted proposer selection with slashing |
| 7 · Ethereum & smart contracts | Token contract · function-selector/calldata encoder (Keccak-256) · EVM bytecode stepper with gas · EIP-1559 base-fee simulator · fee estimator · reentrancy (The DAO) step-through |
| 8 · NFTs & digital ownership | Mint and trade ERC-721 tokens · link rot across HTTPS / IPFS / on-chain metadata with real CIDs · marketplace approvals, royalties and a drainer scam |
| 9 · DeFi | Constant-product AMM with an x · y = k chart · sandwich attack vs slippage tolerance · impermanent-loss calculator · over-collateralized loan and liquidation |
| 10 · Zero-knowledge proofs | The magic cave · a real graph 3-colouring proof with SHA-256 commitments — play the verifier and catch a bluffer |

Every module ends with key takeaways and collapsible **“Go deeper”** sections
with protocol detail: the trilemma, length-extension attacks, version rolling
and midstates, Schnorr and the quantum question, UTXO vs accounts, forks and
finality, MEV, oracles, stablecoins, rollups, ERC-721 vs ERC-1155, flash loans,
concentrated liquidity, SNARKs vs STARKs and trusted-setup ceremonies.

Each module ends with a quiz (70% to pass; best score remembered); progress is
saved in `localStorage`. The glossary has 70+ searchable terms.

## Project layout

```
index.html        all course content, one <section> per module
css/styles.css    design tokens (light/dark via light-dark()), layout, components
js/app.js         entry point: boots every demo
js/core/          router, theme, progress, quizzes, SVG charts, glossary, DOM helpers
js/demos/         one file per course module
js/lib/           pure, tested building blocks: SHA-256, Keccak-256, RIPEMD-160,
                  secp256k1/ECDSA (RFC 6979), Base58Check/Bech32/EIP-55/CIDv1,
                  BIP-39/32, Bitcoin headers, consensus maths, AMM maths
js/data/          quiz questions, the BIP-39 wordlist, real Bitcoin block headers
tests/            bun test suites for js/lib
```

The cryptography in `js/lib` is written to be read. It is checked against
published test vectors and reference implementations, but it is **not
constant-time** — never use it to protect real funds.

## Tests

`bun test` runs the suites in `tests/`:

- hashes (SHA-256, HMAC, Keccak/SHA3, RIPEMD-160) against `node:crypto` on random inputs
- secp256k1 points and RFC 6979 signatures (cross-checked against libsecp256k1)
- addresses for private key 1, Base58Check, Bech32 (BIP-173), EIP-55 and IPFS CID vectors
- BIP-39 and BIP-32 test vectors, plus the accounts Hardhat/Foundry derive from
  their test phrase and the BIP-84 vector
- the real block headers used in Module 3 (each must hash below its own target)
- the attack-probability table from the Bitcoin whitepaper, Monte Carlo checks,
  retargeting, EIP-1559 and AMM/impermanent-loss maths

## Tech

Plain HTML/CSS/JS — no framework. [Bun](https://bun.sh) provides the dev server,
bundler and test runner (it natively treats `index.html` as the entrypoint, so
there's no config). Charts are hand-rolled SVG with hover and keyboard read-outs
and data-table alternatives. The app also uses `<dialog>`, exclusive `<details>`
accordions, hash-based routing with View Transitions, pointer-event
drag-and-drop, the Clipboard API, and CSS scroll-driven progress/reveal
animations (progressively enhanced, so they're skipped where unsupported or when
the user prefers reduced motion).
