/**
 * @file Editing canvas for content.html and index.html.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { createForm, confirmDialog } from '../../vendor/edy/src/ui/controls.js';
import {
  controlKind,
  hasNestedControls,
  hasSlot,
  htmlRegions,
  regionHtml,
} from '../controls/library.js';
import { nodeAt } from '../core/edit.js';
import { sanitizeHtml } from '../core/html.js';
import { extractMainMenuItems, themeHasMainMenu } from '../core/menu.js';
import { findTheme } from '../core/themes.js';
import { t } from '../i18n/messages.js';
import {
  addPage,
  applyDraft,
  cancelDraft,
  currentDocument,
  currentEditor,
  currentInsertionPath,
  currentMainMenu,
  currentPageId,
  currentSelectionPath,
  currentSettings,
  currentThemeId,
  deleteSelection,
  focusHtml,
  hasDraft,
  htmlFocusTarget,
  moveSelection,
  pageIndexById,
  recordOperation,
  selectNode,
  selectSlot,
  setCurrentPageId,
  setHtmlDraft,
  subscribeSession,
} from './session.js';

const CANVAS_STYLE = `
.tepuy-canvas { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--tepuy-color-bg, #f2f2f2); color: var(--tepuy-color-heading, #24323a); }
.tepuy-canvas__crumbs { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; padding: 8px 12px; background: #fff; border-bottom: 1px solid #d5dde3; }
.tepuy-canvas__crumbs button { border: 0; background: transparent; color: inherit; cursor: pointer; padding: 2px 4px; }
.tepuy-canvas__scroll { flex: 1; overflow: auto; padding: 16px 20px 48px; }
.tepuy-block { position: relative; margin: 10px 0; padding: 12px 10px 8px; border: 1px solid transparent; background: rgba(255,255,255,.72); }
.tepuy-block.is-selected { border-color: var(--tepuy-color-important, #e2793d); }
.tepuy-block__chrome { display: none; position: absolute; top: 0; left: 0; right: 0; z-index: 2; justify-content: space-between; gap: 8px; padding: 2px; }
.tepuy-block:hover > .tepuy-block__chrome { display: flex; }
.tepuy-block:hover:has(.tepuy-block:hover) > .tepuy-block__chrome { display: none; }
.tepuy-block.is-editing > .tepuy-block__chrome { display: flex; }
.tepuy-block__chrome button, .tepuy-slot, .tepuy-canvas__crumbs button { font: inherit; }
.tepuy-block__actions { display: flex; gap: 4px; margin-left: auto; }
.tepuy-block__drag { cursor: grab; }
.tepuy-block__actions { margin-left: auto; display: flex; gap: 4px; }
.tepuy-slot { display: block; width: 100%; min-height: 2.2rem; margin-top: 8px; border: 1px dashed #7f97a6; background: transparent; color: inherit; cursor: pointer; }
.tepuy-slot.is-target, .tepuy-drop.is-drop { outline: 2px solid var(--tepuy-color-important, #e2793d); }
.tepuy-slot--page { margin: 24px 0; min-height: 3rem; font-weight: 600; }
.tepuy-main-menu { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; padding: 8px 0; border-bottom: 1px solid #d5dde3; }
.tepuy-main-menu button { font: inherit; border: 0; background: transparent; color: inherit; cursor: pointer; padding: 4px 8px; }
.tepuy-main-menu button.is-active { border-bottom: 2px solid var(--tepuy-color-important, #e2793d); font-weight: 700; }
.tepuy-drop { height: 8px; margin: 2px 0; }
.tepuy-html { min-height: 1.6rem; padding: 4px; cursor: text; }
.tepuy-html__label, .tepuy-badge { font-size: .8rem; font-weight: 700; }
.tepuy-locked { padding: 12px; border: 1px solid #d5dde3; background: #fff; }
.tepuy-tabs { display: flex; flex-direction: column; gap: 12px; }
.tepuy-panel-edit { padding: 8px; border: 1px dashed #c5d0d8; }
.tepuy-canvas .edy-form__actions { display: none; }
.tepuy-canvas img, .tepuy-canvas video { max-width: 100%; }
`;

/**
 * @param {number[]|null} left Path.
 * @param {number[]|null} right Path.
 * @returns {boolean} Whether both paths match.
 */
