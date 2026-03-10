/**
 * GloriGit — Toast Notifications
 */
import { dom } from '../core/dom.js';
import { escapeHtml } from '../core/utils.js';

export function toast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${escapeHtml(message)}</span>`;
  dom.toastContainer.appendChild(el);

  setTimeout(() => {
    el.classList.add('toast-exit');
    setTimeout(() => el.remove(), 200);
  }, 3500);
}
