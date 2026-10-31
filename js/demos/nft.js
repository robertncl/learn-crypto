import { $, $$, el, locale, num } from '../core/dom.js';
import { t as tr } from '../core/i18n.js';
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
      idTag.textContent = tr('nft.token', { id: t.id });

      const ownerTag = document.createElement('p');
      ownerTag.className = 'nft-owner';
      ownerTag.textContent = tr('nft.owner', { name: ACCOUNTS[t.owner] });

      const uri = document.createElement('p');
      uri.className = 'nft-uri';
      uri.textContent = `🔗 ipfs://…/${t.id}.json`;
      uri.title = tr('nft.uriTitle');

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
      addLog(tr('nft.revertOwner', { call, from: ACCOUNTS[from], id, owner: ACCOUNTS[token.owner] }), false);
      return;
    }
    if (from === to) {
      addLog(tr('nft.revertSame', { call, id, to: ACCOUNTS[to] }), false);
      return;
    }
    token.owner = to;
    render();
    addLog(tr('nft.transferOk', { id, art: token.art, name: token.name, from: ACCOUNTS[from], to: ACCOUNTS[to] }), true);
  });

  $('#nft-mint').addEventListener('click', () => {
    const to = caller.value;
    const critter = CRITTERS[mintCursor % CRITTERS.length];
    mintCursor++;
    const token = { id: nextId++, art: critter.art, name: critter.name, owner: to };
    tokens.push(token);
    render();
    tokenSelect.value = String(token.id);
    addLog(tr('nft.mintOk', { id: token.id, art: token.art, name: token.name, to: ACCOUNTS[to] }), true);
  });

  $('#nft-reset').addEventListener('click', () => {
    tokens = INITIAL.map((t) => ({ ...t }));
    nextId = 4;
    mintCursor = 3;
    const empty = document.createElement('li');
    empty.className = 'log-empty';
    empty.textContent = tr('log.empty');
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
        el('p', { className: 'nft-id', textContent: tr('nft.token', { id: 7 }) }), el('p', { className: 'nft-uri', textContent: note })]
      : [el('p', { className: 'nft-art', textContent: '⬜' }), el('p', { className: 'nft-name', textContent: tr('cid.unavailable') }),
        el('p', { className: 'nft-id', textContent: tr('nft.token', { id: 7 }) }), el('p', { className: 'nft-uri', textContent: note })];
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
    $('#cid-file-label').textContent = tr(m === 'chain' ? 'cid.metaChain' : 'cid.metaHost');
    $('#cid-file').textContent = m === 'chain' ? json(ORIGINAL)
      : down ? tr('cid.offline')
        : `${json(hosted)}${m === 'ipfs' ? `\n\n${tr('cid.fileCid', { cid: swapped ? SWAPPED_CID : ORIGINAL_CID })}` : ''}`;

    let meta;
    let note;
    let message;
    let tone;
    if (m === 'chain') {
      meta = ORIGINAL;
      note = tr('cid.noteChain');
      tone = 'ok';
      message = tr('cid.vChain');
    } else if (m === 'https') {
      meta = down ? null : hosted;
      note = tr(down ? 'cid.note404' : 'cid.noteServer');
      tone = down ? 'bad' : swapped ? 'warn' : 'neutral';
      message = tr(down ? 'cid.vHttp404' : swapped ? 'cid.vHttpSwap' : 'cid.vHttpOk');
    } else {
      // IPFS: the wallet asks the network for the original CID. Who still has those exact bytes?
      const hostHasOriginal = !down && !swapped;
      const available = hostHasOriginal || pin.checked;
      meta = available ? ORIGINAL : null;
      note = available ? tr('cid.noteVerified', { cid: ORIGINAL_CID.slice(0, 12) }) : tr('cid.noteMissing');
      tone = available ? (swapped || down ? 'ok' : 'neutral') : 'bad';
      message = swapped
        ? tr(available ? 'cid.vIpfsSwapOk' : 'cid.vIpfsSwapGone', { cid: SWAPPED_CID.slice(0, 14) })
        : down
          ? tr(available ? 'cid.vIpfsDownOk' : 'cid.vIpfsDownGone')
          : tr('cid.vIpfsOk');
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
  const ethText = (who) => tr('mkt.holdings', { n: owned(who).length, eth: num(eth[who], { maximumFractionDigits: 2 }) });
  const operatorName = (op) => tr(`mkt.op.${op}`);

  function render() {
    $('#mkt-tokens').replaceChildren(...tokens.map((t) => el('article', { className: `nft-card${t.owner === 'Mallory' ? ' is-stolen' : ''}` },
      el('p', { className: 'nft-art', textContent: t.art }),
      el('p', { className: 'nft-name', textContent: t.name }),
      el('p', { className: 'nft-id', textContent: tr(listed && t.id === 1 ? 'mkt.tokenListed' : 'nft.token', { id: t.id }) }),
      el('p', { className: 'nft-owner', textContent: tr('nft.owner', { name: NAMES[t.owner] }) }))));
    $('#mkt-alice').textContent = ethText('Alice');
    $('#mkt-bob').textContent = ethText('Bob');
    $('#mkt-ada').textContent = tr('mkt.royalties', { v: num(eth.Ada, { maximumFractionDigits: 2 }) });
    $('#mkt-approvals').textContent = approvals.size ? [...approvals].map(operatorName).join(', ') : tr('mkt.none');
  }

  $('#mkt-approve').addEventListener('click', () => {
    approvals.add('Marketplace');
    addLog(tr('mkt.approve'), true);
    render();
  });

  $('#mkt-list').addEventListener('click', () => {
    if (tokens[0].owner !== 'Alice') addLog(tr('mkt.listNotOwner'), false);
    else if (!approvals.has('Marketplace')) addLog(tr('mkt.listNoApproval'), false);
    else if (listed) addLog(tr('mkt.alreadyListed'), true);
    else {
      listed = true;
      addLog(tr('mkt.listed'), true);
    }
    render();
  });

  $('#mkt-buy').addEventListener('click', () => {
    if (!listed) addLog(tr('mkt.nothingForSale'), false);
    else if (tokens[0].owner !== 'Alice') {
      listed = false;
      addLog(tr('mkt.orderFailed'), false);
    } else if (!approvals.has('Marketplace')) addLog(tr('mkt.revokedFail'), false);
    else if (eth.Bob < PRICE) addLog(tr('mkt.poor'), false);
    else {
      const royalty = $('#mkt-royalty').checked ? PRICE * ROYALTY : 0;
      eth.Bob -= PRICE;
      eth.Alice += PRICE - royalty;
      eth.Ada += royalty;
      tokens[0].owner = 'Bob';
      listed = false;
      addLog(tr(royalty ? 'mkt.saleRoyalty' : 'mkt.saleNoRoyalty', { alice: PRICE - royalty, ada: royalty }), true);
    }
    render();
  });

  $('#mkt-phish').addEventListener('click', () => {
    approvals.add('Drainer');
    addLog(tr('mkt.phishApproval'), false);
    const loot = owned('Alice');
    if (!loot.length) addLog(tr('mkt.nothingToTake'), true);
    for (const t of loot) {
      t.owner = 'Mallory';
      addLog(tr('mkt.stolen', { id: t.id, art: t.art, name: t.name }), false);
    }
    render();
  });

  $('#mkt-revoke').addEventListener('click', () => {
    if (!approvals.size) addLog(tr('mkt.noApprovals'), true);
    else addLog(tr('mkt.revoked', { who: new Intl.ListFormat(locale(), { style: 'long', type: 'conjunction' }).format([...approvals].map(operatorName)) }), true);
    approvals.clear();
    render();
  });

  function reset() {
    tokens = [{ id: 1, art: '🐉', name: 'Draco', owner: 'Alice' }, { id: 2, art: '🦄', name: 'Sparkle', owner: 'Alice' }];
    eth = { Alice: 0, Bob: 10, Ada: 0 };
    approvals = new Set();
    listed = false;
    log.replaceChildren(el('li', { className: 'log-empty', textContent: tr('log.empty') }));
    render();
  }

  $('#mkt-reset').addEventListener('click', reset);
  reset();
}
