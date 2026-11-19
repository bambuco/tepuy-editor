/**
 * @file Isolated preview document for the applied package content.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { DEFAULT_LANGUAGE, parseOverrides, serializeBase, serializeOverrides } from '../tepuy/lang/index.js';

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

/** Rules that approximate control chrome before the theme stylesheet. */
const CONTROL_CSS = `
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
    #play_scorm button { font: inherit; padding: 8px 16px; }`;

/**
 * @param {string} css Stylesheet text placed inside a style element.
 * @returns {string} Text that cannot close the surrounding style element.
 */
function embedCss(css) {
  return String(css || '').replace(/</g, '\\3C ');
}

/**
 * @param {string} path CSS url path.
 * @returns {string} Pattern that matches that path inside url().
 */
function urlPattern(path) {
  const escaped = String(path).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`url\\(\\s*(['"]?)${escaped}\\1\\s*\\)`, 'g');
}

/**
 * Rewrites theme asset urls for an inlined preview stylesheet.
 * Assigned resources point at content data URLs. Other assets stay on the theme.
 * @param {string} css Theme stylesheet.
 * @param {{resources?: Array<{name?: string, default?: string}>, assignments?: Object<string, string>, assetBase?: string, contentUrls?: Object<string, string>}} [options] Replacement map.
 * @returns {string} Stylesheet safe to embed.
 */
export function rewriteThemeCss(css, { resources = [], assignments = {}, assetBase = '', contentUrls = {} } = {}) {
  let next = String(css || '');
  for (const resource of resources) {
    const assigned = resource?.name ? assignments[resource.name] : '';
    const target = assigned ? contentUrls[assigned] : '';
    if (!resource?.default || !target) {
      continue;
    }
    next = next.replace(urlPattern(resource.default), `url("${target}")`);
  }
  if (assetBase) {
    next = next.replace(/url\(\s*(['"]?)(assets\/[^'")\s]+)\1\s*\)/g, (_match, _quote, path) => {
      const absolute = new URL(path, assetBase).href;
      return `url("${absolute}")`;
    });
  }
  return embedCss(next);
}

/**
 * @param {Object<string, string>} variables Theme custom properties.
 * @returns {string} Declarations that are safe inside :root.
 */
function rootDeclarations(variables) {
  return Object.entries(variables)
    .filter(([name, value]) => /^--[a-zA-Z0-9-]+$/.test(name) && safeCssValue(String(value)))
    .map(([name, value]) => `${name}: ${value};`)
    .join('');
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
 * @param {string} source Script source placed in the preview.
 * @returns {string} Source that cannot close the script element.
 */
function embedScript(source) {
  return String(source || '').replaceAll('<', '\\u003c');
}

/**
 * @param {string} lang Package language.
 * @param {string} customSource custom/lang.js text.
 * @returns {string} Base catalog script followed by the override script.
 */
function languageScripts(lang, customSource) {
  const base = serializeBase(lang) || serializeBase(DEFAULT_LANGUAGE) || '';
  const parsed = parseOverrides(customSource || '');
  const custom = parsed.ok ? serializeOverrides(parsed.overrides) : '';
  return `<script>${embedScript(base)}</script>\n<script>${embedScript(custom)}</script>`;
}

/**
 * Builds a preview document. It includes the package language scripts and no editor scripts.
 * @param {{html?: string, variables?: Object<string, string>, mobile?: boolean, settings?: Object<string, string>, view?: string, autoloadNote?: string, indexHtml?: string, contentHtml?: string, themeCss?: string, resources?: Array<{name?: string, default?: string}>, assignments?: Object<string, string>, assetBase?: string, contentUrls?: Object<string, string>, desktopCss?: string, mobileCss?: string, customLang?: string}} options Applied content and theme.
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
  themeCss = '',
  resources = [],
  assignments = {},
  assetBase = '',
  contentUrls = {},
  desktopCss = '',
  mobileCss = '',
  customLang = '',
}) {
  const custom = rootDeclarations(variables);
  const themeSheet = rewriteThemeCss(themeCss, { resources, assignments, assetBase, contentUrls });
  const userSheet = embedCss((mobile ? mobileCss : desktopCss) || '').trim();
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
  const lang = settings.lang || DEFAULT_LANGUAGE;
  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8">
  ${languageScripts(lang, customLang)}
  <style>
    :root { ${custom} }
${CONTROL_CSS}
${themeSheet}
${userSheet}
  </style>
</head>
<body data-mobile-mode="${mobile ? 'true' : 'false'}">
${body}
</body>
</html>
`;
}
