/**
 * FormForge Studio V2 - Frontend Client Logic
 * Multi-Factor Covariance, Reverse Coding, SVG Distribution Charts & Live Psychometric Audit
 */

// Application State
const state = {
  formMeta: null,
  dataset: {
    batch: [],
    matrix: []
  },
  customWeights: {},
  constructs: {},    // e.g. { "F1 - Nhân tố 1": ["entry.101"], "Y - Kết quả": ["entry.102"] }
  reverseItems: [],  // list of entryIds
  isDispatching: false,
  gasCode: ''
};

// ==========================================
// 1. TAB SWITCHING
// ==========================================
function switchTab(tabId) {
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === tabId);
  });
}

document.querySelectorAll('.nav-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});


// ==========================================
// 2. SAMPLE TEST FORM HELPER (TAB 0)
// ==========================================
async function loadSampleFormAndInspect() {
  try {
    const res = await fetch('/api/sample-form');
    const data = await res.json();
    if (data.success && data.formMeta) {
      state.formMeta = data.formMeta;
      document.getElementById('form-url-input').value = data.formMeta.url;

      renderSchemaResults(state.formMeta);
      autoGroupConstructs();
      renderWeightsEditor(state.formMeta);
      document.getElementById('schema-results').style.display = 'block';

      switchTab('tab-schema');
    }
  } catch (err) {
    alert('Không thể tải form mẫu: ' + err.message);
  }
}


// ==========================================
// 3. SCHEMA PARSING (TAB 1)
// ==========================================
async function handleParseSchema() {
  const urlInput = document.getElementById('form-url-input');
  const rawUrl = urlInput.value.trim();

  if (!rawUrl) {
    alert('Vui lòng nhập đường dẫn Google Form.');
    return;
  }

  const loadingDiv = document.getElementById('parse-loading');
  const resultsDiv = document.getElementById('schema-results');
  const parseBtn = document.getElementById('btn-parse-schema');

  loadingDiv.style.display = 'block';
  resultsDiv.style.display = 'none';
  parseBtn.disabled = true;

  try {
    let formMeta;
    const isClientStandalone = Boolean(window.Capacitor || !window.location.origin.includes(':3000'));

    if (window.FormForgeEngine && isClientStandalone) {
      formMeta = await window.FormForgeEngine.parseGoogleForm(rawUrl);
    } else {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: rawUrl })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Lỗi bóc tách biểu mẫu.');
      }
      formMeta = data.formMeta;
    }

    state.formMeta = formMeta;
    renderSchemaResults(state.formMeta);
    autoGroupConstructs();
    renderWeightsEditor(state.formMeta);

    saveToStorage();
    resultsDiv.style.display = 'block';
  } catch (err) {
    alert('Không thể bóc tách biểu mẫu: ' + err.message);
  } finally {
    loadingDiv.style.display = 'none';
    parseBtn.disabled = false;
  }
}

