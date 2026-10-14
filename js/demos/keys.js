import { $, $$, el, enc, prefersReducedMotion, sha256Hex, sleep, svgEl } from '../core/dom.js';
import { bigIntToHex, bytesToBigInt, bytesToHex, randomBigIntBelow, utf8 } from '../lib/bytes.js';
import { sha256 } from '../lib/sha256.js';
import { N, encodePoint, getPublicKey, recoverFromNonceReuse, rfc6979Nonce, sign } from '../lib/secp256k1.js';
import { addressesForKey } from '../lib/addresses.js';
import { base58CheckDecode, checkEip55, segwitDecode } from '../lib/encoding.js';
import { WORDLIST, checkMnemonic, entropyToMnemonic, mnemonicToSeed } from '../lib/bip39.js';
import { derivePath } from '../lib/bip32.js';

/* ============================== Module 5: keys & signatures ============================== */

export function initKeysDemo() {
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

/* ============================== Module 5: a tiny elliptic curve ============================== */

export function initCurveDemo() {
  const P = 97; // y² = x³ + 7 over F₉₇ has 79 points — a prime, so every point generates them all
  const ORDER = 79;
  const modp = (a) => ((a % P) + P) % P;
  const inv = (a) => {
    let r = 1;
    let b = modp(a);
    for (let e = P - 2; e > 0; e >>= 1) {
      if (e & 1) r = (r * b) % P;
      b = (b * b) % P;
    }
    return r; // Fermat: a^(p−2) ≡ a⁻¹ (mod p)
  };
  /* The chord-and-tangent rule, modulo p. null is the point at infinity. */
  const add = (p1, p2) => {
    if (!p1) return p2;
    if (!p2) return p1;
    if (p1.x === p2.x && modp(p1.y + p2.y) === 0) return null;
    const lambda = p1.x === p2.x
      ? modp(3 * p1.x * p1.x * inv(2 * p1.y))
      : modp((p2.y - p1.y) * inv(p2.x - p1.x));
    const x = modp(lambda * lambda - p1.x - p2.x);
    return { x, y: modp(lambda * (p1.x - x) - p1.y) };
  };

  const points = [];
  for (let x = 0; x < P; x++) {
    for (let y = 0; y < P; y++) if (modp(y * y - x * x * x - 7) === 0) points.push({ x, y });
  }
  const G = points.find((pt) => pt.x > 0);
  const multiples = [null, G]; // multiples[m] = m × G
  for (let m = 2; m < ORDER; m++) multiples.push(add(multiples[m - 1], G));
  const indexOf = new Map(multiples.map((pt, m) => [pt && `${pt.x},${pt.y}`, m]));

  const svg = $('#curve-plot');
  const slider = $('#curve-k');
  const verdict = $('#curve-verdict');
  const crackBtn = $('#curve-crack');
  const toSvg = (pt) => ({ cx: pt.x, cy: P - 1 - pt.y }); // flip so y grows upward
  let secret = null;
  let cracking = false;

  const staticLayer = svgEl('g', {},
    svgEl('rect', { x: -2, y: -2, width: P + 3, height: P + 3, class: 'curve-frame' }),
    ...points.map((pt) => svgEl('circle', { ...toSvg(pt), r: 1.3, class: 'curve-pt' },
      svgEl('title', {}, `${indexOf.get(`${pt.x},${pt.y}`)} × G = (${pt.x}, ${pt.y})`))));
  const dynamicLayer = svgEl('g');
  svg.append(staticLayer, dynamicLayer);

  const label = (pt, text, cls) => {
    const { cx, cy } = toSvg(pt);
    const right = cx < P - 14;
    return svgEl('text', { x: cx + (right ? 3 : -3), y: cy - 3, 'text-anchor': right ? 'start' : 'end', class: `curve-label ${cls}` }, text);
  };

  function render() {
    const k = Number(slider.value);
    const pub = multiples[k];
    const path = multiples.slice(1, k + 1).map((pt) => { const { cx, cy } = toSvg(pt); return `${cx},${cy}`; }).join(' ');
    dynamicLayer.replaceChildren(
      svgEl('polyline', { points: path, class: 'curve-path' }),
      svgEl('circle', { ...toSvg(G), r: 2.4, class: 'curve-g' }),
      label(G, 'G', 'is-g'),
      secret && svgEl('circle', { ...toSvg(multiples[secret]), r: 3.6, class: 'curve-target' }),
      secret && label(multiples[secret], '?', 'is-target'),
      svgEl('circle', { ...toSvg(pub), r: 2.4, class: 'curve-pub' }),
      k > 1 && label(pub, `${k}G`, 'is-pub'),
    );

    $('#curve-k-out').textContent = String(k);
    $('#curve-pub').textContent = `(${pub.x}, ${pub.y})`;
    slider.setAttribute('aria-valuetext', `k = ${k}, public key (${pub.x}, ${pub.y})`);
    const bits = k.toString(2);
    const doublings = bits.length - 1;
    const additions = [...bits].filter((b) => b === '1').length - 1;
    $('#curve-steps').textContent = k === 1
      ? 'k = 1: the public key is G itself.'
      : `${k} = ${bits} in binary → ${doublings} doubling${doublings === 1 ? '' : 's'} + ${additions} addition${additions === 1 ? '' : 's'}, instead of ${k - 1} single hops.`;
  }

  $('#curve-hide').addEventListener('click', () => {
    if (cracking) return;
    secret = 2 + Math.floor(Math.random() * (ORDER - 3));
    const target = multiples[secret];
    crackBtn.disabled = false;
    verdict.className = 'verdict neutral';
    verdict.textContent = `🎯 A secret key now hides behind the ringed point (${target.x}, ${target.y}). That point is public — can you find k? Drag the slider, or brute-force it.`;
    render();
  });

  crackBtn.addEventListener('click', async () => {
    if (!secret || cracking) return;
    cracking = true;
    crackBtn.disabled = true;
    const target = multiples[secret];
    const animate = !prefersReducedMotion();
    let m = 1;
    for (; m < ORDER; m++) {
      if (animate) {
        slider.value = String(m);
        render();
        await sleep(45);
      }
      if (multiples[m].x === target.x && multiples[m].y === target.y) break;
    }
    slider.value = String(m);
    render();
    cracking = false;
    verdict.className = 'verdict ok';
    verdict.textContent = `✓ Found it: k = ${m}, after trying ${m} keys. On a ${ORDER}-point curve that’s instant. secp256k1 has about 1.16 × 10⁷⁷ points: at a billion billion tries per second, the same search would take ~10⁵¹ years.`;
    secret = null;
  });

  slider.addEventListener('input', render);
  render();
}

/* ============================== Module 5: one key, two blockchains ============================== */

export function initAddressDemo() {
  const pipeline = $('#addr-pipeline');
  const checkInput = $('#addr-check');
  const checkVerdict = $('#addr-check-verdict');

  const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const BECH32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

  const step = (title, ...body) => el('li', {}, el('p', { className: 'pipeline-title', textContent: title }), ...body);
  const value = (text, extra = '') => el('code', { className: `hash-inline pipeline-value ${extra}`, textContent: text });

  function show(privateKey) {
    const a = addressesForKey(privateKey);
    pipeline.replaceChildren(
      step('1 · Private key — 256 random bits. Keep it secret.', value(bigIntToHex(privateKey), 'is-secret')),
      step('2 · Public key = k × G on secp256k1 — a point (x, y). Safe to share.',
        value(`x = ${bigIntToHex(a.publicKey.x)}`), value(`y = ${bigIntToHex(a.publicKey.y)}`),
        el('span', { className: 'stat-line', textContent: `Compressed form: ${a.publicKey.y & 1n ? '03' : '02'} (y is ${a.publicKey.y & 1n ? 'odd' : 'even'}) + x` })),
      step('3a · Ethereum: Keccak-256(x ‖ y), keep the last 20 bytes, add the EIP-55 mixed-case checksum',
        value(a.ethereum, 'is-address')),
      step('3b · Bitcoin: HASH160 = RIPEMD-160(SHA-256(compressed key))', value(bytesToHex(a.hash160)),
        el('span', { className: 'stat-line', textContent: 'Native SegWit (Bech32, bc1q…):' }), value(a.p2wpkh, 'is-address'),
        el('span', { className: 'stat-line', textContent: 'Legacy (Base58Check, 1…):' }), value(a.p2pkh, 'is-address')),
    );
    $('#addr-warning').hidden = privateKey !== 1n;
    checkInput.value = a.ethereum;
    validate();
  }

  function validate() {
    const text = checkInput.value.trim();
    let ok = null;
    let message;
    if (/^0x/i.test(text)) {
      const result = checkEip55(text);
      ok = result === 'valid' ? true : result === 'invalid' ? false : null;
      message = result === 'valid' ? '✓ Valid Ethereum address: the pattern of capital letters matches its Keccak-256 checksum.'
        : result === 'invalid' ? (/^0x[0-9a-fA-F]{40}$/.test(text) ? '✗ The capitalization doesn’t match the EIP-55 checksum — a wallet would refuse to send.' : '✗ Not a well-formed Ethereum address (40 hex characters after 0x).')
        : '⚠️ Valid hex, but all in one case: it carries no checksum, so a typo would go unnoticed.';
    } else if (/^bc1/i.test(text)) {
      ok = segwitDecode(text) !== null;
      message = ok ? '✓ Valid Bech32 address: its 6-character checksum holds.' : '✗ Bech32 checksum fails — a wallet would refuse to send.';
    } else if (/^[13]/.test(text)) {
      const decoded = (() => { try { return base58CheckDecode(text); } catch { return null; } })();
      ok = decoded !== null;
      message = ok ? '✓ Valid Base58Check address: the 4-byte checksum (from SHA-256d) holds.' : '✗ Base58Check checksum fails — a wallet would refuse to send.';
    } else {
      message = text ? 'Unrecognized format — try an address starting with 0x, bc1 or 1.' : '';
    }
    checkVerdict.className = `verdict ${ok === true ? 'ok' : ok === false ? 'bad' : 'warn'}`;
    if (!text) checkVerdict.className = 'verdict';
    checkVerdict.textContent = message;
  }

  $('#addr-typo').addEventListener('click', () => {
    const text = checkInput.value.trim();
    const [skip, alphabet] = /^0x/i.test(text) ? [2, '0123456789abcdefABCDEF']
      : /^bc1/i.test(text) ? [4, BECH32] : [1, B58];
    if (text.length <= skip) return;
    const i = skip + Math.floor(Math.random() * (text.length - skip));
    let c;
    do c = alphabet[Math.floor(Math.random() * alphabet.length)]; while (c === text[i]);
    checkInput.value = text.slice(0, i) + c + text.slice(i + 1);
    validate();
  });

  checkInput.addEventListener('input', validate);
  $('#addr-random').addEventListener('click', () => show(randomBigIntBelow(N)));
  $('#addr-one').addEventListener('click', () => show(1n));
  show(randomBigIntBelow(N));
}

/* ============================== Module 5: seed phrases & HD wallets ============================== */

export function initSeedDemo() {
  const TEST_PHRASES = {
    abandon: `${'abandon '.repeat(11)}about`,
    test: `${'test '.repeat(11)}junk`,
  };
  const PATHS = [
    { chain: 'Ethereum', path: "m/44'/60'/0'/0/0", format: (a) => a.ethereum },
    { chain: 'Ethereum', path: "m/44'/60'/0'/0/1", format: (a) => a.ethereum },
    { chain: 'Ethereum', path: "m/44'/60'/0'/0/2", format: (a) => a.ethereum },
    { chain: 'Bitcoin', path: "m/84'/0'/0'/0/0", format: (a) => a.p2wpkh },
    { chain: 'Bitcoin', path: "m/84'/0'/0'/0/1", format: (a) => a.p2wpkh },
  ];
  const list = $('#seed-words');
  const verdict = $('#seed-verdict');
  const passInput = $('#seed-pass');
  const tbody = $('#seed-addresses');
  const progressOut = $('#seed-progress');
  const fixBtn = $('#seed-fix');
  let words = [];
  let typo = null; // { index, original }
  let derivation = 0;
  let passTimer = 0;

  function renderWords() {
    const bits = words.map((w) => WORDLIST.indexOf(w).toString(2).padStart(11, '0'));
    list.replaceChildren(...words.map((w, i) => {
      const last = i === words.length - 1;
      const b = bits[i];
      return el('li', { className: typo?.index === i ? 'is-typo' : '' },
        el('span', { className: 'seed-word', textContent: w }),
        el('code', { className: 'seed-bits' },
          last ? b.slice(0, 7) : b,
          last ? el('mark', { className: 'checksum', title: 'checksum bits', textContent: b.slice(7) }) : null));
    }));
  }

  async function derive() {
    const run = ++derivation;
    const result = checkMnemonic(words);
    fixBtn.hidden = !typo;
    if (!result.ok) {
      verdict.className = 'verdict bad';
      verdict.textContent = `✗ Checksum fails: the last word should end in bits ${result.expected}, not ${result.actual}. A wallet refuses this phrase instead of opening the wrong wallet.`;
      tbody.replaceChildren(el('tr', {}, el('td', { colSpan: 3, textContent: 'No addresses — a wallet would stop at the checksum.' })));
      progressOut.textContent = '';
      return;
    }
    verdict.className = `verdict ${typo ? 'warn' : 'ok'}`;
    verdict.textContent = typo
      ? '⚠️ The checksum still passes — by luck. Four checksum bits catch only 15 of 16 errors, so this mistyped phrase opens a different, empty wallet. Compare the addresses.'
      : '✓ Checksum OK: the last 4 bits equal the first 4 bits of SHA-256 of the 128 entropy bits.';
    progressOut.textContent = 'Deriving keys…';
    const seed = await mnemonicToSeed(words.join(' '), passInput.value);
    const rows = [];
    for (const { chain, path, format } of PATHS) {
      const node = await derivePath(seed, path);
      rows.push(el('tr', {},
        el('td', { textContent: chain }),
        el('td', {}, el('code', { textContent: path })),
        el('td', {}, el('code', { className: 'hash-inline', textContent: format(addressesForKey(node.privateKey)) }))));
    }
    if (run !== derivation) return; // a newer phrase or passphrase arrived meanwhile
    tbody.replaceChildren(...rows);
    progressOut.textContent = `Seed (PBKDF2-HMAC-SHA512): ${bytesToHex(seed).slice(0, 32)}… — ${passInput.value ? 'with your passphrase' : 'no passphrase'}.`;
  }

  function load(newWords) {
    words = newWords;
    typo = null;
    renderWords();
    derive();
  }

  $('#seed-new').addEventListener('click', () => load(entropyToMnemonic(crypto.getRandomValues(new Uint8Array(16))).words));
  $$('[data-test-phrase]').forEach((btn) => btn.addEventListener('click', () => load(TEST_PHRASES[btn.dataset.testPhrase].split(' '))));
  $('#seed-typo').addEventListener('click', () => {
    if (typo) words[typo.index] = typo.original; // one error at a time
    const index = Math.floor(Math.random() * words.length);
    const original = words[index];
    let replacement;
    do replacement = WORDLIST[Math.floor(Math.random() * WORDLIST.length)]; while (replacement === original);
    typo = { index, original };
    words[index] = replacement;
    renderWords();
    derive();
  });
  fixBtn.addEventListener('click', () => {
    if (!typo) return;
    words[typo.index] = typo.original;
    typo = null;
    renderWords();
    derive();
  });
  passInput.addEventListener('input', () => {
    clearTimeout(passTimer);
    passTimer = setTimeout(derive, 300);
  });
  load(entropyToMnemonic(crypto.getRandomValues(new Uint8Array(16))).words);
}

/* ============================== Module 5: nonce reuse leaks the key ============================== */

export function initNonceDemo() {
  const victim = randomBigIntBelow(N);
  const victimPub = getPublicKey(victim);
  const sigsOut = $('#nonce-sigs');
  const stepsOut = $('#nonce-steps');
  const verdict = $('#nonce-verdict');
  const attackBtn = $('#nonce-attack');
  let signed = null;

  const short = (n) => {
    const h = bigIntToHex(n);
    return `${h.slice(0, 10)}…${h.slice(-6)}`;
  };
  $('#nonce-victim').textContent = `Victim’s public key (on-chain for all to see): ${bytesToHex(encodePoint(victimPub)).slice(0, 18)}… — the private key is hidden.`;

  $('#nonce-sign').addEventListener('click', () => {
    const mode = $('input[name="nonce-mode"]:checked').value;
    const z1 = sha256(utf8($('#nonce-m1').value));
    const z2 = sha256(utf8($('#nonce-m2').value));
    const shared = randomBigIntBelow(N);
    const k1 = mode === 'random' ? randomBigIntBelow(N) : mode === 'reuse' ? shared : rfc6979Nonce(victim, z1);
    const k2 = mode === 'random' ? randomBigIntBelow(N) : mode === 'reuse' ? shared : rfc6979Nonce(victim, z2);
    signed = { z1: bytesToBigInt(z1), z2: bytesToBigInt(z2), sig1: sign(z1, victim, k1), sig2: sign(z2, victim, k2) };
    const sameR = signed.sig1.r === signed.sig2.r;
    const card = (n, sig) => el('div', { className: 'sig-card' },
      el('p', { className: 'pipeline-title', textContent: `Signature ${n}` }),
      el('p', {}, el('span', { className: sameR ? 'same-r' : '' }, `r = ${short(sig.r)}`)),
      el('p', {}, `s = ${short(sig.s)}`));
    sigsOut.replaceChildren(card(1, signed.sig1), card(2, signed.sig2),
      el('p', { className: `stat-line ${sameR ? 'same-r-note' : ''}`, textContent: sameR ? '⚠️ Both signatures share the same r — so they used the same k.' : 'Different r values: different nonces.' }));
    stepsOut.replaceChildren();
    verdict.className = 'verdict';
    verdict.textContent = '';
    attackBtn.disabled = false;
  });

  attackBtn.addEventListener('click', () => {
    const { z1, z2, sig1, sig2 } = signed;
    if (sig1.r !== sig2.r) {
      stepsOut.replaceChildren(el('li', { textContent: 'Each signature equation has its own unknown nonce: two equations, three unknowns (k₁, k₂ and the key d).' }));
      verdict.className = 'verdict ok';
      verdict.textContent = '✓ The attack goes nowhere: with a fresh nonce per signature, the algebra can’t isolate the private key.';
      return;
    }
    if (sig1.s === sig2.s) {
      stepsOut.replaceChildren(el('li', { textContent: 'Same message, same nonce → the two signatures are identical. The attacker learns nothing new.' }));
      verdict.className = 'verdict ok';
      verdict.textContent = '✓ Nothing to exploit: identical signatures over identical messages leak nothing. Try two different messages.';
      return;
    }
    const { k, d } = recoverFromNonceReuse(z1, sig1, z2, sig2);
    const check = getPublicKey(d);
    const ok = check.x === victimPub.x && check.y === victimPub.y;
    stepsOut.replaceChildren(
      el('li', {}, 'Subtract the two equations sᵢ = k⁻¹(zᵢ + r·d): the d terms cancel. ', el('code', { className: 'hash-inline', textContent: `k = (z₁ − z₂) / (s₁ − s₂) mod n = ${short(k)}` })),
      el('li', {}, 'Put k back into the first equation and solve for d: ', el('code', { className: 'hash-inline', textContent: `d = (s₁·k − z₁) / r mod n = ${short(d)}` })),
      el('li', {}, 'Check: d × G ', el('strong', { textContent: ok ? 'equals the victim’s public key.' : 'does not match.' })),
    );
    verdict.className = `verdict ${ok ? 'bad' : 'neutral'}`;
    verdict.textContent = ok
      ? `✗ Private key recovered: ${bigIntToHex(d)}. Every coin at the victim’s addresses can now be taken.`
      : 'Recovery failed.';
  });
}
