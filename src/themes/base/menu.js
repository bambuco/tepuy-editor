/**
 * @file Main menu item markup for the base theme.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * @param {string} pageId Page identifier.
 * @param {string} title Visible menu label.
 * @returns {import('../../core/parser.js').Node} Menu item node.
 */
function menuItem(pageId, title) {
  return {
    type: 'link',
    tag: 'a',
    attrs: { 'data-page': pageId },
    children: title ? [{ type: 'text', text: title }] : [],
  };
}

/**
 * @returns {import('../../core/parser.js').Node} Empty main menu container.
 */
export function emptyMainMenu() {
  return { type: 'element', tag: 'nav', attrs: { class: 'main' }, children: [] };
}

/**
 * Inserts a main-menu item after an existing [data-page] item, or at the end.
 * @param {import('../../core/parser.js').Node} nav Main menu root.
 * @param {{pageId: string, title: string, afterPageId?: string|null}} options Item to insert.
 * @returns {import('../../core/parser.js').Node} Updated menu tree.
 */
export function addMainMenuItem(nav, { pageId, title, afterPageId = null }) {
  const next = structuredClone(nav);
  const item = menuItem(pageId, title);
  const children = next.children || [];
  if (!afterPageId) {
    next.children = [...children, item];
    return next;
  }
  const index = children.findIndex((child) => child.attrs?.['data-page'] === afterPageId);
  if (index < 0) {
    next.children = [...children, item];
    return next;
  }
  next.children = [...children.slice(0, index + 1), item, ...children.slice(index + 1)];
  return next;
}
