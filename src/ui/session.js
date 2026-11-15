/**
 * @file Package document, selection, and preview mode shared by the shell views.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import {
  applyControlFields,
  applyRegionHtml,
  collectPages,
  deleteAt,
  duplicateAt,
  fieldValues,
  fieldsFor,
  hasSlot,
  htmlRegions,
  moveNode,
  normalizedHtml,
  placeControl,
  PRESENTATION_FIELDS,
  regionHtml,
} from '../controls/library.js';
import { editableValue, nodeAt } from '../core/edit.js';
import { HostError } from '../core/host.js';
import { createDocumentHistory } from '../core/history.js';
import {
  addMainMenuItem,
  emptyMainMenu,
  extractMainMenuItems,
  rewriteContentPageIds,
  rewriteMenuPageIds,
  setMenuItemTitle,
  themeHasMainMenu,
} from '../core/menu.js';
import { packageSettings, readPackageContent, readPackageSettings, readPackageTheme, serializePackage } from '../core/package.js';
import { parseContentHtml } from '../core/parser.js';
import { SAMPLE_CONTENT } from '../sample-content.js';

/** @type {ReturnType<typeof createDocumentHistory>|null} */
let history = null;
/** @type {string|null} */
let savedHtml = null;
/** @type {{kind: 'node'|'settings'|'html', path?: number[], fields?: Object<string, string>, target?: Object, html?: string}|null} */
let draft = null;
/** @type {boolean} */
let settingsOpen = false;
/** @type {Object|null} */
let editor = null;
/** @type {{path: number[]}|null} */
let selection = null;
/** @type {{path: number[]}|null} */
let insertion = null;
/** @type {{scope: 'node', path: number[], regionId: string}|{scope: 'settings', name: string}|null} */
let htmlFocus = null;
/** @type {'auto'|'desktop'|'mobile'} */
let previewMode = 'auto';
/** @type {'content'|'presentation'} */
let packageView = 'content';
/** @type {Set<Function>} */
const listeners = new Set();
/** @type {ReturnType<import('../core/host.js').createHostClient>|null} */
let host = null;
/** @type {string|null} */
let packageRef = null;
/** @type {string} */
let packageName = '';
/** @type {string|null} */
let revision = null;
/** @type {string|null} */
let hostHtml = null;
/** @type {{id: string, name: string}} */
let hostUser = { id: 'local', name: 'Local' };
/** @type {Object[]} */
let packages = [];
/** @type {Object[]} */
let packageFiles = [];
/** @type {Object[]} */
let remoteLog = [];
/** @type {Object[]} */
let localLog = [];
/** @type {number} */
let logStamp = 0;
/** @type {Promise<Object[]>|null} */
let logLoading = null;
/** @type {Map<string, {original: string, value: string}>} */
const customDrafts = new Map();
/** @type {string|null} */
let activePageId = null;

/**
 * @param {import('../core/parser.js').Node} document Content tree.
 * @param {string} themeId Active theme identifier.
 * @param {Object<string, string>} [settings] Package settings.
 * @param {import('../core/parser.js').Node} [mainMenu] Main menu tree.
 * @returns {{themeId: string, document: import('../core/parser.js').Node, mainMenu: import('../core/parser.js').Node, settings: Object<string, string>}} History snapshot.
 */
function packageState(document, themeId, settings, mainMenu) {
  return {
    themeId,
    document,
    mainMenu: mainMenu || emptyMainMenu(themeId),
    settings: packageSettings(settings || {}),
  };
}

/**
 * @param {import('../core/parser.js').Node} document Content tree.
 * @param {Object<string, string>} settings Package settings.
 * @param {string} themeId Active theme.
 * @param {import('../core/parser.js').Node} [mainMenu] Main menu tree.
 * @returns {string} HTML stored for this package.
 */
function packageHtml(document, settings, themeId, mainMenu) {
  return serializePackage(document, settings, {
    themeId,
    themeVersion: '1.0.0',
    format: '2.0',
    mainMenu: mainMenu || emptyMainMenu(themeId),
  });
}

/**
 * @param {import('../core/parser.js').Node} mainMenu Main menu.
 * @param {import('../core/parser.js').Node} main Content tree.
 * @returns {string|null} First navigable page id.
 */
function pagesFirstId(mainMenu, main) {
  return extractMainMenuItems(mainMenu)[0]?.id || collectPages(main)[0]?.id || null;
}

/**
 * @returns {ReturnType<typeof createDocumentHistory>} Document history, created on first use.
 */
