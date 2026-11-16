/**
 * @file Tests for the test host client and the package log boundary.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { DOMParser } from 'linkedom';
import { filterLog, HostError, createHostClient } from '../src/core/host.js';
import { readPackageSettings, readPackageTheme, serializePackage } from '../src/core/package.js';
import { parseContentHtml } from '../src/core/parser.js';
import { SAMPLE_CONTENT } from '../src/sample-content.js';

globalThis.DOMParser = DOMParser;

const root = fileURLToPath(new URL('..', import.meta.url));

test('package store rejects traversal, conflicts, and log leakage', () => {
  const result = spawnSync('php', ['host/tests/store-test.php'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('saved package keeps its theme and leaves the log outside the document', () => {
  const main = parseContentHtml(SAMPLE_CONTENT, DOMParser);
  const settings = readPackageSettings(SAMPLE_CONTENT, DOMParser);
  const saved = serializePackage(main, settings, { themeId: 'rutatic', themeVersion: '1.0.0', format: '2.0' }, DOMParser);
  assert.match(saved, /name="tepuy-theme" content="rutatic@1.0.0"/);
  assert.match(saved, /nav class="globals"/);
  assert.equal(readPackageTheme(saved, DOMParser), 'rutatic');
  assert.equal(serializePackage(main, settings, {}, DOMParser).includes('tepuy-theme'), false);
  const again = serializePackage(
    parseContentHtml(saved, DOMParser),
    readPackageSettings(saved, DOMParser),
    { themeId: 'rutatic', themeVersion: '1.0.0', format: '2.0' },
    DOMParser,
  );
  assert.equal(again, saved);
  assert.equal(saved.includes('secret-log-line'), false);
});

test('log filters by user, operation, and date', () => {
  const entries = [
    { timestamp: '2026-11-01T10:00:00+00:00', user: { id: 'dev', name: 'Desarrollo' }, operation: 'save', summary: 'uno' },
    { timestamp: '2026-11-14T10:00:00+00:00', user: { id: 'ana', name: 'Ana' }, operation: 'add', summary: 'dos' },
  ];
  assert.equal(filterLog(entries, { operation: 'save' }).length, 1);
  assert.equal(filterLog(entries, { user: 'ana' })[0].summary, 'dos');
  assert.equal(filterLog(entries, { from: '2026-11-14', to: '2026-11-14' }).length, 1);
});

test('host client reports a revision conflict', async () => {
  const client = createHostClient({
    url: 'http://localhost/api/index.php',
    token: 'tepuy-dev',
    fetchImpl: async (url, options) => {
      assert.equal(options.headers['X-Tepuy-Token'], 'tepuy-dev');
      assert.equal(new URL(url).searchParams.get('action'), 'commit');
      return new Response(JSON.stringify({ error: 'conflict', message: 'Revision mismatch.' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  await assert.rejects(
    () => client.commit('paquete', [], '0'),
    (error) => error instanceof HostError && error.code === 'conflict',
  );
});
