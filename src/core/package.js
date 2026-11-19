/**
 * @file Package settings for content.html and globals.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { DEFAULT_LANGUAGE, languageCodes } from '../tepuy/lang/index.js';
import { emptyMainMenu, ensureMainMenuFromPages } from './menu.js';
import { applyMetadataValues } from '../metadata/index-document.js';
import { parseContentHtml, parseGlobalPagesHtml, parseMainMenuHtml } from './parser.js';
import { serializeContent } from './serializer.js';
import { themeContentTemplate } from './themes.js';

/**
 * @param {import('./parser.js').Node} main Content tree.
 * @returns {Array<{id: string, title: string}>} Pages under main.
 */
function pagesFromMain(main) {
  return (main.children || []).filter((node) => node.type === 'page').map((node) => ({
    id: node.attrs?.id || '',
    title: node.attrs?.ptitle || node.attrs?.id || '',
  }));
}

/** @type {Object<string, string>} Values used when an attribute is absent. */
export const PACKAGE_DEFAULTS = {
  lang: DEFAULT_LANGUAGE,
  title: '',
  single: 'false',
  displayMode: 'onlypages',
  approveLimit: '100',
  activitiesPercentage: '60',
  model: 'scorm',
  mobileMode: 'true',
  menu: 'default',
  progress: 'default',
  pagination: 'true',
  credits: '',
  library: '',
};

const ENUMS = {
  single: ['true', 'false'],
  displayMode: ['onlypages', 'slides'],
  model: ['scorm', 'page'],
  menu: ['default', 'pills', 'tabs', 'horizontal', 'vertical'],
  progress: ['default', 'circle', 'horizontal', 'vertical'],
  pagination: ['true', 'false'],
};

/**
 * @param {string} value Text or attribute value.
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
 * @param {string} value Candidate number.
 * @returns {string|null} Digits, or null when the value is not a whole number.
 */
function wholeNumber(value) {
  return /^\d+$/.test(String(value)) ? String(value) : null;
}

/**
 * Fills and checks package settings (runtime / content.html).
 * @param {Object<string, string>} [input] Partial settings.
 * @param {boolean} [strict] Reject invalid user input instead of using defaults.
 * @returns {Object<string, string>|null} Complete settings, or null when strict input is invalid.
 */
export function packageSettings(input = {}, strict = false) {
  const source = input || {};
  const settings = { ...PACKAGE_DEFAULTS };
  for (const [name, allowed] of Object.entries(ENUMS)) {
    const value = source[name] === undefined || source[name] === '' ? PACKAGE_DEFAULTS[name] : String(source[name]);
    if (!allowed.includes(value)) {
      if (strict) {
        return null;
      }
      continue;
    }
    settings[name] = value;
  }
  const lang = source.lang === undefined || source.lang === '' ? PACKAGE_DEFAULTS.lang : String(source.lang);
  if (!languageCodes().includes(lang)) {
    if (strict) {
      return null;
    }
  }
  else {
    settings.lang = lang;
  }
  const mobile = source.mobileMode === undefined || source.mobileMode === '' ? PACKAGE_DEFAULTS.mobileMode : String(source.mobileMode);
  if (!['true', 'false', '0'].includes(mobile) && !wholeNumber(mobile)) {
    if (strict) {
      return null;
    }
  }
  else {
    settings.mobileMode = mobile;
  }
  for (const name of ['approveLimit', 'activitiesPercentage']) {
    const value = source[name] === undefined || source[name] === '' ? PACKAGE_DEFAULTS[name] : String(source[name]);
    const number = wholeNumber(value);
    if (!number || Number(number) > 100) {
      if (strict) {
        return null;
      }
      continue;
    }
    settings[name] = number;
  }
  for (const name of ['title', 'credits', 'library']) {
    settings[name] = source[name] === undefined ? PACKAGE_DEFAULTS[name] : String(source[name]);
  }
  // Preserve legacy keys when present so migration can still read them once.
  for (const name of ['intro', 'objective', 'duration', 'level', 'activityTitle', 'autoload', 'displayWindow', 'windowWidth', 'windowHeight']) {
    if (source[name] !== undefined) {
      settings[name] = String(source[name]);
    }
  }
  return settings;
}

/**
 * @param {string} name Setting name.
 * @param {string} value Current value.
 * @param {string[]} [options] Select values.
 * @returns {{name: string, labelKey: string, kind: string, value: string, options?: string[]}} Field spec.
 */
function settingField(name, value, options) {
  return {
    name,
    labelKey: `settings.${name}`,
    kind: options ? 'select' : (name === 'credits' || name === 'library' ? 'textarea' : 'text'),
    value,
    ...(options ? { options } : {}),
  };
}

