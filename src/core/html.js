/**
 * @file Sanitized HTML fragments for control text and the presentation page.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const INLINE_TAGS = new Set(['br', 'strong', 'em', 'a']);
const BLOCK_TAGS = new Set(['p', 'br', 'strong', 'em', 'a']);
const RICH_TAGS = new Set(['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li']);
const DROP_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta']);
const VOID_TAGS = new Set(['br']);

/**
 * @param {'inline'|'block'|'rich'} mode Fragment vocabulary.
 * @returns {Set<string>} Tags kept in that mode.
 */
function allowedTags(mode) {
  if (mode === 'rich') {
    return RICH_TAGS;
  }
  if (mode === 'block') {
    return BLOCK_TAGS;
  }
  return INLINE_TAGS;
}

/**
 * @param {string} value Candidate link.
 * @returns {string} A safe href, or an empty string.
 */
function safeHref(value) {
  const href = String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!href || /^(javascript|data|vbscript):/i.test(href)) {
    return '';
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) && !/^(https?:|mailto:)/i.test(href)) {
    return '';
  }
  return href;
}

/**
 * @param {string} value Text node.
 * @returns {string} Collapsed text. Empty when the node is only whitespace.
 */
function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

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
 * @param {globalThis.Node} domNode DOM node from a fragment.
 * @param {Set<string>} allowed Tags that stay wrapped.
 * @returns {import('./parser.js').Node[]} Kept editor nodes.
 */
function cleanNode(domNode, allowed) {
  if (domNode.nodeType === 3) {
    const text = cleanText(domNode.textContent);
    return text ? [{ type: 'text', text }] : [];
  }
  if (domNode.nodeType !== 1) {
    return [];
  }
  const tag = domNode.tagName.toLowerCase();
  if (DROP_TAGS.has(tag)) {
    return [];
  }
  const children = [...domNode.childNodes].flatMap((child) => cleanNode(child, allowed));
  if (!allowed.has(tag)) {
    return children;
  }
  /** @type {Object<string, string>} */
  const attrs = {};
  if (tag === 'a') {
    const href = safeHref(domNode.getAttribute('href') || '');
    if (!href) {
      return children;
    }
    attrs.href = href;
  }
  return [{
    type: tag === 'p' ? 'paragraph' : 'element',
    tag,
    attrs,
    children: VOID_TAGS.has(tag) ? [] : children,
  }];
}

/**
 * @param {string} html Untrusted HTML.
 * @param {'inline'|'block'|'rich'} [mode] Allowed vocabulary.
 * @param {typeof DOMParser} [Parser] DOM parser constructor.
 * @returns {import('./parser.js').Node[]} Sanitized child nodes.
 */
export function sanitizeHtml(html, mode = 'inline', Parser = globalThis.DOMParser) {
  const source = String(html || '');
  if (!source.trim()) {
    return [];
  }
  const document = new Parser().parseFromString(`<div id="tepuy-html">${source}</div>`, 'text/html');
  const root = document.getElementById('tepuy-html') || document.querySelector('#tepuy-html');
  if (!root) {
    return [];
  }
  return [...root.childNodes].flatMap((child) => cleanNode(child, allowedTags(mode)));
}

/**
 * @param {import('./parser.js').Node} node Editor node.
 * @returns {string} Compact HTML for the node.
 */
function serializeNode(node) {
  if (node.type === 'text') {
    return escapeHtml(node.text || '');
  }
  const attrs = Object.keys(node.attrs || {})
    .sort()
    .map((name) => ` ${name}="${escapeHtml(node.attrs[name])}"`)
    .join('');
  if (VOID_TAGS.has(node.tag)) {
    return `<${node.tag}${attrs}>`;
  }
  const inner = (node.children || []).map(serializeNode).join('');
  return `<${node.tag}${attrs}>${inner}</${node.tag}>`;
}

/**
 * @param {import('./parser.js').Node[]} nodes Sanitized nodes.
 * @returns {string} Compact HTML.
 */
export function serializeFragment(nodes) {
  return (nodes || []).map(serializeNode).join('');
}

/**
 * @param {string} html Untrusted HTML.
 * @param {'inline'|'block'|'rich'} [mode] Allowed vocabulary.
 * @param {typeof DOMParser} [Parser] DOM parser constructor.
 * @returns {string} Sanitized compact HTML.
 */
export function htmlFragment(html, mode = 'inline', Parser = globalThis.DOMParser) {
  return serializeFragment(sanitizeHtml(html, mode, Parser));
}
