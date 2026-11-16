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
import { extractMainMenuItems, themeHasMainMenu } from '../core/menu.js';
import { serializePackage, settingsFields } from '../core/package.js';
import { buildPreviewHtml } from '../core/preview.js';
import { findTheme } from '../core/themes.js';
import { serializeIndexDocument } from '../metadata/index-document.js';
import { filterLog } from '../core/host.js';
import { t } from '../i18n/messages.js';
import { renderCanvas } from './canvas.js';
import { CONTROL_GROUPS, controlLabel, groupLabel } from './catalog.js';
import {
  addOrphanMenuItem,
  auditEntries,
  auditNeedsLoad,
  currentControlTree,
  currentDocument,
  currentEditor,
  currentGlobalPages,
  currentIndexDocument,
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
  selectedContentRoot,
  setNodeDraft,
  setSettingsDraft,
  subscribePreview,
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
 * @param {import('../controls/walker.js').ControlInstance[]} instances Walked controls.
 * @param {'main'|'global'} scope Selection root.
 * @returns {Array<{label: string, path: number[], scope: string, children?: Array}>} Tree rows.
 */
function instanceTreeItems(instances, scope) {
  return (instances || []).map((instance) => {
    const item = {
      label: instanceLabel(instance),
      path: [...instance.path],
      scope,
    };
    if (instance.children?.length) {
      item.children = instanceTreeItems(instance.children, scope);
    }
    return item;
  });
}

/**
 * @returns {Array<{label: string, path: number[], scope?: string, children?: Array}>} Structure rows.
 */
function structureTreeItems() {
  const { pages, globals } = currentControlTree();
  const items = instanceTreeItems(pages, 'main');
  if (globals.length) {
    items.push({
      label: t('menu.control.global-pages'),
      path: [],
      scope: 'global',
      children: instanceTreeItems(globals, 'global'),
    });
  }
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
  context.views.register('structure', {
    ...activityFace('structure'),
    location: 'primary',
    render: () => liveView((section) => {
      const status = document.createElement('p');
      status.textContent = currentSelection() || t('panel.select-page');
      const list = createList(structureTreeItems(), {
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
      if (themeHasMainMenu(currentThemeId())) {
        parts.push(renderMenuEditor());
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
      frame.srcdoc = buildPreviewHtml({
        variables: theme?.variables || {},
        mobile,
        settings: {
          ...settings,
          autoload: index.bodyAttrs?.['data-autoload'] || settings.autoload,
        },
        view: currentPackageView(),
        autoloadNote: t('panel.autoload'),
        indexHtml: serializeIndexDocument(index),
        contentHtml: serializePackage(documentNode, settings, {
          themeId,
          themeVersion: theme?.version || '1.0.0',
          mainMenu: currentMainMenu(),
          globalPages: currentGlobalPages(),
          references: collectReferences(documentNode),
        }),
      });
      section.replaceChildren(frame);
    }),
  });

  context.views.register('content-html', {
    title: 'content.html',
    location: 'editor',
    render: () => renderCanvas('content', context),
  });
  context.views.register('index-html', {
    title: 'index.html',
    location: 'editor',
    render: () => renderCanvas('index', context),
  });
  context.views.open('content-html');
}