function documentHistory() {
  if (!history) {
    const { main, mainMenu } = readPackageContent(SAMPLE_CONTENT, 'base');
    const settings = readPackageSettings(SAMPLE_CONTENT);
    history = createDocumentHistory(packageState(main, 'base', settings, mainMenu));
    savedHtml = packageHtml(main, settings, 'base', mainMenu);
    activePageId = pagesFirstId(mainMenu, main);
  }
  return history;
}

/**
 * @param {Object<string, string>} left Field values.
 * @param {Object<string, string>} right Field values.
 * @returns {boolean} Whether both maps carry the same text.
 */
function sameFields(left, right) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if ((left[key] ?? '') !== (right[key] ?? '')) {
      return false;
    }
  }
  return true;
}

/**
 * @param {number[]} left Path from the content root.
 * @param {number[]} right Path from the content root.
 * @returns {boolean} Whether both paths name the same node.
 */
function samePath(left, right) {
  return left.length === right.length && left.every((index, position) => index === right[position]);
}

/**
 * Remembers the mounted Edy instance so menu commands can open its surfaces.
 * @param {Object|null} next Edy instance, or null after dispose.
 * @returns {void}
 */
export function bindEditor(next) {
  editor = next;
}

/**
 * @returns {Object|null} Mounted Edy instance.
 */
export function currentEditor() {
  return editor;
}

/**
 * @returns {import('../core/parser.js').Node} Current content tree.
 */
export function currentDocument() {
  return documentHistory().current().document;
}

/**
 * @returns {import('../core/parser.js').Node} Current main menu tree.
 */
export function currentMainMenu() {
  return documentHistory().current().mainMenu || emptyMainMenu(currentThemeId());
}

/**
 * @returns {string|null} Page id the canvas is viewing (may not exist yet).
 */
export function currentPageId() {
  documentHistory();
  return activePageId;
}

/**
 * @param {string|null} pageId Page id to show.
 * @returns {void}
 */
export function setCurrentPageId(pageId) {
  activePageId = pageId || null;
  const root = currentDocument();
  const index = (root.children || []).findIndex((node) => node.type === 'page' && node.attrs?.id === activePageId);
  if (index >= 0) {
    selection = { path: [index] };
    insertion = { path: [index] };
  }
  else {
    selection = null;
    insertion = { path: [] };
  }
  settingsOpen = false;
  publish();
}

/**
 * @returns {boolean} Whether the active theme exposes nav.main.
 */
export function currentThemeHasMainMenu() {
  return themeHasMainMenu(currentThemeId());
}

/**
 * @param {string} pageId Page identifier.
 * @returns {number} Index of that page under main, or -1.
 */
export function pageIndexById(pageId) {
  return (currentDocument().children || []).findIndex((node) => node.type === 'page' && node.attrs?.id === pageId);
}

/**
 * @returns {string} Active theme identifier.
 */
export function currentThemeId() {
  return documentHistory().current().themeId;
}

/**
 * @returns {Object<string, string>} Applied package settings.
 */
export function currentSettings() {
  return packageSettings(documentHistory().current().settings || {});
}

/**
 * @returns {boolean} Whether the properties panel shows package settings.
 */
export function packageSettingsOpen() {
  return settingsOpen;
}

/**
 * Shows the package settings form.
 * @returns {void}
 */
export function openPackageSettings() {
  settingsOpen = true;
  publish();
}

/**
 * @returns {string|null} Applied text of the selected node.
 */
export function currentSelection() {
  const node = selection ? nodeAt(currentDocument(), selection.path) : null;
  if (!node) {
    return null;
  }
  return editableValue(node) || node.tag || node.type;
}

/**
 * @returns {number[]|null} Path of the selected node from the content root.
 */
export function currentSelectionPath() {
  return selection ? [...selection.path] : null;
}

/**
 * @param {{path?: number[]}|null} item Selected tree row.
 * @returns {void}
 */
export function selectNode(item) {
  if (htmlFocus && !draft) {
    htmlFocus = null;
  }
  selection = item?.path ? { path: [...item.path] } : null;
  settingsOpen = false;
  if (selection?.path?.length) {
    const page = nodeAt(currentDocument(), [selection.path[0]]);
    if (page?.type === 'page' && page.attrs?.id) {
      activePageId = page.attrs.id;
    }
  }
  publish();
}

/**
 * @param {import('../core/parser.js').Node} root Content tree.
 * @returns {{path: number[]}} Slot selected when the user has not chosen one.
 */
function defaultInsertion(root) {
  const index = (root.children || []).findIndex((node) => node.type === 'page');
  return { path: index >= 0 ? [index] : [] };
}

/**
 * @returns {number[]} Parent path of the insertion area.
 */
