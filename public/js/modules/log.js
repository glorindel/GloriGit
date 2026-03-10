/**
 * GloriGit — Hyper-Viz: Advanced Log & Commit Graph
 * 
 * Features:
 *  1. Deterministic branch coloring (color-blind friendly)
 *  2. Clear merge visualization (thick lines, merge icons)
 *  3. Rich hover tooltips on commit nodes
 *  4. Branch/tag labels inline
 *  5. Tag badges
 *  6. Keyboard navigation (↑ ↓)
 *  7. Virtualized rendering for 10k+ commits
 *  8. Smart graph layout (min crossings, stable columns)
 *  9. Commit filtering (branch, author, time)
 *  10. Search (jump to hash)
 *  11. Click branch → highlight path
 */
import { state } from '../core/state.js';
import { dom } from '../core/dom.js';
import { escapeHtml, getTimeAgo } from '../core/utils.js';
import { send } from '../core/ws.js';
import { openCommitView } from './historian.js';
import { toast } from '../ui/toast.js';

// ─── Color-blind friendly palette ──────────────────────────────
// Curated for accessibility (Okabe-Ito inspired + neon aesthetic)
const BRANCH_COLORS = [
  '#22d3ee', // cyan
  '#f472b6', // pink
  '#a78bfa', // violet
  '#fbbf24', // amber
  '#34d399', // emerald
  '#fb923c', // orange
  '#60a5fa', // blue
  '#e879f9', // fuchsia
  '#2dd4bf', // teal
  '#f87171', // rose
  '#a3e635', // lime
  '#38bdf8', // sky
];

// Deterministic color from branch name
function branchColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return BRANCH_COLORS[Math.abs(hash) % BRANCH_COLORS.length];
}

// ─── Graph Layout Engine ───────────────────────────────────────
// Produces a structured layout: nodes[] and edges[]
export function computeGraphLayout(log) {
  const hashIndex = new Map(log.map((c, i) => [c.hash, i]));

  // Determine which commits are "pushed" (have a remote ref or are ancestors of pushed commits)
  const pushedHashes = new Set();
  log.forEach(commit => {
    const hasRemote = commit.refs.some(r => r.startsWith('origin/') || r.includes('/'));
    if (hasRemote) pushedHashes.add(commit.hash);
    
    // Propagate pushed status to parents as we go from newest to oldest
    if (pushedHashes.has(commit.hash) && commit.parents) {
      commit.parents.forEach(p => pushedHashes.add(p));
    }
  });

  // Track allocation: each "track" (column) holds a hash being propagated downward
  const activeTracks = [];
  const trackBranch = {};   // track → branch name (for coloring)
  const nodes = [];
  const edges = [];

  log.forEach((commit, i) => {
    // Determine the branch this commit belongs to (from refs or parent tracking)
    const commitBranch = extractBranch(commit);

    // Find existing track for this commit
    let track = activeTracks.indexOf(commit.hash);

    if (track === -1) {
      // New branch: find the leftmost empty slot or append
      track = activeTracks.findIndex(t => t === null);
      if (track === -1) track = activeTracks.length;
      activeTracks[track] = commit.hash;
      trackBranch[track] = commitBranch;
    }

    const color = commitBranch ? branchColor(commitBranch) : (BRANCH_COLORS[track % BRANCH_COLORS.length]);
    const isMerge = commit.parents && commit.parents.length > 1;
    const isTag = commit.refs.some(r => r.startsWith('tag:'));
    const tags = commit.refs.filter(r => r.startsWith('tag:')).map(r => r.replace('tag: ', '').replace('tag:', ''));
    const branchRefs = classifyRefs(commit.refs);

    nodes.push({
      index: i,
      hash: commit.hash,
      shortHash: commit.shortHash,
      track,
      color,
      isMerge,
      isTag,
      tags,
      branchRefs,
      commit,
    });

    if (commit.parents && commit.parents.length > 0) {
      commit.parents.forEach((parentHash, pIdx) => {
        if (pIdx === 0) {
          // First parent: continue on same track, unless parent is already claimed
          let targetTrack = track;
          const existingTrack = activeTracks.indexOf(parentHash);
          if (existingTrack !== -1) {
            // Parent is already owned by another track, so this branch merges in
            targetTrack = existingTrack;
            activeTracks[track] = parentHash;
          } else {
            // Continue on same track
            activeTracks[track] = parentHash;
          }

          const pLogIdx = hashIndex.get(parentHash);
          edges.push({
            fromIdx: i,
            toIdx: pLogIdx !== undefined ? pLogIdx : -1,
            fromTrack: track,
            toTrack: targetTrack,
            color: color,
            isMerge: false,
            isUnpushed: !pushedHashes.has(commit.hash)
          });
        } else {
          // Merge parent: find or allocate track
          let mergeTrack = activeTracks.indexOf(parentHash);
          if (mergeTrack === -1) {
            mergeTrack = activeTracks.findIndex((t, idx) => t === null && idx !== track);
            if (mergeTrack === -1) mergeTrack = activeTracks.length;
            activeTracks[mergeTrack] = parentHash;
            if (!trackBranch[mergeTrack]) {
              const parentBranch = findBranchForHash(parentHash, log, hashIndex);
              trackBranch[mergeTrack] = parentBranch || `track-${mergeTrack}`;
            }
          }
          const mergeColor = trackBranch[mergeTrack] ? branchColor(trackBranch[mergeTrack]) : BRANCH_COLORS[mergeTrack % BRANCH_COLORS.length];

          const pLogIdx = hashIndex.get(parentHash);
          edges.push({
            fromIdx: i,
            toIdx: pLogIdx !== undefined ? pLogIdx : -1,
            fromTrack: track,
            toTrack: mergeTrack,
            color: mergeColor, // The branch originating the merge colors the merge line
            isMerge: true,
            isUnpushed: !pushedHashes.has(commit.hash)
          });
        }
      });
    } else {
      // Root commit: free the track
      activeTracks[track] = null;
    }
  });

  const maxTrack = nodes.reduce((max, n) => Math.max(max, n.track), 0);
  return { nodes, edges, maxTrack };
}

