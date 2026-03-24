/* ════════════════════════════════════════════
   انتقاء جهاز مستقبل مصر — script.js
   Vanilla JS — no build step
════════════════════════════════════════════ */

'use strict';

const CACHE_KEY = 'tableforge.cache.v1';
const CACHE_VERSION = 1;

// ── Educational Levels Configuration ──────────
const EDUCATION_LEVELS = {
  'عليا': ['الاسم', 'الرقم الثلاثي', 'المؤهل', 'التخصص', 'المحافظة', 'المنطقة'],
  'فوق متوسطة': ['الاسم', 'الرقم الثلاثي', 'المؤهل', 'المهنة', 'المحافظة', 'المنطقة'],
  'متوسطة': ['الاسم', 'الرقم الثلاثي', 'المؤهل', 'المهنة', 'المحافظة', 'المنطقة'],
  'عادة': ['الاسم', 'الرقم الثلاثي', 'المهنة', 'المحافظة', 'المنطقة']
};

// ── State ──────────────────────────────────────
const state = {
  columns: [],          // string[]
  rowCount: 0,
  educationLevel: '',   // المستوى التعليمي المختار
};

let cacheTimer = null;
let isRestoringCache = false;

// ── DOM refs ───────────────────────────────────
const overlay      = document.getElementById('setup-overlay');
const stepLevel    = document.getElementById('step-level');
const app          = document.getElementById('app');
const tableHead    = document.getElementById('table-head');
const tableBody    = document.getElementById('table-body');
const tableMeta    = document.getElementById('table-meta');
const rowCounter   = document.getElementById('row-counter');
const emptyState   = document.getElementById('empty-state');
const toast        = document.getElementById('toast');

// ── Setup: Educational Level Selection ────────
document.querySelectorAll('.level-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const level = btn.dataset.level;
    if (!EDUCATION_LEVELS[level]) return;

    // Set state
    state.educationLevel = level;
    state.columns = EDUCATION_LEVELS[level];
    state.rowCount = 0;

    // Build table
    buildTableHeader(state.columns);
    tableBody.innerHTML = '';
    updateCounter();
    showEmptyState(true);

    // Update header meta
    tableMeta.textContent = `${level} • ${state.columns.length} أعمدة`;

    // Transition to app
    overlay.classList.remove('active');
    app.classList.remove('hidden');

    persistTableToCache();
  });
});

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
  // Reset state
  state.columns = [];
  state.rowCount = 0;
  state.educationLevel = '';

  // Return to setup
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

  const filename = `انتقاء_${state.educationLevel}_${timestamp()}.xlsx`;

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
function scheduleTableCacheSave() {
  clearTimeout(cacheTimer);
  cacheTimer = setTimeout(persistTableToCache, 180);
}

function persistTableToCache() {
  if (isRestoringCache) return;

  const rows = [...tableBody.rows].map(tr => {
    const cells = [...tr.querySelectorAll('.cell-input')];
    return cells.map(cell => cell.value);
  });

  writeCache({
    mode: 'table',
    educationLevel: state.educationLevel,
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
    if (cached.mode === 'table' &&
        cached.educationLevel &&
        Array.isArray(cached.columns) &&
        cached.columns.length > 0) {

      const level = cached.educationLevel;
      const columns = cached.columns.map((name, i) => {
        const text = String(name || '').trim();
        return text || `عمود ${i + 1}`;
      });

      state.educationLevel = level;
      state.columns = columns;
      state.rowCount = 0;

      buildTableHeader(columns);
      tableBody.innerHTML = '';

      const rows = Array.isArray(cached.rows) ? cached.rows : [];
      rows.forEach(row => addRow(Array.isArray(row) ? row : [], false));

      tableMeta.textContent = `${level} • ${columns.length} أعمدة`;
      updateCounter();
      showEmptyState(tableBody.rows.length === 0);

      overlay.classList.remove('active');
      app.classList.remove('hidden');
      return;
    }

    // If no valid cached table, show setup screen
    overlay.classList.add('active');
    app.classList.add('hidden');
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
  if (!app.classList.contains('hidden')) {
    persistTableToCache();
  }
});

restoreFromCache();
