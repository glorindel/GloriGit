/**
 * GloriGit — DOM References
 */
const $ = (id) => document.getElementById(id);

export const dom = {
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

  // Graph Search & Filters
  graphSearch: $('graphSearch'),
  filterAuthor: $('filterAuthor'),
  filterBranch: $('filterBranch'),
  clearFiltersBtn: $('clearFiltersBtn'),

  // Heatmap Modal
  heatmapBtn: $('heatmapBtn'),
  heatmapModalOverlay: $('heatmapModalOverlay'),
  heatmapModalClose: $('heatmapModalClose'),
  heatmapContainer: $('heatmapContainer')
};
