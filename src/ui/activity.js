/**
 * @file Activity bar, properties, and preview surfaces for the Tepuy shell.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { createButton, createList } from '../../vendor/edy/src/ui/controls.js';
import {
  collectIds,
  collectPages,
  collectReferences,
  controlTreeLabel,
  fieldValues,
  fieldsFor,
  htmlRegions,
  isAutoPageId,
  suggestedPageId,
} from '../controls/library.js';
import { nodeAt } from '../core/edit.js';
import { extractMainMenuItems, themeHasMainMenu } from '../core/menu.js';
import { settingsFields } from '../core/package.js';
import { buildPreviewHtml } from '../core/preview.js';
import { serializeContent } from '../core/serializer.js';
import { findTheme } from '../core/themes.js';
import { filterLog } from '../core/host.js';
import { t } from '../i18n/messages.js';
import { renderCanvas } from './canvas.js';
import { CONTROL_GROUPS, controlLabel, groupLabel } from './catalog.js';
import {
  addOrphanMenuItem,
  auditEntries,
  auditNeedsLoad,
  currentDocument,
  currentEditor,
  currentMainMenu,
  currentPackageName,
  currentPackageRef,
  currentPackageView,
  currentPreviewMode,
  currentSelection,
  currentSelectionPath,
  currentSettings,
  currentThemeId,
  customValue,
  draftFields,
  draftKind,
  hasDraft,
  hostFiles,
  hostPackages,
  openHostPackage,
  packageSettingsOpen,
  readCustom,
  rememberCustom,
  refreshLog,
  selectNode,
  setNodeDraft,
  setSettingsDraft,
  subscribeSession,
  updateCustom,
  updateMenuItem,
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

/** @type {Array<{id: string, title: string, path: string}>} */
const COMMON_FILES = [
  { id: 'lang', title: 'Lenguaje', path: 'custom/lang.js' },
  { id: 'default-css', title: 'Estilos', path: 'custom/default.css' },
  { id: 'mobile-css', title: 'Estilos móviles', path: 'custom/mobile.css' },
  { id: 'stories', title: 'Animaciones', path: 'custom/stories.js' },
  { id: 'lib', title: 'Script', path: 'custom/lib.js' },
];

const openedDocuments = new Set();

const SHELL_STYLE = `
.tepuy-controls { display: flex; flex-direction: column; gap: 8px; }
.tepuy-control-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.tepuy-control-grid .edy-button { min-height: 2.4rem; white-space: normal; }
.edy-activity .edy-button {
  display: flex;
  align-items: center;
  justify-content: center;
}
.edy-activity .edy-icon { font-size: 18px; }
.tepuy-property { display: flex; flex-direction: column; gap: 6px; padding: 8px; }
.tepuy-property label { display: flex; flex-direction: column; gap: 4px; }
.tepuy-property textarea { min-height: 5rem; }
.tepuy-property input, .tepuy-property select, .tepuy-property textarea { width: 100%; box-sizing: border-box; color: var(--edy-text, #000); }
.tepuy-menu-edit { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--edy-border, #ddd); }
.tepuy-menu-edit h3 { margin: 0; font-size: 0.9rem; }
.tepuy-menu-row { display: grid; grid-template-columns: 1fr 1fr auto; gap: 4px; align-items: end; }
.tepuy-preview { display: flex; flex-direction: column; height: 100%; min-height: 100%; }
.tepuy-preview iframe { flex: 1; width: 100%; min-height: 240px; border: 0; background: #fff; }
.tepuy-files, .tepuy-audit { display: flex; flex-direction: column; gap: 8px; padding: 8px; }
.tepuy-files h3, .tepuy-audit h3 { margin: 8px 0 0; font-size: 0.85rem; }
.tepuy-audit label { display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem; }
.tepuy-audit-row { display: flex; flex-direction: column; gap: 2px; padding: 6px 0; border-bottom: 1px solid var(--edy-border, #ddd); }
.tepuy-audit-row small { opacity: 0.75; }
`;

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
    return node.attrs?.ptitle || node.attrs?.id || 'Página';
  }
  if (node.type === 'subpage') {
    return node.attrs?.['data-title'] || 'Subpágina';
  }
  if (node.type === 'box') {
    return node.attrs?.label || 'Bloque';
  }
  if (node.type === 'heading') {
    return nodeText(node) || (node.tag || 'título').toUpperCase();
  }
  if (node.type === 'paragraph') {
    return nodeText(node) || 'Párrafo';
  }
  if (node.type === 'image') {
    return node.attrs?.alt || 'Imagen';
  }
  if (node.type === 'link') {
    return nodeText(node) || 'Enlace';
  }
  return node.tag || node.type;
}

/**
 * @param {import('../core/parser.js').Node[]} nodes Content nodes.
 * @param {number[]} [path] Child indexes already walked.
 * @param {import('../core/parser.js').Node|null} [parent] Node that owns these children.
 * @returns {Array<{label: string, path: number[], children?: Array}>} Tree rows.
 */
