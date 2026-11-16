/**
 * @file Aggregates control definitions in registration order.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { boxes } from './boxes.js';
import { globalEntry } from './global-entry.js';
import { headings } from './headings.js';
import { instructions } from './instructions.js';
import { media } from './media.js';
import { modal } from './modal.js';
import { page } from './page.js';
import { quiz } from './quiz.js';
import { references } from './references.js';
import { subpage } from './subpage.js';
import { tabs } from './tabs.js';
import { textControls } from './text.js';

/** @type {import('../shared.js').ControlDefinition[]} */
export const CONTROL_DEFINITIONS = [
  page,
  subpage,
  globalEntry,
  modal,
  tabs,
  quiz,
  ...boxes,
  ...instructions,
  ...references,
  ...media,
  ...headings,
  ...textControls,
];
