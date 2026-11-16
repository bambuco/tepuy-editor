/**
 * @file Tests for main-menu HTML contract and page id helpers.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from 'linkedom';
import { isAutoPageId, placeControl, suggestedPageId } from '../src/controls/library.js';
import {
  addMainMenuItem,
  emptyMainMenu,
  extractMainMenuItems,
  rewriteMenuPageIds,
} from '../src/core/menu.js';
import { readPackageContent, serializePackage } from '../src/core/package.js';
import { SAMPLE_CONTENT } from '../src/sample-content.js';

test('extractMainMenuItems reads data-page from any theme markup', () => {
  const flat = addMainMenuItem(emptyMainMenu('base'), 'base', {
    pageId: 'pag-uno',
    title: 'Uno',
  });
  assert.deepEqual(extractMainMenuItems(flat), [{ id: 'pag-uno', title: 'Uno' }]);
  let nested = emptyMainMenu('perception');
  nested = addMainMenuItem(nested, 'perception', { pageId: 'pag-a', title: 'A' });
  nested = addMainMenuItem(nested, 'perception', { pageId: 'pag-b', title: 'B', afterPageId: 'pag-a' });
  assert.deepEqual(extractMainMenuItems(nested), [
    { id: 'pag-a', title: 'A' },
    { id: 'pag-b', title: 'B' },
  ]);
  assert.equal(nested.children[0].tag, 'ul');
  assert.equal(nested.children[0].children[0].tag, 'li');
});

test('rewriteMenuPageIds updates every matching data-page', () => {
  let menu = emptyMainMenu('base');
  menu = addMainMenuItem(menu, 'base', { pageId: 'pag-old', title: 'Primera' });
  menu = addMainMenuItem(menu, 'base', { pageId: 'pag-old', title: 'Otra' });
  menu = addMainMenuItem(menu, 'base', { pageId: 'pag-keep', title: 'Keep' });
  const next = rewriteMenuPageIds(menu, 'pag-old', 'pag-new');
  assert.deepEqual(extractMainMenuItems(next).map((item) => item.id), [
    'pag-new',
    'pag-new',
    'pag-keep',
  ]);
});

test('package round-trip keeps nav.main data-page items', () => {
  const { main, mainMenu } = readPackageContent(SAMPLE_CONTENT, 'base', DOMParser);
  assert.deepEqual(extractMainMenuItems(mainMenu).map((item) => item.id), [
    'pag-introduccion',
    'pag-actividades',
  ]);
  const saved = serializePackage(main, { title: 'Curso' }, { themeId: 'base', mainMenu }, DOMParser);
  assert.match(saved, /<nav[^>]*class="[^"]*\bmain\b/);
  assert.match(saved, /data-page="pag-introduccion"/);
  const again = readPackageContent(saved, 'base', DOMParser);
  assert.deepEqual(extractMainMenuItems(again.mainMenu), extractMainMenuItems(mainMenu));
});

test('new page can use an orphan menu id and suggested ids follow the title', () => {
  const { main } = readPackageContent(SAMPLE_CONTENT, 'base', DOMParser);
  const placed = placeControl(main, [], 'page', {
    pageId: 'pag-futuro',
    pageTitle: 'Futuro',
  });
  assert.equal(placed.tree.children.at(-1).attrs.id, 'pag-futuro');
  assert.equal(placed.tree.children.at(-1).attrs.ptitle, 'Futuro');
  assert.equal(isAutoPageId('pag-introduccion', 'Introducción'), true);
  assert.equal(isAutoPageId('pag-custom', 'Introducción'), false);
  assert.match(suggestedPageId('Nueva Página', new Set(['pag-nueva-pagina'])), /^pag-nueva-pagina-[a-z0-9]+$/);
});
