/**
 * @file File, Edit, View, and context menus for the Tepuy shell.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { confirmDialog, openDialog } from '../../vendor/edy/src/ui/controls.js';
import { t } from '../i18n/messages.js';
import { nodeAt } from '../core/edit.js';
import { readPackageSettings } from '../core/package.js';
import { applyTheme, findTheme, presentPositions, readThemeLayout, THEMES, themeChangeReport } from '../core/themes.js';
import { hasNestedControls } from '../controls/library.js';
import { SAMPLE_CONTENT } from '../sample-content.js';
import { allControls, editCategoryMenus, insertionNotice } from './catalog.js';
import {
  applyDraft,
  cancelDraft,
  createHostPackage,
  currentDocument,
  currentEditor,
  currentPackageRef,
  currentSelection,
  currentSelectionPath,
  currentThemeId,
  deleteSelection,
  duplicateSelection,
  hasDraft,
  hasUnsavedChanges,
  insertControl,
  buildIndexForTheme,
  openHostPackage,
  openPackageSettings,
  recordOperation,
  redoDocument,
  refreshPackages,
  replaceDocument,
  sampleDocument,
  saveToHost,
  setPackageView,
  setPreviewMode,
  undoDocument,
} from './session.js';

/** @type {Array<{id: string, labelKey: string, location: 'primary'|'secondary'|'preview'}>} */
export const APPEARANCE_PANELS = [
  { id: 'structure', labelKey: 'menu.view.structure', location: 'primary' },
  { id: 'files', labelKey: 'menu.view.files', location: 'primary' },
  { id: 'controls', labelKey: 'menu.view.controls', location: 'primary' },
  { id: 'common', labelKey: 'menu.view.common', location: 'primary' },
  { id: 'audit', labelKey: 'menu.view.audit', location: 'primary' },
  { id: 'properties', labelKey: 'menu.view.properties', location: 'secondary' },
  { id: 'preview', labelKey: 'menu.view.preview', location: 'preview' },
];

/** @type {Array<{id: string, labelKey: string, mode: 'auto'|'desktop'|'mobile', width: number, height: number}>} */
export const PREVIEW_MODES = [
  { id: 'preview-auto', labelKey: 'menu.view.preview.auto', mode: 'auto', width: 1024, height: 768 },
  { id: 'preview-desktop', labelKey: 'menu.view.preview.desktop', mode: 'desktop', width: 1280, height: 800 },
  { id: 'preview-mobile', labelKey: 'menu.view.preview.mobile', mode: 'mobile', width: 390, height: 844 },
];

/**
 * @returns {Array<{id: string, label: string, submenu: Array}>} View submenus without a parent command.
 */
export function viewSubmenus() {
  return [
    {
      id: 'appearance',
      label: t('menu.view.appearance'),
      submenu: APPEARANCE_PANELS.map((panel, index) => ({
        id: panel.id,
        label: t(panel.labelKey),
        commandId: `view.panel.${panel.id}`,
        order: (index + 1) * 10,
      })),
    },
    {
      id: 'preview-size',
      label: t('menu.view.preview'),
      submenu: PREVIEW_MODES.map((mode, index) => ({
        id: mode.id,
        label: t(mode.labelKey),
        commandId: `view.preview.${mode.mode}`,
        order: (index + 1) * 10,
      })),
    },
  ];
}

/**
 * @param {Object} context Edy extension context.
 * @param {string} id Command identifier.
 * @param {string} label Command label.
 * @param {Function} execute Command action.
 * @returns {void}
 */
function registerCommand(context, id, label, execute) {
  context.commands.register(id, { label, execute });
}

/**
 * @param {Object} context Edy extension context.
 * @param {string} message Notice for an action that belongs to a later phase.
 * @returns {Function} Command action.
 */
function later(context, message) {
  return () => context.notifications.info(message);
}

