/**
 * @file Page control definition.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { uniqueId } from '../../core/ids.js';
import { childZone, el, text, validId } from '../shared.js';

/** @type {import('../shared.js').ControlDefinition} */
export const page = {
  id: 'page',
  group: 'structure',
  icon: 'file',
  priority: 900,
  phase: 'F4',
  insertable: true,
  match: (node) => node.tag === 'section' && node.attrs?.ptitle !== undefined,
  zones: childZone,
  create({ ids, pageId, pageTitle }) {
    const title = pageTitle || 'Página';
    const nextId = pageId && validId(pageId) && !ids.has(pageId)
      ? pageId
      : uniqueId('pag', title, ids);
    return el('section', { id: nextId, ptitle: title }, [
      el('div', { class: 'subpage', 'data-title': 'Inicio' }, [
        el('h3', {}, [text('Inicio')], 'heading'),
      ], 'subpage'),
    ], 'page');
  },
};
