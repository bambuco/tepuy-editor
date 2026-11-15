/**
 * @file Writes a content node tree as stable HTML.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

/**
 * @param {string} value Text or attribute value.
 * @returns {string} Escaped HTML.
 */
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * @param {import('./parser.js').Node} node Content node.
 * @param {number} depth Indentation level.
 * @returns {string} HTML for the node.
 */
function serializeNode(node, depth) {
  const pad = '  '.repeat(depth);
  if (node.type === 'text') {
    return `${pad}${escapeHtml(node.text)}`;
  }
  if (node.type === 'comment') {
    return `${pad}<!--${node.text}-->`;
  }
  const attrs = Object.keys(node.attrs || {})
    .sort()
    .map((name) => ` ${name}="${escapeHtml(node.attrs[name])}"`)
    .join('');
  if (VOID_TAGS.has(node.tag)) {
    return `${pad}<${node.tag}${attrs}>`;
  }
  const children = node.children || [];
  if (children.length === 0) {
    return `${pad}<${node.tag}${attrs}></${node.tag}>`;
  }
  const inner = children.map((child) => serializeNode(child, depth + 1)).join('\n');
  return `${pad}<${node.tag}${attrs}>\n${inner}\n${pad}</${node.tag}>`;
}

/**
 * @param {import('./parser.js').Node} main Parsed main element.
 * @returns {string} Deterministic HTML.
 */
export function serializeContent(main) {
  return `${serializeNode(main, 0)}\n`;
}
