/**
 * @file Tests for version-1 controls and package settings.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from 'linkedom';
import {
  applyControlFields,
  applyRegionHtml,
  collectReferences,
  createControlNode,
  deleteAt,
  duplicateAt,
  fieldValues,
  fieldsFor,
  hasSlot,
  htmlRegions,
  moveNode,
  placeControl,
  regionHtml,
  slotAccepts,
} from '../src/controls/library.js';
import { htmlFragment } from '../src/core/html.js';
import { packageSettings, readPackageSettings, serializePackage } from '../src/core/package.js';
import { parseContentHtml } from '../src/core/parser.js';
import { buildPreviewHtml } from '../src/core/preview.js';
import { serializeContent } from '../src/core/serializer.js';
import { SAMPLE_CONTENT } from '../src/sample-content.js';

globalThis.DOMParser = DOMParser;

/**
 * @param {import('../src/core/parser.js').Node} node Control node.
 * @returns {import('../src/core/parser.js').Node} The same control after a parse.
 */
function roundTrip(node) {
  const main = { type: 'element', tag: 'main', attrs: {}, children: [node] };
  const parsed = parseContentHtml(`<!DOCTYPE html><html><body>${serializeContent(main)}</body></html>`, DOMParser);
  return parsed.children[0];
}

test('version-1 controls keep their fields after a round-trip', () => {
  const root = parseContentHtml(SAMPLE_CONTENT, DOMParser);
  const ids = ['image', 'important', 'tabs', 'quiz', 'reference-image', 'instruction-info', 'paragraph'];
  for (const id of ids) {
    const node = createControlNode(id, { ids: new Set(), root });
    const again = roundTrip(node);
    assert.deepEqual(fieldValues(fieldsFor(again)), fieldValues(fieldsFor(node)));
  }
});

test('tabs and quiz do not put ids on their internal elements', () => {
  const root = parseContentHtml(SAMPLE_CONTENT, DOMParser);
  const tabs = serializeContent({ type: 'element', tag: 'main', attrs: {}, children: [createControlNode('tabs', { ids: new Set(), root })] });
  assert.equal(tabs.match(/<dl/g).length, 2);
  assert.equal(/<(dt|dd)[^>]*\sid=/.test(tabs), false);
  const quiz = createControlNode('quiz', { ids: new Set(), root });
  assert.equal(quiz.attrs['data-act-id'], 'quiz-cuestionario');
  assert.equal(quiz.children.some((child) => child.attrs?.id), false);
  const reference = createControlNode('reference-book', { ids: new Set(), root });
  assert.equal(reference.attrs['data-type'], 'paper');
  assert.equal(reference.attrs.class, 'about');
});

test('inserting a control keeps the existing pages', () => {
  const root = parseContentHtml(SAMPLE_CONTENT, DOMParser);
  const placed = placeControl(root, [0], 'quiz');
  assert.equal(placed.tree.children.filter((node) => node.type === 'page').length, 2);
  assert.equal(placed.tree.children[0].children.at(-1).attrs.class, 'jpit-activities-quiz');
  assert.equal(placeControl(root, null, 'paragraph'), null);
  assert.equal(placeControl({ type: 'element', tag: 'main', attrs: {}, children: [] }, [], 'paragraph'), null);
  assert.equal(placeControl(root, [0, 0], 'cloze'), null);
});

test('apply writes properties and cancel leaves the original tree', () => {
  const root = parseContentHtml(SAMPLE_CONTENT, DOMParser);
  const placed = placeControl(root, [0, 0], 'important');
  const path = placed.path;
  const fields = { ...fieldValues(fieldsFor(placed.tree.children[0].children[0].children.at(-1))), label: 'Aviso' };
  const edited = applyControlFields(placed.tree, path, fields);
  assert.equal(nodeLabel(edited, path), 'Aviso');
  assert.equal(nodeLabel(placed.tree, path), 'Importante');
  assert.equal(applyControlFields(placed.tree, [0], { id: 'pag-actividades', ptitle: 'Otra' }), null);
});

test('duplicate assigns a new page id and delete removes the copy', () => {
  const root = parseContentHtml(SAMPLE_CONTENT, DOMParser);
  const copy = duplicateAt(root, [0]);
  assert.notEqual(copy.tree.children[1].attrs.id, root.children[0].attrs.id);
  const removed = deleteAt(copy.tree, copy.path);
  assert.equal(removed.children.length, root.children.length);
});

test('opening and saving package settings is an empty diff', () => {
  const main = parseContentHtml(SAMPLE_CONTENT, DOMParser);
  const settings = readPackageSettings(SAMPLE_CONTENT, DOMParser);
  const saved = serializePackage(main, settings, {}, DOMParser);
  const again = serializePackage(parseContentHtml(saved, DOMParser), readPackageSettings(saved, DOMParser), {}, DOMParser);
  assert.equal(again, saved);
  assert.doesNotMatch(saved, /header class="tpy-presentation"/);
  assert.doesNotMatch(saved, /id="play_scorm"/);
  assert.match(saved, /data-global="library"/);
  assert.match(saved, /data-global="credits"/);
  assert.match(saved, /id="tpy-measuring_progress"/);
  assert.match(saved, /nav class="globals"/);
  assert.equal(packageSettings({ approveLimit: 'abc' }, true), null);
});

