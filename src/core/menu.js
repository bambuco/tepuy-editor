/**
 * @file Main-menu HTML helpers: extract [data-page], rewrite ids, theme API.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { findTheme, presentPositions, themeContentTemplate } from './themes.js';
import * as baseMenu from '../themes/base/menu.js';
import * as perceptionMenu from '../themes/perception/menu.js';
import * as rutaticMenu from '../themes/rutatic/menu.js';

const THEME_MENUS = {
  base: baseMenu,
  perception: perceptionMenu,
  rutatic: rutaticMenu,
};

/**
 * @param {string} themeId Active theme.
 * @returns {typeof baseMenu} Theme menu API.
 */
function themeMenu(themeId) {
  return THEME_MENUS[themeId] || THEME_MENUS.base;
}

/**
 * @param {import('./parser.js').Node|null} node Content node.
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
 * @param {import('./parser.js').Node|null} node Candidate menu item.
 * @param {Array<{id: string, title: string, node: import('./parser.js').Node}>} found Collected items.
 * @returns {void}
 */
function walkMenuItems(node, found) {
  if (!node || node.type === 'text' || node.type === 'comment') {
    return;
  }
  if (node.attrs?.['data-page'] !== undefined) {
    found.push({
      id: node.attrs['data-page'] || '',
      title: plain(node),
      node,
    });
    return;
  }
  for (const child of node.children || []) {
    walkMenuItems(child, found);
  }
}

/**
 * Reads menu entries from any theme markup via [data-page].
 * @param {import('./parser.js').Node|null} nav Main menu root.
 * @returns {Array<{id: string, title: string}>} Menu items in document order.
 */
export function extractMainMenuItems(nav) {
  const found = [];
  walkMenuItems(nav, found);
  return found.map(({ id, title }) => ({ id, title }));
}

/**
 * @param {string} [themeId] Theme identifier.
 * @returns {import('./parser.js').Node} Empty main menu for that theme.
 */
export function emptyMainMenu(themeId = 'base') {
  return themeMenu(themeId).emptyMainMenu();
}

/**
 * @param {import('./parser.js').Node} nav Main menu root.
 * @param {string} themeId Theme identifier.
 * @param {{pageId: string, title: string, afterPageId?: string|null}} options Item to insert.
 * @returns {import('./parser.js').Node} Updated menu.
 */
export function addMainMenuItem(nav, themeId, options) {
  return themeMenu(themeId).addMainMenuItem(nav, options);
}

/**
 * Rewrites data-page attributes that matched oldId.
 * @param {import('./parser.js').Node} nav Main menu root.
 * @param {string} oldId Previous page id.
 * @param {string} newId Next page id.
 * @returns {import('./parser.js').Node} Cloned menu with updated attributes.
 */
export function rewriteMenuPageIds(nav, oldId, newId) {
  const next = structuredClone(nav);
  /**
   * @param {import('./parser.js').Node} node Current node.
   * @returns {void}
   */
  function visit(node) {
    if (node.attrs?.['data-page'] === oldId) {
      node.attrs = { ...node.attrs, 'data-page': newId };
    }
    for (const child of node.children || []) {
      visit(child);
    }
  }
  visit(next);
  return next;
}

/**
 * Rewrites data-page on content links (not the main menu).
 * @param {import('./parser.js').Node} root Content tree.
 * @param {string} oldId Previous page id.
 * @param {string} newId Next page id.
 * @returns {import('./parser.js').Node} Cloned tree.
 */
export function rewriteContentPageIds(root, oldId, newId) {
  const next = structuredClone(root);
  /**
   * @param {import('./parser.js').Node} node Current node.
   * @returns {void}
   */
  function visit(node) {
    if (node.attrs?.['data-page'] === oldId) {
      node.attrs = { ...node.attrs, 'data-page': newId };
    }
    for (const child of node.children || []) {
      visit(child);
    }
  }
  visit(next);
  return next;
}

/**
 * Updates the visible text of every [data-page] that matches pageId.
 * @param {import('./parser.js').Node} nav Main menu root.
 * @param {string} pageId Page identifier.
 * @param {string} title New label.
 * @returns {import('./parser.js').Node} Cloned menu.
 */
export function setMenuItemTitle(nav, pageId, title) {
  const next = structuredClone(nav);
  /**
   * @param {import('./parser.js').Node} node Current node.
   * @returns {void}
   */
  function visit(node) {
    if (node.attrs?.['data-page'] === pageId) {
      node.children = title ? [{ type: 'text', text: title }] : [];
      return;
    }
    for (const child of node.children || []) {
      visit(child);
    }
  }
  visit(next);
  return next;
}

/**
 * Removes the first [data-page] node (and its theme wrapper when it is a lone li).
 * @param {import('./parser.js').Node} nav Main menu root.
 * @param {string} pageId Page identifier to remove (first match).
 * @returns {import('./parser.js').Node} Cloned menu.
 */
export function removeMainMenuItem(nav, pageId) {
  const next = structuredClone(nav);
  /**
   * @param {import('./parser.js').Node} parent Parent node.
   * @returns {boolean} Whether a child was removed.
   */
  function visit(parent) {
    const children = parent.children || [];
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];
      if (child.attrs?.['data-page'] === pageId) {
        children.splice(index, 1);
        return true;
      }
      if (child.tag === 'li' && (child.children || []).some((node) => node.attrs?.['data-page'] === pageId)) {
        children.splice(index, 1);
        return true;
      }
      if (visit(child)) {
        return true;
      }
    }
    return false;
  }
  visit(next);
  return next;
}

/**
 * Fills an empty menu from existing pages (package migration).
 * @param {import('./parser.js').Node} nav Current menu.
 * @param {string} themeId Theme identifier.
 * @param {Array<{id: string, title: string}>} pages Package pages.
 * @returns {import('./parser.js').Node} Menu with one item per page when it was empty.
 */
export function ensureMainMenuFromPages(nav, themeId, pages) {
  if (extractMainMenuItems(nav).length > 0 || !pages.length) {
    return nav;
  }
  let menu = emptyMainMenu(themeId);
  let afterPageId = null;
  for (const page of pages) {
    menu = addMainMenuItem(menu, themeId, {
      pageId: page.id,
      title: page.title,
      afterPageId,
    });
    afterPageId = page.id;
  }
  return menu;
}

/**
 * @param {string} themeId Theme identifier.
 * @returns {boolean} Whether the theme content.html includes nav.main.
 */
export function themeHasMainMenu(themeId) {
  if (!findTheme(themeId)) {
    return false;
  }
  return presentPositions(themeContentTemplate(themeId)).includes('nav.main');
}
