/* ════════════════════════════════════════════
   TableForge — script.js
   Vanilla JS — no build step — CDN only
════════════════════════════════════════════ */

'use strict';

// ── State ──────────────────────────────────────
const state = {
  columns: [],   // string[]
  rowCount: 0,
};

// ── DOM refs ───────────────────────────────────
const overlay      = document.getElementById('setup-overlay');
const stepCount    = document.getElementById('step-count');
const stepNames    = document.getElementById('step-names');
const colCountEl   = document.getElementById('col-count');
const colNamesWrap = document.getElementById('col-names-wrap');
const app          = document.getElementById('app');
const tableHead    = document.getElementById('table-head');
const tableBody    = document.getElementById('table-body');
const tableMeta    = document.getElementById('table-meta');
const rowCounter   = document.getElementById('row-counter');
const emptyState   = document.getElementById('empty-state');
const toast        = document.getElementById('toast');

// ── Setup: Step 1 — column count ──────────────
document.getElementById('btn-dec').addEventListener('click', () => {
  const v = parseInt(colCountEl.value, 10);
  if (v > 1) colCountEl.value = v - 1;
});
document.getElementById('btn-inc').addEventListener('click', () => {
  const v = parseInt(colCountEl.value, 10);
  if (v < 20) colCountEl.value = v + 1;
});

document.getElementById('btn-next').addEventListener('click', () => {
  const count = Math.min(20, Math.max(1, parseInt(colCountEl.value, 10) || 3));
  colCountEl.value = count;
  buildNameInputs(count);
  stepCount.classList.remove('active');
  stepNames.classList.add('active');
  // Focus first input
  const first = colNamesWrap.querySelector('.col-name-input');
  if (first) first.focus();
});

function buildNameInputs(n) {
  colNamesWrap.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const row = document.createElement('div');
    row.className = 'col-name-row';
    row.innerHTML = `
      <span class="col-name-index">${String(i + 1).padStart(2, '0')}</span>
      <input
        class="col-name-input"
        type="text"
        placeholder="Column ${i + 1}"
        maxlength="40"
        data-index="${i}"
      />
    `;
    colNamesWrap.appendChild(row);
  }

  // Allow Enter to move to next input or create table on last
  colNamesWrap.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const inputs = [...colNamesWrap.querySelectorAll('.col-name-input')];
    const idx = inputs.indexOf(e.target);
    if (idx < inputs.length - 1) {
      inputs[idx + 1].focus();
    } else {
      createTable();
    }
  });
}

// ── Setup: Step 2 — create table ──────────────
document.getElementById('btn-create').addEventListener('click', createTable);

function createTable() {
  const inputs  = [...colNamesWrap.querySelectorAll('.col-name-input')];
  const columns = inputs.map((el, i) => el.value.trim() || `Column ${i + 1}`);

  // Save to state
  state.columns  = columns;
  state.rowCount = 0;

  // Build table header
  buildTableHeader(columns);

  // Clear body
  tableBody.innerHTML = '';
  updateCounter();
  showEmptyState(true);

  // Update header meta
  tableMeta.textContent = `${columns.length} columns`;

  // Transition
  overlay.classList.remove('active');
  app.classList.remove('hidden');
}

function buildTableHeader(columns) {
  tableHead.innerHTML = '';
  const tr = document.createElement('tr');

  // Row number header
  tr.appendChild(makeEl('th', { class: 'col-num', title: 'Row #' }, '#'));

  columns.forEach(name => {
    tr.appendChild(makeEl('th', {}, name));
  });

  // Delete column header
  tr.appendChild(makeEl('th', { class: 'col-del', title: 'Delete row' }, ''));

  tableHead.appendChild(tr);
}

// ── App: Add Row ───────────────────────────────
document.getElementById('btn-add-row').addEventListener('click', addRow);

