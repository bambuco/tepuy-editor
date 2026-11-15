/**
 * @file Main menu item markup for the perception theme (ul/li).
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * @param {string} pageId Page identifier.
 * @param {string} title Visible menu label.
 * @returns {import('../../core/parser.js').Node} List item with a data-page link.
 */
function menuItem(pageId, title) {
  return {
    type: 'element',
    tag: 'li',
    attrs: {},
    children: [{
      type: 'link',
      tag: 'a',
      attrs: { 'data-page': pageId },
      children: title ? [{ type: 'text', text: title }] : [],
    }],
  };
}

/**
 * @param {import('../../core/parser.js').Node} nav Main menu root.
 * @returns {import('../../core/parser.js').Node} The ul that holds items (created if missing).
 */
function ensureList(nav) {
  let list = (nav.children || []).find((child) => child.tag === 'ul');
  if (!list) {
    list = { type: 'element', tag: 'ul', attrs: { class: 'menu' }, children: [] };
    nav.children = [...(nav.children || []), list];
  }
  list.children = list.children || [];
  return list;
}

/**
 * @returns {import('../../core/parser.js').Node} Empty main menu container.
 */
export function emptyMainMenu() {
  return {
    type: 'element',
    tag: 'nav',
    attrs: { class: 'main' },
    children: [{ type: 'element', tag: 'ul', attrs: { class: 'menu' }, children: [] }],
  };
}

/**
 * Inserts a main-menu item after an existing [data-page] item, or at the end.
 * @param {import('../../core/parser.js').Node} nav Main menu root.
 * @param {{pageId: string, title: string, afterPageId?: string|null}} options Item to insert.
 * @returns {import('../../core/parser.js').Node} Updated menu tree.
 */
export function addMainMenuItem(nav, { pageId, title, afterPageId = null }) {
  const next = structuredClone(nav);
  const list = ensureList(next);
  const item = menuItem(pageId, title);
  const children = list.children;
  if (!afterPageId) {
    list.children = [...children, item];
    return next;
  }
  const index = children.findIndex((child) => (
    (child.children || []).some((node) => node.attrs?.['data-page'] === afterPageId)
  ));
  if (index < 0) {
    list.children = [...children, item];
    return next;
  }
  list.children = [...children.slice(0, index + 1), item, ...children.slice(index + 1)];
  return next;
}
