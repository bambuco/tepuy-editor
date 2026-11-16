/**
 * @file Media control definitions.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { childZone, classSet, el, text } from '../shared.js';

/** @type {import('../shared.js').ControlDefinition[]} */
export const media = [
  {
    id: 'image',
    group: 'media',
    icon: 'image',
    priority: 220,
    phase: 'F4',
    insertable: true,
    match: (node) => node.tag === 'figure' && classSet(node).has('box_media'),
    create() {
      return el('figure', { class: 'box_media' }, [
        el('img', { alt: 'Imagen', src: 'content/imagen.png' }, [], 'image'),
        el('figcaption', {}, [text('Descripción')]),
      ]);
    },
  },
  {
    id: 'audio',
    group: 'media',
    icon: 'audio',
    priority: 220,
    phase: 'F4',
    insertable: true,
    match: (node) => node.tag === 'audio',
    create() {
      return el('audio', { controls: '', src: 'content/audio.mp3' });
    },
  },
  {
    id: 'video',
    group: 'media',
    icon: 'video',
    priority: 220,
    phase: 'F4',
    insertable: true,
    match: (node) => node.tag === 'video',
    create() {
      return el('video', { controls: '', src: 'content/video.mp4' });
    },
  },
  {
    id: 'table',
    group: 'media',
    icon: 'table',
    priority: 220,
    phase: 'F4',
    insertable: true,
    match: (node) => node.tag === 'table',
    create() {
      return el('table', { class: 'datatable' }, [
        el('thead', {}, [el('tr', {}, [el('th', {}, [text('Columna')])])]),
        el('tbody', {}, [el('tr', {}, [el('td', {}, [text('Dato')])])]),
      ]);
    },
  },
  {
    id: 'code',
    group: 'media',
    icon: 'code',
    priority: 220,
    phase: 'F4',
    insertable: true,
    match: (node) => node.tag === 'pre',
    create() {
      return el('pre', {}, [text('Código')]);
    },
  },
  {
    id: 'mobile-only',
    group: 'media',
    icon: 'mobile',
    priority: 220,
    phase: 'F4',
    insertable: true,
    match: (node) => classSet(node).has('onlymobile'),
    zones: childZone,
    create() {
      return el('span', { class: 'onlymobile' }, [text('Solo móvil')]);
    },
  },
  {
    id: 'desktop-only',
    group: 'media',
    icon: 'desktop',
    priority: 220,
    phase: 'F4',
    insertable: true,
    match: (node) => classSet(node).has('notmobile'),
    zones: childZone,
    create() {
      return el('span', { class: 'notmobile' }, [text('Solo escritorio')]);
    },
  },
];
