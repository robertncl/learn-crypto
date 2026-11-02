#!/usr/bin/env bun
/* Translation tooling for ChainLab. No dependencies.

   Page text lives in index.html: every translatable element carries data-i18n="<key>",
   where <key> is a short hash of its English source. Translated attributes (aria-label,
   title, placeholder, alt) are listed in data-i18n-attr="name:key,…". Text built by the
   demos lives in js/i18n/en.js, and quiz text in js/data/quizzes.js.

     bun tools/i18n.mjs keys              (re)compute keys after editing index.html
                                          — add a bare data-i18n to a new element first
     bun tools/i18n.mjs check             every language is complete and well-formed
     bun tools/i18n.mjs missing <lang>    list what <lang> still needs
     bun tools/i18n.mjs export <lang> <dir>   write numbered chunks of missing English
     bun tools/i18n.mjs import <lang> <dir>   merge translated chunks (<lang>-NNN.tsv, one "N. text" line each)
                                          back into js/i18n/<lang>.js */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('../', import.meta.url).pathname;
const HTML = `${ROOT}index.html`;
export const LANGS = ['zh', 'fr', 'es', 'de', 'ja'];

const hash = (prefix, text) => prefix + createHash('sha1').update(text).digest('hex').slice(0, 8);
const normalize = (s) => s.replace(/\s+/g, ' ').trim();
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/* ---- index.html ---- */

