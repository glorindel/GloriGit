# GloriGit — Project Constitution

## Identity
**GloriGit** — A super lightweight, blazing-fast Git UI that runs in your browser.

## Architecture
- **Backend:** Node.js + Express + WebSocket (ws)
- **Frontend:** Vanilla HTML/CSS/JS (zero frameworks)
- **Git Interface:** `child_process.execFile('git', ...)` — direct, no abstraction
- **Delivery:** Opens in existing browser (no Electron)

## Data Schema

### Git Status Response
```json
{
  "branch": "main",
  "ahead": 0,
  "behind": 0,
  "staged": [{ "file": "path", "status": "M|A|D|R" }],
  "unstaged": [{ "file": "path", "status": "M|A|D|R" }],
  "untracked": ["path"]
}
```

### Git Log Entry
```json
{
  "hash": "abc123",
  "shortHash": "abc",
  "author": "Name",
  "email": "email",
  "date": "ISO8601",
  "message": "commit message",
  "refs": ["HEAD", "main"]
}
```

### Git Diff Response
```json
{
  "file": "path",
  "hunks": [{
    "header": "@@ -1,5 +1,7 @@",
    "lines": [
      { "type": "+|-| ", "content": "line text", "oldNum": 1, "newNum": 1 }
    ]
  }]
}
```

### Branch Info
```json
{
  "current": "main",
  "local": ["main", "dev", "feature/x"],
  "remote": ["origin/main", "origin/dev"]
}
```

## Behavioral Rules
1. **Never** execute destructive git operations without user confirmation
2. **Always** show current branch prominently
3. **Refresh** status after every mutation (stage, commit, push, pull)
4. Git commands execute via `execFile` (not `exec`) for security — no shell injection
5. All paths are relative to the target repository root
6. WebSocket for real-time updates, REST for initial data loads

## Architectural Invariants
- Zero external CSS/JS frameworks
- Total frontend bundle < 100KB
- Server startup < 500ms
- UI response to user action < 100ms
- No data leaves localhost

## Modular Architecture

The frontend is organized into ES modules (native `import`/`export`, no bundler):

```
public/
├── css/           # 10 focused stylesheets (base, header, sidebar, diff, footer, ...)
├── js/
│   ├── app.js     # Entry point — imports, event binding, init
│   ├── core/      # state.js, dom.js, ws.js, utils.js
│   ├── ui/        # toast.js, modal.js, connection.js
│   └── modules/   # status.js, diff.js, branches.js, log.js, commit.js,
│                  # historian.js, timemachine.js, heatmap.js
└── index.html     # <script type="module" src="/js/app.js">
```

See **[FEATURE_MAP.md](FEATURE_MAP.md)** for a complete table mapping every feature to its exact JS module, CSS file, and HTML section.
