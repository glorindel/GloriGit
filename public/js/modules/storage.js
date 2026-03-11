import { dom } from '../core/dom.js';
import { send } from '../core/ws.js';
import { escapeHtml } from '../core/utils.js';
import { showModal } from '../ui/modal.js';

let stashesData = [];

export function renderStashes(stashes) {
  stashesData = stashes;
  const list = dom.stashesList;
  list.innerHTML = '';

  if (!stashes || stashes.length === 0) {
    list.innerHTML = '<div class="storage-empty">No stashes found</div>';
    return;
  }

  stashes.forEach(stash => {
    const li = document.createElement('li');
    li.className = 'stash-item';
    li.innerHTML = `
      <div class="stash-header">
        <span class="stash-id">stash@{${stash.id}}</span>
        <span class="stash-date">${stash.shortHash}</span>
      </div>
      <div class="stash-message">${escapeHtml(stash.message)}</div>
      <div class="stash-actions">
        <button class="stash-btn stash-apply" data-index="${stash.id}">Apply</button>
        <button class="stash-btn stash-pop" data-index="${stash.id}">Pop</button>
        <button class="stash-btn stash-drop" data-index="${stash.id}">Drop</button>
      </div>
    `;
    list.appendChild(li);
  });

  // Attach events
  list.querySelectorAll('.stash-apply').forEach(btn => {
    btn.onclick = () => {
      send('stash-apply', { index: btn.dataset.index }).then(() => send('status'));
    };
  });

  list.querySelectorAll('.stash-pop').forEach(btn => {
    btn.onclick = () => {
      send('stash-pop', { index: btn.dataset.index }).then(() => send('status'));
    };
  });

  list.querySelectorAll('.stash-drop').forEach(btn => {
    btn.onclick = () => {
      showModal('Drop Stash', 
        `Are you sure you want to drop stash@{${btn.dataset.index}}? This cannot be undone.`,
        () => {
          send('stash-drop', { index: btn.dataset.index });
        }
      );
    };
  });
}

// Wire up saving stashes
dom.stashSaveBtn.addEventListener('click', () => {
  const msg = dom.stashMessageInput.value.trim();
  send('stash-save', { message: msg });
  dom.stashMessageInput.value = '';
});

dom.stashMessageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    dom.stashSaveBtn.click();
  }
});
