/**
 * @file Reads package content HTML into a stable node tree.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/** @typedef {{type: string, tag?: string, attrs?: Object<string, string>, text?: string, children?: Node[]}} Node */

const HEADING = /^h[2-5]$/;

/**
 * @param {Element} element DOM element.
 * @returns {Object<string, string>} Attributes sorted by name.
 */
function readAttributes(element) {
  const attrs = {};
  for (const attribute of [...element.attributes].sort((left, right) => left.name.localeCompare(right.name))) {
    attrs[attribute.name] = attribute.value;
  }
  return attrs;
}

/**
 * @param {string} tag Element name.
 * @param {Object<string, string>} attrs Attributes.
 * @returns {string} Editor node type.
 */
function classify(tag, attrs) {
  const classes = new Set((attrs.class || '').split(/\s+/).filter(Boolean));
  if (tag === 'section' && attrs.id) {
    return 'page';
  }
  if (tag === 'div' && classes.has('subpage')) {
    return 'subpage';
  }
  if (tag === 'div' && classes.has('box-text')) {
    return 'box';
  }
  if (HEADING.test(tag)) {
    return 'heading';
  }
  if (tag === 'p') {
    return 'paragraph';
  }
  if (tag === 'img') {
    return 'image';
  }
  if (tag === 'a' && (attrs['data-page'] || attrs['data-section'])) {
    return 'link';
  }
  return 'element';
}

/**
 * @param {globalThis.Node} domNode DOM node.
 * @returns {Node|null} Editor node, or null for ignorable whitespace.
 */
function parseDomNode(domNode) {
  if (domNode.nodeType === 3) {
    const text = domNode.textContent.replace(/\s+/g, ' ').trim();
    return text ? { type: 'text', text } : null;
  }
  if (domNode.nodeType === 8) {
    return { type: 'comment', text: domNode.textContent };
  }
  if (domNode.nodeType !== 1) {
    return null;
  }
  const tag = domNode.tagName.toLowerCase();
  const attrs = readAttributes(domNode);
  const children = [...domNode.childNodes].map(parseDomNode).filter(Boolean);
  return { type: classify(tag, attrs), tag, attrs, children };
}

/**
 * @param {Document} document Parsed content document.
 * @returns {Node} The main content element.
 */
export function parseContentDocument(document) {
  const main = document.querySelector('main');
  if (!main) {
    throw new Error('content.html has no main element.');
  }
  return parseDomNode(main);
}

/**
 * @param {Document} document Parsed content document.
 * @returns {Node|null} Main menu nav, or null when absent.
 */
export function parseMainMenuDocument(document) {
  const nav = document.querySelector('nav.main');
  return nav ? parseDomNode(nav) : null;
}

/**
 * @param {string} html content.html source.
 * @param {typeof DOMParser} [Parser] DOM parser constructor. Defaults to the platform parser.
 * @returns {Node} The main content element.
 */
export function parseContentHtml(html, Parser = globalThis.DOMParser) {
  const document = new Parser().parseFromString(html, 'text/html');
  return parseContentDocument(document);
}

/**
 * @param {string} html content.html source.
 * @param {typeof DOMParser} [Parser] DOM parser constructor.
 * @returns {Node|null} Main menu nav from the package, or null when absent.
 */
export function parseMainMenuHtml(html, Parser = globalThis.DOMParser) {
  const document = new Parser().parseFromString(html, 'text/html');
  return parseMainMenuDocument(document);
}
