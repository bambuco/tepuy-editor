/**
 * @file Parse, write, and migrate educational metadata in index.html.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { htmlFragment, sanitizeHtml, serializeFragment } from '../core/html.js';
import { serializeContent } from '../core/serializer.js';
import { t } from '../i18n/messages.js';
import {
  BASE_METADATA,
  LEGACY_METADATA_MAP,
  getMetadataField,
  resolveMetadataKind,
} from './schema.js';

/**
 * @typedef {import('../core/parser.js').Node} Node
 */

/**
 * @typedef {Object} IndexDocument
 * @property {string} lang Document language.
 * @property {string} title Document title element text.
 * @property {string} themeId Theme id from meta, if any.
 * @property {string} themeVersion Theme version from meta.
 * @property {Object<string, string>} bodyAttrs Body attributes.
 * @property {Node} body Parsed body element.
 */

/**
 * @param {Node|null|undefined} node Content node.
 * @returns {Set<string>} Class tokens.
 */
function classSet(node) {
  return new Set((node?.attrs?.class || '').split(/\s+/).filter(Boolean));
}

/**
 * @param {Element} element DOM element.
 * @returns {Object<string, string>} Attributes sorted by name.
 */
function readAttributes(element) {
  const attrs = {};
  for (const attribute of [...element.attributes].sort((left, right) => left.name.localeCompare(right.name))) {
    attrs[attribute.name] = attribute.value;
  }
  return attrs;
}

/**
 * @param {globalThis.Node} domNode DOM node.
 * @returns {Node|null} Editor node.
 */
function parseDomNode(domNode) {
  if (domNode.nodeType === 3) {
    const text = domNode.textContent.replace(/\s+/g, ' ').trim();
    return text ? { type: 'text', text } : null;
  }
  if (domNode.nodeType === 8) {
    return { type: 'comment', text: domNode.textContent };
  }
  if (domNode.nodeType !== 1) {
    return null;
  }
  const tag = domNode.tagName.toLowerCase();
  const attrs = readAttributes(domNode);
  const children = [...domNode.childNodes].map(parseDomNode).filter(Boolean);
  return { type: 'element', tag, attrs, children };
}

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
 * @param {Node} node Candidate.
 * @returns {boolean} Whether the node is a metadata marker.
 */
export function isMetadataNode(node) {
  return Boolean(node && node.type !== 'text' && node.type !== 'comment' && classSet(node).has('metadata') && node.attrs?.['data-key']);
}

/**
 * @param {Node} root Search root.
 * @param {(node: Node, path: number[]) => void} visit Visitor.
 * @param {number[]} [path] Path so far.
 * @returns {void}
 */
function walk(root, visit, path = []) {
  visit(root, path);
  (root.children || []).forEach((child, index) => {
    if (child.type !== 'text' && child.type !== 'comment') {
      walk(child, visit, [...path, index]);
    }
  });
}

/**
 * @param {Node} root Index body or subtree.
 * @returns {Array<{key: string, node: Node, path: number[]}>} Metadata nodes in document order.
 */
export function listMetadataNodes(root) {
  /** @type {Array<{key: string, node: Node, path: number[]}>} */
  const found = [];
  walk(root, (node, path) => {
    if (isMetadataNode(node)) {
      found.push({ key: node.attrs['data-key'], node, path: [...path] });
    }
  });
  return found;
}

/**
 * @param {Node} root Index body.
 * @param {string} id Element id.
 * @returns {Node|null} Matching element.
 */
function findById(root, id) {
  let match = null;
  walk(root, (node) => {
    if (!match && node.attrs?.id === id) {
      match = node;
    }
  });
  return match;
}

/**
 * @param {Node} node Metadata node.
 * @returns {{value: string, unit?: string}} Stored value.
 */