function samePath(left, right) {
  const a = left || [];
  const b = right || [];
  return a.length === b.length && a.every((index, position) => index === b[position]);
}

/**
 * @param {string} value Encoded child indexes.
 * @returns {number[]} Path from the content root.
 */
function decodePath(value) {
  return String(value || '').split('.').filter(Boolean).map((part) => Number(part));
}

/**
 * @param {import('../core/parser.js').Node|null} node Content node.
 * @returns {string} Visible text.
 */
function plainText(node) {
  if (!node) {
    return '';
  }
  if (node.type === 'text') {
    return node.text || '';
  }
  return (node.children || []).map(plainText).join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * @param {import('../core/parser.js').Node|null} node Content node.
 * @returns {string} Short name used in the breadcrumb.
 */
function nodeName(node) {
  if (!node) {
    return t('canvas.unknown');
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
    return plainText(node) || (node.tag || 'h').toUpperCase();
  }
  const kind = controlKind(node);
  if (kind === 'quiz') {
    return node.attrs?.['data-act-title'] || 'Quiz';
  }
  if (kind === 'tabs') {
    return t('menu.control.tabs');
  }
  return plainText(node) || node.tag || t('canvas.unknown');
}

/**
 * @param {string} message Notice text.
 * @returns {void}
 */
function notify(message) {
  currentEditor()?.notify?.(message, 'info');
}

/**
 * @param {string} label Button text.
 * @param {Function} onClick Click handler.
 * @returns {HTMLButtonElement} Action button.
 */
function actionButton(label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
}

/**
 * @param {{scope: 'node'|'settings', path?: number[], name?: string}|null} focus Open HTML region.
 * @param {number[]|null} path Content path, or null for a settings block.
 * @param {string} [name] Settings field name when path is null.
 * @returns {boolean} Whether this block owns the open HTML editor.
 */
function blockIsEditing(focus, path, name) {
  if (!focus) {
    return false;
  }
  if (path) {
    return focus.scope === 'node' && samePath(focus.path || [], path);
  }
  return focus.scope === 'settings' && focus.name === name;
}

/**
 * @param {HTMLElement} actions Chrome action host.
 * @param {{edit: Function, remove?: Function}|{apply: Function, cancel: Function}} handlers Button handlers.
 * @param {boolean} editing Whether Apply/Cancel replace Edit/Delete.
 * @returns {void}
 */
function fillChromeActions(actions, handlers, editing) {
  actions.replaceChildren();
  if (editing) {
    actions.append(
      actionButton(t('menu.edit.apply'), handlers.apply),
      actionButton(t('menu.edit.cancel'), handlers.cancel),
    );
    return;
  }
  actions.append(actionButton(t('canvas.edit'), handlers.edit));
  if (handlers.remove) {
    actions.append(actionButton(t('canvas.delete'), handlers.remove));
  }
}

/**
 * Applies the open HTML draft, or closes the editor when nothing changed.
 * @returns {void}
 */
function applyHtmlEdit() {
  const result = applyDraft();
  if (result === 'invalid') {
    notify(t('menu.notice.invalid'));
    return;
  }
  if (result !== 'applied') {
    notify(t('menu.notice.apply-empty'));
  }
}

/**
 * Discards the HTML draft and closes the canvas editor.
 * @returns {void}
 */
function cancelHtmlEdit() {
  if (!cancelDraft()) {
    notify(t('menu.notice.cancel-empty'));
  }
}

/**
 * @param {HTMLElement} host Destination element.
 * @param {string} html Applied HTML.
 * @param {'inline'|'block'|'rich'} mode Allowed vocabulary.
 * @returns {void}
 */
function appendFragment(host, html, mode) {
  const nodes = sanitizeHtml(html, mode);
  if (!nodes.length) {
    const empty = document.createElement('span');
    empty.className = 'tepuy-html__label';
    empty.textContent = t('canvas.empty-html');
    host.append(empty);
    return;
  }
  for (const node of nodes) {
    host.append(toDom(node));
  }
}

/**
 * @param {import('../core/parser.js').Node} node Sanitized node.
 * @returns {globalThis.Node} DOM node.
 */
function toDom(node) {
  if (node.type === 'text') {
    return document.createTextNode(node.text || '');
  }
  const element = document.createElement(node.tag || 'span');
  if (node.tag === 'a' && node.attrs?.href) {
    element.setAttribute('href', node.attrs.href);
  }
  for (const child of node.children || []) {
    element.append(toDom(child));
  }
  return element;
}

/**
 * @param {{scope: string, path?: number[], regionId?: string, name?: string}} target HTML region.
 * @returns {string} Stable key for the open editor.
 */
function focusKey(target) {
  if (target.scope === 'settings') {
    return `settings:${target.name}`;
  }
  return `node:${(target.path || []).join('.')}:${target.regionId}`;
}

/**
 * Builds the editing surface for one package document.
 * @param {'content'|'index'} mode Canvas document.
 * @returns {{element: HTMLElement, dispose: Function}} Editor contribution.
 */
export function renderCanvas(mode) {
  const section = document.createElement('section');
  section.className = 'tepuy-canvas';
  section.tabIndex = 0;
  const editor = currentEditor();
  if (editor?.shadow && !editor.shadow.querySelector('[data-tepuy-canvas-style]')) {
    const style = document.createElement('style');
    style.dataset.tepuyCanvasStyle = 'true';
    style.textContent = CANVAS_STYLE;
    editor.shadow.append(style);
  }
  const theme = findTheme(currentThemeId());
  for (const [name, value] of Object.entries(theme?.variables || {})) {
    if (/^--tepuy-[a-z0-9-]+$/.test(name) && /^[#a-zA-Z0-9(),.%\s-]+$/.test(String(value))) {
      section.style.setProperty(name, String(value));
    }
  }
  const crumbs = document.createElement('nav');
  crumbs.className = 'tepuy-canvas__crumbs';
  crumbs.setAttribute('aria-label', t('canvas.crumbs'));
  const scroller = document.createElement('div');
  scroller.className = 'tepuy-canvas__scroll';
  section.append(crumbs, scroller);

  /** @type {{path: number[], pointerId: number, drop?: {parentPath: number[], index: number}}|null} */
  let drag = null;
  /** @type {HTMLFormElement|null} */
  let editorForm = null;
  /** @type {string} */
  let editorKey = '';

  /**
   * @param {number[]} path Control path.
   * @returns {void}
   */
  function editNode(path) {
    const node = nodeAt(currentDocument(), path);
    const region = htmlRegions(node)[0];
    selectNode({ path });
    if (!region) {
      return;
    }
    if (focusHtml({ scope: 'node', path, regionId: region.id }) === 'pending') {
      notify(t('menu.notice.pending'));
    }
  }

  /**
   * @param {number[]} path Control path.
   * @returns {Promise<void>}
   */
  async function removeNode(path) {
    if (hasDraft()) {
      notify(t('menu.notice.pending'));
      return;
    }
    selectNode({ path });
    const node = nodeAt(currentDocument(), path);
    if (hasNestedControls(node)) {
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
      notify(t('menu.notice.delete-empty'));
      return;
    }
    void recordOperation('delete', path.join('.'), t('menu.notice.delete'));
  }

  /**
   * @param {number[]} parentPath Slot parent.
   * @param {number} index Insertion index.
   * @returns {HTMLElement} Drop line.
   */
  function dropMarker(parentPath, index) {
    const marker = document.createElement('div');
    marker.className = 'tepuy-drop';
    marker.dataset.dropParent = parentPath.join('.');
    marker.dataset.dropIndex = String(index);
    return marker;
  }

  /**
   * @param {number[]} parentPath Slot parent.
   * @returns {HTMLButtonElement} Dotted insertion area.
   */
  function slotButton(parentPath) {
    const parent = parentPath.length ? nodeAt(currentDocument(), parentPath) : currentDocument();
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tepuy-slot';
    button.dataset.dropParent = parentPath.join('.');
    button.dataset.dropIndex = String((parent?.children || []).length);
    button.classList.toggle('is-target', samePath(currentInsertionPath(), parentPath));
    const isPageSlot = parent?.tag === 'main' || parentPath.length === 0;
    button.textContent = isPageSlot ? t('canvas.slot-page') : t('canvas.slot');
    if (isPageSlot) {
      button.classList.add('tepuy-slot--page', 'is-target');
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        if (hasDraft()) {
          notify(t('menu.notice.pending'));
          return;
        }
        const pageId = currentPageId();
        const menuItem = extractMainMenuItems(currentMainMenu()).find((item) => item.id === pageId);
        const missing = Boolean(pageId) && pageIndexById(pageId) < 0;
        const placed = addPage(missing
          ? { pageId, pageTitle: menuItem?.title || pageId, addMenuItem: false }
          : {});
        if (!placed) {
          notify(t('menu.notice.insert-nowhere'));
          return;
        }
        void recordOperation('add', placed.path.join('.'), t('menu.control.page'));
      });
      return button;
    }
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      selectSlot(parentPath);
    });
    return button;
  }

  /**
   * @returns {HTMLElement|null} Theme main menu chrome.
   */
  function renderMainMenu() {
    if (!themeHasMainMenu(currentThemeId())) {
      return null;
    }
    const nav = document.createElement('nav');
    nav.className = 'tepuy-main-menu main';
    nav.dataset.tepuyMenu = 'main';
    const active = currentPageId();
    for (const item of extractMainMenuItems(currentMainMenu())) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = item.title || item.id;
      button.dataset.page = item.id;
      button.classList.toggle('is-active', item.id === active);
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        setCurrentPageId(item.id);
      });
      nav.append(button);
    }
    return nav;
  }

  /**
   * @param {import('../core/parser.js').Node} owner Control that owns the region.
   * @param {number[]} ownerPath Path of that control.
   * @param {{id: string, mode: 'inline'|'block'|'rich'}} region HTML region.
   * @returns {HTMLElement} Clickable HTML preview.
   */
  function htmlZone(owner, ownerPath, region) {
    const zone = document.createElement('div');
    zone.className = 'tepuy-html';
    zone.dataset.htmlKey = `node:${ownerPath.join('.')}:${region.id}`;
    appendFragment(zone, regionHtml(owner, region.id), region.mode);
    zone.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!samePath(currentSelectionPath(), ownerPath)) {
        selectNode({ path: ownerPath });
        return;
      }
      if (focusHtml({ scope: 'node', path: ownerPath, regionId: region.id }) === 'pending') {
        notify(t('menu.notice.pending'));
      }
    });
    return zone;
  }

  /**
   * @param {import('../core/parser.js').Node} node Parent node.
   * @param {number[]} parentPath Parent path.
   * @param {HTMLElement} host Body that receives the children.
   * @returns {void}
   */
  function renderChildren(node, parentPath, host) {
    (node.children || []).forEach((child, index) => {
      if (child.type === 'comment') {
        return;
      }
      if (child.type === 'text') {
        host.append(document.createTextNode(child.text || ''));
        return;
      }
      host.append(dropMarker(parentPath, index), renderBlock(child, [...parentPath, index]));
    });
    if (hasSlot(node)) {
      host.append(slotButton(parentPath));
    }
  }

  /**
   * @param {import('../core/parser.js').Node} node Content node.
   * @param {number[]} path Node path.
   * @param {HTMLElement} body Block body.
   * @returns {void}
   */
  function fillBody(node, path, body) {
    const kind = controlKind(node);
    if (kind === 'mobile' || kind === 'desktop') {
      const badge = document.createElement('p');
      badge.className = 'tepuy-badge';
      badge.textContent = t(kind === 'mobile' ? 'canvas.device.mobile' : 'canvas.device.desktop');
      body.append(badge);
    }
    if (kind === 'box') {
      const label = document.createElement('strong');
      label.textContent = node.attrs?.label || '';
      body.append(label);
    }
    if (kind === 'tabs') {
      const wrap = document.createElement('div');
      wrap.className = 'tepuy-tabs';
      (node.children || []).forEach((item, index) => {
        if (item.tag !== 'dl') {
          return;
        }
        const panel = document.createElement('section');
        panel.className = 'tepuy-panel-edit';
        const title = document.createElement('h3');
        title.textContent = plainText((item.children || []).find((child) => child.tag === 'dt'));
        panel.append(title);
        const ddIndex = (item.children || []).findIndex((child) => child.tag === 'dd');
        if (ddIndex >= 0) {
          renderChildren(item.children[ddIndex], [...path, index, ddIndex], panel);
        }
        wrap.append(panel);
      });
      body.append(wrap);
      return;
    }
    if (kind === 'quiz') {
      const title = document.createElement('strong');
      title.textContent = node.attrs?.['data-act-title'] || 'Quiz';
      body.append(title);
      for (const region of htmlRegions(node)) {
        const label = document.createElement('p');
        label.className = 'tepuy-html__label';
        label.textContent = t(region.id === 'question' ? 'field.question' : 'field.feedback');
        body.append(label, htmlZone(node, path, region));
      }
      const question = (node.children || []).find((child) => child.tag === 'question');
      const items = question?.children?.find((child) => child.tag === 'ul')?.children?.filter((child) => child.tag === 'li') || [];
      const list = document.createElement('ul');
      for (const item of items) {
        const row = document.createElement('li');
        row.textContent = plainText(item);
        list.append(row);
      }
      body.append(list);
      return;
    }
    if (kind === 'figure' || kind === 'image' || node.tag === 'img') {
      const image = kind === 'figure' ? (node.children || []).find((child) => child.tag === 'img') : node;
      const img = document.createElement('img');
      img.alt = image?.attrs?.alt || '';
      img.src = image?.attrs?.src || '';
      body.append(img);
      const caption = htmlRegions(node).find((region) => region.id === 'caption');
      if (caption) {
        body.append(htmlZone(node, path, caption));
      }
      return;
    }
    if (kind === 'audio' || kind === 'video') {
      const media = document.createElement(kind);
      media.setAttribute('controls', '');
      media.src = node.attrs?.src || '';
      body.append(media);
      return;
    }
    if (kind === 'table') {
      for (const region of htmlRegions(node)) {
        body.append(htmlZone(node, path, region));
      }
      return;
    }
    if (kind === 'ul' || kind === 'ol') {
      const list = document.createElement(kind);
      for (const region of htmlRegions(node)) {
        const item = document.createElement('li');
        item.append(htmlZone(node, path, region));
        list.append(item);
      }
      body.append(list);
      return;
    }
    const self = htmlRegions(node).find((region) => region.path && region.path.length === 0);
    if (self) {
      body.append(htmlZone(node, path, self));
      const extra = htmlRegions(node).filter((region) => region !== self);
      for (const region of extra) {
        const label = document.createElement('p');
        label.className = 'tepuy-html__label';
        label.textContent = t('field.full');
        body.append(label, htmlZone(node, path, region));
      }
      return;
    }
    renderChildren(node, path, body);
  }

  /**
   * @param {import('../core/parser.js').Node} node Content node.
   * @param {number[]} path Node path.
   * @returns {HTMLElement} Control block.
   */
  function renderBlock(node, path) {
    const focus = htmlFocusTarget();
    const editing = blockIsEditing(focus, path);
    const block = document.createElement('article');
    block.className = 'tepuy-block';
    block.classList.toggle('is-selected', samePath(currentSelectionPath(), path));
    block.classList.toggle('is-editing', editing);
    block.dataset.path = path.join('.');
    const bar = document.createElement('div');
    bar.className = 'tepuy-block__chrome';
    const drag = actionButton('⠿', () => {});
    drag.className = 'tepuy-block__drag';
    drag.dataset.dragPath = path.join('.');
    drag.setAttribute('aria-label', t('canvas.drag'));
    drag.disabled = editing;
    const actions = document.createElement('span');
    actions.className = 'tepuy-block__actions';
    fillChromeActions(actions, {
      edit: () => editNode(path),
      remove: () => {
        removeNode(path).catch((error) => currentEditor()?.reportError?.(error));
      },
      apply: applyHtmlEdit,
      cancel: cancelHtmlEdit,
    }, editing);
    bar.append(drag, actions);
    const body = document.createElement('div');
    body.className = 'tepuy-block__body';
    fillBody(node, path, body);
    block.append(bar, body);
    block.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('button, .tepuy-html, .tepuy-slot')) {
        return;
      }
      event.stopPropagation();
      selectNode({ path });
    });
    return block;
  }

  /**
   * @param {string} name intro or objective.
   * @returns {HTMLElement} Presentation HTML block.
   */
  function settingsBlock(name) {
    const focus = htmlFocusTarget();
    const editing = blockIsEditing(focus, null, name);
    const block = document.createElement('article');
    block.className = 'tepuy-block';
    block.classList.toggle('is-editing', editing);
    const title = document.createElement('h2');
    title.textContent = t(`settings.${name}`);
    const zone = document.createElement('div');
    zone.className = 'tepuy-html';
    zone.dataset.htmlKey = `settings:${name}`;
    appendFragment(zone, currentSettings()[name] || '', 'rich');
    const open = () => {
      if (focusHtml({ scope: 'settings', name }) === 'pending') {
        notify(t('menu.notice.pending'));
      }
    };
    zone.addEventListener('click', (event) => {
      event.stopPropagation();
      open();
    });
    const bar = document.createElement('div');
    bar.className = 'tepuy-block__chrome';
    const actions = document.createElement('span');
    actions.className = 'tepuy-block__actions';
    fillChromeActions(actions, {
      edit: open,
      apply: applyHtmlEdit,
      cancel: cancelHtmlEdit,
    }, editing);
    bar.append(actions);
    block.append(bar, title, zone);
    return block;
  }

  /**
   * @returns {HTMLElement} Start button that cannot be moved or deleted.
   */
  function lockedPlay() {
    const locked = document.createElement('div');
    locked.className = 'tepuy-locked';
    locked.id = 'play_scorm';
    const button = document.createElement('button');
    button.type = 'button';
    button.disabled = true;
    button.textContent = t('canvas.start');
    const note = document.createElement('p');
    note.textContent = t('canvas.locked');
    locked.append(button, note);
    return locked;
  }

  /**
   * Updates selection, destination, and breadcrumb marks.
   * @returns {void}
   */
  function paintChrome() {
    const selected = currentSelectionPath();
    const slot = currentInsertionPath();
    for (const block of scroller.querySelectorAll('.tepuy-block')) {
      block.classList.toggle('is-selected', samePath(decodePath(block.dataset.path || ''), selected));
    }
    for (const button of scroller.querySelectorAll('.tepuy-slot')) {
      const isPageSlot = button.classList.contains('tepuy-slot--page');
      button.classList.toggle(
        'is-target',
        isPageSlot || samePath(decodePath(button.dataset.dropParent || ''), slot),
      );
    }
    paintCrumbs();
  }

  /**
   * @returns {void}
   */
  function paintCrumbs() {
    crumbs.replaceChildren();
    if (mode === 'index') {
      const label = document.createElement('span');
      label.textContent = 'index.html';
      crumbs.append(label);
      return;
    }
    const root = document.createElement('button');
    root.type = 'button';
    root.textContent = 'content.html';
    root.addEventListener('click', () => selectNode(null));
    crumbs.append(root);
    const path = currentSelectionPath() || [];
    const walked = [];
    for (const index of path) {
      walked.push(index);
      const target = [...walked];
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = nodeName(nodeAt(currentDocument(), target));
      button.addEventListener('click', () => selectNode({ path: target }));
      crumbs.append(button);
    }
  }

  /**
   * @param {HTMLElement} zone Region that receives TinyMCE.
   * @param {{scope: 'node'|'settings', path?: number[], regionId?: string, name?: string}} target Open region.
   * @returns {HTMLFormElement} Editor form.
   */
  function mountEditor(zone, target) {
    const node = target.scope === 'node' ? nodeAt(currentDocument(), target.path) : null;
    const region = target.scope === 'node' ? htmlRegions(node).find((item) => item.id === target.regionId) : null;
    const modeName = target.scope === 'settings' ? 'rich' : (region?.mode || 'inline');
    const value = target.scope === 'settings'
      ? (currentSettings()[target.name] || '')
      : regionHtml(node, target.regionId);
    const form = createForm({
      translate: (key) => editor?.translate?.(key) || key,
      onError: (error) => editor?.reportError?.(error),
      onSubmit: () => {},
      fields: [{
        name: 'html',
        label: t('canvas.html'),
        type: 'tinymce',
        mode: 'custom',
        value,
        options: modeName === 'rich'
          ? { menubar: false, plugins: 'link lists', toolbar: 'undo redo | bold italic | bullist numlist | link | removeformat' }
          : { menubar: false, plugins: 'link', toolbar: 'undo redo | bold italic | link | removeformat' },
      }],
    });
    form.addEventListener('input', () => {
      const next = form.querySelector('textarea')?.value ?? '';
      setHtmlDraft(target, next);
    });
    zone.replaceChildren(form);
    return form;
  }

  /**
   * @returns {void}
   */
  function draw() {
    const focus = htmlFocusTarget();
    const key = focus ? focusKey(focus) : '';
    if (drag || (editorForm?.isConnected && key && key === editorKey)) {
      paintChrome();
      return;
    }
    const scroll = scroller.scrollTop;
    editorForm?.dispose?.();
    editorForm = null;
    editorKey = '';
    scroller.replaceChildren();
    if (mode === 'index') {
      scroller.append(settingsBlock('intro'), settingsBlock('objective'), lockedPlay());
    }
    else {
      const root = currentDocument();
      const menu = renderMainMenu();
      if (menu) {
        scroller.append(menu);
      }
      const pageId = currentPageId();
      const index = pageId ? pageIndexById(pageId) : -1;
      if (index >= 0) {
        const page = root.children[index];
        scroller.append(renderBlock(page, [index]));
      }
      else {
        scroller.append(slotButton([]));
      }
    }
    paintCrumbs();
    if (key) {
      const zone = scroller.querySelector(`[data-html-key="${CSS.escape(key)}"]`);
      if (zone) {
        editorForm = mountEditor(zone, focus);
        editorKey = key;
      }
    }
    scroller.scrollTop = scroll;
  }

  section.addEventListener('pointerdown', (event) => {
    const handle = event.target instanceof Element ? event.target.closest('[data-drag-path]') : null;
    if (!handle || !section.contains(handle)) {
      return;
    }
    if (hasDraft()) {
      notify(t('menu.notice.pending'));
      return;
    }
    event.preventDefault();
    const path = decodePath(handle.dataset.dragPath || '');
    drag = { path, pointerId: event.pointerId };
    if (!samePath(currentSelectionPath(), path)) {
      selectNode({ path });
    }
    handle.setPointerCapture?.(event.pointerId);
  });
  section.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    const root = editor?.shadow;
    const hits = typeof root?.elementsFromPoint === 'function'
      ? root.elementsFromPoint(event.clientX, event.clientY)
      : [root?.elementFromPoint?.(event.clientX, event.clientY)];
    const dragged = scroller.querySelector(`[data-path="${drag.path.join('.')}"]`);
    const drop = hits.find((element) => (
      element instanceof HTMLElement
      && element.matches('[data-drop-parent]')
      && scroller.contains(element)
      && !dragged?.contains(element)
    ));
    for (const marker of scroller.querySelectorAll('.is-drop')) {
      marker.classList.remove('is-drop');
    }
    drag.drop = undefined;
    if (!(drop instanceof HTMLElement) || !scroller.contains(drop)) {
      return;
    }
    const parentPath = decodePath(drop.dataset.dropParent || '');
    if (parentPath.length >= drag.path.length && drag.path.every((index, position) => parentPath[position] === index)) {
      return;
    }
    drop.classList.add('is-drop');
    drag.drop = { parentPath, index: Number(drop.dataset.dropIndex) };
  });
  section.addEventListener('pointerup', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    const drop = drag.drop;
    drag = null;
    for (const marker of scroller.querySelectorAll('.is-drop')) {
      marker.classList.remove('is-drop');
    }
    if (!drop) {
      return;
    }
    const result = moveSelection(drop.parentPath, drop.index);
    if (result === 'moved') {
      void recordOperation('move', drop.parentPath.join('.'), t('menu.notice.moved'));
    }
    else if (result === 'pending') {
      notify(t('menu.notice.pending'));
    }
    else if (result === 'invalid') {
      notify(t('menu.notice.move-invalid'));
    }
  });
  section.addEventListener('keydown', (event) => {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) {
      return;
    }
    const path = currentSelectionPath();
    if (!path?.length) {
      return;
    }
    event.preventDefault();
    const parentPath = path.slice(0, -1);
    const index = event.key === 'ArrowUp' ? path.at(-1) - 1 : path.at(-1) + 2;
    if (index < 0) {
      return;
    }
    const result = moveSelection(parentPath, index);
    if (result === 'moved') {
      void recordOperation('move', parentPath.join('.'), t('menu.notice.moved'));
    }
    else if (result === 'pending') {
      notify(t('menu.notice.pending'));
    }
  });

  draw();
  const unsubscribe = subscribeSession(draw);
  return {
    element: section,
    dispose() {
      unsubscribe();
      editorForm?.dispose?.();
      editorForm = null;
    },
  };
}
