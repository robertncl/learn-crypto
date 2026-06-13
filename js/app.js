/* ChainLab — interactive blockchain & cryptocurrency course */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const enc = new TextEncoder();
const SUBTLE_OK = Boolean(globalThis.crypto?.subtle);

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

/* ============================== Router ============================== */

const ROUTES = ['home', 'basics', 'hashing', 'blocks', 'mining', 'keys', 'consensus', 'ethereum', 'nft', 'glossary'];

function currentRoute() {
  const id = location.hash.replace(/^#\/?/, '');
  return ROUTES.includes(id) ? id : 'home';
}

function renderRoute() {
  const id = currentRoute();
  $$('.view').forEach((view) => { view.hidden = view.id !== id; });
  $$('#site-nav a').forEach((a) => {
    if (a.dataset.route === id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
}

function initRouter() {
  addEventListener('hashchange', () => {
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (document.startViewTransition && !reduceMotion) {
      document.startViewTransition(renderRoute);
    } else {
      renderRoute();
    }
  });
  renderRoute();
}

/* ============================== Theme ============================== */

const THEME_KEY = 'chainlab-theme';
const THEME_LABELS = { '': '🌗 Auto', light: '☀️ Light', dark: '🌙 Dark' };

function initTheme() {
  const btn = $('#theme-toggle');
  let theme = localStorage.getItem(THEME_KEY) ?? '';

  const apply = () => {
    document.documentElement.style.colorScheme = theme || 'light dark';
    btn.textContent = THEME_LABELS[theme];
  };

  btn.addEventListener('click', () => {
    theme = theme === '' ? 'light' : theme === 'light' ? 'dark' : '';
    localStorage.setItem(THEME_KEY, theme);
    apply();
  });
  apply();
}

/* ============================== Progress ============================== */

const PROGRESS_KEY = 'chainlab-progress';
const QUIZ_IDS = ['basics', 'hashing', 'blocks', 'mining', 'keys', 'consensus', 'ethereum', 'nft'];

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY)) ?? {};
  } catch {
    return {};
  }
}

let progress = loadProgress();

function saveProgress() {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

function updateProgressUI() {
  const done = QUIZ_IDS.filter((id) => progress[id]?.passed).length;
  $('#course-progress').value = done;
  $('#progress-label').textContent = `${done} / ${QUIZ_IDS.length} modules`;

  $$('#site-nav a').forEach((a) => {
    const mark = $('.done-mark', a);
    if (mark) mark.hidden = !progress[a.dataset.route]?.passed;
  });

  $$('.module-card').forEach((card) => {
    const passed = Boolean(progress[card.dataset.module]?.passed);
    card.classList.toggle('is-done', passed);
    $('.card-status', card).hidden = !passed;
  });
}

/* ============================== Quizzes ============================== */

const QUIZZES = {
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
      why: 'Burning the base fee makes fees predictable and removes any incentive for validators to congest the network; inclusion is rewarded by tips alone.',
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
  ],
};

const PASS_RATIO = 0.7;

function initQuizzes() {
  const dialog = $('#quiz-dialog');

  $$('form[data-quiz]').forEach((form) => {
    const quizId = form.dataset.quiz;
    const questions = QUIZZES[quizId];

    questions.forEach((question, qi) => {
      const fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = `${qi + 1}. ${question.q}`;
      fieldset.append(legend);

      question.options.forEach((option, oi) => {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = `q${qi}`;
        input.value = oi;
        input.required = true;
        const text = document.createElement('span');
        text.textContent = option;
        label.append(input, text);
        fieldset.append(label);
      });

      const why = document.createElement('p');
      why.className = 'quiz-why';
      why.textContent = question.why;
      why.hidden = true;
      fieldset.append(why);

      form.append(fieldset);
    });

    const submit = document.createElement('button');
    submit.className = 'btn primary';
    submit.textContent = 'Check answers';
    form.append(submit);

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      let correct = 0;
      $$('fieldset', form).forEach((fieldset, qi) => {
        const question = questions[qi];
        const labels = $$('label', fieldset);
        labels.forEach((l) => l.classList.remove('is-answer', 'is-chosen'));

        const chosen = $('input:checked', fieldset);
        const isRight = Number(chosen.value) === question.answer;
        if (isRight) correct++;

        fieldset.dataset.state = isRight ? 'correct' : 'incorrect';
        labels[question.answer].classList.add('is-answer');
        chosen.closest('label').classList.add('is-chosen');
        $('.quiz-why', fieldset).hidden = false;
      });

      const total = questions.length;
      const passed = correct / total >= PASS_RATIO;

      if (passed && !progress[quizId]?.passed) {
        progress[quizId] = { passed: true, score: correct };
        saveProgress();
        updateProgressUI();
      }

      $('#quiz-dialog-title').textContent = passed ? '🎉 Module complete!' : '🤔 Not quite yet';
      $('#quiz-dialog-text').textContent = passed
        ? `You scored ${correct} / ${total}. This module is marked as complete — on to the next one!`
        : `You scored ${correct} / ${total}. Review the highlighted answers and explanations, then try again.`;
      dialog.showModal();
    });
  });
}

/* ============================== Module 1: network tamper demo ============================== */

