/**
 * @file Builds the editable control-instance tree from package content.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { GLOBAL_PAGES_ID, RICHTEXT_ID } from './shared.js';
import { getControl, matchableControls } from './registry.js';

/**
 * @typedef {import('../core/parser.js').Node} Node
 */

/**
 * @typedef {Object} ControlInstance
 * @property {string} controlId Registered control id.
 * @property {string} icon Edy icon alias.
 * @property {number} priority Control priority.
 * @property {number[]} path Path of the first (or only) node under main / document root.
 * @property {number} [length] Sibling count for fused richtext ranges.
 * @property {Node|Node[]} node Matched node, or sibling range for richtext.
 * @property {ControlInstance[]} children Nested instances.
 */

/**
 * @param {Node|null|undefined} node Candidate element.
 * @returns {boolean} Whether the walker may claim it.
 */
function isElement(node) {
  return Boolean(node && node.type !== 'text' && node.type !== 'comment' && node.tag);
}

/**
 * @param {Node} node Content node.
 * @param {number} maxPriority Inclusive match ceiling.
 * @returns {import('./shared.js').ControlDefinition|null} Winning definition.
 */
function claim(node, maxPriority) {
  for (const control of matchableControls(maxPriority)) {
    if (control.match(node)) {
      return control;
    }
  }
  return null;
}

/**
 * @param {import('./shared.js').ControlDefinition} control Matched definition.
 * @param {Node} node Claimed node.
 * @param {number[]} path Absolute path of the node.
 * @returns {ControlInstance} Instance with nested children.
 */
function instantiate(control, node, path) {
  /** @type {ControlInstance} */
  const instance = {
    controlId: control.id,
    icon: control.icon,
    priority: control.priority,
    path: [...path],
    node,
    children: [],
  };
  if (control.id === RICHTEXT_ID || typeof control.zones !== 'function') {
    return instance;
  }
  const zones = control.zones(node) || [];
  for (const zone of zones) {
    const maxPriority = zone.maxPriority ?? control.priority;
    const host = zone.node;
    if (!host) {
      continue;
    }
    if (host === node) {
      instance.children.push(...scanSlot(host.children || [], path, maxPriority));
      continue;
    }
    const zoneIndex = (node.children || []).indexOf(host);
    if (zoneIndex < 0) {
      // Nested deeper than one level (e.g. dl > dd): locate relative path.
      const relative = findChildPath(node, host);
      if (!relative) {
        continue;
      }
      instance.children.push(...scanSlot(host.children || [], [...path, ...relative], maxPriority));
      continue;
    }
    instance.children.push(...scanSlot(host.children || [], [...path, zoneIndex], maxPriority));
  }
  return instance;
}

/**
 * @param {Node} root Ancestor.
 * @param {Node} target Descendant element.
 * @returns {number[]|null} Relative path from root to target.
 */
function findChildPath(root, target) {
  /**
   * @param {Node} node Current node.
   * @param {number[]} walked Path so far.
   * @returns {number[]|null} Match.
   */
  function walk(node, walked) {
    if (node === target) {
      return walked;
    }
    const children = node.children || [];
    for (let index = 0; index < children.length; index += 1) {
      const found = walk(children[index], [...walked, index]);
      if (found) {
        return found;
      }
    }
    return null;
  }
  return walk(root, []);
}

/**
 * Scans sibling children of a slot, fusing unmatched runs into richtext.
 * @param {Node[]} children Sibling nodes.
 * @param {number[]} parentPath Path of the parent slot host.
 * @param {number} maxPriority Inclusive ceiling.
 * @returns {ControlInstance[]} Instances in document order.
 */
export function scanSlot(children, parentPath, maxPriority) {
  /** @type {ControlInstance[]} */
  const instances = [];
  let index = 0;
  const list = children || [];
  while (index < list.length) {
    const node = list[index];
    if (!isElement(node)) {
      index += 1;
      continue;
    }
    const path = [...parentPath, index];
    const control = claim(node, maxPriority);
    if (control) {
      instances.push(instantiate(control, node, path));
      index += 1;
      continue;
    }
    const start = index;
    /** @type {Node[]} */
    const range = [];
    while (index < list.length) {
      const current = list[index];
      if (!isElement(current)) {
        index += 1;
        continue;
      }
      if (claim(current, maxPriority)) {
        break;
      }
      range.push(current);
      index += 1;
    }
    if (!range.length) {
      index = Math.max(index, start + 1);
      continue;
    }
    const rich = getControl(RICHTEXT_ID);
    const span = index - start;
    instances.push({
      controlId: RICHTEXT_ID,
      icon: rich?.icon || 'paragraph',
      priority: rich?.priority ?? 10,
      path: [...parentPath, start],
      length: span,
      node: range.length === 1 ? range[0] : range,
      children: [],
    });
  }
  return instances;
}

/**
 * @param {Node} main Parsed main element.
 * @returns {ControlInstance[]} Page instances under main.
 */
export function walkPages(main) {
  /** @type {ControlInstance[]} */
  const pages = [];
  const pageControl = getControl('page');
  if (!main || !pageControl) {
    return pages;
  }
  (main.children || []).forEach((node, index) => {
    if (!pageControl.match(node)) {
      return;
    }
    pages.push(instantiate(pageControl, node, [index]));
  });
  return pages;
}

/**
 * @param {Node|null|undefined} documentRoot Full body/document tree that may contain #global-pages.
 * @returns {ControlInstance[]} Global root instances.
 */
export function walkGlobals(documentRoot) {
  const container = findById(documentRoot, GLOBAL_PAGES_ID);
  if (!container) {
    return [];
  }
  // Globals never host page/subpage (priority < 800); entries may use 750.
  return scanSlot(container.children || [], findPathById(documentRoot, GLOBAL_PAGES_ID) || [], 799);
}

/**
 * @param {Node|null|undefined} root Search root.
 * @param {string} id Element id.
 * @returns {Node|null} Matching element.
 */
function findById(root, id) {
  if (!root) {
    return null;
  }
  if (root.attrs?.id === id) {
    return root;
  }
  for (const child of root.children || []) {
    const found = findById(child, id);
    if (found) {
      return found;
    }
  }
  return null;
}

/**
 * @param {Node|null|undefined} root Search root.
 * @param {string} id Element id.
 * @param {number[]} [walked] Path so far.
 * @returns {number[]|null} Path to the element.
 */
function findPathById(root, id, walked = []) {
  if (!root) {
    return null;
  }
  if (root.attrs?.id === id) {
    return walked;
  }
  const children = root.children || [];
  for (let index = 0; index < children.length; index += 1) {
    const found = findPathById(children[index], id, [...walked, index]);
    if (found) {
      return found;
    }
  }
  return null;
}

/**
 * @param {Node} main Parsed main element.
 * @param {Node|null} [documentRoot] Optional broader tree for #global-pages.
 * @returns {{pages: ControlInstance[], globals: ControlInstance[]}} Editable roots.
 */
export function walkPackageContent(main, documentRoot = null) {
  return {
    pages: walkPages(main),
    globals: walkGlobals(documentRoot),
  };
}
