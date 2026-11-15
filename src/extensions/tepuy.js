/**
 * @file Tepuy shell extension. Mounts the activity bar and the package menus.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { registerActivity } from '../ui/activity.js';
import { registerMenus } from '../ui/menus.js';

/**
 * Trusted extension that mounts the Tepuy editor on the Edy workbench.
 * @type {Object}
 */
export const tepuyShell = {
  id: 'tepuy.shell',
  apiVersion: '1',
  requires: [],

  /**
   * Registers commands, menus, and activity surfaces.
   * @param {Object} context Edy extension context.
   * @returns {void}
   */
  activate(context) {
    registerMenus(context);
    registerActivity(context);
  },
};
