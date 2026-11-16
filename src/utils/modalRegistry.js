/**
 * MedRemind Global Modal & Dialog Stack Registry
 * 
 * Allows Android hardware back button to dismiss the top-most
 * open dialog, drawer, or modal before navigating back or exiting.
 */

const modalStack = [];

/**
 * Registers an open modal callback
 * @param {string} id 
 * @param {Function} closeCallback 
 * @returns {() => void} unregister function
 */
export function registerOpenModal(id, closeCallback) {
  // Remove if already exists with same id to prevent duplicate entries
  const existingIdx = modalStack.findIndex(m => m.id === id);
  if (existingIdx !== -1) {
    modalStack.splice(existingIdx, 1);
  }

  modalStack.push({ id, closeCallback });

  return () => {
    unregisterModal(id);
  };
}

/**
 * Unregisters a closed modal
 * @param {string} id 
 */
export function unregisterModal(id) {
  const idx = modalStack.findIndex(m => m.id === id);
  if (idx !== -1) {
    modalStack.splice(idx, 1);
  }
}

/**
 * Checks if any modal or drawer is currently open
 * @returns {boolean}
 */
export function hasOpenModals() {
  return modalStack.length > 0;
}

/**
 * Dismisses the topmost modal in the stack
 * @returns {boolean} true if a modal was dismissed, false if none open
 */
export function dismissTopModal() {
  if (modalStack.length === 0) return false;
  const top = modalStack.pop();
  try {
    if (typeof top.closeCallback === 'function') {
      top.closeCallback();
    }
  } catch (err) {
    console.warn('[ModalRegistry] Error dismissing modal:', err);
  }
  return true;
}
