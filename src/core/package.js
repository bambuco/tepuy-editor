/**
 * @file Package settings for content.html, the presentation page, and globals.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { htmlFragment } from './html.js';
import { emptyMainMenu, ensureMainMenuFromPages, extractMainMenuItems } from './menu.js';
import { parseContentHtml, parseMainMenuHtml } from './parser.js';
import { serializeContent } from './serializer.js';

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
  lang: 'es',
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
  autoload: 'false',
  displayWindow: 'top',
  windowWidth: '',
  windowHeight: '',
  level: '',
  activityTitle: '',
  intro: '',
  objective: '',
  duration: '',
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
  autoload: ['true', 'false'],
  displayWindow: ['top', 'popup', 'modal'],
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
 * Fills and checks package settings.
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
  if (!/^[a-z]{2}$/.test(lang)) {
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
  for (const name of ['windowWidth', 'windowHeight']) {
    if (source[name] === undefined || source[name] === '') {
      settings[name] = '';
      continue;
    }
    const number = wholeNumber(source[name]);
    if (!number) {
      if (strict) {
        return null;
      }
      settings[name] = '';
      continue;
    }
    settings[name] = number;
  }
  for (const name of ['title', 'level', 'activityTitle', 'intro', 'objective', 'duration', 'credits', 'library']) {
    settings[name] = source[name] === undefined ? PACKAGE_DEFAULTS[name] : String(source[name]);
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
    settingField('lang', values.lang),
    settingField('title', values.title),
    settingField('single', values.single, ['false', 'true']),
    settingField('menu', values.menu, ['default', 'pills', 'tabs', 'horizontal', 'vertical']),
    settingField('progress', values.progress, ['default', 'circle', 'horizontal', 'vertical']),
    settingField('pagination', values.pagination, ['true', 'false']),
    settingField('duration', values.duration),
    settingField('level', values.level),
    settingField('activityTitle', values.activityTitle),
    settingField('autoload', values.autoload, ['false', 'true']),
    settingField('displayWindow', values.displayWindow, ['top', 'popup', 'modal']),
    settingField('windowWidth', values.windowWidth),
    settingField('windowHeight', values.windowHeight),
    settingField('credits', values.credits),
    settingField('library', values.library),
  ];
}

/**
 * @param {Element|null|undefined} element Presentation section.
 * @param {typeof DOMParser} Parser DOM parser constructor.
 * @returns {string} Sanitized inner HTML.
 */
function sectionHtml(element, Parser) {
  return htmlFragment(element?.innerHTML || '', 'rich', Parser);
}

/**
 * @param {string} html Package document.
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
  return packageSettings({
    lang: document.documentElement.getAttribute('lang') || undefined,
    title: titleText,
    single: document.documentElement.classList.contains('single') ? 'true' : 'false',
    displayMode: body?.getAttribute('data-display-mode') || undefined,
    approveLimit: body?.getAttribute('data-approve-limit') || undefined,
    activitiesPercentage: body?.getAttribute('data-activities-percentaje') || undefined,
    model: body?.getAttribute('data-model') || undefined,
    mobileMode: body?.getAttribute('data-mobile-mode') || undefined,
    menu: body?.getAttribute('data-menu') || undefined,
    progress: body?.getAttribute('data-progress') || undefined,
    pagination: body?.getAttribute('data-pagination') || undefined,
    autoload: header?.getAttribute('data-autoload') || undefined,
    displayWindow: header?.getAttribute('data-display-window') || undefined,
    windowWidth: header?.getAttribute('data-window-width') || '',
    windowHeight: header?.getAttribute('data-window-height') || '',
    level,
    activityTitle: header?.querySelector('h2')?.textContent || '',
    intro: sectionHtml(header?.querySelector('.tpy-intro'), Parser),
    objective: sectionHtml(header?.querySelector('.tpy-objective'), Parser),
    duration: header?.querySelector('.tpy-duration')?.textContent || '',
    credits: document.querySelector('[data-global="credits"]')?.textContent || '',
    library: document.querySelector('[data-global="library"]')?.textContent || '',
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
 * @param {Object<string, string>} settings Complete settings.
 * @param {typeof DOMParser} [Parser] DOM parser constructor.
 * @returns {string} Presentation markup. The start button is always present.
 */