export function currentInsertionPath() {
  const root = currentDocument();
  const parent = insertion ? (insertion.path.length ? nodeAt(root, insertion.path) : root) : null;
  if (!hasSlot(parent)) {
    insertion = defaultInsertion(root);
  }
  return [...insertion.path];
}

/**
 * Marks the area where the next control is inserted.
 * @param {number[]} path Parent path. An empty path is the content root.
 * @returns {void}
 */
export function selectSlot(path) {
  const root = currentDocument();
  const parent = path?.length ? nodeAt(root, path) : root;
  if (!hasSlot(parent)) {
    return;
  }
  insertion = { path: [...(path || [])] };
  publish();
}

/**
 * @param {Object|null} left HTML target.
 * @param {Object|null} right HTML target.
 * @returns {boolean} Whether both name the same region.
 */
function sameHtmlTarget(left, right) {
  if (!left || !right || left.scope !== right.scope) {
    return false;
  }
  if (left.scope === 'settings') {
    return left.name === right.name;
  }
  return left.regionId === right.regionId && samePath(left.path || [], right.path || []);
}

/**
 * @returns {Object|null} HTML region currently open in the canvas.
 */
export function htmlFocusTarget() {
  if (!htmlFocus) {
    return null;
  }
  return htmlFocus.scope === 'settings'
    ? { scope: 'settings', name: htmlFocus.name }
    : { scope: 'node', path: [...htmlFocus.path], regionId: htmlFocus.regionId };
}

/**
 * Opens one HTML region in the canvas.
 * @param {{scope: 'node', path: number[], regionId: string}|{scope: 'settings', name: string}} target Region to edit.
 * @returns {'focused'|'pending'} Whether the editor opened.
 */
export function focusHtml(target) {
  if (draft && !(draft.kind === 'html' && sameHtmlTarget(draft.target, target))) {
    return 'pending';
  }
  htmlFocus = target.scope === 'settings'
    ? { scope: 'settings', name: target.name }
    : { scope: 'node', path: [...target.path], regionId: target.regionId };
  publish();
  return 'focused';
}

/**
 * @param {{scope: 'node', path: number[], regionId: string}|{scope: 'settings', name: string}} target HTML region.
 * @returns {string|null} Applied HTML, or null when the region is missing.
 */
function appliedHtml(target) {
  if (target.scope === 'settings') {
    return normalizedHtml(currentSettings()[target.name] || '', 'rich');
  }
  const node = nodeAt(currentDocument(), target.path);
  const region = htmlRegions(node).find((item) => item.id === target.regionId);
  return region ? regionHtml(node, region.id) : null;
}

/**
 * Keeps HTML typed in the canvas out of the document until Apply.
 * @param {{scope: 'node', path: number[], regionId: string}|{scope: 'settings', name: string}} target HTML region.
 * @param {string} html Untrusted editor HTML.
 * @returns {void}
 */
export function setHtmlDraft(target, html) {
  const node = target.scope === 'node' ? nodeAt(currentDocument(), target.path) : null;
  const region = target.scope === 'node'
    ? htmlRegions(node).find((item) => item.id === target.regionId)
    : null;
  if (target.scope === 'node' && !region) {
    return;
  }
  const clean = normalizedHtml(html, target.scope === 'settings' ? 'rich' : region.mode);
  const applied = appliedHtml(target);
  const same = draft?.kind === 'html' && sameHtmlTarget(draft.target, target);
  if (clean === applied) {
    if (same) {
      draft = null;
      publish();
    }
    return;
  }
  draft = {
    kind: 'html',
    target: target.scope === 'settings'
      ? { scope: 'settings', name: target.name }
      : { scope: 'node', path: [...target.path], regionId: target.regionId },
    html: clean,
  };
  if (!same) {
    publish();
  }
}

/**
 * @param {number[]} path Child indexes from the content root.
 * @param {Object<string, string>} fields Values waiting for Apply.
 * @returns {void}
 */
export function setNodeDraft(path, fields) {
  if (draft && !(draft.kind === 'node' && samePath(draft.path, path))) {
    return;
  }
  const applied = fieldValues(fieldsFor(nodeAt(currentDocument(), path)));
  if (sameFields(fields, applied)) {
    if (draft?.kind === 'node' && samePath(draft.path, path)) {
      draft = null;
    }
    return;
  }
  draft = { kind: 'node', path: [...path], fields: { ...fields } };
}

/**
 * @param {Object<string, string>} fields Settings waiting for Apply.
 * @returns {void}
 */
export function setSettingsDraft(fields) {
  if (draft && draft.kind !== 'settings') {
    return;
  }
  if (sameFields(fields, currentSettings())) {
    if (draft?.kind === 'settings') {
      draft = null;
    }
    return;
  }
  draft = { kind: 'settings', fields: { ...fields } };
}

