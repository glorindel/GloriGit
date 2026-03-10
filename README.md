# GloriGit

⚡ Super lightweight, blazing-fast Git UI that runs in your browser.

## Features

- **Zero Electron** — Uses your existing browser (0 extra RAM overhead)
- **Vanilla JS** — No React, Vue, or Angular. Instant rendering.
- **Real-time updates** — WebSocket-powered, no polling
- **Dark theme** — Cyberpunk Control Room aesthetic
- **Full Git workflow** — Status, diff, stage, commit, push, pull, branches

## Installation

You can install GloriGit globally to make the `glorigit` command available anywhere on your system:

```bash
npm install -g glorigit
```

## Usage

Simply run `glorigit` inside any git repository:

```bash
cd your-project-folder
glorigit
```

You can also run it without installing it via npx:
```bash
npx glorigit
```

Or clone and run locally:

```bash
git clone https://github.com/yourname/glorigit.git
cd glorigit
npm install
npm run dev
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Commit |
| `Ctrl+Shift+P` | Push |
| `Ctrl+Shift+L` | Pull |
| `Ctrl+R` | Refresh |
| `Escape` | Close modals |

## Architecture

```
GloriGit/
├── server.js          # HTTP + WebSocket server (raw Node.js)
├── tools/git.js       # Git command executor (child_process.execFile)
├── public/
│   ├── index.html     # Single-page UI
│   ├── css/style.css  # Cyberpunk dark theme
│   └── js/app.js      # Frontend logic (vanilla JS)
└── architecture/
    └── git-operations.md  # SOP for git commands
```

## License

GNU GENERAL PUBLIC LICENSE v3.0
