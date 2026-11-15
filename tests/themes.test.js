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
import { applyTheme, findTheme, presentPositions, THEMES, themeChangeReport } from '../src/core/themes.js';
import { SAMPLE_CONTENT } from '../src/sample-content.js';

const REQUIRED = ['#tpy-auto_citation', '#tpy-pg_bibliography', 'main > section'];

test('the editor starts with base, rutatic, and perception', () => {
  assert.deepEqual(THEMES.map((theme) => theme.id), ['base', 'rutatic', 'perception']);
  assert.equal(findTheme('base').name, 'Base');
  assert.equal(findTheme('missing'), null);
  for (const theme of THEMES) {
    for (const position of REQUIRED) {
      assert.equal(theme.positions.includes(position), true, `${theme.id} ${position}`);
    }
  }
});

test('each theme layout exposes the positions it declares', () => {
  for (const theme of THEMES) {
    const html = readFileSync(new URL(`../src/themes/${theme.id}/content.html`, import.meta.url), 'utf8');
    const present = presentPositions(html, theme.positions, DOMParser);
    assert.deepEqual(present, theme.positions);
  }
});

test('switching themes keeps the user pages', () => {
  const content = parseContentHtml(SAMPLE_CONTENT, DOMParser);
  const next = applyTheme(content);
  const pages = next.children.filter((node) => node.type === 'page');
  assert.deepEqual(pages.map((page) => page.attrs.id), ['pag-introduccion', 'pag-actividades']);
  assert.notEqual(next, content);
  const report = themeChangeReport(findTheme('base'), findTheme('rutatic'));
  assert.deepEqual(report.missingPositions, []);
  assert.equal(report.changedVariables.includes('--tepuy-color-heading'), true);
});

test('a theme without a previous position is reported', () => {
  const report = themeChangeReport(
    { positions: ['nav.main', '#tpy-results_page'], variables: { '--tepuy-color-bg': '#fff' } },
    { positions: ['nav.main'], variables: { '--tepuy-color-bg': '#fff' } },
  );
  assert.deepEqual(report.missingPositions, ['#tpy-results_page']);
  assert.deepEqual(report.changedVariables, []);
});
