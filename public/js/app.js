/**
 * GloriGit — Frontend Application
 * 
 * Zero-framework, raw DOM. WebSocket for real-time updates.
 * Modules: Connection, StatusPanel, DiffViewer, CommitPanel, BranchSwitcher, LogViewer
 */

(function () {
  'use strict';

  // =========================================
  //  STATE
  // =========================================
  const state = {
    connected: false,
    status: null,
    branches: null,
    log: [],
    selectedFile: null,
    selectedType: null,  // 'staged' | 'unstaged' | 'untracked'
    inspectingCommit: null,
    ws: null,
    pendingRequests: new Map(),
    requestId: 0
  };

  // =========================================
  //  DOM REFERENCES
  // =========================================
  const $ = (id) => document.getElementById(id);

  const dom = {
    // Header
    repoName: $('repoName'),
    repoPath: $('repoPath'),
    currentBranch: $('currentBranch'),
    branchControl: $('branchControl'),
    branchBtn: $('branchBtn'),
    branchDropdown: $('branchDropdown'),
    branchSearch: $('branchSearch'),
    branchList: $('branchList'),
    branchCreateBtn: $('branchCreateBtn'),
    aheadBadge: $('aheadBadge'),
    behindBadge: $('behindBadge'),
    pullBtn: $('pullBtn'),
    pushBtn: $('pushBtn'),
    refreshBtn: $('refreshBtn'),

    // Status panel
    stagedFiles: $('stagedFiles'),
    unstagedFiles: $('unstagedFiles'),
    untrackedFiles: $('untrackedFiles'),
    stagedCount: $('stagedCount'),
    unstagedCount: $('unstagedCount'),
    untrackedCount: $('untrackedCount'),
    stageAllBtn: $('stageAllBtn'),
    unstageAllBtn: $('unstageAllBtn'),
    stageAllUntrackedBtn: $('stageAllUntrackedBtn'),

    // Diff panel
    diffFilename: $('diffFilename'),
    diffContent: $('diffContent'),
    diffActions: $('diffActions'),
    diffStageBtn: $('diffStageBtn'),
    diffDiscardBtn: $('diffDiscardBtn'),
    diffEmpty: $('diffEmpty'),

    // Commit
    commitMessage: $('commitMessage'),
    commitBtn: $('commitBtn'),
    charCount: $('charCount'),

    // Log
    logBar: $('logBar'),
    logToggle: $('logToggle'),
    logEntries: $('logEntries'),
    logEntriesContent: $('logEntriesContent'),

    // UI
    toastContainer: $('toastContainer'),
    modalOverlay: $('modalOverlay'),
    modal: $('modal'),
    modalTitle: $('modalTitle'),
    modalBody: $('modalBody'),
    modalCancel: $('modalCancel'),
    modalConfirm: $('modalConfirm'),
    helpBtn: $('helpBtn'),
    helpModalOverlay: $('helpModalOverlay'),
    helpModalClose: $('helpModalClose'),
    connectionStatus: $('connectionStatus'),

    // Workspace vs Commit View
    workspaceView: $('workspaceView'),
    commitView: $('commitView'),
    backToWorkspaceBtn: $('backToWorkspaceBtn'),
    inspectCommitHash: $('inspectCommitHash'),
    inspectCommitDate: $('inspectCommitDate'),
    inspectCommitAuthor: $('inspectCommitAuthor'),
    inspectCommitMessage: $('inspectCommitMessage'),
    inspectCommitFileCount: $('inspectCommitFileCount'),
    inspectCommitFiles: $('inspectCommitFiles'),

    // File History Timemachine
    fileHistoryView: $('fileHistoryView'),
    fhBackBtn: $('fhBackBtn'),
    fhFilename: $('fhFilename'),
    fhCount: $('fhCount'),
    fhEntries: $('fhEntries'),

    // Canvas Graph
    commitGraph: $('commitGraph'),

    // Heatmap Modal
    heatmapBtn: $('heatmapBtn'),
    heatmapModalOverlay: $('heatmapModalOverlay'),
    heatmapModalClose: $('heatmapModalClose'),
    heatmapContainer: $('heatmapContainer')
  };

  // =========================================
  //  WEBSOCKET CONNECTION
  // =========================================
  function connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${location.host}`);

    ws.onopen = () => {
      state.connected = true;
      state.ws = ws;
      updateConnectionStatus(true);
      
      // Initial data load
      send('status');
      send('branches');
      send('log', { count: 50 });
      loadRepoInfo();
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      let isReply = false;

      // Handle response to pending request
      if (msg.id && state.pendingRequests.has(msg.id)) {
        isReply = true;
        const { resolve, reject } = state.pendingRequests.get(msg.id);
        state.pendingRequests.delete(msg.id);
        if (msg.error) {
          reject(msg);
        } else {
          resolve(msg.data);
        }
      }

      // Handle broadcast updates
      if (msg.action === 'status-update') {
        renderStatus(msg.data);
      }

      // Handle action responses
      switch (msg.action) {
        case 'status':
          renderStatus(msg.data);
          break;
        case 'branches':
          renderBranches(msg.data);
          break;
        case 'log':
          renderLog(msg.data);
          break;
        case 'diff':
        case 'diff-untracked':
          renderDiff(msg.data);
          break;
      }

      if (msg.error && !isReply) {
        toast(msg.error, 'error');
      }
    };

    ws.onclose = () => {
      state.connected = false;
      state.ws = null;
      updateConnectionStatus(false);
      // Reconnect after 2 seconds
      setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  function send(action, payload = {}) {
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return Promise.reject('Not connected');

    const id = ++state.requestId;
    state.ws.send(JSON.stringify({ id, action, payload }));

    return new Promise((resolve, reject) => {
      state.pendingRequests.set(id, { resolve, reject });
      // Timeout after 30s
      setTimeout(() => {
        if (state.pendingRequests.has(id)) {
          state.pendingRequests.delete(id);
          reject({ error: 'Request timeout' });
        }
      }, 30000);
    });
  }

  // =========================================
  //  API HELPERS
  // =========================================
  async function loadRepoInfo() {
    try {
      const res = await fetch('/api/repo-name');
      const data = await res.json();
      dom.repoName.textContent = data.name;
      dom.repoPath.textContent = data.path;
      document.title = `${data.name} — GloriGit`;
    } catch {
      dom.repoName.textContent = 'GloriGit';
    }
  }

  // =========================================
  //  RENDER: STATUS
  // =========================================
  function renderStatus(status) {
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

  function splitPath(filePath) {
    const last = filePath.lastIndexOf('/');
    if (last === -1) return { dir: '', name: filePath };
    return {
      dir: filePath.substring(0, last),
      name: filePath.substring(last + 1)
    };
  }

  // =========================================
  //  FILE SELECTION & DIFF
  // =========================================
  function selectFile(file, type) {
    state.selectedFile = file;
    state.selectedType = type;

    // Update selected state in file lists
    document.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
    // Find and highlight the clicked item
    const allItems = document.querySelectorAll('.file-item');
    allItems.forEach(el => {
      const nameEl = el.querySelector('.file-name');
      if (nameEl && nameEl.textContent.replace(/.*\//, '') === splitPath(file).name) {
        // More precise check
      }
    });

    // Re-render to show selected state
    if (state.status) {
      renderStatus(state.status);
    }

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

  // =========================================
  //  RENDER: DIFF
  // =========================================
  function renderDiff(diffData) {
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

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // =========================================
  //  RENDER: BRANCHES
  // =========================================
  function renderBranches(branches) {
    state.branches = branches;
    dom.currentBranch.textContent = branches.current || 'detached';

    renderBranchList();
  }

  function renderBranchList(filter = '') {
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

  // =========================================
  //  RENDER: LOG
  // =========================================
  function renderLog(log) {
    state.log = log;
    dom.logEntriesContent.innerHTML = '';

    log.forEach(entry => {
      const div = document.createElement('div');
      div.className = 'log-entry';

      const refsHtml = entry.refs.length > 0
        ? `<div class="log-refs">${entry.refs.map(r => `<span class="log-ref">${escapeHtml(r)}</span>`).join('')}</div>`
        : '';

      const timeAgo = getTimeAgo(entry.date);

      div.innerHTML = `
        <span class="log-hash">${escapeHtml(entry.shortHash)}</span>
        <span class="log-message">${escapeHtml(entry.message)}</span>
        ${refsHtml}
        <span class="log-author">${escapeHtml(entry.author)}</span>
        <span class="log-date">${timeAgo}</span>
      `;

      // Make it clickable for inspection
      div.style.cursor = 'pointer';
      div.addEventListener('click', () => openCommitView(entry));

      dom.logEntriesContent.appendChild(div);
    });

    // Draw the visual graph after DOM elements are created
    requestAnimationFrame(() => drawCommitGraph(log));
  }

  function drawCommitGraph(log) {
    if (!dom.commitGraph || log.length === 0) return;
    
    const canvas = dom.commitGraph;
    const ctx = canvas.getContext('2d');
    const entries = dom.logEntries.querySelectorAll('.log-entry');
    
    // Set exact dimensions
    canvas.width = 60;
    canvas.height = dom.logEntries.scrollHeight;
    
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Aesthetics - Cyberpunk Neon Palette
    const colors = ['#22d3ee', '#f472b6', '#a855f7', '#fbbf24', '#4ade80', '#f87171'];
    
    // Nodes position helpers
    const getX = (track) => 20 + (track * 12);
    const getY = (index) => {
      const el = entries[index];
      return el ? el.offsetTop + (el.offsetHeight / 2) : 0;
    };
    
    // Routing state
    let activeTracks = []; // Array of active parent hashes
    const trackColors = {}; // Track index -> color
    let nextColorIdx = 0;
    
    // Pass 1: Assign commits to tracks and build connections
    const nodes = []; // store node data for drawing later
    const edges = []; // store edge data
    
    log.forEach((commit, i) => {
      let currentTrack = activeTracks.indexOf(commit.hash);
      
      if (currentTrack === -1) {
        // Find empty slot or append
        currentTrack = activeTracks.findIndex(t => !t);
        if (currentTrack === -1) currentTrack = activeTracks.length;
        
        // Assign color
        trackColors[currentTrack] = colors[nextColorIdx % colors.length];
        nextColorIdx++;
      }
      
      const commitColor = trackColors[currentTrack];
      const y = getY(i);
      const x = getX(currentTrack);
      
      nodes.push({ x, y, color: commitColor, isMerge: commit.parents && commit.parents.length > 1 });
      
      // Update tracks with parents
      if (commit.parents && commit.parents.length > 0) {
        commit.parents.forEach((parentHash, pIdx) => {
          if (pIdx === 0) {
            // First parent inherits the primary track
            activeTracks[currentTrack] = parentHash;
            
            // Find parent index in log
            const pLogIdx = log.findIndex(c => c.hash === parentHash);
            if (pLogIdx !== -1) {
               edges.push({
                 fromX: x, fromY: y,
                 toX: getX(currentTrack), toY: getY(pLogIdx),
                 color: commitColor
               });
            } else {
               // Parent is further back, just draw line downwards out of view
               edges.push({
                 fromX: x, fromY: y,
                 toX: getX(currentTrack), toY: canvas.height + 20,
                 color: commitColor
               });
            }
          } else {
            // Additional parents (Merge)
            let mergeTrack = activeTracks.indexOf(parentHash);
            
            // If parent isn't in a track yet, find an empty one for it
            if (mergeTrack === -1) {
              mergeTrack = activeTracks.findIndex(t => !t && t !== currentTrack);
              if (mergeTrack === -1) mergeTrack = activeTracks.length;
              activeTracks[mergeTrack] = parentHash;
              
              if (!trackColors[mergeTrack]) {
                 trackColors[mergeTrack] = colors[nextColorIdx % colors.length];
                 nextColorIdx++;
              }
            }
            
            const pLogIdx = log.findIndex(c => c.hash === parentHash);
            const parentColor = trackColors[mergeTrack];
            
            if (pLogIdx !== -1) {
               // Draw merge line
               edges.push({
                 fromX: x, fromY: y,
                 toX: getX(mergeTrack), toY: getY(pLogIdx),
                 color: parentColor
               });
            } else {
               // Parent out of view downwards
               edges.push({
                 fromX: x, fromY: y,
                 toX: getX(mergeTrack), toY: canvas.height + 20,
                 color: parentColor
               });
            }
          }
        });
      } else {
        // Initial commit or no parents
        activeTracks[currentTrack] = null; // Free up track
      }
    });
    
    // Draw all edges (bottom to top ideally, so nodes render on top)
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    
    edges.forEach(edge => {
      ctx.beginPath();
      ctx.strokeStyle = edge.color;
      
      // If straightforward vertical
      if (edge.fromX === edge.toX) {
        ctx.moveTo(edge.fromX, edge.fromY);
        ctx.lineTo(edge.toX, edge.toY);
      } else {
        // Curved merge/branch lines
        ctx.moveTo(edge.fromX, edge.fromY);
        // Add bezier curve
        ctx.bezierCurveTo(
          edge.fromX, edge.fromY + 15,
          edge.toX, edge.toY - 15,
          edge.toX, edge.toY
        );
      }
      ctx.stroke();
    });
    
    // Draw nodes
    nodes.forEach(node => {
      // Glow
      ctx.shadowBlur = 6;
      ctx.shadowColor = node.color;
      
      ctx.beginPath();
      ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a'; // match bg-base
      ctx.fill();
      
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = node.color;
      ctx.stroke();
      
      if (node.isMerge) {
         // Add a dot inside for merge commits
         ctx.beginPath();
         ctx.arc(node.x, node.y, 1.5, 0, Math.PI * 2);
         ctx.fillStyle = node.color;
         ctx.fill();
      }
      
      // Reset shadow
      ctx.shadowBlur = 0;
    });
  }

  async function openCommitView(commit) {
    state.inspectingCommit = commit.hash;
    
    // Switch Views
    dom.workspaceView.style.display = 'none';
    dom.commitView.style.display = 'flex';
    
    // Populate Metadata
    dom.inspectCommitHash.textContent = commit.shortHash;
    dom.inspectCommitDate.textContent = getTimeAgo(commit.date);
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

  function closeCommitView() {
    state.inspectingCommit = null;
    dom.commitView.style.display = 'none';
    dom.workspaceView.style.display = 'flex';
    if (state.selectedType === 'history') {
      clearDiff();
    }
  }

  // =========================================
  //  FILE HISTORY TIMEMACHINE
  // =========================================
  async function openFileHistoryView(file) {
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

  function closeFileHistoryView() {
    state.inspectingCommit = null;
    dom.fileHistoryView.style.display = 'none';
    dom.workspaceView.style.display = 'flex';
    if (state.selectedType === 'history') {
      clearDiff();
    }
  }

  // =========================================
  //  AUTHOR IMPACT HEATMAP
  // =========================================
  async function loadHeatmap() {
    dom.heatmapModalOverlay.classList.add('active');
    dom.heatmapContainer.innerHTML = '<div style="color: var(--text-muted); text-align: center;">Loading stats...</div>';
    
    try {
      const stats = await send('author-stats', { days: 90 });
      renderHeatmap(stats);
    } catch (err) {
      dom.heatmapContainer.innerHTML = `<div style="color: var(--red);">Failed to load heatmap: ${err.message}</div>`;
    }
  }

  function renderHeatmap(stats) {
    dom.heatmapContainer.innerHTML = '';
    
    // Format: stats = { '2024-03-01': { 'Author': 5 } }
    // Let's aggregate by author first
    const authors = {};
    const dates = Object.keys(stats).sort();
    
    if (dates.length === 0) {
      dom.heatmapContainer.innerHTML = '<div style="color: var(--text-muted); text-align: center;">No activity in the last 90 days.</div>';
      return;
    }
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    
    // Group stats by author
    Object.entries(stats).forEach(([dateStr, dateStats]) => {
      Object.entries(dateStats).forEach(([author, count]) => {
        if (!authors[author]) authors[author] = { total: 0, days: {} };
        authors[author].days[dateStr] = count;
        authors[author].total += count;
      });
    });
    
    // Sort authors by total commits descending
    const sortedAuthors = Object.entries(authors).sort((a, b) => b[1].total - a[1].total);
    
    sortedAuthors.forEach(([author, data]) => {
      const authorBlock = document.createElement('div');
      authorBlock.innerHTML = `
        <div class="heatmap-author-label">
          <span>${escapeHtml(author)}</span>
          <span class="heatmap-total-badge">${data.total} commits</span>
        </div>
        <div class="heatmap-scroll-container">
          <div class="heatmap-grid" id="grid-${author.replace(/[^a-z0-9]/gi, '')}"></div>
        </div>
      `;
      dom.heatmapContainer.appendChild(authorBlock);
      
      const grid = authorBlock.querySelector('.heatmap-grid');
      
      // Calculate start of the grid (Sunday prior to 90 days ago)
      let current = new Date(startDate);
      current.setDate(current.getDate() - current.getDay()); 
      
      const today = new Date();
      
      while (current <= today) {
        const dateStr = current.toISOString().split('T')[0];
        const count = data.days[dateStr] || 0;
        
        let level = 0;
        if (count > 0) level = 1;
        if (count >= 5) level = 2;
        if (count >= 10) level = 3;
        if (count >= 20) level = 4;
        
        const cell = document.createElement('div');
        cell.className = `heatmap-cell ${level ? 'level-' + level : ''}`;
        cell.title = `${count} commits on ${dateStr}`;
        grid.appendChild(cell);
        
        current.setDate(current.getDate() + 1);
      }
    });
  }

  function getTimeAgo(dateStr) {
    if (!dateStr) return '';
    const now = new Date();
    const then = new Date(dateStr);
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 30) return `${diffDay}d ago`;
    return then.toLocaleDateString();
  }

  // =========================================
  //  COMMIT
  // =========================================
  function updateCommitButton() {
    const hasStaged = state.status && state.status.staged.length > 0;
    const hasMessage = dom.commitMessage.value.trim().length > 0;
    dom.commitBtn.disabled = !(hasStaged && hasMessage);
  }

  async function doCommit() {
    const message = dom.commitMessage.value.trim();
    if (!message) return;

    try {
      await send('commit', { message });
      dom.commitMessage.value = '';
      dom.charCount.textContent = '0/200';
      updateCommitButton();
      toast('Committed!', 'success');

      // Refresh log
      send('log', { count: 50 });

      // Clear diff view if showing a staged file
      if (state.selectedType === 'staged') {
        clearDiff();
      }
    } catch (err) {
      toast(err.error || 'Commit failed', 'error');
    }
  }

  function clearDiff() {
    state.selectedFile = null;
    state.selectedType = null;
    dom.diffFilename.textContent = 'Select a file to view changes';
    dom.diffContent.innerHTML = '<div class="diff-empty"><div class="diff-empty-icon">📂</div><p>Select a file from the sidebar to view its diff</p></div>';
    dom.diffActions.style.display = 'none';
  }

  // =========================================
  //  BRANCH DROPDOWN
  // =========================================
  function toggleBranchDropdown() {
    dom.branchControl.classList.toggle('open');
    if (dom.branchControl.classList.contains('open')) {
      dom.branchSearch.value = '';
      dom.branchSearch.focus();
      renderBranchList();
    }
  }

  function closeBranchDropdown() {
    dom.branchControl.classList.remove('open');
  }

  // =========================================
  //  TOAST NOTIFICATIONS
  // =========================================
  function toast(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${escapeHtml(message)}</span>`;
    dom.toastContainer.appendChild(el);

    setTimeout(() => {
      el.classList.add('toast-exit');
      setTimeout(() => el.remove(), 200);
    }, 3500);
  }

  // =========================================
  //  MODAL
  // =========================================
  let modalCallback = null;

  function showModal(title, body, onConfirm) {
    dom.modalTitle.textContent = title;
    dom.modalBody.innerHTML = body;
    dom.modalOverlay.classList.add('active');
    modalCallback = onConfirm;
  }

  function hideModal() {
    dom.modalOverlay.classList.remove('active');
    modalCallback = null;
  }

  // =========================================
  //  CONNECTION STATUS
  // =========================================
  function updateConnectionStatus(connected) {
    dom.connectionStatus.classList.toggle('connected', connected);
  }

  // =========================================
  //  EVENT LISTENERS
  // =========================================
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
    });

    // Modal
    dom.modalCancel.addEventListener('click', hideModal);
    dom.modalConfirm.addEventListener('click', () => {
      if (modalCallback) modalCallback();
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
    });
  }

  // =========================================
  //  INIT
  // =========================================
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

})();
