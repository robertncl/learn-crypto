/* Quiz questions for each module. `answer` is the index of the correct option. */

export const QUIZZES = {
  basics: [
    {
      q: 'At its core, a blockchain is…',
      options: [
        'a faster kind of database run by banks',
        'a shared, append-only ledger kept in sync by many independent computers',
        'a program for mining coins on your PC',
      ],
      answer: 1,
      why: 'The defining idea is a ledger that everyone replicates and agrees on — with no single record keeper in charge.',
    },
    {
      q: 'Node B secretly edits its own copy of the ledger. What happens?',
      options: [
        'The whole network adopts B’s version',
        'The network splits permanently in half',
        'The other nodes still agree with each other, so B’s copy is simply rejected',
      ],
      answer: 2,
      why: 'One tampered copy is out-voted by the honest majority — exactly what the Node B demo showed.',
    },
    {
      q: '“Decentralized” means…',
      options: [
        'no single party controls the ledger; many independent nodes maintain it together',
        'the data is stored in the cloud',
        'transactions are anonymous',
      ],
      answer: 0,
      why: 'Decentralization is about control, not storage location or privacy.',
    },
    {
      q: 'A company fully trusted by all of its users wants a faster internal payments system. The honest engineering answer is…',
      options: [
        'use a blockchain — it is always more secure',
        'use a regular database — paying for decentralized consensus buys nothing when a trusted operator already exists',
        'use a private blockchain, which removes all trade-offs',
      ],
      answer: 1,
      why: 'Blockchains trade speed and cost for removing the trusted middleman. If everyone already trusts one party, a database is simpler, faster and cheaper.',
    },
    {
      q: 'Why can’t a public blockchain simply let every computer vote on what’s true?',
      options: [
        'Computers can’t agree on anything without a central server',
        'Anyone could spin up thousands of fake computers (a Sybil attack), so votes must be weighted by something costly — work or stake',
        'Voting would make transactions free',
      ],
      answer: 1,
      why: 'Counting machines rewards whoever creates the most fake ones. Weighting votes by hashpower (Module 4) or stake (Module 6) makes influence expensive.',
    },
    {
      q: 'In the five-node demo, Mallory corrupts three of the five equally weighted copies. What does the network believe?',
      options: [
        'Her forged history — she now controls the majority, which is what a 51% attack means',
        'The honest history, because honest nodes always win',
        'Nothing — the ledger splits into five versions',
      ],
      answer: 0,
      why: 'Majority rules in both directions: one forged copy is ignored, but a forged majority becomes the network’s view.',
    },
  ],
  hashing: [
    {
      q: 'You hash a 4 GB movie with SHA-256. The output is…',
      options: [
        'about 4 GB of scrambled data',
        'exactly 256 bits (64 hex characters), like every other SHA-256 output',
        'larger for larger inputs',
      ],
      answer: 1,
      why: 'Hash outputs are fixed-size no matter the input — that’s what makes them practical fingerprints.',
    },
    {
      q: 'You change one letter of the input. The new hash is…',
      options: [
        'almost identical, with one character changed',
        'completely different — about half of all bits flip',
        'the same, because small changes are ignored',
      ],
      answer: 1,
      why: 'That’s the avalanche effect you saw in the demo: tiny edits are glaringly obvious.',
    },
    {
      q: 'Given only a hash, can you compute the original input?',
      options: [
        'Yes, by running the function in reverse',
        'Yes, but only with a quantum computer',
        'No — hash functions are one-way; guessing inputs is the only option',
      ],
      answer: 2,
      why: 'One-wayness is a core property. Blockchains depend on hashes being irreversible.',
    },
    {
      q: 'A block holds 1,000,000 transactions in a Merkle tree. Proving that one specific transaction is included requires…',
      options: [
        'downloading all 1,000,000 transactions',
        'about 20 hashes — the path from that transaction up to the Merkle root',
        'the miner’s private key',
      ],
      answer: 1,
      why: 'Each tree level halves the field: log₂(1,000,000) ≈ 20 sibling hashes connect a leaf to the root. That’s the Merkle proof light wallets rely on.',
    },
    {
      q: 'Finding any two inputs whose SHA-256 hashes share their first 32 bits takes roughly…',
      options: [
        'about 2³² tries — the same as matching a given target',
        'exactly 32 tries',
        'about 2¹⁶ (65,536) tries — the square root, because every new hash is compared with every earlier one',
      ],
      answer: 2,
      why: 'That’s the birthday bound you watched in the collision hunt: collisions cost about the square root of the preimage effort.',
    },
    {
      q: 'To prove one of four transactions is in a block, a full node sends the transaction plus…',
      options: [
        'the two sibling hashes on its path to the Merkle root',
        'all four transactions',
        'the block’s nonce',
      ],
      answer: 0,
      why: 'The wallet hashes the transaction, combines it with each supplied sibling, and checks the result against the root in the header.',
    },
    {
      q: 'You commit to the prediction “Heads” by publishing SHA-256(“Heads”) with no salt. What’s wrong?',
      options: [
        'SHA-256 can be run backwards',
        'Anyone can hash the few likely predictions and find the one that matches — a commitment to a guessable value needs a random salt',
        'You can change your prediction later',
      ],
      answer: 1,
      why: 'The snoop in the demo cracked it in a handful of guesses. Hiding requires the input to be unguessable, which is what the salt adds.',
    },
  ],
  blocks: [
    {
      q: 'What actually links one block to the next?',
      options: [
        'Each block stores the hash of the previous block',
        'Blocks are numbered sequentially',
        'A central server keeps them in order',
      ],
      answer: 0,
      why: 'The “previous hash” field is the chain. Sequence numbers alone could be forged trivially.',
    },
    {
      q: 'You edit the data in Block #1 of a 4-block chain. What happens to Blocks #2 and #3?',
      options: [
        'Nothing — they have their own hashes',
        'They become invalid too, because the hashes they reference no longer match',
        'They are automatically deleted',
      ],
      answer: 1,
      why: 'Changing a block changes its hash, breaking every later block’s “previous hash” link — the domino effect from the demo.',
    },
    {
      q: 'The very first block in a chain is called…',
      options: ['the root block', 'the alpha block', 'the genesis block'],
      answer: 2,
      why: 'Every chain starts from a hard-coded genesis block; Bitcoin’s was created in January 2009.',
    },
    {
      q: 'Two miners find valid blocks at the same moment. What happens?',
      options: [
        'the network halts until a human decides',
        'a brief fork: nodes follow whichever branch grows longer, and the losing block is orphaned',
        'both blocks are kept side by side forever',
      ],
      answer: 1,
      why: 'Ties happen regularly. The branch with the most accumulated work wins; the orphaned block’s transactions return to the mempool — one reason recipients wait for confirmations.',
    },
    {
      q: 'A real Bitcoin block is valid when…',
      options: [
        'a majority of nodes vote for it',
        'its hash starts with exactly 19 zeros',
        'the double SHA-256 of its 80-byte header, read as a number, is at or below the target encoded in its “bits” field',
      ],
      answer: 2,
      why: 'Leading zeros are just the visible side of being below a very small target, which every node checks with a single hash.',
    },
    {
      q: 'Re-mining the genesis block from 1.5 million nonces before Satoshi’s found exactly one valid nonce. Why so few?',
      options: [
        'The search code skipped most nonces',
        'Each nonce succeeds with probability of about 1 in 4.3 billion at difficulty 1, so a short window almost never contains another winner',
        'Only one nonce was allowed by the protocol',
      ],
      answer: 1,
      why: 'At difficulty 1 the target demands 32 leading zero bits: roughly one success per 2³² tries.',
    },
  ],
  mining: [
    {
      q: 'What is a miner actually searching for?',
      options: [
        'Coins hidden in the network',
        'A nonce that makes the block’s hash meet the difficulty target',
        'The private keys of other users',
      ],
      answer: 1,
      why: 'Mining is brute-force guessing of nonces until the hash starts with enough zeros.',
    },
    {
      q: 'Each extra leading hex zero required makes mining roughly…',
      options: ['twice as hard', '16× as hard', 'no harder — it’s random luck'],
      answer: 1,
      why: 'Each hex digit has 16 possible values, so each extra required zero multiplies expected attempts by 16.',
    },
    {
      q: 'Why does proof of work make history hard to rewrite?',
      options: [
        'Old blocks are encrypted with a master password',
        'An attacker must redo all the mining work and outpace the entire honest network',
        'Miners keep backups of the chain',
      ],
      answer: 1,
      why: 'Rewriting a buried block means re-mining it and every block after it, faster than everyone else combined.',
    },
    {
      q: 'Bitcoin’s block reward halves every 210,000 blocks (~4 years). The long-run effect is…',
      options: [
        'total supply approaches a hard cap of 21 million BTC',
        'mining gradually becomes free',
        'the difficulty automatically doubles',
      ],
      answer: 0,
      why: '50 → 25 → 12.5 → … the geometric series sums to just under 21 million. Around 2140 the subsidy hits zero and miners earn transaction fees only.',
    },
    {
      q: 'You mine ten blocks at the same difficulty. The number of tries each one needs…',
      options: [
        'varies wildly — every guess is an independent lottery ticket and only the average is fixed',
        'is identical every time',
        'falls steadily as your miner warms up',
      ],
      answer: 0,
      why: 'Mining has no memory: some blocks take a tenth of the expected work, others several times it. That variance is why pools exist.',
    },
    {
      q: 'Half of all hashpower suddenly switches off. What happens to Bitcoin’s block times?',
      options: [
        'Difficulty adjusts instantly, so nothing changes',
        'Blocks slow to ~20 minutes until the next retarget, then difficulty drops and ~10-minute blocks return',
        'The chain stops until miners return',
      ],
      answer: 1,
      why: 'Difficulty only changes every 2,016 blocks — the lag you saw in the thermostat demo, and what happened in mid-2021.',
    },
    {
      q: 'Why do small miners join mining pools?',
      options: [
        'Pools use less electricity per hash',
        'Solo mining is not allowed',
        'A pool turns a rare, random jackpot into a steady share of rewards with the same expected value',
      ],
      answer: 2,
      why: 'One modern ASIC mining solo would expect a block roughly once a century; in a pool it earns a small payout every day.',
    },
  ],
  keys: [
    {
      q: 'Which part of your wallet is safe to share?',
      options: [
        'The public key / address',
        'The private key',
        'Both — they’re interchangeable',
      ],
      answer: 0,
      why: 'The public key verifies; the private key controls. Anyone with your private key owns your coins.',
    },
    {
      q: 'A valid digital signature on a transaction proves…',
      options: [
        'the sender is wealthy enough',
        'the holder of the private key approved this exact message, unaltered',
        'the transaction was processed by a bank',
      ],
      answer: 1,
      why: 'You saw it in the demo: change one character after signing and verification fails.',
    },
    {
      q: 'You permanently lose your private key (and seed phrase). Your coins are…',
      options: [
        'recoverable through customer support',
        'transferred back to the network',
        'gone — nobody can move them, ever',
      ],
      answer: 2,
      why: 'No central party can override the cryptography. Key custody is the user’s whole responsibility.',
    },
    {
      q: 'A 12- or 24-word seed phrase is…',
      options: [
        'a password that your wallet provider can reset',
        'a human-readable backup of the master secret that can regenerate every key in the wallet',
        'a compressed list of your past transactions',
      ],
      answer: 1,
      why: 'BIP-39 encodes the wallet’s master randomness as common words. Anyone holding the words holds all the keys — which is why they belong on paper, never in a screenshot or cloud note.',
    },
    {
      q: 'Computing your public key from your private key k means…',
      options: [
        'hashing k with SHA-256',
        'hopping k times along an elliptic curve from a fixed point G — fast with double-and-add, infeasible to reverse',
        'encrypting k with a password',
      ],
      answer: 1,
      why: 'That asymmetry — easy forward, the discrete logarithm problem backward — is what you explored on the 97-point curve.',
    },
    {
      q: 'A wallet signs two different messages using the same nonce k. An attacker who sees both signatures can…',
      options: [
        'recover the private key with a little algebra',
        'only tell that the same wallet signed both',
        'do nothing, because k is never published',
      ],
      answer: 0,
      why: 'The shared r reveals the reuse; subtracting the two signature equations yields k, and then the private key. RFC 6979 prevents this.',
    },
    {
      q: 'Why does one private key control both a Bitcoin address and an Ethereum address?',
      options: [
        'The two blockchains share one ledger',
        'Addresses are chosen randomly by each network',
        'Both use the secp256k1 curve; they only hash and encode the same public key differently',
      ],
      answer: 2,
      why: 'Ethereum uses the last 20 bytes of Keccak-256; Bitcoin uses RIPEMD-160 of SHA-256 with Base58Check or Bech32.',
    },
    {
      q: 'The last word of a 12-word seed phrase contains…',
      options: [
        '4 checksum bits computed from SHA-256 of the entropy, so most typos are caught',
        'the wallet’s password',
        'the address of the first account',
      ],
      answer: 0,
      why: '132 bits = 128 bits of entropy + 4 checksum bits. Four bits catch 15 out of 16 random errors — not all of them.',
    },
  ],
  consensus: [
    {
      q: 'In proof of stake, validators are chosen…',
      options: [
        'by who has the fastest computer',
        'randomly, weighted by how many coins they’ve staked',
        'by seniority — oldest accounts first',
      ],
      answer: 1,
      why: 'The stake-picker demo showed it: more stake means proportionally more blocks (and more to lose for cheating).',
    },
    {
      q: 'You broadcast two transactions spending the same coin. The network…',
      options: [
        'confirms both — coins can be copied',
        'confirms at most one and rejects the other',
        'freezes your account pending review',
      ],
      answer: 1,
      why: 'Preventing double-spends is the whole point of consensus on transaction order.',
    },
    {
      q: 'A “51% attack” means an attacker controls…',
      options: [
        'a majority of the network’s hashpower or stake',
        '51% of all coins in circulation',
        '51% of the network’s users',
      ],
      answer: 0,
      why: 'With majority hashpower (PoW) or stake (PoS) an attacker can censor or reorder recent blocks — which is why bigger networks are safer.',
    },
    {
      q: 'A hard fork is best described as…',
      options: [
        'an incompatible rule change — if part of the network refuses to upgrade, the chain splits into two',
        'any attack on a blockchain',
        'a backwards-compatible tightening of the rules',
      ],
      answer: 0,
      why: 'That’s how Bitcoin Cash split from Bitcoin (2017) and Ethereum Classic from Ethereum (2016). A backwards-compatible tightening is a soft fork.',
    },
    {
      q: 'A block is nearly full and several transactions are still waiting. Which does the miner include first?',
      options: [
        'the ones that have waited longest in the mempool',
        'the ones paying the highest fee per byte (best fee rate)',
        'the ones sending the largest total amount',
      ],
      answer: 1,
      why: 'Block space is scarce, so miners maximize fees per byte — not total fee or amount. The block-builder demo showed how a big-but-bulky transaction can lose its slot to a small, high-rate one.',
    },
    {
      q: 'You pay 0.25 BTC using coins worth 0.32 BTC and forget to add a change output. The leftover 0.07 BTC…',
      options: [
        'goes entirely to the miner as a fee',
        'returns to you automatically',
        'is destroyed',
      ],
      answer: 0,
      why: 'In the UTXO model the fee is simply inputs minus outputs. Unassigned value belongs to the miner — a real and costly mistake.',
    },
    {
      q: 'Against an attacker with 10% of the hashpower, roughly how many confirmations push the reversal risk below 0.1%?',
      options: [
        '1',
        'About 6 — though no number is safe against an attacker with 50% or more',
        '100',
      ],
      answer: 1,
      why: 'The risk falls exponentially with each confirmation; the exact model gives 0.059% at six. A majority attacker always catches up eventually.',
    },
    {
      q: 'In proof of stake, a validator who signs two conflicting blocks for the same slot…',
      options: [
        'gets a warning',
        'earns double rewards',
        'is slashed: stake is burned and the validator is ejected',
      ],
      answer: 2,
      why: 'Two signatures over conflicting blocks are cryptographic proof of cheating, so the penalty can be automatic.',
    },
  ],
  ethereum: [
    {
      q: 'The big idea Ethereum added to Bitcoin’s design is…',
      options: [
        'a ledger that can also store and run programs, not just track currency',
        'removing the need for consensus',
        'making transactions completely free',
      ],
      answer: 0,
      why: 'Ethereum keeps blocks, hashes and consensus, but every node also runs the EVM — so the network agrees on the results of code, not just payments.',
    },
    {
      q: 'You call transfer() trying to send more tokens than you own. What happens?',
      options: [
        'Your balance goes negative until you top it up',
        'The contract’s owner decides whether to allow it',
        'The require() check fails and the whole transaction reverts — nothing moves',
      ],
      answer: 2,
      why: 'Code is the only authority: every node runs the same check and rejects the call, exactly as the LabToken demo showed.',
    },
    {
      q: 'Why does every Ethereum transaction cost gas?',
      options: [
        'Gas converts ETH into Bitcoin',
        'It pays validators for computation and storage, and stops spam and infinite loops',
        'Only NFT transactions actually need gas',
      ],
      answer: 1,
      why: 'Each EVM operation has a gas cost and you pay gas used × gas price. A program with no fuel limit could loop forever on every node in the network.',
    },
    {
      q: 'Under EIP-1559, the base-fee portion of every Ethereum transaction fee is…',
      options: [
        'paid to the validator who proposes the block',
        'refunded to you after the transaction confirms',
        'burned — destroyed forever; only the optional tip goes to the validator',
      ],
      answer: 2,
      why: 'The base fee rises after fuller-than-half blocks and falls after emptier ones (by at most 12.5% per block), and it is burned. Only the tip pays the validator, so congesting the network earns them nothing.',
    },
    {
      q: 'The first four bytes of a contract call’s calldata are…',
      options: [
        'the function selector — the first 4 bytes of the Keccak-256 hash of the function’s signature',
        'the caller’s address',
        'the gas limit',
      ],
      answer: 0,
      why: 'transfer(address,uint256) always hashes to 0xa9059cbb…, which is why every wallet can call every ERC-20 token.',
    },
    {
      q: 'A contract call runs out of gas halfway through. What happens?',
      options: [
        'It continues and the caller is billed later',
        'Every state change it made is reverted, but the gas it used is still paid',
        'Nothing changes and nothing is paid',
      ],
      answer: 1,
      why: 'Validators did the work, so the gas is consumed — but the half-finished changes are rolled back. That’s how infinite loops are tamed.',
    },
    {
      q: 'The DAO was drained in 2016 because its withdraw function…',
      options: [
        'used a weak private key',
        'relied on a broken oracle',
        'sent ETH before updating the caller’s balance, letting the attacker’s contract call back in again and again',
      ],
      answer: 2,
      why: 'Reentrancy: the fix is checks → effects → interactions, updating your own records before calling anyone else.',
    },
  ],
  nft: [
    {
      q: 'What makes a token “non-fungible”?',
      options: [
        'It can never be transferred to anyone else',
        'Each token is a unique, indivisible item with its own ID — not an interchangeable amount',
        'It is worth more than a fungible token',
      ],
      answer: 1,
      why: 'Fungible tokens (like ETH or the LAB token) are interchangeable amounts; an NFT is one specific item — you own token #7, not “0.5 of it”.',
    },
    {
      q: 'You buy an NFT of a picture. What is actually stored on the blockchain?',
      options: [
        'The full image file, pixel for pixel',
        'Usually just an ownership record (tokenId → owner) and a tokenURI link to the metadata; the image typically lives off-chain',
        'Nothing — NFTs exist only on the marketplace’s servers',
      ],
      answer: 1,
      why: 'On-chain storage is expensive, so most NFTs store a tiny record plus a link. If that link rots, the token remains but the art can vanish — which is why where the file lives matters.',
    },
    {
      q: 'In the demo, Bob tries to call transferFrom() on a token that Alice owns. What happens?',
      options: [
        'It succeeds — anyone can move any token',
        'The require(ownerOf[id] == msg.sender) check fails and the transaction reverts',
        'Ownership is split 50/50 between Alice and Bob',
      ],
      answer: 1,
      why: 'Just like the ERC-20 token in Module 7, the contract enforces its own rule: only the current owner’s key can move a token.',
    },
    {
      q: 'The much-hyped “automatic royalty on every resale” turned out to be…',
      options: [
        'guaranteed forever by the ERC-721 standard itself',
        'not enforced by the chain — it relied on marketplaces voluntarily paying, and many later made it optional',
        'illegal in most countries',
      ],
      answer: 1,
      why: 'A transfer is just ownerOf[id] = to; the contract never sees the payment. EIP-2981 only advertises a royalty — honoring it is up to whoever processes the sale.',
    },
    {
      q: 'Your NFT’s tokenURI is an HTTPS link, and the company’s server shuts down. Your token…',
      options: [
        'still exists and is still yours — but now points to nothing',
        'is automatically burned',
        'moves to IPFS',
      ],
      answer: 0,
      why: 'The chain stores ownership and a link; when the link dies, the art does too. Ask where the metadata lives before valuing an NFT.',
    },
    {
      q: 'Why can’t whoever hosts an IPFS file silently replace the picture?',
      options: [
        'IPFS files are encrypted',
        'The IPFS address is the hash of the content, so different content has a different address',
        'The blockchain stores a backup of every image',
      ],
      answer: 1,
      why: 'Content addressing makes swaps detectable — but someone still has to keep pinning the original for it to stay available.',
    },
    {
      q: 'A “free mint” site asks you to sign setApprovalForAll(theirContract, true). Signing it…',
      options: [
        'mints you one free NFT and nothing else',
        'approves the transfer of a single token',
        'lets their contract move every NFT you own in that collection, whenever it likes',
      ],
      answer: 2,
      why: 'Approval phishing doesn’t break any cryptography — you grant the permission yourself. Read what you sign and revoke stale approvals.',
    },
  ],
  defi: [
    {
      q: 'In a constant-product AMM, what sets the price of your trade?',
      options: [
        'An order book of buyers and sellers',
        'The pool’s reserves: your trade moves along x · y = k, so the price is whatever keeps the product constant',
        'A price the pool’s owner updates every block',
      ],
      answer: 1,
      why: 'There is no order book — just two reserves and a formula. The fee keeps k growing slightly with every trade.',
    },
    {
      q: 'Why does a 100,000-USDC buy get a worse average price than a 1,000-USDC buy from the same pool?',
      options: [
        'Price impact: a bigger trade slides further along the curve',
        'Large trades pay a higher fee percentage',
        'The pool deliberately punishes large traders',
      ],
      answer: 0,
      why: 'The 0.3% fee is the same for everyone; the extra cost of a big trade is the curve itself. Deeper pools mean less impact.',
    },
    {
      q: 'A bot buys just before your swap and sells right after it in the same block. This is…',
      options: [
        'impermanent loss',
        'a flash loan',
        'a sandwich attack — and your slippage tolerance caps how much it can take from you',
      ],
      answer: 2,
      why: 'The bot profits from the price move your own trade causes. A tight tolerance shrinks its room but makes your swap likelier to fail.',
    },
    {
      q: 'You provide liquidity to an ETH/USDC pool and the price of ETH doubles. Compared with simply holding the tokens, your position (before fees) is…',
      options: [
        'worth about 5.7% less — impermanent loss',
        'worth exactly the same',
        'worth twice as much',
      ],
      answer: 0,
      why: 'Arbitrage sells the rising token out of the pool, so LPs end up with less of it. The loss depends only on how far the price moved.',
    },
    {
      q: 'Why are DeFi loans over-collateralized?',
      options: [
        'Regulators require it',
        'With no credit checks and no courts, the collateral itself must cover the debt if prices fall',
        'Over-collateralization earns higher interest',
      ],
      answer: 1,
      why: 'The protocol can’t chase anyone for repayment, so it only lends less than the collateral is worth — and liquidates before that cushion is gone.',
    },
    {
      q: 'Your loan’s health factor drops below 1. What happens next?',
      options: [
        'You get a margin call and a few days to top up',
        'The loan is frozen until prices recover',
        'Anyone may repay part of your debt and take your collateral plus a bonus — immediately',
      ],
      answer: 2,
      why: 'Liquidation is open to all and profitable for the liquidator, which is exactly what keeps lenders whole without human judgment.',
    },
  ],
  zk: [
    {
      q: 'A zero-knowledge proof convinces the verifier a statement is true while revealing…',
      options: [
        'nothing beyond the fact that it is true',
        'the secret, but encrypted',
        'half of the secret',
      ],
      answer: 0,
      why: 'Complete, sound and zero-knowledge: convincing when true, nearly impossible to fake, and otherwise uninformative.',
    },
    {
      q: 'In the magic cave, a Peggy who doesn’t know the word survives each round with probability…',
      options: [
        '0 — she is caught immediately',
        '1/2, so twenty rounds leave her about a one-in-a-million chance',
        '1/20',
      ],
      answer: 1,
      why: 'She can only come out of the side she went in, so she survives when Victor happens to call it. Repetition shrinks her odds exponentially.',
    },
    {
      q: 'Why does Peggy reshuffle the three colours every round of the colouring proof?',
      options: [
        'To make hashing faster',
        'Because Victor asks her to',
        'So the colours she reveals tell Victor nothing about her actual colouring',
      ],
      answer: 2,
      why: 'Each round shows only two different, randomly relabelled colours — information Victor could have invented himself.',
    },
    {
      q: 'What stops Peggy from changing a node’s colour after she sees which line Victor picked?',
      options: [
        'Her salted hash commitments, published before the challenge',
        'Nothing — the protocol trusts her',
        'The blockchain’s consensus',
      ],
      answer: 0,
      why: 'A commitment is binding: opening it to a different colour would require finding a hash collision.',
    },
    {
      q: 'The Fiat–Shamir trick makes a proof non-interactive by…',
      options: [
        'letting the prover choose the challenge',
        'using a hash of the prover’s own commitments as the verifier’s random challenge',
        'skipping the challenge entirely',
      ],
      answer: 1,
      why: 'The prover can’t predict the hash without committing first, so a single message can stand in for the whole conversation.',
    },
    {
      q: 'A ZK rollup posts a validity proof to Ethereum. That proof establishes…',
      options: [
        'who sent each transaction',
        'that the rollup’s operator is trustworthy',
        'that a whole batch of transactions was executed correctly, without Ethereum re-running them',
      ],
      answer: 2,
      why: 'Ethereum verifies one small proof instead of thousands of transactions — the scaling trick behind ZK rollups.',
    },
  ],
};
