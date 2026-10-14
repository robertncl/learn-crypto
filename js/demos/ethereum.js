import { $, $$, el, fmt, prefersReducedMotion, sleep } from '../core/dom.js';
import { createChart } from '../core/chart.js';
import { bytesToHex, utf8 } from '../lib/bytes.js';
import { keccak256 } from '../lib/keccak.js';
import { nextBaseFee } from '../lib/chain-math.js';

/* ============================== Module 7: smart-contract token demo ============================== */

export function initContractDemo() {
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

/* ============================== Module 7: fee estimator (base fee + tip) ============================== */

export function initGasDemo() {
  const op = $('#gas-op');
  const price = $('#gas-price');
  const tip = $('#gas-tip');
  const ethUsd = $('#gas-eth-usd');
  const usd = (eth) => `$${(eth * (Number(ethUsd.value) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const update = () => {
    const units = Number(op.value);
    const base = Number(price.value);
    const tipGwei = Number(tip.value);
    const burned = (units * base) / 1e9;
    const toValidator = (units * tipGwei) / 1e9;
    const total = burned + toValidator;

    $('#gas-price-out').textContent = `${base} gwei`;
    $('#gas-tip-out').textContent = `${tipGwei} gwei`;
    price.setAttribute('aria-valuetext', `${base} gwei base fee; you pay ${total.toFixed(6)} ETH`);
    tip.setAttribute('aria-valuetext', `${tipGwei} gwei tip`);
    $('#gas-units-out').textContent = units.toLocaleString();
    $('#gas-burn-out').textContent = `${burned.toFixed(6)} ETH · ${usd(burned)}`;
    $('#gas-tip-eth-out').textContent = `${toValidator.toFixed(6)} ETH · ${usd(toValidator)}`;
    $('#gas-eth-out').textContent = `${total.toFixed(6)} ETH · ${usd(total)}`;
    $('#gas-math').textContent =
      `${units.toLocaleString()} gas × (${base} base + ${tipGwei} tip) gwei = ${(units * (base + tipGwei)).toLocaleString()} gwei = ${total.toFixed(6)} ETH — ${Math.round((burned / total) * 100)}% of it burned.`;
  };

  [op, price, tip, ethUsd].forEach((el) => el.addEventListener('input', update));
  update();
}

/* ============================== Module 7: selectors & calldata ============================== */

export function initSelectorDemo() {
  const KNOWN = {
    a9059cbb: 'transfer — every ERC-20 token',
    '095ea7b3': 'approve — every ERC-20 token',
    '70a08231': 'balanceOf — ERC-20 and ERC-721',
    '23b872dd': 'transferFrom — ERC-20 and ERC-721',
    a22cb465: 'setApprovalForAll — every NFT collection',
    '18160ddd': 'totalSupply — every ERC-20 token',
    dd62ed3e: 'allowance — every ERC-20 token',
    '6352211e': 'ownerOf — every ERC-721 collection',
  };
  const DEFAULTS = {
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    uint: '1000000000000000000',
    bool: 'true',
    bytes32: '0x' + '00'.repeat(31) + '01',
  };
  const sigInput = $('#abi-sig');
  const argsHost = $('#abi-args');
  const verdict = $('#abi-verdict');
  let argInputs = [];
  let lastTypes = '';

  const kindOf = (type) => (type === 'address' ? 'address' : /^u?int\d*$/.test(type) ? 'uint' : type === 'bool' ? 'bool' : type === 'bytes32' ? 'bytes32' : null);

  /* ABI-encode one static argument into a 32-byte word (64 hex chars). */
  function encodeArg(type, raw) {
    const kind = kindOf(type);
    const text = raw.trim();
    if (kind === 'address') {
      if (!/^0x[0-9a-fA-F]{40}$/.test(text)) throw new Error('an address is 0x + 40 hex characters');
      return text.slice(2).toLowerCase().padStart(64, '0');
    }
    if (kind === 'uint') {
      if (!/^\d+$/.test(text)) throw new Error('enter a whole number (amounts are integers — 1 token with 18 decimals is 10¹⁸)');
      const n = BigInt(text);
      if (n >= 2n ** 256n) throw new Error('too big for 256 bits');
      return n.toString(16).padStart(64, '0');
    }
    if (kind === 'bool') {
      if (!/^(true|false)$/.test(text)) throw new Error('enter true or false');
      return (text === 'true' ? '1' : '0').padStart(64, '0');
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(text)) throw new Error('bytes32 is 0x + 64 hex characters');
    return text.slice(2).toLowerCase();
  }

  function renderArgs(types) {
    const key = types.join(',');
    if (key === lastTypes) return;
    lastTypes = key;
    argInputs = types.map((type, i) => {
      const id = `abi-arg-${i}`;
      const input = el('input', { type: 'text', id, spellcheck: false, autocomplete: 'off', value: DEFAULTS[kindOf(type)] ?? '' });
      input.addEventListener('input', update);
      return { type, input, row: el('p', {}, el('label', { htmlFor: id, textContent: `Argument ${i + 1} (${type})` }), input) };
    });
    argsHost.replaceChildren(...argInputs.map((a) => a.row));
  }

  function update() {
    const sig = sigInput.value;
    const hash = bytesToHex(keccak256(utf8(sig)));
    const selector = hash.slice(0, 8);
    $('#abi-hash').replaceChildren(el('mark', { className: 'selector', textContent: selector }), hash.slice(8));

    const match = sig.match(/^\s*([A-Za-z_$][\w$]*)\s*\(([^()]*)\)\s*$/);
    const types = match && match[2].trim() ? match[2].split(',').map((t) => t.trim()) : [];
    renderArgs(match ? types : []);

    const segments = [el('span', { className: 'cd-seg is-selector' },
      el('span', { className: 'cd-label', textContent: 'selector · 4 bytes' }), el('span', { className: 'cd-hex', textContent: `0x${selector}` }))];
    const problems = [];
    argInputs.forEach(({ type, input }, i) => {
      let word;
      if (!kindOf(type)) problems.push(`${type} is a dynamic or unsupported type — this demo encodes address, uint, bool and bytes32 only`);
      else {
        try { word = encodeArg(type, input.value); } catch (e) { problems.push(`argument ${i + 1}: ${e.message}`); }
      }
      input.setAttribute('aria-invalid', String(!word && Boolean(kindOf(type))));
      segments.push(el('span', { className: 'cd-seg' },
        el('span', { className: 'cd-label', textContent: `argument ${i + 1}: ${type} · 32 bytes` }),
        el('span', { className: 'cd-hex', textContent: word ?? '?'.repeat(64) })));
    });
    $('#abi-calldata').replaceChildren(...segments);

    const canonical = !/\s/.test(sig) && !/\buint\b|\bint\b/.test(sig);
    const known = KNOWN[selector];
    if (!match) {
      verdict.className = 'verdict bad';
      verdict.textContent = '✗ A signature looks like name(type1,type2) — the selector is still computed, but no arguments can be encoded.';
    } else if (problems.length) {
      verdict.className = 'verdict warn';
      verdict.textContent = `⚠️ ${problems[0]}.`;
    } else if (!canonical) {
      verdict.className = 'verdict warn';
      verdict.textContent = `⚠️ Selector 0x${selector} — not the one you might expect. Signatures must be canonical: no spaces, full type names (uint256, not uint). One character changes the hash completely.`;
    } else {
      verdict.className = 'verdict ok';
      verdict.textContent = known
        ? `✓ Selector 0x${selector}: ${known}. Total calldata: ${4 + 32 * types.length} bytes.`
        : `✓ Selector 0x${selector}. Total calldata: ${4 + 32 * types.length} bytes.`;
    }
  }

  $$('[data-sig]').forEach((btn) => btn.addEventListener('click', () => {
    sigInput.value = btn.dataset.sig;
    update();
  }));
  sigInput.addEventListener('input', update);
  update();
}

/* ============================== Module 7: a tiny EVM ============================== */

/* Real opcode bytes and gas costs (post-Berlin). SSTORE is priced for writing a
   fresh, never-touched slot: 20,000 for the new value + 2,100 for the cold access. */
const OPCODES = {
  0x00: { name: 'STOP', gas: 0, does: 'halt successfully' },
  0x01: { name: 'ADD', gas: 3, does: 'pop two numbers, push their sum' },
  0x03: { name: 'SUB', gas: 3, does: 'pop a (top) and b, push a − b' },
  0x55: { name: 'SSTORE', gas: 22100, does: 'pop key and value; write value to permanent storage' },
  0x56: { name: 'JUMP', gas: 8, does: 'pop a destination and jump there' },
  0x57: { name: 'JUMPI', gas: 10, does: 'pop destination and condition; jump if condition ≠ 0' },
  0x5b: { name: 'JUMPDEST', gas: 1, does: 'mark a valid jump target' },
  0x60: { name: 'PUSH1', gas: 3, immediate: 1, does: 'push the next byte onto the stack' },
  0x80: { name: 'DUP1', gas: 3, does: 'copy the top item' },
  0x90: { name: 'SWAP1', gas: 3, does: 'swap the top two items' },
};

const PROGRAMS = {
  add: { bytes: [0x60, 0x02, 0x60, 0x03, 0x01, 0x60, 0x00, 0x55, 0x00], gas: 30000 },
  loop: { bytes: [0x60, 0x03, 0x5b, 0x60, 0x01, 0x90, 0x03, 0x80, 0x60, 0x02, 0x57, 0x00], gas: 100 },
  forever: { bytes: [0x5b, 0x60, 0x00, 0x56], gas: 100 },
};

export function initEvmDemo() {
  const progSelect = $('#evm-prog');
  const gasInput = $('#evm-gas');
  const verdict = $('#evm-verdict');
  const stepBtn = $('#evm-step');
  const runBtn = $('#evm-run');
  let vm;
  let running = false;

  function disassemble(bytes) {
    const lines = [];
    for (let pc = 0; pc < bytes.length;) {
      const op = OPCODES[bytes[pc]];
      const arg = op.immediate ? bytes[pc + 1] : null;
      lines.push({ pc, op, arg });
      pc += 1 + (op.immediate ?? 0);
    }
    return lines;
  }

  function reset() {
    const prog = PROGRAMS[progSelect.value];
    const limit = Math.max(0, Math.floor(Number(gasInput.value) || 0));
    vm = { prog, lines: disassemble(prog.bytes), pc: 0, stack: [], storage: new Map(), gasLimit: limit, gasLeft: limit, steps: 0, done: false, status: null };
    verdict.className = 'verdict';
    verdict.textContent = '';
    render();
  }

  /* Execute one instruction, EVM-style. Returns false once halted. */
  function step() {
    if (vm.done) return false;
    const line = vm.lines.find((l) => l.pc === vm.pc);
    if (!line) return halt('stop', 'Ran off the end of the code: an implicit STOP.');
    const { op, arg } = line;
    if (vm.gasLeft < op.gas) {
      vm.gasLeft = 0;
      vm.storage = new Map(); // every change is rolled back…
      return halt('oog', `⛽ Out of gas at ${op.name} (needs ${fmt(op.gas)}). Every change this call made is reverted — but all ${fmt(vm.gasLimit)} gas is still paid: validators did the work.`);
    }
    vm.gasLeft -= op.gas;
    vm.steps++;
    const pop = () => vm.stack.shift(); // index 0 is the top of the stack
    const push = (v) => vm.stack.unshift(v);
    let next = vm.pc + 1 + (op.immediate ?? 0);
    switch (op.name) {
      case 'STOP': return halt('stop', null);
      case 'PUSH1': push(arg); break;
      case 'ADD': push(pop() + pop()); break;
      case 'SUB': { const a = pop(); const b = pop(); push(a - b); break; }
      case 'DUP1': push(vm.stack[0]); break;
      case 'SWAP1': [vm.stack[0], vm.stack[1]] = [vm.stack[1], vm.stack[0]]; break;
      case 'SSTORE': { const key = pop(); const value = pop(); vm.storage.set(key, value); break; }
      case 'JUMPDEST': break;
      case 'JUMP': next = pop(); break;
      case 'JUMPI': { const dest = pop(); const cond = pop(); if (cond !== 0) next = dest; break; }
      default: break;
    }
    vm.pc = next;
    vm.lastOp = op;
    render();
    return true;
  }

  function halt(status, message) {
    vm.done = true;
    vm.status = status;
    const used = vm.gasLimit - vm.gasLeft;
    verdict.className = `verdict ${status === 'oog' ? 'bad' : 'ok'}`;
    verdict.textContent = message ?? `✓ STOP after ${vm.steps} instructions, using ${fmt(used)} gas.${vm.storage.size ? ` Storage now holds slot 0 = ${vm.storage.get(0)}, forever.` : ''}`;
    render();
    return false;
  }

  function render() {
    const { prog, lines } = vm;
    const current = vm.done ? null : vm.pc;
    let byteIndex = 0;
    $('#evm-bytes').replaceChildren(...lines.flatMap((l) => {
      const width = 1 + (l.op.immediate ?? 0);
      const spans = prog.bytes.slice(byteIndex, byteIndex + width).map((b) =>
        el('span', { className: l.pc === current ? 'is-current' : '', textContent: b.toString(16).padStart(2, '0') }));
      byteIndex += width;
      return spans;
    }));
    $('#evm-code').replaceChildren(...lines.map((l) => el('li', { className: l.pc === current ? 'is-current' : '', 'aria-current': l.pc === current ? 'step' : null },
      el('code', { className: 'evm-pc', textContent: String(l.pc).padStart(2, '0') }),
      el('code', { className: 'evm-op', textContent: `${l.op.name}${l.arg !== null ? ` 0x${l.arg.toString(16).padStart(2, '0')}` : ''}` }),
      el('span', { className: 'evm-gas', textContent: `${fmt(l.op.gas)} gas` }),
      el('span', { className: 'evm-does', textContent: l.op.does }))));
    $('#evm-stack').replaceChildren(...(vm.stack.length ? vm.stack.map((v) => el('li', { textContent: String(v) })) : [el('li', { className: 'is-empty', textContent: 'empty' })]));
    $('#evm-storage').textContent = vm.storage.size ? [...vm.storage].map(([k, v]) => `slot ${k} = ${v}`).join(', ') : 'nothing stored';
    const pct = vm.gasLimit ? (vm.gasLeft / vm.gasLimit) * 100 : 0;
    $('#evm-gas-fill').style.inlineSize = `${pct}%`;
    $('#evm-gas-fill').classList.toggle('is-low', pct < 15);
    $('#evm-gas-text').textContent = `${fmt(vm.gasLeft)} of ${fmt(vm.gasLimit)} gas left · ${vm.steps} instructions run`;
    stepBtn.disabled = vm.done || running;
    runBtn.disabled = vm.done || running;
  }

  runBtn.addEventListener('click', async () => {
    running = true;
    render();
    const animate = !prefersReducedMotion();
    let count = 0;
    while (step()) {
      count++;
      if (animate && count < 60) await sleep(220);
      else if (count % 200 === 0) await sleep(0);
    }
    running = false;
    render();
  });
  stepBtn.addEventListener('click', step);
  $('#evm-reset').addEventListener('click', reset);
  progSelect.addEventListener('change', () => {
    gasInput.value = String(PROGRAMS[progSelect.value].gas);
    reset();
  });
  gasInput.addEventListener('input', reset);
  gasInput.value = String(PROGRAMS[progSelect.value].gas);
  reset();
}

/* ============================== Module 7: EIP-1559 base fee ============================== */

export function initBaseFeeDemo() {
  const GAS_LIMIT = 30_000_000;
  const TARGET = GAS_LIMIT / 2;
  const START_FEE = 10; // gwei
  const MAX_SHOWN = 40;
  const demand = $('#bf-demand');
  const verdict = $('#bf-verdict');
  let blocks;
  let baseFee;
  let burned;
  let feeChart = null;
  let fillChart = null;

  const syncDemand = () => {
    $('#bf-demand-out').textContent = `${demand.value}% full`;
    demand.setAttribute('aria-valuetext', `${demand.value}% full blocks`);
  };

  function produce(fullness) {
    const gasUsed = GAS_LIMIT * fullness;
    burned += (gasUsed * baseFee) / 1e9;
    blocks.push({ n: (blocks.at(-1)?.n ?? 0) + 1, fee: baseFee, fullness });
    if (blocks.length > MAX_SHOWN) blocks.shift();
    baseFee = nextBaseFee(baseFee, gasUsed, TARGET);
  }

  const noisy = () => Math.min(1, Math.max(0, Number(demand.value) / 100 + (Math.random() - 0.5) * 0.1));

  function render(message) {
    const last = blocks.at(-1);
    const change = baseFee / last.fee - 1;
    $('#bf-fee').textContent = `${baseFee.toFixed(2)} gwei`;
    $('#bf-change').textContent = `${change >= 0 ? '+' : '−'}${Math.abs(change * 100).toFixed(1)}% (block was ${Math.round(last.fullness * 100)}% full)`;
    $('#bf-burned').textContent = `${burned.toFixed(2)} ETH`;
    verdict.className = 'verdict neutral';
    verdict.textContent = message ?? '';

    const xs = blocks.map((b) => b.n);
    const feeConfig = {
      title: 'Base fee charged in each block',
      xs,
      series: [{ label: 'base fee', values: blocks.map((b) => b.fee), color: 'var(--series-1)', type: 'line', markers: blocks.length <= 20 }],
      y: { min: 0, format: (v) => `${v === 0 ? 0 : fmt(v, v < 10 ? 1 : 0)} gwei` },
      x: { label: 'block', format: (v) => `${v}`, tooltipFormat: (v) => `Block ${v}` },
      tooltipFormat: (v) => `${v.toFixed(2)} gwei`,
      height: 160,
    };
    const fillConfig = {
      title: 'How full each block was (target: half)',
      xs,
      series: [{ label: 'gas used', values: blocks.map((b) => b.fullness * 100), color: 'var(--series-2)', type: 'bar' }],
      refs: [{ y: 50, label: 'target' }],
      y: { min: 0, max: 100, ticks: [0, 50, 100], format: (v) => `${Math.round(v)}%` },
      x: { label: 'block', format: (v) => `${v}`, tooltipFormat: (v) => `Block ${v}` },
      height: 140,
    };
    if (feeChart) { feeChart.update(feeConfig); fillChart.update(fillConfig); } else {
      feeChart = createChart($('#bf-fee-chart'), feeConfig);
      fillChart = createChart($('#bf-fill-chart'), fillConfig);
    }
  }

  function reset() {
    blocks = [];
    baseFee = START_FEE;
    burned = 0;
    demand.value = '50';
    syncDemand();
    for (let i = 0; i < 5; i++) produce(noisy());
    render();
  }

  $('#bf-step').addEventListener('click', () => { produce(noisy()); render(); });
  $('#bf-ten').addEventListener('click', () => { for (let i = 0; i < 10; i++) produce(noisy()); render(); });
  $('#bf-frenzy').addEventListener('click', () => {
    const before = baseFee;
    for (let i = 0; i < 10; i++) produce(1);
    render(`🖼️ Ten full blocks: the base fee climbed from ${before.toFixed(2)} to ${baseFee.toFixed(2)} gwei (×${(baseFee / before).toFixed(2)}). Set demand low and produce blocks to watch it fall back.`);
  });
  demand.addEventListener('input', syncDemand);
  $('#bf-reset').addEventListener('click', reset);
  reset();
}

/* ============================== Module 7: reentrancy (The DAO) ============================== */

const VAULT_CODE = {
  vulnerable: [
    ['v0', 'function withdraw() external {'],
    ['v1', '  uint amount = balances[msg.sender];'],
    ['v2', '  require(amount > 0, "nothing to withdraw");'],
    ['v3', '  (bool ok, ) = msg.sender.call{value: amount}("");  // interaction'],
    ['v4', '  require(ok);'],
    ['v5', '  balances[msg.sender] = 0;                          // effect — too late!'],
    ['v6', '}'],
  ],
  fixed: [
    ['v0', 'function withdraw() external {'],
    ['v1', '  uint amount = balances[msg.sender];'],
    ['v2', '  require(amount > 0, "nothing to withdraw");'],
    ['v5', '  balances[msg.sender] = 0;                          // effect first'],
    ['v3', '  (bool ok, ) = msg.sender.call{value: amount}("");  // then interaction'],
    ['v4', '  require(ok);'],
    ['v6', '}'],
  ],
};
const ATTACKER_CODE = [
  ['a0', 'function attack() external { vault.withdraw(); }'],
  ['a1', ''],
  ['a2', 'receive() external payable {          // runs whenever ETH arrives'],
  ['a3', '  if (address(vault).balance >= 1 ether)'],
  ['a4', '    try vault.withdraw() {} catch {}   // re-enter!'],
  ['a5', '}'],
];

/* Precompute the whole attack as a list of snapshots, so Step and Run just replay it. */
function reentrancyTrace(mode) {
  const s = { vault: 10, attacker: 0, record: 1, stack: ['Attacker.attack()'] };
  const steps = [];
  const snap = (lines, text) => steps.push({ ...s, stack: [...s.stack], lines, text });
  let depth = 0;

  snap(['a0'], 'The attacker’s contract calls vault.withdraw().');
  for (;;) {
    depth++;
    s.stack.push(`Vault.withdraw() #${depth}`);
    const amount = s.record;
    snap(['v1', 'v2'], amount > 0
      ? `withdraw #${depth}: the vault looks up the attacker’s balance — ${amount} ETH${depth > 1 ? ', still! Its record hasn’t been updated yet' : ''} — and require(amount > 0) passes.`
      : `withdraw #${depth}: the attacker’s balance is now 0, so require(amount > 0) fails — this nested call reverts (the attacker’s try/catch swallows the error).`);
    if (amount === 0) {
      s.stack.pop();
      break;
    }
    if (mode === 'fixed') {
      s.record = 0;
      snap(['v5'], `withdraw #${depth}: the record is set to 0 before any ETH moves.`);
    }
    s.vault -= amount;
    s.attacker += amount;
    s.stack.push('Attacker.receive()');
    snap(['v3', 'a2'], `withdraw #${depth} sends ${amount} ETH — and sending ETH to a contract runs its receive() function. The vault is paused mid-withdraw.`);
    if (s.vault < 1) {
      snap(['a3'], 'receive(): the vault is empty, so the attacker stops re-entering.');
      s.stack.pop();
      break;
    }
    snap(['a3', 'a4'], `receive(): the vault still holds ${s.vault} ETH, so it calls withdraw() again — before withdraw #${depth} has finished.`);
  }
  // Unwind every paused withdraw: each finishes its remaining lines.
  if (mode === 'vulnerable') {
    s.record = 0;
    s.stack = ['Attacker.attack()'];
    snap(['v4', 'v5'], `The calls unwind: all ${depth} paused withdraws resume and set the record to 0 — ${depth} times over, far too late.`);
  } else {
    s.stack = ['Attacker.attack()'];
    snap(['v4'], 'receive() returns, the first withdraw checks that the transfer succeeded and finishes normally.');
  }
  s.stack = [];
  snap([], mode === 'vulnerable'
    ? '✗ Drained.'
    : '✓ Attack failed.');
  return steps;
}

