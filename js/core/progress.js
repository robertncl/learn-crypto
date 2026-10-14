import { $, $$ } from './dom.js';
import { readJSON, writeJSON } from './storage.js';

/* ============================== Progress ============================== */

const PROGRESS_KEY = 'chainlab-progress';
/* Every module with a quiz counts toward course progress. */
const QUIZ_IDS = $$('form[data-quiz]').map((form) => form.dataset.quiz);

export const progress = readJSON(PROGRESS_KEY, {});

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
  $('#progress-label').textContent = `${done} / ${QUIZ_IDS.length} modules`;

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
    if (passed) status.textContent = result.total ? `Completed ✓ · best ${result.score} / ${result.total}` : 'Completed ✓';
  });
}
