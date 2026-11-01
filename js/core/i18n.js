import en from '../i18n/en.js';
import { readString, writeString } from './storage.js';

/* ============================== Internationalisation ==============================

   Page text in index.html carries data-i18n="<key>" (and data-i18n-attr for attributes);
   text built by the demos calls t("<key>", { vars }). Both resolve against one catalog per
   language, falling back to English. Changing language reloads the page, so nothing has
   to re-render live. See tools/i18n.mjs for the workflow. */

export const LANGUAGES = { en: 'English', zh: '中文', fr: 'Français', es: 'Español', de: 'Deutsch', ja: '日本語' };

/* Static paths so the bundler (or a plain static server) can find each catalog. */
const LOADERS = {
  zh: () => import('../i18n/zh.js'),
  fr: () => import('../i18n/fr.js'),
  es: () => import('../i18n/es.js'),
  de: () => import('../i18n/de.js'),
  ja: () => import('../i18n/ja.js'),
};

const STORAGE_KEY = 'chainlab-lang';

export let lang = 'en';
let catalog = {};
let plurals = new Intl.PluralRules('en');

/* ?lang=xx wins (and is remembered), then the saved choice, then the browser's languages.
   The inline script in index.html's <head> repeats this to avoid a flash of English. */
export function pickLanguage() {
  const wanted = new URLSearchParams(location.search).get('lang');
  if (wanted && Object.hasOwn(LANGUAGES, wanted)) {
    writeString(STORAGE_KEY, wanted);
    return wanted;
  }
  const saved = readString(STORAGE_KEY);
  if (saved && Object.hasOwn(LANGUAGES, saved)) return saved;
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = String(tag).toLowerCase().split('-')[0];
    if (Object.hasOwn(LANGUAGES, base)) return base;
  }
  return 'en';
}

export function setLanguage(next) {
  writeString(STORAGE_KEY, next);
  const url = new URL(location.href);
  url.searchParams.delete('lang');
  history.replaceState(null, '', url);
  location.reload();
}

/* ---- translated markup, rebuilt from an allowlist ---- */

const INLINE_TAGS = new Set(['A', 'EM', 'STRONG', 'B', 'I', 'CODE', 'VAR', 'SUP', 'SUB', 'BR', 'KBD', 'ABBR', 'MARK', 'SMALL', 'WBR']);
const SAFE_HREF = /^(#\/|https:\/\/)/;

/* Copies only text and the allowed inline tags — no attributes except a safe href on links —
   so a catalog can never inject scripts, handlers or styles whatever it contains. */
function appendSafe(parent, node) {
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      parent.append(document.createTextNode(child.data));
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      if (INLINE_TAGS.has(child.tagName)) {
        const copy = document.createElement(child.tagName);
        const href = child.getAttribute('href');
        if (child.tagName === 'A' && href && SAFE_HREF.test(href)) copy.setAttribute('href', href);
        appendSafe(copy, child);
        parent.append(copy);
      } else {
        appendSafe(parent, child); // unknown tag: keep its text, drop the element
      }
    }
  }
}

export function setMarkup(el, html) {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${html}`, 'text/html').body;
  const fragment = document.createDocumentFragment();
  appendSafe(fragment, parsed);
  el.replaceChildren(fragment);
}

export function translateDom(root = document) {
  if (lang === 'en') return;
  for (const el of root.querySelectorAll('[data-i18n]')) {
    const text = catalog[el.dataset.i18n];
    if (text !== undefined) setMarkup(el, text);
  }
  for (const el of root.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of el.dataset.i18nAttr.split(',')) {
      const [name, key] = pair.split(':');
      if (catalog[key] !== undefined) el.setAttribute(name, catalog[key]);
    }
  }
}

/* ---- t(): strings built by the demos ---- */

function resolve(key, n) {
  let text = catalog[key] ?? en[key];
  if (text === undefined) {
    console.warn(`[i18n] missing string: ${key}`);
    return key;
  }
  if (typeof text === 'object') text = text[plurals.select(n ?? 0)] ?? text.other;
  return text;
}

/* t('key', { n: 3, name: 'x' }) — {name} placeholders; an entry may also be
   { one, other, … } and is then chosen by the plural rules of vars.n. */
export function t(key, vars) {
  const text = resolve(key, vars?.n);
  return vars ? text.replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole)) : text;
}

/* Like t(), but placeholders may be DOM nodes (a <code>, a <strong>…): returns an array of
   strings and nodes to spread into el(). The translation decides where each node goes. */
export function tNodes(key, vars) {
  return resolve(key, vars?.n).split(/(\{\w+\})/).filter(Boolean).map((part) => {
    const name = part.match(/^\{(\w+)\}$/)?.[1];
    return name && name in vars ? vars[name] : part;
  });
}

/* Quiz text: translated entries live in the catalog under quiz.<module>.<index>.… */
export function quizText(id, index, question) {
  const prefix = `quiz.${id}.${index}`;
  return {
    q: catalog[`${prefix}.q`] ?? question.q,
    options: question.options.map((option, j) => catalog[`${prefix}.o${j}`] ?? option),
    why: catalog[`${prefix}.why`] ?? question.why,
  };
}

export async function initI18n() {
  lang = pickLanguage();
  document.documentElement.lang = lang;
  plurals = new Intl.PluralRules(lang);
  try {
    if (lang !== 'en') catalog = (await LOADERS[lang]()).default;
    translateDom();
  } catch (error) {
    console.error('[i18n] could not load the language file; showing English.', error);
    lang = 'en';
    document.documentElement.lang = 'en';
  } finally {
    document.documentElement.removeAttribute('data-i18n-pending');
  }

  const select = document.querySelector('#lang-select');
  if (select) {
    select.value = lang;
    select.addEventListener('change', () => setLanguage(select.value));
  }
}
