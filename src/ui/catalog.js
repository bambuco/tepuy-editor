/**
 * @file Insertable Tepuy controls shared by Edit and the Controls view.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { buildControlGroups, getControl } from '../controls/registry.js';
import { t } from '../i18n/messages.js';

/**
 * @typedef {Object} Control
 * @property {string} id Stable control identifier.
 * @property {string} icon Edy icon alias (Font Awesome) shown on the control button.
 * @property {string} phase Delivery phase that inserts this control.
 */

/**
 * @typedef {Object} ControlGroup
 * @property {string} id Group identifier.
 * @property {Control[]} controls Controls in menu order.
 */

/** @type {ControlGroup[]} */
export const CONTROL_GROUPS = buildControlGroups();

/**
 * @param {Control} control Catalog control.
 * @returns {string} Command identifier shared by Edit and the Controls view.
 */
export function controlCommandId(control) {
  return `insert.${control.id}`;
}

/**
 * @param {ControlGroup} group Catalog group.
 * @returns {string} Group name in the active locale.
 */
export function groupLabel(group) {
  return t(`menu.group.${group.id}`);
}

/**
 * @param {Control} control Catalog control.
 * @returns {string} Control name in the active locale.
 */
export function controlLabel(control) {
  return t(`menu.control.${control.id}`);
}

/**
 * @returns {Array<Control & {groupId: string, commandId: string, label: string, priority: number}>} Every insertable control.
 */
export function allControls() {
  return CONTROL_GROUPS.flatMap((group) => group.controls.map((control) => ({
    ...control,
    label: controlLabel(control),
    groupId: group.id,
    commandId: controlCommandId(control),
    priority: getControl(control.id)?.priority ?? 0,
  })));
}

/**
 * Edit submenus, one per catalog group. The parent has no command.
 * @returns {Array<{id: string, label: string, order: number, submenu: Array}>} Menu entries.
 */
export function editCategoryMenus() {
  return CONTROL_GROUPS.map((group, index) => ({
    id: group.id,
    label: groupLabel(group),
    order: 100 + index * 10,
    submenu: group.controls.map((control, controlIndex) => ({
      id: control.id,
      label: controlLabel(control),
      icon: control.icon,
      commandId: controlCommandId(control),
      order: (controlIndex + 1) * 10,
    })),
  }));
}

/**
 * @param {Control} control Catalog control.
 * @returns {string} Notice shown until the control can be inserted.
 */
export function insertionNotice(control) {
  return t('menu.notice.insert', { label: controlLabel(control), phase: control.phase });
}
