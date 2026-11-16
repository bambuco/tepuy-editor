/**
 * @file Reference control definitions.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { classSet, el, text } from '../shared.js';

const REFERENCES = [
  { id: 'reference-image', icon: 'file-image', dataType: 'image', priority: 260 },
  { id: 'reference-video', icon: 'file-video', dataType: 'video', priority: 260 },
  { id: 'reference-audio', icon: 'file-audio', dataType: 'audio', priority: 260 },
  { id: 'reference-table', icon: 'table', dataType: 'table', priority: 260 },
  { id: 'reference-web', icon: 'globe', dataType: 'web', priority: 260 },
  { id: 'reference-book', icon: 'book', dataType: 'paper', priority: 260 },
  { id: 'reference-general', icon: 'bookmark', dataType: '', priority: 250 },
];

/** @type {import('../shared.js').ControlDefinition[]} */
export const references = REFERENCES.map((item) => ({
  id: item.id,
  group: 'references',
  icon: item.icon,
  priority: item.priority,
  phase: 'F4',
  insertable: true,
  match: (node) => {
    if (!classSet(node).has('about')) {
      return false;
    }
    if (!item.dataType) {
      return !node.attrs?.['data-type'];
    }
    return node.attrs?.['data-type'] === item.dataType;
  },
  create() {
    const attrs = { class: 'about', 'data-key': '[1]' };
    if (item.dataType) {
      attrs['data-type'] = item.dataType;
    }
    return el('div', attrs, [text('Descripción del recurso')]);
  },
}));
