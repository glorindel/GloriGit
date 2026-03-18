/**
 * GloriGit — Phase 7: Interactive Rebase UI
 *
 * Drag-and-drop commit reorder with action selectors (pick/squash/fixup/drop/reword).
 * Also manages in-progress rebase control (Continue / Skip / Abort).
 */
import { send } from '../core/ws.js';
import { escapeHtml } from '../core/utils.js';
import { toast } from '../ui/toast.js';

let rebaseTodoItems = []; // { action, hash, message }
let rebaseTargetBranch = '';

// Drag state
let dragSrcIndex = null;

// ───────────────────────────────────────────
// Modal Open / Close
// ───────────────────────────────────────────
export function openRebaseUI() {
  const overlay = document.getElementById('rebaseModalOverlay');
  if (!overlay) return;
  overlay.classList.add('active');

  rebaseTodoItems = [];
  rebaseTargetBranch = '';
  const input = document.getElementById('rebaseTargetBranch');
  const list = document.getElementById('rebaseList');
  const startBtn = document.getElementById('rebaseStartBtn');
  if (input) { input.value = ''; input.focus(); }
  if (list) list.innerHTML = '<div class="rebase-empty-hint">Enter a branch name above and click Load to see commits available for rebase.</div>';
  if (startBtn) startBtn.disabled = true;
}

export function closeRebaseModal() {
  const overlay = document.getElementById('rebaseModalOverlay');
  if (overlay) overlay.classList.remove('active');
}

// ───────────────────────────────────────────
// Load commits for rebase target
// ───────────────────────────────────────────
export async function loadRebaseCommits() {
  const input = document.getElementById('rebaseTargetBranch');
  if (!input) return;
  const branch = input.value.trim();
  if (!branch) {
    toast('Enter a target branch to rebase onto', 'warning');
    return;
  }

  rebaseTargetBranch = branch;
  const list = document.getElementById('rebaseList');
  if (list) list.innerHTML = '<div class="rebase-empty-hint" style="opacity:0.6">Loading commits…</div>';

  try {
    const result = await send('rebase-start', { branch });
    const commits = result.commits || [];

    if (commits.length === 0) {
      if (list) list.innerHTML = '<div class="rebase-empty-hint">No commits ahead of that branch. Nothing to rebase.</div>';
      return;
    }

    rebaseTodoItems = commits.map(c => ({ action: 'pick', hash: c.hash, shortHash: c.shortHash, message: c.message }));
    renderRebaseTodoList();

    const startBtn = document.getElementById('rebaseStartBtn');
    if (startBtn) startBtn.disabled = false;
  } catch (err) {
    const errMsg = err.error || err.message || 'Failed to load commits';
    if (list) list.innerHTML = `<div class="rebase-empty-hint" style="color:var(--conflict-red);">⚠ ${escapeHtml(errMsg)}</div>`;
    toast(errMsg, 'error');
  }
}

// ───────────────────────────────────────────
// Render the draggable todo list
// ───────────────────────────────────────────
function renderRebaseTodoList() {
  const list = document.getElementById('rebaseList');
  if (!list) return;

  list.innerHTML = '';

  rebaseTodoItems.forEach((item, idx) => {
    const li = document.createElement('li');
    li.className = `rebase-todo-item action-${item.action}`;
    li.draggable = true;
    li.dataset.idx = idx;

    li.innerHTML = `
      <span class="rebase-drag-handle" title="Drag to reorder">⠿</span>
      <select class="rebase-action-select" data-idx="${idx}">
        <option value="pick"   ${item.action === 'pick'   ? 'selected' : ''}>pick</option>
        <option value="reword" ${item.action === 'reword' ? 'selected' : ''}>reword</option>
        <option value="squash" ${item.action === 'squash' ? 'selected' : ''}>squash</option>
        <option value="fixup"  ${item.action === 'fixup'  ? 'selected' : ''}>fixup</option>
        <option value="drop"   ${item.action === 'drop'   ? 'selected' : ''}>drop</option>
      </select>
      <span class="rebase-commit-hash">${escapeHtml(item.shortHash || item.hash.substring(0, 7))}</span>
      <span class="rebase-commit-msg">${escapeHtml(item.message)}</span>
    `;

    // Action select handler
    li.querySelector('.rebase-action-select').addEventListener('change', (e) => {
      rebaseTodoItems[idx].action = e.target.value;
      li.className = `rebase-todo-item action-${e.target.value}`;
    });

    // Drag events
    li.addEventListener('dragstart', (e) => {
      dragSrcIndex = idx;
      li.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
      list.querySelectorAll('.rebase-todo-item').forEach(el => el.classList.remove('drop-over'));
    });

    li.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      list.querySelectorAll('.rebase-todo-item').forEach(el => el.classList.remove('drop-over'));
      li.classList.add('drop-over');
    });

    li.addEventListener('drop', (e) => {
      e.preventDefault();
      if (dragSrcIndex === null || dragSrcIndex === idx) return;
      // Reorder
      const [moved] = rebaseTodoItems.splice(dragSrcIndex, 1);
      rebaseTodoItems.splice(idx, 0, moved);
      dragSrcIndex = null;
      renderRebaseTodoList();
    });

    list.appendChild(li);
  });
}

// ───────────────────────────────────────────
// Start rebase
// ───────────────────────────────────────────
export async function startRebase() {
  if (!rebaseTargetBranch || rebaseTodoItems.length === 0) return;

  const startBtn = document.getElementById('rebaseStartBtn');
  if (startBtn) { startBtn.disabled = true; startBtn.textContent = 'Starting…'; }

  try {
    const result = await send('rebase-apply', {
      branch: rebaseTargetBranch,
      todoList: rebaseTodoItems.map(i => ({ action: i.action, hash: i.hash, message: i.message }))
    });

    closeRebaseModal();

    if (result.conflicts) {
      toast('Rebase paused — conflicts detected. Resolve them then Continue.', 'warning');
    } else {
      toast('Rebase completed successfully!', 'success');
    }

    send('status');
    send('log', { count: 50 });
    send('merge-status');
  } catch (err) {
    toast(err.error || err.message || 'Rebase failed', 'error');
    if (startBtn) { startBtn.disabled = false; startBtn.textContent = 'Start Rebase'; }
  }
}

// ───────────────────────────────────────────
// In-progress rebase controls
// ───────────────────────────────────────────
export async function rebaseContinue() {
  try {
    const result = await send('rebase-continue');
    if (result.conflicts) {
      toast('Still conflicts to resolve before continuing', 'warning');
    } else {
      toast('Rebase continued!', 'success');
      send('log', { count: 50 });
    }
    send('status');
    send('merge-status');
  } catch (err) {
    toast(err.error || err.details || 'Continue failed', 'error');
  }
}

export async function rebaseSkip() {
  try {
    await send('rebase-skip');
    toast('Commit skipped', 'info');
    send('status');
    send('merge-status');
  } catch (err) {
    toast(err.error || err.details || 'Skip failed', 'error');
  }
}

export async function rebaseAbort() {
  try {
    await send('rebase-abort');
    toast('Rebase aborted — working tree restored', 'info');
    send('status');
    send('log', { count: 50 });
    send('merge-status');
  } catch (err) {
    toast(err.error || err.details || 'Abort failed', 'error');
  }
}
