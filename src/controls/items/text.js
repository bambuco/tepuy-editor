/**
 * @file Text-related control definitions.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { classSet, el, firstPageId, text } from '../shared.js';

/** @type {import('../shared.js').ControlDefinition[]} */
export const textControls = [
  {
    id: 'htmlfree',
    group: 'text',
    icon: 'code',
    priority: 50,
    phase: 'F4',
    insertable: true,
    match: (node) => classSet(node).has('htmlfree'),
    create() {
      return el('div', { class: 'htmlfree' }, [text('')]);
    },
  },
  {
    id: 'internal-link',
    group: 'text',
    icon: 'link',
    priority: 40,
    phase: 'F4',
    insertable: true,
    match: (node) => node.tag === 'a' && Boolean(node.attrs?.['data-page'] || node.attrs?.['data-section']),
    create({ root }) {
      return el('a', { 'data-page': firstPageId(root) }, [text('Enlace')], 'link');
    },
  },
  {
    id: 'richtext',
    group: 'text',
    icon: 'paragraph',
    priority: 10,
    phase: 'F4',
    insertable: true,
    match: () => false,
    create() {
      return el('p', {}, [text('Texto')], 'paragraph');
    },
  },
];
