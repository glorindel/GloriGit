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
    } else if (line.startsWith('1 ')) {
      // Ordinary changed entry: "1 XY sub mH mI mW hH hI path"
      // All space-separated, path is field index 8+
      const fields = line.split(' ');
      const xy = fields[1];
      const filePath = fields.slice(8).join(' '); // handles paths with spaces

      const stagedStatus = xy[0];
      const unstagedStatus = xy[1];

      if (stagedStatus !== '.') {
        result.staged.push({ file: filePath, status: stagedStatus });
      }
      if (unstagedStatus !== '.') {
        result.unstaged.push({ file: filePath, status: unstagedStatus });
      }
    } else if (line.startsWith('2 ')) {
      // Renamed/copied entry: "2 XY sub mH mI mW hH hI Xscore path\torigPath"
      // Tab separates new path from original path
      const tabParts = line.split('\t');
      const fields = tabParts[0].split(' ');
      const xy = fields[1];
      const filePath = fields.slice(9).join(' '); // new path

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
async function getLog(count = 50, skip = 0, filters = {}) {
  const format = '--format={"hash":"%H","shortHash":"%h","author":"%an","email":"%ae","date":"%aI","message":"%s","refs":"%D","parents":"%P"}';
  const args = [
    'log', format,
    '--all',
    `--max-count=${count}`,
    `--skip=${skip}`
  ];

  // Optional filters
  if (filters.branch) {
    // Remove --all and target specific branch
    const allIdx = args.indexOf('--all');
    if (allIdx !== -1) args.splice(allIdx, 1);
    args.push(filters.branch);
  }
  if (filters.author) {
    args.push('-i', `--author=${filters.author}`);
  }
  if (filters.message) {
    args.push('-i', `--grep=${filters.message}`);
  }
  if (filters.since) {
    args.push(`--since=${filters.since}`);
  }
  if (filters.until) {
    args.push(`--until=${filters.until}`);
  }

  const output = await git(args);

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
      entry.parents = entry.parents ? entry.parents.split(' ').filter(Boolean) : [];
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
        const parentsMatch = line.match(/"parents":"([^"]*)"/);

        return {
          hash: hashMatch ? hashMatch[1] : '',
          shortHash: shortMatch ? shortMatch[1] : '',
          author: authorMatch ? authorMatch[1] : '',
          email: emailMatch ? emailMatch[1] : '',
          date: dateMatch ? dateMatch[1] : '',
          message: messageMatch ? messageMatch[1] : '(parse error)',
          refs: refsMatch && refsMatch[1] ? refsMatch[1].split(', ').filter(Boolean) : [],
          parents: parentsMatch && parentsMatch[1] ? parentsMatch[1].split(' ').filter(Boolean) : []
        };
      } catch {
        return {
          hash: '', shortHash: '', author: '', email: '',
          date: '', message: '(parse error)', refs: [], parents: []
        };
      }
    }
  });
}

/**
 * Get commit log for a specific file (Timemachine)
 */
async function getFileHistory(file, count = 50, skip = 0) {
  const format = '--format={"hash":"%H","shortHash":"%h","author":"%an","email":"%ae","date":"%aI","message":"%s","refs":"%D","parents":"%P"}';
  const output = await git([
    'log', '--follow', format,
    `--max-count=${count}`,
    `--skip=${skip}`,
    '--', file
  ]);

  const lines = output.trim().split('\n').filter(Boolean);
  return lines.map(line => {
    // Escape problematic characters in JSON
    const sanitized = line
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\\"{/g, '{"')
      .replace(/}\\"/g, '"}')
      .replace(/\\":/g, '":')
      .replace(/,\\"/g, ',"')
      .replace(/:\\"([^"]*)\\"/g, ':"$1"');

    try {
      const entry = JSON.parse(line);
      entry.refs = entry.refs ? entry.refs.split(', ').filter(Boolean) : [];
      entry.parents = entry.parents ? entry.parents.split(' ').filter(Boolean) : [];
      return entry;
    } catch {
      try {
        const hashMatch = line.match(/"hash":"([^"]+)"/);
        const shortMatch = line.match(/"shortHash":"([^"]+)"/);
        const authorMatch = line.match(/"author":"([^"]+)"/);
        const dateMatch = line.match(/"date":"([^"]+)"/);
        const messageMatch = line.match(/"message":"(.+?)","refs"/);

        return {
          hash: hashMatch ? hashMatch[1] : '',
          shortHash: shortMatch ? shortMatch[1] : '',
          author: authorMatch ? authorMatch[1] : '',
          date: dateMatch ? dateMatch[1] : '',
          message: messageMatch ? messageMatch[1] : '(parse error)',
          refs: [],
          parents: []
        };
      } catch {
        return {
          hash: '', shortHash: '', author: '', date: '', message: '(parse error)', refs: [], parents: []
        };
      }
    }
  });
}

