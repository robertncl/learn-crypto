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

const ROUTES = ['home', 'basics', 'hashing', 'blocks', 'mining', 'keys', 'consensus', 'glossary'];

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
const QUIZ_IDS = ['basics', 'hashing', 'blocks', 'mining', 'keys', 'consensus'];

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

/* ============================== Boot ============================== */

initRouter();
initTheme();
initQuizzes();
updateProgressUI();
initNetworkDemo();
initStakeDemo();

if (SUBTLE_OK) {
  initHashPlayground();
  initAvalanche();
  initChainDemo();
  initMiningSim();
  initKeysDemo();
} else {
  $('#crypto-warning').hidden = false;
}
