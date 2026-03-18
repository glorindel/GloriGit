/**
 * GloriGit — Historian (Commit Inspector)
 */
import { state } from '../core/state.js';
import { dom } from '../core/dom.js';
import { escapeHtml, splitPath, getTimeAgo, formatDate } from '../core/utils.js';
import { send } from '../core/ws.js';
import { toast } from '../ui/toast.js';
import { renderDiff, clearDiff } from './diff.js';
import { unselectCommit } from './log.js';

export async function openCommitView(commit) {
  state.inspectingCommit = commit.hash;
  
  // Switch Views
  dom.workspaceView.style.display = 'none';
  dom.commitView.style.display = 'flex';
  
  // Populate Metadata
  dom.inspectCommitHash.textContent = commit.shortHash;
  dom.inspectCommitDate.textContent = formatDate(commit.date);
  dom.inspectCommitAuthor.textContent = commit.author;
  dom.inspectCommitMessage.textContent = commit.message;
  
  // Loading State for Files
  dom.inspectCommitFileCount.textContent = '...';
  dom.inspectCommitFiles.innerHTML = '<li style="padding: 10px; color: var(--text-muted);">Loading files...</li>';
  
  // Clear diff area
  clearDiff();
  
  try {
    const files = await send('commit-files', { hash: commit.hash });
    dom.inspectCommitFileCount.textContent = files.length;
    renderInspectFileList(files, commit.hash);
  } catch (err) {
    dom.inspectCommitFiles.innerHTML = `<li style="padding: 10px; color: var(--red);">Error: ${escapeHtml(err.error || err.message)}</li>`;
  }
}

function renderInspectFileList(files, commitHash) {
  dom.inspectCommitFiles.innerHTML = '';
  
  files.forEach(item => {
    const li = document.createElement('li');
    li.className = 'file-item';
    
    const parts = splitPath(item.file);
    
    li.innerHTML = `
      <span class="file-status ${item.status}">${item.status}</span>
      <span class="file-name">${parts.dir ? `<span class="file-dir">${parts.dir}/</span>` : ''}${parts.name}</span>
    `;

    // Click file to show diff
    li.addEventListener('click', async () => {
      // Clear any active inspect selections
      if (state.inspectingCommit) {
        Array.from(dom.inspectCommitFiles.querySelectorAll('.file-item')).forEach(el => el.classList.remove('selected'));
      }

      document.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
      li.classList.add('selected');
      state.selectedFile = item.file;
      state.selectedType = 'history'; // Readonly

      dom.diffFilename.textContent = `${item.file} (at ${commitHash.substring(0,7)})`;
      dom.diffActions.style.display = 'flex';
      dom.diffActions.style.display = 'none'; // No staging/discarding history
      dom.diffContent.innerHTML = '<div class="diff-empty"><p style="color:var(--text-muted)">Loading historical diff...</p></div>';

      try {
        const diffData = await send('commit-diff-file', { hash: commitHash, file: item.file });
        renderDiff(diffData);
      } catch (err) {
        toast(err.error || 'Failed to load historical diff', 'error');
        dom.diffContent.innerHTML = `<div class="diff-empty"><p style="color:var(--red)">${escapeHtml(err.error || 'Failed')}</p></div>`;
      }
    });
    
    dom.inspectCommitFiles.appendChild(li);
  });
}

export function closeCommitView() {
  state.inspectingCommit = null;
  dom.commitView.style.display = 'none';
  dom.workspaceView.style.display = 'flex';
  if (state.selectedType === 'history') {
    clearDiff();
  }
  unselectCommit();
}
