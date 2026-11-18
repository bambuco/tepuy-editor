/**
 * @file Installed themes and the switch that keeps user pages.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import base from '../themes/base/theme.json' with { type: 'json' };
import perception from '../themes/perception/theme.json' with { type: 'json' };
import rutatic from '../themes/rutatic/theme.json' with { type: 'json' };

/** @type {Array<Object>} Themes detected when the editor starts. A new theme is a folder under src/themes plus one import here. */
export const THEMES = [base, rutatic, perception];

/**
 * @param {string} id Theme identifier.
 * @returns {Object|null} Installed theme, or null when the package names an unknown one.
 */
export function findTheme(id) {
  return THEMES.find((theme) => theme.id === id) ?? null;
}

/**
 * @param {string} id Theme identifier.
 * @param {string} fileName index.html or content.html.
 * @param {string} missing Error when the file cannot be fetched.
 * @returns {Promise<string>} Theme document.
 */
async function readThemeDocument(id, fileName, missing) {
  const theme = findTheme(id);
  if (!theme) {
    throw new Error(`Theme "${id}" is not installed.`);
  }
  const url = new URL(`../themes/${theme.id}/${fileName}`, import.meta.url);
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(missing);
  }
  return response.text();
}

/**
 * Loads the layout HTML of an installed theme.
 * @param {string} id Theme identifier.
 * @returns {Promise<string>} Theme content document.
 */
export function readThemeLayout(id) {
  return readThemeDocument(id, 'content.html', `Theme "${id}" has no content layout.`);
}

/**
 * Loads the presentation index.html of an installed theme.
 * @param {string} id Theme identifier.
 * @returns {Promise<string>} Theme index document.
 */
export function readThemeIndex(id) {
  return readThemeDocument(id, 'index.html', `Theme "${id}" has no index layout.`);
}

/**
 * Loads the theme.css of an installed theme.
 * @param {string} id Theme identifier.
 * @returns {Promise<string>} Theme stylesheet.
 */
export function readThemeStyle(id) {
  return readThemeDocument(id, 'theme.css', `Theme "${id}" has no stylesheet.`);
}

/** @type {Map<string, string>} Index HTML loaded from each theme folder. */
const indexSources = new Map();

/** @type {Map<string, string>} Content HTML loaded from each theme folder. */
const contentSources = new Map();

/** @type {Map<string, string>} Theme stylesheets loaded from each theme folder. */
const styleSources = new Map();

/**
 * Loads every installed theme index.html, content.html, and theme.css into memory.
 * @returns {Promise<void>}
 */
export async function loadThemeDocuments() {
  await Promise.all(THEMES.map(async (theme) => {
    indexSources.set(theme.id, await readThemeIndex(theme.id));
    contentSources.set(theme.id, await readThemeLayout(theme.id));
    styleSources.set(theme.id, await readThemeStyle(theme.id));
  }));
}

/**
 * Reads a theme file from disk when the editor is running under Node.
 * @param {string} themeId Installed theme id.
 * @param {string} fileName index.html or content.html.
 * @returns {string} File contents.
 */
function readThemeFile(themeId, fileName) {
  const builtin = globalThis.process?.getBuiltinModule;
  if (typeof builtin !== 'function') {
    throw new Error(`Theme "${themeId}" ${fileName} is not loaded.`);
  }
  const fs = builtin.call(globalThis.process, 'node:fs');
  const { fileURLToPath } = builtin.call(globalThis.process, 'node:url');
  return fs.readFileSync(
    fileURLToPath(new URL(`../themes/${themeId}/${fileName}`, import.meta.url)),
    'utf8',
  );
}

/**
 * @param {Map<string, string>} sources Loaded documents.
 * @param {string} id Theme identifier.
 * @param {string} fileName index.html or content.html.
 * @returns {string} Theme document.
 */
function themeDocument(sources, id, fileName) {
  const theme = findTheme(id) || findTheme('base');
  const themeId = theme?.id || 'base';
  if (!sources.has(themeId)) {
    sources.set(themeId, readThemeFile(themeId, fileName));
  }
  return sources.get(themeId);
}

/**
 * Returns the installed theme index.html. The browser loads it through
 * loadThemeDocuments(); Node reads the file directly.
 * @param {string} id Theme identifier.
 * @returns {string} Theme index document.
 */
export function themeIndexTemplate(id) {
  return themeDocument(indexSources, id, 'index.html');
}

/**
 * Returns the installed theme content.html. The browser loads it through
 * loadThemeDocuments(); Node reads the file directly.
 * @param {string} id Theme identifier.
 * @returns {string} Theme content document used as serialize/preview shell.
 */
export function themeContentTemplate(id) {
  return themeDocument(contentSources, id, 'content.html');
}

/**
 * Returns the installed theme.css. The browser loads it through
 * loadThemeDocuments(); Node reads the file directly.
 * @param {string} id Theme identifier.
 * @returns {string} Theme stylesheet.
 */
export function themeStylesheet(id) {
  return themeDocument(styleSources, id, 'theme.css');
}

/**
 * @param {string} id Theme identifier.
 * @returns {string} Absolute URL of the theme folder, with a trailing slash.
 */
export function themeAssetBase(id) {
  const theme = findTheme(id) || findTheme('base');
  const themeId = theme?.id || 'base';
  return new URL(`../themes/${themeId}/`, import.meta.url).href;
}

/**
 * @param {string} html Theme content.html.
 * @param {string[]} positions Declared positions.
 * @param {typeof DOMParser} [Parser] DOM parser constructor.
 * @returns {string[]} Positions the layout actually contains.
 */
export function presentPositions(html, positions, Parser = globalThis.DOMParser) {
  const document = new Parser().parseFromString(html, 'text/html');
  return positions.filter((position) => {
    if (position === 'main > section') {
      return Boolean(document.querySelector('main'));
    }
    return Boolean(document.querySelector(position));
  });
}

/**
 * Keeps the user's content tree when the theme layout changes.
 * Theme chrome stays in the theme folder and is not copied into the document.
 * @param {import('./parser.js').Node} userMain Current content tree.
 * @returns {import('./parser.js').Node} Independent copy of the user content.
 */
export function applyTheme(userMain) {
  return structuredClone(userMain);
}

/**
 * @param {Object} fromTheme Theme that is currently open.
 * @param {Object} toTheme Theme that will be applied.
 * @returns {{missingPositions: string[], changedVariables: string[]}} Differences to show the user.
 */
export function themeChangeReport(fromTheme, toTheme) {
  const nextPositions = new Set(toTheme.positions || []);
  const missingPositions = (fromTheme.positions || []).filter((position) => !nextPositions.has(position));
  const keys = new Set([
    ...Object.keys(fromTheme.variables || {}),
    ...Object.keys(toTheme.variables || {}),
  ]);
  const changedVariables = [...keys].filter((key) => fromTheme.variables?.[key] !== toTheme.variables?.[key]);
  return { missingPositions, changedVariables };
}
