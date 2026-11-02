import { $, $$ } from './dom.js';
import { readJSON, writeJSON } from './storage.js';
import { t } from './i18n.js';

/* ============================== Progress ============================== */

const PROGRESS_KEY = 'chainlab-progress';
/* Every module with a quiz counts toward course progress. */
const QUIZ_IDS = $$('form[data-quiz]').map((form) => form.dataset.quiz);

/* Stored data is untrusted (edited by hand, or left by an older version): keep only
   well-formed entries for known quizzes, in an object with no prototype. */
function loadProgress() {
  const stored = readJSON(PROGRESS_KEY, {});
  const clean = Object.create(null);
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    for (const id of QUIZ_IDS) {
      const entry = stored[id];
      if (entry && typeof entry === 'object' && Number.isFinite(entry.score) && Number.isFinite(entry.total)) {
        clean[id] = { passed: entry.passed === true, score: entry.score, total: entry.total };
      }
    }
  }
  return clean;
}

export const progress = loadProgress();

export function saveProgress() {
  writeJSON(PROGRESS_KEY, progress);
}

/* Keep the best attempt; a module stays complete once passed. */
export function recordQuizResult(quizId, correct, total, passed) {
  const prev = progress[quizId] ?? {};
  progress[quizId] = {
    passed: Boolean(prev.passed || passed),
    score: Math.max(prev.score ?? 0, correct),
    total,
  };
  saveProgress();
  updateProgressUI();
}

export function updateProgressUI() {
  const done = QUIZ_IDS.filter((id) => progress[id]?.passed).length;
  $('#course-progress').max = QUIZ_IDS.length;
  $('#course-progress').value = done;
  $('#progress-label').textContent = t('progress.label', { done, total: QUIZ_IDS.length });

  $$('#site-nav a').forEach((a) => {
    const mark = $('.done-mark', a);
    if (mark) mark.hidden = !progress[a.dataset.route]?.passed;
  });

  $$('.module-card').forEach((card) => {
    const result = progress[card.dataset.module];
    const passed = Boolean(result?.passed);
    card.classList.toggle('is-done', passed);
    const status = $('.card-status', card);
    status.hidden = !passed;
    if (passed) status.textContent = result.total ? t('progress.completedBest', { score: result.score, total: result.total }) : t('progress.completed');
  });
}
