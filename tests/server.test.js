/**
 * GloriGit — Server Tests
 * 
 * Tests HTTP endpoints and WebSocket actions.
 * Uses Node.js built-in test runner (node --test).
 * 
 * Run: node --test tests/server.test.js
 * 
 * NOTE: Requires the server to NOT be running on port 3847.
 * This test starts its own server instance.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { WebSocket } = require('ws');

const SERVER_PORT = 3899; // Different port to avoid conflicts
let serverProcess;

// Helper: make HTTP request
function httpGet(path) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${SERVER_PORT}${path}`, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// Helper: send WebSocket message and get response
function wsSend(ws, action, payload = {}) {
  return new Promise((resolve, reject) => {
    const id = Date.now() + Math.random();
    
    const handler = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) {
        ws.removeListener('message', handler);
        if (msg.error) {
          reject(msg);
        } else {
          resolve(msg);
        }
      }
    };
    
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, action, payload }));
    
    setTimeout(() => {
      ws.removeListener('message', handler);
      reject(new Error(`WS timeout for action: ${action}`));
    }, 10000);
  });
}

// Start server for testing
before(async () => {
  // Dynamically start the server on a different port
  const { spawn } = require('child_process');
  const path = require('path');
  
  serverProcess = spawn('node', ['-e', `
    process.env.PORT = ${SERVER_PORT};
    process.env.GLORIGIT_NO_OPEN = '1';
    
    // Patch the server to use our port
    const path = require('path');
    const serverPath = path.resolve('${path.resolve(__dirname, '..').replace(/\\/g, '\\\\')}');
    process.chdir(serverPath);
    
    // Override the start function behavior
    const http = require('http');
    const fs = require('fs');
    const { WebSocketServer } = require('ws');
    const gitEngine = require('./tools/git.js');
    
    gitEngine.setRepoPath(serverPath);
    
    const MIME = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
    };
    
    const server = http.createServer((req, res) => {
      if (req.url === '/api/repo-name') {
        gitEngine.getRepoName().then(name => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ name, path: gitEngine.getRepoPath() }));
        });
        return;
      }
      
      let filePath = req.url === '/' ? '/index.html' : req.url;
      const fullPath = path.join(serverPath, 'public', filePath);
      const ext = path.extname(fullPath);
      
      fs.readFile(fullPath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    
    const wss = new WebSocketServer({ server });
    
    wss.on('connection', (ws) => {
      ws.on('message', async (data) => {
        let msg;
        try { msg = JSON.parse(data.toString()); } catch { return; }
        const { action, payload } = msg;
        const id = msg.id;
        
        try {
          let result;
          switch (action) {
            case 'status': result = await gitEngine.getStatus(); break;
            case 'branches': result = await gitEngine.getBranches(); break;
            case 'log': result = await gitEngine.getLog(payload?.count || 50); break;
            case 'diff': result = await gitEngine.getDiff(payload.file, payload.staged); break;
            case 'commit-files': result = await gitEngine.getCommitFiles(payload.hash); break;
            case 'file-history': result = await gitEngine.getFileHistory(payload.file); break;
            case 'author-stats': result = await gitEngine.getAuthorStats(payload.days || 90); break;
            default:
              ws.send(JSON.stringify({ id, error: 'Unknown action: ' + action }));
              return;
          }
          ws.send(JSON.stringify({ id, action, data: result }));
        } catch (err) {
          ws.send(JSON.stringify({ id, action, error: err.message }));
        }
      });
    });
    
    server.listen(${SERVER_PORT}, '127.0.0.1', () => {
      console.log('TEST_SERVER_READY');
    });
  `], { 
    cwd: path.resolve(__dirname, '..'),
    stdio: ['pipe', 'pipe', 'pipe'] 
  });
  
  // Wait for server to be ready
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server start timeout')), 10000);
    serverProcess.stdout.on('data', (data) => {
      if (data.toString().includes('TEST_SERVER_READY')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    serverProcess.stderr.on('data', (data) => {
      // Ignore stderr noise
    });
    serverProcess.on('error', reject);
  });
});

after(() => {
  if (serverProcess) {
    serverProcess.kill();
  }
});

describe('HTTP Server', () => {
  
  it('GET / should serve index.html with 200', async () => {
    const res = await httpGet('/');
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('GloriGit'), 'should contain GloriGit in HTML');
    assert.ok(res.headers['content-type'].includes('text/html'), 'should be HTML');
  });
  
  it('GET /api/repo-name should return JSON with name and path', async () => {
    const res = await httpGet('/api/repo-name');
    assert.equal(res.status, 200);
    const data = JSON.parse(res.body);
    assert.ok(typeof data.name === 'string', 'should have name');
    assert.ok(typeof data.path === 'string', 'should have path');
  });
  
  it('GET /css/base.css should return CSS', async () => {
    const res = await httpGet('/css/base.css');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('text/css'), 'should be CSS');
  });
  
  it('GET /js/app.js should return JavaScript', async () => {
    const res = await httpGet('/js/app.js');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('javascript'), 'should be JS');
  });
  
  it('GET /nonexistent should return 404', async () => {
    const res = await httpGet('/nonexistent');
    assert.equal(res.status, 404);
  });
});

describe('WebSocket Server', () => {
  let ws;
  
  before(async () => {
    ws = new WebSocket(`ws://127.0.0.1:${SERVER_PORT}`);
    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
      setTimeout(() => reject(new Error('WS connect timeout')), 5000);
    });
  });
  
  after(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });
  
  it('action: status → should return valid status', async () => {
    const msg = await wsSend(ws, 'status');
    assert.equal(msg.action, 'status');
    assert.ok(msg.data, 'should have data');
    assert.ok(typeof msg.data.branch === 'string');
    assert.ok(Array.isArray(msg.data.staged));
    assert.ok(Array.isArray(msg.data.unstaged));
    assert.ok(Array.isArray(msg.data.untracked));
  });
  
  it('action: branches → should return valid branches', async () => {
    const msg = await wsSend(ws, 'branches');
    assert.equal(msg.action, 'branches');
    assert.ok(msg.data, 'should have data');
    assert.ok(typeof msg.data.current === 'string');
    assert.ok(Array.isArray(msg.data.local));
  });
  
  it('action: log → should return array of commits', async () => {
    const msg = await wsSend(ws, 'log', { count: 5 });
    assert.equal(msg.action, 'log');
    assert.ok(Array.isArray(msg.data));
    assert.ok(msg.data.length > 0, 'should have commits');
    assert.ok(msg.data[0].hash, 'first commit should have hash');
  });
  
  it('action: commit-files → should return files for a commit', async () => {
    // First get a commit hash
    const logMsg = await wsSend(ws, 'log', { count: 1 });
    const hash = logMsg.data[0].hash;
    
    const msg = await wsSend(ws, 'commit-files', { hash });
    assert.equal(msg.action, 'commit-files');
    assert.ok(Array.isArray(msg.data));
  });
  
  it('action: file-history → should return history for a file', async () => {
    const msg = await wsSend(ws, 'file-history', { file: 'server.js' });
    assert.equal(msg.action, 'file-history');
    assert.ok(Array.isArray(msg.data));
    assert.ok(msg.data.length > 0, 'server.js should have history');
  });
  
  it('action: author-stats → should return stats object', async () => {
    const msg = await wsSend(ws, 'author-stats', { days: 365 });
    assert.equal(msg.action, 'author-stats');
    assert.ok(typeof msg.data === 'object');
  });
  
  it('unknown action → should return error', async () => {
    try {
      await wsSend(ws, 'totally-fake-action');
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err.error, 'should have error message');
      assert.ok(err.error.includes('Unknown'), 'error should mention unknown');
    }
  });
});
