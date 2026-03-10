/**
 * GloriGit — Git Engine Tests
 * 
 * Tests the tools/git.js module against the current repository.
 * Uses Node.js built-in test runner (node --test).
 * 
 * Run: node --test tests/git.test.js
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const git = require('../tools/git.js');

// Point git engine at this repo itself for testing
before(() => {
  git.setRepoPath(path.resolve(__dirname, '..'));
});

describe('Git Engine — Read Operations', () => {

  describe('getStatus()', () => {
    it('should return an object with required fields', async () => {
      const status = await git.getStatus();
      assert.ok(status, 'status should not be null');
      assert.ok(typeof status.branch === 'string', 'branch should be a string');
      assert.ok(Array.isArray(status.staged), 'staged should be an array');
      assert.ok(Array.isArray(status.unstaged), 'unstaged should be an array');
      assert.ok(Array.isArray(status.untracked), 'untracked should be an array');
      assert.ok(typeof status.ahead === 'number', 'ahead should be a number');
      assert.ok(typeof status.behind === 'number', 'behind should be a number');
    });

    it('staged items should have file and status properties', async () => {
      const status = await git.getStatus();
      status.staged.forEach(item => {
        assert.ok(typeof item.file === 'string', 'staged item should have file');
        assert.ok(typeof item.status === 'string', 'staged item should have status');
      });
    });

    it('unstaged items should have file and status properties', async () => {
      const status = await git.getStatus();
      status.unstaged.forEach(item => {
        assert.ok(typeof item.file === 'string', 'unstaged item should have file');
        assert.ok(typeof item.status === 'string', 'unstaged item should have status');
      });
    });
  });

  describe('getLog()', () => {
    it('should return an array of commit objects', async () => {
      const log = await git.getLog(10);
      assert.ok(Array.isArray(log), 'log should be an array');
      assert.ok(log.length > 0, 'log should have at least one commit');
    });

    it('each commit should have required fields', async () => {
      const log = await git.getLog(5);
      log.forEach(commit => {
        assert.ok(typeof commit.hash === 'string', 'commit should have hash');
        assert.ok(typeof commit.shortHash === 'string', 'commit should have shortHash');
        assert.ok(typeof commit.author === 'string', 'commit should have author');
        assert.ok(typeof commit.date === 'string', 'commit should have date');
        assert.ok(typeof commit.message === 'string', 'commit should have message');
        assert.ok(Array.isArray(commit.refs), 'commit should have refs array');
        assert.ok(Array.isArray(commit.parents), 'commit should have parents array');
      });
    });

    it('should respect count parameter', async () => {
      const log3 = await git.getLog(3);
      const log10 = await git.getLog(10);
      assert.ok(log3.length <= 3, 'log(3) should return at most 3 items');
      assert.ok(log10.length <= 10, 'log(10) should return at most 10 items');
      assert.ok(log10.length >= log3.length, 'log(10) should return >= log(3) items');
    });

    it('hash should be 40 characters', async () => {
      const log = await git.getLog(1);
      assert.equal(log[0].hash.length, 40, 'full hash should be 40 chars');
      assert.ok(log[0].shortHash.length <= 12, 'short hash should be <= 12 chars');
    });
  });

  describe('getBranches()', () => {
    it('should return current branch and lists', async () => {
      const branches = await git.getBranches();
      assert.ok(typeof branches.current === 'string', 'should have current branch');
      assert.ok(Array.isArray(branches.local), 'should have local array');
      assert.ok(Array.isArray(branches.remote), 'should have remote array');
      assert.ok(branches.local.length > 0, 'should have at least one local branch');
    });

    it('current branch should be in local list (if not detached)', async () => {
      const branches = await git.getBranches();
      if (branches.current) {
        assert.ok(
          branches.local.includes(branches.current),
          'current branch should appear in local branches'
        );
      } else {
        // Detached HEAD — should have at least one local branch anyway
        assert.ok(branches.local.length > 0, 'should have local branches even if detached');
      }
    });
  });

  describe('getCommitFiles()', () => {
    it('should return files for a known commit', async () => {
      const log = await git.getLog(1);
      const hash = log[0].hash;
      const files = await git.getCommitFiles(hash);
      assert.ok(Array.isArray(files), 'should return array');
      files.forEach(f => {
        assert.ok(typeof f.file === 'string', 'file item should have file');
        assert.ok(typeof f.status === 'string', 'file item should have status');
      });
    });
  });

  describe('getCommitFileDiff()', () => {
    it('should return diff data for a file in a commit', async () => {
      const log = await git.getLog(1);
      const hash = log[0].hash;
      const files = await git.getCommitFiles(hash);
      
      if (files.length > 0) {
        const diff = await git.getCommitFileDiff(hash, files[0].file);
        assert.ok(diff, 'diff should not be null');
        assert.ok(typeof diff.file === 'string', 'diff should have file');
        assert.ok(Array.isArray(diff.hunks), 'diff should have hunks array');
      }
    });
  });

  describe('getFileHistory()', () => {
    it('should return commit history for a known file', async () => {
      // Use server.js as a file that definitely exists in history
      const history = await git.getFileHistory('server.js', 5);
      assert.ok(Array.isArray(history), 'should return array');
      assert.ok(history.length > 0, 'server.js should have at least 1 commit');
      
      history.forEach(entry => {
        assert.ok(typeof entry.hash === 'string', 'entry should have hash');
        assert.ok(typeof entry.shortHash === 'string', 'entry should have shortHash');
        assert.ok(typeof entry.message === 'string', 'entry should have message');
      });
    });
  });

  describe('getAuthorStats()', () => {
    it('should return an object keyed by date', async () => {
      const stats = await git.getAuthorStats(365);
      assert.ok(typeof stats === 'object', 'should return an object');
      
      // If there are entries, validate structure
      const dates = Object.keys(stats);
      if (dates.length > 0) {
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        assert.ok(datePattern.test(dates[0]), 'keys should be YYYY-MM-DD format');
        
        const firstDateStats = stats[dates[0]];
        assert.ok(typeof firstDateStats === 'object', 'value should be object');
        
        const authors = Object.keys(firstDateStats);
        if (authors.length > 0) {
          assert.ok(typeof firstDateStats[authors[0]] === 'number', 'commit count should be a number');
        }
      }
    });
  });

  describe('getRepoName()', () => {
    it('should return a string', async () => {
      const name = await git.getRepoName();
      assert.ok(typeof name === 'string', 'name should be a string');
      assert.ok(name.length > 0, 'name should not be empty');
    });
  });

  describe('isGitRepo()', () => {
    it('should return true for this repo', async () => {
      const result = await git.isGitRepo();
      assert.equal(result, true, 'this directory should be a git repo');
    });
  });

  describe('getDiff()', () => {
    it('should return structured diff data', async () => {
      const status = await git.getStatus();
      
      // Test with an unstaged file if available
      if (status.unstaged.length > 0) {
        const diff = await git.getDiff(status.unstaged[0].file);
        assert.ok(diff, 'diff should not be null');
        assert.ok(typeof diff.file === 'string', 'diff should have file');
        assert.ok(Array.isArray(diff.hunks), 'diff should have hunks array');
        
        diff.hunks.forEach(hunk => {
          assert.ok(typeof hunk.header === 'string', 'hunk should have header');
          assert.ok(Array.isArray(hunk.lines), 'hunk should have lines array');
        });
      }
    });
  });
});
