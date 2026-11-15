/**
 * @file Isolated preview document for the applied package content.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { htmlFragment } from './html.js';
import { serializeContent } from './serializer.js';

/**
 * @param {string} value CSS value.
 * @returns {boolean} Whether the value can be placed in a stylesheet.
 */
function safeCssValue(value) {
  return /^[#a-zA-Z0-9(),.%\s-]+$/.test(value);
}

/**
 * @param {string} value Text shown in the preview.
 * @returns {string} Escaped HTML.
 */
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * @param {import('./parser.js').Node|null|undefined} mainMenu Persisted main menu HTML tree.
 * @param {Array<{id: string, title: string}>} pages Fallback pages when the menu is empty.
 * @param {Object<string, string>} settings Package settings.
 * @returns {string} Menu, progress, and pagination chrome.
 */
function layoutChrome(mainMenu, pages, settings) {
  const menu = ['default', 'pills', 'tabs', 'horizontal', 'vertical'].includes(settings.menu) ? settings.menu : 'default';
  const progress = ['default', 'circle', 'horizontal', 'vertical'].includes(settings.progress) ? settings.progress : 'default';
  let navHtml = mainMenu ? serializeContent(mainMenu).trim() : '';
  if (navHtml) {
    const classes = `main menu-${menu}`;
    if (/\bclass="/i.test(navHtml)) {
      navHtml = navHtml.replace(/\bclass="([^"]*)"/i, (_, current) => {
        const tokens = new Set(`${current} ${classes}`.split(/\s+/).filter(Boolean));
        return `class="${[...tokens].join(' ')}"`;
      });
    }
    else {
      navHtml = navHtml.replace(/^<nav\b/i, `<nav class="${classes}"`);
    }
    if (!/\bdata-menu=/.test(navHtml)) {
      navHtml = navHtml.replace(/^<nav\b/i, `<nav data-menu="${menu}"`);
    }
  }
  else {
    const links = pages.map((page) => `<a data-page="${escapeHtml(page.id)}" href="#${escapeHtml(page.id)}">${escapeHtml(page.title)}</a>`).join('');
    navHtml = `<nav class="main menu-${menu}" data-menu="${menu}">${links}</nav>`;
  }
  const pagination = settings.pagination === 'false'
    ? ''
    : `<div id="tpy-page_number">1 / ${pages.length}</div>`;
  return `${navHtml}
<div id="tpy-measuring_progress" class="measuring-progress" data-type="${progress}">0%</div>
${pagination}`;
}

/**
 * @param {Array<{type: string, key: string, text: string, full: string}>} references Local references.
 * @returns {string} Automatic citation list grouped by type.
 */
function citationHtml(references) {
  const types = [...new Set(references.map((item) => item.type))];
  const groups = types.map((type) => {
    const entries = references.filter((item) => item.type === type).map((item) => {
      const full = item.full ? `<br>${escapeHtml(item.full)}` : '';
      return `<p>${escapeHtml(item.key)} ${escapeHtml(item.text)}${full}</p>`;
    }).join('');
    return `<section data-ref-type="${escapeHtml(type)}"><h2>${escapeHtml(type)}</h2>${entries}</section>`;
  }).join('');
  return `<div id="tpy-auto_citation">${groups}</div>`;
}

/**
 * Builds a static preview document. It does not include editor scripts.
 * @param {{html: string, variables?: Object<string, string>, mobile?: boolean, settings?: Object<string, string>, pages?: Array, mainMenu?: import('./parser.js').Node|null, references?: Array, view?: string, autoloadNote?: string}} options Applied content and theme.
 * @returns {string} HTML document for a sandboxed iframe.
 */
export function buildPreviewHtml({
  html,
  variables = {},
  mobile = false,
  settings = {},
  pages = [],
  mainMenu = null,
  references = [],
  view = 'content',
  autoloadNote = '',
}) {
  const custom = Object.entries(variables)
    .filter(([, value]) => safeCssValue(String(value)))
    .map(([name, value]) => `${name}: ${value};`)
    .join('');
  const body = view === 'presentation'
    ? `<header class="tpy-presentation">
  <h1>${settings.level ? `<span class="level">${escapeHtml(settings.level)}</span> ` : ''}${escapeHtml(settings.title || '')}</h1>
  <h2>${escapeHtml(settings.activityTitle || '')}</h2>
  <section class="tpy-intro">${htmlFragment(settings.intro || '', 'rich')}</section>
  <section class="tpy-objective">${htmlFragment(settings.objective || '', 'rich')}</section>
  <p class="tpy-duration">${escapeHtml(settings.duration || '')}</p>
  ${settings.autoload === 'true' && autoloadNote ? `<p>${escapeHtml(autoloadNote)}</p>` : ''}
</header>
<div id="play_scorm"><button type="button">Iniciar</button></div>`
    : `${layoutChrome(mainMenu, pages, settings)}
${html}
${citationHtml(references)}
<div id="tpy-pg_credits" data-global="credits">${escapeHtml(settings.credits || '')}</div>
<div id="tpy-pg_bibliography" data-global="library">${escapeHtml(settings.library || '')}</div>`;
  return `<!DOCTYPE html>
<html lang="${escapeHtml(settings.lang || 'es')}">
<head>
  <meta charset="utf-8">
  <style>
    :root { ${custom} }
    body { margin: 16px; background: var(--tepuy-color-bg, #f2f2f2); color: var(--tepuy-color-heading, #3f637e); font: 16px/1.5 sans-serif; }
    .box-text { padding: 8px 12px; margin: 8px 0; border-left: 4px solid var(--tepuy-color-heading, #3f637e); }
    .box-text[label]::before { content: attr(label); display: block; font-weight: 700; }
    .box-text.important { border-color: var(--tepuy-color-important, #e2793d); }
    .box-text.example { border-color: var(--tepuy-color-heading, #3f637e); }
    .box-text.note { border-color: #607d8b; }
    .box-text.link { border-color: #1565c0; }
    .box-text.connection { border-color: #6a1b9a; }
    .box-text.activity { border-color: #2e7d32; }
    .instruction { padding: 8px; margin: 8px 0; background: #eceff1; }
    .instruction[type="info"] { background: #e3f2fd; }
    .instruction[type="danger"] { background: #ffebee; }
    .instruction[type="alert"] { background: #fff8e1; }
    .instruction[type="none"] { background: transparent; }
    nav.main { display: flex; gap: 8px; margin-bottom: 12px; }
    nav.menu-vertical { flex-direction: column; }
    nav.menu-pills a { border-radius: 999px; background: var(--tepuy-color-heading, #3f637e); color: #fff; padding: 4px 10px; text-decoration: none; }
    nav.menu-tabs a { border-bottom: 2px solid var(--tepuy-color-important, #e2793d); text-decoration: none; }
    .measuring-progress[data-type="circle"] { width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center; border: 4px solid var(--tepuy-color-important, #e2793d); }
    .measuring-progress[data-type="horizontal"] { height: 8px; background: var(--tepuy-color-important, #e2793d); }
    .horizontal-menu, .vertical-menu { display: flex; gap: 8px; }
    .vertical-menu { flex-direction: column; }
    .horizontal-menu dt, .vertical-menu dt { font-weight: 700; }
    body[data-mobile-mode="false"] .onlymobile { display: none; }
    body[data-mobile-mode="true"] .notmobile { display: none; }
    #play_scorm button { font: inherit; padding: 8px 16px; }
  </style>
</head>
<body data-mobile-mode="${mobile ? 'true' : 'false'}">
${body}
</body>
</html>
`;
}
