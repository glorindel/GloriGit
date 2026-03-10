# GloriGit — Feature Map

> Quick reference for AI agents and developers to locate any feature in the codebase.

## Core Infrastructure

| Feature | JS Module | CSS File | HTML Section |
|---------|-----------|----------|--------------|
| Shared State | [state.js](js/core/state.js) | — | — |
| DOM References | [dom.js](js/core/dom.js) | — | — |
| WebSocket Connection | [ws.js](js/core/ws.js) | — | — |
| Utilities (escapeHtml, splitPath, getTimeAgo) | [utils.js](js/core/utils.js) | — | — |

## UI Components

| Feature | JS Module | CSS File | HTML Section |
|---------|-----------|----------|--------------|
| Toast Notifications | [toast.js](js/ui/toast.js) | [toast.css](css/toast.css) | `#toastContainer` |
| Confirm Modal | [modal.js](js/ui/modal.js) | [modals.css](css/modals.css) | `#modalOverlay` |
| Connection Status | [connection.js](js/ui/connection.js) | [modals.css](css/modals.css) | `#connectionStatus` |

## Feature Modules

| Feature | JS Module | CSS File | HTML Section |
|---------|-----------|----------|--------------|
| Header & Branding | — | [header.css](css/header.css) | `#app-header` |
| Branch Switcher | [branches.js](js/modules/branches.js) | [header.css](css/header.css) | `#branchControl` |
| Status Panel (File Lists) | [status.js](js/modules/status.js) | [sidebar.css](css/sidebar.css) | `#workspaceView` |
| Diff Viewer | [diff.js](js/modules/diff.js) | [diff.css](css/diff.css) | `#diffPanel` |
| Commit Panel | [commit.js](js/modules/commit.js) | [footer.css](css/footer.css) | `#commitBar` |
| History Log + Canvas Graph | [log.js](js/modules/log.js) | [footer.css](css/footer.css) | `#logBar`, `#commitGraph` |
| Commit Inspector (Historian) | [historian.js](js/modules/historian.js) | [historian.css](css/historian.css) | `#commitView` |
| File History Timemachine | [timemachine.js](js/modules/timemachine.js) | [historian.css](css/historian.css) | `#fileHistoryView` |
| Author Impact Heatmap | [heatmap.js](js/modules/heatmap.js) | [heatmap.css](css/heatmap.css) | `#heatmapModalOverlay` |
| Help Modal | — | [modals.css](css/modals.css) | `#helpModalOverlay` |

## Event Wiring & Entry Point

| Feature | JS Module | Notes |
|---------|-----------|-------|
| App Init + Event Binding | [app.js](js/app.js) | Imports all modules, binds DOM events, starts WS |
| Keyboard Shortcuts | [app.js](js/app.js) | `Ctrl+Enter`, `Escape`, `?`, `Ctrl+Shift+P/L`, `Ctrl+R` |

## Backend

| Feature | File | Notes |
|---------|------|-------|
| HTTP + WebSocket Server | [server.js](server.js) | Serves static files, WS router |
| Git Engine | [tools/git.js](tools/git.js) | All git operations via `execFile` |

## Tests

| Suite | File | Coverage |
|-------|------|----------|
| Git Engine Unit Tests | [tests/git.test.js](tests/git.test.js) | 16 tests: status, log, branches, diff, file history, author stats |
| Server Integration Tests | [tests/server.test.js](tests/server.test.js) | 12 tests: HTTP endpoints + WebSocket actions |

## Design System

| Area | CSS File | Contents |
|------|----------|----------|
| Variables, Reset, Scrollbar | [base.css](css/base.css) | Color tokens, sizing, typography |
| Responsive + Loading | [responsive.css](css/responsive.css) | Media queries, skeleton shimmer |