function treeItems(nodes, path = [], parent = null) {
  if (parent && htmlRegions(parent).some((region) => Array.isArray(region.path) && region.path.length === 0)) {
    return [];
  }
  const hidden = new Set(
    (parent ? htmlRegions(parent) : [])
      .filter((region) => region.path?.length === 1)
      .map((region) => region.path[0]),
  );
  const items = [];
  (nodes || []).forEach((node, index) => {
    if (hidden.has(index) || node.type === 'text' || node.type === 'comment') {
      return;
    }
    const next = [...path, index];
    const children = treeItems(node.children, next, node);
    const item = { label: nodeLabel(node), path: next };
    if (children.length) {
      item.children = children;
    }
    items.push(item);
  });
  return items;
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
 * @returns {HTMLElement} Minimal editor for nav.main [data-page] items.
 */
function renderMenuEditor() {
  const wrap = document.createElement('div');
  wrap.className = 'tepuy-menu-edit';
  const heading = document.createElement('h3');
  heading.textContent = t('panel.main-menu');
  wrap.append(heading);
  const items = extractMainMenuItems(currentMainMenu());
  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'tepuy-menu-row';
    const titleLabel = document.createElement('label');
    titleLabel.textContent = t('field.title');
    const titleInput = document.createElement('input');
    titleInput.value = item.title;
    titleLabel.append(titleInput);
    const idLabel = document.createElement('label');
    idLabel.textContent = t('field.page');
    const idInput = document.createElement('input');
    idInput.value = item.id;
    idLabel.append(idInput);
    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = t('panel.menu-apply');
    save.addEventListener('click', () => {
      updateMenuItem(item.id, { title: titleInput.value, pageId: idInput.value.trim() });
    });
    row.append(titleLabel, idLabel, save);
    wrap.append(row);
  }
  const add = document.createElement('button');
  add.type = 'button';
  add.textContent = t('panel.menu-add');
  add.addEventListener('click', () => {
    const pageId = suggestedPageId('Página', new Set(items.map((item) => item.id)));
    addOrphanMenuItem({ pageId, title: t('menu.control.page') });
  });
  wrap.append(add);
  return wrap;
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
 * @param {{id: string, title: string, path: string}} file Common package file.
 * @returns {void}
 */
function openCommonFile(context, file) {
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
  const style = document.createElement('style');
  style.textContent = SHELL_STYLE;
  currentEditor()?.shadow.append(style);

  context.views.register('structure', {
    ...activityFace('structure'),
    location: 'primary',
    render: () => liveView((section) => {
      const status = document.createElement('p');
      status.textContent = currentSelection() || 'Selecciona una página.';
      const list = createList(treeItems(currentDocument().children), {
        tree: true,
        onSelect: (item) => selectNode(item),
      });
      section.replaceChildren(list, status);
    }),
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
          label: `${file.title} (${file.path})`,
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
      const node = path ? nodeAt(currentDocument(), path) : null;
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
      if (themeHasMainMenu(currentThemeId())) {
        parts.push(renderMenuEditor());
      }
      section.replaceChildren(...parts);
    }),
  });

  context.views.register('preview', {
    title: 'Vista previa',
    location: 'preview',
    viewport: {
      width: 1024,
      height: 768,
      scale: 'auto',
      presets: [
        { id: 'desktop', label: 'Escritorio', width: 1280, height: 800 },
        { id: 'mobile', label: 'Móvil', width: 390, height: 844 },
      ],
    },
    render: () => liveView((section) => {
      const theme = findTheme(currentThemeId());
      const mobile = currentPreviewMode() === 'mobile';
      const documentNode = currentDocument();
      const settings = currentSettings();
      section.className = 'tepuy-preview';
      const frame = document.createElement('iframe');
      frame.title = t('menu.view.preview');
      frame.setAttribute('sandbox', '');
      frame.srcdoc = buildPreviewHtml({
        html: serializeContent(documentNode),
        variables: theme?.variables || {},
        mobile,
        settings,
        pages: collectPages(documentNode),
        mainMenu: currentMainMenu(),
        references: collectReferences(documentNode),
        view: currentPackageView(),
        autoloadNote: t('panel.autoload'),
      });
      const notes = [];
      if (hasDraft()) {
        const pending = document.createElement('p');
        pending.textContent = t('panel.preview-pending');
        notes.push(pending);
      }
      section.replaceChildren(...notes, frame);
    }),
  });

  context.views.register('content-html', {
    title: 'content.html',
    location: 'editor',
    render: () => renderCanvas('content'),
  });
  context.views.register('index-html', {
    title: 'index.html',
    location: 'editor',
    render: () => renderCanvas('index'),
  });
  context.views.open('content-html');
}