/**
 * @param {string} location Surface location.
 * @param {string} activeField Workbench field that stores the active view.
 * @param {Object} workbench Edy workbench.
 * @returns {string|null} View currently shown in that surface.
 */
function shownView(location, activeField, workbench) {
  const views = workbench.instance.views.entries().filter(([, view]) => view.location === location);
  const active = workbench[activeField];
  return views.find(([id]) => id === active)?.[0] ?? views[0]?.[0] ?? null;
}

/**
 * Opens a shell surface, or closes it when that surface is already showing it.
 * @param {string} viewId Extension-local view identifier.
 * @param {'primary'|'secondary'|'preview'} location Surface location.
 * @returns {void}
 */
function toggleSurface(extensionId, viewId, location) {
  const editor = currentEditor();
  const workbench = editor?.workbench;
  if (!workbench) {
    return;
  }
  const id = `${extensionId}:${viewId}`;
  if (location === 'primary') {
    if (workbench.primaryVisible && workbench.selectedPrimaryView() === id) {
      workbench.primaryVisible = false;
      workbench.updateLayout();
      return;
    }
  }
  else if (location === 'secondary') {
    if (workbench.secondaryVisible && shownView('secondary', 'activeSecondary', workbench) === id) {
      workbench.secondaryVisible = false;
      workbench.updateLayout();
      return;
    }
  }
  else if (workbench.previewVisible && shownView('preview', 'activePreview', workbench) === id) {
    workbench.previewVisible = false;
    workbench.render();
    return;
  }
  workbench.openView(id);
}

/**
 * Applies the selected preview frame and shows the preview surface.
 * @param {'auto'|'desktop'|'mobile'} mode Preview frame size.
 * @returns {void}
 */
function applyPreviewFrame(extensionId, mode) {
  const editor = currentEditor();
  const workbench = editor?.workbench;
  const preset = PREVIEW_MODES.find((item) => item.mode === mode);
  if (!workbench || !preset) {
    return;
  }
  const view = editor.views.get(`${extensionId}:preview`);
  const size = { width: preset.width, height: preset.height, scale: 'auto' };
  const state = view ? workbench.previewStates.get(view) : null;
  if (view && state) {
    Object.assign(state, size);
  }
  else if (view) {
    workbench.previewStates.set(view, { ...size });
  }
  setPreviewMode(mode);
  if (workbench.previewVisible) {
    workbench.render();
  }
  else {
    workbench.openView(`${extensionId}:preview`);
  }
}

/**
 * @param {string} extensionId Extension identifier.
 * @param {string} menuId Menu identifier.
 * @param {string} itemId Item identifier.
 * @returns {Object|undefined} Registered menu entry.
 */
function menuEntry(extensionId, menuId, itemId) {
  return currentEditor()?.menus.get(`${extensionId}:${menuId}:${itemId}`);
}

/**
 * @param {Object[]} items Registered menu rows.
 * @param {string} activeId Row identifier that stays checked.
 * @param {Object} context Edy extension context.
 * @returns {void}
 */
function markActive(items, activeId, context) {
  for (const item of items) {
    if (!item) {
      continue;
    }
    const plain = item.label.replace(/ ✓$/, '');
    item.label = item.id === activeId ? `${plain} ✓` : plain;
  }
  context.commands.refresh();
}

/**
 * @param {Object} context Edy extension context.
 * @returns {void}
 */
function syncThemeMenu(context) {
  markActive(menuEntry(context.extensionId, 'view', 'theme')?.submenu ?? [], currentThemeId(), context);
}

/**
 * Registers commands and the Tepuy menus.
 * @param {Object} context Edy extension context.
 * @returns {void}
 */
