/**
 * @file Isolated preview document for the applied package content.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

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
 * @param {string} html Full document or body fragment.
 * @returns {string} Inner body HTML.
 */
function bodyFromDocument(html) {
  if (!html) {
    return '';
  }
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return match ? match[1].trim() : html;
}

/**
 * Builds a static preview document. It does not include editor scripts.
 * @param {{html?: string, variables?: Object<string, string>, mobile?: boolean, settings?: Object<string, string>, view?: string, autoloadNote?: string, indexHtml?: string, contentHtml?: string}} options Applied content and theme.
 * @returns {string} HTML document for a sandboxed iframe.
 */
export function buildPreviewHtml({
  html = '',
  variables = {},
  mobile = false,
  settings = {},
  view = 'content',
  autoloadNote = '',
  indexHtml = '',
  contentHtml = '',
}) {
  const custom = Object.entries(variables)
    .filter(([, value]) => safeCssValue(String(value)))
    .map(([name, value]) => `${name}: ${value};`)
    .join('');
  let body;
  if (view === 'presentation') {
    if (indexHtml) {
      body = bodyFromDocument(indexHtml);
      if (settings.autoload === 'true' && autoloadNote) {
        body += `<p>${escapeHtml(autoloadNote)}</p>`;
      }
    }
    else {
      body = `<div id="content"></div><div id="play_scorm"><button type="button">Iniciar</button></div>`;
    }
  }
  else if (contentHtml) {
    body = bodyFromDocument(contentHtml);
  }
  else {
    body = bodyFromDocument(html) || html;
  }
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
