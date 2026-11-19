/**
 * @file Activity bar, properties, and preview surfaces for the Tepuy shell.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { createButton, createList } from '../../vendor/edy/src/ui/controls.js';
import {
  collectIds,
  collectReferences,
  controlTreeLabel,
  fieldValues,
  fieldsFor,
  htmlRegions,
  isAutoPageId,
  suggestedPageId,
} from '../controls/library.js';
import { nodeAt } from '../core/edit.js';
import { serializePackage, settingsFields } from '../core/package.js';
import { buildPreviewHtml } from '../core/preview.js';
import { findTheme, themeAssetBase, themeStylesheet } from '../core/themes.js';
import { readMetadata, serializePresentation } from '../metadata/index-document.js';
import { filterLog } from '../core/host.js';
import { t } from '../i18n/messages.js';
import { renderCanvas } from './canvas.js';
import { CONTROL_GROUPS, controlLabel, groupLabel } from './catalog.js';
import {
  applyDraft,
  auditEntries,
  auditNeedsLoad,
  cancelDraft,
  draftKind,
  langDraft,
  langTable,
  currentControlTree,
  currentDocument,
  currentEditor,
  currentGlobalPages,
  currentIndexDocument,
  currentMainMenu,
  currentPackageName,
  currentPackageRef,
  currentPackageView,
  currentPageId,
  currentPreviewMode,
  currentSelection,
  currentSelectionPath,
  currentSelectionScope,
  currentSettings,
  contentDataUrl,
  currentThemeId,
  customValue,
  ensurePreviewSources,
  draftFields,
  hasDraft,
  hostFiles,
  hostPackages,
  openHostPackage,
  packageSettingsOpen,
  pageIndexById,
  readCustom,
  rememberCustom,
  refreshLog,
  selectNode,
  selectedContentRoot,
  setLangDraft,
  setNodeDraft,
  setPackageView,
  setSettingsDraft,
  subscribePreview,
  themeResourceAssignments,
  subscribeSession,
  updateCustom,
  uploadHostFile,
} from './session.js';

/** @type {Map<string, boolean>} */
const pageIdLocked = new Map();

/** @type {Array<{id: string, titleKey: string, icon: string}>} */
export const ACTIVITY_VIEWS = [
  { id: 'structure', titleKey: 'menu.view.structure', icon: 'diagram' },
  { id: 'files', titleKey: 'menu.view.files', icon: 'folder-tree' },
  { id: 'controls', titleKey: 'menu.view.controls', icon: 'cubes' },
  { id: 'common', titleKey: 'menu.view.common', icon: 'file-code' },
  { id: 'audit', titleKey: 'menu.view.audit', icon: 'ⓘ' },
];

/** @type {Array<{id: string, titleKey: string, path: string}>} */
const COMMON_FILES = [
  { id: 'lang', titleKey: 'common.file.lang', path: 'custom/lang.js' },
  { id: 'default-css', titleKey: 'common.file.default-css', path: 'custom/default.css' },
  { id: 'mobile-css', titleKey: 'common.file.mobile-css', path: 'custom/mobile.css' },
  { id: 'stories', titleKey: 'common.file.stories', path: 'custom/stories.js' },
  { id: 'lib', titleKey: 'common.file.lib', path: 'custom/lib.js' },
];

const openedDocuments = new Set();

/**
 * @param {import('../core/parser.js').Node} node Content node.
 * @returns {string} Text contained by the node.
 */
