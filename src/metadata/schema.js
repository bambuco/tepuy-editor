/**
 * @file Base educational metadata schema for index.html.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * @typedef {Object} MetadataField
 * @property {string} id Stable English identifier.
 * @property {'text'|'rich'|'number'|'select'} kind Editor control kind.
 * @property {string[]} [options] Canonical select values.
 * @property {string[]} [units] Units for number fields.
 * @property {string} [defaultUnit] Default unit when absent.
 */

/** @type {MetadataField[]} */
export const BASE_METADATA = [
  { id: 'topic', kind: 'text' },
  { id: 'title', kind: 'text' },
  { id: 'description', kind: 'rich' },
  { id: 'objective', kind: 'rich' },
  { id: 'participation', kind: 'select', options: ['individual', 'group'] },
  { id: 'modality', kind: 'select', options: ['in_person', 'blended', 'online'] },
  { id: 'duration', kind: 'number', units: ['hours', 'minutes'], defaultUnit: 'hours' },
  { id: 'synchronicity', kind: 'select', options: ['sync', 'async'] },
];

/** @type {Map<string, MetadataField>} */
const byId = new Map(BASE_METADATA.map((field) => [field.id, field]));

/**
 * @param {string} id Metadata key.
 * @returns {MetadataField|undefined} Base field, if registered.
 */
export function getMetadataField(id) {
  return byId.get(id);
}

/**
 * @param {string} key Metadata data-key.
 * @returns {'text'|'rich'|'number'|'select'} Kind used by the editor.
 */
export function resolveMetadataKind(key) {
  return byId.get(key)?.kind || 'rich';
}

/**
 * Legacy presentation keys mapped onto the base schema.
 * @type {Object<string, string>}
 */
export const LEGACY_METADATA_MAP = {
  intro: 'description',
  objective: 'objective',
  title: 'title',
  duration: 'duration',
};
