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
  discardAllBtn: $('discardAllBtn'),
  unstageAllBtn: $('unstageAllBtn'),
  stageAllUntrackedBtn: $('stageAllUntrackedBtn'),
  discardAllUntrackedBtn: $('discardAllUntrackedBtn'),

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
  logResizer: $('logResizer'),
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
  
  // Storage View
  stashBtn: $('storageBtn'),
  storageView: $('storageView'),
  stashBackBtn: $('storageBackBtn'),
  stashesList: $('stashesList'),
  stashMessageInput: $('stashMessageInput'),
  stashSaveBtn: $('stashSaveBtn'),
  stashToggleStaged: $('stashToggleStaged'),
  stashToggleUnstaged: $('stashToggleUnstaged'),
  stashToggleUntracked: $('stashToggleUntracked'),
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
  filterMessage: $('filterMessage'),
  filterAuthor: $('filterAuthor'),
  filterBranch: $('filterBranch'),
  filterSince: $('filterSince'),
  filterUntil: $('filterUntil'),
  clearFiltersBtn: $('clearFiltersBtn'),

  // Heatmap Modal
  heatmapBtn: $('heatmapBtn'),
  heatmapModalOverlay: $('heatmapModalOverlay'),
  heatmapModalClose: $('heatmapModalClose'),
  heatmapContainer: $('heatmapContainer'),

  // Phase 7: Warzone
  warzoneBtn: $('warzoneBtn'),
  warzoneBadge: $('warzoneBadge'),
  warzoneView: $('warzoneView'),
  warzoneBackBtn: $('warzoneBackBtn'),
  warzoneMergeInfo: $('warzoneMergeInfo'),
  warzoneConflictSection: $('warzoneConflictSection'),
  conflictFileList: $('conflictFileList'),
  warzonePreviewMergeBtn: $('warzonePreviewMergeBtn'),
  warzoneRebaseBtn: $('warzoneRebaseBtn'),
  warzoneAbortMergeBtn: $('warzoneAbortMergeBtn'),
  warzoneEmptyState: $('warzoneEmptyState'),
  // Conflict banner
  conflictBanner: $('conflictBanner'),
  conflictBannerCount: $('conflictBannerCount'),
  conflictBannerAbortBtn: $('conflictBannerAbortBtn'),
  // Rebase status bar
  rebaseStatusBar: $('rebaseStatusBar'),
  rebaseContinueBtn: $('rebaseContinueBtn'),
  rebaseSkipBtn: $('rebaseSkipBtn'),
  rebaseAbortBtn: $('rebaseAbortBtn'),
  // Merge preview modal
  mergePreviewModalOverlay: $('mergePreviewModalOverlay'),
  mergePreviewModalClose: $('mergePreviewModalClose'),
  mergePreviewBranch: $('mergePreviewBranch'),
  mergePreviewFileList: $('mergePreviewFileList'),
  mergePreviewProceedBtn: $('mergePreviewProceedBtn'),
  mergePreviewCancelBtn: $('mergePreviewCancelBtn'),
  // Rebase modal
  rebaseModalOverlay: $('rebaseModalOverlay'),
  rebaseModalClose: $('rebaseModalClose'),
  rebaseTargetBranch: $('rebaseTargetBranch'),
  rebaseLoadBtn: $('rebaseLoadBtn'),
  rebaseList: $('rebaseList'),
  rebaseStartBtn: $('rebaseStartBtn'),
  rebaseCancelBtn: $('rebaseCancelBtn')
};