/**
 * @returns {'node'|'settings'|'html'|null} Draft being edited.
 */
export function draftKind() {
  return draft?.kind || null;
}

/**
 * @param {number[]|null} path Selected node, when the draft belongs to a node.
 * @returns {Object<string, string>|null} Pending values.
 */
export function draftFields(path = null) {
  if (!draft || draft.kind === 'html' || !draft.fields) {
    return null;
  }
  if (draft.kind === 'node' && path && !samePath(draft.path, path)) {
    return null;
  }
  return { ...draft.fields };
}

/**
 * @returns {boolean} Whether a text change is waiting for Apply.
 */
export function hasDraft() {
  return Boolean(draft);
}

/**
 * Writes the pending values into the document history.
 * @returns {'applied'|'empty'|'invalid'} Apply result.
 */
export function applyDraft() {
  if (!draft) {
    if (!htmlFocus) {
      return 'empty';
    }
    htmlFocus = null;
    publish();
    return 'applied';
  }
  if (draft.kind === 'settings') {
    const next = packageSettings(draft.fields, true);
    if (!next) {
      return 'invalid';
    }
    replaceDocument(currentDocument(), currentThemeId(), { settings: next, keepSelection: true, keepInsertion: true });
    void recordOperation('settings', 'package', 'settings');
    return 'applied';
  }
  if (draft.kind === 'html') {
    if (draft.target?.scope === 'settings') {
      const next = packageSettings({ ...currentSettings(), [draft.target.name]: draft.html || '' });
      replaceDocument(currentDocument(), currentThemeId(), { settings: next, keepSelection: true, keepInsertion: true });
      return 'applied';
    }
    const next = applyRegionHtml(currentDocument(), draft.target.path, draft.target.regionId, draft.html || '');
    if (!next) {
      return 'invalid';
    }
    replaceDocument(next, currentThemeId(), { keepSelection: true, keepInsertion: true });
    return 'applied';
  }
  const before = nodeAt(currentDocument(), draft.path);
  const oldId = before?.type === 'page' ? before.attrs?.id : '';
  const next = applyControlFields(currentDocument(), draft.path, draft.fields);
  if (!next) {
    return 'invalid';
  }
  let mainMenu = currentMainMenu();
  const after = nodeAt(next, draft.path);
  if (before?.type === 'page' && after?.type === 'page') {
    const newId = after.attrs?.id || '';
    if (oldId && newId && oldId !== newId) {
      mainMenu = rewriteMenuPageIds(mainMenu, oldId, newId);
      const rewritten = rewriteContentPageIds(next, oldId, newId);
      if (activePageId === oldId) {
        activePageId = newId;
      }
      replaceDocument(rewritten, currentThemeId(), {
        keepSelection: true,
        keepInsertion: true,
        mainMenu,
      });
      return 'applied';
    }
    if (after.attrs?.ptitle && newId) {
      mainMenu = setMenuItemTitle(mainMenu, newId, after.attrs.ptitle);
    }
  }
  replaceDocument(next, currentThemeId(), {
    keepSelection: true,
    keepInsertion: true,
    mainMenu,
  });
  return 'applied';
}

/**
 * Drops the pending text.
 * @returns {boolean} False when there is nothing to cancel.
 */
export function cancelDraft() {
  if (!draft && !htmlFocus) {
    return false;
  }
  draft = null;
  htmlFocus = null;
  publish();
  return true;
}

/**
 * @returns {boolean} Whether the applied document or a draft differs from the last save.
 */
export function hasUnsavedChanges() {
  documentHistory();
  return Boolean(draft)
    || packageHtml(currentDocument(), currentSettings(), currentThemeId(), currentMainMenu()) !== savedHtml;
}

/**
 * Stores the applied document as the session baseline.
 * @returns {'draft'|'unchanged'|'saved'} Save result.
 */
export function saveDocument() {
  if (draft) {
    return 'draft';
  }
  const html = packageHtml(currentDocument(), currentSettings(), currentThemeId(), currentMainMenu());
  if (html === savedHtml) {
    return 'unchanged';
  }
  savedHtml = html;
  hostHtml = html;
  return 'saved';
}

/**
 * @returns {'auto'|'desktop'|'mobile'} Active preview frame size.
 */
export function currentPreviewMode() {
  return previewMode;
}

/**
 * @param {'auto'|'desktop'|'mobile'} mode Preview frame size.
 * @returns {void}
 */
export function setPreviewMode(mode) {
  previewMode = mode;
  publish();
}

/**
 * @returns {'content'|'presentation'} Active package surface.
 */
export function currentPackageView() {
  return packageView;
}

/**
 * @param {'content'|'presentation'} view Package surface.
 * @returns {void}
 */