function nodeText(node) {
  if (node.type === 'text') {
    return node.text || '';
  }
  return (node.children || []).map(nodeText).join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * @param {import('../core/parser.js').Node} node Content node.
 * @returns {string} Label shown in the package tree.
 */
function nodeLabel(node) {
  const specific = controlTreeLabel(node);
  if (specific) {
    return specific;
  }
  if (node.type === 'page') {
    return node.attrs?.ptitle || node.attrs?.id || t('menu.control.page');
  }
  if (node.type === 'subpage') {
    return node.attrs?.['data-title'] || t('menu.control.subpage');
  }
  if (node.type === 'box') {
    return node.attrs?.label || t('canvas.block');
  }
  if (node.type === 'heading') {
    return nodeText(node) || (node.tag || 'h').toUpperCase();
  }
  if (node.type === 'paragraph') {
    return nodeText(node) || t('menu.control.paragraph');
  }
  if (node.type === 'image') {
    return node.attrs?.alt || t('menu.control.image');
  }
  if (node.type === 'link') {
    return nodeText(node) || t('canvas.link');
  }
  if (node.attrs?.['data-global']) {
    const key = node.attrs['data-global'];
    if (key === 'credits' || key === 'library') {
      return t(`settings.${key}`);
    }
    return key;
  }
  return node.tag || node.type;
}

/**
 * @param {import('../controls/walker.js').ControlInstance} instance Walked control.
 * @returns {string} Label for the structure tree.
 */
function instanceLabel(instance) {
  const node = Array.isArray(instance.node) ? instance.node[0] : instance.node;
  if (instance.controlId === 'richtext') {
    return nodeLabel(node) || t('menu.control.richtext');
  }
  return nodeLabel(node) || t(`menu.control.${instance.controlId}`);
}

/**
 * @param {string} label Raw structure label.
 * @returns {string} Single-line label of at most 100 characters.
 */
function contentTreeLabel(label) {
  const text = String(label || '').replace(/\s+/g, ' ').trim();
  if (text.length <= 100) {
    return text;
  }
  return `${text.slice(0, 99)}…`;
}

/**
 * Keeps each content-tree label on one line and exposes the same text on hover.
 * @param {HTMLElement} list Structure list.
 * @returns {void}
 */
function clipContentLabels(list) {
  list.classList.add('tepuy-structure-tree');
  for (const button of list.querySelectorAll('.edy-list__item')) {
    const text = [...button.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
    if (!text) {
      continue;
    }
    const span = document.createElement('span');
    span.className = 'tepuy-structure-label';
    span.textContent = text.textContent;
    button.title = text.textContent;
    text.replaceWith(span);
  }
}

/**
 * @param {import('../controls/walker.js').ControlInstance[]} instances Walked controls.
 * @param {'main'|'global'} scope Selection root.
 * @returns {Array<{label: string, icon?: string, path: number[], scope: string, children?: Array}>} Tree rows.
 */
function instanceTreeItems(instances, scope) {
  return (instances || []).map((instance) => {
    const label = instanceLabel(instance);
    const item = {
      label: scope === 'main' ? contentTreeLabel(label) : label,
      icon: instance.icon,
      path: [...instance.path],
      scope,
    };
    if (instance.children?.length) {
      item.children = instanceTreeItems(instance.children, scope);
    }
    return item;
  });
}

/** @type {string} Last editor tab, restored after reload. */
const EDITOR_TAB_KEY = 'tepuy.editorTab';

/** @type {boolean} */
let persistEditorTab = false;

/** @type {EventTarget|null} */
let tabContainer = null;

/** @type {EventListener|null} */
let tabListener = null;

/**
 * @param {string} id Stored or public tab id.
 * @param {string} extensionId Extension prefix used by Edy.
 * @returns {string} Id without the extension prefix.
 */
function localTabId(id, extensionId) {
  const prefix = `${extensionId}:`;
  return id.startsWith(prefix) ? id.slice(prefix.length) : id;
}

/**
 * @returns {string} Saved editor tab, or an empty string.
 */
function readEditorTab() {
  try {
    return globalThis.localStorage?.getItem(EDITOR_TAB_KEY) || '';
  }
  catch {
    return '';
  }
}

/**
 * @param {string} id Editor view or global document id.
 * @returns {void}
 */
function writeEditorTab(id) {
  try {
    globalThis.localStorage?.setItem(EDITOR_TAB_KEY, id);
  }
  catch {
    // Private mode or a test environment without storage.
  }
}

/**
 * Aligns the preview and the properties selection with the active editor tab.
 * @param {{viewId?: string|null, documentId?: string|null}} detail Active tab.
 * @param {string} extensionId Extension prefix used by Edy.
 * @param {boolean} persist Whether this change should be restored after reload.
 * @returns {void}
 */
function applyEditorTab(detail, extensionId, persist) {
  const id = localTabId(detail.documentId || detail.viewId || '', extensionId);
  if (!id) {
    return;
  }
  if (persist) {
    writeEditorTab(id);
  }
  const preview = id === 'index-html' ? 'presentation' : 'content';
  if (currentPackageView() !== preview) {
    setPackageView(preview);
  }
  if (id === 'index-html') {
    if (currentSelectionScope() === 'global') {
      selectNode(null);
    }
    return;
  }
  if (id === 'content-html') {
    if (currentSelectionScope() !== 'global') {
      return;
    }
    const index = pageIndexById(currentPageId());
    selectNode(index >= 0 ? { path: [index], scope: 'main' } : null);
    return;
  }
  if (!id.startsWith('global:')) {
    return;
  }
  const key = id.slice('global:'.length);
  const children = currentGlobalPages().children || [];
  const index = children.findIndex((node, position) => (node.attrs?.['data-global'] || String(position)) === key);
  if (index < 0) {
    return;
  }
  const path = currentSelectionPath();
  if (currentSelectionScope() === 'global' && path?.[0] === index) {
    return;
  }
  selectNode({ path: [index], scope: 'global' });
}

/**
 * Opens one global entry in a closable editor tab.
 * @param {Object} context Edy extension context.
 * @param {{path?: number[]}} item Selected global row.
 * @returns {void}
 */
function openGlobalEntry(context, item) {
  const path = item?.path || [];
  if (!path.length) {
    return;
  }
  const children = currentGlobalPages().children || [];
  const root = children[path[0]];
  if (!root) {
    return;
  }
  const key = root.attrs?.['data-global'] || String(path[0]);
  const id = `global:${key}`;
  const publicId = `${context.extensionId}:${id}`;
  selectNode({ path: [...path], scope: 'global' });
  const editor = currentEditor();
  if (editor?.documents.get(publicId)) {
    editor.workbench.openDocument(publicId);
    return;
  }
  const entry = currentControlTree().globals.find((instance) => instance.path[0] === path[0]);
  context.documents.open(id, {
    title: entry ? instanceLabel(entry) : key,
    render: () => renderCanvas('global', context, { documentId: id, globalKey: key }),
  });
}

/**
 * Opens the editor tab saved from the previous visit when it still exists.
 * @param {Object} context Edy extension context.
 * @returns {void}
 */
function restoreEditorTab(context) {
  const saved = readEditorTab();
  if (saved === 'content-html') {
    context.views.open('content-html');
    return;
  }
  if (saved.startsWith('global:')) {
    const key = saved.slice('global:'.length);
    const children = currentGlobalPages().children || [];
    const index = children.findIndex((node, position) => (node.attrs?.['data-global'] || String(position)) === key);
    if (index >= 0) {
      openGlobalEntry(context, { path: [index] });
      return;
    }
  }
  context.views.open('index-html');
}

/**
 * @param {HTMLElement} form Field container.
 * @param {Array<{name: string}>} specs Field specs.
 * @returns {Object<string, string>} Current input values.
 */
function readFields(form, specs) {
  const values = {};
  for (const spec of specs) {
    values[spec.name] = form.querySelector(`[data-field="${spec.name}"]`)?.value ?? '';
  }
  return values;
}

/**
 * @param {Array<{name: string, labelKey: string, kind: string, value: string, options?: string[]}>} specs Fields.
 * @param {Object<string, string>} values Current values.
 * @param {(values: Object<string, string>, changed?: string) => void} onChange Draft update.
 * @returns {HTMLElement} Labeled inputs.
 */
function fieldForm(specs, values, onChange) {
  const form = document.createElement('div');
  for (const spec of specs) {
    const label = document.createElement('label');
    label.textContent = t(spec.labelKey);
    const input = spec.kind === 'select'
      ? document.createElement('select')
      : document.createElement(spec.kind === 'textarea' ? 'textarea' : 'input');
    if (spec.kind === 'select') {
      for (const option of spec.options) {
        const item = document.createElement('option');
        item.value = option;
        item.textContent = t(`option.${spec.name}.${option}`);
        input.append(item);
      }
    }
    input.dataset.field = spec.name;
    input.value = values[spec.name] ?? '';
    const update = () => onChange(readFields(form, specs), spec.name);
    input.addEventListener('input', update);
    input.addEventListener('change', update);
    label.append(input);
    form.append(label);
  }
  return form;
}

/**
 * @param {Function} render Draws the current session into a host element.
 * @returns {{element: HTMLElement, dispose: Function}} View contribution.
 */
function liveView(render) {
  const section = document.createElement('section');
  section.className = 'tepuy-panel';
  const draw = () => render(section);
  draw();
  const unsubscribe = subscribeSession(draw);
  return {
    element: section,
    dispose() {
      unsubscribe();
    },
  };
}

/**
 * Preview host that rebuilds only on notifyPreview (Apply, structure, view switches).
 * @param {Function} render Draws the applied preview into a host element.
 * @returns {{element: HTMLElement, dispose: Function}} View contribution.
 */
function previewLiveView(render) {
  const section = document.createElement('section');
  section.className = 'tepuy-panel';
  const draw = () => render(section);
  draw();
  const unsubscribe = subscribePreview(draw);
  return {
    element: section,
    dispose() {
      unsubscribe();
    },
  };
}

/** @type {{user: string, operation: string, from: string, to: string}} */
const auditFilter = { user: '', operation: '', from: '', to: '' };

/** @type {string[]} */
const AUDIT_OPS = ['add', 'delete', 'duplicate', 'move', 'theme', 'settings', 'save', 'upload', 'create', 'custom'];

/**
 * @returns {{element: HTMLElement, dispose: Function}} Filterable change log.
 */
function renderAudit() {
  const section = document.createElement('section');
  section.className = 'tepuy-audit';
  const list = document.createElement('div');
  const draw = () => {
    if (auditNeedsLoad()) {
      refreshLog().catch(() => {});
    }
    const rows = filterLog(auditEntries(), auditFilter).slice().reverse();
    list.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.textContent = t('panel.audit-empty');
      list.append(empty);
      return;
    }
    for (const entry of rows) {
      const row = document.createElement('article');
      row.className = 'tepuy-audit-row';
      const title = document.createElement('strong');
      const operation = AUDIT_OPS.includes(entry.operation) ? t(`audit.op.${entry.operation}`) : entry.operation;
      title.textContent = `${operation} · ${entry.summary}`;
      const meta = document.createElement('small');
      meta.textContent = `${entry.timestamp} · ${entry.user?.name || entry.user?.id || ''}`;
      row.append(title, meta);
      list.append(row);
    }
  };
  const user = filterField('audit.user', 'search', auditFilter.user, (value) => {
    auditFilter.user = value;
    draw();
  });
  const operation = document.createElement('select');
  operation.setAttribute('aria-label', t('audit.operation'));
  for (const id of ['', ...AUDIT_OPS]) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = id ? t(`audit.op.${id}`) : t('audit.all');
    operation.append(option);
  }
  operation.value = auditFilter.operation;
  operation.addEventListener('change', () => {
    auditFilter.operation = operation.value;
    draw();
  });
  const from = filterField('audit.from', 'date', auditFilter.from, (value) => {
    auditFilter.from = value;
    draw();
  });
  const to = filterField('audit.to', 'date', auditFilter.to, (value) => {
    auditFilter.to = value;
    draw();
  });
  draw();
  const unsubscribe = subscribeSession(draw);
  section.append(user, operation, from, to, list);
  return {
    element: section,
    dispose() {
      unsubscribe();
    },
  };
}

