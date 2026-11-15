/**
 * @file Insertable Tepuy controls shared by Edit and the Controls view.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { t } from '../i18n/messages.js';

/**
 * @typedef {Object} Control
 * @property {string} id Stable control identifier.
 * @property {string} icon Short icon shown on the control button.
 * @property {string} phase Delivery phase that inserts this control.
 */

/**
 * @typedef {Object} ControlGroup
 * @property {string} id Group identifier.
 * @property {Control[]} controls Controls in menu order.
 */

/** @type {ControlGroup[]} */
export const CONTROL_GROUPS = [
  {
    id: 'structure',
    controls: [
      { id: 'page', icon: 'Pá', phase: 'F4' },
      { id: 'subpage', icon: 'Sb', phase: 'F4' },
    ],
  },
  {
    id: 'text',
    controls: [
      { id: 'paragraph', icon: '¶', phase: 'F4' },
      { id: 'heading-2', icon: 'H2', phase: 'F4' },
      { id: 'heading-3', icon: 'H3', phase: 'F4' },
      { id: 'heading-4', icon: 'H4', phase: 'F4' },
      { id: 'heading-5', icon: 'H5', phase: 'F4' },
      { id: 'list', icon: '•', phase: 'F4' },
      { id: 'internal-link', icon: '↗', phase: 'F4' },
      { id: 'quote', icon: '«', phase: 'F4' },
      { id: 'bold', icon: 'B', phase: 'F4' },
      { id: 'italic', icon: 'I', phase: 'F4' },
    ],
  },
  {
    id: 'media',
    controls: [
      { id: 'image', icon: '▣', phase: 'F4' },
      { id: 'audio', icon: '♪', phase: 'F4' },
      { id: 'video', icon: '▶', phase: 'F4' },
      { id: 'table', icon: '⊞', phase: 'F4' },
      { id: 'code', icon: '</>', phase: 'F4' },
      { id: 'mobile-only', icon: 'Mó', phase: 'F4' },
      { id: 'desktop-only', icon: 'Es', phase: 'F4' },
    ],
  },
  {
    id: 'blocks',
    controls: [
      { id: 'important', icon: '!', phase: 'F4' },
      { id: 'example', icon: 'Ej', phase: 'F4' },
      { id: 'note', icon: 'No', phase: 'F4' },
      { id: 'link-box', icon: '⧉', phase: 'F4' },
      { id: 'connection', icon: '⇄', phase: 'F4' },
      { id: 'activity-box', icon: '★', phase: 'F4' },
    ],
  },
  {
    id: 'instructions',
    controls: [
      { id: 'instruction-info', icon: 'i', phase: 'F4' },
      { id: 'instruction-danger', icon: '✕', phase: 'F4' },
      { id: 'instruction-warning', icon: '△', phase: 'F4' },
      { id: 'instruction-none', icon: '○', phase: 'F4' },
      { id: 'instruction-default', icon: '●', phase: 'F4' },
    ],
  },
  {
    id: 'format',
    controls: [
      { id: 'tabs', icon: '▤', phase: 'F4' },
      { id: 'accordion', icon: '≡', phase: 'F7' },
      { id: 'cards', icon: '▦', phase: 'F7' },
      { id: 'timeline', icon: '→', phase: 'F7' },
      { id: 'gallery', icon: '▩', phase: 'F7' },
      { id: 'interactive-video', icon: '⏯', phase: 'F7' },
    ],
  },
  {
    id: 'activities',
    controls: [
      { id: 'quiz', icon: '?', phase: 'F4' },
      { id: 'cloze', icon: '[]', phase: 'F7' },
      { id: 'drag-drop', icon: '↔', phase: 'F7' },
      { id: 'crossword', icon: '#', phase: 'F7' },
      { id: 'word-search', icon: 'A', phase: 'F7' },
      { id: 'match', icon: '⇔', phase: 'F7' },
    ],
  },
  {
    id: 'references',
    controls: [
      { id: 'reference-image', icon: '▣', phase: 'F4' },
      { id: 'reference-video', icon: '▶', phase: 'F4' },
      { id: 'reference-audio', icon: '♪', phase: 'F4' },
      { id: 'reference-table', icon: '⊞', phase: 'F4' },
      { id: 'reference-web', icon: 'W', phase: 'F4' },
      { id: 'reference-book', icon: 'Li', phase: 'F4' },
      { id: 'reference-general', icon: 'G', phase: 'F4' },
    ],
  },
  {
    id: 'presentation',
    controls: [
      { id: 'intro', icon: 'In', phase: 'F4' },
      { id: 'objective', icon: 'Ob', phase: 'F4' },
      { id: 'duration', icon: 'Du', phase: 'F4' },
      { id: 'title', icon: 'Tí', phase: 'F4' },
    ],
  },
];

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
 * @returns {Array<Control & {groupId: string, commandId: string, label: string}>} Every insertable control.
 */
export function allControls() {
  return CONTROL_GROUPS.flatMap((group) => group.controls.map((control) => ({
    ...control,
    label: controlLabel(control),
    groupId: group.id,
    commandId: controlCommandId(control),
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