export function setPackageView(view) {
  packageView = view;
  publish();
}

/**
 * Replaces the open document and drops any pending text.
 * @param {import('../core/parser.js').Node} next Next content tree.
 * @param {string} [themeId] Theme that owns this snapshot. Defaults to the current theme.
 * @param {{keepSelection?: boolean, keepInsertion?: boolean, markSaved?: boolean, settings?: Object, mainMenu?: import('../core/parser.js').Node}} [options] Selection and baseline behavior.
 * @returns {void}
 */
export function replaceDocument(next, themeId = currentThemeId(), options = {}) {
  const settings = options.settings ?? currentSettings();
  const mainMenu = options.mainMenu ?? currentMainMenu();
  documentHistory().commit(packageState(next, themeId, settings, mainMenu));
  draft = null;
  htmlFocus = null;
  if (!options.keepSelection) {
    selection = null;
    settingsOpen = false;
  }
  if (!options.keepInsertion) {
    insertion = null;
  }
  if (options.markSaved) {
    savedHtml = packageHtml(next, settings, themeId, mainMenu);
  }
  publish();
}

/**
 * Creates a page at the end of main, inserts a menu item, and navigates to it.
 * @param {{pageId?: string, pageTitle?: string, addMenuItem?: boolean}} [options] Optional identity for orphan menu targets.
 * @returns {{tree: import('../core/parser.js').Node, path: number[], pageId: string}|null} Placement.
 */
export function addPage(options = {}) {
  const root = currentDocument();
  const themeId = currentThemeId();
  const afterPageId = activePageId;
  const placed = placeControl(root, [], 'page', {
    pageId: options.pageId,
    pageTitle: options.pageTitle,
  });
  if (!placed) {
    return null;
  }
  const page = nodeAt(placed.tree, placed.path);
  const pageId = page?.attrs?.id || '';
  const title = page?.attrs?.ptitle || options.pageTitle || 'Página';
  let mainMenu = currentMainMenu();
  const menuHasTarget = extractMainMenuItems(mainMenu).some((item) => item.id === (options.pageId || pageId));
  if (options.addMenuItem !== false && !menuHasTarget) {
    mainMenu = addMainMenuItem(mainMenu, themeId, {
      pageId,
      title,
      afterPageId,
    });
  }
  else if (options.pageId && menuHasTarget && options.pageTitle) {
    mainMenu = setMenuItemTitle(mainMenu, options.pageId, options.pageTitle);
  }
  replaceDocument(placed.tree, themeId, { mainMenu, keepInsertion: true });
  activePageId = pageId;
  selectNode({ path: placed.path });
  return { ...placed, pageId };
}

/**
 * Inserts a version-1 control, or opens the presentation field in settings.
 * @param {string} id Catalog control identifier.
 * @returns {'inserted'|'settings'|'nowhere'|'pending'|'index'} Insert result.
 */
export function insertControl(id) {
  if (hasDraft()) {
    return 'pending';
  }
  if (id === 'intro' || id === 'objective') {
    settingsOpen = false;
    focusHtml({ scope: 'settings', name: id });
    return 'index';
  }
  const presentation = PRESENTATION_FIELDS[id];
  if (presentation) {
    const settings = currentSettings();
    if (!settings[presentation]) {
      const defaults = { duration: '1 hora', title: 'Título' };
      setSettingsDraft({ ...settings, [presentation]: defaults[presentation] });
    }
    openPackageSettings();
    return 'settings';
  }
  if (id === 'page') {
    return addPage() ? 'inserted' : 'nowhere';
  }
  const placed = placeControl(currentDocument(), currentInsertionPath(), id);
  if (!placed) {
    return 'nowhere';
  }
  replaceDocument(placed.tree, currentThemeId(), { keepInsertion: true });
  selectNode({ path: placed.path });
  return 'inserted';
}

/**
 * Copies the selected control and selects the copy.
 * @returns {boolean} False when nothing is selected.
 */
export function duplicateSelection() {
  if (hasDraft()) {
    return false;
  }
  const placed = duplicateAt(currentDocument(), currentSelectionPath());
  if (!placed) {
    return false;
  }
  replaceDocument(placed.tree, currentThemeId(), { keepInsertion: true });
  selectNode({ path: placed.path });
  return true;
}

/**
 * Moves the selected control to a slot index.
 * @param {number[]} parentPath Destination slot parent.
 * @param {number} index Index in that parent before the move.
 * @returns {'moved'|'pending'|'invalid'|'same'} Move result.
 */