export function readMetadataNode(node) {
  const key = node.attrs?.['data-key'] || '';
  const kind = resolveMetadataKind(key);
  const unit = node.attrs?.['data-unit'];
  if (kind === 'rich') {
    return { value: serializeFragment(node.children || []), ...(unit ? { unit } : {}) };
  }
  const text = (node.children || [])
    .filter((child) => child.type === 'text')
    .map((child) => child.text || '')
    .join('')
    .trim()
    || (node.children || []).map((child) => (
      child.type === 'text' ? child.text : serializeFragment(child.children || [])
    )).join('').replace(/\s+/g, ' ').trim();
  if (kind === 'number') {
    const match = text.match(/^(\d+(?:[.,]\d+)?)/);
    return { value: match ? match[1] : '', ...(unit ? { unit } : {}) };
  }
  if (kind === 'select') {
    const options = getMetadataField(key)?.options || [];
    const stored = node.attrs?.['data-value'] || '';
    if (options.includes(stored)) {
      return { value: stored, ...(unit ? { unit } : {}) };
    }
    return { value: options.includes(text) ? text : '', ...(unit ? { unit } : {}) };
  }
  return { value: text, ...(unit ? { unit } : {}) };
}

/**
 * @param {Node} root Index body.
 * @returns {Object<string, {value: string, unit?: string}>} Values by data-key.
 */
export function readMetadata(root) {
  /** @type {Object<string, {value: string, unit?: string}>} */
  const values = {};
  for (const item of listMetadataNodes(root)) {
    values[item.key] = readMetadataNode(item.node);
  }
  return values;
}

/**
 * @param {string} key Metadata key.
 * @param {string} [tag] Element tag.
 * @returns {Node} Empty metadata marker.
 */
function createMetadataNode(key, tag = 'div') {
  const field = getMetadataField(key);
  const attrs = { class: 'metadata', 'data-key': key };
  if (field?.kind === 'number') {
    attrs['data-unit'] = field.defaultUnit || 'hours';
  }
  return { type: 'element', tag, attrs, children: [] };
}

/**
 * Ensures #content exists under body.
 * @param {Node} body Body node.
 * @returns {Node} The content container.
 */
export function ensureContentArea(body) {
  let content = findById(body, 'content');
  if (content) {
    return content;
  }
  content = { type: 'element', tag: 'div', attrs: { id: 'content' }, children: [] };
  body.children = [...(body.children || []), content];
  return content;
}

/**
 * Ensures every base field has a marker; missing ones go under #content.
 * @param {Node} body Index body.
 * @returns {Node} Body (mutated).
 */
export function ensureBaseMetadata(body) {
  const present = new Set(listMetadataNodes(body).map((item) => item.key));
  const content = ensureContentArea(body);
  for (const field of BASE_METADATA) {
    if (present.has(field.id)) {
      continue;
    }
    content.children = [...(content.children || []), createMetadataNode(field.id)];
    present.add(field.id);
  }
  return body;
}

/**
 * @param {Node} node Metadata node.
 * @param {string} value Next value.
 * @param {string} [unit] Unit for number fields.
 * @param {typeof DOMParser} [Parser] DOM parser.
 * @returns {void}
 */
export function writeMetadataNode(node, value, unit, Parser = globalThis.DOMParser) {
  const key = node.attrs?.['data-key'] || '';
  const kind = resolveMetadataKind(key);
  const attrs = { ...node.attrs, class: 'metadata', 'data-key': key };
  delete attrs['data-value'];
  if (kind === 'number') {
    const field = getMetadataField(key);
    const nextUnit = unit || node.attrs?.['data-unit'] || field?.defaultUnit || 'hours';
    attrs['data-unit'] = nextUnit;
    node.attrs = attrs;
    const number = String(value ?? '').trim();
    const labelKey = `metadata.unit.${nextUnit}`;
    const label = t(labelKey);
    const text = number && label !== labelKey ? `${number} ${label}` : number;
    node.children = text ? [{ type: 'text', text }] : [];
    return;
  }
  delete attrs['data-unit'];
  if (kind === 'select') {
    const canonical = String(value ?? '').trim();
    const known = Boolean(getMetadataField(key)?.options?.includes(canonical));
    if (known) {
      attrs['data-value'] = canonical;
    }
    node.attrs = attrs;
    const labelKey = `metadata.option.${key}.${canonical}`;
    const label = t(labelKey);
    const text = known && label !== labelKey ? label : canonical;
    node.children = text ? [{ type: 'text', text }] : [];
    return;
  }
  node.attrs = attrs;
  if (kind === 'rich') {
    node.children = sanitizeHtml(value || '', 'rich', Parser);
    return;
  }
  node.children = value ? [{ type: 'text', text: String(value) }] : [];
}

