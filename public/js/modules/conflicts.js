/**
 * GloriGit — Phase 7: Visual Conflict Resolver
 *
 * Detects conflicts, renders a 3-pane (Ours / Theirs) editor
 * directly in the diff panel, and saves resolutions back to disk.
 */
import { send } from '../core/ws.js';
import { escapeHtml } from '../core/utils.js';
import { toast } from '../ui/toast.js';
import { dom } from '../core/dom.js';

// Track per-file resolutions: { [sectionIndex]: 'ours' | 'theirs' | 'both' | null }
let currentFile = null;
let currentRaw = '';
let currentSections = [];
let sectionChoices = [];

/**
 * Show/hide the conflict banner with conflicted file count
 */
export function renderConflictBanner(mergeStatus) {
  const { conflicted = [], merging, rebasing, cherryPicking, mergeBranch, rebaseBranch, rebaseStep, rebaseTotal } = mergeStatus;

  // Update warzone button badge
  const badge = document.getElementById('warzoneBadge');
  const warzoneBtn = document.getElementById('warzoneBtn');
  if (badge && warzoneBtn) {
    const hasIssues = conflicted.length > 0 || merging || rebasing || cherryPicking;
    badge.style.display = hasIssues ? 'block' : 'none';
    warzoneBtn.classList.toggle('has-conflicts', hasIssues);
  }

  // Update rebase status bar
  const bar = dom.rebaseStatusBar;
  if (bar) {
    if (rebasing) {
      const stepText = (rebaseStep != null && rebaseTotal != null)
        ? `${rebaseStep}/${rebaseTotal}`
        : '';
      const label = bar.querySelector('.rebase-status-label');
      const step = bar.querySelector('.rebase-status-step');
      if (label) label.textContent = `⟳ Rebase in progress${rebaseBranch ? ` — ${rebaseBranch}` : ''}`;
      if (step) step.textContent = stepText;
      bar.style.display = 'flex';
    } else {
      bar.style.display = 'none';
    }
  }
}

/**
 * Open the conflict resolver for a specific conflicted file
 * Renders inside #diffContent
 */
export async function openConflictResolver(file) {
  currentFile = file;
  sectionChoices = [];

  // Mark file as active in the conflict list
  document.querySelectorAll('.conflict-file-item').forEach(el => {
    el.classList.toggle('active', el.dataset.file === file);
  });

  // Show loading state in diff panel
  dom.diffFilename.textContent = file;
  dom.diffActions.style.display = 'none';
  dom.diffEmpty.style.display = 'none';

  // Clear and show conflict resolver container
  let resolver = document.getElementById('conflictResolverContainer');
  if (!resolver) {
    resolver = document.createElement('div');
    resolver.id = 'conflictResolverContainer';
    resolver.className = 'conflict-resolver';
    dom.diffContent.appendChild(resolver);
  }
  resolver.style.display = 'flex';
  resolver.innerHTML = `<div style="padding:20px;color:var(--text-muted);">Loading conflicts…</div>`;

  try {
    const data = await send('conflicts', { file });
    currentSections = data.sections || [];
    currentRaw = data.rawContent || '';
    sectionChoices = currentSections.map(() => null);

    renderResolver(resolver, file, data.sections);
  } catch (err) {
    resolver.innerHTML = `<div style="padding:20px;color:var(--red);">Failed to load conflicts: ${err.error || err.message}</div>`;
  }
}

function renderResolver(container, file, sections) {
  if (!sections || sections.length === 0) {
    container.innerHTML = `
      <div class="conflict-no-conflicts">
        <div class="conflict-no-conflicts-icon">✅</div>
        <div>No conflict markers found in this file.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="conflict-resolver-header">
      <span class="conflict-resolver-title">⚔ Conflict Resolver</span>
      <span class="conflict-resolver-file">${escapeHtml(file)}</span>
      <button class="conflict-resolver-save" id="conflictSaveBtn" disabled>
        Save &amp; Stage
      </button>
    </div>
    <div class="conflict-sections" id="conflictSections"></div>
  `;

  const sectionsEl = container.querySelector('#conflictSections');
  sectionsEl.innerHTML = '';

  sections.forEach((section, idx) => {
    const block = document.createElement('div');
    block.className = 'conflict-block';
    block.dataset.idx = idx;

    const oursLines = section.ours.join('\n');
    const theirsLines = section.theirs.join('\n');
    const oursLabel = section.oursLabel || 'HEAD (Ours)';
    const theirsLabel = section.theirsLabel || 'Theirs';

    block.innerHTML = `
      <div class="conflict-block-header">
        <span class="conflict-block-num">Conflict ${idx + 1} of ${sections.length}</span>
        <span class="conflict-block-status unresolved" id="conflict-status-${idx}">Unresolved</span>
        <div class="conflict-block-actions">
          <button class="conflict-resolve-btn ours" data-idx="${idx}" data-choice="ours" title="Use Ours (HEAD)">Use Ours</button>
          <button class="conflict-resolve-btn theirs" data-idx="${idx}" data-choice="theirs" title="Use Theirs">Use Theirs</button>
          <button class="conflict-resolve-btn both" data-idx="${idx}" data-choice="both" title="Keep Both">Keep Both</button>
        </div>
      </div>
      <div class="conflict-panes">
        <div class="conflict-pane ours-pane">
          <span class="conflict-pane-label">${escapeHtml(oursLabel)}</span>
          ${oursLines.trim()
            ? `<pre style="margin:0;font-size:11px;white-space:pre-wrap;word-break:break-all;">${escapeHtml(oursLines)}</pre>`
            : `<span class="conflict-pane-empty">(deleted)</span>`}
        </div>
        <div class="conflict-pane theirs-pane">
          <span class="conflict-pane-label">${escapeHtml(theirsLabel)}</span>
          ${theirsLines.trim()
            ? `<pre style="margin:0;font-size:11px;white-space:pre-wrap;word-break:break-all;">${escapeHtml(theirsLines)}</pre>`
            : `<span class="conflict-pane-empty">(deleted)</span>`}
        </div>
      </div>
      <div class="conflict-resolved-preview" id="conflict-preview-${idx}" style="display:none;"></div>
    `;

    sectionsEl.appendChild(block);

    // Bind resolve buttons
    block.querySelectorAll('.conflict-resolve-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const choice = btn.dataset.choice;
        sectionChoices[idx] = choice;
        markSectionResolved(block, idx, choice, section);
        checkAllResolved(container);
      });
    });
  });

  // Bind save button
  const saveBtn = container.querySelector('#conflictSaveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => saveResolution(saveBtn));
  }
}

