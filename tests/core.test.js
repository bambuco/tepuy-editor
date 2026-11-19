/**
 * @file Tests for identifiers, content round-trip, history, and SCORM.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from 'linkedom';
import { slugify, uniqueId } from '../src/core/ids.js';
import { parseContentHtml } from '../src/core/parser.js';
import { serializeContent } from '../src/core/serializer.js';
import { createDocumentHistory } from '../src/core/history.js';
import { lessonStatusForProgress, MASTERY_SCORE, packageProgress, readLessonStatus } from '../src/tepuy/scorm/progress.js';
import { buildScorm12Manifest } from '../src/tepuy/scorm/manifest.js';
import { SAMPLE_CONTENT } from '../src/sample-content.js';

const html = `<main>
  <section ptitle="Introducción" id="pag-introduccion">
    <div data-title="Inicio" class="subpage">
      <h3>Inicio</h3>
      <p>Texto &amp; más</p>
      <!-- nota -->
      <div label="Importante" class="box-text important">
        <p>Una idea</p>
      </div>
      <img alt="Foto" src="content/foto.png">
      <span data-extra="1">Libre</span>
    </div>
  </section>
</main>`;

test('slugify strips accents, spaces and symbols', () => {
  assert.equal(slugify('Introducción'), 'introduccion');
  assert.equal(slugify('Quiz conceptos!'), 'quiz-conceptos');
});

test('uniqueId adds a suffix only on collision', () => {
  const existing = new Set();
  assert.equal(uniqueId('pag', 'Introducción', existing), 'pag-introduccion');
  existing.add('pag-introduccion');
  assert.equal(uniqueId('pag', 'Introducción', existing, () => 'k3f'), 'pag-introduccion-k3f');
});

test('content round-trip keeps types, attributes, comments and unknown nodes', () => {
  const first = parseContentHtml(`<!DOCTYPE html><html><body>${html}</body></html>`, DOMParser);
  const serialized = serializeContent(first);
  const second = parseContentHtml(`<!DOCTYPE html><html><body>${serialized}</body></html>`, DOMParser);
  assert.deepEqual(second, first);
  assert.equal(serializeContent(second), serialized);
  assert.equal(first.children[0].type, 'page');
  assert.equal(first.children[0].children[0].type, 'subpage');
  assert.match(serialized, /class="box-text important"/);
  assert.match(serialized, /<!-- nota -->/);
  assert.match(serialized, /<span data-extra="1">/);
});

test('sample package exposes its pages', () => {
  const main = parseContentHtml(SAMPLE_CONTENT, DOMParser);
  const pages = main.children.filter((node) => node.type === 'page');
  assert.deepEqual(pages.map((page) => page.attrs.ptitle), ['Introducción', 'Actividades']);
});

test('history restores committed snapshots', () => {
  const history = createDocumentHistory({ title: 'uno' });
  history.commit({ title: 'dos' });
  assert.equal(history.undo(), true);
  assert.equal(history.current().title, 'uno');
  assert.equal(history.redo(), true);
  assert.equal(history.current().title, 'dos');
  history.commit({ title: 'tres' });
  history.undo();
  history.commit({ title: 'cuatro' });
  assert.equal(history.redo(), false);
});

test('package progress weights activities and completes only at 100', () => {
  assert.equal(packageProgress({ pagesVisited: 1, pagesTotal: 2, activityScores: [], activitiesPercentage: 60 }), 50);
  assert.equal(packageProgress({
    pagesVisited: 2,
    pagesTotal: 2,
    activityScores: [100, 100],
    activitiesPercentage: 60,
  }), 100);
  assert.equal(lessonStatusForProgress(99), 'incomplete');
  assert.equal(lessonStatusForProgress(100), 'completed');
  assert.equal(MASTERY_SCORE, 100);
});

test('legacy complete is read as completed and new status is never complete', () => {
  assert.equal(readLessonStatus('complete'), 'completed');
  assert.equal(readLessonStatus('completed'), 'completed');
  assert.equal(readLessonStatus('incomplete'), 'incomplete');
  assert.equal(readLessonStatus('not attempted'), null);
});

test('SCORM 1.2 manifest has one SCO, mastery 100, and no 1.3 namespaces', () => {
  const xml = buildScorm12Manifest({ identifier: 'PKG-1', title: 'Curso <A>', description: 'Desc', language: 'es' });
  assert.match(xml, /adlcp_rootv1p2/);
  assert.doesNotMatch(xml, /imsss|adlcp_v1p3|adlseq|adlnav/);
  assert.match(xml, /<adlcp:masteryscore>100<\/adlcp:masteryscore>/);
  assert.match(xml, /href="index.html"/);
  assert.match(xml, /Curso &lt;A&gt;/);
  assert.equal(xml.match(/adlcp:scormtype="sco"/g).length, 1);
});
