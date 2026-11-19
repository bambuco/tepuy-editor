/**
 * @file Package languages. Register a catalog here to make it available.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { strings as es } from './es.js';
import { strings as en } from './en.js';

/**
 * Catalogs shipped with the package engine.
 * Add a language by importing its map and registering it here.
 * @type {Object<string, Object<string, string>>}
 */
export const PACKAGE_LANGUAGES = {
  es,
  en,
};

/** @type {string} Language used when a package does not name one. */
export const DEFAULT_LANGUAGE = 'es';

/**
 * @returns {string[]} Registered language codes, in registry order.
 */
export function languageCodes() {
  return Object.keys(PACKAGE_LANGUAGES);
}

/**
 * @param {string} lang Language code.
 * @returns {Object<string, string>|null} Copy of the catalog, or null when the code is not registered.
 */
export function baseStrings(lang) {
  const table = PACKAGE_LANGUAGES[lang];
  return table ? { ...table } : null;
}

/**
 * @param {string} value Text placed inside a single-quoted JavaScript string.
 * @returns {string} Escaped text.
 */
function escapeJs(value) {
  return String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('\r', '\\r')
    .replaceAll('\n', '\\n');
}

/**
 * @param {Object<string, string>} entries String map.
 * @returns {string[]} Sorted assignment lines.
 */
function entryLines(entries) {
  return Object.keys(entries).sort().map((key) => `    '${escapeJs(key)}': '${escapeJs(entries[key])}',`);
}

/**
 * @param {Object<string, string>} base Catalog to compare against.
 * @param {Object<string, string>} values Candidate texts, keyed like the catalog.
 * @returns {Object<string, string>} Keys whose text differs from the base.
 */
export function diffOverrides(base, values) {
  const catalog = base || {};
  /** @type {Object<string, string>} */
  const overrides = {};
  for (const key of Object.keys(values || {}).sort()) {
    const value = String(values[key]);
    if (value === '' || value === catalog[key]) {
      continue;
    }
    overrides[key] = value;
  }
  return overrides;
}

/**
 * @param {Object<string, string>} overrides Keys that differ from the base catalog.
 * @returns {string} custom/lang.js source.
 */
export function serializeOverrides(overrides) {
  const lines = entryLines(overrides || {});
  return `Object.assign(dhbgApp.strings, {\n${lines.join('\n')}${lines.length ? '\n' : ''}});\n`;
}

/**
 * @param {string} lang Registered language code.
 * @returns {string|null} tepuy/lang.{lang}.js source, or null when the code is not registered.
 */
export function serializeBase(lang) {
  const table = baseStrings(lang);
  if (!table) {
    return null;
  }
  const lines = entryLines(table);
  return `dhbgApp.strings = {\n${lines.join('\n')}${lines.length ? '\n' : ''}};\n`;
}

/**
 * @param {string} source File text.
 * @param {'assign'|'base'} mode Expected wrapper.
 * @returns {{ok: true, overrides: Object<string, string>}|{ok: false, overrides: Object<string, string>}} Parse result. The original text is left untouched.
 */
function parseStringMap(source, mode) {
  const text = String(source || '');
  if (!text.trim()) {
    return { ok: true, overrides: {} };
  }
  let index = 0;

  /**
   * @returns {void}
   */
  function skip() {
    while (index < text.length && /\s/.test(text[index])) {
      index += 1;
    }
  }

  /**
   * @param {string} token Expected literal.
   * @returns {boolean} Whether the token was consumed.
   */
  function eat(token) {
    skip();
    if (!text.startsWith(token, index)) {
      return false;
    }
    index += token.length;
    return true;
  }

  /**
   * @returns {string|null} Decoded string, or null when the token is not a plain string.
   */
  function readString() {
    skip();
    const quote = text[index];
    if (quote !== "'" && quote !== '"') {
      return null;
    }
    index += 1;
    let out = '';
    while (index < text.length) {
      const ch = text[index];
      if (ch === '\\') {
        const next = text[index + 1];
        const decoded = { n: '\n', r: '\r', t: '\t', '\\': '\\', "'": "'", '"': '"' }[next];
        if (decoded === undefined) {
          return null;
        }
        out += decoded;
        index += 2;
        continue;
      }
      if (ch === quote) {
        index += 1;
        return out;
      }
      if (ch === '\n' || ch === '\r') {
        return null;
      }
      out += ch;
      index += 1;
    }
    return null;
  }

  skip();
  if (mode === 'assign') {
    if (!eat('Object.assign(dhbgApp.strings,')) {
      return { ok: false, overrides: {} };
    }
  }
  else if (!eat('dhbgApp.strings') || !eat('=')) {
    return { ok: false, overrides: {} };
  }
  if (!eat('{')) {
    return { ok: false, overrides: {} };
  }
  /** @type {Object<string, string>} */
  const overrides = {};
  skip();
  if (!eat('}')) {
    while (index < text.length) {
      const key = readString();
      if (key === null || !eat(':')) {
        return { ok: false, overrides: {} };
      }
      const value = readString();
      if (value === null) {
        return { ok: false, overrides: {} };
      }
      overrides[key] = value;
      skip();
      if (text[index] === ',') {
        index += 1;
        skip();
        if (text[index] === '}') {
          index += 1;
          break;
        }
        continue;
      }
      if (text[index] === '}') {
        index += 1;
        break;
      }
      return { ok: false, overrides: {} };
    }
  }
  if (mode === 'assign' && !eat(')')) {
    return { ok: false, overrides: {} };
  }
  eat(';');
  skip();
  if (index !== text.length) {
    return { ok: false, overrides: {} };
  }
  return { ok: true, overrides };
}

