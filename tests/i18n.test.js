/* Tests for the translations — run with `bun test`.
   Catalog completeness and parity live in tools/i18n.mjs (the same audit `bun tools/i18n.mjs check`
   prints); these tests run it for every language and add the checks that need to read the code. */

import { describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';

import { LANGS, audit, computeKeys, englishSource, loadCatalog } from '../tools/i18n.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = await englishSource();

describe('index.html keys', () => {
  test('every translatable element carries an up-to-date data-i18n key', () => {
    const html = read('index.html');
    // computeKeys re-derives each key from the English text; if it changes anything, someone edited
    // the page without running `bun tools/i18n.mjs keys`.
    expect(computeKeys(html).html === html).toBe(true);
  });
});

describe.each(LANGS)('%s catalog', (lang) => {
  test('covers every string, with nothing stale', async () => {
    const { missing, stale } = await audit(lang, source);
    expect(missing).toEqual([]);
    expect(stale).toEqual([]);
  });

  test('keeps placeholders and inline tags, and has no forbidden markup', async () => {
    const { problems } = await audit(lang, source);
    expect(problems).toEqual([]);
  });

  test('plural entries have every form the language needs', async () => {
    const catalog = await loadCatalog(lang);
    const needsOne = new Intl.PluralRules(lang).resolvedOptions().pluralCategories.includes('one');
    for (const [key, value] of Object.entries(catalog)) {
      if (typeof value !== 'object') continue;
      expect(value.other, key).toBeString();
      if (needsOne && typeof source[key] === 'object' && source[key].one) expect(value.one, key).toBeString();
    }
  });

  test('links in translated markup are anchors or https only', async () => {
    const catalog = await loadCatalog(lang);
    for (const [key, value] of Object.entries(catalog)) {
      for (const [, href] of String(typeof value === 'object' ? Object.values(value).join(' ') : value).matchAll(/href="([^"]*)"/g)) {
        expect(/^(#\/|https:\/\/)/.test(href), `${key}: ${href}`).toBe(true);
      }
    }
  });
});

describe('code ↔ catalog', () => {
  const files = [
    ...readdirSync(new URL('../js/core/', import.meta.url)).map((f) => `js/core/${f}`),
    ...readdirSync(new URL('../js/demos/', import.meta.url)).map((f) => `js/demos/${f}`),
    'js/app.js',
  ].filter((f) => f.endsWith('.js') && f !== 'js/core/i18n.js'); // i18n.js only mentions t('key') in comments

  test('every literal t("key") call names a key that exists in English', () => {
    const unknown = [];
    for (const file of files) {
      for (const [, key] of read(file).matchAll(/\b(?:t|tr|tNodes)\(\s*'([a-zA-Z][\w.]*)'/g)) {
        if (!(key in source)) unknown.push(`${file}: ${key}`);
      }
    }
    expect(unknown).toEqual([]);
  });
});

describe('language picker', () => {
  test('offers exactly the languages the loader knows', async () => {
    const { LANGUAGES } = await import('../js/core/i18n.js').catch(() => ({ LANGUAGES: null }));
    const select = read('index.html').match(/<select id="lang-select"[\s\S]*?<\/select>/)[0];
    const options = [...select.matchAll(/<option value="(\w+)"/g)].map((m) => m[1]);
    const expected = ['en', ...LANGS];
    expect(options.sort()).toEqual([...expected].sort());
    if (LANGUAGES) expect(Object.keys(LANGUAGES).sort()).toEqual([...expected].sort());
  });
});