/**
 * @param {string} key Message key for the label.
 * @param {string} type Input type.
 * @param {string} value Current filter value.
 * @param {Function} onInput Called with the typed value.
 * @returns {HTMLLabelElement} Labeled filter field.
 */
function filterField(key, type, value, onInput) {
  const label = document.createElement('label');
  label.textContent = t(key);
  const input = document.createElement('input');
  input.type = type;
  input.value = value;
  input.addEventListener('input', () => onInput(input.value));
  label.append(input);
  return label;
}

/**
 * @param {Object} context Edy extension context.
 * @param {{id: string, titleKey: string, path: string}} file Common package file.
 * @returns {void}
 */
function openCommonFile(context, file) {
  if (file.id === 'lang') {
    openLangFile(context, file);
    return;
  }
  const editor = currentEditor();
  if (openedDocuments.has(file.id) && editor) {
    editor.workbench.openDocument(`${context.extensionId}:${file.id}`);
    return;
  }
  context.documents.open(file.id, {
    title: file.path,
    render: () => {
      const note = document.createElement('p');
      note.textContent = t('panel.custom-file');
      const field = document.createElement('textarea');
      field.rows = 16;
      field.style.width = '100%';
      field.setAttribute('aria-label', file.path);
      field.value = customValue(file.path) ?? '';
      field.addEventListener('input', () => updateCustom(file.path, field.value));
      if (customValue(file.path) === undefined) {
        readCustom(file.path).then((text) => {
          if (customValue(file.path) !== undefined) {
            return;
          }
          rememberCustom(file.path, text);
          field.value = text;
        }).catch((error) => {
          context.notifications.error(error, t('menu.notice.host-error'));
        });
      }
      const wrap = document.createElement('section');
      wrap.append(note, field);
      return wrap;
    },
  });
  openedDocuments.add(file.id);
}