export function registerMenus(context) {
  registerCommand(context, 'file.new', t('menu.file.new'), async () => {
    try {
      const created = await createHostPackage('Paquete');
      syncThemeMenu(context);
      context.notifications.success(t('menu.notice.created', { name: created.name }));
    }
    catch (error) {
      context.notifications.error(error, t('menu.notice.host-error'));
    }
  });
  registerCommand(context, 'file.open', t('menu.file.open'), async () => {
    try {
      await refreshPackages();
    }
    catch (error) {
      context.notifications.error(error, t('menu.notice.host-error'));
      return;
    }
    currentEditor()?.workbench.openView(`${context.extensionId}:files`);
  });
  registerCommand(context, 'file.save', t('menu.file.save'), async () => {
    try {
      const result = await saveToHost();
      if (result === 'draft') {
        context.notifications.info(t('menu.notice.save-draft'));
        return;
      }
      if (result === 'conflict') {
        context.notifications.info(t('menu.notice.conflict'));
        return;
      }
      context.notifications.success(t(result === 'unchanged' ? 'menu.notice.saved-unchanged' : 'menu.notice.saved'));
    }
    catch (error) {
      context.notifications.error(error, t('menu.notice.host-error'));
    }
  });
  registerCommand(context, 'file.reload', t('menu.file.reload'), async () => {
    try {
      if (currentPackageRef()) {
        const opened = await openHostPackage(currentPackageRef());
        syncThemeMenu(context);
        context.notifications.success(t('menu.notice.opened', { name: opened.name }));
        return;
      }
      replaceDocument(sampleDocument(), 'base', { markSaved: true, settings: readPackageSettings(SAMPLE_CONTENT) });
      syncThemeMenu(context);
      context.notifications.success(t('menu.notice.reload'));
    }
    catch (error) {
      context.notifications.error(error, t('menu.notice.host-error'));
    }
  });
  registerCommand(context, 'file.import', t('menu.file.import'), later(context, t('menu.notice.import')));
  registerCommand(context, 'file.export-scorm', t('menu.file.export-scorm'), later(context, t('menu.notice.export-scorm')));
  registerCommand(context, 'file.export-html', t('menu.file.export-html'), later(context, t('menu.notice.export-html')));
  registerCommand(context, 'help.about', t('menu.help.about'), () => {
    const body = document.createElement('div');
    body.className = 'tepuy-about';
    const editor = document.createElement('p');
    editor.textContent = t('menu.help.about-editor');
    const template = document.createElement('p');
    template.textContent = t('menu.help.about-template');
    body.append(editor, template);
    openDialog({
      title: t('menu.help.about'),
      content: body,
      closeLabel: t('dialog.close'),
      container: currentEditor()?.shadow ?? document.body,
    });
  });

  registerCommand(context, 'edit.undo', t('menu.edit.undo'), () => {
    if (!undoDocument()) {
      context.notifications.info(t('menu.notice.undo-empty'));
      return;
    }
    syncThemeMenu(context);
  });
  registerCommand(context, 'edit.redo', t('menu.edit.redo'), () => {
    if (!redoDocument()) {
      context.notifications.info(t('menu.notice.redo-empty'));
      return;
    }
    syncThemeMenu(context);
  });
  registerCommand(context, 'edit.apply', t('menu.edit.apply'), () => {
    const result = applyDraft();
    if (result === 'invalid') {
      context.notifications.info(t('menu.notice.invalid'));
      return;
    }
    if (result !== 'applied') {
      context.notifications.info(t('menu.notice.apply-empty'));
      return;
    }
    context.notifications.success(t('menu.notice.applied'));
  });
  registerCommand(context, 'edit.cancel', t('menu.edit.cancel'), () => {
    if (!cancelDraft()) {
      context.notifications.info(t('menu.notice.cancel-empty'));
      return;
    }
    context.notifications.success(t('menu.notice.cancelled'));
  });
  registerCommand(context, 'edit.duplicate', t('menu.edit.duplicate'), () => {
    if (hasDraft()) {
      context.notifications.info(t('menu.notice.pending'));
      return;
    }
    if (!duplicateSelection()) {
      context.notifications.info(t('menu.notice.duplicate-empty'));
      return;
    }
    void recordOperation('duplicate', currentSelection() || '', t('menu.notice.duplicate'));
    context.notifications.success(t('menu.notice.duplicate'));
  });
  registerCommand(context, 'edit.delete', t('menu.edit.delete'), async () => {
    if (hasDraft()) {
      context.notifications.info(t('menu.notice.pending'));
      return;
    }
    const path = currentSelectionPath();
    const node = path ? nodeAt(currentDocument(), path) : null;
    if (node && hasNestedControls(node)) {
      const accepted = await confirmDialog({
        title: t('canvas.delete-title'),
        message: t('canvas.delete-confirm'),
        confirmLabel: t('canvas.delete'),
        cancelLabel: t('menu.edit.cancel'),
        container: currentEditor()?.shadow,
      });
      if (!accepted) {
        return;
      }
    }
    if (!deleteSelection()) {
      context.notifications.info(t('menu.notice.delete-empty'));
      return;
    }
    void recordOperation('delete', '', t('menu.notice.delete'));
    context.notifications.success(t('menu.notice.delete'));
  });

  for (const control of allControls()) {
    if (control.phase !== 'F4') {
      registerCommand(context, control.commandId, control.label, later(context, insertionNotice(control)));
      continue;
    }
    registerCommand(context, control.commandId, control.label, () => {
      const result = insertControl(control.id);
      if (result === 'pending') {
        context.notifications.info(t('menu.notice.pending'));
        return;
      }
      if (result === 'nowhere') {
        context.notifications.info(t('menu.notice.insert-nowhere'));
        return;
      }
      if (result === 'inserted') {
        context.views.open('content-html');
        void recordOperation('add', control.id, control.label);
      }
      context.notifications.success(t('menu.notice.inserted', { label: control.label }));
    });
  }

  for (const panel of APPEARANCE_PANELS) {
    registerCommand(context, `view.panel.${panel.id}`, t(panel.labelKey), () => {
      toggleSurface(context.extensionId, panel.id, panel.location);
    });
  }
  for (const mode of PREVIEW_MODES) {
    registerCommand(context, `view.preview.${mode.mode}`, t(mode.labelKey), () => {
      applyPreviewFrame(context.extensionId, mode.mode);
      markActive(menuEntry(context.extensionId, 'view', 'preview-size')?.submenu ?? [], mode.id, context);
    });
  }
  registerCommand(context, 'view.presentation', t('menu.view.presentation'), () => {
    setPackageView('presentation');
    context.views.open('index-html');
    markActive([
      menuEntry(context.extensionId, 'view', 'presentation'),
      menuEntry(context.extensionId, 'view', 'content'),
    ], 'presentation', context);
    context.notifications.success(t('menu.notice.presentation'));
  });
  registerCommand(context, 'view.content', t('menu.view.content'), () => {
    setPackageView('content');
    context.views.open('content-html');
    markActive([
      menuEntry(context.extensionId, 'view', 'presentation'),
      menuEntry(context.extensionId, 'view', 'content'),
    ], 'content', context);
    context.notifications.success(t('menu.notice.content'));
  });
  for (const theme of THEMES) {
    registerCommand(context, `view.theme.${theme.id}`, theme.name, async () => {
      if (hasUnsavedChanges()) {
        context.notifications.info(t('menu.notice.theme-dirty'));
        return;
      }
      if (currentThemeId() === theme.id) {
        context.notifications.info(t('menu.notice.theme-active', { name: theme.name }));
        return;
      }
      const from = findTheme(currentThemeId());
      const layout = await readThemeLayout(theme.id);
      const absent = theme.positions.filter((position) => !presentPositions(layout, theme.positions).includes(position));
      const report = from ? themeChangeReport(from, theme) : { missingPositions: [], changedVariables: [] };
      const missing = [...new Set([...report.missingPositions, ...absent])];
      replaceDocument(applyTheme(currentDocument()), theme.id, {
        index: buildIndexForTheme(theme.id),
      });
      void recordOperation('theme', theme.id, theme.name);
      syncThemeMenu(context);
      const gaps = missing.length ? t('menu.notice.theme-missing', { positions: missing.join(', ') }) : '';
      const variables = report.changedVariables.length
        ? t('menu.notice.theme-variables', { count: report.changedVariables.length })
        : '';
      context.notifications.success(t('menu.notice.theme', { name: theme.name, gaps, variables }));
    });
  }
  registerCommand(context, 'view.settings', t('menu.view.settings'), () => {
    openPackageSettings();
  });

  const fileItems = [
    ['new', 'menu.file.new', 'file.new', 10],
    ['open', 'menu.file.open', 'file.open', 20],
    ['save', 'menu.file.save', 'file.save', 30],
    ['reload', 'menu.file.reload', 'file.reload', 40],
    ['import', 'menu.file.import', 'file.import', 50],
  ];
  for (const [id, labelKey, commandId, order] of fileItems) {
    context.menus.register('file', { id, label: t(labelKey), commandId, order });
  }
  context.menus.register('file', {
    id: 'export',
    label: t('menu.file.export'),
    order: 60,
    submenu: [
      { id: 'export-scorm', label: t('menu.file.export-scorm'), commandId: 'file.export-scorm', order: 10 },
      { id: 'export-html', label: t('menu.file.export-html'), commandId: 'file.export-html', order: 20 },
    ],
  });

  context.menus.register('edit', { id: 'undo', label: t('menu.edit.undo'), commandId: 'edit.undo', shortcut: 'Ctrl+Z', order: 10 });
  context.menus.register('edit', { id: 'redo', label: t('menu.edit.redo'), commandId: 'edit.redo', shortcut: 'Ctrl+Y', order: 20 });
  context.menus.register('edit', { id: 'apply', label: t('menu.edit.apply'), commandId: 'edit.apply', order: 30 });
  context.menus.register('edit', { id: 'cancel', label: t('menu.edit.cancel'), commandId: 'edit.cancel', order: 40 });
  context.menus.register('edit', { id: 'duplicate', label: t('menu.edit.duplicate'), commandId: 'edit.duplicate', order: 50 });
  context.menus.register('edit', { id: 'delete', label: t('menu.edit.delete'), commandId: 'edit.delete', order: 60 });
  for (const group of editCategoryMenus()) {
    context.menus.register('edit', group);
  }

  const appearance = viewSubmenus()[0];
  const preview = viewSubmenus()[1];
  preview.submenu[0] = { ...preview.submenu[0], label: `${t('menu.view.preview.auto')} ✓` };
  context.menus.register('view', { ...appearance, order: 10 });
  context.menus.register('view', { ...preview, order: 20 });
  context.menus.register('view', {
    id: 'presentation',
    label: t('menu.view.presentation'),
    commandId: 'view.presentation',
    order: 30,
  });
  context.menus.register('view', {
    id: 'content',
    label: `${t('menu.view.content')} ✓`,
    commandId: 'view.content',
    order: 40,
  });
  context.menus.register('view', {
    id: 'theme',
    label: t('menu.view.theme'),
    order: 50,
    submenu: THEMES.map((theme, index) => ({
      id: theme.id,
      label: theme.id === 'base' ? `${theme.name} ✓` : theme.name,
      commandId: `view.theme.${theme.id}`,
      order: (index + 1) * 10,
    })),
  });
  context.menus.register('view', { id: 'settings', label: t('menu.view.settings'), commandId: 'view.settings', order: 60 });

  context.menus.register('help', { id: 'about', label: t('menu.help.about'), commandId: 'help.about', order: 10 });

  context.menus.register('context', { id: 'duplicate', label: t('menu.edit.duplicate'), commandId: 'edit.duplicate', order: 10 });
  context.menus.register('context', { id: 'delete', label: t('menu.edit.delete'), commandId: 'edit.delete', order: 20 });
}
