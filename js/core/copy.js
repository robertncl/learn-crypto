import { $$ } from './dom.js';

/* ============================== Copy-to-clipboard buttons ============================== */

export function initCopyButtons() {
  if (!navigator.clipboard) return;

  $$('.hash-box.copyable').forEach((box) => {
    const wrap = document.createElement('div');
    wrap.className = 'copy-wrap';
    box.replaceWith(wrap); // box keeps its id, so demo code that updates it still works

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
    btn.title = 'Copy to clipboard';
    btn.setAttribute('aria-label', 'Copy to clipboard');
    btn.textContent = '⧉';
    wrap.append(box, btn);

    let resetId = 0;
    btn.addEventListener('click', async () => {
      const text = box.textContent.trim();
      if (!text || text === '–') return;
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = '✓';
        btn.classList.add('copied');
        clearTimeout(resetId);
        resetId = setTimeout(() => {
          btn.textContent = '⧉';
          btn.classList.remove('copied');
        }, 1200);
      } catch {
        /* clipboard unavailable (e.g. insecure context) — silently ignore */
      }
    });
  });
}