/**
 * @param {HTMLElement} wrap Language editor root.
 * @returns {Object<string, string>} Custom texts currently shown in the table.
 */
function readLangCells(wrap) {
  /** @type {Object<string, string>} */
  const cells = {};
  for (const item of wrap.querySelectorAll('input[data-lang-key]')) {
    cells[item.dataset.langKey] = item.value;
  }
  return cells;
}

/**
 * @param {HTMLElement} wrap Language editor root.
 * @returns {HTMLElement|null} Field being typed inside the editor, including a shadow root.
 */
function focusedLangField(wrap) {
  const root = wrap.getRootNode();
  const active = root instanceof ShadowRoot ? root.activeElement : wrap.ownerDocument?.activeElement;
  if (!(active instanceof HTMLElement) || !wrap.contains(active) || !active.matches('input, textarea')) {
    return null;
  }
  return active;
}

/**
 * Enables Apply and Cancel only while language text is waiting.
 * @param {HTMLElement} wrap Language editor root.
 * @returns {void}
 */
function paintLangActions(wrap) {
  const bar = wrap.querySelector('.tepuy-lang-actions');
  if (!(bar instanceof HTMLElement)) {
    return;
  }
  const dirty = draftKind() === 'lang';
  bar.classList.toggle('is-active', dirty);
  for (const button of bar.querySelectorAll('button')) {
    button.disabled = !dirty;
  }
}