/**
 * Get author commit stats for heatmap (last N days)
 */
async function getAuthorStats(days = 90) {
  try {
    const output = await git(['log', `--since="${days} days ago"`, '--format=%aI|%an']);
    const stats = {};
    const lines = output.trim().split('\n').filter(Boolean);
    
    lines.forEach(line => {
      const parts = line.split('|');
      if (parts.length < 2) return;
      
      const dateStr = parts[0];
      const author = parts[1];
      
      const date = dateStr.split('T')[0];
      
      if (!stats[date]) stats[date] = {};
      if (!stats[date][author]) stats[date][author] = 0;
      stats[date][author]++;
    });
    
    return stats;
  } catch (err) {
    return {};
  }
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
 * Get files modified in a specific commit
 */
async function getCommitFiles(hash) {
  // Use --name-status to get A/M/D/R status and file paths for a commit
  // The --oneline --format="" ensures we don't get the commit message itself, just the files
  const output = await git(['show', '--name-status', '--format=', hash]);
  const lines = output.trim().split('\n').filter(Boolean);
  
  return lines.map(line => {
    // Format is like "M\tpath/to/file" or "R100\told/path\tnew/path"
    const parts = line.split('\t');
    const statusCode = parts[0][0]; // First letter (M, A, D, R, etc)
    
    // Handle renames (R status has 3 parts)
    const file = parts.length === 3 ? parts[2] : parts[1];
    
    return {
      status: statusCode,
      file: file
    };
  });
}

/**
 * Get diff for a specific file in a specific commit
 */
async function getCommitFileDiff(hash, file) {
  try {
    // git show hash:file will show full file content if we wanted it
    // But we want the diff that happened IN that commit:
    const output = await git(['show', hash, '--', file]);
    return parseDiff(output, file);
  } catch (err) {
    return { file, hunks: [], error: err.message };
  }
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
  const output = await git(['branch', '-a', '--format=%(refname:short)|%(HEAD)']);
  const lines = output.trim().split('\n').filter(Boolean);

  const result = { current: '', local: [], remote: [] };

  for (const line of lines) {
    const [name, headIndicator] = line.trim().split('|');
    const isCurrent = headIndicator === '*';

    // Skip special git entries like "(HEAD detached at ...)"
    if (name.startsWith('(')) {
      if (isCurrent) result.current = ''; // Represent as detached
      continue;
    }

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
 * Stage all modified/deleted files (tracked only)
 */
async function stageAll() {
  return git(['add', '-u']);
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
 * Discard changes to a tracked file (checkout from HEAD)
 */
async function discardFile(file) {
  return git(['checkout', '--', file]);
}

/**
 * Delete an untracked file
 */
async function deleteUntrackedFile(file) {
  const fs = require('fs');
  const fullPath = path.join(repoPath, file);
  return new Promise((resolve, reject) => {
    fs.unlink(fullPath, (err) => {
      if (err) reject({ message: `Failed to delete ${file}: ${err.message}` });
      else resolve();
    });
  });
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

/**
 * Get stashes
 */
async function getStashes() {
  const format = '--format={"index":"%gd","hash":"%H","shortHash":"%h","date":"%aI","message":"%s"}';
  try {
    const output = await git(['stash', 'list', format]);
    const lines = output.trim().split('\n').filter(Boolean);
    return lines.map(line => {
      // Escape problematic characters in JSON
      const sanitized = line
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\\"{/g, '{"')
        .replace(/}\\"/g, '"}')
        .replace(/\\":/g, '":')
        .replace(/,\\"/g, ',"')
        .replace(/:\\"([^"]*)\\"/g, ':"$1"');

      try {
        const entry = JSON.parse(sanitized);
        const indexMatch = entry.index.match(/stash@{(\d+)}/);
        if (indexMatch) {
          entry.id = parseInt(indexMatch[1], 10);
        } else {
          entry.id = -1;
        }
        return entry;
      } catch {
        try {
          const indexMatch = line.match(/"index":"([^"]+)"/);
          const hashMatch = line.match(/"hash":"([^"]+)"/);
          const shortMatch = line.match(/"shortHash":"([^"]+)"/);
          const dateMatch = line.match(/"date":"([^"]+)"/);
          const messageMatch = line.match(/"message":"(.+?)"}$/);

          const entry = {
            index: indexMatch ? indexMatch[1] : '',
            hash: hashMatch ? hashMatch[1] : '',
            shortHash: shortMatch ? shortMatch[1] : '',
            date: dateMatch ? dateMatch[1] : '',
            message: messageMatch ? messageMatch[1] : '(parse error)'
          };
          const idMatch = entry.index.match(/stash@{(\d+)}/);
          entry.id = idMatch ? parseInt(idMatch[1], 10) : -1;
          return entry;
        } catch {
          return null;
        }
      }
    }).filter(Boolean);
  } catch (err) {
    return [];
  }
}

