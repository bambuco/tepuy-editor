/**
 * @file Shared helpers and types for control modules.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * @typedef {import('../core/parser.js').Node} Node
 */

/**
 * @typedef {Object} ControlZone
 * @property {Node} node Element whose children are scanned.
 * @property {number} [maxPriority] Ceiling for child controls; defaults to the parent control priority.
 */

/**
 * @typedef {Object} CreateContext
 * @property {Set<string>} ids Identifiers already used in the package.
 * @property {Node} root Content tree root (main).
 * @property {string} [pageId] Optional page id when creating a page.
 * @property {string} [pageTitle] Optional page title when creating a page.
 */

/**
 * @typedef {Object} ControlDefinition
 * @property {string} id Stable control identifier.
 * @property {string} group Catalog group identifier.
 * @property {string} icon Edy icon alias.
 * @property {number} priority Higher values are matched first (10–999).
 * @property {string} phase Delivery phase.
 * @property {boolean} insertable Whether the control appears in Controles / Edit.
 * @property {(node: Node) => boolean} match Exact recognition of a content node.
 * @property {(node: Node) => ControlZone[]} [zones] Nested slots to re-scan.
 * @property {(context: CreateContext) => Node|null} [create] Builds a new control node.
 */

/** Synthetic id used by the walker fallback. */
export const RICHTEXT_ID = 'richtext';

/** Package container for global content roots. */
export const GLOBAL_PAGES_ID = 'global-pages';

/**
 * @param {Node|null|undefined} node Content node.
 * @returns {Set<string>} Class tokens.
 */
export function classSet(node) {
  return new Set((node?.attrs?.class || '').split(/\s+/).filter(Boolean));
}

/**
 * @param {Node} node Parent with `dd` tab panels.
 * @returns {ControlZone[]} Zones for tab bodies.
 */
export function tabZones(node) {
  /** @type {ControlZone[]} */
  const zones = [];
  for (const pair of node.children || []) {
    if (pair.tag !== 'dl') {
      continue;
    }
    for (const child of pair.children || []) {
      if (child.tag === 'dd') {
        zones.push({ node: child });
      }
    }
  }
  return zones;
}

/**
 * @param {Node} node Container whose element children are scanned.
 * @returns {ControlZone[]} Single zone over the node itself.
 */
export function childZone(node) {
  return [{ node }];
}

/**
 * @param {string} tag Element name.
 * @param {Object<string, string>} attrs Attributes.
 * @param {Node[]} children Child nodes.
 * @param {string} [type] Editor node type.
 * @returns {Node} Content node.
 */
export function el(tag, attrs, children, type = 'element') {
  return { type, tag, attrs: { ...attrs }, children };
}

/**
 * @param {string} value Visible text.
 * @returns {Node} Text node.
 */
export function text(value) {
  return { type: 'text', text: value };
}

/**
 * @param {string} value Candidate identifier.
 * @returns {boolean} Whether the value is a usable id.
 */
export function validId(value) {
  return typeof value === 'string' && /^[a-z][a-z0-9-]*$/i.test(value);
}

/**
 * @param {Node} root Content tree.
 * @returns {string} Identifier of the first page.
 */
export function firstPageId(root) {
  return root.children?.find((node) => node.type === 'page' || node.attrs?.ptitle !== undefined)?.attrs?.id || '';
}

/**
 * @param {string} title Tab title.
 * @returns {Node} One tab without an internal id.
 */
export function tabPair(title) {
  return el('dl', {}, [
    el('dt', {}, [text(title)]),
    el('dd', {}, [el('p', {}, [text('Contenido')], 'paragraph')]),
  ]);
}