function presentationHtml(settings, Parser = globalThis.DOMParser) {
  const size = ['windowWidth', 'windowHeight']
    .filter((name) => settings[name] !== '')
    .map((name) => ` data-${name === 'windowWidth' ? 'window-width' : 'window-height'}="${settings[name]}"`)
    .join('');
  const level = settings.level ? `<span class="level">${escapeHtml(settings.level)}</span> ` : '';
  return `<header class="tpy-presentation" data-autoload="${settings.autoload}" data-display-window="${settings.displayWindow}"${size}>
  <h1>${level}${escapeHtml(settings.title)}</h1>
  <h2>${escapeHtml(settings.activityTitle)}</h2>
  <section class="tpy-intro">${htmlFragment(settings.intro, 'rich', Parser)}</section>
  <section class="tpy-objective">${htmlFragment(settings.objective, 'rich', Parser)}</section>
  <p class="tpy-duration">${escapeHtml(settings.duration)}</p>
</header>
<div id="play_scorm"><button type="button">Iniciar</button></div>
<div id="tpy-pg_credits" data-global="credits">${escapeHtml(settings.credits)}</div>
<div id="tpy-pg_bibliography" data-global="library">${escapeHtml(settings.library)}</div>`;
}

/**
 * Reads main content and the populated main menu from a package document.
 * @param {string} html Package HTML.
 * @param {string} [themeId] Theme used when the menu must be bootstrapped.
 * @param {typeof DOMParser} [Parser] DOM parser constructor.
 * @returns {{main: import('./parser.js').Node, mainMenu: import('./parser.js').Node}} Content and menu trees.
 */
export function readPackageContent(html, themeId = 'base', Parser = globalThis.DOMParser) {
  const main = parseContentHtml(html, Parser);
  let mainMenu = parseMainMenuHtml(html, Parser) || emptyMainMenu(themeId);
  mainMenu = ensureMainMenuFromPages(mainMenu, themeId, pagesFromMain(main));
  return { main, mainMenu };
}

/**
 * Writes the content document and the presentation settings as stable HTML.
 * @param {import('./parser.js').Node} main Parsed main element.
 * @param {Object<string, string>} settings Package settings.
 * @param {{themeId?: string, themeVersion?: string, format?: string, mainMenu?: import('./parser.js').Node}} [meta] Theme stamp and optional main menu.
 * @param {typeof DOMParser} [Parser] DOM parser constructor.
 * @returns {string} Canonical package HTML.
 */
export function serializePackage(main, settings, meta = {}, Parser = globalThis.DOMParser) {
  const complete = packageSettings(settings);
  const single = complete.single === 'true' ? ' class="single"' : '';
  const themeMeta = meta.themeId
    ? `  <meta name="tepuy-theme" content="${escapeHtml(meta.themeId)}@${escapeHtml(meta.themeVersion || '1.0.0')}">\n  <meta name="tepuy-version" content="${escapeHtml(meta.format || '2.0')}">\n`
    : '';
  const body = [
    ['data-activities-percentaje', complete.activitiesPercentage],
    ['data-approve-limit', complete.approveLimit],
    ['data-display-mode', complete.displayMode],
    ['data-menu', complete.menu],
    ['data-mobile-mode', complete.mobileMode],
    ['data-model', complete.model],
    ['data-pagination', complete.pagination],
    ['data-progress', complete.progress],
  ].map(([name, value]) => ` ${name}="${escapeHtml(value)}"`).join('');
  const themeId = meta.themeId || 'base';
  const mainMenu = meta.mainMenu
    || ensureMainMenuFromPages(emptyMainMenu(themeId), themeId, pagesFromMain(main));
  const menuHtml = extractMainMenuItems(mainMenu).length || (mainMenu.children || []).length
    ? `${serializeContent(mainMenu).trimEnd()}\n`
    : `${serializeContent(emptyMainMenu(themeId)).trimEnd()}\n`;
  return `<!DOCTYPE html>
<html lang="${escapeHtml(complete.lang)}"${single}>
<head>
  <meta charset="utf-8">
${themeMeta}  <title>${escapeHtml(complete.title)}</title>
</head>
<body${body}>
${presentationHtml(complete, Parser)}
${menuHtml}${serializeContent(main).trimEnd()}
</body>
</html>
`;
}