export function moveSelection(parentPath, index) {
  if (hasDraft()) {
    return 'pending';
  }
  const placed = moveNode(currentDocument(), currentSelectionPath(), parentPath, index);
  if (!placed) {
    return 'invalid';
  }
  if (placed.tree === currentDocument()) {
    return 'same';
  }
  replaceDocument(placed.tree, currentThemeId(), { keepSelection: true, keepInsertion: true });
  selectNode({ path: placed.path });
  return 'moved';
}

/**
 * Removes the selected control.
 * @returns {boolean} False when nothing is selected.
 */
export function deleteSelection() {
  if (hasDraft()) {
    return false;
  }
  const path = currentSelectionPath();
  const selected = path ? nodeAt(currentDocument(), path) : null;
  const removedPageId = selected?.type === 'page' ? selected.attrs?.id : '';
  const next = deleteAt(currentDocument(), path);
  if (!next) {
    return false;
  }
  replaceDocument(next);
  if (removedPageId && activePageId === removedPageId) {
    activePageId = pagesFirstId(currentMainMenu(), next);
  }
  return true;
}

/**
 * @returns {boolean} True when a previous document was restored.
 */
export function undoDocument() {
  const restored = documentHistory().undo();
  if (restored) {
    selection = null;
    draft = null;
    htmlFocus = null;
    insertion = null;
    publish();
  }
  return restored;
}

/**
 * @returns {boolean} True when a later document was restored.
 */
export function redoDocument() {
  const restored = documentHistory().redo();
  if (restored) {
    selection = null;
    draft = null;
    htmlFocus = null;
    insertion = null;
    publish();
  }
  return restored;
}

/**
 * @returns {import('../core/parser.js').Node} Empty package content.
 */
export function emptyDocument() {
  return parseContentHtml('<!DOCTYPE html><html><body><main></main></body></html>');
}

/**
 * @returns {import('../core/parser.js').Node} Sample package content.
 */
export function sampleDocument() {
  return parseContentHtml(SAMPLE_CONTENT);
}

/**
 * Connects the session to the test host.
 * @param {ReturnType<import('../core/host.js').createHostClient>|null} client Host client.
 * @returns {void}
 */
export function bindHost(client) {
  host = client;
  if (!client) {
    return;
  }
  client.getUser().then((user) => {
    hostUser = user;
  }).catch(() => {});
  refreshPackages().catch(() => {});
}

/**
 * @returns {string|null} Open package reference.
 */
export function currentPackageRef() {
  return packageRef;
}

/**
 * @returns {string} Open package name.
 */
export function currentPackageName() {
  return packageName;
}

/**
 * @returns {Object[]} Packages stored by the host.
 */
export function hostPackages() {
  return packages;
}

/**
 * @returns {Object[]} Files of the open package.
 */
export function hostFiles() {
  return packageFiles;
}

/**
 * @returns {Object[]} Log entries currently loaded.
 */
export function auditEntries() {
  return remoteLog.length ? remoteLog : localLog;
}

/**
 * @returns {boolean} Whether the audit list should be fetched again.
 */
export function auditNeedsLoad() {
  return Boolean(host && packageRef && logStamp === 0);
}

/**
 * @param {string} path Custom file path.
 * @returns {string|undefined} Text waiting to be saved.
 */
export function customValue(path) {
  return customDrafts.get(path)?.value;
}

/**
 * @param {string} path Custom file path.
 * @param {string} original Text read from the host.
 * @returns {void}
 */
export function rememberCustom(path, original) {
  if (!customDrafts.has(path)) {
    customDrafts.set(path, { original, value: original });
  }
}

/**
 * @param {string} path Custom file path.
 * @param {string} value Text typed in the editor.
 * @returns {void}
 */
export function updateCustom(path, value) {
  const current = customDrafts.get(path) || { original: '', value: '' };
  customDrafts.set(path, { original: current.original, value });
}

/**
 * @param {string} path Custom file path.
 * @returns {Promise<string>} Stored text, or empty when the file is absent.
 */
export async function readCustom(path) {
  if (!host || !packageRef) {
    return '';
  }
  try {
    return await host.read(packageRef, path);
  }
  catch (error) {
    if (error instanceof HostError && error.code === 'not_found') {
      return '';
    }
    throw error;
  }
}

/**
 * Reloads the package list and the files of the open package.
 * @returns {Promise<void>}
 */
export async function refreshPackages() {
  if (!host) {
    packages = [];
    packageFiles = [];
    publish();
    return;
  }
  packages = await host.listPackages();
  packageFiles = packageRef ? await host.list(packageRef) : [];
  publish();
}

/**
 * Loads the change log of the open package.
 * @returns {Promise<Object[]>} Entries oldest first.
 */
