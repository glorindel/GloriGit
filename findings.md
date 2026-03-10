# GloriGit — Findings & Research

## Why Most Git UIs Are Slow
1. **Electron** — Chromium + Node = 300-500MB RAM baseline
2. **Heavy frameworks** — React/Vue/Angular add parsing, virtual DOM overhead
3. **Synchronous git calls** — Blocking the event loop while waiting for git
4. **Over-fetching** — Loading entire git log on startup

## Speed Strategy
- **No Electron** — Use user's existing browser (0 extra RAM for shell)
- **No frameworks** — Vanilla JS, manual DOM updates (faster than virtual DOM for small UIs)
- **`execFile` not `exec`** — Skips shell, directly spawns git binary
- **Streaming** — Stream large diffs/logs via WebSocket chunks
- **Lazy loading** — Only fetch what's visible (paginated log, on-demand diffs)
- **Debounced file watchers** — Watch `.git/` for changes, auto-refresh

## Existing Tools Reviewed
| Tool | Pros | Cons |
|------|------|------|
| git-webui | Lightweight, Python+browser | Limited features, unmaintained |
| ungit | Beautiful tree viz | Too many options, Node-heavy |
| lazygit | Blazing fast TUI | Terminal only, no mouse UI |
| GitUI (Rust) | Fastest terminal UI | Terminal only |
| Sourcetree | Full-featured GUI | Slow, heavy, Electron-like |

## Key Libraries
- `simple-git` — Nice API but adds abstraction overhead. **Decision: skip, use raw child_process**
- `ws` — Minimal WebSocket library for Node.js (fast, no bloat)
- `chokidar` — File watcher for auto-refresh (lightweight)
- `express` — Minimal HTTP server (could also use raw `http` module)

## Decision: Use raw `http` module + `ws` to minimize dependencies
