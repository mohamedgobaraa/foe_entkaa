/* ════════════════════════════════════════════
   انتقاء جهاز مستقبل مصر — script.js
   Vanilla JS — no build step
════════════════════════════════════════════ */

'use strict';

const CACHE_KEY = 'tableforge.cache.v1';
const CACHE_VERSION = 1;

// ── State ──────────────────────────────────────
const state = {
  columns: [],   // string[]
  rowCount: 0,
};

let cacheTimer = null;
let isRestoringCache = false;

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
  persistSetupToCache();
});
document.getElementById('btn-inc').addEventListener('click', () => {
  const v = parseInt(colCountEl.value, 10);
  if (v < 20) colCountEl.value = v + 1;
  persistSetupToCache();
});

colCountEl.addEventListener('input', () => {
  colCountEl.value = clampColumnCount(colCountEl.value, 1);
  persistSetupToCache();
});

colNamesWrap.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !stepNames.classList.contains('active')) return;
  const inputs = [...colNamesWrap.querySelectorAll('.col-name-input')];
  const idx = inputs.indexOf(e.target);
  if (idx < inputs.length - 1) {
    inputs[idx + 1].focus();
  } else {
    createTable();
  }
});

colNamesWrap.addEventListener('input', scheduleSetupCacheSave);

