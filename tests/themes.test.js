/**
 * @file Theme folders, layout positions, and content preserved across a switch.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DOMParser } from 'linkedom';
import { parseContentHtml } from '../src/core/parser.js';
import { applyTheme, findTheme, presentPositions, THEME_POSITIONS, THEMES, themeChangeReport } from '../src/core/themes.js';
import { SAMPLE_CONTENT } from '../src/sample-content.js';

globalThis.DOMParser = DOMParser;

const REQUIRED = ['#tpy-auto_citation', '#tpy-pg_bibliography', 'main > section'];

test('the editor starts with base, rutatic, and perception', () => {
  assert.deepEqual(THEMES.map((theme) => theme.id), ['base', 'rutatic', 'perception']);
  assert.equal(findTheme('base').name, 'Base');
  assert.equal(findTheme('missing'), null);
  for (const position of REQUIRED) {
    assert.equal(THEME_POSITIONS.includes(position), true, position);
  }
});

test('each theme layout uses known positions', () => {
  for (const theme of THEMES) {
    const html = readFileSync(new URL(`../src/themes/${theme.id}/content.html`, import.meta.url), 'utf8');
    const present = presentPositions(html, DOMParser);
    assert.ok(present.length > 0, theme.id);
    for (const position of present) {
      assert.equal(THEME_POSITIONS.includes(position), true, `${theme.id} ${position}`);
    }
  }
});

test('switching themes keeps the user pages', () => {
  const content = parseContentHtml(SAMPLE_CONTENT, DOMParser);
  const next = applyTheme(content);
  const pages = next.children.filter((node) => node.type === 'page');
  assert.deepEqual(pages.map((page) => page.attrs.id), ['pag-introduccion', 'pag-actividades']);
  assert.notEqual(next, content);
  const report = themeChangeReport(
    findTheme('base'),
    findTheme('rutatic'),
    readFileSync(new URL('../src/themes/base/content.html', import.meta.url), 'utf8'),
    readFileSync(new URL('../src/themes/rutatic/content.html', import.meta.url), 'utf8'),
  );
  assert.deepEqual(report.missingPositions, []);
  assert.equal(report.changedVariables.includes('--tepuy-color-heading'), true);
});

test('a theme without a previous position is reported', () => {
  const report = themeChangeReport(
    { variables: { '--tepuy-color-bg': '#fff' } },
    { variables: { '--tepuy-color-bg': '#fff' } },
    '<nav class="main"></nav><div id="tpy-results_page"></div>',
    '<nav class="main"></nav>',
  );
  assert.deepEqual(report.missingPositions, ['#tpy-results_page']);
  assert.deepEqual(report.changedVariables, []);
});
