/**
 * @file Quiz activity control definition.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { uniqueId } from '../../core/ids.js';
import { classSet, el, text } from '../shared.js';

/** @type {import('../shared.js').ControlDefinition} */
export const quiz = {
  id: 'quiz',
  group: 'activities',
  icon: 'circle-question',
  priority: 500,
  phase: 'F4',
  insertable: true,
  match: (node) => classSet(node).has('jpit-activities-quiz'),
  create({ ids }) {
    const actId = uniqueId('quiz', 'Cuestionario', ids);
    return el('div', { class: 'jpit-activities-quiz', 'data-act-id': actId, 'data-act-title': 'Cuestionario' }, [
      el('question', { type: 'simplechoice' }, [
        el('description', {}, [el('p', {}, [text('Pregunta')], 'paragraph')]),
        el('ul', {}, [
          el('li', { 'data-response': 'true' }, [text('Correcta')]),
          el('li', {}, [text('Otra respuesta')]),
        ]),
        el('feedback', {}, [el('correct', {}, [text('Correcto')])]),
      ]),
    ]);
  },
};
