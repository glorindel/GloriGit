/**
 * GloriGit — Branches Module
 */
import { state } from '../core/state.js';
import { dom } from '../core/dom.js';
import { escapeHtml } from '../core/utils.js';
import { send } from '../core/ws.js';
import { toast } from '../ui/toast.js';
import { showModal } from '../ui/modal.js';

export function renderBranches(branches) {
  state.branches = branches;
  dom.currentBranch.textContent = branches.current || 'detached';
  renderBranchList();

  // Populate graph filter dropdown
  if (dom.filterBranch) {
    const current = dom.filterBranch.value;
    dom.filterBranch.innerHTML = '<option value="">All Branches</option>';
    dom.filterBranch.innerHTML += '<option value="--branches">Only local</option>';
    dom.filterBranch.innerHTML += '<option value="--remotes">Only remote</option>';
    branches.local.forEach(b => {
      dom.filterBranch.innerHTML += `<option value="${b}" ${b === current ? 'selected' : ''}>${b}</option>`;
    });
  }
}

export function renderBranchList(filter = '') {
  if (!state.branches) return;

  const { local, remote, current } = state.branches;
  let html = '';

  const filterLower = filter.toLowerCase();

  // Local branches
  const filteredLocal = local.filter(b => b.toLowerCase().includes(filterLower));
  filteredLocal.forEach(branch => {
    const isCurrent = branch === current;
    html += `
      <div class="branch-item ${isCurrent ? 'current' : ''}" data-branch="${escapeHtml(branch)}">
        <span>${escapeHtml(branch)}</span>
        ${!isCurrent ? `<button class="delete-branch" data-branch="${escapeHtml(branch)}" title="Delete branch">✕</button>` : ''}
      </div>
    `;
  });

  // Remote branches (dimmer)
  const filteredRemote = remote.filter(b => b.toLowerCase().includes(filterLower));
  if (filteredRemote.length > 0) {
    html += `<div class="branch-item" style="color: var(--text-muted); font-size: 10px; cursor: default; text-transform: uppercase; letter-spacing: 0.1em; padding-top: 10px;">Remote</div>`;
    filteredRemote.forEach(branch => {
      html += `
        <div class="branch-item" data-branch="${escapeHtml(branch)}" data-remote="true">
          <span>${escapeHtml(branch)}</span>
        </div>
      `;
    });
  }

  dom.branchList.innerHTML = html;

  // Event listeners for branch items
  dom.branchList.querySelectorAll('.branch-item[data-branch]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-branch')) return;
      const branch = el.dataset.branch;
      if (branch === state.branches.current) return;

      closeBranchDropdown();
      send('checkout', { branch }).then(() => {
        send('status');
        send('branches');
        send('log', { count: 50 });
        toast(`Switched to ${branch}`, 'success');
      }).catch(err => {
        toast(err.error || 'Checkout failed', 'error');
      });
    });

    // Delete button
    const deleteBtn = el.querySelector('.delete-branch');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const branch = deleteBtn.dataset.branch;
        showModal(
          'Delete Branch',
          `Are you sure you want to delete <strong>${escapeHtml(branch)}</strong>?`,
          () => {
            send('delete-branch', { name: branch }).then(() => {
              toast(`Deleted ${branch}`, 'success');
            }).catch(err => {
              toast(err.error || 'Delete failed', 'error');
            });
          }
        );
      });
    }
  });
}

export function toggleBranchDropdown() {
  dom.branchControl.classList.toggle('open');
  if (dom.branchControl.classList.contains('open')) {
    dom.branchSearch.value = '';
    dom.branchSearch.focus();
    renderBranchList();
  }
}

export function closeBranchDropdown() {
  dom.branchControl.classList.remove('open');
}