/**
 * Get files in a stash
 */
async function getStashFiles(index) {
  // `git stash show --name-status stash@{X}`
  try {
    const output = await git(['stash', 'show', '--name-status', `stash@{${index}}`]);
    const files = [];
    const lines = output.trim().split('\n').filter(Boolean);
    for (const line of lines) {
      if (line.includes('\t')) {
        const [status, file] = line.split('\t');
        files.push({ file, status: status[0] });
      } else {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          files.push({ file: parts.slice(1).join(' '), status: parts[0][0] });
        }
      }
    }
    return files;
  } catch (err) {
    return [];
  }
}

/**
 * Get diff for a file in a stash
 */
async function getStashDiff(index, file) {
  try {
    const output = await git(['diff', `stash@{${index}}^..stash@{${index}}`, '--', file]);
    return parseDiff(output, file);
  } catch (err) {
    return { file, hunks: [] };
  }
}

/**
 * Save stash
 */
async function stashSave(message, options = {}) {
  const args = ['stash', 'push'];
  
  if (options.untracked) {
    args.push('--include-untracked');
  } else if (options.staged && !options.unstaged) {
    args.push('--staged');
  } else if (!options.staged && options.unstaged) {
    args.push('--keep-index');
  }

  if (message) args.push('-m', message);
  return await git(args);
}

/**
 * Apply stash
 */
async function stashApply(index) {
  return await git(['stash', 'apply', `stash@{${index}}`]);
}

/**
 * Pop stash
 */
async function stashPop(index) {
  return await git(['stash', 'pop', `stash@{${index}}`]);
}

/**
 * Drop stash
 */
async function stashDrop(index) {
  return await git(['stash', 'drop', `stash@{${index}}`]);
}

module.exports = {
  setRepoPath,
  getRepoPath,
  getStatus,
  getLog,
  getFileHistory,
  getAuthorStats,
  getDiff,
  getUntrackedDiff,
  getCommitFiles,
  getCommitFileDiff,
  commit,
  getBranches,
  createBranch,
  checkout,
  deleteBranch,
  push,
  pull,
  getStashes,
  getStashFiles,
  getStashDiff,
  stashSave,
  stashApply,
  stashPop,
  stashDrop,
  stage,
  unstage,
  stageAll,
  unstageAll,
  merge,
  discardFile,
  deleteUntrackedFile,
  getRepoName,
  isGitRepo,
  getCommitFiles,
  getCommitFileDiff,
  getFileHistory,
  getAuthorStats
};