function renderSchemaResults(meta) {
  document.getElementById('stat-form-title').innerText = meta.title || 'Biểu mẫu không tiêu đề';
  document.getElementById('stat-q-count').innerText = meta.questionCount;
  
  const pageElem = document.getElementById('stat-page-count');
  if (pageElem) {
    pageElem.innerHTML = `<span class="chip chip-mono">${meta.pageCount || 1} phần (pageHistory: ${meta.pageHistory || '0'})</span>`;
  }

  const loginElem = document.getElementById('stat-login-status');
  if (meta.requiresLogin) {
    loginElem.innerHTML = '<span class="chip chip-danger">BẮT BUỘC ĐĂNG NHẬP</span>';
  } else {
    loginElem.innerHTML = '<span class="chip chip-success">CÔNG KHAI (SẴN SÀNG)</span>';
  }

  document.getElementById('stat-fbzx').innerText = meta.fbzx ? meta.fbzx.slice(0, 12) + '...' : 'Không có';

  const tbody = document.getElementById('questions-tbody');
  tbody.innerHTML = '';

  let lastSectionIdx = -1;

  meta.questions.forEach((q, idx) => {
    if (q.isSection) return;

    if (q.sectionIndex !== undefined && q.sectionIndex !== lastSectionIdx && (meta.pageCount > 1 || (meta.sections && meta.sections.length > 1))) {
      lastSectionIdx = q.sectionIndex;
      const secTr = document.createElement('tr');
      secTr.style.background = '#F8FAFC';
      secTr.innerHTML = `
        <td colspan="7" style="padding: 0.65rem 1rem; font-weight: 800; color: #0F172A; border-top: 1px solid #E2E8F0; border-bottom: 1px solid #E2E8F0;">
          <span class="chip chip-mono" style="margin-right: 0.5rem; background: #0F172A; color: #FFFFFF;">PHẦN ${q.sectionIndex + 1}/${meta.pageCount || 1}</span>
          ${escapeHtml(q.sectionTitle || ('Phần ' + (q.sectionIndex + 1)))}
        </td>
      `;
      tbody.appendChild(secTr);
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color: var(--text-muted); font-family: var(--font-mono); font-weight: bold;">${idx + 1}</td>
      <td><span class="chip chip-mono">${q.entryId}</span></td>
      <td><span class="chip chip-mono" style="font-size:0.75rem;">${escapeHtml(q.sectionTitle || 'Phần 1')}</span></td>
      <td><span class="chip chip-cyan">${q.type}</span></td>
      <td><strong style="color: var(--text-primary);">${escapeHtml(q.title)}</strong></td>
      <td style="color: var(--text-secondary); font-size: 0.82rem;">
        ${q.options && q.options.length > 0 ? q.options.slice(0, 4).join(' | ') + (q.options.length > 4 ? '...' : '') : 'Văn bản mở'}
      </td>
      <td>${q.isRequired ? '<span class="chip chip-danger">Có</span>' : '<span style="color:var(--text-muted)">Không</span>'}</td>
    `;
    tbody.appendChild(tr);
  });
}


// ==========================================
// 4. MULTI-FACTOR & WEIGHTS CONFIG (TAB 2)
// ==========================================
function autoGroupConstructs(isManual = false) {
  if (!state.formMeta) return;
  state.constructs = {};

  const likertQuestions = state.formMeta.questions.filter(q => q.type === 'SCALE_LIKERT');
  if (likertQuestions.length === 0) {
    if (isManual) {
      alert('Biểu mẫu này gồm các câu hỏi trắc nghiệm & hộp kiểm định tính (không phải thang đo số Likert 1-5).\n\nThuật toán hiệp phương sai SPSS Likert chỉ kích hoạt với thang đo số. Với biểu mẫu hiện tại, hệ thống sẽ tự động phân phối phản hồi chuẩn xác theo % tỷ lệ bạn cấu hình ở từng câu hỏi.');
    }
    return;
  }

  // Heuristic: Group every 2-3 items into F1, F2, Y
  let factorIndex = 1;
  let currentGroup = [];
  const groupSize = likertQuestions.length > 4 ? 3 : 2;

  likertQuestions.forEach((q, idx) => {
    currentGroup.push(q.entryId);
    const isLast = idx === likertQuestions.length - 1;

    if (currentGroup.length >= groupSize || isLast) {
      const isDependent = isLast && likertQuestions.length > 3;
      const fName = isDependent ? 'Y - Nhân tố Phụ thuộc (Kết quả)' : `F${factorIndex} - Nhân tố Độc lập ${factorIndex}`;
      state.constructs[fName] = [...currentGroup];
      currentGroup = [];
      factorIndex++;
    }
  });

  if (isManual) {
    alert(`Đã tự động gom nhóm ${likertQuestions.length} biến thang đo Likert vào các nhân tố F1, F2, Y!`);
  }
}

function renderSvgBarChart(options, weights) {
  if (!options || options.length === 0) return '';
  const total = weights.reduce((sum, w) => sum + (Number(w) || 0), 0) || 100;
  
  const width = 360;
  const height = 48;
  const barWidth = width / options.length;

  let rects = '';
  options.forEach((opt, idx) => {
    const val = Number(weights[idx]) || 0;
    const pct = Math.round((val / total) * 100);
    const barHeight = Math.max(4, Math.round((val / 100) * (height - 18)));
    const x = idx * barWidth + 4;
    const y = height - barHeight - 14;

    rects += `
      <g>
        <rect x="${x}" y="${y}" width="${barWidth - 8}" height="${barHeight}" rx="2" fill="#0f172a" opacity="0.85" />
        <text x="${x + (barWidth - 8) / 2}" y="${height - 2}" font-size="9" font-family="'Space Mono', monospace" fill="#64748b" text-anchor="middle">${escapeHtml(opt.slice(0, 5))}</text>
        <text x="${x + (barWidth - 8) / 2}" y="${Math.max(10, y - 3)}" font-size="9" font-family="'Space Mono', monospace" font-weight="bold" fill="#0f172a" text-anchor="middle">${pct}%</text>
      </g>
    `;
  });

  return `
    <div style="background: var(--bg-subtle); border: 1px solid var(--border-hairline); border-radius: 4px; padding: 0.5rem; margin-top: 0.75rem;">
      <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; margin-bottom: 0.25rem;">Biểu đồ phân bổ tỷ lệ dự kiến:</div>
      <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow: visible;">
        ${rects}
      </svg>
    </div>
  `;
}

function renderWeightsEditor(meta) {
  const container = document.getElementById('weights-editor-container');
  container.innerHTML = '';

  const choiceQuestions = meta.questions.filter(q => ['RADIO', 'DROPDOWN', 'CHECKBOX', 'SCALE_LIKERT'].includes(q.type));
  const textQuestions = meta.questions.filter(q => ['SHORT_TEXT', 'PARAGRAPH'].includes(q.type));

  if (choiceQuestions.length === 0 && textQuestions.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted);">Biểu mẫu này không có câu hỏi nào cần cấu hình.</p>';
    return;
  }

  choiceQuestions.forEach(q => {
    const box = document.createElement('div');
    box.style.background = '#ffffff';
    box.style.border = '1px solid var(--border-hairline)';
    box.style.padding = '1.25rem 1.5rem';
    box.style.borderRadius = '4px';
    box.style.marginBottom = '1.25rem';

    const isCheckbox = q.type === 'CHECKBOX';
    const isLikert = q.type === 'SCALE_LIKERT';
    const equalWeight = isCheckbox ? 50 : (q.options.length > 0 ? Math.round(100 / q.options.length) : 20);
    const currentWeights = (state.customWeights[q.entryId]) || new Array(q.options.length).fill(equalWeight);

    let optionsInputs = '';
    q.options.forEach((opt, oIdx) => {
      const wVal = currentWeights[oIdx] !== undefined ? currentWeights[oIdx] : equalWeight;
      optionsInputs += `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-top: 0.5rem; font-size: 0.88rem;">
          <span style="flex: 1; color: var(--text-secondary);">${escapeHtml(opt)}</span>
          <div style="display: flex; align-items: center; gap: 0.35rem;">
            <input type="number" 
                   data-entry="${q.entryId}" 
                   data-opt-index="${oIdx}" 
                   class="weight-input text-input" 
                   value="${wVal}" 
                   min="0" max="100" 
                   onchange="updateChartPreview('${q.entryId}')"
                   style="width: 75px; padding: 0.4rem 0.6rem; text-align: right;" />
            <span style="color: var(--text-muted); font-size: 0.85rem; font-weight: bold;">%</span>
          </div>
        </div>
      `;
    });

    // Construct Selector for Likert items
    let constructSelectorHtml = '';
    if (isLikert) {
      const assignedConstruct = Object.keys(state.constructs).find(c => state.constructs[c].includes(q.entryId)) || '';
      const isReverse = state.reverseItems.includes(q.entryId);

      constructSelectorHtml = `
        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.75rem; background: var(--bg-subtle); padding: 0.5rem 0.85rem; border-radius: 4px;">
          <label style="font-size: 0.8rem; font-weight: 700; color: var(--text-primary);">Gán vào Nhân tố:</label>
          <select class="text-input" style="padding: 0.3rem 0.6rem; font-size: 0.82rem; width: auto;" onchange="handleAssignConstruct('${q.entryId}', this.value)">
            <option value="">-- Mặc định (Chung) --</option>
            <option value="F1" ${assignedConstruct.startsWith('F1') ? 'selected' : ''}>F1 - Nhân tố Độc lập 1</option>
            <option value="F2" ${assignedConstruct.startsWith('F2') ? 'selected' : ''}>F2 - Nhân tố Độc lập 2</option>
            <option value="F3" ${assignedConstruct.startsWith('F3') ? 'selected' : ''}>F3 - Nhân tố Độc lập 3</option>
            <option value="Y" ${assignedConstruct.startsWith('Y') ? 'selected' : ''}>Y - Nhân tố Phụ thuộc</option>
          </select>
          <label style="margin-left: auto; display: flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; cursor: pointer; color: var(--accent-rose); font-weight: 600;">
            <input type="checkbox" ${isReverse ? 'checked' : ''} onchange="handleToggleReverse('${q.entryId}', this.checked)" />
            Đảo ngược điểm (6 - Score)
          </label>
        </div>
      `;
    }

    const typeLabel = isCheckbox ? 'HỘP KIỂM (CHỌN NHIỀU)' : (isLikert ? 'THANG ĐO LIKERT' : q.type);
    const chartHtml = `<div id="chart-preview-${q.entryId}">${renderSvgBarChart(q.options, currentWeights)}</div>`;

    box.innerHTML = `
      <div style="font-weight: 800; font-size: 0.95rem; margin-bottom: 0.65rem; color: var(--text-primary); display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem;">
        <div>
          <span class="chip chip-mono" style="margin-right: 0.4rem;">${q.entryId}</span>
          <span class="chip chip-mono" style="font-size:0.75rem; margin-right: 0.4rem;">${escapeHtml(q.sectionTitle || 'Phần 1')}</span>
          <div style="margin-top: 0.35rem; line-height: 1.4;">${escapeHtml(q.title)}</div>
          ${isCheckbox ? '<div style="font-size: 0.76rem; color: var(--text-muted); font-weight: normal; margin-top: 0.25rem;">* Hộp kiểm cho phép chọn nhiều mục: Nhập % xác suất tick chọn cho từng phương án.</div>' : ''}
        </div>
        <span class="chip chip-cyan" style="white-space: nowrap;">${typeLabel}</span>
      </div>
      ${constructSelectorHtml}
      <div style="padding-left: 0.25rem;">
        ${optionsInputs}
      </div>
      ${chartHtml}
    `;

    container.appendChild(box);
  });

  textQuestions.forEach(q => {
    const box = document.createElement('div');
    box.style.background = '#ffffff';
    box.style.border = '1px solid var(--border-hairline)';
    box.style.padding = '1.25rem 1.5rem';
    box.style.borderRadius = '4px';
    box.style.marginBottom = '1.25rem';
    box.innerHTML = `
      <div style="font-weight: 800; font-size: 0.95rem; margin-bottom: 0.45rem; color: var(--text-primary); display: flex; align-items: center; justify-content: space-between;">
        <div>
          <span class="chip chip-mono" style="margin-right: 0.4rem;">${q.entryId}</span>
          <span class="chip chip-mono" style="font-size:0.75rem; margin-right: 0.4rem;">${escapeHtml(q.sectionTitle || 'Phần 1')}</span>
          <div style="margin-top: 0.35rem;">${escapeHtml(q.title)}</div>
        </div>
        <span class="chip chip-mono">${q.type === 'PARAGRAPH' ? 'ĐOẠN VĂN' : 'VĂN BẢN NGẮN'}</span>
      </div>
      <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.35rem;">
        Hệ thống tự động sinh nội dung phản hồi văn bản mở ngẫu nhiên, tự nhiên và thực tế.
      </div>
    `;
    container.appendChild(box);
  });
}

function handleAssignConstruct(entryId, factorKey) {
  // Remove entry from all
  Object.keys(state.constructs).forEach(k => {
    state.constructs[k] = state.constructs[k].filter(id => id !== entryId);
  });

  if (factorKey) {
    const fullKey = factorKey === 'Y' ? 'Y - Nhân tố Phụ thuộc (Kết quả)' : `${factorKey} - Nhân tố Độc lập ${factorKey.slice(1)}`;
    if (!state.constructs[fullKey]) state.constructs[fullKey] = [];
    state.constructs[fullKey].push(entryId);
  }
  saveToStorage();
}

function handleToggleReverse(entryId, isChecked) {
  if (isChecked) {
    if (!state.reverseItems.includes(entryId)) state.reverseItems.push(entryId);
  } else {
    state.reverseItems = state.reverseItems.filter(id => id !== entryId);
  }
  saveToStorage();
}

function updateChartPreview(entryId) {
  const inputs = document.querySelectorAll(`.weight-input[data-entry="${entryId}"]`);
  const weights = Array.from(inputs).map(inp => parseInt(inp.value, 10) || 0);
  const q = state.formMeta.questions.find(item => item.entryId === entryId);
  if (q) {
    const container = document.getElementById(`chart-preview-${entryId}`);
    if (container) {
      container.innerHTML = renderSvgBarChart(q.options, weights);
    }
  }
}

function collectCustomWeights() {
  const weightsMap = {};
  document.querySelectorAll('.weight-input').forEach(input => {
    const entry = input.dataset.entry;
    const optIdx = parseInt(input.dataset.optIndex, 10);
    const val = parseInt(input.value, 10) || 0;

    if (!weightsMap[entry]) {
      weightsMap[entry] = [];
    }
    weightsMap[entry][optIdx] = val;
  });
  state.customWeights = weightsMap;
  return weightsMap;
}

function handleExportWeightsCode() {
  const statusEl = document.getElementById('bulk-code-status');
  const textarea = document.getElementById('bulk-weights-code-input');
  if (!state.formMeta || !state.formMeta.questions || state.formMeta.questions.length === 0) {
    alert('Vui lòng nạp & bóc tách một biểu mẫu Google Form ở Tab 1 trước.');
    return;
  }

  const currentWeights = collectCustomWeights();
  const choiceTypes = ['RADIO', 'DROPDOWN', 'CHECKBOX', 'SCALE_LIKERT'];
  const lines = [
    `# CẤU HÌNH TỶ LỆ % FORMFORGE`,
    `# Sửa các con số % bên dưới rồi bấm "Áp dụng Code vào Bảng"`,
    ``
  ];

  let exportedCount = 0;
  state.formMeta.questions.forEach((q, idx) => {
    if (!choiceTypes.includes(q.type) || !q.options || q.options.length === 0) return;
    exportedCount++;
    const isCheckbox = q.type === 'CHECKBOX';
    const defVal = isCheckbox ? 50 : Math.round(100 / q.options.length);
    const wArr = (currentWeights[q.entryId] && currentWeights[q.entryId].length === q.options.length)
      ? currentWeights[q.entryId]
      : new Array(q.options.length).fill(defVal);

    const shortTitle = (q.title || '').replace(/\s+/g, ' ').slice(0, 70);
    lines.push(`# Câu ${idx + 1} [${q.type}] (${q.options.length} đáp án): ${shortTitle}`);
    lines.push(`${idx + 1}: ${wArr.join(', ')}`);
    lines.push('');
  });

  textarea.value = lines.join('\n').trim();
  if (statusEl) {
    statusEl.style.color = '#059669';
    statusEl.textContent = `✓ Đã xuất khung Code cho ${exportedCount} câu hỏi. Chỉnh sửa số % rồi bấm "Áp dụng Code vào Bảng".`;
  }
}

function handleApplyWeightsCode() {
  const statusEl = document.getElementById('bulk-code-status');
  const textarea = document.getElementById('bulk-weights-code-input');
  if (!state.formMeta || !state.formMeta.questions) {
    alert('Vui lòng nạp & bóc tách một biểu mẫu Google Form ở Tab 1 trước.');
    return;
  }

  const raw = (textarea.value || '').trim();
  if (!raw) {
    if (statusEl) {
      statusEl.style.color = '#DC2626';
      statusEl.textContent = '⚠ Khung code đang trống. Hãy bấm "Lấy mẫu Code của Form" hoặc dán code vào.';
    }
    return;
  }

  const parsedEntries = [];
  try {
    if (raw.startsWith('{')) {
      const jsonObj = JSON.parse(raw);
      for (const [k, v] of Object.entries(jsonObj)) {
        if (!Array.isArray(v)) throw new Error(`Giá trị của "${k}" phải là mảng số, ví dụ [40, 30, 30]`);
        parsedEntries.push({ key: String(k).trim(), nums: v.map(Number) });
      }
    } else {
      const lines = raw.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line || line.startsWith('#') || line.startsWith('//')) continue;
        // Strip inline comments (# or //)
        line = line.replace(/(#|\/\/).*$/, '').trim();
        if (!line) continue;

        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) {
          throw new Error(`Dòng ${i + 1} thiếu dấu hai chấm (:): "${line}"`);
        }
        const key = line.slice(0, colonIdx).trim();
        const valStr = line.slice(colonIdx + 1).trim();
        const nums = valStr
          .replace(/[\[\]%]/g, '')
          .split(/[\s,;]+/)
          .filter(Boolean)
          .map(Number);

        if (nums.length === 0 || nums.some(n => Number.isNaN(n) || n < 0)) {
          throw new Error(`Dòng ${i + 1} chứa giá trị % không hợp lệ: "${valStr}"`);
        }
        parsedEntries.push({ key, nums });
      }
    }
  } catch (err) {
    if (statusEl) {
      statusEl.style.color = '#DC2626';
      statusEl.textContent = `✕ Lỗi cú pháp: ${err.message}`;
    }
    return;
  }

  const choiceTypes = ['RADIO', 'DROPDOWN', 'CHECKBOX', 'SCALE_LIKERT'];
  const updatedSet = new Set();

  for (const { key, nums } of parsedEntries) {
    if (key.toLowerCase() === 'all' || key === '*') {
      state.formMeta.questions.forEach(q => {
        if (choiceTypes.includes(q.type) && q.options && q.options.length === nums.length) {
          state.customWeights[q.entryId] = [...nums];
          updatedSet.add(q.entryId);
        }
      });
      continue;
    }

    let targetQ = null;
    if (/^\d+$/.test(key)) {
      const idx = parseInt(key, 10) - 1;
      targetQ = state.formMeta.questions[idx] || null;
    } else {
      targetQ = state.formMeta.questions.find(q => q.entryId === key || String(q.rawEntryId) === key) || null;
    }

    if (targetQ && choiceTypes.includes(targetQ.type) && targetQ.options && targetQ.options.length > 0) {
      const len = targetQ.options.length;
      const adjusted = [];
      for (let j = 0; j < len; j++) {
        adjusted.push(nums[j] !== undefined ? nums[j] : 0);
      }
      state.customWeights[targetQ.entryId] = adjusted;
      updatedSet.add(targetQ.entryId);
    }
  }

  if (updatedSet.size === 0) {
    if (statusEl) {
      statusEl.style.color = '#D97706';
      statusEl.textContent = '⚠ Không có câu hỏi nào khớp với STT hoặc Entry ID trong code bạn nhập.';
    }
    return;
  }

  renderWeightsEditor(state.formMeta);
  saveToStorage();
  if (statusEl) {
    statusEl.style.color = '#059669';
    statusEl.textContent = `✓ Đã áp dụng thành công tỷ lệ % cho ${updatedSet.size} câu hỏi và cập nhật biểu đồ bên dưới!`;
  }
}

async function handleGeneratePreview() {
  if (!state.formMeta) {
    alert('Vui lòng phân tích biểu mẫu ở Tab 1 trước.');
    return;
  }

  const count = parseInt(document.getElementById('cfg-count').value, 10) || 10;
  const mode = document.getElementById('cfg-mode').value;
  const weights = collectCustomWeights();

  try {
    let batch, matrix;
    const isClientStandalone = Boolean(window.Capacitor || !window.location.origin.includes(':3000'));

    if (window.FormForgeEngine && isClientStandalone) {
      const generated = window.FormForgeEngine.generateBatchDataset(state.formMeta.questions, count, {
        mode,
        weights,
        constructs: state.constructs,
        reverseItems: state.reverseItems
      });
      batch = generated.batch;
      matrix = generated.matrix;
    } else {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: state.formMeta.questions,
          count,
          config: {
            mode,
            weights,
            constructs: state.constructs,
            reverseItems: state.reverseItems
          }
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      batch = data.batch;
      matrix = data.matrix;
    }

    state.dataset = {
      batch,
      matrix
    };

    renderExportTable(data.matrix);
    saveToStorage();
    alert(`Đã sinh thành công ${data.batch.length} bản ghi ma trận dữ liệu! Bạn có thể nhấn 'Bắt đầu Nộp phiếu' ngay trên màn hình này hoặc xem bảng dữ liệu tại Tab 3.`);
  } catch (err) {
    alert('Lỗi sinh dữ liệu: ' + err.message);
  }
}


// ==========================================
// 5. LIVE DISPATCHER & MULTI-WORKER CONCURRENCY
// ==========================================
function updateEtcEstimate() {
  const countInput = document.getElementById('cfg-count');
  const pacingSelect = document.getElementById('dispatch-pacing');
  const etcText = document.getElementById('etc-estimate-text');
  const etcRateBadge = document.getElementById('etc-rate-badge');

  if (!countInput || !pacingSelect || !etcText) return;

  const count = Math.max(1, parseInt(countInput.value, 10) || 1);
  const pacing = pacingSelect.value;

  let totalSeconds = 0;
  let rateDesc = '';

  if (pacing === 'throttled') {
    totalSeconds = count * 2.25;
    rateDesc = '🐢 ~0.4 - 0.5 phiếu/giây (Giãn cách an toàn)';
  } else if (pacing === 'instant') {
    totalSeconds = count * 0.33;
    rateDesc = '⚡ ~2.5 - 3 phiếu/giây (Tuần tự nhanh)';
  } else if (pacing === 'parallel_5') {
    totalSeconds = Math.ceil(count / 5) * 0.28;
    rateDesc = '🚀 ~15 - 18 phiếu/giây (Song song 5 luồng)';
  } else if (pacing === 'parallel_10') {
    totalSeconds = Math.ceil(count / 10) * 0.28;
    rateDesc = '⚡ ~30 - 35 phiếu/giây (Song song 10 luồng)';
  } else if (pacing === 'parallel_20') {
    totalSeconds = Math.ceil(count / 20) * 0.30;
    rateDesc = '🔥 ~50 - 65 phiếu/giây (Turbo 20 luồng)';
  }

  let timeStr = '';
  if (totalSeconds < 1) {
    timeStr = '~0.8 giây (Gần như tức thì)';
  } else if (totalSeconds < 60) {
    const formattedSecs = Math.round(totalSeconds * 10) / 10;
    timeStr = `~${formattedSecs} giây`;
  } else if (totalSeconds < 3600) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.round(totalSeconds % 60);
    timeStr = secs > 0 ? `~${mins} phút ${secs} giây` : `~${mins} phút`;
  } else {
    const hours = Math.floor(totalSeconds / 3600);
    const remainingMins = Math.round((totalSeconds % 3600) / 60);
    timeStr = remainingMins > 0 ? `~${hours} giờ ${remainingMins} phút` : `~${hours} giờ`;
  }

  etcText.innerText = timeStr;
  if (etcRateBadge) {
    etcRateBadge.innerText = rateDesc;
  }
}

