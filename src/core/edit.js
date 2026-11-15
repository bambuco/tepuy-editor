/**
 * @file Pending text edits that stay out of the document until Apply.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * @param {import('./parser.js').Node} root Content tree.
 * @param {number[]} path Child indexes from the root.
 * @returns {import('./parser.js').Node|null} Node at that path.
 */
export function nodeAt(root, path) {
  let node = root;
  for (const index of path || []) {
    node = node?.children?.[index];
    if (!node) {
      return null;
    }
  }
  return node ?? null;
}

/**
 * @param {import('./parser.js').Node} node Content node.
 * @returns {string} Visible text of the node.
 */
function plainText(node) {
  if (node.type === 'text') {
    return node.text || '';
  }
  return (node.children || []).map(plainText).join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * @param {import('./parser.js').Node|null} node Content node.
 * @returns {boolean} Whether Apply can replace its editable value.
 */
export function canEditValue(node) {
  if (!node) {
    return false;
  }
  if (node.type === 'page' || node.type === 'subpage' || node.type === 'box' || node.type === 'image') {
    return true;
  }
  return (node.children || []).every((child) => child.type === 'text');
}

/**
 * @param {import('./parser.js').Node|null} node Content node.
 * @returns {string} Value shown in the properties field.
 */
export function editableValue(node) {
  if (!node) {
    return '';
  }
  if (node.type === 'page') {
    return node.attrs?.ptitle || '';
  }
  if (node.type === 'subpage') {
    return node.attrs?.['data-title'] || '';
  }
  if (node.type === 'box') {
    return node.attrs?.label || '';
  }
  if (node.type === 'image') {
    return node.attrs?.alt || '';
  }
  return plainText(node);
}

/**
 * @param {import('./parser.js').Node} root Content tree.
 * @param {number[]} path Child indexes from the root.
 * @param {string} value Next editable value.
 * @returns {import('./parser.js').Node|null} Cloned tree, or null when the path cannot be edited.
 */
export function withEditableValue(root, path, value) {
  const next = structuredClone(root);
  const node = nodeAt(next, path);
  if (!canEditValue(node)) {
    return null;
  }
  if (node.type === 'page') {
    node.attrs = { ...node.attrs, ptitle: value };
  }
  else if (node.type === 'subpage') {
    node.attrs = { ...node.attrs, 'data-title': value };
  }
  else if (node.type === 'box') {
    node.attrs = { ...node.attrs, label: value };
  }
  else if (node.type === 'image') {
    node.attrs = { ...node.attrs, alt: value };
  }
  else {
    node.children = value ? [{ type: 'text', text: value }] : [];
  }
  return next;
}