/**
 * Writes a metadata value, creating a #content marker when missing.
 * @param {Node} body Index body.
 * @param {string} key data-key.
 * @param {string} value Value.
 * @param {string} [unit] Duration unit.
 * @param {typeof DOMParser} [Parser] DOM parser.
 * @returns {Node} Body (mutated clone-safe if caller cloned).
 */
export function writeMetadataValue(body, key, value, unit, Parser = globalThis.DOMParser) {
  const found = listMetadataNodes(body).find((item) => item.key === key);
  if (found) {
    writeMetadataNode(found.node, value, unit, Parser);
    return body;
  }
  const content = ensureContentArea(body);
  const node = createMetadataNode(key);
  writeMetadataNode(node, value, unit, Parser);
  content.children = [...(content.children || []), node];
  return body;
}

/**
 * @param {string} html index.html source.
 * @param {typeof DOMParser} [Parser] DOM parser.
 * @returns {IndexDocument} Parsed index document.
 */
export function parseIndexHtml(html, Parser = globalThis.DOMParser) {
  const document = new Parser().parseFromString(html || '<body></body>', 'text/html');
  const theme = document.querySelector('meta[name="tepuy-theme"]')?.getAttribute('content') || '';
  const [themeId, themeVersion] = theme.split('@');
  const bodyEl = document.body || document.createElement('body');
  const body = parseDomNode(bodyEl) || { type: 'element', tag: 'body', attrs: {}, children: [] };
  body.tag = 'body';
  return {
    lang: document.documentElement.getAttribute('lang') || 'es',
    title: document.querySelector('title')?.textContent || '',
    themeId: themeId || '',
    themeVersion: themeVersion || '',
    bodyAttrs: readAttributes(bodyEl),
    body,
  };
}

/**
 * @param {IndexDocument} index Parsed index.
 * @returns {string} Canonical index.html.
 */
export function serializeIndexDocument(index) {
  const themeMeta = index.themeId
    ? `  <meta name="tepuy-theme" content="${escapeHtml(index.themeId)}@${escapeHtml(index.themeVersion || '1.0.0')}">\n`
    : '';
  const bodyAttrs = Object.keys(index.bodyAttrs || {})
    .sort()
    .map((name) => ` ${name}="${escapeHtml(index.bodyAttrs[name])}"`)
    .join('');
  const inner = (index.body.children || [])
    .map((child) => serializeContent(child).trimEnd())
    .filter(Boolean)
    .join('\n');
  return `<!DOCTYPE html>
<html lang="${escapeHtml(index.lang || 'es')}">
<head>
  <meta charset="utf-8">
${themeMeta}  <title>${escapeHtml(index.title || '')}</title>
</head>
<body${bodyAttrs}>
${inner ? `${inner}\n` : ''}</body>
</html>
`;
}

/**
 * @param {Node|null|undefined} node Content node.
 * @returns {string} Text carried by the node.
 */
function visibleText(node) {
  if (!node || node.type === 'comment') {
    return '';
  }
  if (node.type === 'text') {
    return node.text || '';
  }
  return (node.children || []).map((child) => visibleText(child)).join('');
}

/**
 * @param {Node} node Metadata node.
 * @returns {boolean} Whether the marker has no visible value.
 */
function metadataIsBlank(node) {
  const key = node.attrs?.['data-key'] || '';
  if (resolveMetadataKind(key) === 'rich') {
    return !visibleText(node).trim();
  }
  return !String(readMetadataNode(node).value || '').trim();
}

