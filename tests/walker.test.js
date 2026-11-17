/**
 * @file Tests for the control walker and priority insertion rules.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from 'linkedom';
import { createControlNode, placeControl, slotAccepts } from '../src/controls/library.js';
import { walkGlobals, walkPages, walkPackageContent } from '../src/controls/walker.js';
import { emptyGlobalPages } from '../src/core/package.js';
import { parseContentHtml } from '../src/core/parser.js';
import { SAMPLE_CONTENT } from '../src/sample-content.js';

test('walker reads only main section[ptitle] as pages and fuses loose markup into richtext', () => {
  const main = parseContentHtml(`<!DOCTYPE html><html><body><main>
    <h1 class="tpy-page-title">Layout</h1>
    <section id="pag-a" ptitle="Una">
      <div class="subpage" data-title="Inicio">
        <h3>Inicio</h3>
        <p>Uno</p>
        <p>Dos</p>
        <div class="box-text important" label="Importante"><p>X</p></div>
      </div>
    </section>
  </main></body></html>`, DOMParser);
  const pages = walkPages(main);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].controlId, 'page');
  assert.equal(pages[0].path[0], 1);
  const subpage = pages[0].children[0];
  assert.equal(subpage.controlId, 'subpage');
  assert.equal(subpage.children[0].controlId, 'heading-3');
  assert.equal(subpage.children[1].controlId, 'richtext');
  assert.equal(subpage.children[1].length >= 2, true);
  assert.equal(subpage.children[2].controlId, 'important');
});

test('walker reads #global-pages and rejects page priority under globals', () => {
  const globals = {
    type: 'element',
    tag: 'div',
    attrs: { id: 'global-pages' },
    children: [
      {
        type: 'element',
        tag: 'div',
        attrs: { 'data-global': 'credits', class: 'about' },
        children: [{ type: 'text', text: 'Créditos' }],
      },
      createControlNode('important', { ids: new Set(), root: { children: [] } }),
    ],
  };
  const instances = walkGlobals(globals);
  assert.equal(instances.length, 2);
  assert.equal(instances[0].controlId, 'global-entry');
  assert.equal(instances[1].controlId, 'important');
  assert.equal(slotAccepts(globals, 'page'), false);
  assert.equal(slotAccepts(globals, 'subpage'), false);
  assert.equal(slotAccepts(globals, 'important'), true);
  const entry = globals.children[0];
  assert.equal(slotAccepts(entry, 'page'), false);
  assert.equal(slotAccepts(entry, 'subpage'), false);
  assert.equal(slotAccepts(entry, 'richtext'), true);
});

test('slotAccepts blocks a higher-priority child under a lower-priority parent', () => {
  const root = parseContentHtml(SAMPLE_CONTENT, DOMParser);
  const page = root.children.find((node) => node.attrs?.ptitle);
  const subpage = page.children.find((node) => node.attrs?.class?.includes('subpage'));
  assert.equal(slotAccepts(subpage, 'page'), false);
  assert.equal(slotAccepts(page, 'subpage'), true);
  assert.equal(slotAccepts(page, 'tabs'), true);
  const tabs = createControlNode('tabs', { ids: new Set(), root });
  assert.equal(slotAccepts(tabs, 'modal'), false);
  assert.equal(slotAccepts(tabs, 'quiz'), true);
});

test('htmlfree round-trips through create and place', () => {
  const root = parseContentHtml(SAMPLE_CONTENT, DOMParser);
  const pageIndex = root.children.findIndex((node) => node.attrs?.ptitle);
  const subIndex = root.children[pageIndex].children.findIndex((node) => node.attrs?.class?.includes('subpage'));
  const placed = placeControl(root, [pageIndex, subIndex], 'htmlfree');
  assert.ok(placed);
  assert.equal(placed.tree.children[pageIndex].children[subIndex].children.at(-1).attrs.class, 'htmlfree');
  const again = createControlNode('htmlfree', { ids: new Set(), root });
  assert.equal(again.attrs.class, 'htmlfree');
});

test('walkPackageContent combines pages and empty globals', () => {
  const main = parseContentHtml(SAMPLE_CONTENT, DOMParser);
  const tree = walkPackageContent(main, emptyGlobalPages());
  assert.equal(tree.pages.length, 2);
  assert.equal(tree.globals.length, 0);
});
