/**
 * @file Semantic identifiers of the form type-slug.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * @param {string} title Human readable title.
 * @returns {string} Lowercase slug without diacritics.
 */
export function slugify(title) {
  const slug = String(title)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'item';
}

/**
 * @param {string} type Stable control type, such as "pag" or "quiz".
 * @param {string} title Title used to build the slug.
 * @param {Set<string>} existing Identifiers already used in the package.
 * @param {() => string} [random] Short suffix source, used only on collision.
 * @returns {string} type-slug, with a short suffix when the base id is taken.
 */
export function uniqueId(type, title, existing, random = () => Math.random().toString(36).slice(2, 5)) {
  const base = `${type}-${slugify(title)}`;
  if (!existing.has(base)) {
    return base;
  }
  let id = base;
  do {
    id = `${base}-${random()}`;
  } while (existing.has(id) || id === base);
  return id;
}