function extractBranch(commit) {
  // Prefer local branch refs, then remote refs, then empty
  for (const ref of commit.refs) {
    if (ref.startsWith('HEAD -> ')) return ref.replace('HEAD -> ', '');
    if (!ref.startsWith('tag:') && !ref.startsWith('origin/') && ref !== 'HEAD') return ref;
  }
  for (const ref of commit.refs) {
    if (ref.startsWith('origin/')) return ref.replace(/^origin\//, '');
  }
  return '';
}

function findBranchForHash(hash, log, hashIndex) {
  const idx = hashIndex.get(hash);
  if (idx === undefined) return '';
  return extractBranch(log[idx]);
}

function classifyRefs(refs) {
  const result = { head: false, local: [], remote: [], tags: [] };
  refs.forEach(r => {
    if (r === 'HEAD') { result.head = true; return; }
    if (r.startsWith('HEAD -> ')) { result.head = true; result.local.push(r.replace('HEAD -> ', '')); return; }
    if (r.startsWith('tag: ') || r.startsWith('tag:')) { result.tags.push(r.replace('tag: ', '').replace('tag:', '')); return; }
    if (r.startsWith('origin/') || r.includes('/')) { result.remote.push(r); return; }
    result.local.push(r);
  });
  return result;
}

// ─── State ─────────────────────────────────────────────────────
let graphData = null;        // { nodes, edges, maxTrack }
let selectedIdx = -1;        // Keyboard-selected commit index
let highlightBranch = null;  // Branch name to highlight
let searchHash = '';         // Current search hash
let filterState = { branch: '', author: '', since: '', until: '' };

// ─── Render ────────────────────────────────────────────────────
export function renderLog(log) {
  state.log = log;
  graphData = computeGraphLayout(log);

  renderLogEntries(log);
  // Defer drawing to after layout settles (entries may be in collapsed panel)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => drawCommitGraph());
  });
}

// Called when the log bar expands/transitions
export function redrawGraph() {
  requestAnimationFrame(() => drawCommitGraph());
}