async function handleStartDispatch() {
  const startBtn = document.getElementById('btn-start-dispatch');

  // If already dispatching, handle cancellation toggle
  if (state.isDispatching) {
    state.isDispatching = false;
    logConsole('[USER STOP] Đã gửi lệnh dừng tiến trình nộp phiếu. Đang đợi hoàn tất các luồng dở dang...', 'warning');
    if (startBtn) {
      startBtn.innerText = 'Đang dừng...';
      startBtn.disabled = true;
    }
    return;
  }

  if (!state.formMeta) {
    alert('Vui lòng phân tích biểu mẫu ở Tab 1 trước.');
    return;
  }

  if (!state.dataset.batch || state.dataset.batch.length === 0) {
    await handleGeneratePreview();
  }

  const pacing = document.getElementById('dispatch-pacing').value;
  const progressText = document.getElementById('dispatch-progress-text');
  const percentText = document.getElementById('dispatch-percent-text');
  const progressFill = document.getElementById('dispatch-progress-fill');
  const liveBadge = document.getElementById('live-badge');

  if (state.formMeta.requiresLogin) {
    const proceed = confirm('CẢNH BÁO: Biểu mẫu này yêu cầu đăng nhập Google. Các request gửi ẩn danh có thể bị Google từ chối (HTTP 401/403). Bạn có muốn tiếp tục kiểm thử không?');
    if (!proceed) return;
  }

  state.isDispatching = true;
  startBtn.innerText = '⏹️ Dừng nộp phiếu';
  startBtn.style.background = '#DC2626';
  startBtn.style.borderColor = '#B91C1C';
  startBtn.disabled = false;

  liveBadge.innerText = 'DISPATCHING';
  liveBadge.className = 'tab-badge chip-danger';

  const total = state.dataset.batch.length;
  progressText.innerText = `0 / ${total}`;
  percentText.innerText = '0%';
  progressFill.style.width = '0%';

  const isParallel = pacing.startsWith('parallel_');
  const concurrency = isParallel ? parseInt(pacing.split('_')[1], 10) : 1;

  if (isParallel) {
    logConsole(`[START PARALLEL] Khởi chạy song song ${concurrency} luồng (Đa tab) nộp ${total} phiếu...`, 'info');
  } else {
    logConsole(`[START] Bắt đầu nộp tuần tự ${total} phiếu tới ${state.formMeta.formAction}`, 'info');
  }

  let successCount = 0;
  let failCount = 0;
  let completedCount = 0;

  async function doSubmitSingle(payload) {
    const isClientStandalone = Boolean(window.Capacitor || !window.location.origin.includes(':3000'));
    if (window.FormForgeEngine && isClientStandalone) {
      return await window.FormForgeEngine.submitSingleResponse(
        state.formMeta.formAction,
        payload,
        state.formMeta.fbzx,
        state.formMeta.pageHistory || '0'
      );
    }
    const res = await fetch('/api/submit-single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formAction: state.formMeta.formAction,
        payload,
        fbzx: state.formMeta.fbzx,
        pageHistory: state.formMeta.pageHistory || '0'
      })
    });
    return await res.json();
  }

  if (isParallel) {
    // MULTI-WORKER CONCURRENCY POOL
    let currentIndex = 0;

    async function worker(workerId) {
      while (currentIndex < total && state.isDispatching) {
        const i = currentIndex++;
        const payload = state.dataset.batch[i];
        try {
          const result = await doSubmitSingle(payload);

          if (result.success) {
            successCount++;
            logConsole(`[Luồng ${workerId} | #${i + 1}/${total}] HTTP ${result.status} OK - ${result.latencyMs}ms`, 'success');
          } else {
            failCount++;
            logConsole(`[Luồng ${workerId} | #${i + 1}/${total}] THẤT BẠI - HTTP ${result.status}: ${result.error || result.statusText}`, 'error');
          }
        } catch (err) {
          failCount++;
          logConsole(`[Luồng ${workerId} | #${i + 1}/${total}] LỖI KẾT NỐI: ${err.message}`, 'error');
        }

        completedCount++;
        const pct = Math.round((completedCount / total) * 100);
        progressText.innerText = `${completedCount} / ${total}`;
        percentText.innerText = `${pct}%`;
        progressFill.style.width = `${pct}%`;
      }
    }

    const workers = [];
    for (let w = 1; w <= concurrency; w++) {
      workers.push(worker(w));
    }
    await Promise.all(workers);

  } else {
    // SEQUENTIAL DISPATCH (Throttled or Instant)
    for (let i = 0; i < total; i++) {
      if (!state.isDispatching) break;

      const payload = state.dataset.batch[i];
      try {
        const result = await doSubmitSingle(payload);

        if (result.success) {
          successCount++;
          logConsole(`[#${i + 1}/${total}] HTTP ${result.status} OK - Độ trễ: ${result.latencyMs}ms`, 'success');
        } else {
          failCount++;
          logConsole(`[#${i + 1}/${total}] THẤT BẠI - HTTP ${result.status}: ${result.error || result.statusText}`, 'error');
        }
      } catch (err) {
        failCount++;
        logConsole(`[#${i + 1}/${total}] LỖI KẾT NỐI: ${err.message}`, 'error');
      }

      completedCount = i + 1;
      const pct = Math.round((completedCount / total) * 100);
      progressText.innerText = `${completedCount} / ${total}`;
      percentText.innerText = `${pct}%`;
      progressFill.style.width = `${pct}%`;

      // Pacing delay
      if (i < total - 1 && state.isDispatching) {
        const delay = pacing === 'throttled' ? Math.floor(1000 + Math.random() * 2000) : 150;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  logConsole(`[HOÀN TẤT] Thành công: ${successCount} | Thất bại: ${failCount}`, successCount > 0 ? 'success' : 'error');
  liveBadge.innerText = state.isDispatching ? 'HOÀN TẤT' : 'ĐÃ DỪNG';
  liveBadge.className = successCount > 0 ? 'tab-badge chip-success' : 'tab-badge chip-danger';

  startBtn.innerText = '🚀 Bắt đầu Nộp phiếu';
  startBtn.style.background = '';
  startBtn.style.borderColor = '';
  startBtn.disabled = false;
  state.isDispatching = false;
}

function logConsole(msg, type = 'info') {
  const box = document.getElementById('dispatch-console');
  const line = document.createElement('div');
  line.className = `log-entry log-${type}`;
  line.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}


// ==========================================
// 6. EXPORT & IMPORT DATASET (TAB 4)
// ==========================================
function renderExportTable(matrix) {
  if (!matrix || matrix.length === 0) return;

  const thead = document.getElementById('export-thead');
  const tbody = document.getElementById('export-tbody');

  const headers = Object.keys(matrix[0]);
  thead.innerHTML = `<tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;

  tbody.innerHTML = '';
  matrix.slice(0, 15).forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = headers.map(h => `<td style="font-size:0.85rem;">${escapeHtml(String(row[h] || ''))}</td>`).join('');
    tbody.appendChild(tr);
  });
}

async function handleExportCsv() {
  if (!state.dataset.matrix || state.dataset.matrix.length === 0) {
    alert('Chưa có dữ liệu để xuất. Vui lòng bấm "Sinh ma trận" ở Tab 2.');
    return;
  }

  const isClientStandalone = Boolean(window.Capacitor || !window.location.origin.includes(':3000'));
  if (window.FormForgeEngine && isClientStandalone) {
    const csvContent = window.FormForgeEngine.datasetToCsv(state.dataset.matrix);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `formforge_dataset_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }

  try {
    const res = await fetch('/api/export-csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matrix: state.dataset.matrix })
    });

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `formforge_dataset_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    alert('Lỗi xuất CSV: ' + err.message);
  }
}

function handleImportCsvFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const csvContent = e.target.result;
    try {
      const res = await fetch('/api/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvContent,
          questions: state.formMeta ? state.formMeta.questions : []
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      state.dataset = {
        matrix: data.matrix,
        batch: data.batch
      };

      renderExportTable(data.matrix);
      alert(`Đã nhập thành công ${data.totalRows} dòng từ file CSV! Dữ liệu đã sẵn sàng để phát ở Tab 3.`);
    } catch (err) {
      alert('Lỗi nạp file CSV: ' + err.message);
    }
  };
  reader.readAsText(file, 'utf-8');
}


// ==========================================
// 7. LIVE PSYCHOMETRIC & FORENSIC AUDIT (TAB 5)
// ==========================================
async function handleRunAuditReport() {
  if (!state.dataset.matrix || state.dataset.matrix.length === 0) {
    alert('Chưa có dữ liệu để kiểm toán. Vui lòng sinh ma trận ở Tab 2 hoặc nhập file CSV ở Tab 4.');
    return;
  }

  try {
    let report;
    const isClientStandalone = Boolean(window.Capacitor || !window.location.origin.includes(':3000'));

    if (window.FormForgeEngine && isClientStandalone) {
      const fullAudit = window.FormForgeEngine.auditFullDataset(state.dataset.matrix, state.constructs);
      report = {
        totalResponses: fullAudit.totalRows,
        straightLineRate: fullAudit.straightLineRate,
        overallAlpha: {
          alpha: fullAudit.overallAlpha,
          isAccepted: fullAudit.overallAlpha >= 0.7,
          rating: fullAudit.overallAlpha >= 0.8 ? 'RẤT TỐT (EXCELLENT)' : (fullAudit.overallAlpha >= 0.7 ? 'ĐẠT CHUẨN (ACCEPTABLE)' : 'KHÔNG ĐẠT (POOR)')
        },
        constructAlphas: fullAudit.constructAlphas || {}
      };
    } else {
      const res = await fetch('/api/audit-dataset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matrix: state.dataset.matrix,
          questions: state.formMeta ? state.formMeta.questions : [],
          constructs: state.constructs
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      report = data.report;
    }

    renderAuditReport(report);
  } catch (err) {
    alert('Lỗi kiểm toán: ' + err.message);
  }
}

function renderAuditReport(report) {
  const container = document.getElementById('audit-metrics-container');
  container.style.display = 'block';

  // Overall Alpha
  const alphaVal = document.getElementById('audit-alpha-val');
  const alphaRating = document.getElementById('audit-alpha-rating');
  if (report.overallAlpha && report.overallAlpha.alpha !== null) {
    alphaVal.innerText = report.overallAlpha.alpha;
    alphaRating.innerHTML = `<span class="chip ${report.overallAlpha.isAccepted ? 'chip-success' : 'chip-danger'}">${report.overallAlpha.rating}</span>`;
  } else {
    alphaVal.innerText = 'N/A';
    alphaRating.innerText = 'Chưa đủ biến Likert';
  }

  // Straight lining
  const straightVal = document.getElementById('audit-straight-val');
  const straightRating = document.getElementById('audit-straight-rating');
  straightVal.innerText = `${report.straightLining.percentage}% (${report.straightLining.count} phiếu)`;
  straightRating.innerHTML = `<span class="chip ${report.straightLining.percentage > 15 ? 'chip-danger' : 'chip-success'}">${report.straightLining.rating}</span>`;

  document.getElementById('audit-sample-val').innerText = report.sampleSize;

  // Construct table
  const constructBox = document.getElementById('construct-alphas-box');
  const tbody = document.getElementById('construct-alphas-tbody');
  tbody.innerHTML = '';

  const constructKeys = Object.keys(report.constructAlphas);
  if (constructKeys.length > 0) {
    constructBox.style.display = 'block';
    constructKeys.forEach(cName => {
      const c = report.constructAlphas[cName];
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(cName)}</strong></td>
        <td>${c.itemCount} câu hỏi</td>
        <td style="font-family: var(--font-mono); font-weight: 800; color: ${c.isAccepted ? 'var(--accent-emerald)' : 'var(--accent-rose)'}; font-size: 1rem;">${c.alpha}</td>
        <td><span class="chip ${c.isAccepted ? 'chip-success' : 'chip-danger'}">${c.rating}</span></td>
      `;
      tbody.appendChild(tr);
    });
  } else {
    constructBox.style.display = 'none';
  }
}


