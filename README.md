# ⛓️ ChainLab — learn blockchain interactively

An interactive, single-page course on blockchain and cryptocurrency. Six short
modules with live, hands-on demos running entirely in your browser — no build
step, no dependencies, no real coins.

## Run it

The demos use the Web Crypto API, which needs a secure context, so serve the
folder over localhost:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

(Any static file server works — `npx serve`, `php -S localhost:8000`, etc.)

## What's inside

| Module | Interactive demo |
| --- | --- |
| 1 · Blockchain basics | Tamper with one node's ledger and watch the majority reject it |
| 2 · Hashing | Live SHA-256 playground + avalanche-effect bit diff |
| 3 · Blocks & the chain | Editable 4-block blockchain — break it, then re-mine to repair |
| 4 · Mining & proof of work | Real in-browser miner with adjustable difficulty and hashrate stats |
| 5 · Keys, wallets & signatures | Generate an ECDSA key pair, sign a message, tamper, verify |
| 6 · Transactions & consensus | Stake-weighted validator selection simulator |

Each module ends with a quiz (70% to pass); progress is saved in
`localStorage`. There's also a glossary of ~20 key terms.

## Tech

Plain HTML/CSS/JS — no framework, no build. Uses the browser's native
SHA-256 and ECDSA (Web Crypto), `<dialog>`, exclusive `<details>` accordions,
`light-dark()` color theming, and hash-based routing with View Transitions.