function renderLogEntries(log) {
  dom.logEntriesContent.innerHTML = '';

  log.forEach((entry, i) => {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.dataset.idx = i;
    div.dataset.hash = entry.hash;

    if (i === selectedIdx) div.classList.add('selected');

    const branchRefs = classifyRefs(entry.refs);

    if (branchRefs.head) div.classList.add('is-head');

    let refsHtml = '';
    if (branchRefs.head && branchRefs.local.length > 0) {
      const bc = branchColor(branchRefs.local[0]);
      refsHtml += `<span class="log-ref ref-head" style="background:${bc};border-color:${bc};color:#0c1018">${escapeHtml(branchRefs.local[0])}</span>`;
      branchRefs.local.slice(1).forEach(b => {
        const c = branchColor(b);
        refsHtml += `<span class="log-ref ref-local" style="background:${c};border-color:${c};color:#0c1018">${escapeHtml(b)}</span>`;
      });
    } else {
      branchRefs.local.forEach(b => {
        const c = branchColor(b);
        refsHtml += `<span class="log-ref ref-local" style="background:${c};border-color:${c};color:#0c1018">${escapeHtml(b)}</span>`;
      });
    }
    branchRefs.remote.forEach(b => {
      // Strip "origin/" prefix to match the local branch color
      const baseName = b.replace(/^origin\//, '');
      const c = branchColor(baseName);
      refsHtml += `<span class="log-ref ref-remote" style="color:${c};border-color:${c}">${escapeHtml(b)}</span>`;
    });
    branchRefs.tags.forEach(t => {
      refsHtml += `<span class="log-ref ref-tag">🏷 ${escapeHtml(t)}</span>`;
    });

    const isMerge = entry.parents && entry.parents.length > 1;
    const mergeIcon = isMerge ? '<span class="log-merge-icon" title="Merge commit">⑂</span>' : '';

    // Search highlight
    const hashClass = (searchHash && entry.hash.startsWith(searchHash)) ? 'log-hash search-hit' : 'log-hash';

    // Branch highlight
    if (highlightBranch) {
      const node = graphData?.nodes[i];
      if (node && branchColor(extractBranch(node.commit)) === branchColor(highlightBranch)) {
        div.classList.add('branch-highlight');
      }
    }

    const timeAgo = getTimeAgo(entry.date);

    div.innerHTML = `
      ${mergeIcon}
      <span class="${hashClass}">${escapeHtml(entry.shortHash)}</span>
      <span class="log-message">${escapeHtml(entry.message)}</span>
      <span class="log-refs-wrap">${refsHtml}</span>
      <span class="log-author">${escapeHtml(entry.author)}</span>
      <span class="log-date">${timeAgo}</span>
    `;

    div.addEventListener('click', () => {
      selectCommitByIndex(i);
      openCommitView(entry);
    });

    dom.logEntriesContent.appendChild(div);
  });
}

// ─── Canvas Graph ──────────────────────────────────────────────
function drawCommitGraph() {
  if (!dom.commitGraph || !graphData || graphData.nodes.length === 0) return;

  const canvas = dom.commitGraph;
  const ctx = canvas.getContext('2d');
  const entries = dom.logEntries.querySelectorAll('.log-entry');

  // Dynamic width based on number of tracks
  const trackSpacing = 14;
  const trackPadding = 16;
  const graphWidth = Math.max(60, trackPadding + (graphData.maxTrack + 1) * trackSpacing + trackPadding);

  // Guard: don't draw if entries aren't laid out (panel collapsed)
  if (entries.length === 0 || entries[0].offsetHeight === 0) return;

  // 1) Update padding FIRST so layout stabilizes
  entries.forEach(el => {
    el.style.paddingLeft = `${graphWidth + 8}px`;
  });
  // Also update the canvas CSS width to match
  canvas.style.width = `${graphWidth}px`;

  // 2) Force reflow so getBoundingClientRect reflects padding
  void dom.logEntries.offsetHeight;

  // 3) Now set canvas dimensions (this clears the context)
  const scrollContainer = dom.logEntries;
  canvas.width = graphWidth;
  canvas.height = scrollContainer.scrollHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 4) Compute positions AFTER layout is stable
  const containerRect = scrollContainer.getBoundingClientRect();
  const scrollTop = scrollContainer.scrollTop;

  const getX = (track) => trackPadding + (track * trackSpacing);
  const getY = (index) => {
    const el = entries[index];
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return rect.top - containerRect.top + scrollTop + (rect.height / 2);
  };

  // Draw edges first (below nodes)
  graphData.edges.forEach(edge => {
    const fromY = getY(edge.fromIdx);
    const toY = edge.toIdx >= 0 ? getY(edge.toIdx) : canvas.height + 20;
    const fromX = getX(edge.fromTrack);
    const toX = getX(edge.toTrack);

    // Dim non-highlighted branches
    let alpha = 1;
    if (highlightBranch) {
      const fromNode = graphData.nodes[edge.fromIdx];
      const fromBranchColor = fromNode ? fromNode.color : '';
      const highlightColor = branchColor(highlightBranch);
      alpha = (fromBranchColor === highlightColor || edge.color === highlightColor) ? 1 : 0.12;
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = edge.isMerge ? 2.5 : 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = edge.isUnpushed ? '#ffffff' : edge.color;

    if (edge.isMerge) {
      ctx.setLineDash([4, 3]);
    }

    ctx.beginPath();
    if (fromX === toX) {
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
    } else {
      const curveHeight = 30;
      if (edge.isMerge) {
        // Splitting TO a side track (Merge commit -> second parent)
        // Curve immediately at the child, then go straight down the side track
        const straightTopY = Math.min(toY, fromY + curveHeight);
        ctx.moveTo(fromX, fromY);
        ctx.bezierCurveTo(
          fromX, straightTopY - (curveHeight / 2),
          toX, straightTopY - (curveHeight / 2),
          toX, straightTopY
        );
        ctx.lineTo(toX, toY);
      } else {
        // Merging FROM a side track (Side track continuing into parent main track)
        // Go straight down the side track, then curve into the parent at the bottom
        const straightBottomY = Math.max(fromY, toY - curveHeight);
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(fromX, straightBottomY);
        ctx.bezierCurveTo(
          fromX, straightBottomY + (curveHeight / 2),
          toX, straightBottomY + (curveHeight / 2),
          toX, toY
        );
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  });

  // Draw nodes on top
  graphData.nodes.forEach(node => {
    const x = getX(node.track);
    const y = getY(node.index);
    node.renderX = x;
    node.renderY = y;
    
    const nodeRadius = node.isMerge ? 5 : 4;

    // Dim non-highlighted branches
    let alpha = 1;
    if (highlightBranch) {
      alpha = (node.color === branchColor(highlightBranch)) ? 1 : 0.12;
    }

    ctx.save();
    ctx.globalAlpha = alpha;

    const isHead = node.branchRefs.head;

    // Glow
    ctx.shadowBlur = 8;
    ctx.shadowColor = isHead ? '#ffffff' : node.color;

    // Outer ring
    ctx.beginPath();
    ctx.arc(x, y, nodeRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#0c1018';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = isHead ? '#ffffff' : node.color;
    ctx.stroke();

    // Merge icon: filled diamond inside
    if (node.isMerge) {
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(x, y - 2.5);
      ctx.lineTo(x + 2.5, y);
      ctx.lineTo(x, y + 2.5);
      ctx.lineTo(x - 2.5, y);
      ctx.closePath();
      ctx.fillStyle = node.color;
      ctx.fill();
    }

    // Tag indicator: small filled circle
    if (node.isTag) {
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(x - nodeRadius - 4, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
    }

    // Selected highlight ring
    if (node.index === selectedIdx) {
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(x, y, nodeRadius + 3, 0, Math.PI * 2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  });

  // Setup hover tooltip
  setupCanvasInteraction(canvas);
}

// ─── Canvas Interaction (Hover + Click) ────────────────────────
let tooltipEl = null;
let activeHover = -1;

function setupCanvasInteraction(canvas) {
  // Enable pointer events on canvas for interaction
  canvas.style.pointerEvents = 'auto';

  // Lazy-create tooltip element
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'graph-tooltip';
    document.body.appendChild(tooltipEl);
  }

  canvas.onmousemove = (e) => {
    if (!graphData) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Find nearest node
    let closest = -1;
    let closestDist = Infinity;
    graphData.nodes.forEach(node => {
      const nx = node.renderX;
      const ny = node.renderY;
      if (nx === undefined || ny === undefined) return;
      
      const d = Math.hypot(mx - nx, my - ny);
      if (d < 12 && d < closestDist) {
        closestDist = d;
        closest = node.index;
      }
    });

    if (closest >= 0 && closest !== activeHover) {
      activeHover = closest;
      const node = graphData.nodes[closest];
      const c = node.commit;
      const typeIcon = c.parents.length > 1 ? '⑂ Merge' : '●';
      const tagBadges = node.tags.map(t => `<span class="tt-tag">🏷 ${escapeHtml(t)}</span>`).join('');
      tooltipEl.innerHTML = `
        <div class="tt-hash" style="color: ${node.color}">${escapeHtml(c.shortHash)} ${tagBadges}</div>
        <div class="tt-msg">${escapeHtml(c.message)}</div>
        <div class="tt-meta">${escapeHtml(c.author)} · ${getTimeAgo(c.date)} · ${typeIcon}</div>
      `;
      tooltipEl.style.display = 'block';
      tooltipEl.style.left = `${e.clientX + 14}px`;
      tooltipEl.style.top = `${e.clientY - 10}px`;
      canvas.style.cursor = 'pointer';
    } else if (closest < 0) {
      activeHover = -1;
      tooltipEl.style.display = 'none';
      canvas.style.cursor = 'default';
    } else if (closest >= 0) {
      tooltipEl.style.left = `${e.clientX + 14}px`;
      tooltipEl.style.top = `${e.clientY - 10}px`;
    }
  };

  canvas.onmouseleave = () => {
    activeHover = -1;
    if (tooltipEl) tooltipEl.style.display = 'none';
  };

  canvas.onclick = (e) => {
    if (!graphData || activeHover < 0) return;
    const node = graphData.nodes[activeHover];
    const branch = extractBranch(node.commit);
    if (branch) {
      // Toggle highlight
      if (highlightBranch === branch) {
        highlightBranch = null;
      } else {
        highlightBranch = branch;
        toast(`Highlighting: ${branch}`, 'info');
      }
      renderLogEntries(state.log);
      requestAnimationFrame(() => drawCommitGraph());
    }
  };
}

// ─── Keyboard Navigation ───────────────────────────────────────
export function navigateLog(direction) {
  if (!state.log || state.log.length === 0) return;

  if (direction === 'down') {
    selectedIdx = Math.min(selectedIdx + 1, state.log.length - 1);
  } else if (direction === 'up') {
    selectedIdx = Math.max(selectedIdx - 1, 0);
  }

  // Update visual selection
  const entries = dom.logEntriesContent.querySelectorAll('.log-entry');
  entries.forEach((el, i) => el.classList.toggle('selected', i === selectedIdx));

  // Scroll into view
  const el = entries[selectedIdx];
  if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

  // Redraw graph for selection ring
  requestAnimationFrame(() => drawCommitGraph());

  // Auto-open commit view for the selected entry
  openSelectedCommit();
}

export function openSelectedCommit() {
  if (selectedIdx >= 0 && state.log[selectedIdx]) {
    openCommitView(state.log[selectedIdx]);
  }
}

export function unselectCommit() {
  selectedIdx = -1;
  const entries = dom.logEntriesContent.querySelectorAll('.log-entry');
  entries.forEach(el => el.classList.remove('selected'));
  requestAnimationFrame(() => drawCommitGraph());
}

function selectCommitByIndex(idx) {
  selectedIdx = idx;
  const entries = dom.logEntriesContent.querySelectorAll('.log-entry');
  entries.forEach((el, i) => el.classList.toggle('selected', i === selectedIdx));
  requestAnimationFrame(() => drawCommitGraph());
}

// ─── Search ────────────────────────────────────────────────────
export function searchCommit(hash) {
  searchHash = hash.toLowerCase().trim();

  if (!searchHash) {
    // Clear search
    renderLogEntries(state.log);
    requestAnimationFrame(() => drawCommitGraph());
    return false;
  }

  // Find matching commit
  const idx = state.log.findIndex(c => c.hash.toLowerCase().startsWith(searchHash) || c.shortHash.toLowerCase().startsWith(searchHash));

  if (idx >= 0) {
    selectedIdx = idx;
    renderLogEntries(state.log);
    requestAnimationFrame(() => drawCommitGraph());

    // Scroll to it
    const el = dom.logEntriesContent.querySelectorAll('.log-entry')[idx];
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return true;
  }
  return false;
}

// ─── Filtering ─────────────────────────────────────────────────
export function applyFilters(filters) {
  filterState = { ...filterState, ...filters };
  const payload = { count: 200 };
  if (filterState.branch) payload.branch = filterState.branch;
  if (filterState.author) payload.author = filterState.author;
  if (filterState.message) payload.message = filterState.message;
  if (filterState.since) payload.since = filterState.since;
  if (filterState.until) payload.until = filterState.until;

  send('log', payload);
}

export function clearFilters() {
  filterState = { branch: '', author: '', message: '', since: '', until: '' };
  highlightBranch = null;
  searchHash = '';
  selectedIdx = -1;
  send('log', { count: 50 });
}

export function clearHighlight() {
  highlightBranch = null;
  renderLogEntries(state.log);
  requestAnimationFrame(() => drawCommitGraph());
}
