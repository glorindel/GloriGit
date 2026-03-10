/**
 * GloriGit — Modal System
 */
import { dom } from '../core/dom.js';

let modalCallback = null;

export function showModal(title, body, onConfirm) {
  dom.modalTitle.textContent = title;
  dom.modalBody.innerHTML = body;
  dom.modalOverlay.classList.add('active');
  modalCallback = onConfirm;
}

export function hideModal() {
  dom.modalOverlay.classList.remove('active');
  modalCallback = null;
}

export function getModalCallback() {
  return modalCallback;
}
