/**
 * @file Tabs format-container control definition.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { classSet, el, tabPair, tabZones } from '../shared.js';

/** @type {import('../shared.js').ControlDefinition} */
export const tabs = {
  id: 'tabs',
  group: 'format',
  icon: 'tabs',
  priority: 600,
  phase: 'F4',
  insertable: true,
  match: (node) => {
    const names = classSet(node);
    return names.has('horizontal-menu') || names.has('vertical-menu');
  },
  zones: tabZones,
  create() {
    return el('div', { class: 'horizontal-menu' }, [tabPair('Pestaña 1'), tabPair('Pestaña 2')]);
  },
};