const SEGMENT = /<(\w+)\b((?:[^>"']|"[^"]*"|'[^']*')*?)\sdata-i18n="([^"]*)"((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/\1>/g;
const ATTR_LIST = /\sdata-i18n-attr="([^"]*)"/g;

/* Rewrites index.html with fresh keys. Returns { html, strings } where strings is key → English. */
export function computeKeys(html) {
  const strings = {};
  const claim = (key, text) => {
    if (strings[key] !== undefined && strings[key] !== text) throw new Error(`key collision on ${key}`);
    strings[key] = text;
  };
  let out = html.replace(SEGMENT, (all, tag, before, _old, after, inner) => {
    const text = normalize(inner);
    const key = hash('h', text);
    claim(key, text);
    return `<${tag}${before} data-i18n="${key}"${after}>${inner}</${tag}>`;
  });
  // attributes: re-derive each "name:key" from the element's current attribute value
  out = out.replace(/<(\w+)\b((?:[^>"']|"[^"]*"|'[^']*')*?)>/g, (tagText, tag, attrs) => {
    const list = attrs.match(/\sdata-i18n-attr="([^"]*)"/);
    if (!list) return tagText;
    const names = list[1].split(',').map((n) => n.split(':')[0]).filter(Boolean);
    const parts = names.map((name) => {
      const m = attrs.match(new RegExp(`\\s${name}="([^"]*)"`));
      if (!m) throw new Error(`<${tag}> lists ${name} but has no such attribute`);
      const value = decode(m[1]);
      const key = hash('a', value);
      claim(key, value);
      return `${name}:${key}`;
    });
    return tagText.replace(ATTR_LIST, ` data-i18n-attr="${parts.join(',')}"`);
  });
  return { html: out, strings };
}

export const htmlStrings = () => computeKeys(readFileSync(HTML, 'utf8')).strings;

/* ---- catalogs ---- */

const catalogPath = (lang) => `${ROOT}js/i18n/${lang}.js`;

export async function loadCatalog(lang) {
  if (!existsSync(catalogPath(lang))) return {};
  return (await import(`${pathToFileURL(catalogPath(lang)).href}?t=${Date.now()}`)).default;
}

export function writeCatalog(lang, entries) {
  const keys = Object.keys(entries).sort();
  const body = keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(entries[k], null, 2).replace(/\n/g, '\n  ')},`).join('\n');
  writeFileSync(catalogPath(lang), `/* ${lang} translation. Keys: hXXXXXXXX / aXXXXXXXX = index.html text and attributes,\n   everything else = see js/i18n/en.js and js/data/quizzes.js. Edit with tools/i18n.mjs. */\n\nexport default {\n${body}\n};\n`);
}

/* The complete English source: page text + demo strings + quiz text. */
export async function englishSource() {
  const en = (await import(`${pathToFileURL(`${ROOT}js/i18n/en.js`).href}?t=${Date.now()}`)).default;
  const { QUIZZES } = await import(`${pathToFileURL(`${ROOT}js/data/quizzes.js`).href}?t=${Date.now()}`);
  const all = { ...htmlStrings(), ...en };
  for (const [id, questions] of Object.entries(QUIZZES)) {
    questions.forEach((q, i) => {
      all[`quiz.${id}.${i}.q`] = q.q;
      q.options.forEach((o, j) => { all[`quiz.${id}.${i}.o${j}`] = o; });
      all[`quiz.${id}.${i}.why`] = q.why;
    });
  }
  return all;
}

const tagsOf = (s) => (String(s).match(/<\/?[a-z]+[^>]*>/gi) ?? []).map((t) => t.toLowerCase().replace(/\s+/g, ' ')).sort().join('');
const placeholdersOf = (s) => (String(s).match(/\{\w+\}/g) ?? []).sort().join(',');
const flat = (v) => (typeof v === 'object' ? Object.entries(v).map(([k, x]) => `${k}:${x}`).join('|') : v);

/* Returns { missing: [keys], problems: [strings], stale: [keys] } for one language. */
export async function audit(lang, source) {
  const cat = await loadCatalog(lang);
  const missing = Object.keys(source).filter((k) => cat[k] === undefined);
  const stale = Object.keys(cat).filter((k) => source[k] === undefined);
  const problems = [];
  for (const [k, tr] of Object.entries(cat)) {
    const en = source[k];
    if (en === undefined) continue;
    if (typeof en === 'object' !== (typeof tr === 'object')) { problems.push(`${k}: plural/non-plural shape differs`); continue; }
    const forms = typeof en === 'object' ? Object.keys(tr) : [null];
    for (const f of forms) {
      const a = typeof en === 'object' ? en.other ?? Object.values(en)[0] : en;
      const b = typeof tr === 'object' ? tr[f] : tr;
      if (typeof b !== 'string' || !b.trim()) { problems.push(`${k}: empty translation`); continue; }
      if (placeholdersOf(a) !== placeholdersOf(b)) problems.push(`${k}: placeholders differ — en ${placeholdersOf(a) || '∅'} vs ${placeholdersOf(b) || '∅'}`);
      if (k[0] === 'h' && tagsOf(a) !== tagsOf(b)) problems.push(`${k}: inline tags differ`);
      if (/<(script|style|iframe|img|svg|object|embed)/i.test(b) || /\son\w+=/i.test(b)) problems.push(`${k}: forbidden markup`);
    }
  }
  return { missing, stale, problems };
}

/* ---- CLI ---- */

if (import.meta.main) {
  const [cmd, lang, dir] = process.argv.slice(2);
  // The language names a file to read and write; only accept the known ones.
  if (['missing', 'export', 'import'].includes(cmd) && !LANGS.includes(lang)) {
    console.error(`Unknown language "${lang}". Expected one of: ${LANGS.join(', ')}`);
    process.exit(1);
  }
  if (cmd === 'keys') {
    const { html, strings } = computeKeys(readFileSync(HTML, 'utf8'));
    writeFileSync(HTML, html);
    console.log(`${Object.keys(strings).length} translatable strings keyed in index.html`);
  } else if (cmd === 'check' || cmd === 'missing') {
    const source = await englishSource();
    let bad = false;
    for (const l of cmd === 'missing' ? [lang] : LANGS) {
      const { missing, stale, problems } = await audit(l, source);
      console.log(`${l}: ${Object.keys(source).length - missing.length}/${Object.keys(source).length} translated, ${stale.length} stale, ${problems.length} problems`);
      problems.slice(0, 10).forEach((p) => console.log('   ', p));
      if (cmd === 'missing') missing.slice(0, 20).forEach((k) => console.log('   missing', k, JSON.stringify(source[k]).slice(0, 70)));
      if (missing.length || problems.length) bad = true;
    }
    if (cmd === 'check' && bad) process.exitCode = 1;
  } else if (cmd === 'export') {
    const source = await englishSource();
    const { missing } = await audit(lang, source);
    mkdirSync(dir, { recursive: true });
    const CHUNK = 60;
    for (let i = 0; i * CHUNK < missing.length; i++) {
      const slice = missing.slice(i * CHUNK, (i + 1) * CHUNK);
      // Page text is self-explanatory; for demo/quiz strings the key (a hint of where it is used) follows the text.
      const lines = slice.map((k, j) => `${j + 1}\t${typeof source[k] === 'object' ? JSON.stringify(source[k]) : source[k]}${k[0] === 'h' || k[0] === 'a' ? '' : `\t⟨${k}⟩`}`);
      writeFileSync(`${dir}/en-${String(i).padStart(3, '0')}.tsv`, lines.join('\n') + '\n');
      writeFileSync(`${dir}/keys-${String(i).padStart(3, '0')}.json`, JSON.stringify(slice));
    }
    console.log(`${missing.length} strings in ${Math.ceil(missing.length / CHUNK)} chunks → ${dir}`);
  } else if (cmd === 'import') {
    const source = await englishSource();
    const cat = { ...(await loadCatalog(lang)) };
    let n = 0;
    for (const f of readdirSync(dir).filter((x) => /^keys-\d+\.json$/.test(x)).sort()) {
      const id = f.match(/\d+/)[0];
      const tsv = `${dir}/${lang}-${id}.tsv`;
      if (!existsSync(tsv)) continue;
      const keys = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
      for (const line of readFileSync(tsv, 'utf8').split('\n')) {
        const m = line.match(/^(\d+)(?:\t|\. )([\s\S]*)$/);
        if (!m) continue;
        const key = keys[Number(m[1]) - 1];
        if (!key) { console.log(`bad index ${m[1]} in ${tsv}`); continue; }
        cat[key] = typeof source[key] === 'object' ? JSON.parse(m[2]) : m[2];
        n++;
      }
    }
    writeCatalog(lang, cat);
    console.log(`imported ${n} strings into js/i18n/${lang}.js`);
  } else {
    console.log('usage: bun tools/i18n.mjs keys | check | missing <lang> | export <lang> <dir> | import <lang> <dir>');
  }
}