function initNetworkDemo() {
  const btn = $('#tamper-btn');
  const network = $('#network-demo');

  btn.addEventListener('click', () => {
    const tampered = network.classList.toggle('tampered');
    $('.entry-orig', network).hidden = tampered;
    $('.entry-fake', network).hidden = !tampered;
    $('.reject-chip', network).hidden = !tampered;
    btn.textContent = tampered ? 'Restore Node B' : 'Tamper with Node B';
  });
}

/* ============================== Module 2: hash playground & avalanche ============================== */

function initHashPlayground() {
  const input = $('#hash-input');
  const output = $('#hash-output');
  let token = 0;

  const update = async () => {
    const current = ++token;
    const hash = await sha256Hex(input.value);
    if (current === token) output.textContent = hash;
  };

  input.addEventListener('input', update);
  update();
}

function initAvalanche() {
  const inputA = $('#ava-a');
  const inputB = $('#ava-b');
  const outA = $('#ava-out-a');
  const outB = $('#ava-out-b');
  const stats = $('#ava-stats');
  let token = 0;

  const renderDiff = (output, hash, other) => {
    output.replaceChildren(
      ...[...hash].map((char, i) => {
        const span = document.createElement('span');
        span.textContent = char;
        if (char !== other[i]) span.className = 'diff';
        return span;
      }),
    );
  };

  const update = async () => {
    const current = ++token;
    const [hashA, hashB] = await Promise.all([sha256Hex(inputA.value), sha256Hex(inputB.value)]);
    if (current !== token) return;

    renderDiff(outA, hashA, hashB);
    renderDiff(outB, hashB, hashA);

    let bitsDiff = 0;
    for (let i = 0; i < 64; i++) {
      let xor = parseInt(hashA[i], 16) ^ parseInt(hashB[i], 16);
      while (xor) { bitsDiff += xor & 1; xor >>= 1; }
    }
    stats.textContent = inputA.value === inputB.value
      ? 'Identical inputs → identical hashes (0 of 256 bits differ).'
      : `${bitsDiff} of 256 bits differ (${Math.round((bitsDiff / 256) * 100)}%).`;
  };

  inputA.addEventListener('input', update);
  inputB.addEventListener('input', update);
  update();
}

/* ============================== Module 2: Merkle tree demo ============================== */

function initMerkleDemo() {
  const DEFAULT_TXS = [
    'Alice → Bob: 5 BTC',
    'Bob → Carol: 2 BTC',
    'Carol → Dan: 1 BTC',
    'Dan → Erin: 4 BTC',
  ];
  const inputs = [0, 1, 2, 3].map((i) => $(`#mk-tx${i}`));
  const nodeEls = ['mk-h0', 'mk-h1', 'mk-h2', 'mk-h3', 'mk-h01', 'mk-h23', 'mk-root']
    .map((id) => $(`#${id}`));

  let baseline = null;
  let token = 0;

  async function computeTree() {
    const leaves = await Promise.all(inputs.map((inp) => sha256Hex(inp.value)));
    const left = await sha256Hex(leaves[0] + leaves[1]);
    const right = await sha256Hex(leaves[2] + leaves[3]);
    const root = await sha256Hex(left + right);
    return [...leaves, left, right, root];
  }

  async function update() {
    const current = ++token;
    const hashes = await computeTree();
    if (current !== token) return;
    baseline ??= hashes;

    hashes.forEach((hash, i) => {
      const el = nodeEls[i];
      $('.merkle-hash', el).textContent = `${hash.slice(0, 10)}…`;
      el.title = hash;
      el.classList.toggle('changed', hash !== baseline[i]);
    });
  }

  inputs.forEach((inp) => inp.addEventListener('input', update));
  $('#mk-reset').addEventListener('click', () => {
    inputs.forEach((inp, i) => { inp.value = DEFAULT_TXS[i]; });
    update();
  });
  update();
}

/* ============================== Module 3: blockchain demo ============================== */

const CHAIN_DIFFICULTY = '00';
const GENESIS_PREV = '0'.repeat(64);

