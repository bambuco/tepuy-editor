/**
 * @file Tests that canvas HTML stays out of the document until Apply.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from 'linkedom';
import { readPackageSettings, serializePackage } from '../src/core/package.js';
import {
  applyDraft,
  cancelDraft,
  currentDocument,
  currentInsertionPath,
  currentSettings,
  focusHtml,
  hasDraft,
  htmlFocusTarget,
  insertControl,
  setHtmlDraft,
} from '../src/ui/session.js';

globalThis.DOMParser = DOMParser;

test('an html draft stays out of the document until apply', () => {
  const before = serializePackage(currentDocument(), currentSettings(), {}, DOMParser);
  setHtmlDraft({ scope: 'settings', name: 'intro' }, '<p>Nuevo</p><script>bad</script>');
  assert.equal(hasDraft(), true);
  assert.equal(serializePackage(currentDocument(), currentSettings(), {}, DOMParser), before);
  assert.equal(insertControl('paragraph'), 'pending');
  assert.equal(applyDraft(), 'applied');
  assert.equal(hasDraft(), false);
  const saved = serializePackage(currentDocument(), currentSettings(), {}, DOMParser);
  assert.match(saved, /<p>Nuevo<\/p>/);
  assert.doesNotMatch(saved, /script/);
  setHtmlDraft({ scope: 'settings', name: 'intro' }, '<p>Otro</p>');
  assert.equal(cancelDraft(), true);
  assert.match(serializePackage(currentDocument(), currentSettings(), {}, DOMParser), /<p>Nuevo<\/p>/);
  assert.doesNotMatch(readPackageSettings(saved, DOMParser).intro, /script/);
  assert.ok(currentInsertionPath());
});

test('apply and cancel close an open html region without a draft', () => {
  assert.equal(focusHtml({ scope: 'settings', name: 'objective' }), 'focused');
  assert.equal(htmlFocusTarget()?.name, 'objective');
  assert.equal(hasDraft(), false);
  assert.equal(applyDraft(), 'applied');
  assert.equal(htmlFocusTarget(), null);
  assert.equal(focusHtml({ scope: 'settings', name: 'intro' }), 'focused');
  assert.equal(cancelDraft(), true);
  assert.equal(htmlFocusTarget(), null);
  assert.equal(cancelDraft(), false);
});