export async function refreshLog() {
  if (!host || !packageRef) {
    remoteLog = [...localLog];
    logStamp = Date.now();
    publish();
    return remoteLog;
  }
  if (logLoading) {
    return logLoading;
  }
  const ref = packageRef;
  logLoading = host.listLog(ref).then((entries) => {
    if (packageRef === ref) {
      remoteLog = entries;
    }
    logStamp = Date.now();
    publish();
    return entries;
  }).finally(() => {
    logLoading = null;
  });
  return logLoading;
}

/**
 * Starts a fresh undo history for a package that was created or opened.
 * @param {import('../core/parser.js').Node} document Content tree.
 * @param {string} themeId Active theme.
 * @param {Object<string, string>} settings Package settings.
 * @param {boolean} markSaved Whether this document is the saved baseline.
 * @returns {void}
 */
/**
 * @param {import('../core/parser.js').Node} document Content tree.
 * @param {string} themeId Active theme.
 * @param {Object<string, string>} settings Package settings.
 * @param {boolean} markSaved Whether this document is the saved baseline.
 * @param {import('../core/parser.js').Node} [mainMenu] Main menu tree.
 * @returns {void}
 */
function installDocument(document, themeId, settings, markSaved, mainMenu) {
  const menu = mainMenu || emptyMainMenu(themeId);
  history = createDocumentHistory(packageState(document, themeId, settings, menu));
  draft = null;
  selection = null;
  settingsOpen = false;
  insertion = null;
  htmlFocus = null;
  activePageId = pagesFirstId(menu, document);
  if (markSaved) {
    savedHtml = packageHtml(document, settings, themeId, menu);
  }
  publish();
}

/**
 * Adds a main-menu item that may point at a page that does not exist yet.
 * @param {{pageId: string, title: string}} item Menu entry.
 * @returns {boolean} False when the theme has no main menu.
 */
export function addOrphanMenuItem(item) {
  if (!themeHasMainMenu(currentThemeId()) || !item?.pageId) {
    return false;
  }
  const mainMenu = addMainMenuItem(currentMainMenu(), currentThemeId(), {
    pageId: item.pageId,
    title: item.title || item.pageId,
    afterPageId: activePageId,
  });
  replaceDocument(currentDocument(), currentThemeId(), { mainMenu, keepSelection: true, keepInsertion: true });
  setCurrentPageId(item.pageId);
  return true;
}

/**
 * Updates one main-menu entry by current page id.
 * @param {string} pageId Current data-page value.
 * @param {{pageId?: string, title?: string}} fields Next values.
 * @returns {boolean} False when the item is missing.
 */
export function updateMenuItem(pageId, fields) {
  let mainMenu = currentMainMenu();
  const items = extractMainMenuItems(mainMenu);
  if (!items.some((item) => item.id === pageId)) {
    return false;
  }
  if (fields.title !== undefined) {
    mainMenu = setMenuItemTitle(mainMenu, pageId, fields.title);
  }
  if (fields.pageId && fields.pageId !== pageId) {
    mainMenu = rewriteMenuPageIds(mainMenu, pageId, fields.pageId);
    if (activePageId === pageId) {
      activePageId = fields.pageId;
    }
  }
  replaceDocument(currentDocument(), currentThemeId(), { mainMenu, keepSelection: true, keepInsertion: true });
  publish();
  return true;
}

/**
 * Creates an empty package on the host and stores its first document.
 * @param {string} name Package title.
 * @returns {Promise<{ref: string, name: string, revision: string|null}>} Created package.
 */
export async function createHostPackage(name) {
  const title = name || 'Paquete';
  const settings = packageSettings({ title });
  customDrafts.clear();
  remoteLog = [];
  localLog = [];
  logStamp = 0;
  if (!host) {
    packageRef = null;
    revision = null;
    packageName = title;
    hostHtml = null;
    installDocument(emptyDocument(), 'base', settings, true);
    return { ref: '', name: title, revision: null };
  }
  const created = await host.create({ name: title, themeId: 'base' });
  packageRef = created.ref;
  revision = created.revision;
  packageName = created.name;
  hostHtml = null;
  installDocument(emptyDocument(), 'base', settings, false);
  await recordOperation('create', created.ref, created.name);
  await saveToHost();
  return created;
}

/**
 * Replaces the session with a package stored on the host.
 * @param {string} ref Package reference.
 * @returns {Promise<{ref: string, name: string, revision: string}>} Opened package.
 */