function initChainDemo() {
  const container = $('#chain-demo');
  const chain = [
    'Alice → Bob: 5 BTC',
    'Bob → Carol: 2 BTC',
    'Carol → Dan: 1 BTC',
    'Dan → Erin: 4 BTC',
  ].map((data, index) => ({ index, data, nonce: 0, prevHash: '', hash: '', valid: false }));

  const blockHash = (block) =>
    sha256Hex(`${block.index}|${block.prevHash}|${block.data}|${block.nonce}`);

  /* Build the DOM once; inputs are never re-rendered so typing focus is preserved. */
  const cards = chain.map((block, i) => {
    const card = document.createElement('article');
    card.className = 'block';

    const title = document.createElement('h3');
    title.textContent = i === 0 ? `Block #${i} (genesis)` : `Block #${i}`;
    const chip = document.createElement('span');
    chip.className = 'status-chip';
    title.append(chip);

    const dataLabel = document.createElement('label');
    dataLabel.className = 'block-field';
    dataLabel.textContent = 'Data';
    dataLabel.htmlFor = `block-data-${i}`;
    const dataInput = document.createElement('input');
    dataInput.type = 'text';
    dataInput.id = `block-data-${i}`;
    dataInput.value = block.data;
    dataInput.spellcheck = false;

    const prevLabel = document.createElement('p');
    prevLabel.className = 'block-field';
    prevLabel.textContent = 'Prev hash';
    const prevHash = document.createElement('p');
    prevHash.className = 'block-hash';

    const nonceLabel = document.createElement('p');
    nonceLabel.className = 'block-field';
    nonceLabel.textContent = 'Nonce';
    const nonce = document.createElement('p');
    nonce.className = 'block-hash';

    const hashLabel = document.createElement('p');
    hashLabel.className = 'block-field';
    hashLabel.textContent = 'Hash';
    const hash = document.createElement('p');
    hash.className = 'block-hash';

    const mineBtn = document.createElement('button');
    mineBtn.type = 'button';
    mineBtn.className = 'btn primary';
    mineBtn.textContent = '⛏️ Mine';

    card.append(title, dataLabel, dataInput, prevLabel, prevHash, nonceLabel, nonce, hashLabel, hash, mineBtn);

    if (i > 0) {
      const link = document.createElement('span');
      link.className = 'chain-link';
      link.textContent = '→';
      link.setAttribute('aria-hidden', 'true');
      container.append(link);
    }
    container.append(card);

    dataInput.addEventListener('input', async () => {
      chain[i].data = dataInput.value;
      await recompute();
    });
    mineBtn.addEventListener('click', () => mineBlock(i));

    return { card, chip, prevHash, nonce, hash, mineBtn };
  });

  let version = 0;

  function render() {
    chain.forEach((block, i) => {
      const ui = cards[i];
      ui.card.classList.toggle('invalid', !block.valid);
      ui.chip.textContent = block.valid ? '✓ valid' : '✗ invalid';
      ui.prevHash.textContent = block.prevHash;
      ui.prevHash.title = block.prevHash;
      ui.nonce.textContent = String(block.nonce);
      ui.hash.textContent = block.hash;
      ui.hash.title = block.hash;
      ui.mineBtn.hidden = block.valid;
    });
  }

  async function recompute() {
    const current = ++version;
    let prev = GENESIS_PREV;
    for (const block of chain) {
      block.prevHash = prev;
      block.hash = await blockHash(block);
      block.valid = block.hash.startsWith(CHAIN_DIFFICULTY);
      prev = block.hash;
    }
    if (current === version) render();
  }

  async function mineBlock(i) {
    const block = chain[i];
    cards[i].mineBtn.disabled = true;
    block.nonce = 0;
    do {
      block.nonce++;
      block.hash = await blockHash(block);
    } while (!block.hash.startsWith(CHAIN_DIFFICULTY));
    cards[i].mineBtn.disabled = false;
    await recompute();
  }

  (async () => {
    /* Mine the whole chain once at load so it starts in a valid state. */
    let prev = GENESIS_PREV;
    for (const block of chain) {
      block.prevHash = prev;
      do {
        block.nonce++;
        block.hash = await blockHash(block);
      } while (!block.hash.startsWith(CHAIN_DIFFICULTY));
      block.valid = true;
      prev = block.hash;
    }
    render();
  })();
}

/* ============================== Module 4: mining simulator ============================== */

function initMiningSim() {
  const dataInput = $('#mine-data');
  const diffInput = $('#mine-difficulty');
  const diffLabel = $('#mine-diff-label');
  const startBtn = $('#mine-start');
  const stopBtn = $('#mine-stop');
  const statusOut = $('#mine-status');
  const attemptsOut = $('#mine-attempts');
  const timeOut = $('#mine-time');
  const rateOut = $('#mine-rate');
  const hashOut = $('#mine-hash');

  const MAX_ATTEMPTS = 3_000_000;
  let runToken = 0;

  const updateDiffLabel = () => {
    const d = Number(diffInput.value);
    const tries = (16 ** d).toLocaleString();
    diffLabel.textContent = `${d} leading zero${d > 1 ? 's' : ''} (~${tries} tries on average)`;
  };
  diffInput.addEventListener('input', updateDiffLabel);
  updateDiffLabel();

  const setRunning = (running) => {
    startBtn.disabled = running;
    stopBtn.disabled = !running;
    diffInput.disabled = running;
    dataInput.disabled = running;
  };

  const showStats = (nonce, t0, hash) => {
    const elapsed = (performance.now() - t0) / 1000;
    attemptsOut.textContent = nonce.toLocaleString();
    timeOut.textContent = `${elapsed.toFixed(1)} s`;
    rateOut.textContent = elapsed > 0.05 ? `${Math.round(nonce / elapsed).toLocaleString()} hashes/s` : '–';
    hashOut.textContent = hash;
  };

  startBtn.addEventListener('click', async () => {
    const token = ++runToken;
    const data = dataInput.value;
    const target = '0'.repeat(Number(diffInput.value));
    setRunning(true);
    statusOut.textContent = '⛏️ mining…';

    const t0 = performance.now();
    let nonce = 0;
    let hash = '';

    while (token === runToken) {
      hash = await sha256Hex(`${data}|${nonce}`);
      if (hash.startsWith(target)) {
        showStats(nonce, t0, hash);
        statusOut.textContent = `✅ block mined! nonce = ${nonce.toLocaleString()}`;
        break;
      }
      nonce++;
      if (nonce % 256 === 0) {
        showStats(nonce, t0, hash);
        await nextFrame();
      }
      if (nonce >= MAX_ATTEMPTS) {
        statusOut.textContent = '😮‍💨 gave up after 3 million attempts — lower the difficulty!';
        break;
      }
    }

    if (token === runToken) setRunning(false);
  });

  stopBtn.addEventListener('click', () => {
    runToken++;
    statusOut.textContent = '⏹️ stopped';
    setRunning(false);
  });
}

