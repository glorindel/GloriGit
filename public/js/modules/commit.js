/**
 * GloriGit — Commit Module
 */
import { state } from '../core/state.js';
import { dom } from '../core/dom.js';
import { send } from '../core/ws.js';
import { toast } from '../ui/toast.js';
import { clearDiff } from './diff.js';

export function updateCommitButton() {
  const hasStaged = state.status && state.status.staged.length > 0;
  const hasMessage = dom.commitMessage.value.trim().length > 0;
  dom.commitBtn.disabled = !(hasStaged && hasMessage);
}

export async function doCommit() {
  const message = dom.commitMessage.value.trim();
  if (!message) return;

  try {
    await send('commit', { message });
    dom.commitMessage.value = '';
    dom.charCount.textContent = '0/200';
    updateCommitButton();
    toast('Committed!', 'success');

    // Refresh log
    send('log', { count: 50 });

    // Clear diff view if showing a staged file
    if (state.selectedType === 'staged') {
      clearDiff();
    }
  } catch (err) {
    toast(err.error || 'Commit failed', 'error');
  }
}
