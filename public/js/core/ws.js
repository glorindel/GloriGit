/**
 * GloriGit — WebSocket Connection
 */
import { state } from './state.js';
import { dom } from './dom.js';
import { updateConnectionStatus } from '../ui/connection.js';
import { toast } from '../ui/toast.js';
import { renderStatus } from '../modules/status.js';
import { renderBranches } from '../modules/branches.js';
import { renderLog } from '../modules/log.js';
import { renderDiff } from '../modules/diff.js';
import { renderStashes } from '../modules/storage.js';

export function connect() {
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
      case 'stashes':
        renderStashes(msg.data);
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

export function send(action, payload = {}) {
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
