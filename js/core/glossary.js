import { $, $$ } from './dom.js';
import { lang, t } from './i18n.js';

/* ============================== Glossary filter ============================== */

export function initGlossary() {
  const input = $('#glossary-filter');
  const count = $('#glossary-count');
  const list = $('.glossary');
  // Terms were written in English order; list them alphabetically in the page language.
  const collator = new Intl.Collator(lang, { numeric: true, sensitivity: 'base' });
  const entries = $$('.glossary details').sort((a, b) => collator.compare($('summary', a).textContent.trim(), $('summary', b).textContent.trim()));
  list.append(...entries);
  let announceId = 0;

  const update = () => {
    const query = input.value.trim().toLowerCase();
    let shown = 0;
    for (const entry of entries) {
      const match = !query || entry.textContent.toLowerCase().includes(query);
      entry.hidden = !match;
      if (match) shown++;
    }
    // A single hit is almost certainly what the reader wants — open it.
    if (query && shown === 1) entries.find((e) => !e.hidden).open = true;

    // Debounced so screen readers hear the result, not every keystroke.
    clearTimeout(announceId);
    announceId = setTimeout(() => {
      count.textContent = !query ? ''
        : shown ? t('glossary.some', { shown, total: entries.length, query: input.value.trim() })
          : t('glossary.none', { query: input.value.trim() });
    }, 350);
  };

  input.addEventListener('input', update);
  update();
}
