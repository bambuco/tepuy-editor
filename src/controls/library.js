/**
 * @file Version-1 Tepuy controls: creation, fields, and tree placement.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { nodeAt } from '../core/edit.js';
import { htmlFragment, sanitizeHtml, serializeFragment } from '../core/html.js';
import { slugify, uniqueId } from '../core/ids.js';
import { controlPriority, getControl, matchableControls } from './registry.js';
import { GLOBAL_PAGES_ID, classSet, text } from './shared.js';

/**
 * @param {import('../core/parser.js').Node|null} node Content node.
 * @returns {string} Visible text.
 */
function plain(node) {
  if (!node) {
    return '';
  }
  if (node.type === 'text') {
    return node.text || '';
  }
  return (node.children || []).map(plain).join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * @param {import('../core/parser.js').Node} node Content node.
 * @param {string} value Next visible text.
 * @returns {void}
 */
function setPlain(node, value) {
  const rest = (node.children || []).filter((child) => child.type !== 'text');
  node.children = value ? [text(value), ...rest] : rest;
}

/**
 * @param {import('../core/parser.js').Node|null} node Content node.
 * @returns {string} Control family used by the property form.
 */
export function controlKind(node) {
  if (!node) {
    return 'text';
  }
  const names = classSet(node);
  if (node.type === 'page' || node.type === 'subpage' || node.type === 'box' || node.type === 'heading' || node.type === 'paragraph' || node.type === 'image' || node.type === 'link') {
    return node.type;
  }
  if (names.has('instruction')) {
    return 'instruction';
  }
  if (names.has('horizontal-menu') || names.has('vertical-menu')) {
    return 'tabs';
  }
  if (names.has('jpit-activities-quiz')) {
    return 'quiz';
  }
  if (names.has('about')) {
    return 'reference';
  }
  if (node.tag === 'figure') {
    return 'figure';
  }
  if (names.has('onlymobile')) {
    return 'mobile';
  }
  if (names.has('notmobile')) {
    return 'desktop';
  }
  if (node.tag === 'audio' || node.tag === 'video' || node.tag === 'table' || node.tag === 'pre' || node.tag === 'ul' || node.tag === 'ol' || node.tag === 'cite' || node.tag === 'strong' || node.tag === 'em') {
    return node.tag;
  }
  return 'text';
}

/**
 * @param {import('../core/parser.js').Node|null} node Content node.
 * @returns {string|null} Tree label for a version-1 control.
 */
export function controlTreeLabel(node) {
  const kind = controlKind(node);
  if (kind === 'quiz') {
    return node.attrs?.['data-act-title'] || 'Quiz';
  }
  if (kind === 'tabs') {
    return 'Pestañas';
  }
  if (kind === 'reference' || kind === 'instruction' || kind === 'mobile' || kind === 'desktop' || kind === 'cite' || kind === 'strong' || kind === 'em' || kind === 'pre') {
    return plain(node) || null;
  }
  if (kind === 'figure') {
    return plain(node.children?.find((child) => child.tag === 'figcaption')) || node.children?.find((child) => child.tag === 'img')?.attrs?.alt || null;
  }
  return null;
}

/**
 * @param {import('../core/parser.js').Node} node Content node.
 * @param {Set<string>} ids Identifiers already seen.
 * @returns {void}
 */
function collect(node, ids) {
  if (node.attrs?.id) {
    ids.add(node.attrs.id);
  }
  if (node.attrs?.['data-act-id']) {
    ids.add(node.attrs['data-act-id']);
  }
  for (const child of node.children || []) {
    collect(child, ids);
  }
}

/**
 * @param {import('../core/parser.js').Node} root Content tree.
 * @returns {Set<string>} Identifiers used in the tree.
 */
export function collectIds(root) {
  const ids = new Set();
  collect(root, ids);
  return ids;
}

/**
 * @param {string} title Page title.
 * @param {Set<string>} ids Identifiers already used.
 * @param {string} [currentId] Id of the page being edited (excluded from collisions).
 * @returns {string} Suggested page identifier.
 */
export function suggestedPageId(title, ids, currentId = '') {
  const existing = new Set(ids);
  if (currentId) {
    existing.delete(currentId);
  }
  return uniqueId('pag', title || 'Página', existing);
}

/**
 * @param {string} pageId Current identifier.
 * @param {string} title Current title.
 * @returns {boolean} Whether the id still matches an automatic suggestion for the title.
 */
export function isAutoPageId(pageId, title) {
  const base = `pag-${slugify(title || 'Página')}`;
  return pageId === base || pageId.startsWith(`${base}-`);
}

/**
 * @param {string} id Catalog control identifier.
 * @param {{ids: Set<string>, root: import('../core/parser.js').Node, pageId?: string, pageTitle?: string}} context Package identifiers.
 * @returns {import('../core/parser.js').Node|null} New control, or null when this phase does not insert it.
 */
export function createControlNode(id, context) {
  const key = id === 'paragraph' ? 'richtext' : id;
  return getControl(key)?.create?.(context) ?? null;
}

/**
 * @param {string} id Catalog control identifier.
 * @returns {'page'|'subpage'|'content'|null} Where the control is inserted.
 */
function controlRole(id) {
  if (id === 'page') {
    return 'page';
  }
  if (id === 'subpage') {
    return 'subpage';
  }
  if (createControlNode(id, { ids: new Set(), root: { children: [] } })) {
    return 'content';
  }
  return null;
}

/**
 * @param {import('../core/parser.js').Node} parent Parent node.
 * @param {number[]} parentPath Path of the parent.
 * @param {import('../core/parser.js').Node} node Node to append.
 * @returns {{tree: import('../core/parser.js').Node, path: number[]}} Updated tree. The parent belongs to tree.
 */
function appendChild(parent, parentPath, node) {
  const index = (parent.children || []).length;
  parent.children = [...(parent.children || []), node];
  return { path: [...parentPath, index] };
}

/**
 * @param {import('../core/parser.js').Node|null} node Candidate parent.
 * @returns {boolean} Whether the node shows an insertion area.
 */
export function hasSlot(node) {
  if (!node) {
    return false;
  }
  if (node.tag === 'main' || node.tag === 'dd') {
    return true;
  }
  if (node.attrs?.id === GLOBAL_PAGES_ID || node.attrs?.['data-global']) {
    return true;
  }
  if (node.type === 'page' || node.type === 'subpage') {
    return true;
  }
  if (classSet(node).has('tepuy-modal') || classSet(node).has('tepuy-modal__body')) {
    return true;
  }
  const kind = controlKind(node);
  return kind === 'mobile' || kind === 'desktop' || kind === 'tabs';
}

/**
 * @param {import('../core/parser.js').Node|null} node Content node.
 * @returns {number} Priority of the matching control, or 999 when unmatched.
 */
function nodeControlPriority(node) {
  if (!node) {
    return 999;
  }
  if (node.tag === 'main') {
    return 900;
  }
  if (node.attrs?.id === GLOBAL_PAGES_ID) {
    return 799;
  }
  for (const control of matchableControls(999)) {
    if (control.match(node)) {
      return control.priority;
    }
  }
  return getControl('richtext')?.priority ?? 10;
}

/**
 * @param {import('../core/parser.js').Node|null} parent Slot parent.
 * @param {string} id Catalog control identifier.
 * @returns {boolean} Whether that control can be appended to the slot.
 */
export function slotAccepts(parent, id) {
  const role = controlRole(id);
  if (!parent || !role || !hasSlot(parent)) {
    return false;
  }
  const childPriority = controlPriority(id);
  const parentPriority = nodeControlPriority(parent);
  if (childPriority > parentPriority) {
    return false;
  }
  if (parent.tag === 'main') {
    return role === 'page';
  }
  if (parent.attrs?.id === GLOBAL_PAGES_ID) {
    return role === 'content' && childPriority <= 799;
  }
  if (parent.type === 'page') {
    return role === 'subpage' || role === 'content';
  }
  return role === 'content';
}

/**
 * @param {import('../core/parser.js').Node|null} node Moved node.
 * @returns {'page'|'subpage'|'content'} Role used by slot checks.
 */
function nodeRole(node) {
  if (node?.type === 'page') {
    return 'page';
  }
  if (node?.type === 'subpage') {
    return 'subpage';
  }
  return 'content';
}

/**
 * @param {import('../core/parser.js').Node|null} parent Slot parent.
 * @param {import('../core/parser.js').Node|null} node Moved node.
 * @returns {boolean} Whether the node may land in that slot.
 */
export function nodeFitsSlot(parent, node) {
  if (!parent || !node || !hasSlot(parent)) {
    return false;
  }
  const role = nodeRole(node);
  if (parent.tag === 'main') {
    return role === 'page';
  }
  if (parent.type === 'page') {
    return role === 'subpage' || role === 'content';
  }
  return role === 'content';
}

/**
 * @param {number[]} path Longer path.
 * @param {number[]} prefix Possible ancestor path.
 * @returns {boolean} Whether path starts with prefix.
 */
function pathStartsWith(path, prefix) {
  return prefix.length <= path.length && prefix.every((index, position) => path[position] === index);
}

/**
 * Inserts a version-1 control into a cloned tree.
 * @param {import('../core/parser.js').Node} root Content tree.
 * @param {number[]|null} slotPath Parent path of the chosen insertion area. An empty path is the content root.
 * @param {string} id Catalog control identifier.
 * @param {{pageId?: string, pageTitle?: string}} [options] Optional page identity when creating a page.
 * @returns {{tree: import('../core/parser.js').Node, path: number[]}|null} Placement, or null when the slot refuses the control.
 */
export function placeControl(root, slotPath, id, options = {}) {
  if (!slotPath) {
    return null;
  }
  const parent = slotPath.length ? nodeAt(root, slotPath) : root;
  if (!slotAccepts(parent, id)) {
    return null;
  }
  const ids = collectIds(root);
  const node = createControlNode(id, { ids, root, pageId: options.pageId, pageTitle: options.pageTitle });
  if (!node) {
    return null;
  }
  const next = structuredClone(root);
  const target = slotPath.length ? nodeAt(next, slotPath) : next;
  return { tree: next, path: appendChild(target, slotPath, node).path };
}

/**
 * Moves a node into a slot, including a new index among its siblings.
 * @param {import('../core/parser.js').Node} root Content tree.
 * @param {number[]} fromPath Node to move.
 * @param {number[]} parentPath Destination slot parent.
 * @param {number} index Index in the destination before the node is removed.
 * @returns {{tree: import('../core/parser.js').Node, path: number[]}|null} Updated tree, or null when the drop is refused.
 */
export function moveNode(root, fromPath, parentPath, index) {
  if (!fromPath?.length || !parentPath || !Number.isInteger(index) || index < 0) {
    return null;
  }
  if (pathStartsWith(parentPath, fromPath)) {
    return null;
  }
  const sourceParentPath = fromPath.slice(0, -1);
  const fromIndex = fromPath[fromPath.length - 1];
  const sameParent = sourceParentPath.length === parentPath.length
    && sourceParentPath.every((value, position) => value === parentPath[position]);
  if (sameParent && (index === fromIndex || index === fromIndex + 1)) {
    return { tree: root, path: [...fromPath] };
  }
  const next = structuredClone(root);
  const sourceParent = nodeAt(next, sourceParentPath);
  const moving = sourceParent?.children?.[fromIndex];
  if (!moving) {
    return null;
  }
  let adjustedParent = [...parentPath];
  if (pathStartsWith(parentPath, sourceParentPath) && parentPath[sourceParentPath.length] > fromIndex) {
    adjustedParent[sourceParentPath.length] -= 1;
  }
  sourceParent.children.splice(fromIndex, 1);
  const parent = nodeAt(next, adjustedParent);
  if (!nodeFitsSlot(parent, moving)) {
    return null;
  }
  parent.children = parent.children || [];
  let insertAt = index;
  if (sameParent && index > fromIndex) {
    insertAt -= 1;
  }
  if (insertAt > parent.children.length) {
    return null;
  }
  parent.children.splice(insertAt, 0, moving);
  return { tree: next, path: [...adjustedParent, insertAt] };
}

/**
 * @param {import('../core/parser.js').Node} node Content node.
 * @param {string} name Field name.
 * @param {string} value Current value.
 * @param {string} [kind] Input kind.
 * @param {string[]} [options] Select values.
 * @returns {{name: string, labelKey: string, kind: string, value: string, options?: string[]}} Field spec.
 */
function field(node, name, value, kind = 'text', options) {
  return { name, labelKey: `field.${name}`, kind, value, ...(options ? { options } : {}) };
}

/**
 * @param {import('../core/parser.js').Node|null} node Content node.
 * @returns {Array<{name: string, labelKey: string, kind: string, value: string, options?: string[]}>} Editable fields.
 */
export function fieldsFor(node) {
  if (!node) {
    return [];
  }
  const kind = controlKind(node);
  if (kind === 'page') {
    return [field(node, 'ptitle', node.attrs?.ptitle || ''), field(node, 'id', node.attrs?.id || '')];
  }
  if (kind === 'subpage') {
    return [field(node, 'title', node.attrs?.['data-title'] || '')];
  }
  if (kind === 'paragraph' || kind === 'ul' || kind === 'ol' || kind === 'table') {
    return [];
  }
  if (kind === 'box') {
    return [field(node, 'label', node.attrs?.label || '')];
  }
  if (kind === 'link') {
    return [field(node, 'page', node.attrs?.['data-page'] || '')];
  }
  if (kind === 'image') {
    return [field(node, 'alt', node.attrs?.alt || ''), field(node, 'src', node.attrs?.src || '')];
  }
  if (kind === 'figure') {
    const image = node.children?.find((child) => child.tag === 'img');
    return [
      field(node, 'alt', image?.attrs?.alt || ''),
      field(node, 'src', image?.attrs?.src || ''),
    ];
  }
  if (kind === 'audio' || kind === 'video') {
    return [field(node, 'src', node.attrs?.src || '')];
  }
  if (kind === 'instruction') {
    return [
      field(node, 'type', node.attrs?.type || 'default', 'select', ['default', 'info', 'danger', 'alert', 'none']),
    ];
  }
  if (kind === 'tabs') {
    const titles = (node.children || []).filter((child) => child.tag === 'dl');
    return [
      field(node, 'orientation', classSet(node).has('vertical-menu') ? 'vertical' : 'horizontal', 'select', ['horizontal', 'vertical']),
      field(node, 'tab1', plain(titles[0]?.children?.find((child) => child.tag === 'dt'))),
      field(node, 'tab2', plain(titles[1]?.children?.find((child) => child.tag === 'dt'))),
    ];
  }
  if (kind === 'quiz') {
    const question = node.children?.find((child) => child.tag === 'question');
    const items = question?.children?.find((child) => child.tag === 'ul')?.children?.filter((child) => child.tag === 'li') || [];
    return [
      field(node, 'title', node.attrs?.['data-act-title'] || ''),
      field(node, 'id', node.attrs?.['data-act-id'] || ''),
      field(node, 'correct', plain(items[0])),
      field(node, 'incorrect', plain(items[1])),
    ];
  }
  if (kind === 'reference') {
    return [
      field(node, 'refType', node.attrs?.['data-type'] || 'general', 'select', ['general', 'image', 'video', 'audio', 'table', 'web', 'paper']),
      field(node, 'key', node.attrs?.['data-key'] || ''),
    ];
  }
  return [field(node, 'text', plain(node), 'textarea')];
}

/**
 * @param {Array<{name: string, value: string}>} specs Field specs.
 * @returns {Object<string, string>} Current values.
 */
export function fieldValues(specs) {
  return Object.fromEntries(specs.map((spec) => [spec.name, spec.value]));
}

/**
 * @param {string} value Identifier.
 * @returns {boolean} Whether the identifier matches type-slug.
 */
function validId(value) {
  return /^[a-z][a-z0-9-]*$/.test(value);
}

/**
 * @param {import('../core/parser.js').Node} node Content node.
 * @param {Object<string, string>} fields Submitted values.
 * @param {Set<string>} ids Identifiers used by other nodes.
 * @returns {boolean} False when a value is rejected.
 */
function writeFields(node, fields, ids) {
  const kind = controlKind(node);
  if (kind === 'page') {
    if (!validId(fields.id) || ids.has(fields.id)) {
      return false;
    }
    node.attrs = { ...node.attrs, id: fields.id, ptitle: fields.ptitle };
    return true;
  }
  if (kind === 'subpage') {
    node.attrs = { ...node.attrs, 'data-title': fields.title };
    return true;
  }
  if (kind === 'box') {
    node.attrs = { ...node.attrs, label: fields.label };
    const paragraph = node.children?.find((child) => child.tag === 'p');
    if (paragraph && 'text' in fields) {
      setPlain(paragraph, fields.text);
    }
    return true;
  }
  if (kind === 'link') {
    if ('text' in fields) {
      setPlain(node, fields.text);
    }
    node.attrs = { ...node.attrs, 'data-page': fields.page };
    return true;
  }
  if (kind === 'image') {
    node.attrs = { ...node.attrs, alt: fields.alt, src: fields.src };
    return true;
  }
  if (kind === 'figure') {
    const image = node.children?.find((child) => child.tag === 'img');
    const caption = node.children?.find((child) => child.tag === 'figcaption');
    if (image) {
      image.attrs = { ...image.attrs, alt: fields.alt, src: fields.src };
    }
    if (caption && 'caption' in fields) {
      setPlain(caption, fields.caption);
    }
    return true;
  }
  if (kind === 'audio' || kind === 'video') {
    node.attrs = { ...node.attrs, src: fields.src };
    return true;
  }
  if (kind === 'instruction') {
    const attrs = { ...node.attrs };
    if (!fields.type || fields.type === 'default') {
      delete attrs.type;
    }
    else {
      attrs.type = fields.type;
    }
    node.attrs = attrs;
    if ('text' in fields) {
      setPlain(node, fields.text);
    }
    return true;
  }
  if (kind === 'tabs') {
    const names = classSet(node);
    names.delete('horizontal-menu');
    names.delete('vertical-menu');
    names.add(fields.orientation === 'vertical' ? 'vertical-menu' : 'horizontal-menu');
    node.attrs = { ...node.attrs, class: [...names].join(' ') };
    const tabs = (node.children || []).filter((child) => child.tag === 'dl');
    [fields.tab1, fields.tab2].forEach((title, index) => {
      const label = tabs[index]?.children?.find((child) => child.tag === 'dt');
      if (label && title !== undefined) {
        setPlain(label, title);
      }
    });
    return true;
  }
  if (kind === 'quiz') {
    if (!validId(fields.id) || ids.has(fields.id)) {
      return false;
    }
    node.attrs = { ...node.attrs, 'data-act-id': fields.id, 'data-act-title': fields.title };
    const question = node.children?.find((child) => child.tag === 'question');
    const description = question?.children?.find((child) => child.tag === 'description');
    const paragraph = description?.children?.find((child) => child.tag === 'p') || description;
    if (paragraph && 'question' in fields) {
      setPlain(paragraph, fields.question);
    }
    const items = question?.children?.find((child) => child.tag === 'ul')?.children?.filter((child) => child.tag === 'li') || [];
    if (items[0]) {
      setPlain(items[0], fields.correct);
    }
    if (items[1]) {
      setPlain(items[1], fields.incorrect);
    }
    const feedback = question?.children?.find((child) => child.tag === 'feedback');
    const correct = feedback?.children?.find((child) => child.tag === 'correct') || feedback;
    if (correct && 'feedback' in fields) {
      setPlain(correct, fields.feedback);
    }
    return true;
  }
  if (kind === 'ul' || kind === 'ol') {
    const item = node.children?.find((child) => child.tag === 'li');
    if (item && 'text' in fields) {
      setPlain(item, fields.text);
    }
    return true;
  }
  if (kind === 'table') {
    const cell = node.children?.[0]?.children?.[0]?.children?.[0];
    if (cell && 'text' in fields) {
      setPlain(cell, fields.text);
    }
    return true;
  }
  if (kind === 'reference') {
    const attrs = { ...node.attrs, 'data-key': fields.key };
    if (!fields.refType || fields.refType === 'general') {
      delete attrs['data-type'];
    }
    else {
      attrs['data-type'] = fields.refType;
    }
    if ('full' in fields) {
      if (fields.full) {
        attrs['data-full'] = fields.full;
      }
      else {
        delete attrs['data-full'];
      }
    }
    node.attrs = attrs;
    if ('text' in fields) {
      setPlain(node, fields.text);
    }
    return true;
  }
  if ('text' in fields) {
    setPlain(node, fields.text ?? '');
  }
  return true;
}

/**
 * Writes property values into a cloned tree.
 * @param {import('../core/parser.js').Node} root Content tree.
 * @param {number[]} path Selected node.
 * @param {Object<string, string>} fields Submitted values.
 * @returns {import('../core/parser.js').Node|null} Updated tree, or null when a value is rejected.
 */
export function applyControlFields(root, path, fields) {
  const next = structuredClone(root);
  const node = nodeAt(next, path);
  if (!node) {
    return null;
  }
  const ids = collectIds(next);
  if (node.attrs?.id) {
    ids.delete(node.attrs.id);
  }
  if (node.attrs?.['data-act-id']) {
    ids.delete(node.attrs['data-act-id']);
  }
  return writeFields(node, fields, ids) ? next : null;
}

/**
 * @typedef {Object} HtmlRegion
 * @property {string} id Region identifier.
 * @property {number[]|null} path Path from the control to the element whose children are the HTML. Null stores an attribute.
 * @property {'inline'|'block'|'rich'} mode Allowed vocabulary.
 * @property {string} [attr] Attribute that stores the fragment.
 */

/**
 * @param {import('../core/parser.js').Node|null} node Content node.
 * @returns {HtmlRegion[]} HTML areas edited in the canvas.
 */
export function htmlRegions(node) {
  if (!node) {
    return [];
  }
  const kind = controlKind(node);
  if (kind === 'paragraph' || kind === 'link') {
    return [{ id: 'body', path: [], mode: 'inline' }];
  }
  if (kind === 'instruction') {
    return [{ id: 'body', path: [], mode: 'block' }];
  }
  if (kind === 'figure') {
    const index = (node.children || []).findIndex((child) => child.tag === 'figcaption');
    return index >= 0 ? [{ id: 'caption', path: [index], mode: 'inline' }] : [];
  }
  if (kind === 'reference') {
    return [
      { id: 'text', path: [], mode: 'block' },
      { id: 'full', path: null, mode: 'block', attr: 'data-full' },
    ];
  }
  if (kind === 'ul' || kind === 'ol') {
    return (node.children || []).flatMap((child, index) => (
      child.tag === 'li' ? [{ id: `item-${index}`, path: [index], mode: 'inline' }] : []
    ));
  }
  if (kind === 'table') {
    /** @type {HtmlRegion[]} */
    const regions = [];
    (node.children || []).forEach((section, sectionIndex) => {
      (section.children || []).forEach((row, rowIndex) => {
        (row.children || []).forEach((cell, cellIndex) => {
          if (cell.tag === 'td' || cell.tag === 'th') {
            regions.push({
              id: `cell-${sectionIndex}-${rowIndex}-${cellIndex}`,
              path: [sectionIndex, rowIndex, cellIndex],
              mode: 'inline',
            });
          }
        });
      });
    });
    return regions;
  }
  if (kind === 'quiz') {
    /** @type {HtmlRegion[]} */
    const regions = [];
    const questionIndex = (node.children || []).findIndex((child) => child.tag === 'question');
    const question = node.children?.[questionIndex];
    const descriptionIndex = (question?.children || []).findIndex((child) => child.tag === 'description');
    if (questionIndex >= 0 && descriptionIndex >= 0) {
      regions.push({ id: 'question', path: [questionIndex, descriptionIndex], mode: 'block' });
    }
    const feedbackIndex = (question?.children || []).findIndex((child) => child.tag === 'feedback');
    const feedback = question?.children?.[feedbackIndex];
    const correctIndex = (feedback?.children || []).findIndex((child) => child.tag === 'correct');
    if (questionIndex >= 0 && feedbackIndex >= 0) {
      regions.push({
        id: 'feedback',
        path: correctIndex >= 0
          ? [questionIndex, feedbackIndex, correctIndex]
          : [questionIndex, feedbackIndex],
        mode: 'block',
      });
    }
    return regions;
  }
  return [];
}

/**
 * @param {import('../core/parser.js').Node} node Content node.
 * @param {HtmlRegion} region HTML area.
 * @returns {import('../core/parser.js').Node|null} Element that owns the fragment.
 */
function regionElement(node, region) {
  if (!region || region.attr) {
    return node;
  }
  return region.path?.length ? nodeAt(node, region.path) : node;
}

/**
 * @param {import('../core/parser.js').Node|null} node Content node.
 * @param {string} regionId Region identifier.
 * @returns {string} Applied HTML of that region.
 */
export function regionHtml(node, regionId) {
  const region = htmlRegions(node).find((item) => item.id === regionId);
  if (!node || !region) {
    return '';
  }
  if (region.attr) {
    return node.attrs?.[region.attr] || '';
  }
  const target = regionElement(node, region);
  return serializeFragment(target?.children || []);
}

/**
 * @param {string} html Untrusted HTML.
 * @param {'inline'|'block'|'rich'} mode Allowed vocabulary.
 * @param {typeof DOMParser} [Parser] DOM parser constructor.
 * @returns {string} Sanitized compact HTML.
 */
export function normalizedHtml(html, mode, Parser = globalThis.DOMParser) {
  return htmlFragment(html, mode, Parser);
}

/**
 * Writes sanitized HTML into a cloned tree.
 * @param {import('../core/parser.js').Node} root Content tree.
 * @param {number[]} path Control path.
 * @param {string} regionId Region identifier.
 * @param {string} html Untrusted HTML.
 * @param {typeof DOMParser} [Parser] DOM parser constructor.
 * @returns {import('../core/parser.js').Node|null} Updated tree, or null when the region is missing.
 */
export function applyRegionHtml(root, path, regionId, html, Parser = globalThis.DOMParser) {
  const next = structuredClone(root);
  const node = nodeAt(next, path);
  const region = htmlRegions(node).find((item) => item.id === regionId);
  if (!node || !region) {
    return null;
  }
  const children = sanitizeHtml(html, region.mode, Parser);
  if (region.attr) {
    const attrs = { ...node.attrs };
    const value = serializeFragment(children);
    if (value) {
      attrs[region.attr] = value;
    }
    else {
      delete attrs[region.attr];
    }
    node.attrs = attrs;
    return next;
  }
  const target = regionElement(node, region);
  if (!target) {
    return null;
  }
  target.children = children;
  return next;
}

/**
 * @param {import('../core/parser.js').Node|null} node Content node.
 * @returns {boolean} Whether deleting it removes nested controls.
 */
export function hasNestedControls(node) {
  if (!node) {
    return false;
  }
  if (htmlRegions(node).some((region) => region.path && region.path.length === 0)) {
    return false;
  }
  const covered = new Set(
    htmlRegions(node).filter((region) => region.path?.length === 1).map((region) => region.path[0]),
  );
  return (node.children || []).some((child, index) => (
    child.type !== 'text' && child.type !== 'comment' && !covered.has(index)
  ));
}

/**
 * Copies the selected control and selects the copy.
 * @param {number[]} path Selected node.
 * @returns {{tree: import('../core/parser.js').Node, path: number[]}|null} Tree with a copy after the node.
 */
export function duplicateAt(root, path) {
  if (!path?.length) {
    return null;
  }
  const next = structuredClone(root);
  const node = nodeAt(next, path);
  const parent = nodeAt(next, path.slice(0, -1));
  if (!node || !parent?.children) {
    return null;
  }
  const copy = structuredClone(node);
  const ids = collectIds(next);
  if (copy.attrs?.id) {
    copy.attrs.id = uniqueId(copy.attrs.id.split('-')[0] || 'item', copy.attrs.ptitle || copy.attrs.id, ids);
  }
  if (copy.attrs?.['data-act-id']) {
    copy.attrs['data-act-id'] = uniqueId('quiz', copy.attrs['data-act-title'] || 'quiz', ids);
  }
  const index = path[path.length - 1] + 1;
  parent.children.splice(index, 0, copy);
  return { tree: next, path: [...path.slice(0, -1), index] };
}

/**
 * @param {import('../core/parser.js').Node} root Content tree.
 * @param {number[]} path Selected node.
 * @returns {import('../core/parser.js').Node|null} Tree without that node.
 */
export function deleteAt(root, path) {
  if (!path?.length) {
    return null;
  }
  const next = structuredClone(root);
  const parent = nodeAt(next, path.slice(0, -1));
  if (!parent?.children || !parent.children[path[path.length - 1]]) {
    return null;
  }
  parent.children.splice(path[path.length - 1], 1);
  return next;
}

/**
 * @param {import('../core/parser.js').Node} node Content node.
 * @param {Array<{type: string, key: string, text: string, full: string}>} found Collected references.
 * @returns {Array<{type: string, key: string, text: string, full: string}>} References in document order.
 */
export function collectReferences(node, found = []) {
  if (controlKind(node) === 'reference') {
    found.push({
      type: node.attrs?.['data-type'] || 'general',
      key: node.attrs?.['data-key'] || '',
      text: plain(node),
      full: node.attrs?.['data-full'] || '',
    });
  }
  for (const child of node.children || []) {
    collectReferences(child, found);
  }
  return found;
}

/**
 * @param {import('../core/parser.js').Node} root Content tree.
 * @returns {Array<{id: string, title: string}>} Pages in order.
 */
export function collectPages(root) {
  return (root.children || []).filter((node) => node.type === 'page').map((node) => ({
    id: node.attrs?.id || '',
    title: node.attrs?.ptitle || node.attrs?.id || '',
  }));
}
