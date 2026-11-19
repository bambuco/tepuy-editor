/**
 * @file Package language catalogs, overrides, and the settings selector.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from 'linkedom';
import { buildPreviewHtml } from '../src/core/preview.js';
import { packageSettings, serializePackage, settingsFields } from '../src/core/package.js';
import { parseContentHtml } from '../src/core/parser.js';
import { serializeIndexDocument } from '../src/metadata/index-document.js';
import {
  applyDraft,
  applyLangOverrides,
  cancelDraft,
  currentIndexDocument,
  currentPackageManifest,
  currentSettings,
  customValue,
  draftKind,
  rememberCustom,
  setLangDraft,
  setSettingsDraft,
  subscribePreview,
} from '../src/ui/session.js';
import {
  DEFAULT_LANGUAGE,
  baseStrings,
  diffOverrides,
  languageCodes,
  languageFiles,
  migrateLegacyLanguage,
  parseOverrides,
  serializeBase,
  serializeOverrides,
} from '../src/tepuy/lang/index.js';

globalThis.DOMParser = DOMParser;

test('registered languages are the only accepted package languages', () => {
  assert.deepEqual(languageCodes(), ['es', 'en']);
  assert.equal(DEFAULT_LANGUAGE, 'es');
  assert.equal(packageSettings({ lang: 'fr' }, true), null);
  assert.equal(packageSettings({ lang: 'en' }).lang, 'en');
  assert.equal(packageSettings({}).lang, 'es');
  const field = settingsFields(packageSettings({})).find((item) => item.name === 'lang');
  assert.deepEqual(field.options, languageCodes());
});

test('override files keep only the keys that differ and stay stable', () => {
  const overrides = diffOverrides(baseStrings('es'), {
    accept: 'Vale',
    save: 'Guardar',
    progress: 'Avance',
  });
  assert.deepEqual(overrides, { accept: 'Vale' });
  const source = serializeOverrides(overrides);
  const parsed = parseOverrides(source);
  assert.equal(parsed.ok, true);
  assert.equal(serializeOverrides(parsed.overrides), source);
  assert.equal(parseOverrides('var broken = 1;').ok, false);
  assert.match(serializeBase('en'), /dhbgApp\.strings = \{/);
  assert.match(serializeBase('en'), /'accept': 'Accept'/);
});

test('a legacy language file becomes custom overrides for the active catalog', () => {
  const legacy = serializeBase('es').replace("'Aceptar'", "'Vale'");
  const migrated = migrateLegacyLanguage({
    htmlLang: '',
    scriptSrc: 'js/lang.es.js',
    legacyBase: legacy,
  });
  assert.equal(migrated.lang, 'es');
  assert.deepEqual(migrated.migratedKeys, ['accept']);
  assert.match(migrated.source, /Object\.assign\(dhbgApp\.strings/);
  assert.equal(migrateLegacyLanguage({ scriptSrc: 'js/lang.en.js' }).lang, 'en');
  const broken = migrateLegacyLanguage({ htmlLang: 'es', legacyCustom: 'not javascript' });
  assert.equal(broken.unreadable, true);
  assert.equal(broken.source, '');
});

test('language files include the active catalog and drop the unused one', () => {
  const active = languageFiles('es', { accept: 'Vale' });
  assert.deepEqual(active.files.map((file) => file.path), ['tepuy/lang.es.js', 'custom/lang.js']);
  assert.deepEqual(active.remove, ['tepuy/lang.en.js']);
  const both = languageFiles('en', {}, { includeUnused: true });
  assert.deepEqual(both.files.map((file) => file.path), ['tepuy/lang.es.js', 'tepuy/lang.en.js']);
  assert.deepEqual(both.remove, []);
  assert.equal(languageFiles('fr'), null);
});

test('preview loads the base catalog before custom overrides', () => {
  const html = buildPreviewHtml({
    settings: { lang: 'en' },
    customLang: serializeOverrides({ accept: 'Vale' }),
  });
  const baseAt = html.indexOf('dhbgApp.strings =');
  const customAt = html.indexOf('Object.assign(dhbgApp.strings');
  assert.ok(baseAt >= 0 && customAt > baseAt);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /'accept': 'Vale'/);
});

test('language text stays out of the package until apply', () => {
  rememberCustom('custom/lang.js', '');
  let hits = 0;
  const stop = subscribePreview(() => {
    hits += 1;
  });
  assert.equal(setLangDraft({ mode: 'table', cells: { accept: 'Vale' } }), true);
  assert.equal(customValue('custom/lang.js'), '');
  assert.equal(draftKind(), 'lang');
  assert.equal(hits, 0);
  assert.equal(cancelDraft(), true);
  assert.equal(draftKind(), null);
  assert.equal(setLangDraft({ mode: 'table', cells: { accept: 'Vale' } }), true);
  assert.equal(applyDraft(), 'applied');
  assert.match(customValue('custom/lang.js'), /'accept': 'Vale'/);
  assert.equal(hits, 1);
  assert.equal(draftKind(), null);
  stop();
});

test('applying the language keeps custom text and writes it on both documents', () => {
  rememberCustom('custom/lang.js', '');
  applyLangOverrides({ accept: 'Accept', save: 'Vale' });
  assert.match(customValue('custom/lang.js'), /'accept': 'Accept'/);
  assert.match(customValue('custom/lang.js'), /'save': 'Vale'/);
  setSettingsDraft({ ...currentSettings(), lang: 'en' });
  assert.equal(applyDraft(), 'applied');
  assert.equal(currentSettings().lang, 'en');
  assert.equal(currentIndexDocument().lang, 'en');
  assert.doesNotMatch(customValue('custom/lang.js'), /'accept'/);
  assert.match(customValue('custom/lang.js'), /'save': 'Vale'/);
  const html = serializePackage(parseContentHtml('<main></main>', DOMParser), currentSettings(), {}, DOMParser);
  assert.match(html, /<html lang="en">/);
  assert.match(serializeIndexDocument(currentIndexDocument()), /<html lang="en">/);
  assert.match(currentPackageManifest(), /<language>en<\/language>/);
  setSettingsDraft({ ...currentSettings(), lang: 'fr' });
  assert.equal(applyDraft(), 'invalid');
  assert.equal(cancelDraft(), true);
  setSettingsDraft({ ...currentSettings(), lang: 'es' });
  assert.equal(applyDraft(), 'applied');
});
