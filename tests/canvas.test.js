/**
 * @file Tests that canvas HTML stays out of the document until Apply.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from 'linkedom';
import { buildPreviewHtml } from '../src/core/preview.js';
import { readMetadata, serializeIndexDocument } from '../src/metadata/index-document.js';
import {
  applyDraft,
  cancelDraft,
  currentDocument,
  currentGlobalPages,
  currentIndexDocument,
  currentInsertionPath,
  currentThemeId,
  hasDraft,
  indexDraft,
  insertControl,
  replaceDocument,
  selectNode,
  setIndexDraft,
  subscribePreview,
} from '../src/ui/session.js';

globalThis.DOMParser = DOMParser;

test('an index metadata draft stays out of the document until apply', () => {
  const before = serializeIndexDocument(currentIndexDocument());
  const applied = readMetadata(currentIndexDocument().body);
  setIndexDraft({
    ...applied,
    description: { value: '<p>Nuevo</p>' },
    title: { value: 'Curso nuevo' },
  });
  assert.equal(hasDraft(), true);
  assert.ok(indexDraft());
  assert.equal(serializeIndexDocument(currentIndexDocument()), before);
  assert.equal(insertControl('paragraph'), 'pending');
  assert.equal(applyDraft(), 'applied');
  assert.equal(hasDraft(), false);
  const saved = serializeIndexDocument(currentIndexDocument());
  assert.match(saved, /data-key="description"/);
  assert.match(saved, /<p>\s*Nuevo\s*<\/p>/);
  assert.match(saved, /data-key="title"/);
  assert.match(saved, /Curso nuevo/);
  setIndexDraft({
    ...readMetadata(currentIndexDocument().body),
    description: { value: '<p>Otro</p>' },
  });
  assert.equal(cancelDraft(), true);
  assert.match(serializeIndexDocument(currentIndexDocument()), /<p>\s*Nuevo\s*<\/p>/);
  assert.ok(currentInsertionPath());
});

test('cancel clears an empty index focus cycle', () => {
  assert.equal(hasDraft(), false);
  assert.equal(cancelDraft(), false);
  const applied = readMetadata(currentIndexDocument().body);
  setIndexDraft({
    ...applied,
    topic: { value: 'Temporal' },
  });
  assert.equal(hasDraft(), true);
  assert.equal(cancelDraft(), true);
  assert.equal(hasDraft(), false);
  assert.equal(indexDraft(), null);
});

test('applied index metadata appears in the presentation preview body', () => {
  const applied = readMetadata(currentIndexDocument().body);
  setIndexDraft({
    ...applied,
    title: { value: 'Vista previa index' },
  });
  assert.equal(applyDraft(), 'applied');
  const indexHtml = serializeIndexDocument(currentIndexDocument());
  const preview = buildPreviewHtml({
    view: 'presentation',
    indexHtml,
    settings: { lang: 'es' },
  });
  assert.match(preview, /Vista previa index/);
  assert.match(preview, /data-key="title"/);
});

test('preview notify fires on apply, not on index draft typing', () => {
  let hits = 0;
  const stop = subscribePreview(() => {
    hits += 1;
  });
  const applied = readMetadata(currentIndexDocument().body);
  setIndexDraft({
    ...applied,
    title: { value: 'Borrador sin preview' },
  });
  assert.equal(hits, 0);
  assert.equal(applyDraft(), 'applied');
  assert.equal(hits, 1);
  stop();
});

/**
 * @param {import('../src/core/parser.js').Node|null} node Content node.
 * @param {string} tag Element name.
 * @returns {number} Matching elements in the tree.
 */
function countTag(node, tag) {
  if (!node) {
    return 0;
  }
  const own = node.tag === tag ? 1 : 0;
  return own + (node.children || []).reduce((sum, child) => sum + countTag(child, tag), 0);
}

test('inserting into a global writes that entry and leaves main unchanged', () => {
  const mainParagraphs = countTag(currentDocument(), 'p');
  replaceDocument(currentDocument(), currentThemeId(), {
    globalPages: {
      type: 'element',
      tag: 'div',
      attrs: { id: 'global-pages' },
      children: [{
        type: 'element',
        tag: 'div',
        attrs: { 'data-global': 'credits' },
        children: [],
      }],
    },
  });
  selectNode({ scope: 'global', path: [0] });
  assert.equal(insertControl('richtext'), 'inserted');
  assert.equal(countTag(currentDocument(), 'p'), mainParagraphs);
  assert.equal(countTag(currentGlobalPages(), 'p'), 1);
  assert.equal(currentGlobalPages().children[0].attrs['data-global'], 'credits');
});
