/**
 * GloriGit — Application Entry Point
 * 
 * ES Module entry. Imports all modules, binds DOM events, starts the app.
 */
import { state } from './core/state.js';
import { dom } from './core/dom.js';
import { escapeHtml } from './core/utils.js';
import { connect, send } from './core/ws.js';
import { toast } from './ui/toast.js';
import { showModal, hideModal, getModalCallback } from './ui/modal.js';
import { renderBranchList, toggleBranchDropdown, closeBranchDropdown } from './modules/branches.js';
import { doCommit, updateCommitButton } from './modules/commit.js';
import { clearDiff } from './modules/diff.js';
import { closeCommitView } from './modules/historian.js';
import { closeFileHistoryView } from './modules/timemachine.js';
import { loadHeatmap } from './modules/heatmap.js';
import { navigateLog, openSelectedCommit, unselectCommit, searchCommit, applyFilters, clearFilters, clearHighlight, redrawGraph } from './modules/log.js';

function bindEvents() {
  // Commit View Back Button
  dom.backToWorkspaceBtn.addEventListener('click', closeCommitView);
  dom.fhBackBtn.addEventListener('click', closeFileHistoryView);

  // Branch dropdown
  dom.branchBtn.addEventListener('click', toggleBranchDropdown);
  dom.branchSearch.addEventListener('input', () => {
    renderBranchList(dom.branchSearch.value);
  });

  // Create branch
  dom.branchCreateBtn.addEventListener('click', () => {
    const name = dom.branchSearch.value.trim();
    if (!name) {
      dom.branchSearch.focus();
      return;
    }
    closeBranchDropdown();
    send('create-branch', { name }).then(() => {
      send('status');
      send('log', { count: 50 });
      toast(`Created & switched to ${name}`, 'success');
    }).catch(err => {
      toast(err.error || 'Create branch failed', 'error');
    });
  });

  // Enter key in branch search = create
  dom.branchSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      dom.branchCreateBtn.click();
    } else if (e.key === 'Escape') {
      closeBranchDropdown();
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!dom.branchControl.contains(e.target)) {
      closeBranchDropdown();
    }
  });

  // Pull / Push
  dom.pullBtn.addEventListener('click', async () => {
    dom.pullBtn.classList.add('loading');
    try {
      await send('pull');
      toast('Pulled successfully', 'success');
      send('log', { count: 50 });
    } catch (err) {
      toast(err.error || 'Pull failed', 'error');
    }
    dom.pullBtn.classList.remove('loading');
  });

  dom.pushBtn.addEventListener('click', async () => {
    dom.pushBtn.classList.add('loading');
    try {
      await send('push');
      toast('Pushed successfully', 'success');
    } catch (err) {
      toast(err.error || 'Push failed', 'error');
    }
    dom.pushBtn.classList.remove('loading');
  });

  // Refresh
  dom.refreshBtn.addEventListener('click', () => {
    send('status');
    send('branches');
    send('log', { count: 50 });
    toast('Refreshed', 'info');
  });

  // Stage all / Unstage all
  dom.stageAllBtn.addEventListener('click', () => send('stage-all'));
  dom.unstageAllBtn.addEventListener('click', () => send('unstage-all'));
  dom.stageAllUntrackedBtn.addEventListener('click', () => {
    if (state.status?.untracked.length) {
      send('stage', { files: state.status.untracked });
    }
  });

  // Diff actions
  dom.diffStageBtn.addEventListener('click', () => {
    if (!state.selectedFile) return;
    if (state.selectedType === 'staged') {
      send('unstage', { files: [state.selectedFile] });
    } else {
      send('stage', { files: [state.selectedFile] });
    }
  });

  dom.diffDiscardBtn.addEventListener('click', () => {
    if (!state.selectedFile) return;
    const isUntracked = state.selectedType === 'untracked';
    const actionText = isUntracked ? 'delete' : 'discard all changes to';
    showModal(
      isUntracked ? 'Delete File' : 'Discard Changes',
      `Are you sure you want to ${actionText} <strong>${escapeHtml(state.selectedFile)}</strong>? This cannot be undone.`,
      async () => {
        try {
          const action = isUntracked ? 'discard-untracked' : 'discard';
          await send(action, { file: state.selectedFile });
          clearDiff();
          toast(isUntracked ? 'File deleted' : 'Changes discarded', 'info');
        } catch (err) {
          toast(err.error || 'Discard failed', 'error');
        }
      }
    );
  });

  // Commit
  dom.commitMessage.addEventListener('input', () => {
    const len = dom.commitMessage.value.length;
    dom.charCount.textContent = `${len}/200`;
    updateCommitButton();
  });

  dom.commitBtn.addEventListener('click', doCommit);

  // Log toggle
  dom.logToggle.addEventListener('click', () => {
    dom.logBar.classList.toggle('expanded');
    // Redraw graph after CSS transition ends so entries have correct layout
    if (dom.logBar.classList.contains('expanded')) {
      setTimeout(() => redrawGraph(), 400);
    }
  });

  // Modal
  dom.modalCancel.addEventListener('click', hideModal);
  dom.modalConfirm.addEventListener('click', () => {
    const cb = getModalCallback();
    if (cb) cb();
    hideModal();
  });
  dom.modalOverlay.addEventListener('click', (e) => {
    if (e.target === dom.modalOverlay) hideModal();
  });

  // Help Modal
  dom.helpBtn.addEventListener('click', () => {
    dom.helpModalOverlay.classList.add('active');
  });
  dom.helpModalClose.addEventListener('click', () => {
    dom.helpModalOverlay.classList.remove('active');
  });
  dom.helpModalOverlay.addEventListener('click', (e) => {
    if (e.target === dom.helpModalOverlay) dom.helpModalOverlay.classList.remove('active');
  });

  // Heatmap
  dom.heatmapBtn.addEventListener('click', loadHeatmap);
  dom.heatmapModalClose.addEventListener('click', () => dom.heatmapModalOverlay.classList.remove('active'));
  dom.heatmapModalOverlay.addEventListener('click', (e) => {
    if (e.target === dom.heatmapModalOverlay) dom.heatmapModalOverlay.classList.remove('active');
  });

  // Graph search
  let searchDebounce = null;
  dom.graphSearch.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      searchCommit(dom.graphSearch.value);
    }, 200);
  });

  // Graph filters
  let filterDebounce = null;
  dom.filterAuthor.addEventListener('input', () => {
    clearTimeout(filterDebounce);
    filterDebounce = setTimeout(() => {
      applyFilters({ author: dom.filterAuthor.value.trim() });
    }, 400);
  });
  dom.filterBranch.addEventListener('change', () => {
    applyFilters({ branch: dom.filterBranch.value });
  });
  dom.clearFiltersBtn.addEventListener('click', () => {
    dom.graphSearch.value = '';
    dom.filterAuthor.value = '';
    dom.filterBranch.value = '';
    clearFilters();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl+Enter = Commit
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      doCommit();
    }

    // Escape = close modals/dropdowns/commit view
    if (e.key === 'Escape') {
      hideModal();
      closeBranchDropdown();
      dom.helpModalOverlay.classList.remove('active');
      dom.heatmapModalOverlay.classList.remove('active');
      unselectCommit(); // Clear log selection

      if (state.inspectingCommit) {
        closeCommitView();
        closeFileHistoryView();
      }
    }

    // ? = Toggle help
    if (e.key === '?' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      dom.helpModalOverlay.classList.toggle('active');
    }

    // Ctrl+Shift+P = Push
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      dom.pushBtn.click();
    }

    // Ctrl+Shift+L = Pull
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
      e.preventDefault();
      dom.pullBtn.click();
    }

    // Ctrl+R = Refresh
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
      if (document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        dom.refreshBtn.click();
      }
    }

    // ↑ ↓ = Navigate commit log
    if (e.key === 'ArrowDown' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
      e.preventDefault();
      navigateLog('down');
    }
    if (e.key === 'ArrowUp' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
      e.preventDefault();
      navigateLog('up');
    }

    // Enter on selected commit = open historian
    if (e.key === 'Enter' && !e.ctrlKey && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'BUTTON') {
      openSelectedCommit();
    }
  });
}

function init() {
  bindEvents();
  connect();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
