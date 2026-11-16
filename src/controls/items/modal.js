/**
 * @file Modal macro-container control definition.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { childZone, classSet, el, text } from '../shared.js';

/** @type {import('../shared.js').ControlDefinition} */
export const modal = {
  id: 'modal',
  group: 'macro',
  icon: 'cards',
  priority: 700,
  phase: 'F4',
  insertable: true,
  match: (node) => classSet(node).has('tepuy-modal'),
  zones: childZone,
  create() {
    return el('div', { class: 'tepuy-modal' }, [
      el('div', { class: 'tepuy-modal__body' }, [
        el('p', {}, [text('Contenido')], 'paragraph'),
      ]),
    ]);
  },
};
