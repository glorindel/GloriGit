# GloriGit

⚡ Super lightweight, blazing-fast Git UI that runs in your browser.

## Features

- **Zero Electron** — Uses your existing browser (0 extra RAM overhead)
- **Vanilla JS** — No React, Vue, or Angular. Instant rendering.
- **Real-time updates** — WebSocket-powered, no polling
- **Dark theme** — Cyberpunk Control Room aesthetic
- **Full Git workflow** — Status, diff, stage, commit, push, pull, branches

## Installation

### For Users (Global)
The most reliable way to install is to clone the repository first:

```bash
git clone https://github.com/glorindel/GloriGit.git
cd GloriGit
npm install -g .
```

Alternatively, you can try installing directly via URL (though this can sometimes fail due to npm/git configurations):
```bash
npm install -g https://github.com/glorindel/GloriGit.git
```

> [!NOTE]
> `npm install -g glorigit` will only work once the package is published to the public npm registry.

### For Developers (Local Development)
If you've cloned the repository and want to run it globally while testing changes:

```bash
# Inside the GloriGit repository folder
npm link
```

## Usage

Simply run `glorigit` inside any git repository:

```bash
cd your-project-folder
glorigit
```

Or specify a path directly:
```bash
glorigit /path/to/repo
```

### Options
- `--help`: Show usage information
- `--version`: Show current version
- `npx glorigit`: Run without permanent installation

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
