import { $, $$ } from './dom.js';
import { recordQuizResult } from './progress.js';
import { QUIZZES } from '../data/quizzes.js';

/* ============================== Quizzes ============================== */

const PASS_RATIO = 0.7;

export function initQuizzes() {
  const dialog = $('#quiz-dialog');
  const nextLink = $('#quiz-dialog-next');
  nextLink.addEventListener('click', () => dialog.close());

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
      recordQuizResult(quizId, correct, total, passed);

      const next = $('.pager-next', form.closest('.view'));
      $('#quiz-dialog-title').textContent = passed ? '🎉 Module complete!' : '🤔 Not quite yet';
      $('#quiz-dialog-text').textContent = passed
        ? `You scored ${correct} / ${total}. This module is marked as complete — on to the next one!`
        : `You scored ${correct} / ${total}. Review the highlighted answers and explanations, then try again.`;
      nextLink.hidden = !(passed && next);
      $('.dialog-actions button', dialog).classList.toggle('primary', nextLink.hidden);
      if (next) {
        nextLink.href = next.getAttribute('href');
        nextLink.textContent = `Next: ${$('.pager-title', next).textContent} →`;
      }
      dialog.showModal();
    });
  });
}
