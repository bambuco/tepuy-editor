/**
 * @file Mounts and disposes the Tepuy editor shell on an Edy instance.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { createEdy } from '../vendor/edy/src/index.js';
import { createHostClient } from './core/host.js';
import { loadThemeDocuments } from './core/themes.js';
import { tepuyShell } from './extensions/tepuy.js';
import { setEditorLocale } from './i18n/messages.js';
import { bindEditor, bindHost } from './ui/session.js';

/**
 * Editor instance currently mounted in the page, if any.
 * @type {Object|null}
 */
let editor = null;

/**
 * Mounts a new Edy instance for the Tepuy shell.
 * @returns {Promise<void>}
 */
export async function mountEditor() {
  const container = document.querySelector('#editor');
  if (!(container instanceof HTMLElement)) {
    throw new Error('The editor container is missing.');
  }
  const locale = 'es';
  setEditorLocale(locale);
  await loadThemeDocuments();
  editor = createEdy({
    container,
    locale,
    theme: 'system',
    logo: new URL('./assets/editor-icon.svg', import.meta.url).href,
    title: 'Tepuy',
    customCss: new URL('./ui/edy-tor.css', import.meta.url).href,
    initialState: {
      bottomPanel: { visible: false },
      preview: { visible: true },
    },
    services: {},
    extensions: [tepuyShell],
  });
  bindEditor(editor);
  bindHost(createHostClient());
  await editor.start();
}

/**
 * Disposes the mounted editor instance.
 * @returns {Promise<void>}
 */
export async function disposeEditor() {
  if (!editor) {
    return;
  }
  const current = editor;
  editor = null;
  bindEditor(null);
  await current.dispose();
}

const disposeButton = document.querySelector('#dispose');
disposeButton?.addEventListener('click', () => {
  disposeEditor().catch((error) => {
    console.error(error);
  });
});

await mountEditor();
