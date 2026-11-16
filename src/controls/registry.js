/**
 * @file Lookup helpers for registered control definitions.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { CONTROL_DEFINITIONS } from './items/index.js';

/** @type {Map<string, import('./shared.js').ControlDefinition>} */
const byId = new Map(CONTROL_DEFINITIONS.map((control) => [control.id, control]));

/**
 * @param {string} id Control identifier.
 * @returns {import('./shared.js').ControlDefinition|undefined} Definition, if registered.
 */
export function getControl(id) {
  return byId.get(id);
}

/**
 * @returns {import('./shared.js').ControlDefinition[]} Definitions in registration order.
 */
export function allDefinitions() {
  return [...CONTROL_DEFINITIONS];
}

/**
 * Controls that may claim a node, highest priority first; ties keep registration order.
 * @param {number} maxPriority Inclusive ceiling.
 * @returns {import('./shared.js').ControlDefinition[]} Matchable definitions.
 */
export function matchableControls(maxPriority = 999) {
  return CONTROL_DEFINITIONS
    .filter((control) => control.id !== 'richtext'
      && control.priority <= maxPriority
      && typeof control.match === 'function')
    .slice()
    .sort((left, right) => {
      if (right.priority !== left.priority) {
        return right.priority - left.priority;
      }
      return CONTROL_DEFINITIONS.indexOf(left) - CONTROL_DEFINITIONS.indexOf(right);
    });
}

/**
 * @param {string} id Control identifier.
 * @returns {number} Priority, or 0 when unknown.
 */
export function controlPriority(id) {
  return byId.get(id)?.priority ?? 0;
}

/**
 * Group insertable controls for Controles / Edit menus.
 * @returns {Array<{id: string, controls: Array<{id: string, icon: string, phase: string}>}>} Catalog groups.
 */
export function buildControlGroups() {
  /** @type {Map<string, Array<{id: string, icon: string, phase: string}>>} */
  const groups = new Map();
  for (const control of CONTROL_DEFINITIONS) {
    if (!control.insertable) {
      continue;
    }
    const list = groups.get(control.group) || [];
    list.push({ id: control.id, icon: control.icon, phase: control.phase });
    groups.set(control.group, list);
  }
  const order = [
    'structure',
    'text',
    'media',
    'blocks',
    'instructions',
    'macro',
    'format',
    'activities',
    'references',
  ];
  return order
    .filter((id) => groups.has(id))
    .map((id) => ({ id, controls: groups.get(id) }));
}