function addRow() {
  showEmptyState(false);
  state.rowCount++;
  const rowNum = state.rowCount;

  const tr = document.createElement('tr');
  tr.className = 'row-enter';
  tr.dataset.row = rowNum;

  // Row number cell
  tr.appendChild(makeEl('td', { class: 'col-num' }, String(rowNum)));

  // Data cells
  state.columns.forEach((col, i) => {
    const td = document.createElement('td');
    const input = document.createElement('textarea');
    input.className   = 'cell-input';
    input.rows        = 1;
    input.placeholder = '—';
    input.dataset.col = i;
    input.setAttribute('aria-label', `${col}, row ${rowNum}`);

    // Auto-grow height
    input.addEventListener('input', autoGrow);
    td.appendChild(input);
    tr.appendChild(td);
  });

  // Delete cell
  const tdDel = document.createElement('td');
  tdDel.className = 'col-del';
  const delBtn = document.createElement('button');
  delBtn.className = 'del-row-btn';
  delBtn.title      = 'Delete this row';
  delBtn.innerHTML  = '×';
  delBtn.addEventListener('click', () => {
    tr.style.transition = 'opacity .2s, transform .2s';
    tr.style.opacity    = '0';
    tr.style.transform  = 'translateX(8px)';
    setTimeout(() => {
      tr.remove();
      renumberRows();
      updateCounter();
      if (tableBody.rows.length === 0) showEmptyState(true);
    }, 200);
  });
  tdDel.appendChild(delBtn);
  tr.appendChild(tdDel);

  tableBody.appendChild(tr);
  updateCounter();

  // Focus first input in new row
  const firstInput = tr.querySelector('.cell-input');
  if (firstInput) firstInput.focus();
}

function autoGrow(e) {
  const el = e.target;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function renumberRows() {
  state.rowCount = 0;
  [...tableBody.rows].forEach(tr => {
    state.rowCount++;
    const numCell = tr.querySelector('.col-num');
    if (numCell) numCell.textContent = state.rowCount;
    tr.dataset.row = state.rowCount;
  });
}

function updateCounter() {
  const n = tableBody.rows.length;
  rowCounter.textContent = `${n} row${n !== 1 ? 's' : ''}`;
}

function showEmptyState(yes) {
  const tableEl = document.getElementById('data-table');
  if (yes) {
    emptyState.classList.remove('hidden');
    tableEl.style.display = 'none';
  } else {
    emptyState.classList.add('hidden');
    tableEl.style.display = '';
  }
}

// ── App: Reset ─────────────────────────────────
document.getElementById('btn-reset').addEventListener('click', () => {
  // Go back to setup
  stepNames.classList.remove('active');
  stepCount.classList.add('active');
  colCountEl.value   = 3;
  colNamesWrap.innerHTML = '';
  state.columns  = [];
  state.rowCount = 0;

  app.classList.add('hidden');
  overlay.classList.add('active');
});

// ── Export / Share Excel ───────────────────────
document.getElementById('btn-export').addEventListener('click', exportExcel);

function exportExcel() {
  const rows = [...tableBody.rows];

  if (rows.length === 0) {
    showToast('Table is empty — add some rows first.', 'error');
    return;
  }

  // Build data array: headers + rows
  const data = [state.columns];

  rows.forEach(tr => {
    const cells = [...tr.querySelectorAll('.cell-input')];
    data.push(cells.map(c => c.value.trim()));
  });

  // SheetJS
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Style column widths (best-effort)
  ws['!cols'] = state.columns.map(col => ({
    wch: Math.max(col.length, 14)
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'TableForge Data');

  const filename = `tableforge_${timestamp()}.xlsx`;

  // Try Web Share API
  if (navigator.canShare && navigator.share) {
    const xlsxData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([xlsxData], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const file = new File([blob], filename, { type: blob.type });

    if (navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'TableForge Export' })
        .then(() => showToast('Shared successfully! ✓', 'success'))
        .catch(err => {
          if (err.name !== 'AbortError') {
            // Fallback to download
            downloadExcel(wb, filename);
          }
        });
      return;
    }
  }

  // Fallback: direct download
  downloadExcel(wb, filename);
}

function downloadExcel(wb, filename) {
  XLSX.writeFile(wb, filename);
  showToast(`Downloaded as ${filename} ✓`, 'success');
}

function timestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

// ── Toast ──────────────────────────────────────
let toastTimer = null;

function showToast(msg, type = 'success') {
  clearTimeout(toastTimer);
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✓' : '⚠'}</span>
    ${msg}
  `;
  toast.className = `toast ${type} show`;
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3400);
}

// ── Utility ────────────────────────────────────
function makeEl(tag, attrs = {}, text = '') {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  if (text) el.textContent = text;
  return el;
}
