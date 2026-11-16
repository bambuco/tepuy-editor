/**
 * @file Subpage control definition.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { childZone, classSet, el, text } from '../shared.js';

/** @type {import('../shared.js').ControlDefinition} */
export const subpage = {
  id: 'subpage',
  group: 'structure',
  icon: 'file-lines',
  priority: 800,
  phase: 'F4',
  insertable: true,
  match: (node) => node.tag === 'div' && classSet(node).has('subpage'),
  zones: childZone,
  create() {
    return el('div', { class: 'subpage', 'data-title': 'Subpágina' }, [
      el('h3', {}, [text('Subpágina')], 'heading'),
    ], 'subpage');
  },
};
