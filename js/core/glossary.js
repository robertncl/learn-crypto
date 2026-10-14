import { $, $$ } from './dom.js';

/* ============================== Glossary filter ============================== */

export function initGlossary() {
  const input = $('#glossary-filter');
  const count = $('#glossary-count');
  const entries = $$('.glossary details');
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
        : shown ? `${shown} of ${entries.length} terms match “${input.value.trim()}”.`
          : `No terms match “${input.value.trim()}”.`;
    }, 350);
  };

  input.addEventListener('input', update);
  update();
}
