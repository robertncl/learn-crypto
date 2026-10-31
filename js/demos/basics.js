import { $, $$, el } from '../core/dom.js';
import { t } from '../core/i18n.js';

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
    const card = el('article', { className: 'node-card', 'aria-label': t('basics.node', { name }) },
      el('h3', {}, `${t('basics.node', { name })} `, chip),
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
      chip.textContent = t(rejected ? 'basics.outvoted' : 'basics.majority');
      btn.textContent = t(isForged ? 'basics.restore' : 'basics.corrupt');
      btn.setAttribute('aria-pressed', String(isForged));
      btn.setAttribute('aria-label', t(isForged ? 'basics.restoreNode' : 'basics.corruptNode', { name }));
    }

    $('#vote-honest').style.inlineSize = `${(good / NODES.length) * 100}%`;
    $('#vote-forged').style.inlineSize = `${(bad / NODES.length) * 100}%`;

    verdict.className = `verdict ${forgedWins ? 'bad' : 'ok'}`;
    const total = NODES.length;
    verdict.textContent =
      bad === 0 ? t('basics.v.agree', { total, entry: HONEST })
      : !forgedWins ? t('basics.v.outvoted', { n: bad, good, total, entry: HONEST })
      : good > 0 ? t('basics.v.forgedWins', { bad, total, entry: FORGED })
      : t('basics.v.allForged');
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
    bakery: { answers: [false, false, false] },
    game: { answers: [true, false, false] },
    banks: { answers: [true, true, false] },
    money: { answers: [true, true, true] },
  };
  const boxes = [1, 2, 3].map((i) => $(`#need-q${i}`));
  const buttons = $$('[data-scenario]');
  const verdict = $('#need-verdict');
  const note = $('#need-note');
  const defaultNote = note.textContent;

  function render(scenario = null) {
    const [writers, distrust, noMiddleman] = boxes.map((b) => b.checked);
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.scenario === scenario)));
    note.textContent = scenario ? t(`basics.scenario.${scenario}`) : defaultNote;

    const all = writers && distrust && noMiddleman;
    verdict.className = `verdict ${all ? 'ok' : 'neutral'}`;
    verdict.textContent =
      !writers ? t('basics.need.database')
      : !distrust ? t('basics.need.shared')
      : !noMiddleman ? t('basics.need.middleman')
      : t('basics.need.blockchain');
  }

  boxes.forEach((b) => b.addEventListener('change', () => render()));
  buttons.forEach((btn) => btn.addEventListener('click', () => {
    SCENARIOS[btn.dataset.scenario].answers.forEach((v, i) => { boxes[i].checked = v; });
    render(btn.dataset.scenario);
  }));
  render();
}
