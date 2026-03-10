/**
 * GloriGit — Status Panel Module
 */
import { state } from '../core/state.js';
import { dom } from '../core/dom.js';
import { splitPath } from '../core/utils.js';
import { send } from '../core/ws.js';
import { selectFile } from './diff.js';
import { openFileHistoryView } from './timemachine.js';
import { updateCommitButton } from './commit.js';

export function renderStatus(status) {
  // Prevent UI blinking: only re-render if the status data actually changed
  if (state.status && JSON.stringify(state.status) === JSON.stringify(status)) {
    return; 
  }
  state.status = status;

  // Update branch display
  dom.currentBranch.textContent = status.branch || 'detached';

  // Update sync badges
  dom.aheadBadge.textContent = `↑${status.ahead}`;
  dom.behindBadge.textContent = `↓${status.behind}`;
  dom.aheadBadge.classList.toggle('has-value', status.ahead > 0);
  dom.behindBadge.classList.toggle('has-value', status.behind > 0);

  // Update counts
  dom.stagedCount.textContent = status.staged.length;
  dom.unstagedCount.textContent = status.unstaged.length;
  dom.untrackedCount.textContent = status.untracked.length;

  // Render file lists
  renderFileList(dom.stagedFiles, status.staged, 'staged');
  renderFileList(dom.unstagedFiles, status.unstaged, 'unstaged');
  renderUntrackedList(dom.untrackedFiles, status.untracked);

  // Update commit button state
  updateCommitButton();
}

function renderFileList(container, files, type) {
  container.innerHTML = '';

  files.forEach(item => {
    const li = document.createElement('li');
    li.className = 'file-item';
    if (state.selectedFile === item.file && state.selectedType === type) {
      li.classList.add('selected');
    }

    const parts = splitPath(item.file);

    li.innerHTML = `
      <span class="file-status ${item.status}">${item.status}</span>
      <span class="file-name">${parts.dir ? `<span class="file-dir">${parts.dir}/</span>` : ''}${parts.name}</span>
      <button class="file-history-btn" title="View History">⏳</button>
      <button class="file-action" title="${type === 'staged' ? 'Unstage' : 'Stage'}">${type === 'staged' ? '−' : '+'}</button>
    `;

    // Click file to show diff
    li.addEventListener('click', (e) => {
      if (e.target.classList.contains('file-action') || e.target.classList.contains('file-history-btn')) return;
      selectFile(item.file, type);
    });

    // History button
    li.querySelector('.file-history-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openFileHistoryView(item.file);
    });

    // Stage/Unstage button
    li.querySelector('.file-action').addEventListener('click', (e) => {
      e.stopPropagation();
      if (type === 'staged') {
        send('unstage', { files: [item.file] });
      } else {
        send('stage', { files: [item.file] });
      }
    });

    container.appendChild(li);
  });
}

function renderUntrackedList(container, files) {
  container.innerHTML = '';

  files.forEach(file => {
    const li = document.createElement('li');
    li.className = 'file-item';
    if (state.selectedFile === file && state.selectedType === 'untracked') {
      li.classList.add('selected');
    }

    const parts = splitPath(file);

    li.innerHTML = `
      <span class="file-status U">?</span>
      <span class="file-name">${parts.dir ? `<span class="file-dir">${parts.dir}/</span>` : ''}${parts.name}</span>
      <button class="file-history-btn" title="View History" style="opacity:0.3; cursor:not-allowed">⏳</button>
      <button class="file-action" title="Stage">+</button>
    `;

    li.addEventListener('click', (e) => {
      if (e.target.classList.contains('file-action')) return;
      selectFile(file, 'untracked');
    });

    li.querySelector('.file-action').addEventListener('click', (e) => {
      e.stopPropagation();
      send('stage', { files: [file] });
    });

    container.appendChild(li);
  });
}
