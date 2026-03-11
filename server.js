#!/usr/bin/env node

/**
 * GloriGit — Server
 * 
 * Lightweight HTTP + WebSocket server.
 * No Express. Raw Node.js http module for maximum speed.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const gitEngine = require('./tools/git');

// --- Configuration ---
const PORT = process.env.GLORIGIT_PORT || 3847;
const HOST = '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, 'public');

// --- CLI Argument Handling ---
const args = process.argv.slice(2);
const version = require('./package.json').version;

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
GloriGit v${version}
Super lightweight, blazing-fast Git UI

Usage:
  glorigit [path]    Open repo at [path] or current directory
  glorigit --help    Show this help message
  glorigit --version Show version

Environment Variables:
  GLORIGIT_PORT      Port to listen on (default: 3847)
`);
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  console.log(`GloriGit v${version}`);
  process.exit(0);
}

// Determine target repo path from first non-flag argument or current working directory
const targetRepo = args.find(arg => !arg.startsWith('-')) || process.cwd();
gitEngine.setRepoPath(path.resolve(targetRepo));

// --- MIME Types ---
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

// --- Static File Server ---
function serveStatic(req, res) {
  let filePath = req.url === '/' ? '/index.html' : req.url;

  // Security: prevent directory traversal
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
  const fullPath = path.join(PUBLIC_DIR, filePath);

  // Ensure file is within PUBLIC_DIR
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(fullPath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // SPA fallback — serve index.html
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, data2) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not Found');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(data2);
        });
      } else {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
      return;
    }

    // Disable caching during development so browser picks up app.js changes
    const cacheControl = 'no-cache';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': cacheControl
    });
    res.end(data);
  });
}

// --- REST API ---
async function handleAPI(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const endpoint = url.pathname.replace('/api/', '');

  try {
    let result;

    switch (endpoint) {
      case 'status':
        result = await gitEngine.getStatus();
        break;
      case 'log':
        const count = parseInt(url.searchParams.get('count') || '50');
        const skip = parseInt(url.searchParams.get('skip') || '0');
        result = await gitEngine.getLog(count, skip);
        break;
      case 'branches':
        result = await gitEngine.getBranches();
        break;
      case 'repo-name':
        result = { name: await gitEngine.getRepoName(), path: gitEngine.getRepoPath() };
        break;
      default:
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Unknown endpoint' }));
        return;
    }

    res.writeHead(200);
    res.end(JSON.stringify(result));
  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message || 'Git command failed', details: err.stderr }));
  }
}

// --- HTTP Server ---
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    handleAPI(req, res);
  } else {
    serveStatic(req, res);
  }
});

// --- WebSocket Server ---
const wss = new WebSocketServer({ server });
wss.on('error', () => {}); // Prevent crash on server error (e.g. EADDRINUSE)

wss.on('connection', (ws) => {
  console.log('🔌 Client connected');

  ws.on('message', async (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      ws.send(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    const { action, payload } = msg;
    const id = msg.id || Date.now();

    try {
      let result;

      switch (action) {
        // --- Read operations ---
        case 'status':
          result = await gitEngine.getStatus();
          break;
        case 'log':
          result = await gitEngine.getLog(
            payload?.count || 50,
            payload?.skip || 0,
            { branch: payload?.branch, author: payload?.author, message: payload?.message, since: payload?.since, until: payload?.until }
          );
          break;
        case 'branches':
          result = await gitEngine.getBranches();
          break;
        case 'diff':
          result = await gitEngine.getDiff(payload.file, payload.staged || false);
          break;
        case 'diff-untracked':
          result = await gitEngine.getUntrackedDiff(payload.file);
          break;

        // --- Write operations ---
        case 'stage':
          await gitEngine.stage(payload.files);
          result = await gitEngine.getStatus(); // Return fresh status
          break;
        case 'unstage':
          await gitEngine.unstage(payload.files);
          result = await gitEngine.getStatus();
          break;
        case 'stage-all':
          await gitEngine.stageAll();
          result = await gitEngine.getStatus();
          break;
        case 'unstage-all':
          await gitEngine.unstageAll();
          result = await gitEngine.getStatus();
          break;
        case 'commit':
          await gitEngine.commit(payload.message);
          result = await gitEngine.getStatus();
          break;
        case 'push': {
          const currentBranch = payload?.branch || (await gitEngine.getBranches()).current;
          await gitEngine.push(payload?.remote, currentBranch);
          result = { success: true };
          break;
        }
        case 'pull': {
          const currentBranch = payload?.branch || (await gitEngine.getBranches()).current;
          await gitEngine.pull(payload?.remote, currentBranch);
          result = await gitEngine.getStatus();
          break;
        }
        case 'checkout':
          await gitEngine.checkout(payload.branch);
          result = await gitEngine.getStatus();
          break;
        case 'create-branch':
          await gitEngine.createBranch(payload.name, payload.startPoint);
          result = await gitEngine.getBranches();
          break;
        case 'delete-branch':
          await gitEngine.deleteBranch(payload.name, payload.force);
          result = await gitEngine.getBranches();
          break;
        case 'merge':
          await gitEngine.merge(payload.branch);
          result = await gitEngine.getStatus();
          break;
        case 'discard':
          await gitEngine.discardFile(payload.file);
          result = await gitEngine.getStatus();
          break;
        case 'discard-untracked':
          await gitEngine.deleteUntrackedFile(payload.file);
          result = await gitEngine.getStatus();
          break;
        case 'commit-files':
          result = await gitEngine.getCommitFiles(payload.hash);
          break;
        case 'commit-diff-file':
          result = await gitEngine.getCommitFileDiff(payload.hash, payload.file);
          break;
        case 'file-history':
          result = await gitEngine.getFileHistory(payload.file);
          break;
        case 'author-stats':
          result = await gitEngine.getAuthorStats(payload.days || 90);
          break;

        default:
          ws.send(JSON.stringify({ id, error: `Unknown action: ${action}` }));
          return;
      }

      ws.send(JSON.stringify({ id, action, data: result }));

      // Broadcast status update to all clients after mutations
      const mutatingActions = [
        'stage', 'unstage', 'stage-all', 'unstage-all',
        'commit', 'push', 'pull', 'checkout', 'create-branch',
        'delete-branch', 'merge', 'discard', 'discard-untracked'
      ];
      if (mutatingActions.includes(action)) {
        broadcastStatus();
      }

    } catch (err) {
      ws.send(JSON.stringify({
        id,
        action,
        error: err.message || 'Git command failed',
        details: err.stderr
      }));
    }
  });

  ws.on('close', () => {
    console.log('🔌 Client disconnected');
  });
});

/**
 * Broadcast fresh status to all connected clients
 */
