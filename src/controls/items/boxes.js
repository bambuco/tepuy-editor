/**
 * @file Box-text block control definitions.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { classSet, el, text } from '../shared.js';

const BOXES = [
  { id: 'important', icon: 'warning', className: 'important', label: 'Importante' },
  { id: 'example', icon: 'lightbulb', className: 'example', label: 'Ejemplo' },
  { id: 'note', icon: 'note', className: 'note', label: 'Nota' },
  { id: 'link-box', icon: 'link', className: 'link', label: 'Enlace' },
  { id: 'connection', icon: 'share', className: 'connection', label: 'Conexión' },
  { id: 'activity-box', icon: 'puzzle', className: 'activity', label: 'Actividad de aprendizaje' },
];

/** @type {import('../shared.js').ControlDefinition[]} */
export const boxes = BOXES.map((box) => ({
  id: box.id,
  group: 'blocks',
  icon: box.icon,
  priority: 300,
  phase: 'F4',
  insertable: true,
  match: (node) => classSet(node).has('box-text') && classSet(node).has(box.className),
  create() {
    return el('div', { class: `box-text ${box.className}`, label: box.label }, [
      el('p', {}, [text('Texto')], 'paragraph'),
    ], 'box');
  },
}));
