import { $, $$, el } from './dom.js';

/* ============================== Router ============================== */

/* The sidebar is the single source of truth for the course order. */
const NAV_LINKS = () => $$('#site-nav a[data-route]');
const ROUTES = NAV_LINKS().map((a) => a.dataset.route);
const SITE_TITLE = document.title;

function linkTitle(a) {
  const num = $('.num', a)?.textContent;
  const clone = a.cloneNode(true);
  $$('.num, .done-mark', clone).forEach((n) => n.remove());
  const text = clone.textContent.trim();
  return num ? `${num} · ${text}` : text;
}

function currentRoute() {
  const id = location.hash.replace(/^#\/?/, '');
  return ROUTES.includes(id) ? id : 'home';
}

function renderRoute({ moveFocus = false } = {}) {
  const id = currentRoute();
  $$('.view').forEach((view) => { view.hidden = view.id !== id; });
  $$('#site-nav a').forEach((a) => {
    if (a.dataset.route === id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const heading = $(`#${id} h1`);
  document.title = id === 'home' ? SITE_TITLE : `${heading.textContent} · ChainLab`;
  window.scrollTo(0, 0);
  // Like a page load, put screen-reader and keyboard focus at the top of the new view.
  if (moveFocus) heading.focus({ preventScroll: true });
}

/* "← Previous / Next →" links at the bottom of every module. */
function buildPagers() {
  const links = NAV_LINKS();
  links.forEach((a, i) => {
    const view = $(`#${a.dataset.route}`);
    if (!view || !$('.kicker', view) || a.dataset.route === 'glossary') return;
    const prev = links[i - 1];
    const next = links[i + 1];
    const item = (link, dir) => link && el('a', { className: `pager-${dir}`, href: link.getAttribute('href') },
      el('span', { className: 'pager-dir', textContent: dir === 'prev' ? '← Previous' : 'Next →' }),
      el('span', { className: 'pager-title', textContent: linkTitle(link) }));
    view.append(el('nav', { className: 'pager', 'aria-label': 'Previous and next module' },
      item(prev, 'prev'), item(next, 'next')));
  });
}

export function initRouter() {
  $$('.view h1').forEach((h) => { h.tabIndex = -1; });
  buildPagers();
  addEventListener('hashchange', () => {
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const go = () => renderRoute({ moveFocus: true });
    if (document.startViewTransition && !reduceMotion) {
      document.startViewTransition(go);
    } else {
      go();
    }
  });
  renderRoute();
}
