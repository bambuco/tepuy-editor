/**
 * @file Tests for educational metadata in index.html.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from 'linkedom';
import { serializePackage } from '../src/core/package.js';
import { themeIndexTemplate } from '../src/core/themes.js';
import { parseContentHtml } from '../src/core/parser.js';
import {
  listMetadataNodes,
  migrateToMetadataIndex,
  parseIndexHtml,
  readMetadata,
  serializeIndexDocument,
  serializePresentation,
  writeMetadataValue,
} from '../src/metadata/index-document.js';
import { BASE_METADATA, resolveMetadataKind } from '../src/metadata/schema.js';
import { SAMPLE_CONTENT } from '../src/sample-content.js';
import { CONTROL_GROUPS } from '../src/ui/catalog.js';

globalThis.DOMParser = DOMParser;

globalThis.DOMParser = DOMParser;

test('metadata round-trips through write and parse', () => {
  const index = parseIndexHtml(themeIndexTemplate('base'));
  writeMetadataValue(index.body, 'title', 'Curso RED', undefined, DOMParser);
  writeMetadataValue(index.body, 'description', '<p>Hola</p><script>x</script>', undefined, DOMParser);
  writeMetadataValue(index.body, 'duration', '12', 'hours', DOMParser);
  writeMetadataValue(index.body, 'participation', 'group', undefined, DOMParser);
  const html = serializeIndexDocument(index);
  const again = parseIndexHtml(html);
  const values = readMetadata(again.body);
  assert.equal(values.title.value, 'Curso RED');
  assert.equal(values.description.value, '<p>Hola</p>');
  assert.equal(values.duration.value, '12');
  assert.equal(values.duration.unit, 'hours');
  assert.equal(values.participation.value, 'group');
  assert.match(html, /class="metadata"/);
  assert.match(html, /data-key="title"/);
  assert.match(html, /data-unit="hours"/);
  assert.match(html, /data-value="group"/);
  assert.match(html, /12 Horas/);
  assert.match(html, /Grupal/);
  const marker = listMetadataNodes(again.body).find((item) => item.key === 'participation');
  delete marker.node.attrs['data-value'];
  marker.node.children = [{ type: 'text', text: 'group' }];
  assert.equal(readMetadata(again.body).participation.value, 'group');
});

test('empty related labels are omitted from the presentation', () => {
  const index = parseIndexHtml(themeIndexTemplate('base'));
  const empty = serializePresentation(index);
  assert.doesNotMatch(empty, /data-relatedto="objective"/);
  assert.doesNotMatch(empty, /data-relatedto="duration"/);
  assert.match(empty, /Detalles/);
  assert.match(serializeIndexDocument(index), /data-relatedto="objective"/);
  assert.match(serializeIndexDocument(index), /data-relatedto="duration"/);

  writeMetadataValue(index.body, 'objective', '<p></p>', undefined, DOMParser);
  assert.doesNotMatch(serializePresentation(index), /data-relatedto="objective"/);

  writeMetadataValue(index.body, 'objective', '<p>Meta</p>', undefined, DOMParser);
  writeMetadataValue(index.body, 'duration', '12', 'hours', DOMParser);
  const filled = serializePresentation(index);
  assert.match(filled, /data-relatedto="objective"/);
  assert.match(filled, /data-relatedto="duration"/);
  assert.match(filled, /12 Horas/);
  assert.match(filled, /Meta/);
  assert.match(serializeIndexDocument(index), /data-relatedto="participation"/);
  assert.doesNotMatch(filled, /data-relatedto="participation"/);
});

test('legacy presentation migrates into metadata markers', () => {
  const legacy = `<!DOCTYPE html><html lang="es"><body>
<header class="tpy-presentation" data-autoload="false" data-display-window="modal">
  <h1><span class="level">Básico</span> Curso</h1>
  <h2>Actividad uno</h2>
  <section class="tpy-intro"><p>Intro</p></section>
  <section class="tpy-objective"><p>Meta</p></section>
  <p class="tpy-duration">3 horas</p>
</header>
<main><section id="pag-a" ptitle="A"></section></main>
</body></html>`;
  const index = migrateToMetadataIndex(
    themeIndexTemplate('base'),
    { themeId: 'base', themeVersion: '1.0.0' },
    legacy,
    {},
    DOMParser,
  );
  const values = readMetadata(index.body);
  assert.equal(values.title.value, 'Curso');
  assert.match(values.description.value, /Intro/);
  assert.match(values.objective.value, /Meta/);
  assert.equal(values.duration.value, '3');
  assert.equal(values.duration.unit, 'hours');
  assert.equal(values.level?.value, 'Básico');
  assert.equal(values.activityTitle?.value, 'Actividad uno');
  assert.equal(index.bodyAttrs['data-display-window'], 'modal');
  const keys = listMetadataNodes(index.body).map((item) => item.key);
  for (const field of BASE_METADATA) {
    assert.equal(keys.includes(field.id), true);
  }
});

test('content.html no longer embeds presentation markup', () => {
  const main = parseContentHtml(SAMPLE_CONTENT, DOMParser);
  const saved = serializePackage(main, { title: 'Curso' }, { themeId: 'base' }, DOMParser);
  assert.doesNotMatch(saved, /tpy-presentation/);
  assert.doesNotMatch(saved, /tpy-intro/);
  assert.doesNotMatch(saved, /play_scorm/);
  assert.match(saved, /id="tpy-measuring_progress"/);
});

test('unknown metadata keys resolve as rich', () => {
  assert.equal(resolveMetadataKind('title'), 'text');
  assert.equal(resolveMetadataKind('activityTitle'), 'rich');
});

test('catalog has no presentation group', () => {
  assert.equal(CONTROL_GROUPS.some((group) => group.id === 'presentation'), false);
});
