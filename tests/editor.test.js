/**
 * @file Tests for stable saving, pending edits, and the isolated preview.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DOMParser } from 'linkedom';
import { editableValue, nodeAt, withEditableValue } from '../src/core/edit.js';
import { parseContentHtml } from '../src/core/parser.js';
import { buildPreviewHtml } from '../src/core/preview.js';
import { serializeContent } from '../src/core/serializer.js';
import { SAMPLE_CONTENT } from '../src/sample-content.js';

/**
 * @param {string} html Package or theme document.
 * @returns {string} Canonical content HTML.
 */
function canonical(html) {
  return serializeContent(parseContentHtml(html, DOMParser));
}

test('opening and saving without edits is an empty diff', () => {
  const sources = [
    SAMPLE_CONTENT,
    readFileSync(new URL('../src/themes/base/content.html', import.meta.url), 'utf8'),
    readFileSync(new URL('../src/themes/rutatic/content.html', import.meta.url), 'utf8'),
    readFileSync(new URL('../src/themes/perception/content.html', import.meta.url), 'utf8'),
  ];
  for (const source of sources) {
    const saved = canonical(source);
    assert.equal(canonical(saved), saved);
  }
});

test('a pending text edit stays out of the document until it is written', () => {
  const root = parseContentHtml(SAMPLE_CONTENT, DOMParser);
  const path = [0, 0, 1];
  assert.equal(nodeAt(root, path).type, 'paragraph');
  assert.equal(editableValue(nodeAt(root, path)), 'Texto de la introducción.');
  const edited = withEditableValue(root, path, 'Otro texto');
  assert.match(serializeContent(edited), /Otro texto/);
  assert.equal(serializeContent(root), canonical(SAMPLE_CONTENT));
  assert.equal(editableValue(nodeAt(withEditableValue(root, [0], 'Otra página'), [0])), 'Otra página');
});

test('the preview document is static and marks the mobile frame', () => {
  const html = buildPreviewHtml({
    html: '<main></main>',
    variables: { '--tepuy-color-bg': '#abc', '--bad': 'red; } body { background: url(http://x)' },
    mobile: true,
  });
  assert.match(html, /data-mobile-mode="true"/);
  assert.match(html, /--tepuy-color-bg: #abc;/);
  assert.doesNotMatch(html, /--bad/);
  assert.doesNotMatch(html, /<script/i);
});