// ==========================================
// 8. GOOGLE APPS SCRIPT COMPANION (TAB 5)
// ==========================================
async function loadGasCode() {
  try {
    const res = await fetch('/api/gas-code');
    const data = await res.json();
    if (data.success) {
      state.gasCode = data.code;
      document.getElementById('gas-code-preview').innerText = data.code;
    }
  } catch (err) {
    console.warn('Lỗi nạp mã GAS:', err);
  }
}

function copyGasCode(btn) {
  if (!state.gasCode) return;
  navigator.clipboard.writeText(state.gasCode);
  btn.innerText = '✅ ĐÃ SAO CHÉP MÃ NGUỒN';
  setTimeout(() => { btn.innerText = '📋 Sao chép mã nguồn GAS'; }, 2000);
}


// ==========================================
// 9. LOCAL STORAGE PERSISTENCE
// ==========================================
function saveToStorage() {
  try {
    const payload = {
      formMeta: state.formMeta,
      customWeights: state.customWeights,
      constructs: state.constructs,
      reverseItems: state.reverseItems
    };
    localStorage.setItem('formforge_v2_cache', JSON.stringify(payload));
  } catch (e) {}
}

function loadFromStorage() {
  try {
    const saved = localStorage.getItem('formforge_v2_cache');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.formMeta) {
        state.formMeta = parsed.formMeta;
        state.customWeights = parsed.customWeights || {};
        state.constructs = parsed.constructs || {};
        state.reverseItems = parsed.reverseItems || [];

        document.getElementById('form-url-input').value = state.formMeta.url;
        renderSchemaResults(state.formMeta);
        renderWeightsEditor(state.formMeta);
        document.getElementById('schema-results').style.display = 'block';
      }
    }
  } catch (e) {}
}

// Helper
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Initial Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  loadGasCode();
  loadFromStorage();
  updateEtcEstimate();
});