test('slots accept pages at the root and content inside a page', () => {
  const root = parseContentHtml(SAMPLE_CONTENT, DOMParser);
  assert.equal(hasSlot(root), true);
  assert.equal(slotAccepts(root, 'page'), true);
  assert.equal(slotAccepts(root, 'paragraph'), false);
  const page = root.children[0];
  assert.equal(slotAccepts(page, 'paragraph'), true);
  assert.equal(slotAccepts(page, 'subpage'), true);
  const paragraph = page.children[0].children[1];
  assert.equal(hasSlot(paragraph), false);
  assert.equal(slotAccepts(paragraph, 'paragraph'), false);
  const tabs = createControlNode('tabs', { ids: new Set(), root });
  const panel = tabs.children[0].children.find((child) => child.tag === 'dd');
  assert.equal(hasSlot(panel), true);
  assert.equal(slotAccepts(panel, 'paragraph'), true);
  assert.equal(htmlRegions(paragraph).map((region) => region.id).join(','), 'body');
  assert.equal(fieldsFor(paragraph).length, 0);
  assert.equal(fieldsFor(createControlNode('quiz', { ids: new Set(), root })).some((field) => field.name === 'question'), false);
});

test('moving a control reorders siblings and refuses an invalid parent', () => {
  const root = parseContentHtml(SAMPLE_CONTENT, DOMParser);
  const moved = moveNode(root, [0, 0, 1], [0, 0], 0);
  assert.equal(moved.path.join('.'), '0.0.0');
  assert.equal(moved.tree.children[0].children[0].children[0].type, 'paragraph');
  assert.equal(moveNode(root, [1], [0, 0], 0), null);
  assert.equal(moveNode(root, [0], [0, 0], 0), null);
  const across = moveNode(root, [1], [], 0);
  assert.equal(across.path.join('.'), '0');
  assert.equal(across.tree.children[0].attrs.id, 'pag-actividades');
});

test('html regions keep sanitized markup through a round-trip', () => {
  const root = parseContentHtml(SAMPLE_CONTENT, DOMParser);
  const placed = placeControl(root, [0, 0], 'paragraph');
  const edited = applyRegionHtml(placed.tree, placed.path, 'body', '<p>Hola <strong>sí</strong><script>x</script></p>', DOMParser);
  const serialized = serializeContent(edited);
  assert.match(serialized, /<strong>\s*sí\s*<\/strong>/);
  assert.doesNotMatch(serialized, /script/);
  assert.doesNotMatch(serializeContent(placed.tree), /<strong>/);
  const again = parseContentHtml(`<!DOCTYPE html><html><body>${serialized}</body></html>`, DOMParser);
  const paragraph = again.children[0].children[0].children.at(-1);
  assert.match(regionHtml(paragraph, 'body'), /Hola/);
  assert.match(regionHtml(paragraph, 'body'), /<strong>sí<\/strong>/);
  assert.equal(htmlFragment('<a href="javascript:alert(1)">x</a><a href="https://ejemplo.test">y</a>', 'inline', DOMParser), 'x<a href="https://ejemplo.test">y</a>');
  assert.equal(htmlFragment('<p>Hola</p><script>bad</script>', 'rich', DOMParser), '<p>Hola</p>');
});

test('the preview shows layout, citations, device visibility, and the start button', () => {
  const root = parseContentHtml(SAMPLE_CONTENT, DOMParser);
  const reference = createControlNode('reference-image', { ids: new Set(), root });
  const settings = {
    menu: 'pills',
    progress: 'circle',
    pagination: 'true',
    lang: 'es',
    autoload: 'true',
    title: 'Curso',
  };
  const contentHtml = serializePackage(root, settings, {
    themeId: 'base',
    references: collectReferences(reference),
  }, DOMParser);
  const html = buildPreviewHtml({
    contentHtml,
    settings,
    view: 'content',
    mobile: false,
  });
  assert.match(html, /menu-pills/);
  assert.match(html, /data-type="circle"/);
  assert.match(html, /id="tpy-auto_citation"/);
  assert.match(html, /id="tpy-measuring_progress"/);
  assert.match(html, /nav class="globals"/);
  assert.match(html, /Descripción del recurso/);
  assert.match(html, /onlymobile \{ display: none/);
  const presentation = buildPreviewHtml({
    settings: { title: 'Curso', autoload: 'true' },
    view: 'presentation',
    autoloadNote: 'En ejecución esta página se omite.',
    indexHtml: '<!DOCTYPE html><html><body><div id="content"></div><div id="play_scorm"></div></body></html>',
  });
  assert.match(presentation, /id="play_scorm"/);
  assert.match(presentation, /En ejecución esta página se omite/);
  assert.doesNotMatch(presentation, /<script/i);
});

/**
 * @param {import('../src/core/parser.js').Node} root Content tree.
 * @param {number[]} path Node path.
 * @returns {string} Box label at that path.
 */
function nodeLabel(root, path) {
  return path.reduce((node, index) => node.children[index], root).attrs.label;
}