export function initReentrancyDemo() {
  const vaultPre = $('#re-vault');
  const attackerPre = $('#re-attacker');
  const verdict = $('#re-verdict');
  const stepBtn = $('#re-step');
  const runBtn = $('#re-run');
  let mode = 'vulnerable';
  let trace = [];
  let at = -1;
  let running = false;

  const renderCode = (pre, title, lines, active) => pre.replaceChildren(
    el('span', { className: 'code-title', textContent: title }),
    ...lines.map(([id, text]) => el('span', { className: `code-line${active.includes(id) ? ' is-active' : ''}`, textContent: text || ' ' })));

  function render() {
    const snap = trace[at] ?? { vault: 10, attacker: 0, record: 1, stack: [], lines: [], text: 'Press Step to begin.' };
    renderCode(vaultPre, 'contract Vault', VAULT_CODE[mode], snap.lines);
    renderCode(attackerPre, 'contract Attacker', ATTACKER_CODE, snap.lines);
    $('#re-vault-eth').textContent = `${snap.vault} ETH`;
    $('#re-attacker-eth').textContent = `${snap.attacker} ETH`;
    $('#re-record').textContent = `${snap.record} ETH`;
    $('#re-owed').textContent = `9 ETH${snap.vault < 9 ? ` — vault short by ${9 - snap.vault}` : ''}`;
    // Deep recursion: show the outermost frame and the newest few, collapse the middle.
    const frames = snap.stack.map((frame, depth) => ({ frame, depth }));
    const shown = frames.length > 7 ? [frames[0], null, ...frames.slice(-5)] : frames;
    $('#re-stack').replaceChildren(...(frames.length
      ? shown.map((f) => (f
        ? el('li', { style: `--depth:${Math.min(f.depth, 8)}`, textContent: f.frame })
        : el('li', { className: 'is-gap', textContent: `⋮ ${frames.length - 6} more nested calls` })))
      : [el('li', { className: 'is-empty', textContent: 'empty' })]));
    $('#re-narration').textContent = snap.text;
    const finished = at >= trace.length - 1;
    stepBtn.disabled = finished || running;
    runBtn.disabled = finished || running;
    if (finished) {
      verdict.className = `verdict ${mode === 'vulnerable' ? 'bad' : 'ok'}`;
      verdict.textContent = mode === 'vulnerable'
        ? '✗ Drained: a 1 ETH deposit withdrew all 10 ETH. The vault still owes Alice 4 and Bob 5 — and holds nothing to pay them. Every step was a legal call.'
        : '✓ Safe: the record was zeroed before the ETH left, so the re-entrant call found nothing to withdraw. The attacker got back only their own 1 ETH.';
    } else {
      verdict.className = 'verdict';
      verdict.textContent = '';
    }
  }

  function reset() {
    trace = reentrancyTrace(mode);
    at = -1;
    render();
  }

  stepBtn.addEventListener('click', () => { at = Math.min(trace.length - 1, at + 1); render(); });
  runBtn.addEventListener('click', async () => {
    running = true;
    const animate = !prefersReducedMotion();
    while (at < trace.length - 1) {
      at++;
      render();
      if (animate) await sleep(at < 8 ? 450 : 160); // slow for the first loop, then speed through
    }
    running = false;
    render();
  });
  $$('input[name="re-mode"]').forEach((r) => r.addEventListener('change', () => { mode = r.value; reset(); }));
  $('#re-reset').addEventListener('click', reset);
  reset();
}
