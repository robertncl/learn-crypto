import { $, $$, el } from '../core/dom.js';

/* ============================== Module 1: who decides the truth? ============================== */

export function initNetworkDemo() {
  const NODES = ['A', 'B', 'C', 'D', 'E'];
  const LEDGER = ['Alice → Bob: 5', 'Bob → Carol: 2'];
  const HONEST = 'Carol → Dan: 1';
  const FORGED = 'Carol → Mallory: 99';

  const network = $('#network-demo');
  const verdict = $('#network-verdict');
  const forged = new Set();

  const cards = NODES.map((name) => {
    const chip = el('span', { className: 'status-chip' });
    const last = el('li');
    const btn = el('button', { type: 'button', className: 'btn', 'aria-pressed': 'false' });
    const card = el('article', { className: 'node-card', 'aria-label': `Node ${name}` },
      el('h3', {}, `Node ${name} `, chip),
      el('ul', { className: 'mini-ledger' }, ...LEDGER.map((entry) => el('li', { textContent: entry })), last),
      btn);
    btn.addEventListener('click', () => {
      if (forged.has(name)) forged.delete(name);
      else forged.add(name);
      render();
    });
    network.append(card);
    return { name, card, chip, last, btn };
  });

  function render() {
    const bad = forged.size;
    const good = NODES.length - bad;
    const forgedWins = bad > good;

    for (const { name, card, chip, last, btn } of cards) {
      const isForged = forged.has(name);
      // A copy is "rejected" when it disagrees with whatever the majority holds.
      const rejected = isForged !== forgedWins;
      card.classList.toggle('is-forged', isForged);
      card.classList.toggle('is-rejected', rejected);
      last.textContent = isForged ? FORGED : HONEST;
      last.className = isForged ? 'entry-fake' : '';
      chip.textContent = rejected ? '✗ outvoted' : '✓ majority';
      btn.textContent = isForged ? 'Restore' : '😈 Corrupt';
      btn.setAttribute('aria-pressed', String(isForged));
      btn.setAttribute('aria-label', isForged ? `Restore node ${name}` : `Corrupt node ${name}`);
    }

    $('#vote-honest').style.inlineSize = `${(good / NODES.length) * 100}%`;
    $('#vote-forged').style.inlineSize = `${(bad / NODES.length) * 100}%`;

    verdict.className = `verdict ${forgedWins ? 'bad' : 'ok'}`;
    verdict.textContent =
      bad === 0 ? `✓ All ${NODES.length} copies agree. The network’s ledger ends “${HONEST}”.`
      : !forgedWins ? `✓ ${good} of ${NODES.length} copies still agree on “${HONEST}” — the forged ${bad === 1 ? 'copy is' : 'copies are'} simply outvoted.`
      : good > 0 ? `✗ ${bad} of ${NODES.length} copies now say “${FORGED}”, and the majority rules: the forged history wins. Mallory has pulled off a majority (“51%”) attack.`
      : `✗ Every copy is forged — there is no honest version left to compare against.`;
  }

  $('#network-reset').addEventListener('click', () => {
    forged.clear();
    render();
  });

  render();
}

/* ============================== Module 1: do you need a blockchain? ============================== */

export function initNeedBlockchainDemo() {
  const SCENARIOS = {
    bakery: { answers: [false, false, false], note: 'One owner writes every record. A spreadsheet or database is faster, cheaper and easier to fix when someone makes a typo.' },
    game: { answers: [true, false, false], note: 'Millions of players submit scores, but everyone already trusts the studio’s servers to run the game itself — a blockchain would add cost without removing any trust.' },
    banks: { answers: [true, true, false], note: 'Rival banks don’t trust each other, but they all accept central banks and clearing houses as referees. That is why most bank “blockchain” pilots ended up as shared databases or permissioned ledgers.' },
    money: { answers: [true, true, true], note: 'Anyone may pay anyone, nobody trusts anybody, and any middleman could be pressured to freeze or reverse payments — the gap Bitcoin was built to fill.' },
  };
  const boxes = [1, 2, 3].map((i) => $(`#need-q${i}`));
  const buttons = $$('[data-scenario]');
  const verdict = $('#need-verdict');
  const note = $('#need-note');
  const defaultNote = note.textContent;

  function render(scenario = null) {
    const [writers, distrust, noMiddleman] = boxes.map((b) => b.checked);
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.scenario === scenario)));
    note.textContent = scenario ? SCENARIOS[scenario].note : defaultNote;

    const all = writers && distrust && noMiddleman;
    verdict.className = `verdict ${all ? 'ok' : 'neutral'}`;
    verdict.textContent =
      !writers ? '🗄️ Use a regular database. With a single writer there is nothing for strangers to agree on.'
      : !distrust ? '🗄️ Use a shared database with access controls. Writers who trust each other — or a common operator — don’t need trustless consensus.'
      : !noMiddleman ? '🏛️ Use the trusted middleman, or a permissioned ledger run by the members. An acceptable referee is faster and cheaper than global consensus.'
      : '⛓️ A public blockchain earns its cost here: many writers, no mutual trust, and no referee everyone accepts.';
  }

  boxes.forEach((b) => b.addEventListener('change', () => render()));
  buttons.forEach((btn) => btn.addEventListener('click', () => {
    SCENARIOS[btn.dataset.scenario].answers.forEach((v, i) => { boxes[i].checked = v; });
    render(btn.dataset.scenario);
  }));
  render();
}