/**
 * @param {Node} body Index body.
 * @returns {Map<string, boolean>} True when every marker for that key is blank.
 */
function blankMetadataKeys(body) {
  /** @type {Map<string, boolean>} */
  const blank = new Map();
  for (const item of listMetadataNodes(body)) {
    const isBlank = metadataIsBlank(item.node);
    blank.set(item.key, blank.has(item.key) ? Boolean(blank.get(item.key)) && isBlank : isBlank);
  }
  return blank;
}

/**
 * @param {Node} node Content node.
 * @param {Map<string, boolean>} blank Keys that have no visible value.
 * @returns {Node} Node without empty related labels.
 */
function withoutEmptyRelated(node, blank) {
  if (node.type === 'text' || node.type === 'comment') {
    return node;
  }
  const children = (node.children || [])
    .map((child) => withoutEmptyRelated(child, blank))
    .filter((child) => {
      if (child.type === 'text' || child.type === 'comment') {
        return true;
      }
      const related = child.attrs?.['data-relatedto'];
      return !related || blank.get(related) === false;
    });
  return { ...node, children };
}

/**
 * Drops [data-relatedto] elements whose metadata has no visible value.
 * A missing key counts as empty. The source tree is left unchanged.
 * @param {Node} body Index body.
 * @returns {Node} Independent body for presentation output.
 */
export function omitEmptyRelated(body) {
  const copy = structuredClone(body);
  return withoutEmptyRelated(copy, blankMetadataKeys(copy));
}

/**
 * @param {IndexDocument} index Parsed index.
 * @returns {string} index.html for preview and the saved package, without orphan labels.
 */
export function serializePresentation(index) {
  return serializeIndexDocument({
    ...index,
    body: omitEmptyRelated(index.body),
  });
}

/**
 * @param {string} text Legacy duration text.
 * @returns {{value: string, unit: string}} Parsed number and unit.
 */
export function parseLegacyDuration(text) {
  const raw = String(text || '').trim();
  const match = raw.match(/(\d+(?:[.,]\d+)?)/);
  const unit = /min/i.test(raw) ? 'minutes' : 'hours';
  if (!match) {
    return { value: '', unit };
  }
  const number = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(number)) {
    return { value: '', unit };
  }
  return { value: String(Math.round(number)), unit };
}

/**
 * Seeds an index document from a theme template and ensures base markers.
 * @param {string} themeHtml Theme index.html.
 * @param {{themeId?: string, themeVersion?: string, lang?: string, title?: string}} [meta] Package meta.
 * @returns {IndexDocument} Ready index document.
 */
export function seedIndexFromTheme(themeHtml, meta = {}) {
  const index = parseIndexHtml(themeHtml);
  if (meta.themeId) {
    index.themeId = meta.themeId;
    index.themeVersion = meta.themeVersion || '1.0.0';
  }
  if (meta.lang) {
    index.lang = meta.lang;
  }
  if (meta.title !== undefined) {
    index.title = meta.title;
  }
  ensureBaseMetadata(index.body);
  return index;
}

/**
 * Builds an index document from legacy content.html presentation markup or settings.
 * @param {string} themeHtml Theme index template.
 * @param {{themeId?: string, themeVersion?: string}} themeMeta Theme stamp.
 * @param {string} [legacyHtml] Previous content.html that may include header.tpy-presentation.
 * @param {Object<string, string>} [legacySettings] Settings already read from the package.
 * @param {typeof DOMParser} [Parser] DOM parser.
 * @returns {IndexDocument} Migrated index.
 */
