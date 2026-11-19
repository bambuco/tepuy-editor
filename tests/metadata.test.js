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

test('content.html copies index metadata onto existing markers only', () => {
  const shell = `<!DOCTYPE html><html lang="es"><head>
    <meta charset="utf-8">
    <meta name="description" class="metadata" data-key="description" content="plantilla">
    <title>Tepuy</title>
    <link rel="stylesheet" href="theme.css">
  </head><body>
    <h1 class="hero metadata" data-key="title">Título del recurso</h1>
    <span class="metadata" data-key="title">Otro</span>
    <h2 class="metadata" data-key="topic">Paquete de contenidos</h2>
    <meta class="metadata" data-key="participation" name="audience">
    <span class="metadata" data-key="extra">Se queda</span>
    <main><section class="metadata" data-key="objective">En la página</section></main>
  </body></html>`;
  const main = parseContentHtml(shell, DOMParser);
  const saved = serializePackage(main, { title: 'Curso' }, {
    themeId: 'base',
    shell,
    metadata: {
      title: { value: 'Curso RED' },
      description: { value: '<p>Hola</p><script>x</script>' },
      objective: { value: '<p>Meta</p>' },
      duration: { value: '12', unit: 'hours' },
      participation: { value: 'group' },
      topic: { value: '' },
    },
  }, DOMParser);
  const doc = new DOMParser().parseFromString(saved, 'text/html');
  const titles = [...doc.querySelectorAll('[data-key="title"]')];
  assert.equal(titles.length, 2);
  assert.equal(titles.every((element) => element.textContent === 'Curso RED'), true);
  assert.equal(doc.querySelector('h1').classList.contains('hero'), true);
  assert.equal(doc.querySelector('[data-key="topic"]').textContent, '');
  assert.equal(doc.querySelector('title').textContent, 'Curso');
  assert.equal(doc.querySelector('head meta[data-key="description"]').getAttribute('content'), '<p>Hola</p>');
  assert.equal(doc.querySelector('head meta[data-key="description"]').getAttribute('name'), 'description');
  assert.equal(doc.querySelector('[data-key="objective"]').textContent, 'Meta');
  assert.match(doc.querySelector('[data-key="objective"]').innerHTML, /<p>Meta<\/p>/);
  const participation = doc.querySelector('meta[data-key="participation"]');
  assert.equal(participation.getAttribute('content'), 'Grupal');
  assert.equal(participation.getAttribute('data-value'), 'group');
  assert.equal(participation.getAttribute('name'), 'audience');
  assert.equal(doc.querySelector('[data-key="duration"]'), null);
  assert.equal(doc.querySelector('[data-key="extra"]').textContent, 'Se queda');
  assert.match(saved, /theme\.css/);
});

test('meta number markers and a metadata title keep index values', () => {
  const shell = `<!DOCTYPE html><html lang="es"><head>
    <meta class="metadata" data-key="duration" data-unit="minutes">
    <title class="metadata" data-key="title">Viejo</title>
  </head><body><main></main></body></html>`;
  const main = parseContentHtml(shell, DOMParser);
  const saved = serializePackage(main, { title: 'Ajustes' }, {
    shell,
    metadata: {
      title: { value: 'Curso RED' },
      duration: { value: '12', unit: 'hours' },
      participation: { value: 'group' },
    },
  }, DOMParser);
  const doc = new DOMParser().parseFromString(saved, 'text/html');
  const title = doc.querySelector('title');
  assert.equal(title.textContent, 'Curso RED');
  assert.equal(title.classList.contains('metadata'), true);
  assert.equal(title.getAttribute('data-key'), 'title');
  const duration = doc.querySelector('meta[data-key="duration"]');
  assert.equal(duration.getAttribute('content'), '12 Horas');
  assert.equal(duration.getAttribute('data-unit'), 'hours');
  assert.equal(doc.querySelector('[data-key="participation"]'), null);
  assert.doesNotMatch(saved, /Ajustes/);
});

test('unknown metadata keys resolve as rich', () => {
  assert.equal(resolveMetadataKind('title'), 'text');
  assert.equal(resolveMetadataKind('activityTitle'), 'rich');
});

test('catalog has no presentation group', () => {
  assert.equal(CONTROL_GROUPS.some((group) => group.id === 'presentation'), false);
});