/* ============================== Module 4: halving & supply explorer ============================== */

function initHalvingDemo() {
  const eraInput = $('#halving-era');
  const BLOCKS_PER_ERA = 210_000;
  const SATS_PER_BTC = 100_000_000;
  const CAP_SATS = 21_000_000 * SATS_PER_BTC;

  /* Integer satoshi math, like the protocol: floor() is why the cap is just under 21 M. */
  const rewardSats = (era) => Math.floor((50 * SATS_PER_BTC) / 2 ** era);

  const update = () => {
    const era = Number(eraInput.value);
    let mintedSats = 0;
    for (let i = 0; i <= era; i++) mintedSats += BLOCKS_PER_ERA * rewardSats(i);

    const reward = rewardSats(era);
    const pct = (mintedSats / CAP_SATS) * 100;
    /* Real halvings landed 2012, 2016, 2020, 2024… era n starts ≈ 2008 + 4n (genesis era starts 2009). */
    const yearFrom = era === 0 ? 2009 : 2008 + era * 4;

    $('#halving-era-out').textContent = era === 0 ? 'era 0 (genesis — no halvings yet)' : `era ${era} (after halving #${era})`;
    $('#halving-years').textContent = `${yearFrom}–${2008 + (era + 1) * 4}`;
    $('#halving-reward').textContent = reward === 0
      ? '0 — fees only'
      : reward < SATS_PER_BTC / 100
        ? `${reward.toLocaleString()} sat${reward > 1 ? 's' : ''}`
        : `${(reward / SATS_PER_BTC).toLocaleString(undefined, { maximumFractionDigits: 8 })} BTC`;
    $('#halving-minted').textContent = `${(mintedSats / SATS_PER_BTC).toLocaleString(undefined, { maximumFractionDigits: 4 })} BTC`;
    $('#halving-pct').textContent = `${pct.toFixed(pct > 99.99 ? 7 : pct > 99.9 ? 4 : 1)}%`;
    $('#supply-fill').style.inlineSize = `${pct}%`;

    $('#halving-note').textContent =
      era === 0 ? 'Every block mints 50 BTC: half of all bitcoin that will ever exist is created in this first era.'
      : era === 4 ? 'The April 2024 halving — the era we are in now: 3.125 BTC per block.'
      : reward === 1 ? 'The last era with a subsidy: each block mints exactly 1 satoshi.'
      : reward === 0 ? 'The subsidy rounds to zero around 2140. From here on, security must be paid for entirely by transaction fees.'
      : '';
  };

  eraInput.addEventListener('input', update);
  update();
}

/* ============================== Module 5: keys & signatures ============================== */

function initKeysDemo() {
  const generateBtn = $('#keys-generate');
  const signBtn = $('#keys-sign');
  const verifyBtn = $('#keys-verify');
  const walletBox = $('#keys-wallet');
  const addressOut = $('#keys-address');
  const pubkeyOut = $('#keys-pubkey');
  const messageInput = $('#keys-message');
  const sigWrap = $('#keys-sig-wrap');
  const sigOut = $('#keys-signature');
  const verdict = $('#keys-verdict');

  const ALGO = { name: 'ECDSA', namedCurve: 'P-256' };
  const SIGN_ALGO = { name: 'ECDSA', hash: 'SHA-256' };

  let keyPair = null;
  let signature = null;

  generateBtn.addEventListener('click', async () => {
    keyPair = await crypto.subtle.generateKey(ALGO, true, ['sign', 'verify']);
    const rawPub = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    const pubHex = bytesToHex(rawPub);
    addressOut.textContent = `0x${(await sha256Hex(pubHex)).slice(0, 40)}`;
    pubkeyOut.textContent = pubHex;
    walletBox.hidden = false;
    signBtn.disabled = false;
    verifyBtn.disabled = true;
    sigWrap.hidden = true;
    verdict.hidden = true;
    signature = null;
    generateBtn.textContent = '🔑 Generate a new wallet';
  });

  signBtn.addEventListener('click', async () => {
    signature = await crypto.subtle.sign(SIGN_ALGO, keyPair.privateKey, enc.encode(messageInput.value));
    sigOut.textContent = bytesToHex(signature);
    sigWrap.hidden = false;
    verifyBtn.disabled = false;
    verdict.hidden = true;
  });

  verifyBtn.addEventListener('click', async () => {
    const ok = await crypto.subtle.verify(
      SIGN_ALGO, keyPair.publicKey, signature, enc.encode(messageInput.value),
    );
    verdict.hidden = false;
    verdict.className = `verdict ${ok ? 'ok' : 'bad'}`;
    verdict.textContent = ok
      ? '✅ Valid — this exact message was approved by the wallet’s private key.'
      : '❌ Invalid — the message no longer matches the signature. It was changed after signing (or signed by someone else).';
  });
}

/* ============================== Module 6: proof-of-stake picker ============================== */

