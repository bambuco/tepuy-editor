/**
 * @file Package progress and SCORM 1.2 lesson status.
 * The package is completed only at 100. Mastery score is always 100.
 * data-approve-limit applies to each activity. data-activities-percentaje
 * only weights activities against page visits.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/** @type {number} Passing score written to adlcp:masteryscore. */
export const MASTERY_SCORE = 100;

/**
 * @param {{pagesVisited: number, pagesTotal: number, activityScores?: number[], activitiesPercentage?: number}} input Progress inputs.
 * @returns {number} Combined progress from 0 to 100.
 */
export function packageProgress({
  pagesVisited,
  pagesTotal,
  activityScores = [],
  activitiesPercentage = 60,
}) {
  if (!Number.isFinite(pagesTotal) || pagesTotal <= 0) {
    return 0;
  }
  const visited = Math.min(Math.max(pagesVisited, 0), pagesTotal);
  if (activityScores.length === 0) {
    return Math.round((visited / pagesTotal) * 100);
  }
  const navigation = Math.round((visited / pagesTotal) * (100 - activitiesPercentage));
  const average = activityScores.reduce((sum, score) => sum + score, 0) / activityScores.length;
  const activities = Math.round(average * (activitiesPercentage / 100));
  return navigation + activities;
}

/**
 * @param {number} progress Combined package progress.
 * @returns {'completed'|'incomplete'} Status stored in cmi.core.lesson_status.
 */
export function lessonStatusForProgress(progress) {
  return progress >= MASTERY_SCORE ? 'completed' : 'incomplete';
}

/**
 * Reads a lesson status. The legacy value "complete" counts as completed.
 * @param {string} status Raw cmi.core.lesson_status.
 * @returns {'completed'|'incomplete'|null} Null when the LMS has no usable status yet.
 */
export function readLessonStatus(status) {
  if (status === 'completed' || status === 'complete') {
    return 'completed';
  }
  if (status === 'incomplete') {
    return 'incomplete';
  }
  return null;
}
