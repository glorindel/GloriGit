/**
 * GloriGit — Diff Module
 */
import { state } from '../core/state.js';
import { dom } from '../core/dom.js';
import { escapeHtml, splitPath } from '../core/utils.js';
import { send } from '../core/ws.js';

export function selectFile(file, type) {
  state.selectedFile = file;
  state.selectedType = type;

  // Update selected state in file lists
  document.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));

  // Re-render to show selected state
  // We import renderStatus lazily to avoid circular dependency
  import('./status.js').then(({ renderStatus }) => {
    if (state.status) {
      renderStatus(state.status);
    }
  });

  // Load diff
  dom.diffFilename.textContent = file;
  dom.diffContent.innerHTML = '<div class="diff-empty"><div class="diff-empty-icon">⏳</div><p>Loading diff...</p></div>';

  if (type === 'untracked') {
    send('diff-untracked', { file });
  } else {
    send('diff', { file, staged: type === 'staged' });
  }

  // Show/hide actions
  dom.diffActions.style.display = 'flex';
  dom.diffStageBtn.textContent = type === 'staged' ? 'Unstage' : 'Stage';
  dom.diffDiscardBtn.style.display = type === 'staged' ? 'none' : 'inline-flex';
}

export function renderDiff(diffData) {
  if (!diffData || !diffData.hunks || diffData.hunks.length === 0) {
    dom.diffContent.innerHTML = '<div class="diff-empty"><div class="diff-empty-icon">✅</div><p>No changes</p></div>';
    return;
  }

  let html = '';

  diffData.hunks.forEach(hunk => {
    html += `<div class="diff-hunk">`;
    html += `<div class="diff-hunk-header">${escapeHtml(hunk.header)}</div>`;

    hunk.lines.forEach(line => {
      const typeClass = line.type === '+' ? 'addition' : line.type === '-' ? 'deletion' : 'context';
      const prefix = line.type === '+' ? '+' : line.type === '-' ? '-' : ' ';
      const oldNum = line.oldNum !== null && line.oldNum !== undefined ? line.oldNum : '';
      const newNum = line.newNum !== null && line.newNum !== undefined ? line.newNum : '';

      html += `<div class="diff-line ${typeClass}">`;
      html += `<span class="diff-line-num">${oldNum}</span>`;
      html += `<span class="diff-line-num">${newNum}</span>`;
      html += `<span class="diff-line-content">${prefix}${escapeHtml(line.content)}</span>`;
      html += `</div>`;
    });

    html += `</div>`;
  });

  dom.diffContent.innerHTML = html;
}

export function clearDiff() {
  state.selectedFile = null;
  state.selectedType = null;
  dom.diffFilename.textContent = 'Select a file to view changes';
  dom.diffContent.innerHTML = '<div class="diff-empty"><div class="diff-empty-icon">📂</div><p>Select a file from the sidebar to view its diff</p></div>';
  dom.diffActions.style.display = 'none';
}