function initStakeDemo() {
  const validators = [
    { id: 'v1', name: 'Ava' },
    { id: 'v2', name: 'Ben' },
    { id: 'v3', name: 'Cara' },
  ];
  const wins = new Map(validators.map((v) => [v.id, 0]));
  const summary = $('#stake-summary');

  const stakeOf = (v) => Number($(`#stake-${v.id}`).value);
  const totalPicks = () => [...wins.values()].reduce((a, b) => a + b, 0);

  function render(winnerId = null) {
    const totalStake = validators.reduce((sum, v) => sum + stakeOf(v), 0);
    const picks = totalPicks();

    validators.forEach((v) => {
      $(`#stake-out-${v.id}`).textContent =
        `${stakeOf(v)} coins (${Math.round((stakeOf(v) / totalStake) * 100)}%)`;
      const won = wins.get(v.id);
      const share = picks ? Math.round((won / picks) * 100) : 0;
      $(`#win-fill-${v.id}`).style.inlineSize = `${share}%`;
      $(`#win-text-${v.id}`).textContent = picks
        ? `won ${won} of ${picks} blocks (${share}%)`
        : 'no rounds yet';
      $(`#val-${v.id}`).classList.toggle('winner', v.id === winnerId);
    });

    summary.textContent = picks
      ? `${picks} block${picks > 1 ? 's' : ''} proposed so far — compare each win share to the stake share.`
      : '';
  }

  function pickOne() {
    const totalStake = validators.reduce((sum, v) => sum + stakeOf(v), 0);
    let r = Math.random() * totalStake;
    for (const v of validators) {
      r -= stakeOf(v);
      if (r < 0) return v.id;
    }
    return validators.at(-1).id;
  }

  validators.forEach((v) => {
    $(`#stake-${v.id}`).addEventListener('input', () => render());
  });

  $('#stake-pick').addEventListener('click', () => {
    const winner = pickOne();
    wins.set(winner, wins.get(winner) + 1);
    render(winner);
  });

  $('#stake-run').addEventListener('click', () => {
    for (let i = 0; i < 100; i++) {
      const winner = pickOne();
      wins.set(winner, wins.get(winner) + 1);
    }
    render();
  });

  $('#stake-reset').addEventListener('click', () => {
    validators.forEach((v) => wins.set(v.id, 0));
    render();
  });

  render();
}

/* ============================== Module 6: fee-market block builder ============================== */

