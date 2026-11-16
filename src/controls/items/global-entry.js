/**
 * @file Global entry control definition.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { childZone } from '../shared.js';

/** @type {import('../shared.js').ControlDefinition} */
export const globalEntry = {
  id: 'global-entry',
  group: 'structure',
  icon: 'globe',
  priority: 750,
  phase: 'F4',
  insertable: false,
  match: (node) => Boolean(node.attrs?.['data-global']),
  zones: childZone,
};
