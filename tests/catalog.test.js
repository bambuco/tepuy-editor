/**
 * @file Tests for the shared control catalog and its Edit menu.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { CONTROL_GROUPS, allControls, controlLabel, editCategoryMenus } from '../src/ui/catalog.js';
import { messages, setEditorLocale } from '../src/i18n/messages.js';
import { viewSubmenus } from '../src/ui/menus.js';

test('every control has one Edit command and identifiers do not repeat', () => {
  const controls = allControls();
  const commandIds = controls.map((control) => control.commandId);
  assert.equal(new Set(commandIds).size, commandIds.length);

  const editMenus = editCategoryMenus();
  assert.equal(editMenus.some((group) => group.commandId), false);
  const editIds = editMenus.flatMap((group) => group.submenu.map((item) => item.commandId));
  assert.deepEqual(editIds, commandIds);
  for (const item of editMenus.flatMap((group) => group.submenu)) {
    assert.equal(typeof item.commandId, 'string');
    assert.equal(item.commandId.length > 0, true);
  }
});

test('blocks and activities stay in their groups', () => {
  const blocks = CONTROL_GROUPS.find((group) => group.id === 'blocks');
  const activities = CONTROL_GROUPS.find((group) => group.id === 'activities');
  const text = CONTROL_GROUPS.find((group) => group.id === 'text');
  const format = CONTROL_GROUPS.find((group) => group.id === 'format');
  const macro = CONTROL_GROUPS.find((group) => group.id === 'macro');
  assert.deepEqual(blocks.controls.map((control) => controlLabel(control)), [
    'Importante',
    'Ejemplo',
    'Nota',
    'Enlace',
    'Conexión',
    'Actividad',
  ]);
  assert.deepEqual(activities.controls.map((control) => controlLabel(control)), [
    'Quiz',
  ]);
  assert.equal(text.controls.some((control) => control.id === 'richtext'), true);
  assert.equal(text.controls.some((control) => control.id === 'htmlfree'), true);
  assert.equal(text.controls.some((control) => control.id === 'paragraph'), false);
  assert.equal(format.controls.map((control) => control.id).includes('tabs'), true);
  assert.equal(format.controls.some((control) => control.id === 'accordion'), false);
  assert.equal(macro.controls[0].id, 'modal');
});

test('View groups appearance and preview size as submenus', () => {
  const [appearance, preview] = viewSubmenus();
  assert.equal(appearance.label, 'Apariencia');
  assert.equal(appearance.commandId, undefined);
  assert.deepEqual(appearance.submenu.map((item) => item.label), [
    'Estructura',
    'Archivos',
    'Controles',
    'Comunes',
    'Auditoría',
    'Propiedades',
    'Vista previa',
  ]);
  assert.equal(preview.label, 'Vista previa');
  assert.equal(preview.commandId, undefined);
  assert.deepEqual(preview.submenu.map((item) => item.label), ['Automática', 'Escritorio', 'Móvil']);
  assert.equal(preview.submenu.every((item) => item.commandId), true);
});

test('File export labels group SCORM and HTML package', () => {
  assert.equal(messages.es['menu.file.export'], 'Exportar');
  assert.equal(messages.es['menu.file.export-scorm'], 'SCORM 1.2');
  assert.equal(messages.es['menu.file.export-html'], 'Paquete HTML');
  assert.equal(messages.es['menu.help.about'], 'Acerca de Tepuy');
});

test('menu strings follow the editor locale', () => {
  assert.deepEqual(Object.keys(messages.es).sort(), Object.keys(messages.en).sort());
  setEditorLocale('en');
  try {
    assert.equal(viewSubmenus()[0].label, 'Appearance');
    assert.equal(controlLabel({ id: 'important' }), 'Important');
  }
  finally {
    setEditorLocale('es');
  }
  assert.equal(viewSubmenus()[0].label, 'Apariencia');
});
