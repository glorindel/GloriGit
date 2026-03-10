/**
 * GloriGit — Connection Status
 */
import { dom } from '../core/dom.js';

export function updateConnectionStatus(connected) {
  dom.connectionStatus.classList.toggle('connected', connected);
}
