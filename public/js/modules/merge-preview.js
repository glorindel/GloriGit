/**
 * GloriGit — Phase 7: Merge Preview Modal
 *
 * Performs a dry-run merge and shows which files would change
 * before the user commits to the actual merge.
 */
import { send } from '../core/ws.js';
import { escapeHtml } from '../core/utils.js';
import { toast } from '../ui/toast.js';
import { state } from '../core/state.js';

let currentPreviewBranch = null;

/**
 * Open the merge preview modal for a given branch
 */
export async function openMergePreview(branch) {
  if (!branch) return;
  currentPreviewBranch = branch;

  const overlay = document.getElementById('mergePreviewModalOverlay');
  if (!overlay) return;
  overlay.classList.add('active');

  // Set loading state
  const fileList = document.getElementById('mergePreviewFileList');
  const branchBadge = document.getElementById('mergePreviewBranch');
  const proceedBtn = document.getElementById('mergePreviewProceedBtn');

  if (branchBadge) branchBadge.textContent = branch;
  if (fileList) fileList.innerHTML = `<div class="merge-preview-loading">⟳ Running dry-run merge…</div>`;
  if (proceedBtn) proceedBtn.disabled = true;

  try {
    const result = await send('merge-preview', { branch });
    renderPreviewResult(result.files, branch);
    if (proceedBtn) proceedBtn.disabled = false;
  } catch (err) {
    if (fileList) {
      fileList.innerHTML = `
        <div class="merge-preview-empty" style="color: var(--conflict-red);">
          ⚠ ${escapeHtml(err.message || err.error || 'Failed to run merge preview')}
        </div>
      `;
    }
  }
}

function renderPreviewResult(files, branch) {
  const fileList = document.getElementById('mergePreviewFileList');
  if (!fileList) return;

  if (!files || files.length === 0) {
    fileList.innerHTML = `
      <div class="merge-preview-empty">
        ✅ No changes — this branch is already merged or up-to-date.
      </div>
    `;
    return;
  }

  const statusLabel = (s, conflicted) => {
    if (conflicted) return { cls: 'conflict', label: '!' };
    switch (s) {
      case 'A': return { cls: 'A', label: 'A' };
      case 'D': return { cls: 'D', label: 'D' };
      default:  return { cls: 'M', label: 'M' };
    }
  };

  const items = files.map(f => {
    const { cls, label } = statusLabel(f.status, f.conflicted);
    const title = f.conflicted ? 'Would conflict' : { A: 'Added', M: 'Modified', D: 'Deleted' }[cls] || 'Changed';
    return `
      <li class="merge-preview-file-item" title="${escapeHtml(title)}">
        <span class="merge-preview-status ${cls}">${label}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(f.file)}</span>
      </li>
    `;
  }).join('');

  const conflictCount = files.filter(f => f.conflicted).length;
  const conflictWarning = conflictCount > 0
    ? `<div style="padding:8px 10px;background:var(--conflict-red-dim);border:1px solid var(--conflict-red);border-radius:var(--radius-sm);color:var(--conflict-red);font-size:11px;margin-bottom:10px;">
        ⚠ ${conflictCount} file${conflictCount > 1 ? 's' : ''} will have conflicts — you'll need to resolve them after merging.
      </div>`
    : '';

  fileList.innerHTML = `
    ${conflictWarning}
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">${files.length} file${files.length !== 1 ? 's' : ''} would change</div>
    <ul class="merge-preview-file-list">${items}</ul>
  `;
}

/**
 * Execute the actual merge after preview approval
 */
export async function proceedWithMerge() {
  if (!currentPreviewBranch) return;
  const branch = currentPreviewBranch;

  const proceedBtn = document.getElementById('mergePreviewProceedBtn');
  if (proceedBtn) {
    proceedBtn.disabled = true;
    proceedBtn.textContent = 'Merging…';
  }

  try {
    await send('merge', { branch });
    toast(`Merged ${branch} successfully`, 'success');
    closeMergePreview();
    send('status');
    send('log', { count: 50 });
    send('merge-status');
  } catch (err) {
    toast(err.details || err.error || 'Merge failed', 'error');
    if (proceedBtn) {
      proceedBtn.disabled = false;
      proceedBtn.textContent = 'Proceed with Merge';
    }
  }
}

export function closeMergePreview() {
  const overlay = document.getElementById('mergePreviewModalOverlay');
  if (overlay) overlay.classList.remove('active');
  currentPreviewBranch = null;
}