/**
 * @param {Object<string, string>} settings Applied settings.
 * @returns {Array<{name: string, labelKey: string, kind: string, value: string, options?: string[]}>} Settings form.
 */
export function settingsFields(settings) {
  const values = packageSettings(settings);
  return [
    settingField('displayMode', values.displayMode, ['onlypages', 'slides']),
    settingField('approveLimit', values.approveLimit),
    settingField('activitiesPercentage', values.activitiesPercentage),
    settingField('model', values.model, ['scorm', 'page']),
    settingField('mobileMode', values.mobileMode),
    settingField('lang', values.lang, languageCodes()),
    settingField('title', values.title),
    settingField('single', values.single, ['false', 'true']),
    settingField('menu', values.menu, ['default', 'pills', 'tabs', 'horizontal', 'vertical']),
    settingField('progress', values.progress, ['default', 'circle', 'horizontal', 'vertical']),
    settingField('pagination', values.pagination, ['true', 'false']),
    settingField('credits', values.credits),
    settingField('library', values.library),
  ];
}

/**
 * @param {string} html Package document (content.html).
 * @param {typeof DOMParser} [Parser] DOM parser constructor.
 * @returns {Object<string, string>} Settings found in the document.
 */
export function readPackageSettings(html, Parser = globalThis.DOMParser) {
  const document = new Parser().parseFromString(html, 'text/html');
  const body = document.body;
  const header = document.querySelector('header.tpy-presentation');
  const heading = header?.querySelector('h1');
  const level = heading?.querySelector('.level')?.textContent || '';
  const titleText = heading
    ? [...heading.childNodes].filter((node) => node.nodeType === 3).map((node) => node.textContent).join('').trim()
    : document.querySelector('title')?.textContent || '';
  /** @type {Object<string, string>} */
  const legacy = {};
  if (header) {
    legacy.autoload = header.getAttribute('data-autoload') || undefined;
    legacy.displayWindow = header.getAttribute('data-display-window') || undefined;
    legacy.windowWidth = header.getAttribute('data-window-width') || '';
    legacy.windowHeight = header.getAttribute('data-window-height') || '';
    legacy.level = level;
    legacy.activityTitle = header.querySelector('h2')?.textContent || '';
    legacy.intro = header.querySelector('.tpy-intro')?.innerHTML || '';
    legacy.objective = header.querySelector('.tpy-objective')?.innerHTML || '';
    legacy.duration = header.querySelector('.tpy-duration')?.textContent || '';
  }
  return packageSettings({
    lang: document.documentElement.getAttribute('lang') || undefined,
    title: titleText || document.querySelector('title')?.textContent || undefined,
    single: document.documentElement.classList.contains('single') ? 'true' : 'false',
    displayMode: body?.getAttribute('data-display-mode') || undefined,
    approveLimit: body?.getAttribute('data-approve-limit') || undefined,
    activitiesPercentage: body?.getAttribute('data-activities-percentaje') || undefined,
    model: body?.getAttribute('data-model') || undefined,
    mobileMode: body?.getAttribute('data-mobile-mode') || undefined,
    menu: body?.getAttribute('data-menu') || undefined,
    progress: body?.getAttribute('data-progress') || undefined,
    pagination: body?.getAttribute('data-pagination') || undefined,
    credits: document.querySelector('[data-global="credits"]')?.textContent || '',
    library: document.querySelector('[data-global="library"]')?.textContent || '',
    ...legacy,
  });
}

/**
 * @param {string} html Package document.
 * @param {typeof DOMParser} [Parser] DOM parser constructor.
 * @returns {string} Theme id declared by the package, or base.
 */
export function readPackageTheme(html, Parser = globalThis.DOMParser) {
  const document = new Parser().parseFromString(html, 'text/html');
  const content = document.querySelector('meta[name="tepuy-theme"]')?.getAttribute('content') || '';
  return content.split('@')[0] || 'base';
}

/**
 * @returns {import('./parser.js').Node} Empty global pages container.
 */
export function emptyGlobalPages() {
  return { type: 'element', tag: 'div', attrs: { id: 'global-pages' }, children: [] };
}

/**
 * Reads main content and the populated main menu from a package document.
 * @param {string} html Package HTML.
 * @param {string} [themeId] Theme used when the menu must be bootstrapped.
 * @param {typeof DOMParser} [Parser] DOM parser constructor.
 * @returns {{main: import('./parser.js').Node, mainMenu: import('./parser.js').Node, globalPages: import('./parser.js').Node}} Content trees.
 */