/**
 * @param {string} source custom/lang.js text.
 * @returns {{ok: true, overrides: Object<string, string>}|{ok: false, overrides: Object<string, string>}} Parsed overrides. Failure keeps the caller's original text.
 */
export function parseOverrides(source) {
  return parseStringMap(source, 'assign');
}

/**
 * @param {string} lang Active language.
 * @param {Object<string, string>} [overrides] Custom texts, compared with the active catalog.
 * @param {{includeUnused?: boolean}} [options] When includeUnused is set, every registered catalog is included.
 * @returns {{files: Array<{path: string, content: string}>, remove: string[]}|null} Package files, or null when lang is not registered.
 */
export function languageFiles(lang, overrides = {}, options = {}) {
  if (!PACKAGE_LANGUAGES[lang]) {
    return null;
  }
  const codes = options.includeUnused ? languageCodes() : [lang];
  const files = codes.map((code) => ({
    path: `tepuy/lang.${code}.js`,
    content: serializeBase(code),
  }));
  const diff = diffOverrides(baseStrings(lang), overrides);
  if (Object.keys(diff).length) {
    files.push({ path: 'custom/lang.js', content: serializeOverrides(diff) });
  }
  const remove = options.includeUnused
    ? []
    : languageCodes().filter((code) => code !== lang).map((code) => `tepuy/lang.${code}.js`);
  return { files, remove };
}

/**
 * @param {string} source HTML or a script URL.
 * @returns {string} Registered language named by lang.xx.js, or empty.
 */
export function scriptLanguage(source) {
  const match = String(source || '').match(/lang\.([a-z]{2})\.js/);
  return match && PACKAGE_LANGUAGES[match[1]] ? match[1] : '';
}

/**
 * @param {{htmlLang?: string, scriptSrc?: string, legacyBase?: string, legacyCustom?: string}} input Legacy package language files.
 * @returns {{lang: string, overrides: Object<string, string>, source: string, migratedKeys: string[], unreadable: boolean}} Active language and the keys that differ from its catalog.
 */
export function migrateLegacyLanguage({ htmlLang = '', scriptSrc = '', legacyBase = '', legacyCustom = '' } = {}) {
  const requested = String(htmlLang || '').trim().toLowerCase();
  const fromScript = scriptLanguage(scriptSrc);
  const lang = PACKAGE_LANGUAGES[requested] ? requested : (fromScript || DEFAULT_LANGUAGE);
  const catalog = baseStrings(lang) || {};
  let unreadable = false;
  /** @type {Object<string, string>} */
  let combined = {};
  if (String(legacyBase || '').trim()) {
    const parsed = parseStringMap(legacyBase, 'base');
    if (!parsed.ok) {
      unreadable = true;
    }
    else {
      combined = { ...combined, ...diffOverrides(catalog, parsed.overrides) };
    }
  }
  if (String(legacyCustom || '').trim()) {
    const parsed = parseOverrides(legacyCustom);
    if (!parsed.ok) {
      unreadable = true;
    }
    else {
      combined = { ...combined, ...diffOverrides(catalog, parsed.overrides) };
    }
  }
  const overrides = diffOverrides(catalog, combined);
  return {
    lang,
    overrides,
    source: Object.keys(overrides).length ? serializeOverrides(overrides) : '',
    migratedKeys: Object.keys(overrides).sort(),
    unreadable,
  };
}
