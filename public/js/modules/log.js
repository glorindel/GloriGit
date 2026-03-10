/**
 * GloriGit — Log & Commit Graph Module
 */
import { state } from '../core/state.js';
import { dom } from '../core/dom.js';
import { escapeHtml, getTimeAgo } from '../core/utils.js';
import { openCommitView } from './historian.js';

export function renderLog(log) {
  state.log = log;
  dom.logEntriesContent.innerHTML = '';

  log.forEach(entry => {
    const div = document.createElement('div');
    div.className = 'log-entry';

    const refsHtml = entry.refs.length > 0
      ? `<div class="log-refs">${entry.refs.map(r => `<span class="log-ref">${escapeHtml(r)}</span>`).join('')}</div>`
      : '';

    const timeAgo = getTimeAgo(entry.date);

    div.innerHTML = `
      <span class="log-hash">${escapeHtml(entry.shortHash)}</span>
      <span class="log-message">${escapeHtml(entry.message)}</span>
      ${refsHtml}
      <span class="log-author">${escapeHtml(entry.author)}</span>
      <span class="log-date">${timeAgo}</span>
    `;

    // Make it clickable for inspection
    div.style.cursor = 'pointer';
    div.addEventListener('click', () => openCommitView(entry));

    dom.logEntriesContent.appendChild(div);
  });

  // Draw the visual graph after DOM elements are created
  requestAnimationFrame(() => drawCommitGraph(log));
}

function drawCommitGraph(log) {
  if (!dom.commitGraph || log.length === 0) return;
  
  const canvas = dom.commitGraph;
  const ctx = canvas.getContext('2d');
  const entries = dom.logEntries.querySelectorAll('.log-entry');
  
  // Set exact dimensions
  canvas.width = 60;
  canvas.height = dom.logEntries.scrollHeight;
  
  // Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Aesthetics - Cyberpunk Neon Palette
  const colors = ['#22d3ee', '#f472b6', '#a855f7', '#fbbf24', '#4ade80', '#f87171'];
  
  // Nodes position helpers
  const getX = (track) => 20 + (track * 12);
  const getY = (index) => {
    const el = entries[index];
    return el ? el.offsetTop + (el.offsetHeight / 2) : 0;
  };
  
  // Routing state
  let activeTracks = [];
  const trackColors = {};
  let nextColorIdx = 0;
  
  // Pass 1: Assign commits to tracks and build connections
  const nodes = [];
  const edges = [];
  
  log.forEach((commit, i) => {
    let currentTrack = activeTracks.indexOf(commit.hash);
    
    if (currentTrack === -1) {
      currentTrack = activeTracks.findIndex(t => !t);
      if (currentTrack === -1) currentTrack = activeTracks.length;
      
      trackColors[currentTrack] = colors[nextColorIdx % colors.length];
      nextColorIdx++;
    }
    
    const commitColor = trackColors[currentTrack];
    const y = getY(i);
    const x = getX(currentTrack);
    
    nodes.push({ x, y, color: commitColor, isMerge: commit.parents && commit.parents.length > 1 });
    
    if (commit.parents && commit.parents.length > 0) {
      commit.parents.forEach((parentHash, pIdx) => {
        if (pIdx === 0) {
          activeTracks[currentTrack] = parentHash;
          
          const pLogIdx = log.findIndex(c => c.hash === parentHash);
          if (pLogIdx !== -1) {
             edges.push({
               fromX: x, fromY: y,
               toX: getX(currentTrack), toY: getY(pLogIdx),
               color: commitColor
             });
          } else {
             edges.push({
               fromX: x, fromY: y,
               toX: getX(currentTrack), toY: canvas.height + 20,
               color: commitColor
             });
          }
        } else {
          let mergeTrack = activeTracks.indexOf(parentHash);
          
          if (mergeTrack === -1) {
            mergeTrack = activeTracks.findIndex(t => !t && t !== currentTrack);
            if (mergeTrack === -1) mergeTrack = activeTracks.length;
            activeTracks[mergeTrack] = parentHash;
            
            if (!trackColors[mergeTrack]) {
               trackColors[mergeTrack] = colors[nextColorIdx % colors.length];
               nextColorIdx++;
            }
          }
          
          const pLogIdx = log.findIndex(c => c.hash === parentHash);
          const parentColor = trackColors[mergeTrack];
          
          if (pLogIdx !== -1) {
             edges.push({
               fromX: x, fromY: y,
               toX: getX(mergeTrack), toY: getY(pLogIdx),
               color: parentColor
             });
          } else {
             edges.push({
               fromX: x, fromY: y,
               toX: getX(mergeTrack), toY: canvas.height + 20,
               color: parentColor
             });
          }
        }
      });
    } else {
      activeTracks[currentTrack] = null;
    }
  });
  
  // Draw all edges
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  
  edges.forEach(edge => {
    ctx.beginPath();
    ctx.strokeStyle = edge.color;
    
    if (edge.fromX === edge.toX) {
      ctx.moveTo(edge.fromX, edge.fromY);
      ctx.lineTo(edge.toX, edge.toY);
    } else {
      ctx.moveTo(edge.fromX, edge.fromY);
      ctx.bezierCurveTo(
        edge.fromX, edge.fromY + 15,
        edge.toX, edge.toY - 15,
        edge.toX, edge.toY
      );
    }
    ctx.stroke();
  });
  
  // Draw nodes
  nodes.forEach(node => {
    ctx.shadowBlur = 6;
    ctx.shadowColor = node.color;
    
    ctx.beginPath();
    ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = node.color;
    ctx.stroke();
    
    if (node.isMerge) {
       ctx.beginPath();
       ctx.arc(node.x, node.y, 1.5, 0, Math.PI * 2);
       ctx.fillStyle = node.color;
       ctx.fill();
    }
    
    ctx.shadowBlur = 0;
  });
}
