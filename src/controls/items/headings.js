/**
 * @file Heading control definitions.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { el, text } from '../shared.js';

/** @type {import('../shared.js').ControlDefinition[]} */
export const headings = [2, 3, 4, 5].map((level) => ({
  id: `heading-${level}`,
  group: 'text',
  icon: 'heading',
  priority: 40,
  phase: 'F4',
  insertable: true,
  match: (node) => node.tag === `h${level}`,
  create() {
    return el(`h${level}`, {}, [text('Título')], 'heading');
  },
}));