/**
 * @param {HTMLElement} wrap Language editor root.
 * @returns {HTMLElement} Apply and Cancel bar.
 */
function langActionBar(wrap) {
  const bar = document.createElement('div');
  bar.className = 'tepuy-lang-actions';
  const apply = document.createElement('button');
  apply.type = 'button';
  apply.textContent = t('menu.edit.apply');
  apply.addEventListener('click', () => {
    if (applyDraft() === 'invalid') {
      currentEditor()?.notify?.(t('menu.notice.invalid'), 'info');
    }
    if (wrap.isConnected) {
      paintLang(wrap);
    }
  });
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = t('menu.edit.cancel');
  cancel.addEventListener('click', () => {
    cancelDraft();
    if (wrap.isConnected) {
      paintLang(wrap);
    }
  });
  bar.append(apply, cancel);
  return bar;
}

/**
 * @returns {void}
 */
function notifyPending() {
  currentEditor()?.notify?.(t('menu.notice.pending'), 'info');
}

/**
 * @param {HTMLElement} wrap Language editor root.
 * @returns {void}
 */
function paintLang(wrap) {
  const pending = langDraft();
  const raw = pending?.mode === 'raw' ? pending.source : (customValue('custom/lang.js') || '');
  const table = langTable();
  const unreadable = pending?.mode === 'raw' || (!pending && table.unreadable);
  wrap.replaceChildren();
  const body = document.createElement('div');
  body.className = 'tepuy-lang__body';
  if (unreadable) {
    const note = document.createElement('p');
    note.textContent = t('panel.lang-invalid');
    const field = document.createElement('textarea');
    field.rows = 16;
    field.value = raw;
    field.setAttribute('aria-label', 'custom/lang.js');
    field.addEventListener('input', () => {
      if (!setLangDraft({ mode: 'raw', source: field.value })) {
        field.value = customValue('custom/lang.js') || '';
        notifyPending();
      }
      paintLangActions(wrap);
    });
    body.append(note, field);
  }
  else {
    const grid = document.createElement('table');
    const head = document.createElement('tr');
    for (const key of ['panel.lang-key', 'panel.lang-base', 'panel.lang-custom']) {
      const cell = document.createElement('th');
      cell.textContent = t(key);
      head.append(cell);
    }
    const thead = document.createElement('thead');
    thead.append(head);
    const rows = document.createElement('tbody');
    for (const row of table.rows) {
      const line = document.createElement('tr');
      const key = document.createElement('td');
      key.textContent = row.key;
      const base = document.createElement('td');
      base.textContent = row.base;
      const custom = document.createElement('td');
      const input = document.createElement('input');
      input.type = 'text';
      input.value = pending?.mode === 'table' && pending.cells[row.key] !== undefined
        ? pending.cells[row.key]
        : row.custom;
      input.dataset.langKey = row.key;
      input.setAttribute('aria-label', row.key);
      input.addEventListener('input', () => {
        if (!setLangDraft({ mode: 'table', cells: readLangCells(wrap) })) {
          const applied = langTable().rows.find((item) => item.key === input.dataset.langKey);
          input.value = applied?.custom || '';
          notifyPending();
        }
        paintLangActions(wrap);
      });
      custom.append(input);
      line.append(key, base, custom);
      rows.append(line);
    }
    grid.append(thead, rows);
    body.append(grid);
  }
  wrap.append(body, langActionBar(wrap));
  paintLangActions(wrap);
}