function initFeeMarketDemo() {
  const BLOCK_LIMIT = 1000; // vBytes
  /* fee in sats, size in vBytes. #9aa pays the biggest *total* fee but a mediocre rate — the trap. */
  const TXS = [
    { id: 'tx-c52', fee: 12000, size: 150 },
    { id: 'tx-9aa', fee: 21000, size: 350 },
    { id: 'tx-7e1', fee: 9000, size: 180 },
    { id: 'tx-6d0', fee: 6600, size: 220 },
    { id: 'tx-3b9', fee: 5000, size: 250 },
    { id: 'tx-a04', fee: 4000, size: 400 },
    { id: 'tx-1f8', fee: 3000, size: 300 },
  ];

  const pool = $('#fm-pool');
  const block = $('#fm-block');
  const capFill = $('#fm-cap-fill');
  const verdict = $('#fm-verdict');

  let placement = new Map(TXS.map((t) => [t.id, 'pool'])); // id -> 'pool' | 'block'

  const txById = (id) => TXS.find((t) => t.id === id);
  const rate = (t) => t.fee / t.size;
  const byRate = (a, b) => rate(b) - rate(a);
  const inBlock = () => TXS.filter((t) => placement.get(t.id) === 'block');
  const usedSpace = () => inBlock().reduce((s, t) => s + t.size, 0);
  const totalFees = () => inBlock().reduce((s, t) => s + t.fee, 0);

  /* The strategy real miners use: greedily take the best fee-rate txs that still fit.
     For this dataset that also happens to be the true fee-maximizing block. */
  function bestFees() {
    let space = BLOCK_LIMIT;
    let fees = 0;
    for (const t of [...TXS].sort(byRate)) {
      if (t.size <= space) { space -= t.size; fees += t.fee; }
    }
    return fees;
  }

  function makeChip(t) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tx-chip';
    btn.dataset.id = t.id;
    btn.setAttribute('aria-label',
      `${t.id}: fee ${t.fee.toLocaleString()} sats, size ${t.size} vBytes, ${rate(t).toFixed(0)} sats per vByte. `
      + (placement.get(t.id) === 'block' ? 'In your block — activate to remove.' : 'In the mempool — activate to add.'));

    const id = document.createElement('span');
    id.className = 'tx-id';
    id.textContent = t.id;

    const meta = document.createElement('span');
    meta.className = 'tx-meta';
    meta.textContent = `${t.fee.toLocaleString()} sat · ${t.size} vB`;

    const r = document.createElement('span');
    r.className = 'tx-rate';
    r.append(`${rate(t).toFixed(0)}`, Object.assign(document.createElement('small'), { textContent: 'sat/vB' }));

    btn.append(id, meta, r);
    btn.addEventListener('click', () => {
      if (btn._dragged) { btn._dragged = false; return; } // swallow the click synthesized after a drag
      toggle(t.id);
    });
    btn.addEventListener('pointerdown', (e) => startDrag(e, t, btn));

    li.append(btn);
    return li;
  }

  function flashTooBig(id) {
    const chip = pool.querySelector(`[data-id="${id}"]`);
    if (!chip) return;
    chip.classList.remove('too-big');
    void chip.offsetWidth; // restart the shake animation
    chip.classList.add('too-big');
  }

  function addToBlock(id) {
    if (placement.get(id) !== 'pool') return false;
    const t = txById(id);
    if (usedSpace() + t.size > BLOCK_LIMIT) {
      flashTooBig(id);
      verdict.textContent = `⛔ ${id} (${t.size} vB) doesn’t fit — only ${(BLOCK_LIMIT - usedSpace()).toLocaleString()} vB left in the block.`;
      return false;
    }
    placement.set(id, 'block');
    return true;
  }

  function removeFromBlock(id) {
    if (placement.get(id) !== 'block') return false;
    placement.set(id, 'pool');
    return true;
  }

  function toggle(id) {
    const moved = placement.get(id) === 'block' ? removeFromBlock(id) : addToBlock(id);
    if (moved) { render(); showStanding(); }
  }

  function showStanding() {
    const mine = totalFees();
    if (mine === 0) { verdict.textContent = ''; return; }
    const best = bestFees();
    verdict.textContent = mine >= best
      ? `🏆 ${mine.toLocaleString()} sat — that’s the fee-maximizing block. No selection of these transactions pays more.`
      : `${mine.toLocaleString()} sat collected. A miner optimizing fee rate earns ${best.toLocaleString()} sat — swap a bulky transaction for a higher-rate one.`;
  }

  function render() {
    const poolTxs = TXS.filter((t) => placement.get(t.id) === 'pool').sort(byRate);
    const blockTxs = inBlock().sort(byRate);
    pool.replaceChildren(...poolTxs.map(makeChip));
    block.replaceChildren(...blockTxs.map(makeChip));

    const used = usedSpace();
    capFill.style.inlineSize = `${(used / BLOCK_LIMIT) * 100}%`;
    capFill.classList.toggle('full', used >= BLOCK_LIMIT);

    $('#fm-pool-sub').textContent = `${poolTxs.length} waiting`;
    $('#fm-space').textContent = `${used.toLocaleString()} / ${BLOCK_LIMIT.toLocaleString()} vB`;
    $('#fm-count').textContent = String(blockTxs.length);
    $('#fm-fees').textContent = `${totalFees().toLocaleString()} sat`;
  }

  /* Pointer-based drag — one path for mouse, pen and touch, because native HTML5
     drag-and-drop never fires on touchscreens. A press that doesn't move past a
     small threshold falls through to the click handler, which toggles the tx. */
  let dragActive = false;

  function listUnder(x, y) {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest('#fm-pool, #fm-block') : null;
  }

  function moveGhost(ghost, x, y) {
    ghost.style.transform = `translate(${x - Number(ghost.dataset.offX)}px, ${y - Number(ghost.dataset.offY)}px)`;
  }

  function makeGhost(btn, x, y) {
    const rect = btn.getBoundingClientRect();
    const ghost = btn.cloneNode(true);
    ghost.classList.add('tx-ghost');
    ghost.classList.remove('dragging');
    ghost.removeAttribute('aria-label');
    ghost.style.inlineSize = `${rect.width}px`;
    ghost.dataset.offX = String(x - rect.left);
    ghost.dataset.offY = String(y - rect.top);
    moveGhost(ghost, x, y);
    document.body.append(ghost);
    return ghost;
  }

  function startDrag(e, t, btn) {
    if (e.pointerType === 'mouse' && e.button !== 0) return; // primary button only
    if (dragActive) return;                                  // ignore a second finger mid-drag

    const originListId = placement.get(t.id) === 'block' ? 'fm-block' : 'fm-pool';
    const startX = e.clientX;
    const startY = e.clientY;
    let started = false;
    let ghost = null;
    let overList = null;
    btn._dragged = false;

    const setOver = (list) => {
      if (list === overList) return;
      overList?.classList.remove('drop-target');
      if (list && list.id !== originListId) list.classList.add('drop-target'); // invite a drop on the other list only
      overList = list;
    };

    const onMove = (ev) => {
      if (!started) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
        started = true;
        dragActive = true;
        btn._dragged = true;
        ghost = makeGhost(btn, ev.clientX, ev.clientY); // clone before fading the original
        btn.classList.add('dragging');
      }
      ev.preventDefault();
      moveGhost(ghost, ev.clientX, ev.clientY);
      setOver(listUnder(ev.clientX, ev.clientY));
    };

    const onUp = (ev) => {
      const dropList = started ? listUnder(ev.clientX, ev.clientY) : null;
      cleanup();
      if (!started) return; // a tap — let the click handler toggle
      if (dropList) {
        const moved = dropList.id === 'fm-block' ? addToBlock(t.id) : removeFromBlock(t.id);
        if (moved) { render(); showStanding(); }
      }
    };

    const cleanup = () => {
      dragActive = false;
      setOver(null);
      ghost?.remove();
      btn.classList.remove('dragging');
      try { btn.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      btn.removeEventListener('pointermove', onMove);
      btn.removeEventListener('pointerup', onUp);
      btn.removeEventListener('pointercancel', cleanup);
    };

    try { btn.setPointerCapture(e.pointerId); } catch { /* capture unsupported — drag still works */ }
    btn.addEventListener('pointermove', onMove);
    btn.addEventListener('pointerup', onUp);
    btn.addEventListener('pointercancel', cleanup);
  }

  $('#fm-mine').addEventListener('click', () => {
    placement = new Map(TXS.map((t) => [t.id, 'pool']));
    let space = BLOCK_LIMIT;
    for (const t of [...TXS].sort(byRate)) {
      if (t.size <= space) { placement.set(t.id, 'block'); space -= t.size; }
    }
    render();
    verdict.textContent = `🤖 The miner took the highest fee-rate transactions that fit: ${totalFees().toLocaleString()} sat in ${usedSpace().toLocaleString()} vB. That’s the strategy real miners use.`;
  });

  $('#fm-clear').addEventListener('click', () => {
    placement = new Map(TXS.map((t) => [t.id, 'pool']));
    verdict.textContent = '';
    render();
  });

  render();
}

