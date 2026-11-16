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
  currentIndexDocument,
  currentInsertionPath,
  hasDraft,
  indexDraft,
  insertControl,
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