export function readPackageContent(html, themeId = 'base', Parser = globalThis.DOMParser) {
  const main = parseContentHtml(html, Parser);
  let mainMenu = parseMainMenuHtml(html, Parser) || emptyMainMenu(themeId);
  mainMenu = ensureMainMenuFromPages(mainMenu, themeId, pagesFromMain(main));
  const globalPages = parseGlobalPagesHtml(html, Parser) || emptyGlobalPages();
  return { main, mainMenu, globalPages };
}

/**
 * @param {string} menuHtml Serialized nav.main.
 * @param {string} menuStyle Package menu style.
 * @returns {string} Nav with menu classes and data-menu.
 */
function decorateMainMenu(menuHtml, menuStyle) {
  const menu = ['default', 'pills', 'tabs', 'horizontal', 'vertical'].includes(menuStyle) ? menuStyle : 'default';
  let navHtml = menuHtml.trim();
  if (!navHtml) {
    return `<nav class="main menu-${menu}" data-menu="${menu}"></nav>`;
  }
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
  if (/\bdata-menu=/.test(navHtml)) {
    navHtml = navHtml.replace(/\bdata-menu="[^"]*"/i, `data-menu="${menu}"`);
  }
  else {
    navHtml = navHtml.replace(/^<nav\b/i, `<nav data-menu="${menu}"`);
  }
  return navHtml;
}

/**
 * @param {Document} document Target document.
 * @param {string} selector Element to replace.
 * @param {string} html Replacement outer HTML.
 */
function replaceOuter(document, selector, html) {
  const current = document.querySelector(selector);
  if (!current || !html) {
    return;
  }
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  const next = wrap.firstElementChild;
  if (next) {
    current.replaceWith(next);
  }
}

/**
 * @param {Array<{type: string, key: string, text: string, full: string}>} references Local references.
 * @returns {string} Citation groups without the outer container.
 */
function citationInnerHtml(references) {
  const types = [...new Set(references.map((item) => item.type))];
  return types.map((type) => {
    const entries = references.filter((item) => item.type === type).map((item) => {
      const full = item.full ? `<br>${escapeHtml(item.full)}` : '';
      return `<p>${escapeHtml(item.key)} ${escapeHtml(item.text)}${full}</p>`;
    }).join('');
    return `<section data-ref-type="${escapeHtml(type)}"><h2>${escapeHtml(type)}</h2>${entries}</section>`;
  }).join('');
}

const VOID_HEAD_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

/**
 * @param {Element|null|undefined} element Candidate.
 * @returns {boolean} Whether the element is a metadata marker.
 */
function isMetadataMarker(element) {
  if (!element) {
    return false;
  }
  const classes = new Set((element.getAttribute('class') || '').split(/\s+/).filter(Boolean));
  return classes.has('metadata') && element.hasAttribute('data-key');
}

/**
 * @param {Element} element Head element that must survive the rebuilt head.
 * @returns {string} Indented HTML.
 */
function serializeKeptHeadElement(element) {
  const tag = element.tagName.toLowerCase();
  const attrs = [...element.attributes]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((attribute) => ` ${attribute.name}="${escapeHtml(attribute.value)}"`)
    .join('');
  if (VOID_HEAD_TAGS.has(tag)) {
    return `  <${tag}${attrs}>`;
  }
  return `  <${tag}${attrs}>${element.innerHTML}</${tag}>`;
}

/**
 * Fills editable surfaces into a theme content.html shell, keeping other body regions.
 * @param {string} shellHtml Theme or package content shell.
 * @param {{main: import('./parser.js').Node, mainMenu?: import('./parser.js').Node, globalPages?: import('./parser.js').Node, settings?: Object<string, string>, references?: Array, themeId?: string, themeVersion?: string, format?: string, metadata?: Object<string, {value?: string, unit?: string}>}} options Surfaces and stamp.
 * @param {typeof DOMParser} [Parser] DOM parser constructor.
 * @returns {string} Canonical content.html.
 */