/**
 * @param {Object} context Edy extension context.
 * @param {{id: string, titleKey: string, path: string}} file Language file.
 * @returns {void}
 */
function openLangFile(context, file) {
  const editor = currentEditor();
  if (openedDocuments.has(file.id) && editor) {
    editor.workbench.openDocument(`${context.extensionId}:${file.id}`);
    return;
  }
  context.documents.open(file.id, {
    title: file.path,
    render: () => {
      const wrap = document.createElement('section');
      wrap.className = 'tepuy-lang';
      const draw = () => paintLang(wrap);
      draw();
      if (customValue(file.path) === undefined) {
        readCustom(file.path).then((text) => {
          if (customValue(file.path) === undefined) {
            rememberCustom(file.path, text);
          }
          if (wrap.isConnected) {
            draw();
          }
        }).catch((error) => {
          context.notifications.error(error, t('menu.notice.host-error'));
        });
      }
      let attached = false;
      const unsubscribe = subscribeSession(() => {
        if (!wrap.isConnected) {
          if (attached) {
            unsubscribe();
          }
          return;
        }
        attached = true;
        if (focusedLangField(wrap) && draftKind() === 'lang') {
          paintLangActions(wrap);
          return;
        }
        draw();
      });
      return wrap;
    },
  });
  openedDocuments.add(file.id);
}

/**
 * @param {string} id Activity view identifier.
 * @returns {{title: string, icon: string}} Visible glyph and accessible name.
 */
function activityFace(id) {
  const view = ACTIVITY_VIEWS.find((item) => item.id === id);
  return { title: t(view.titleKey), icon: view.icon };
}

/**
 * Registers the activity bar and the surfaces it does not occupy.
 * @param {Object} context Edy extension context.
 * @returns {void}
 */