function markSectionResolved(block, idx, choice, section) {
  const status = block.querySelector(`#conflict-status-${idx}`);
  if (status) {
    status.className = 'conflict-block-status resolved-badge';
    const labels = { ours: '✓ Using Ours', theirs: '✓ Using Theirs', both: '✓ Keeping Both' };
    status.textContent = labels[choice] || '✓ Resolved';
  }
  block.classList.add('resolved');

  // Show preview
  const preview = block.querySelector(`#conflict-preview-${idx}`);
  if (preview) {
    const chosenContent = choice === 'ours'
      ? section.ours.join('\n')
      : choice === 'theirs'
      ? section.theirs.join('\n')
      : section.ours.join('\n') + '\n' + section.theirs.join('\n');

    preview.style.display = 'flex';
    preview.innerHTML = `<span style="margin-right:8px;flex-shrink:0;">✅</span><pre style="margin:0;font-size:11px;white-space:pre-wrap;word-break:break-all;flex:1;">${escapeHtml(chosenContent || '(empty)')}</pre>`;
  }
}

function checkAllResolved(container) {
  const allResolved = sectionChoices.every(c => c !== null);
  const saveBtn = container.querySelector('#conflictSaveBtn');
  if (saveBtn) {
    saveBtn.disabled = !allResolved;
  }
  // Update file item checkmark
  const fileItem = document.querySelector(`.conflict-file-item[data-file="${CSS.escape(currentFile)}"]`);
  if (fileItem) {
    let check = fileItem.querySelector('.conflict-file-resolved-check');
    if (allResolved && !check) {
      check = document.createElement('span');
      check.className = 'conflict-file-resolved-check';
      check.textContent = '✓';
      fileItem.appendChild(check);
    }
  }
}

async function saveResolution(saveBtn) {
  if (!currentFile || sectionChoices.some(c => c === null)) return;
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  // Build resolved content by replacing conflict blocks in raw text
  const resolvedContent = buildResolvedContent();

  try {
    await send('resolve-conflict', { file: currentFile, content: resolvedContent });
    toast(`Resolved: ${currentFile}`, 'success');

    // Remove the file from the conflict list
    const fileItem = document.querySelector(`.conflict-file-item[data-file="${CSS.escape(currentFile)}"]`);
    if (fileItem) {
      fileItem.style.opacity = '0.4';
      fileItem.style.pointerEvents = 'none';
    }

    // Clear resolver
    const resolver = document.getElementById('conflictResolverContainer');
    if (resolver) {
      resolver.innerHTML = `
        <div class="conflict-no-conflicts">
          <div class="conflict-no-conflicts-icon">✅</div>
          <div style="color:var(--green);font-weight:600;">${escapeHtml(currentFile)} resolved and staged!</div>
        </div>
      `;
    }

    currentFile = null;
    sectionChoices = [];
    currentSections = [];
  } catch (err) {
    toast(err.error || 'Failed to save resolution', 'error');
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save & Stage';
  }
}

function buildResolvedContent() {
  // Rebuild the raw content, replacing conflict markers
  const lines = currentRaw.split('\n');
  const resultLines = [];
  let sectionIdx = 0;
  let i = 0;

  while (i < lines.length) {
    if (lines[i].startsWith('<<<<<<<')) {
      const choice = sectionChoices[sectionIdx];
      const section = currentSections[sectionIdx];
      sectionIdx++;

      // Skip to end of conflict block, collecting parts
      let oursLines = [];
      let baseLines = [];
      let theirsLines = [];
      i++; // skip <<<<<<<

      while (i < lines.length && !lines[i].startsWith('=======') && !lines[i].startsWith('|||||||')) {
        oursLines.push(lines[i++]);
      }
      if (i < lines.length && lines[i].startsWith('|||||||')) {
        i++;
        while (i < lines.length && !lines[i].startsWith('=======')) {
          baseLines.push(lines[i++]);
        }
      }
      if (i < lines.length && lines[i].startsWith('=======')) i++;
      while (i < lines.length && !lines[i].startsWith('>>>>>>>')) {
        theirsLines.push(lines[i++]);
      }
      if (i < lines.length) i++; // skip >>>>>>>

      if (choice === 'ours') {
        resultLines.push(...oursLines);
      } else if (choice === 'theirs') {
        resultLines.push(...theirsLines);
      } else { // both
        resultLines.push(...oursLines, ...theirsLines);
      }
    } else {
      resultLines.push(lines[i++]);
    }
  }

  return resultLines.join('\n');
}

/**
 * Hide the conflict resolver, restore diff panel to default
 */
export function closeConflictResolver() {
  const resolver = document.getElementById('conflictResolverContainer');
  if (resolver) resolver.style.display = 'none';
  currentFile = null;
  sectionChoices = [];
  currentSections = [];
}
