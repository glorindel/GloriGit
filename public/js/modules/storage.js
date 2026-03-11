import { dom } from '../core/dom.js';
import { send } from '../core/ws.js';
import { escapeHtml } from '../core/utils.js';
import { showModal } from '../ui/modal.js';
import { renderDiff } from './diff.js';

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
      <div class="stash-files-container" id="stashFiles-${stash.id}" style="display:none;">
        <div class="stash-files-loading">Loading files...</div>
        <ul class="stash-files-list file-list"></ul>
      </div>
    `;
    list.appendChild(li);

    // Click to expand/collapse files
    li.addEventListener('click', async (e) => {
      // Don't expand if clicking a button
      if (e.target.tagName === 'BUTTON') return;

      const container = document.getElementById(`stashFiles-${stash.id}`);
      const isExpanded = container.style.display === 'block';

      // Close all others
      document.querySelectorAll('.stash-files-container').forEach(c => c.style.display = 'none');
      document.querySelectorAll('.stash-item').forEach(i => i.classList.remove('expanded'));

      if (!isExpanded) {
        container.style.display = 'block';
        li.classList.add('expanded');
        
        try {
          const files = await send('stash-files', { index: stash.id });
          const ul = container.querySelector('.stash-files-list');
          ul.innerHTML = '';
          
          if (files.length === 0) {
            container.innerHTML = '<div class="storage-empty">No files</div>';
            return;
          }

          container.querySelector('.stash-files-loading')?.remove();

          files.forEach(f => {
            const fileLi = document.createElement('li');
            fileLi.className = 'file-item';
            fileLi.innerHTML = `
              <span class="file-status status-${f.status}">${f.status}</span>
              <span class="file-name" title="${escapeHtml(f.file)}">${escapeHtml(f.file)}</span>
            `;
            ul.appendChild(fileLi);

            // Click file to view diff
            fileLi.addEventListener('click', async (evt) => {
              evt.stopPropagation();
              
              // Remove active from all stash files
              document.querySelectorAll('.stash-files-list .file-item').forEach(i => i.classList.remove('active'));
              fileLi.classList.add('active');

              try {
                const diff = await send('stash-diff', { index: stash.id, file: f.file });
                
                // Show in the diff panel
                const contentStr = diff.hunks.length === 0 ? 'Binary file or no text changes.' : null;
                renderDiff(f.file, diff.hunks, true, contentStr, f.status);
                
                // To support returning to diff view later
                // Ideally we'd set state, but rendering it directly works for display
              } catch (err) {
                console.error('Failed to load stash diff', err);
              }
            });
          });
        } catch (err) {
          container.innerHTML = `<div class="storage-empty" style="color:red">Failed to load files</div>`;
        }
      }
    });
  });

  // Attach events
  list.querySelectorAll('.stash-apply').forEach(btn => {
    btn.onclick = () => {
      send('stash-apply', { index: btn.dataset.index }).then(stashes => {
        renderStashes(stashes);
        send('status');
      });
    };
  });

  list.querySelectorAll('.stash-pop').forEach(btn => {
    btn.onclick = () => {
      send('stash-pop', { index: btn.dataset.index }).then(stashes => {
        renderStashes(stashes);
        send('status');
      });
    };
  });

  list.querySelectorAll('.stash-drop').forEach(btn => {
    btn.onclick = () => {
      showModal('Drop Stash', 
        `Are you sure you want to drop stash@{${btn.dataset.index}}? This cannot be undone.`,
        () => {
          send('stash-drop', { index: btn.dataset.index }).then(stashes => {
            renderStashes(stashes);
          });
        }
      );
    };
  });
}

// Wire up saving stashes
dom.stashSaveBtn.addEventListener('click', () => {
  const msg = dom.stashMessageInput.value.trim();
  send('stash-save', { message: msg }).then(stashes => {
    renderStashes(stashes);
    send('status'); 
  });
  dom.stashMessageInput.value = '';
});

dom.stashMessageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    dom.stashSaveBtn.click();
  }
});