export async function openHostPackage(ref) {
  if (!host) {
    throw new HostError('invalid', 'Host is not connected.');
  }
  const opened = await host.open(ref);
  let html = '';
  try {
    html = await host.read(ref, 'content.html');
  }
  catch (error) {
    if (!(error instanceof HostError) || error.code !== 'not_found') {
      throw error;
    }
  }
  packageRef = opened.ref;
  revision = opened.revision;
  packageName = opened.name;
  customDrafts.clear();
  remoteLog = [];
  logStamp = 0;
  if (!html) {
    const themeId = opened.themeId || 'base';
    installDocument(emptyDocument(), themeId, packageSettings({ title: opened.name }), true, emptyMainMenu(themeId));
  }
  else {
    const themeId = readPackageTheme(html);
    const { main, mainMenu } = readPackageContent(html, themeId);
    installDocument(main, themeId, readPackageSettings(html), true, mainMenu);
  }
  hostHtml = savedHtml;
  await refreshPackages();
  return opened;
}

/**
 * Writes the applied document to the host.
 * @returns {Promise<'draft'|'unchanged'|'saved'|'conflict'>} Save result.
 */
export async function saveToHost() {
  if (draft) {
    return 'draft';
  }
  const html = packageHtml(currentDocument(), currentSettings(), currentThemeId(), currentMainMenu());
  const extra = customChanges();
  if (!host) {
    if (html === savedHtml && extra.length === 0) {
      return 'unchanged';
    }
    savedHtml = html;
    hostHtml = html;
    acceptCustom();
    return 'saved';
  }
  if (html === hostHtml && extra.length === 0 && packageRef) {
    return 'unchanged';
  }
  if (!packageRef) {
    const created = await host.create({
      name: currentSettings().title || 'Paquete',
      themeId: currentThemeId(),
    });
    packageRef = created.ref;
    revision = created.revision;
    packageName = created.name;
    await recordOperation('create', created.ref, created.name);
  }
  try {
    const result = await host.commit(packageRef, [
      { op: 'write', path: 'content.html', content: html },
      ...extra,
    ], revision);
    revision = result.revision;
    savedHtml = html;
    hostHtml = html;
    acceptCustom();
    if (extra.length) {
      await recordOperation('custom', extra.map((change) => change.path).join(', '), extra.map((change) => change.path).join(', '));
    }
    await recordOperation('save', 'content.html', packageName || packageRef);
    await refreshPackages();
    return 'saved';
  }
  catch (error) {
    if (error instanceof HostError && error.code === 'conflict') {
      return 'conflict';
    }
    throw error;
  }
}

/**
 * Stores a file in content/ through the host.
 * @param {File} file Chosen file.
 * @returns {Promise<{path: string, name: string}>} Stored file.
 */
export async function uploadHostFile(file) {
  if (!host || !packageRef) {
    throw new HostError('invalid', 'Open a package before uploading.');
  }
  const temp = await host.tempUpload(packageRef, file);
  const result = await host.commit(packageRef, [
    { op: 'write', path: temp.path, tempId: temp.tempId },
  ], revision);
  revision = result.revision;
  await recordOperation('upload', temp.path, temp.name);
  await refreshPackages();
  return temp;
}

/**
 * Appends one important operation to the host log.
 * @param {string} operation Operation name.
 * @param {string} targetId Affected control or file.
 * @param {string} summary Short description, without file contents.
 * @returns {Promise<void>}
 */
export async function recordOperation(operation, targetId, summary) {
  const entry = {
    timestamp: new Date().toISOString(),
    user: await actor(),
    packageId: packageRef || '',
    revision: revision || '',
    operation,
    targetId: String(targetId || ''),
    summary: String(summary || operation),
  };
  try {
    if (host && packageRef) {
      await host.appendLog(packageRef, [entry]);
      logStamp = 0;
    }
    else {
      localLog.push(entry);
    }
  }
  catch {
    localLog.push(entry);
  }
  publish();
}

/**
 * @returns {Promise<{id: string, name: string}>} User stamped on log entries.
 */
async function actor() {
  if (host && hostUser.id === 'local') {
    try {
      hostUser = await host.getUser();
    }
    catch {
      /* The local label stays until the host answers. */
    }
  }
  return hostUser;
}

/**
 * @returns {Array<{op: string, path: string, content: string}>} Custom files edited since the last save.
 */
function customChanges() {
  const changes = [];
  for (const [path, file] of customDrafts) {
    if (file.value !== file.original && path.startsWith('custom/')) {
      changes.push({ op: 'write', path, content: file.value });
    }
  }
  return changes;
}

/**
 * @returns {void}
 */
function acceptCustom() {
  for (const file of customDrafts.values()) {
    file.original = file.value;
  }
}

/**
 * @param {Function} listener Called after the session changes.
 * @returns {Function} Removes the listener.
 */
export function subscribeSession(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * @returns {void}
 */
function publish() {
  for (const listener of listeners) {
    listener();
  }
}
