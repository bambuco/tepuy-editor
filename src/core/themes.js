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
 * Loads the layout HTML of an installed theme.
 * @param {string} id Theme identifier.
 * @returns {Promise<string>} Theme content document.
 */
export async function readThemeLayout(id) {
  const theme = findTheme(id);
  if (!theme) {
    throw new Error(`Theme "${id}" is not installed.`);
  }
  const url = new URL(`../themes/${theme.id}/content.html`, import.meta.url);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Theme "${id}" has no content layout.`);
  }
  return response.text();
}

/**
 * Loads the presentation index.html of an installed theme.
 * @param {string} id Theme identifier.
 * @returns {Promise<string>} Theme index document.
 */
export async function readThemeIndex(id) {
  const theme = findTheme(id);
  if (!theme) {
    throw new Error(`Theme "${id}" is not installed.`);
  }
  const url = new URL(`../themes/${theme.id}/index.html`, import.meta.url);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Theme "${id}" has no index layout.`);
  }
  return response.text();
}

/**
 * Synchronous theme index for Node tests and seeding without fetch.
 * @param {string} id Theme identifier.
 * @returns {string} Minimal index HTML with metadata markers.
 */
export function themeIndexTemplate(id) {
  const theme = findTheme(id) || findTheme('base');
  const themeId = theme?.id || 'base';
  const version = theme?.version || '1.0.0';
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="tepuy-theme" content="${themeId}@${version}">
  <title></title>
</head>
<body data-autoload="false" data-display-window="top">
  <div id="body">
    <h1 class="metadata" data-key="title"></h1>
    <div id="content">
      <p class="metadata" data-key="topic"></p>
      <section class="metadata" data-key="description"></section>
      <section class="metadata" data-key="objective"></section>
      <p class="metadata" data-key="duration" data-unit="hours"></p>
      <span class="metadata" data-key="participation"></span>
      <span class="metadata" data-key="modality"></span>
      <span class="metadata" data-key="synchronicity"></span>
      <div id="play_scorm"></div>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Synchronous theme content.html shell (matches each theme content.html).
 * @param {string} id Theme identifier.
 * @returns {string} Theme content document used as serialize/preview shell.
 */
export function themeContentTemplate(id) {
  const theme = findTheme(id) || findTheme('base');
  const themeId = theme?.id || 'base';
  const version = theme?.version || '1.0.0';
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="tepuy-theme" content="${themeId}@${version}">
  <meta name="tepuy-version" content="2.0">
  <title>Tepuy</title>
  <link rel="stylesheet" href="theme.css">
</head>
<body>
  <nav class="main"></nav>
  <nav class="globals"></nav>
  <div id="tpy-measuring_progress"></div>
  <nav class="secondary globals2"></nav>
  <div id="tpy-subpages_menu"></div>
  <div id="tpy-page_number"></div>
  <div id="tpy-results_page"></div>
  <div id="tpy-pg_credits" data-global="credits"></div>
  <div id="tpy-pg_bibliography" data-global="library"></div>
  <div id="tpy-auto_citation"></div>
  <div id="global-pages"></div>
  <main>
    <h1 class="tpy-page-title"></h1>
  </main>
</body>
</html>
`;
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
