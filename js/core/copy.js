import { $$ } from './dom.js';
import { t } from './i18n.js';

/* ============================== Copy-to-clipboard buttons ============================== */

const icon = (name) => {
  const span = document.createElement('span');
  span.className = `icon icon-${name}`;
  span.setAttribute('aria-hidden', 'true');
  return span;
};

export function initCopyButtons() {
  if (!navigator.clipboard) return;

  $$('.hash-box.copyable').forEach((box) => {
    const wrap = document.createElement('div');
    wrap.className = 'copy-wrap';
    box.replaceWith(wrap); // box keeps its id, so demo code that updates it still works

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
    btn.title = t('copy.label');
    btn.setAttribute('aria-label', t('copy.label'));
    btn.replaceChildren(icon('copy'));
    wrap.append(box, btn);

    let resetId = 0;
    btn.addEventListener('click', async () => {
      const text = box.textContent.trim();
      if (!text || text === '–') return;
      try {
        await navigator.clipboard.writeText(text);
        btn.replaceChildren(icon('check'));
        btn.classList.add('copied');
        clearTimeout(resetId);
        resetId = setTimeout(() => {
          btn.replaceChildren(icon('copy'));
          btn.classList.remove('copied');
        }, 1200);
      } catch {
        /* clipboard unavailable (e.g. insecure context) — silently ignore */
      }
    });
  });
}
