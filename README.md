# ⛓️ ChainLab — learn blockchain interactively

An interactive, single-page course on blockchain and cryptocurrency. Eight short
modules with live, hands-on demos running entirely in your browser — no build
step, no dependencies, no real coins.

## Run it

The project builds and serves with [Bun](https://bun.sh):

```sh
bun run dev      # dev server with hot reload  → http://localhost:3000
bun run build    # bundle + minify into dist/
bun run preview  # build, then serve dist/     → http://localhost:8000
```

`bun run dev` treats `index.html` as the bundler entrypoint, bundling its
referenced CSS/JS on the fly and hot-reloading on save. `bun run build` emits a
minified, content-hashed bundle to `dist/`; `bun run preview` serves that build
with the small Bun server in `serve.js`.

The demos use the Web Crypto API (SHA-256, ECDSA), which needs a secure context
— `localhost` qualifies, so all three commands work out of the box.

> No build is strictly required: the source is plain HTML/CSS/JS, so any static
> file server (`python3 -m http.server 8000`, `npx serve`, …) can serve
> `index.html` directly. Bun just adds bundling, minification and hot reload.

## What's inside

| Module | Interactive demos |
| --- | --- |
| 1 · Blockchain basics | Tamper with one node's ledger and watch the majority reject it |
| 2 · Hashing | Live SHA-256 playground + avalanche-effect bit diff + Merkle-tree tamper demo |
| 3 · Blocks & the chain | Editable 4-block blockchain — break it, then re-mine to repair |
| 4 · Mining & proof of work | Real in-browser miner with adjustable difficulty + halving/supply-curve explorer |
| 5 · Keys, wallets & signatures | Generate an ECDSA key pair, sign a message, tamper, verify |
| 6 · Transactions & consensus | Stake-weighted validator selection simulator |
| 7 · Ethereum & smart contracts | Call a token contract that enforces its own rules + live gas-fee estimator |
| 8 · NFTs & digital ownership | Mint unique ERC-721 tokens and trade them in a live ownership registry |

Every module also has a set of collapsible **"Go deeper" sections** with real
protocol detail: the Byzantine generals problem and the blockchain trilemma,
2²⁵⁶ scale arithmetic, real Bitcoin block headers, the difficulty adjustment,
elliptic curves and seed phrases, UTXO vs accounts, hard/soft forks and
finality, EIP-1559, The DAO hack, oracles, stablecoins and rollups, NFT link
rot, royalty enforcement and ERC-721 vs ERC-1155.

Each module ends with a quiz (70% to pass); progress is saved in
`localStorage`. There's also a glossary of ~40 key terms.

## Tech

Plain HTML/CSS/JS — no framework. [Bun](https://bun.sh) provides the dev server
and bundler (it natively treats `index.html` as the entrypoint, so there's no
config). The app uses the browser's native SHA-256 and ECDSA (Web Crypto),
`<dialog>`, exclusive `<details>` accordions, `light-dark()` color theming, and
hash-based routing with View Transitions.
