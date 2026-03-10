/**
 * GloriGit — Shared Application State
 */
export const state = {
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
