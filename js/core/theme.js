import { $, el } from './dom.js';
import { readString, writeString } from './storage.js';

/* ============================== Theme ============================== */

/* Two states: follow the system, or pin the opposite of it. The <meta name="color-scheme">
   carries the choice (CSS maps it onto `color-scheme`), and an inline script in <head>
   applies a saved choice before first paint. */

const THEME_KEY = 'chainlab-theme';
const systemDark = matchMedia('(prefers-color-scheme: dark)');

export function initTheme() {
  const btn = $('#theme-toggle');
  const meta = $('meta[name="color-scheme"]');

  const stored = () => {
    const value = readString(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  };
  const system = () => (systemDark.matches ? 'dark' : 'light');
  const rendered = () => stored() ?? system();

  const apply = () => {
    meta.content = stored() ?? 'light dark';
    const next = rendered() === 'dark' ? 'light' : 'dark';
    btn.replaceChildren(
      el('span', { 'aria-hidden': 'true', textContent: next === 'dark' ? '🌙' : '☀️' }),
      el('span', { className: 'theme-word', textContent: next === 'dark' ? ' Dark' : ' Light' }),
    );
    btn.setAttribute('aria-label', `Switch to ${next} theme`);
  };

  btn.addEventListener('click', () => {
    const target = rendered() === 'dark' ? 'light' : 'dark';
    // Choosing what the system already shows means "follow the system again".
    writeString(THEME_KEY, target === system() ? null : target);
    apply();
  });
  systemDark.addEventListener('change', apply);
  addEventListener('storage', (e) => { if (e.key === THEME_KEY) apply(); });
  apply();
}