document.getElementById('btn-next').addEventListener('click', () => {
  const count = clampColumnCount(colCountEl.value, 3);
  colCountEl.value = count;
  buildNameInputs(count);
  stepCount.classList.remove('active');
  stepNames.classList.add('active');
  persistSetupToCache();

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
        placeholder="عمود ${i + 1}"
        maxlength="40"
        data-index="${i}"
      />
    `;
    colNamesWrap.appendChild(row);
  }
}

// ── Setup: Step 2 — create table ──────────────
document.getElementById('btn-create').addEventListener('click', createTable);

function createTable() {
  const inputs  = [...colNamesWrap.querySelectorAll('.col-name-input')];
  const columns = inputs.map((el, i) => el.value.trim() || `عمود ${i + 1}`);

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
  tableMeta.textContent = `${columns.length} أعمدة`;

  // Transition
  overlay.classList.remove('active');
  app.classList.remove('hidden');

  persistTableToCache();
}

function buildTableHeader(columns) {
  tableHead.innerHTML = '';
  const tr = document.createElement('tr');

  // Row number header
  tr.appendChild(makeEl('th', { class: 'col-num', title: 'رقم الصف' }, '#'));

  columns.forEach(name => {
    tr.appendChild(makeEl('th', {}, name));
  });

  // Delete column header
  tr.appendChild(makeEl('th', { class: 'col-del', title: 'حذف الصف' }, ''));

  tableHead.appendChild(tr);
}

// ── App: Add Row ───────────────────────────────
document.getElementById('btn-add-row').addEventListener('click', () => addRow());

function addRow(prefilledValues = [], focusInput = true) {
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
    input.setAttribute('aria-label', `${col}، صف ${rowNum}`);
    input.value = typeof prefilledValues[i] === 'string' ? prefilledValues[i] : '';

    // Auto-grow height
    input.addEventListener('input', onCellInput);
    if (input.value) autoGrow({ target: input });
    td.appendChild(input);
    tr.appendChild(td);
  });

  // Delete cell
  const tdDel = document.createElement('td');
  tdDel.className = 'col-del';
  const delBtn = document.createElement('button');
  delBtn.className = 'del-row-btn';
  delBtn.title      = 'حذف هذا الصف';
  delBtn.innerHTML  = '×';
  delBtn.addEventListener('click', () => {
    tr.style.transition = 'opacity .2s, transform .2s';
    tr.style.opacity    = '0';
    tr.style.transform  = 'translateX(-8px)';
    setTimeout(() => {
      tr.remove();
      renumberRows();
      updateCounter();
      if (tableBody.rows.length === 0) showEmptyState(true);
      persistTableToCache();
    }, 200);
  });
  tdDel.appendChild(delBtn);
  tr.appendChild(tdDel);

  tableBody.appendChild(tr);
  updateCounter();

  // Focus first input in new row
  const firstInput = tr.querySelector('.cell-input');
  if (focusInput && firstInput) firstInput.focus();

  persistTableToCache();
}

function autoGrow(e) {
  const el = e.target;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function onCellInput(e) {
  autoGrow(e);
  scheduleTableCacheSave();
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
  rowCounter.textContent = `${n} صف`;
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

  clearCache();
});

// ── Export / Share Excel ───────────────────────
document.getElementById('btn-export').addEventListener('click', exportExcel);

async function exportExcel() {
  const rows = [...tableBody.rows];

  if (rows.length === 0) {
    showToast('الجدول فارغ — أضف بعض الصفوف أولاً', 'error');
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
  XLSX.utils.book_append_sheet(wb, ws, 'البيانات');

  const filename = `انتقاء_${timestamp()}.xlsx`;

  // Create the Excel file
  const xlsxData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([xlsxData], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const file = new File([blob], filename, { type: blob.type });

  // Prefer native Android/iOS share sheet when running inside Capacitor.
  try {
    const sharedOnNative = await shareViaCapacitor(blob, filename);
    if (sharedOnNative) {
      showToast('تم فتح قائمة المشاركة ✓', 'success');
      return;
    }
  } catch (err) {
    if (isShareCancelled(err)) return;
    console.error('Capacitor share failed:', err);
  }

  // Try Web Share API first (for mobile)
  if (navigator.share) {
    try {
      // Check if we can share files
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'انتقاء جهاز مستقبل مصر',
          text: 'ملف Excel من تطبيق انتقاء جهاز'
        });
        showToast('تمت المشاركة بنجاح ✓', 'success');
        return;
      }
    } catch (err) {
      // If user cancelled, don't show error
      if (err.name === 'AbortError') {
        return;
      }
      // Otherwise fall through to download
    }
  }

  if (isNativePlatform()) {
    showToast('تعذر فتح قائمة المشاركة. نفذ cap sync ثم جرّب مرة أخرى.', 'error');
    return;
  }

  // Fallback: direct download
  downloadExcel(wb, filename);
}

function downloadExcel(wb, filename) {
  XLSX.writeFile(wb, filename);
  showToast(`تم التحميل: ${filename} ✓`, 'success');
}

function timestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

async function shareViaCapacitor(blob, filename) {
  const plugins = getCapacitorPlugins();
  if (!plugins) return false;

  const sharePlugin = plugins.Share;
  const fsPlugin = plugins.Filesystem;
  if (!sharePlugin || !fsPlugin) return false;

  const base64Data = await blobToBase64(blob);
  const written = await fsPlugin.writeFile({
    path: `exports/${filename}`,
    data: base64Data,
    directory: 'CACHE',
    recursive: true
  });

  await sharePlugin.share({
    title: 'انتقاء جهاز مستقبل مصر',
    text: 'ملف Excel من تطبيق انتقاء جهاز',
    files: [written.uri],
    dialogTitle: 'مشاركة ملف Excel'
  });

  return true;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const parts = result.split(',');
      resolve(parts[1] || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function getCapacitorPlugins() {
  if (!isNativePlatform()) return null;
  const cap = window.Capacitor;
  return cap && cap.Plugins ? cap.Plugins : null;
}

function isNativePlatform() {
  const cap = window.Capacitor;
  if (!cap) return false;

  if (typeof cap.isNativePlatform === 'function') {
    return cap.isNativePlatform();
  }

  if (typeof cap.getPlatform === 'function') {
    const p = cap.getPlatform();
    return p === 'android' || p === 'ios';
  }

  return false;
}

function isShareCancelled(err) {
  if (!err) return false;
  if (err.name === 'AbortError') return true;
  const msg = String(err.message || err).toLowerCase();
  return msg.includes('cancel') || msg.includes('abort');
}

// ── Cache / Persistence ───────────────────────
function clampColumnCount(value, fallback = 3) {
  return Math.min(20, Math.max(1, parseInt(value, 10) || fallback));
}

function scheduleSetupCacheSave() {
  clearTimeout(cacheTimer);
  cacheTimer = setTimeout(persistSetupToCache, 180);
}

function scheduleTableCacheSave() {
  clearTimeout(cacheTimer);
  cacheTimer = setTimeout(persistTableToCache, 180);
}

function persistSetupToCache() {
  if (isRestoringCache) return;

  const colCount = clampColumnCount(colCountEl.value, 3);
  const columnDrafts = [...colNamesWrap.querySelectorAll('.col-name-input')].map(el => el.value);
  const setupStep = stepNames.classList.contains('active') ? 'names' : 'count';

  writeCache({
    mode: 'setup',
    setupStep,
    colCount,
    columnDrafts
  });
}

function persistTableToCache() {
  if (isRestoringCache) return;

  const rows = [...tableBody.rows].map(tr => {
    const cells = [...tr.querySelectorAll('.cell-input')];
    return cells.map(cell => cell.value);
  });

  writeCache({
    mode: 'table',
    columns: [...state.columns],
    rows
  });
}

function writeCache(payload) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      version: CACHE_VERSION,
      updatedAt: Date.now(),
      ...payload
    }));
  } catch (err) {
    console.error('Unable to write cache:', err);
  }
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('Unable to read cache:', err);
    return null;
  }
}

function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (err) {
    console.error('Unable to clear cache:', err);
  }
}

function restoreFromCache() {
  const cached = readCache();
  if (!cached || cached.version !== CACHE_VERSION) return;

  isRestoringCache = true;

  try {
    if (cached.mode === 'table' && Array.isArray(cached.columns) && cached.columns.length > 0) {
      const columns = cached.columns.map((name, i) => {
        const text = String(name || '').trim();
        return text || `عمود ${i + 1}`;
      });

      state.columns = columns;
      state.rowCount = 0;
      buildTableHeader(columns);
      tableBody.innerHTML = '';

      const rows = Array.isArray(cached.rows) ? cached.rows : [];
      rows.forEach(row => addRow(Array.isArray(row) ? row : [], false));

      tableMeta.textContent = `${columns.length} أعمدة`;
      updateCounter();
      showEmptyState(tableBody.rows.length === 0);

      overlay.classList.remove('active');
      app.classList.remove('hidden');
      return;
    }

    if (cached.mode === 'setup') {
      const count = clampColumnCount(cached.colCount, 3);
      colCountEl.value = count;

      const drafts = Array.isArray(cached.columnDrafts) ? cached.columnDrafts : [];
      const showNamesStep = cached.setupStep === 'names' || drafts.length > 0;

      if (showNamesStep) {
        buildNameInputs(count);
        const inputs = [...colNamesWrap.querySelectorAll('.col-name-input')];
        inputs.forEach((input, i) => {
          input.value = typeof drafts[i] === 'string' ? drafts[i] : '';
        });

        stepCount.classList.remove('active');
        stepNames.classList.add('active');
      } else {
        stepNames.classList.remove('active');
        stepCount.classList.add('active');
      }

      overlay.classList.add('active');
      app.classList.add('hidden');
    }
  } finally {
    isRestoringCache = false;
  }
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

window.addEventListener('beforeunload', () => {
  if (app.classList.contains('hidden')) {
    persistSetupToCache();
  } else {
    persistTableToCache();
  }
});

restoreFromCache();
