/**
 * GloriGit — Author Impact Heatmap
 */
import { dom } from '../core/dom.js';
import { escapeHtml } from '../core/utils.js';
import { send } from '../core/ws.js';

export async function loadHeatmap() {
  dom.heatmapModalOverlay.classList.add('active');
  dom.heatmapContainer.innerHTML = '<div style="color: var(--text-muted); text-align: center;">Loading stats...</div>';
  
  try {
    const stats = await send('author-stats', { days: 90 });
    renderHeatmap(stats);
  } catch (err) {
    dom.heatmapContainer.innerHTML = `<div style="color: var(--red);">Failed to load heatmap: ${err.message}</div>`;
  }
}

function renderHeatmap(stats) {
  dom.heatmapContainer.innerHTML = '';
  
  const dates = Object.keys(stats).sort();
  
  if (dates.length === 0) {
    dom.heatmapContainer.innerHTML = '<div style="color: var(--text-muted); text-align: center;">No activity in the last 90 days.</div>';
    return;
  }
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);
  
  // Group stats by author
  const authors = {};
  Object.entries(stats).forEach(([dateStr, dateStats]) => {
    Object.entries(dateStats).forEach(([author, count]) => {
      if (!authors[author]) authors[author] = { total: 0, days: {} };
      authors[author].days[dateStr] = count;
      authors[author].total += count;
    });
  });
  
  // Sort authors by total commits descending
  const sortedAuthors = Object.entries(authors).sort((a, b) => b[1].total - a[1].total);
  
  sortedAuthors.forEach(([author, data]) => {
    const authorBlock = document.createElement('div');
    authorBlock.innerHTML = `
      <div class="heatmap-author-label">
        <span>${escapeHtml(author)}</span>
        <span class="heatmap-total-badge">${data.total} commits</span>
      </div>
      <div class="heatmap-scroll-container">
        <div class="heatmap-grid" id="grid-${author.replace(/[^a-z0-9]/gi, '')}"></div>
      </div>
    `;
    dom.heatmapContainer.appendChild(authorBlock);
    
    const grid = authorBlock.querySelector('.heatmap-grid');
    
    let current = new Date(startDate);
    current.setDate(current.getDate() - current.getDay()); 
    
    const today = new Date();
    
    while (current <= today) {
      const dateStr = current.toISOString().split('T')[0];
      const count = data.days[dateStr] || 0;
      
      let level = 0;
      if (count > 0) level = 1;
      if (count >= 5) level = 2;
      if (count >= 10) level = 3;
      if (count >= 20) level = 4;
      
      const cell = document.createElement('div');
      cell.className = `heatmap-cell ${level ? 'level-' + level : ''}`;
      cell.title = `${count} commits on ${dateStr}`;
      grid.appendChild(cell);
      
      current.setDate(current.getDate() + 1);
    }
  });
}
