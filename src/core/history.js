/**
 * @file Undo and redo over document snapshots.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * @param {*} initial Starting document state.
 * @returns {{current: Function, commit: Function, undo: Function, redo: Function}} History controls.
 */
export function createDocumentHistory(initial) {
  const past = [];
  const future = [];
  let present = structuredClone(initial);

  return {
    /**
     * @returns {*} Copy of the current state.
     */
    current() {
      return structuredClone(present);
    },

    /**
     * @param {*} next Next document state.
     * @returns {void}
     */
    commit(next) {
      past.push(present);
      present = structuredClone(next);
      future.length = 0;
    },

    /**
     * @returns {boolean} True when a previous state was restored.
     */
    undo() {
      if (past.length === 0) {
        return false;
      }
      future.push(present);
      present = past.pop();
      return true;
    },

    /**
     * @returns {boolean} True when a later state was restored.
     */
    redo() {
      if (future.length === 0) {
        return false;
      }
      past.push(present);
      present = future.pop();
      return true;
    },
  };
}