export function registerActivity(context) {
  persistEditorTab = false;
  tabContainer?.removeEventListener('edy-editor-tab', tabListener);
  tabListener = (event) => {
    applyEditorTab(event.detail || {}, context.extensionId, persistEditorTab);
  };
  tabContainer = currentEditor()?.container || null;
  tabContainer?.addEventListener('edy-editor-tab', tabListener);

  context.views.register('structure', {
    ...activityFace('structure'),
    location: 'primary',
    sections: [
      {
        id: 'content',
        title: t('menu.view.content'),
        render: () => liveView((section) => {
          const pages = currentControlTree().pages;
          const list = createList(instanceTreeItems(pages, 'main'), {
            tree: true,
            onSelect: (item) => {
              selectNode(item);
              context.views.open('content-html');
            },
          });
          clipContentLabels(list);
          section.replaceChildren(list);
        }),
      },
      {
        id: 'globals',
        title: t('menu.control.global-pages'),
        render: () => liveView((section) => {
          const globals = currentControlTree().globals;
          if (!globals.length) {
            const empty = document.createElement('p');
            empty.textContent = t('panel.no-globals');
            section.replaceChildren(empty);
            return;
          }
          section.replaceChildren(createList(instanceTreeItems(globals, 'global'), {
            tree: true,
            onSelect: (item) => openGlobalEntry(context, item),
          }));
        }),
      },
    ],
  });

  context.views.register('files', {
    ...activityFace('files'),
    location: 'primary',
    render: () => liveView((section) => {
      section.className = 'tepuy-files';
      const packagesTitle = document.createElement('h3');
      packagesTitle.textContent = t('panel.packages');
      const packageList = document.createElement('div');
      packageList.className = 'tepuy-controls';
      const stored = hostPackages();
      if (!stored.length) {
        const empty = document.createElement('p');
        empty.textContent = t('panel.no-packages');
        packageList.append(empty);
      }
      for (const item of stored) {
        const current = item.ref === currentPackageRef();
        packageList.append(createButton({
          label: current ? `${item.name} ✓` : item.name,
          onClick: async () => {
            try {
              const opened = await openHostPackage(item.ref);
              context.notifications.success(t('menu.notice.opened', { name: opened.name }));
            }
            catch (error) {
              context.notifications.error(error, t('menu.notice.host-error'));
            }
          },
        }));
      }
      const filesTitle = document.createElement('h3');
      filesTitle.textContent = currentPackageName()
        ? `${t('panel.files')} · ${currentPackageName()}`
        : t('panel.files');
      const fileList = document.createElement('div');
      const files = hostFiles();
      if (!currentPackageRef()) {
        const empty = document.createElement('p');
        empty.textContent = t('panel.no-package');
        fileList.append(empty);
      }
      else if (!files.length) {
        const empty = document.createElement('p');
        empty.textContent = t('panel.no-files');
        fileList.append(empty);
      }
      else {
        for (const file of files) {
          const row = document.createElement('p');
          row.textContent = file.type === 'dir' ? `${file.path}/` : file.path;
          fileList.append(row);
        }
      }
      const upload = document.createElement('input');
      upload.type = 'file';
      upload.setAttribute('aria-label', t('panel.upload'));
      upload.addEventListener('change', async () => {
        const file = upload.files?.[0];
        upload.value = '';
        if (!file) {
          return;
        }
        try {
          const storedFile = await uploadHostFile(file);
          context.notifications.success(t('menu.notice.uploaded', { name: storedFile.name }));
        }
        catch (error) {
          context.notifications.error(error, t('menu.notice.host-error'));
        }
      });
      section.replaceChildren(packagesTitle, packageList, filesTitle, fileList, upload);
    }),
  });

  context.views.register('controls', {
    ...activityFace('controls'),
    location: 'primary',
    sections: CONTROL_GROUPS.map((group, index) => ({
      id: group.id,
      title: groupLabel(group),
      collapsed: index > 0,
      render: () => {
        const grid = document.createElement('div');
        grid.className = 'tepuy-control-grid';
        for (const control of group.controls) {
          grid.append(createButton({
            label: controlLabel(control),
            icon: control.icon,
            onClick: () => context.commands.execute(`insert.${control.id}`),
          }));
        }
        return grid;
      },
    })),
  });

  context.views.register('common', {
    ...activityFace('common'),
    location: 'primary',
    render: () => {
      const section = document.createElement('section');
      section.className = 'tepuy-controls';
      for (const file of COMMON_FILES) {
        section.append(createButton({
          label: `${t(file.titleKey)} (${file.path})`,
          onClick: () => openCommonFile(context, file),
        }));
      }
      return section;
    },
  });

  context.views.register('audit', {
    ...activityFace('audit'),
    location: 'primary',
    render: () => renderAudit(),
  });

  context.views.register('properties', {
    title: t('menu.view.properties'),
    location: 'secondary',
    render: () => liveView((section) => {
      section.className = 'tepuy-property';
      if (packageSettingsOpen()) {
        const specs = settingsFields(currentSettings());
        const pending = draftKind() === 'settings' ? draftFields() : null;
        const form = fieldForm(specs, pending || currentSettings(), setSettingsDraft);
        const notes = [];
        if (hasDraft() && !pending) {
          const other = document.createElement('p');
          other.textContent = t('panel.pending');
          notes.push(other);
        }
        section.replaceChildren(...notes, form);
        return;
      }
      const path = currentSelectionPath();
      const node = path ? nodeAt(selectedContentRoot(), path) : null;
      const parts = [];
      if (!node) {
        const status = document.createElement('p');
        status.textContent = t('panel.select');
        parts.push(status);
      }
      else {
        const pathKey = path.join('.');
        const specs = fieldsFor(node);
        const applied = fieldValues(specs);
        if (node.type === 'page' && !pageIdLocked.has(pathKey)) {
          pageIdLocked.set(pathKey, !isAutoPageId(applied.id || '', applied.ptitle || ''));
        }
        const pending = draftFields(path);
        const form = fieldForm(specs, pending || applied, (values, changed) => {
          const next = { ...values };
          if (node.type === 'page') {
            if (changed === 'id') {
              pageIdLocked.set(pathKey, true);
            }
            if (!pageIdLocked.get(pathKey) && changed === 'ptitle') {
              next.id = suggestedPageId(values.ptitle, collectIds(currentDocument()), applied.id);
            }
          }
          setNodeDraft(path, next);
          const idInput = form.querySelector('[data-field="id"]');
          if (idInput && next.id !== undefined && idInput.value !== next.id) {
            idInput.value = next.id;
          }
        });
        const status = document.createElement('p');
        status.textContent = currentSelection();
        parts.push(status);
        if (!specs.length) {
          const htmlNote = document.createElement('p');
          htmlNote.textContent = t('panel.html-canvas');
          parts.push(htmlNote);
        }
        if (hasDraft() && !pending) {
          const other = document.createElement('p');
          other.textContent = t('panel.pending');
          parts.push(other);
        }
        parts.push(form);
      }
      section.replaceChildren(...parts);
    }),
  });

  context.views.register('preview', {
    title: t('menu.view.preview'),
    location: 'preview',
    viewport: {
      width: 1024,
      height: 768,
      scale: 'auto',
      presets: [
        { id: 'desktop', label: t('menu.view.preview.desktop'), width: 1280, height: 800 },
        { id: 'mobile', label: t('menu.view.preview.mobile'), width: 390, height: 844 },
      ],
    },
    render: () => previewLiveView((section) => {
      const theme = findTheme(currentThemeId());
      const mobile = currentPreviewMode() === 'mobile';
      const documentNode = currentDocument();
      const settings = currentSettings();
      section.className = 'tepuy-preview';
      const frame = document.createElement('iframe');
      frame.title = t('menu.view.preview');
      frame.setAttribute('sandbox', '');
      const index = currentIndexDocument();
      const themeId = currentThemeId();
      ensurePreviewSources();
      const assignments = themeResourceAssignments();
      /** @type {Object<string, string>} */
      const contentUrls = {};
      for (const path of Object.values(assignments)) {
        const url = contentDataUrl(path);
        if (url) {
          contentUrls[path] = url;
        }
      }
      frame.srcdoc = buildPreviewHtml({
        variables: theme?.variables || {},
        mobile,
        settings: {
          ...settings,
          autoload: index.bodyAttrs?.['data-autoload'] || settings.autoload,
        },
        view: currentPackageView(),
        autoloadNote: t('panel.autoload'),
        indexHtml: serializePresentation(index),
        contentHtml: serializePackage(documentNode, settings, {
          themeId,
          themeVersion: theme?.version || '1.0.0',
          mainMenu: currentMainMenu(),
          globalPages: currentGlobalPages(),
          references: collectReferences(documentNode),
          metadata: readMetadata(index.body),
        }),
        themeCss: themeStylesheet(themeId),
        resources: theme?.resources || [],
        assignments,
        assetBase: themeAssetBase(themeId),
        contentUrls,
        desktopCss: customValue('custom/default.css') || '',
        mobileCss: customValue('custom/mobile.css') || '',
        customLang: customValue('custom/lang.js') || '',
      });
      section.replaceChildren(frame);
    }),
  });

  context.views.register('index-html', {
    title: t('menu.view.presentation'),
    location: 'editor',
    render: () => renderCanvas('index', context),
  });
  context.views.register('content-html', {
    title: t('menu.view.content'),
    location: 'editor',
    render: () => renderCanvas('content', context),
  });
  persistEditorTab = true;
  restoreEditorTab(context);
}
