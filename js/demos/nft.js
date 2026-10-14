import { $, $$, el } from '../core/dom.js';
import { utf8 } from '../lib/bytes.js';
import { sha256 } from '../lib/sha256.js';
import { cidV1Raw } from '../lib/encoding.js';

/* ============================== Module 8: NFT (ERC-721) demo ============================== */

export function initNftDemo() {
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

/* ============================== Module 8: where the picture lives ============================== */

export function initLinkRotDemo() {
  const ORIGINAL = { name: 'Inky', description: 'Critter #7 — a very good octopus', image: '🐙' };
  const SWAPPED = { name: 'Rock', description: 'Critter #7', image: '🪨' };
  const json = (m) => JSON.stringify(m, null, 2);
  const cidOf = (m) => cidV1Raw(sha256(utf8(json(m))));
  const ORIGINAL_CID = cidOf(ORIGINAL);
  const SWAPPED_CID = cidOf(SWAPPED);
  const toBase64 = (text) => btoa(String.fromCharCode(...utf8(text))); // UTF-8 safe (emoji)

  const verdict = $('#cid-verdict');
  const pin = $('#cid-pin');
  let swapped = false;
  let down = false;

  const mode = () => $('input[name="cid-mode"]:checked').value;

  function walletCard(meta, note) {
    return meta
      ? [el('p', { className: 'nft-art', textContent: meta.image }), el('p', { className: 'nft-name', textContent: meta.name }),
        el('p', { className: 'nft-id', textContent: 'Token #7' }), el('p', { className: 'nft-uri', textContent: note })]
      : [el('p', { className: 'nft-art', textContent: '⬜' }), el('p', { className: 'nft-name', textContent: 'Image unavailable' }),
        el('p', { className: 'nft-id', textContent: 'Token #7' }), el('p', { className: 'nft-uri', textContent: note })];
  }

  function render() {
    const m = mode();
    const hosted = swapped ? SWAPPED : ORIGINAL;
    $('#cid-pin-row').hidden = m !== 'ipfs';
    $('#cid-swap').disabled = m === 'chain' || swapped;
    $('#cid-down').disabled = m === 'chain' || down;

    $('#cid-uri').textContent = m === 'https' ? 'https://api.critters.example/token/7.json'
      : m === 'ipfs' ? `ipfs://${ORIGINAL_CID}`
        : `data:application/json;base64,${toBase64(json(ORIGINAL)).slice(0, 44)}…`;
    $('#cid-file-label').textContent = m === 'chain' ? 'The metadata, stored inside the contract' : 'The metadata file on the host';
    $('#cid-file').textContent = m === 'chain' ? json(ORIGINAL)
      : down ? '(server offline — no response)'
        : `${json(hosted)}${m === 'ipfs' ? `\n\n// this file’s CID: ${swapped ? SWAPPED_CID : ORIGINAL_CID}` : ''}`;

    let meta;
    let note;
    let message;
    let tone;
    if (m === 'chain') {
      meta = ORIGINAL;
      note = 'read from the contract';
      tone = 'ok';
      message = '✓ Nothing to swap and no host to shut down: the metadata lives in the contract itself, for as long as the chain does. The price is gas — storing data on-chain is expensive.';
    } else if (m === 'https') {
      meta = down ? null : hosted;
      note = down ? 'HTTP 404' : 'fetched from the server';
      tone = down ? 'bad' : swapped ? 'warn' : 'neutral';
      message = down ? '✗ 404. The token still exists and you still own it — but it points at nothing.'
        : swapped ? '⚠️ The picture changed, and nothing flags it. An HTTPS link names a location, not content: you own whatever the server says today.'
          : 'Everything works — for now. Try swapping the picture or shutting the server down.';
    } else {
      // IPFS: the wallet asks the network for the original CID. Who still has those exact bytes?
      const hostHasOriginal = !down && !swapped;
      const available = hostHasOriginal || pin.checked;
      meta = available ? ORIGINAL : null;
      note = available ? `verified: hash matches ${ORIGINAL_CID.slice(0, 12)}…` : 'CID not found on the network';
      tone = available ? (swapped || down ? 'ok' : 'neutral') : 'bad';
      message = swapped
        ? (available ? `✓ The host uploaded a new picture — but those bytes hash to a different CID (${SWAPPED_CID.slice(0, 14)}…). The token still names the original, and another node still serves it, verified by its hash.`
          : '✗ The original is gone: the only node holding it replaced it, and nobody else pinned it. Content addressing stops silent swaps; it can’t make anyone keep a copy.')
        : down
          ? (available ? '✓ The host vanished, but another node still pins the file, so the CID still resolves.'
            : '✗ Nobody pins this CID any more. The link is permanent; the file isn’t.')
          : 'Everything works. The link is the file’s hash, so whatever the network returns can be checked against it.';
    }
    $('#cid-wallet').replaceChildren(...walletCard(meta, note));
    verdict.className = `verdict ${tone}`;
    verdict.textContent = message;
  }

  $$('input[name="cid-mode"]').forEach((r) => r.addEventListener('change', () => { swapped = false; down = false; render(); }));
  $('#cid-swap').addEventListener('click', () => { swapped = true; render(); });
  $('#cid-down').addEventListener('click', () => { down = true; render(); });
  $('#cid-reset').addEventListener('click', () => { swapped = false; down = false; pin.checked = true; render(); });
  pin.addEventListener('change', render);
  render();
}

/* ============================== Module 8: marketplace, approvals, royalties ============================== */

export function initMarketplaceDemo() {
  const PRICE = 5;
  const ROYALTY = 0.05;
  const NAMES = { Alice: '🦊 Alice', Bob: '🐢 Bob', Mallory: '😈 Mallory' };
  const log = $('#mkt-log');
  let tokens;
  let eth;
  let approvals;
  let listed;

  const addLog = (text, ok) => {
    $('.log-empty', log)?.remove();
    log.prepend(el('li', { className: ok ? 'log-ok' : 'log-bad', textContent: text }));
  };
  const owned = (who) => tokens.filter((t) => t.owner === who);
  const ethText = (who) => `${eth[who].toLocaleString(undefined, { maximumFractionDigits: 2 })} ETH · ${owned(who).length} NFT${owned(who).length === 1 ? '' : 's'}`;

  function render() {
    $('#mkt-tokens').replaceChildren(...tokens.map((t) => el('article', { className: `nft-card${t.owner === 'Mallory' ? ' is-stolen' : ''}` },
      el('p', { className: 'nft-art', textContent: t.art }),
      el('p', { className: 'nft-name', textContent: t.name }),
      el('p', { className: 'nft-id', textContent: `Token #${t.id}${listed && t.id === 1 ? ' · listed 5 ETH' : ''}` }),
      el('p', { className: 'nft-owner', textContent: `owner: ${NAMES[t.owner]}` }))));
    $('#mkt-alice').textContent = ethText('Alice');
    $('#mkt-bob').textContent = ethText('Bob');
    $('#mkt-ada').textContent = `${eth.Ada.toLocaleString(undefined, { maximumFractionDigits: 2 })} ETH in royalties`;
    $('#mkt-approvals').textContent = approvals.size ? [...approvals].join(', ') : 'none';
  }

  $('#mkt-approve').addEventListener('click', () => {
    approvals.add('Marketplace');
    addLog('✅ ApprovalForAll(Alice → Marketplace, true). The marketplace may now move ANY of Alice’s tokens in this collection.', true);
    render();
  });

  $('#mkt-list').addEventListener('click', () => {
    if (tokens[0].owner !== 'Alice') addLog('❌ Alice no longer owns #1, so she can’t list it.', false);
    else if (!approvals.has('Marketplace')) addLog('❌ Listing refused: the marketplace isn’t an approved operator, so it could never call transferFrom for Alice. She has to approve it first.', false);
    else if (listed) addLog('#1 is already listed.', true);
    else {
      listed = true;
      addLog('✅ Listed #1 for 5 ETH — a signed off-chain order, so it costs no gas.', true);
    }
    render();
  });

  $('#mkt-buy').addEventListener('click', () => {
    if (!listed) addLog('❌ Nothing for sale yet — Alice hasn’t listed #1.', false);
    else if (tokens[0].owner !== 'Alice') {
      listed = false;
      addLog('❌ Order failed: Alice no longer owns #1 (look who does).', false);
    } else if (!approvals.has('Marketplace')) addLog('❌ transferFrom reverted: Alice revoked the marketplace’s approval, so it can’t move the token.', false);
    else if (eth.Bob < PRICE) addLog('❌ Bob can’t afford another 5 ETH.', false);
    else {
      const royalty = $('#mkt-royalty').checked ? PRICE * ROYALTY : 0;
      eth.Bob -= PRICE;
      eth.Alice += PRICE - royalty;
      eth.Ada += royalty;
      tokens[0].owner = 'Bob';
      listed = false;
      addLog(`✅ Sale: Bob paid 5 ETH → the marketplace called transferFrom(Alice → Bob, #1) → Alice +${PRICE - royalty} ETH, Ada +${royalty} ETH${royalty ? ' royalty' : ' — the NFT contract never saw the price'}.`, true);
    }
    render();
  });

  $('#mkt-phish').addEventListener('click', () => {
    approvals.add('Drainer');
    addLog('⚠️ ApprovalForAll(Alice → 0xDra1…n3r, true) — what the “free mint” button really asked Alice to sign.', false);
    const loot = owned('Alice');
    if (!loot.length) addLog('The drainer finds nothing left to take.', true);
    for (const t of loot) {
      t.owner = 'Mallory';
      addLog(`🚨 Transfer(#${t.id} ${t.art} ${t.name}: Alice → Mallory) — executed by the drainer seconds later. Perfectly valid: Alice approved it.`, false);
    }
    render();
  });

  $('#mkt-revoke').addEventListener('click', () => {
    if (!approvals.size) addLog('No approvals to revoke.', true);
    else addLog(`✅ setApprovalForAll(…, false) for ${[...approvals].join(' and ')} — but revoking can’t bring back what was already taken.`, true);
    approvals.clear();
    render();
  });

  function reset() {
    tokens = [{ id: 1, art: '🐉', name: 'Draco', owner: 'Alice' }, { id: 2, art: '🦄', name: 'Sparkle', owner: 'Alice' }];
    eth = { Alice: 0, Bob: 10, Ada: 0 };
    approvals = new Set();
    listed = false;
    log.replaceChildren(el('li', { className: 'log-empty', textContent: 'no transactions yet' }));
    render();
  }

  $('#mkt-reset').addEventListener('click', reset);
  reset();
}
