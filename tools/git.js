/**
 * GloriGit — Git Command Executor
 * 
 * All git operations as async functions using child_process.execFile.
 * Returns structured JSON. No shell injection possible.
 */

const { execFile } = require('child_process');
const path = require('path');

// Default repo path — overridden by server
let repoPath = process.cwd();

function setRepoPath(p) {
  repoPath = p;
}

function getRepoPath() {
  return repoPath;
}

/**
 * Execute a git command and return stdout
 */
function git(args, options = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      cwd: repoPath,
      maxBuffer: 1024 * 1024 * 10, // 10MB for large diffs
      ...options
    };

    execFile('git', args, opts, (error, stdout, stderr) => {
      if (error) {
        // Some git commands use stderr for non-error info
        if (error.code === 1 && args[0] === 'diff') {
          resolve(stdout); // diff returns exit 1 when there are differences
          return;
        }
        reject({ message: error.message, stderr: stderr.trim(), code: error.code });
        return;
      }
      resolve(stdout);
    });
  });
}

/**
 * Get repository status (staged, unstaged, untracked)
 */
async function getStatus() {
  const output = await git(['status', '--porcelain=v2', '--branch']);
  const lines = output.split('\n').filter(Boolean);

  const result = {
    branch: '',
    ahead: 0,
    behind: 0,
    staged: [],
    unstaged: [],
    untracked: []
  };

  for (const line of lines) {
    if (line.startsWith('# branch.head ')) {
      result.branch = line.replace('# branch.head ', '');
    } else if (line.startsWith('# branch.ab ')) {
      const match = line.match(/\+(\d+) -(\d+)/);
      if (match) {
        result.ahead = parseInt(match[1]);
        result.behind = parseInt(match[2]);
      }
    } else if (line.startsWith('1 ') || line.startsWith('2 ')) {
      // Changed entry
      const parts = line.split('\t');
      const info = parts[0].split(' ');
      const xy = info[1]; // XY status codes
      const filePath = parts[parts.length - 1];

      const stagedStatus = xy[0];
      const unstagedStatus = xy[1];

      if (stagedStatus !== '.') {
        result.staged.push({ file: filePath, status: stagedStatus });
      }
      if (unstagedStatus !== '.') {
        result.unstaged.push({ file: filePath, status: unstagedStatus });
      }
    } else if (line.startsWith('? ')) {
      result.untracked.push(line.substring(2));
    }
  }

  return result;
}

/**
 * Get commit log (paginated)
 */
async function getLog(count = 50, skip = 0) {
  const format = '--format={"hash":"%H","shortHash":"%h","author":"%an","email":"%ae","date":"%aI","message":"%s","refs":"%D"}';
  const output = await git([
    'log', format,
    `--max-count=${count}`,
    `--skip=${skip}`,
    '--no-merges'
  ]);

  const lines = output.trim().split('\n').filter(Boolean);
  return lines.map(line => {
    // Escape problematic characters in JSON
    const sanitized = line
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      // Restore the format delimiters
      .replace(/\\"{/g, '{"')
      .replace(/}\\"/g, '"}')
      .replace(/\\":/g, '":')
      .replace(/,\\"/g, ',"')
      .replace(/:\\"([^"]*)\\"/g, ':"$1"');

    try {
      const entry = JSON.parse(line);
      entry.refs = entry.refs ? entry.refs.split(', ').filter(Boolean) : [];
      return entry;
    } catch {
      // Fallback for messages with special chars
      try {
        const hashMatch = line.match(/"hash":"([^"]+)"/);
        const shortMatch = line.match(/"shortHash":"([^"]+)"/);
        const authorMatch = line.match(/"author":"([^"]+)"/);
        const emailMatch = line.match(/"email":"([^"]+)"/);
        const dateMatch = line.match(/"date":"([^"]+)"/);
        const refsMatch = line.match(/"refs":"([^"]*)"/);
        const messageMatch = line.match(/"message":"(.+?)","refs"/);

        return {
          hash: hashMatch ? hashMatch[1] : '',
          shortHash: shortMatch ? shortMatch[1] : '',
          author: authorMatch ? authorMatch[1] : '',
          email: emailMatch ? emailMatch[1] : '',
          date: dateMatch ? dateMatch[1] : '',
          message: messageMatch ? messageMatch[1] : '(parse error)',
          refs: refsMatch && refsMatch[1] ? refsMatch[1].split(', ').filter(Boolean) : []
        };
      } catch {
        return {
          hash: '', shortHash: '', author: '', email: '',
          date: '', message: '(parse error)', refs: []
        };
      }
    }
  });
}

/**
 * Get diff for a specific file (unstaged)
 */
async function getDiff(file, staged = false) {
  const args = staged
    ? ['diff', '--cached', '--', file]
    : ['diff', '--', file];

  const output = await git(args);
  return parseDiff(output, file);
}

/**
 * Get diff for an untracked file (show full content as additions)
 */