/* ============================== Copy-to-clipboard buttons ============================== */

function initCopyButtons() {
  if (!navigator.clipboard) return;

  $$('.hash-box.copyable').forEach((box) => {
    const wrap = document.createElement('div');
    wrap.className = 'copy-wrap';
    box.replaceWith(wrap); // box keeps its id, so demo code that updates it still works

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
    btn.title = 'Copy to clipboard';
    btn.setAttribute('aria-label', 'Copy to clipboard');
    btn.textContent = '⧉';
    wrap.append(box, btn);

    let resetId = 0;
    btn.addEventListener('click', async () => {
      const text = box.textContent.trim();
      if (!text || text === '–') return;
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = '✓';
        btn.classList.add('copied');
        clearTimeout(resetId);
        resetId = setTimeout(() => {
          btn.textContent = '⧉';
          btn.classList.remove('copied');
        }, 1200);
      } catch {
        /* clipboard unavailable (e.g. insecure context) — silently ignore */
      }
    });
  });
}

/* ============================== Module 7: smart-contract token demo ============================== */

function initContractDemo() {
  const INITIAL = { alice: 100, bob: 50, carol: 0 };
  const NAMES = { alice: 'Alice', bob: 'Bob', carol: 'Carol' };
  let balances = { ...INITIAL };

  const caller = $('#eth-caller');
  const recipient = $('#eth-recipient');
  const amountInput = $('#eth-amount');
  const log = $('#eth-log');

  function renderBalances() {
    for (const id of Object.keys(balances)) {
      $(`#eth-bal-${id}`).textContent = `${balances[id]} LAB`;
    }
  }

  function addLog(text, ok) {
    $('.log-empty', log)?.remove();
    const li = document.createElement('li');
    li.className = ok ? 'log-ok' : 'log-bad';
    li.textContent = text;
    log.prepend(li);
  }

  $('#eth-call').addEventListener('click', () => {
    const from = caller.value;
    const to = recipient.value;
    const amount = Math.floor(Number(amountInput.value));
    const call = `transfer(${NAMES[from]} → ${NAMES[to]}, ${Number.isFinite(amount) ? amount : '?'} LAB)`;

    if (!Number.isFinite(amount) || amount <= 0) {
      addLog(`❌ ${call} reverted: amount must be a positive number`, false);
      return;
    }
    if (balances[from] < amount) {
      addLog(`❌ ${call} reverted: insufficient balance (${NAMES[from]} has ${balances[from]} LAB)`, false);
      return;
    }
    balances[from] -= amount;
    balances[to] += amount;
    renderBalances();
    addLog(`✅ Transfer(${NAMES[from]} → ${NAMES[to]}, ${amount} LAB)`, true);
  });

  $('#eth-reset').addEventListener('click', () => {
    balances = { ...INITIAL };
    renderBalances();
    const empty = document.createElement('li');
    empty.className = 'log-empty';
    empty.textContent = 'no transactions yet';
    log.replaceChildren(empty);
  });

  renderBalances();
}

/* ============================== Module 7: gas fee estimator ============================== */