export function fillContentShell(shellHtml, options = {}, Parser = globalThis.DOMParser) {
  const complete = packageSettings(options.settings || {});
  const themeId = options.themeId;
  const shellThemeId = themeId || 'base';
  const themeVersion = options.themeVersion || '1.0.0';
  const format = options.format || '2.0';
  const main = options.main;
  const mainMenu = options.mainMenu
    || ensureMainMenuFromPages(emptyMainMenu(shellThemeId), shellThemeId, pagesFromMain(main));
  const globalPages = options.globalPages || emptyGlobalPages();
  const document = new Parser().parseFromString(shellHtml, 'text/html');

  replaceOuter(document, 'nav.main', decorateMainMenu(serializeContent(mainMenu), complete.menu));
  replaceOuter(document, '#global-pages', serializeContent(globalPages).trim());
  replaceOuter(document, 'main', serializeContent(main).trim());

  const credits = document.querySelector('#tpy-pg_credits, [data-global="credits"]');
  if (credits) {
    credits.textContent = complete.credits;
  }
  const library = document.querySelector('#tpy-pg_bibliography, [data-global="library"]');
  if (library) {
    library.textContent = complete.library;
  }

  const progress = document.querySelector('#tpy-measuring_progress');
  if (progress) {
    const tokens = new Set(`${progress.getAttribute('class') || ''} measuring-progress`.split(/\s+/).filter(Boolean));
    progress.setAttribute('class', [...tokens].join(' '));
    progress.setAttribute('data-type', complete.progress);
    if (!progress.textContent.trim()) {
      progress.textContent = '0%';
    }
  }

  const pageNumber = document.querySelector('#tpy-page_number');
  if (pageNumber) {
    pageNumber.textContent = complete.pagination === 'false' ? '' : `1 / ${pagesFromMain(main).length}`;
  }

  if (options.references?.length) {
    const citation = document.querySelector('#tpy-auto_citation');
    if (citation) {
      citation.innerHTML = citationInnerHtml(options.references);
    }
  }

  if (options.metadata) {
    applyMetadataValues(document, options.metadata, Parser);
  }

  const titleEl = document.querySelector('title');
  const head = ['  <meta charset="utf-8">'];
  if (themeId) {
    head.push(`  <meta name="tepuy-theme" content="${escapeHtml(themeId)}@${escapeHtml(themeVersion)}">`);
    head.push(`  <meta name="tepuy-version" content="${escapeHtml(format)}">`);
  }
  if (isMetadataMarker(titleEl)) {
    head.push(serializeKeptHeadElement(titleEl));
  }
  else {
    head.push(`  <title>${escapeHtml(complete.title)}</title>`);
  }
  for (const element of document.querySelectorAll('head .metadata[data-key]')) {
    if (element === titleEl || element === document.documentElement || element === document.body) {
      continue;
    }
    head.push(serializeKeptHeadElement(element));
  }
  for (const link of document.querySelectorAll('head link[rel="stylesheet"]')) {
    if (isMetadataMarker(link)) {
      continue;
    }
    const href = link.getAttribute('href');
    if (href) {
      head.push(`  <link rel="stylesheet" href="${escapeHtml(href)}">`);
    }
  }

  const single = complete.single === 'true' ? ' class="single"' : '';
  const bodyAttrs = [
    ['data-activities-percentaje', complete.activitiesPercentage],
    ['data-approve-limit', complete.approveLimit],
    ['data-display-mode', complete.displayMode],
    ['data-menu', complete.menu],
    ['data-mobile-mode', complete.mobileMode],
    ['data-model', complete.model],
    ['data-pagination', complete.pagination],
    ['data-progress', complete.progress],
  ].map(([name, value]) => ` ${name}="${escapeHtml(value)}"`).join('');

  const bodyHtml = document.body.innerHTML.trim();
  return `<!DOCTYPE html>
<html lang="${escapeHtml(complete.lang)}"${single}>
<head>
${head.join('\n')}
</head>
<body${bodyAttrs}>
${bodyHtml}
</body>
</html>
`;
}

/**
 * Writes content.html from the theme shell without presentation markup.
 * @param {import('./parser.js').Node} main Parsed main element.
 * @param {Object<string, string>} settings Package settings.
 * @param {{themeId?: string, themeVersion?: string, format?: string, mainMenu?: import('./parser.js').Node, globalPages?: import('./parser.js').Node, references?: Array, shell?: string, metadata?: Object<string, {value?: string, unit?: string}>}} [meta] Theme stamp and optional surfaces.
 * @param {typeof DOMParser} [Parser] DOM parser constructor.
 * @returns {string} Canonical content.html.
 */
export function serializePackage(main, settings, meta = {}, Parser = globalThis.DOMParser) {
  const themeId = meta.themeId || 'base';
  const shell = meta.shell || themeContentTemplate(meta.themeId ? meta.themeId : 'base');
  return fillContentShell(shell, {
    main,
    mainMenu: meta.mainMenu
      || ensureMainMenuFromPages(emptyMainMenu(themeId), themeId, pagesFromMain(main)),
    globalPages: meta.globalPages || emptyGlobalPages(),
    settings,
    references: meta.references,
    themeId: meta.themeId,
    themeVersion: meta.themeVersion,
    format: meta.format,
    metadata: meta.metadata,
  }, Parser);
}