export function migrateToMetadataIndex(themeHtml, themeMeta, legacyHtml = '', legacySettings = {}, Parser = globalThis.DOMParser) {
  const index = seedIndexFromTheme(themeHtml, {
    themeId: themeMeta.themeId,
    themeVersion: themeMeta.themeVersion,
    lang: legacySettings.lang,
    title: legacySettings.title || '',
  });
  const document = legacyHtml
    ? new Parser().parseFromString(legacyHtml, 'text/html')
    : null;
  const header = document?.querySelector('header.tpy-presentation');

  if (header) {
    const autoload = header.getAttribute('data-autoload');
    const displayWindow = header.getAttribute('data-display-window');
    const windowWidth = header.getAttribute('data-window-width');
    const windowHeight = header.getAttribute('data-window-height');
    if (autoload) {
      index.bodyAttrs['data-autoload'] = autoload;
    }
    if (displayWindow) {
      index.bodyAttrs['data-display-window'] = displayWindow;
    }
    if (windowWidth) {
      index.bodyAttrs['data-window-width'] = windowWidth;
    }
    if (windowHeight) {
      index.bodyAttrs['data-window-height'] = windowHeight;
    }
  }
  else {
    if (legacySettings.autoload) {
      index.bodyAttrs['data-autoload'] = legacySettings.autoload;
    }
    if (legacySettings.displayWindow) {
      index.bodyAttrs['data-display-window'] = legacySettings.displayWindow;
    }
    if (legacySettings.windowWidth) {
      index.bodyAttrs['data-window-width'] = legacySettings.windowWidth;
    }
    if (legacySettings.windowHeight) {
      index.bodyAttrs['data-window-height'] = legacySettings.windowHeight;
    }
  }

  /** @type {Object<string, {value: string, unit?: string}>} */
  const incoming = {};
  const heading = header?.querySelector('h1');
  const level = heading?.querySelector('.level')?.textContent?.trim() || legacySettings.level || '';
  const titleText = heading
    ? [...heading.childNodes].filter((node) => node.nodeType === 3).map((node) => node.textContent).join('').trim()
    : (legacySettings.title || '');
  if (titleText) {
    incoming.title = { value: titleText };
  }
  const activityTitle = header?.querySelector('h2')?.textContent?.trim() || legacySettings.activityTitle || '';
  if (activityTitle) {
    incoming.activityTitle = { value: activityTitle };
  }
  if (level) {
    incoming.level = { value: level };
  }
  const intro = header?.querySelector('.tpy-intro')
    ? htmlFragment(header.querySelector('.tpy-intro').innerHTML || '', 'rich', Parser)
    : (legacySettings.intro || '');
  if (intro) {
    incoming.description = { value: intro };
  }
  const objective = header?.querySelector('.tpy-objective')
    ? htmlFragment(header.querySelector('.tpy-objective').innerHTML || '', 'rich', Parser)
    : (legacySettings.objective || '');
  if (objective) {
    incoming.objective = { value: objective };
  }
  const durationText = header?.querySelector('.tpy-duration')?.textContent || legacySettings.duration || '';
  if (durationText) {
    const parsed = parseLegacyDuration(durationText);
    if (parsed.value) {
      incoming.duration = parsed;
    }
    else {
      incoming.duration = { value: '', unit: 'hours' };
      // Keep unparseable duration text as unknown metadata.
      incoming['duration-text'] = { value: durationText };
    }
  }

  for (const [legacyKey, value] of Object.entries(legacySettings)) {
    if (!value || incoming[legacyKey] || incoming[LEGACY_METADATA_MAP[legacyKey]]) {
      continue;
    }
    if (['intro', 'objective', 'title', 'duration', 'level', 'activityTitle'].includes(legacyKey)) {
      continue;
    }
  }

  for (const [key, payload] of Object.entries(incoming)) {
    const targetKey = LEGACY_METADATA_MAP[key] || key;
    if (getMetadataField(targetKey) || targetKey === key) {
      writeMetadataValue(index.body, targetKey, payload.value, payload.unit, Parser);
    }
  }

  if (titleText) {
    index.title = titleText;
  }
  ensureBaseMetadata(index.body);
  return index;
}

/**
 * Deep-clones an index document.
 * @param {IndexDocument} index Source.
 * @returns {IndexDocument} Independent copy.
 */
export function cloneIndexDocument(index) {
  return structuredClone(index);
}