function initGasDemo() {
  const op = $('#gas-op');
  const price = $('#gas-price');
  const ethUsd = $('#gas-eth-usd');

  const update = () => {
    const units = Number(op.value);
    const gwei = Number(price.value);
    const usdPerEth = Number(ethUsd.value) || 0;
    const totalGwei = units * gwei;
    const eth = totalGwei / 1e9;

    $('#gas-price-out').textContent = `${gwei} gwei`;
    $('#gas-units-out').textContent = units.toLocaleString();
    $('#gas-eth-out').textContent = `${eth.toFixed(6)} ETH`;
    $('#gas-usd-out').textContent = `$${(eth * usdPerEth).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
    $('#gas-math').textContent =
      `${units.toLocaleString()} gas × ${gwei} gwei = ${totalGwei.toLocaleString()} gwei = ${eth.toFixed(6)} ETH`;
  };

  [op, price, ethUsd].forEach((el) => el.addEventListener('input', update));
  update();
}

/* ============================== Module 8: NFT (ERC-721) demo ============================== */

function initNftDemo() {
  const ACCOUNTS = { alice: '🦊 Alice', bob: '🐢 Bob', carol: '🦉 Carol' };
  /* Pool the demo draws from when minting fresh tokens. */
  const CRITTERS = [
    { art: '🐉', name: 'Draco' }, { art: '🦄', name: 'Sparkle' }, { art: '🐙', name: 'Inky' },
    { art: '🦖', name: 'Rexie' }, { art: '🐳', name: 'Bloo' }, { art: '🦋', name: 'Flit' },
    { art: '🦁', name: 'Mane' }, { art: '🐝', name: 'Buzz' }, { art: '🦓', name: 'Stripes' },
    { art: '🦦', name: 'Otto' }, { art: '🐧', name: 'Waddle' }, { art: '🦚', name: 'Plume' },
  ];
  const INITIAL = [
    { id: 1, art: '🐉', name: 'Draco', owner: 'alice' },
    { id: 2, art: '🦄', name: 'Sparkle', owner: 'bob' },
    { id: 3, art: '🐙', name: 'Inky', owner: 'carol' },
  ];

  let tokens = INITIAL.map((t) => ({ ...t }));
  let nextId = 4;
  let mintCursor = 3; // first three critters are already minted

  const gallery = $('#nft-gallery');
  const caller = $('#nft-caller');
  const tokenSelect = $('#nft-token');
  const recipient = $('#nft-recipient');
  const log = $('#nft-log');

  function renderTokenOptions() {
    const prev = tokenSelect.value;
    tokenSelect.replaceChildren(...tokens.map((t) => {
      const opt = document.createElement('option');
      opt.value = String(t.id);
      opt.textContent = `#${t.id} ${t.art} ${t.name}`;
      return opt;
    }));
    if (tokens.some((t) => String(t.id) === prev)) tokenSelect.value = prev;
  }

  function renderGallery() {
    gallery.replaceChildren(...tokens.map((t) => {
      const card = document.createElement('article');
      card.className = 'nft-card';
      card.classList.toggle('mine', t.owner === caller.value);

      const art = document.createElement('p');
      art.className = 'nft-art';
      art.textContent = t.art;

      const name = document.createElement('p');
      name.className = 'nft-name';
      name.textContent = t.name;

      const idTag = document.createElement('p');
      idTag.className = 'nft-id';
      idTag.textContent = `Token #${t.id}`;

      const ownerTag = document.createElement('p');
      ownerTag.className = 'nft-owner';
      ownerTag.textContent = `owner: ${ACCOUNTS[t.owner]}`;

      const uri = document.createElement('p');
      uri.className = 'nft-uri';
      uri.textContent = `🔗 ipfs://…/${t.id}.json`;
      uri.title = 'tokenURI — a link to off-chain metadata';

      card.append(art, name, idTag, ownerTag, uri);
      return card;
    }));
  }

  function addLog(text, ok) {
    $('.log-empty', log)?.remove();
    const li = document.createElement('li');
    li.className = ok ? 'log-ok' : 'log-bad';
    li.textContent = text;
    log.prepend(li);
  }

  function render() {
    renderTokenOptions();
    renderGallery();
  }

  $('#nft-transfer').addEventListener('click', () => {
    const from = caller.value;
    const to = recipient.value;
    const id = Number(tokenSelect.value);
    const token = tokens.find((t) => t.id === id);
    if (!token) return;
    const call = `transferFrom(${ACCOUNTS[from]} → ${ACCOUNTS[to]}, #${id})`;

    if (token.owner !== from) {
      addLog(`❌ ${call} reverted: ${ACCOUNTS[from]} is not the owner of #${id} (owner is ${ACCOUNTS[token.owner]})`, false);
      return;
    }
    if (from === to) {
      addLog(`❌ ${call} reverted: #${id} already belongs to ${ACCOUNTS[to]}`, false);
      return;
    }
    token.owner = to;
    render();
    addLog(`✅ Transfer(#${id} ${token.art} ${token.name}: ${ACCOUNTS[from]} → ${ACCOUNTS[to]})`, true);
  });

  $('#nft-mint').addEventListener('click', () => {
    const to = caller.value;
    const critter = CRITTERS[mintCursor % CRITTERS.length];
    mintCursor++;
    const token = { id: nextId++, art: critter.art, name: critter.name, owner: to };
    tokens.push(token);
    render();
    tokenSelect.value = String(token.id);
    addLog(`✅ Mint(#${token.id} ${token.art} ${token.name} → ${ACCOUNTS[to]}) — a brand-new unique token`, true);
  });

  $('#nft-reset').addEventListener('click', () => {
    tokens = INITIAL.map((t) => ({ ...t }));
    nextId = 4;
    mintCursor = 3;
    const empty = document.createElement('li');
    empty.className = 'log-empty';
    empty.textContent = 'no transactions yet';
    log.replaceChildren(empty);
    render();
  });

  caller.addEventListener('change', renderGallery);

  render();
}

/* ============================== Boot ============================== */

initRouter();
initTheme();
initQuizzes();
updateProgressUI();
initNetworkDemo();
initHalvingDemo();
initStakeDemo();
initContractDemo();
initGasDemo();
initNftDemo();
initFeeMarketDemo();
initCopyButtons();

if (SUBTLE_OK) {
  initHashPlayground();
  initAvalanche();
  initMerkleDemo();
  initChainDemo();
  initMiningSim();
  initKeysDemo();
} else {
  $('#crypto-warning').hidden = false;
}
