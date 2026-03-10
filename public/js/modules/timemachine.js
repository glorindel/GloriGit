/**
 * GloriGit — File History Timemachine
 */
import { state } from '../core/state.js';
import { dom } from '../core/dom.js';
import { escapeHtml, getTimeAgo } from '../core/utils.js';
import { send } from '../core/ws.js';
import { toast } from '../ui/toast.js';
import { renderDiff, clearDiff } from './diff.js';

export async function openFileHistoryView(file) {
  state.inspectingCommit = file; // Reuse state mechanic
  
  dom.workspaceView.style.display = 'none';
  dom.commitView.style.display = 'none';
  dom.fileHistoryView.style.display = 'flex';
  
  dom.fhFilename.textContent = file;
  dom.fhCount.textContent = '...';
  dom.fhEntries.innerHTML = '<div style="padding: 10px; color: var(--text-muted);">Loading timeline...</div>';
  
  clearDiff();
  
  try {
    const history = await send('file-history', { file });
    dom.fhCount.textContent = history.length;
    renderFileHistory(history, file);
  } catch (err) {
    dom.fhEntries.innerHTML = `<div style="padding: 10px; color: var(--red);">Error: ${escapeHtml(err.error || err.message)}</div>`;
  }
}

function renderFileHistory(history, file) {
  dom.fhEntries.innerHTML = '';
  
  history.forEach((entry, idx) => {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.style.cursor = 'pointer';
    
    const timeAgo = getTimeAgo(entry.date);
    
    div.innerHTML = `
      <span class="log-hash">${escapeHtml(entry.shortHash)}</span>
      <span class="log-message">${escapeHtml(entry.message)}</span>
      <span class="log-date">${timeAgo}</span>
    `;
    
    div.addEventListener('click', async () => {
      document.querySelectorAll('#fhEntries .log-entry').forEach(el => el.classList.remove('selected', 'active'));
      div.style.background = 'var(--bg-active)';
      
      state.selectedFile = file;
      state.selectedType = 'history';

      dom.diffFilename.textContent = `${file} (at ${entry.shortHash})`;
      dom.diffActions.style.display = 'none';
      dom.diffContent.innerHTML = '<div class="diff-empty"><p style="color:var(--text-muted)">Loading historical diff...</p></div>';

      try {
        const diffData = await send('commit-diff-file', { hash: entry.hash, file });
        renderDiff(diffData);
      } catch (err) {
        toast('Failed to load historical diff', 'error');
        dom.diffContent.innerHTML = `<div class="diff-empty"><p style="color:var(--red)">Failed to load</p></div>`;
      }
    });
    
    // Auto-load the newest history entry diff
    if (idx === 0) {
      div.click();
    }
    
    dom.fhEntries.appendChild(div);
  });
}

export function closeFileHistoryView() {
  state.inspectingCommit = null;
  dom.fileHistoryView.style.display = 'none';
  dom.workspaceView.style.display = 'flex';
  if (state.selectedType === 'history') {
    clearDiff();
  }
}
