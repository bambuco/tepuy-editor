/**
 * @file Instruction control definitions.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { classSet, el, text } from '../shared.js';

const INSTRUCTIONS = [
  { id: 'instruction-info', icon: 'info', type: 'info', priority: 280 },
  { id: 'instruction-danger', icon: 'error', type: 'danger', priority: 280 },
  { id: 'instruction-warning', icon: 'warning', type: 'alert', priority: 280 },
  { id: 'instruction-none', icon: 'circle', type: 'none', priority: 280 },
  { id: 'instruction-default', icon: 'check-circle', type: '', priority: 270 },
];

/** @type {import('../shared.js').ControlDefinition[]} */
export const instructions = INSTRUCTIONS.map((item) => ({
  id: item.id,
  group: 'instructions',
  icon: item.icon,
  priority: item.priority,
  phase: 'F4',
  insertable: true,
  match: (node) => {
    if (!classSet(node).has('instruction')) {
      return false;
    }
    if (!item.type) {
      return !node.attrs?.type;
    }
    return node.attrs?.type === item.type;
  },
  create() {
    const attrs = { class: 'instruction' };
    if (item.type) {
      attrs.type = item.type;
    }
    return el('div', attrs, [text('Instrucción')]);
  },
}));
