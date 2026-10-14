/* ChainLab — interactive blockchain & cryptocurrency course (entry point) */

import { $, SUBTLE_OK } from './core/dom.js';
import { initRouter } from './core/router.js';
import { initTheme } from './core/theme.js';
import { initQuizzes } from './core/quiz.js';
import { updateProgressUI } from './core/progress.js';
import { initCopyButtons } from './core/copy.js';
import { initGlossary } from './core/glossary.js';
import { initNetworkDemo, initNeedBlockchainDemo } from './demos/basics.js';
import { initHashPlayground, initAvalanche, initMerkleDemo, initHuntDemo, initCommitDemo } from './demos/hashing.js';
import { initChainDemo, initHeaderDemo } from './demos/blocks.js';
import { initMiningSim, initHalvingDemo, initSoloOdds, initRetargetDemo } from './demos/mining.js';
import { initKeysDemo, initCurveDemo, initAddressDemo, initSeedDemo, initNonceDemo } from './demos/keys.js';
import { initStakeDemo, initFeeMarketDemo, initUtxoDemo, initRaceDemo } from './demos/consensus.js';
import { initContractDemo, initGasDemo, initSelectorDemo, initEvmDemo, initBaseFeeDemo, initReentrancyDemo } from './demos/ethereum.js';
import { initNftDemo, initLinkRotDemo, initMarketplaceDemo } from './demos/nft.js';
import { initAmmDemo, initSandwichDemo, initImpermanentLossDemo, initLendingDemo } from './demos/defi.js';
import { initCaveDemo, initColoringDemo } from './demos/zk.js';

/* ============================== Boot ============================== */

// Site chrome
initRouter();
initTheme();
initQuizzes();
updateProgressUI();
initCopyButtons();
initGlossary();

// Demos in course order. These run on the pure-JS crypto in js/lib and work anywhere…
// 1 · Blockchain basics
initNetworkDemo();
initNeedBlockchainDemo();
// 2 · Hashing
initHuntDemo();
initCommitDemo();
// 3 · Blocks
initHeaderDemo();
// 4 · Mining
initMiningSim();
initSoloOdds();
initRetargetDemo();
initHalvingDemo();
// 5 · Keys
initCurveDemo();
initAddressDemo();
initNonceDemo();
// 6 · Consensus
initUtxoDemo();
initFeeMarketDemo();
initRaceDemo();
initStakeDemo();
// 7 · Ethereum
initContractDemo();
initSelectorDemo();
initEvmDemo();
initBaseFeeDemo();
initGasDemo();
initReentrancyDemo();
// 8 · NFTs
initLinkRotDemo();
initNftDemo();
initMarketplaceDemo();
// 9 · DeFi
initAmmDemo();
initSandwichDemo();
initImpermanentLossDemo();
initLendingDemo();
// 10 · Zero-knowledge proofs
initCaveDemo();
initColoringDemo();

// …while these use the browser's Web Crypto API, which needs a secure context (https or localhost).
if (SUBTLE_OK) {
  initHashPlayground();
  initAvalanche();
  initMerkleDemo();
  initChainDemo();
  initKeysDemo();
  initSeedDemo(); // PBKDF2 + HMAC-SHA512
} else {
  $('#crypto-warning').hidden = false;
}