async function broadcastStatus() {
  try {
    const status = await gitEngine.getStatus();
    const msg = JSON.stringify({ action: 'status-update', data: status });
    wss.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(msg);
      }
    });
  } catch {
    // Silently ignore broadcast errors
  }
}

// --- File Watcher (lightweight, no chokidar dependency) ---
let watchDebounce = null;
function startWatcher() {
  const gitDir = path.join(gitEngine.getRepoPath(), '.git');
  try {
    fs.watch(gitDir, { recursive: true }, (eventType, filename) => {
      // Debounce: only broadcast after 300ms of silence
      clearTimeout(watchDebounce);
      watchDebounce = setTimeout(() => {
        broadcastStatus();
      }, 300);
    });
    console.log('👁️  Watching .git/ for changes');
  } catch {
    console.log('⚠️  Could not watch .git/ directory');
  }
}

// --- Start ---
async function start() {
  // Verify we're in a git repo
  const isRepo = await gitEngine.isGitRepo();
  if (!isRepo) {
    console.error(`❌ Not a git repository: ${gitEngine.getRepoPath()}`);
    console.error('   Run GloriGit from a git repository or pass the path as an argument:');
    console.error('   glorigit /path/to/repo');
    process.exit(1);
  }

  const repoName = await gitEngine.getRepoName();

  function listen(port) {
    server.listen(port, HOST, () => {
      console.log('');
      console.log('  ┌──────────────────────────────────────┐');
      console.log('  │                                      │');
      console.log('  │   ✨  GloriGit is running!           │');
      console.log('  │                                      │');
      console.log(`  │   📁  ${repoName.padEnd(30)}  │`);
      console.log(`  │   🌐  http://${HOST}:${port}         │`);
      console.log('  │                                      │');
      console.log('  │   Press Ctrl+C to stop               │');
      console.log('  │                                      │');
      console.log('  └──────────────────────────────────────┘');
      console.log('');

      startWatcher();

      // Auto-open browser (Windows, macOS, Linux)
      const { exec } = require('child_process');
      const url = `http://${HOST}:${port}`;

      if (process.platform === 'win32') {
        exec(`start ${url}`);
      } else if (process.platform === 'darwin') {
        exec(`open ${url}`);
      } else {
        exec(`xdg-open ${url}`);
      }
    });
  }

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const nextPort = parseInt(server.address()?.port || PORT) + 1;
      console.log(`⚠️  Port ${nextPort - 1} is in use, trying ${nextPort}...`);
      listen(nextPort);
    } else {
      console.error('❌ Server error:', err);
      process.exit(1);
    }
  });

  listen(PORT);
}

start();