async function getUntrackedDiff(file) {
  const output = await git(['diff', '--no-index', '/dev/null', file]).catch(e => {
    // diff --no-index exits with 1 when files differ
    if (e.stderr !== undefined) {
      return e.stderr;
    }
    throw e;
  });

  // For untracked files, just read content
  const fs = require('fs');
  const fullPath = path.join(repoPath, file);
  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');
    return {
      file,
      hunks: [{
        header: `@@ -0,0 +1,${lines.length} @@`,
        lines: lines.map((line, i) => ({
          type: '+',
          content: line,
          oldNum: null,
          newNum: i + 1
        }))
      }]
    };
  } catch {
    return { file, hunks: [] };
  }
}

/**
 * Parse unified diff output into structured data
 */
function parseDiff(diffOutput, file) {
  const result = { file, hunks: [] };
  if (!diffOutput.trim()) return result;

  const lines = diffOutput.split('\n');
  let currentHunk = null;
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/);
      if (match) {
        oldLine = parseInt(match[1]);
        newLine = parseInt(match[2]);
        currentHunk = {
          header: line,
          lines: []
        };
        result.hunks.push(currentHunk);
      }
    } else if (currentHunk) {
      if (line.startsWith('+')) {
        currentHunk.lines.push({
          type: '+',
          content: line.substring(1),
          oldNum: null,
          newNum: newLine++
        });
      } else if (line.startsWith('-')) {
        currentHunk.lines.push({
          type: '-',
          content: line.substring(1),
          oldNum: oldLine++,
          newNum: null
        });
      } else if (line.startsWith(' ') || line === '') {
        currentHunk.lines.push({
          type: ' ',
          content: line.substring(1) || '',
          oldNum: oldLine++,
          newNum: newLine++
        });
      }
    }
  }

  return result;
}

/**
 * Get branches (local and remote)
 */
async function getBranches() {
  const output = await git(['branch', '-a', '--format=%(refname:short) %(HEAD)']);
  const lines = output.trim().split('\n').filter(Boolean);

  const result = { current: '', local: [], remote: [] };

  for (const line of lines) {
    const parts = line.trim().split(' ');
    const name = parts[0];
    const isCurrent = parts[1] === '*';

    if (isCurrent) result.current = name;

    if (name.startsWith('origin/')) {
      result.remote.push(name);
    } else {
      result.local.push(name);
    }
  }

  return result;
}

/**
 * Stage files
 */
async function stage(files) {
  if (!Array.isArray(files)) files = [files];
  return git(['add', '--', ...files]);
}

/**
 * Unstage files
 */
async function unstage(files) {
  if (!Array.isArray(files)) files = [files];
  return git(['reset', 'HEAD', '--', ...files]);
}

/**
 * Stage all files
 */
async function stageAll() {
  return git(['add', '-A']);
}

/**
 * Unstage all files
 */
async function unstageAll() {
  return git(['reset', 'HEAD']);
}

/**
 * Commit with message
 */
async function commit(message) {
  if (!message || !message.trim()) {
    throw { message: 'Commit message cannot be empty' };
  }
  return git(['commit', '-m', message]);
}

/**
 * Push to remote
 */
async function push(remote = 'origin', branch = '') {
  const args = ['push', remote];
  if (branch) args.push(branch);
  return git(args);
}

/**
 * Pull from remote
 */
async function pull(remote = 'origin', branch = '') {
  const args = ['pull', remote];
  if (branch) args.push(branch);
  return git(args);
}

/**
 * Checkout branch
 */
async function checkout(branch) {
  return git(['checkout', branch]);
}

/**
 * Create new branch
 */
async function createBranch(name, startPoint = '') {
  const args = ['checkout', '-b', name];
  if (startPoint) args.push(startPoint);
  return git(args);
}

/**
 * Delete branch
 */
async function deleteBranch(name, force = false) {
  return git(['branch', force ? '-D' : '-d', name]);
}

/**
 * Merge branch into current
 */
async function merge(branch) {
  return git(['merge', branch]);
}

/**
 * Discard changes to a file (checkout from HEAD)
 */
async function discardFile(file) {
  return git(['checkout', '--', file]);
}

/**
 * Get the repo name from the remote URL or folder name
 */
async function getRepoName() {
  try {
    const output = await git(['remote', 'get-url', 'origin']);
    const url = output.trim();
    const match = url.match(/\/([^/]+?)(?:\.git)?$/);
    if (match) return match[1];
  } catch {
    // No remote — use folder name
  }
  return path.basename(repoPath);
}

/**
 * Check if directory is a git repo
 */
async function isGitRepo() {
  try {
    await git(['rev-parse', '--is-inside-work-tree']);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  setRepoPath,
  getRepoPath,
  getStatus,
  getLog,
  getDiff,
  getUntrackedDiff,
  getBranches,
  stage,
  unstage,
  stageAll,
  unstageAll,
  commit,
  push,
  pull,
  checkout,
  createBranch,
  deleteBranch,
  merge,
  discardFile,
  getRepoName,
  isGitRepo
};
