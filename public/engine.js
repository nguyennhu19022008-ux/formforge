/**
 * FormForge Client-Side Engine (Universal Standalone Bundle)
 * Enables FormForge to run 100% in-browser and inside Android APK (Capacitor)
 * with zero server dependencies.
 */

// 1. Google Form Parser
async function clientParseGoogleForm(rawUrl) {
  let url = rawUrl.trim();
  if (url.includes('/edit')) {
    url = url.replace(/\/edit.*$/, '/viewform');
  }

  const response = await fetch(url, {
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8'
    },
    redirect: 'follow'
  });

  if (!response.ok) {
    throw new Error(`Không thể tải trang Google Form (HTTP ${response.status}: ${response.statusText})`);
  }

  const html = await response.text();
  const finalUrl = response.url || url;

  let formId = '';
  const idMatch = finalUrl.match(/\/forms\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/);
  if (idMatch) {
    formId = idMatch[1];
  }

  const requiresLogin = html.includes('accounts.google.com/ServiceLogin') || 
                        html.includes('Bắt buộc phải đăng nhập') ||
                        html.includes('Sign in to your Google Account');

  let fbzx = null;
  const fbzxMatch = html.match(/name="fbzx"\s+value="([^"]+)"/) || html.match(/data-fbzx="([^"]+)"/);
  if (fbzxMatch) {
    fbzx = fbzxMatch[1];
  }

  let title = 'Google Form';
  const titleTagMatch = html.match(/<meta property="og:title" content="([^"]+)"/) || html.match(/<title>([^<]+)<\/title>/);
  if (titleTagMatch) {
    title = titleTagMatch[1].replace(/ - Google Biểu mẫu| - Google Forms/, '').trim();
  }

  let description = '';
  const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
  if (descMatch) {
    description = descMatch[1].trim();
  }

  let rawData = null;
  const scriptMarker = 'var FB_PUBLIC_LOAD_DATA_ = ';
  const startIdx = html.indexOf(scriptMarker);

  if (startIdx !== -1) {
    const afterMarker = html.slice(startIdx + scriptMarker.length);
    const endIdx = afterMarker.indexOf(';</script>');
    if (endIdx !== -1) {
      const jsonStr = afterMarker.slice(0, endIdx).trim();
      try {
        rawData = JSON.parse(jsonStr);
      } catch (e) {
        try {
          rawData = new Function(`return ${jsonStr}`)();
        } catch (err) {
          console.warn('Lỗi parse FB_PUBLIC_LOAD_DATA_:', err.message);
        }
      }
    }
  }

  const questions = [];
  let formAction = `https://docs.google.com/forms/d/e/${formId}/formResponse`;
  const formActionMatch = html.match(/<form[^>]+action="([^"]+)"/);
  if (formActionMatch) {
    formAction = formActionMatch[1];
  }

  let currentSectionIndex = 0;
  let currentSectionTitle = 'Phần 1: Khởi đầu';
  const sections = [{ index: 0, title: currentSectionTitle, description: '', questionCount: 0 }];

  if (rawData && Array.isArray(rawData[1]) && Array.isArray(rawData[1][1])) {
    const rawItems = rawData[1][1];

    for (const item of rawItems) {
      if (!Array.isArray(item)) continue;

      const itemId = item[0];
      const qTitle = item[1] || 'Câu hỏi không tiêu đề';
      const qDesc = item[2] || '';
      const typeCode = item[3];
      const payloadMeta = item[4];

      if (typeCode === 8) {
        currentSectionIndex++;
        currentSectionTitle = qTitle || `Phần ${currentSectionIndex + 1}`;
        sections.push({
          index: currentSectionIndex,
          title: currentSectionTitle,
          description: qDesc,
          questionCount: 0
        });
        questions.push({
          type: 'SECTION_HEADER',
          title: currentSectionTitle,
          description: qDesc,
          sectionIndex: currentSectionIndex,
          isSection: true
        });
        continue;
      }

      if (!Array.isArray(payloadMeta) || payloadMeta.length === 0) continue;

      if (typeCode === 7) {
        let colOptions = [];
        if (payloadMeta[0] && Array.isArray(payloadMeta[0][1])) {
          colOptions = payloadMeta[0][1].map(opt => Array.isArray(opt) ? opt[0] : opt).filter(Boolean);
        }
        if (colOptions.length === 0) {
          colOptions = ['1', '2', '3', '4', '5'];
        }

        for (let r = 0; r < payloadMeta.length; r++) {
          const rowMeta = payloadMeta[r];
          if (!rowMeta) continue;
          const entryId = rowMeta[0];
          const isRequired = Boolean(rowMeta[2] === 1);
          let rowLabel = '';
          if (Array.isArray(rowMeta[3]) && rowMeta[3].length > 0) {
            rowLabel = rowMeta[3][0] || '';
          }
          const fullTitle = rowLabel ? `${qTitle} [${rowLabel}]` : `${qTitle} (Hàng ${r + 1})`;

          if (entryId) {
            sections[currentSectionIndex].questionCount++;
            questions.push({
              id: `${itemId}_${r}`,
              entryId: `entry.${entryId}`,
              rawEntryId: entryId,
              title: fullTitle,
              description: qDesc,
              type: 'SCALE_LIKERT',
              typeCode: 7,
              sectionIndex: currentSectionIndex,
              sectionTitle: currentSectionTitle,
              isRequired,
              options: colOptions
            });
          }
        }
        continue;
      }

      const firstMeta = payloadMeta[0];
      const entryId = firstMeta ? firstMeta[0] : null;
      const isRequired = Boolean(firstMeta && firstMeta[2] === 1);

      let questionType = 'TEXT';
      let options = [];

      switch (typeCode) {
        case 0:
          questionType = 'SHORT_TEXT';
          break;
        case 1:
          questionType = 'PARAGRAPH';
          break;
        case 2:
          questionType = 'RADIO';
          if (Array.isArray(firstMeta[1])) {
            options = firstMeta[1].map(opt => Array.isArray(opt) ? opt[0] : opt).filter(Boolean);
          }
          break;
        case 3:
          questionType = 'DROPDOWN';
          if (Array.isArray(firstMeta[1])) {
            options = firstMeta[1].map(opt => Array.isArray(opt) ? opt[0] : opt).filter(Boolean);
          }
          break;
        case 4:
          questionType = 'CHECKBOX';
          if (Array.isArray(firstMeta[1])) {
            options = firstMeta[1].map(opt => Array.isArray(opt) ? opt[0] : opt).filter(Boolean);
          }
          break;
        case 5:
          questionType = 'SCALE_LIKERT';
          if (Array.isArray(firstMeta[3])) {
            const min = firstMeta[3][0] || 1;
            const max = firstMeta[3][1] || 5;
            for (let i = min; i <= max; i++) {
              options.push(String(i));
            }
          } else {
            options = ['1', '2', '3', '4', '5'];
          }
          break;
        default:
          questionType = `OTHER_${typeCode}`;
      }

      if (entryId) {
        sections[currentSectionIndex].questionCount++;
        questions.push({
          id: itemId,
          entryId: `entry.${entryId}`,
          rawEntryId: entryId,
          title: qTitle,
          description: qDesc,
          type: questionType,
          typeCode,
          sectionIndex: currentSectionIndex,
          sectionTitle: currentSectionTitle,
          isRequired,
          options
        });
      }
    }
  }

  const pageCount = sections.length;
  const pageHistory = Array.from({ length: pageCount }, (_, i) => i).join(',');

  return {
    success: true,
    url: finalUrl,
    formId,
    formAction,
    title,
    description,
    fbzx,
    requiresLogin,
    pageCount,
    pageHistory,
    sections,
    questionCount: questions.filter(q => !q.isSection).length,
    questions
  };
}

// 2. Multi-Factor Covariance Data Generator
function clientRandomGaussian(mean = 0, stdev = 1) {
  let u1 = 1 - Math.random();
  let u2 = 1 - Math.random();
  let randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
  return mean + stdev * randStdNormal;
}

function clientPickWeighted(options, weights) {
  if (!options || options.length === 0) return '';
  if (!weights || weights.length !== options.length) {
    return options[Math.floor(Math.random() * options.length)];
  }

  const totalWeight = weights.reduce((sum, w) => sum + (Number(w) || 0), 0);
  if (totalWeight <= 0) return options[0];

  let threshold = Math.random() * totalWeight;
  let running = 0;

  for (let i = 0; i < options.length; i++) {
    running += Number(weights[i]) || 0;
    if (threshold <= running) {
      return options[i];
    }
  }

  return options[options.length - 1];
}

const FEEDBACK_SAMPLES = [
  'Dịch vụ rất tốt và nhân viên tư vấn nhiệt tình.',
  'Giao diện trực quan, dễ thao tác, tôi hài lòng.',
  'Cần cải thiện thêm thời gian phản hồi vào buổi tối.',
  'Chất lượng sản phẩm tương đối tốt, đúng như kỳ vọng.',
  'Mong hệ thống cập nhật thêm nhiều tính năng mới.',
  'Tôi cảm thấy mức giá hiện tại khá hợp lý.',
  'Trải nghiệm sử dụng nhìn chung mượt mà và ổn định.',
  'Nên bổ sung tài liệu hướng dẫn chi tiết hơn cho người mới.'
];

function clientGenerateSingleResponse(questions, config = {}) {
  const payload = {};
  const readableRow = {};

  const {
    mode = 'covariance',
    weights = {},
    constructs = {},
    reverseItems = []
  } = config;

  const factorScores = {
    _general: clientRandomGaussian(0, 1)
  };

  const constructKeys = Object.keys(constructs);
  constructKeys.forEach(cName => {
    factorScores[cName] = 0.6 * factorScores._general + 0.8 * clientRandomGaussian(0, 1);
  });

  const entryToConstruct = {};
  for (const [cName, entryList] of Object.entries(constructs)) {
    if (Array.isArray(entryList)) {
      entryList.forEach(eId => {
        entryToConstruct[eId] = cName;
      });
    }
  }

  for (const q of questions) {
    if (q.isSection) continue;

    const entryKey = q.entryId;
    let chosenVal = '';
    const customWeight = weights[entryKey] || null;
    const isReverse = reverseItems.includes(entryKey);

    switch (q.type) {
      case 'RADIO':
      case 'DROPDOWN':
        chosenVal = clientPickWeighted(q.options, customWeight);
        break;

      case 'CHECKBOX':
        if (customWeight) {
          chosenVal = [clientPickWeighted(q.options, customWeight)];
        } else {
          const selectCount = Math.floor(Math.random() * 2) + 1;
          const shuffled = [...q.options].sort(() => 0.5 - Math.random());
          chosenVal = shuffled.slice(0, selectCount);
        }
        break;

      case 'SCALE_LIKERT':
        if (mode === 'covariance') {
          const construct = entryToConstruct[entryKey];
          const latentScore = construct ? factorScores[construct] : factorScores._general;
          const noise = clientRandomGaussian(0, 0.45);
          const rawScore = 3.6 + 0.85 * latentScore + noise;
          let clampedScore = Math.max(1, Math.min(5, Math.round(rawScore)));

          if (isReverse) {
            clampedScore = 6 - clampedScore;
          }
          chosenVal = String(clampedScore);
        } else {
          chosenVal = clientPickWeighted(q.options, customWeight || [1, 2, 4, 8, 6]);
        }
        break;

      case 'SHORT_TEXT':
      case 'PARAGRAPH':
        chosenVal = FEEDBACK_SAMPLES[Math.floor(Math.random() * FEEDBACK_SAMPLES.length)];
        break;

      default:
        chosenVal = q.options.length > 0 ? q.options[0] : 'Đồng ý';
    }

    payload[entryKey] = chosenVal;
    readableRow[q.title] = Array.isArray(chosenVal) ? chosenVal.join(', ') : chosenVal;
  }

  return { payload, readableRow };
}

function clientGenerateBatchDataset(questions, count = 10, config = {}) {
  const batch = [];
  const matrix = [];
  const { straightLineRate = 0.08 } = config;

  for (let i = 0; i < count; i++) {
    const isStraightLiner = Math.random() < straightLineRate;
    let record;

    if (isStraightLiner) {
      const fixedScore = String(Math.floor(Math.random() * 2) + 4);
      record = clientGenerateSingleResponse(questions, config);
      for (const q of questions) {
        if (q.type === 'SCALE_LIKERT') {
          record.payload[q.entryId] = fixedScore;
          record.readableRow[q.title] = fixedScore;
        }
      }
    } else {
      record = clientGenerateSingleResponse(questions, config);
    }

    batch.push(record.payload);
    matrix.push({ _id: i + 1, ...record.readableRow });
  }

  return { batch, matrix };
}

// 3. Response Dispatcher
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'
];

async function clientSubmitSingleResponse(formAction, payload, fbzx = null, pageHistory = '0') {
  const startTime = Date.now();
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(payload)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        searchParams.append(key, item);
      }
    } else {
      searchParams.append(key, value);
    }
  }

  searchParams.append('fvv', '1');
  searchParams.append('draftResponse', '[]');
  searchParams.append('pageHistory', pageHistory || '0');
  if (fbzx) {
    searchParams.append('fbzx', fbzx);
  }

  const randomUa = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

  try {
    const response = await fetch(formAction, {
      method: 'POST',
      headers: {
        'User-Agent': randomUa,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': formAction.replace('/formResponse', '/viewform'),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      body: searchParams.toString(),
      redirect: 'follow'
    });

    const latencyMs = Date.now() - startTime;
    const isSuccess = response.status === 200 || response.status === 302 || response.type === 'opaque';

    return {
      success: isSuccess,
      status: response.status || 200,
      statusText: response.statusText || 'OK',
      latencyMs,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return {
      success: false,
      status: 0,
      error: err.message,
      latencyMs: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
  }
}

// 4. Psychometric Forensic Auditor
function clientCalculateCronbachAlpha(itemsMatrix) {
  const nRows = itemsMatrix.length;
  if (nRows < 3) return { alpha: 0, k: 0 };

  const k = itemsMatrix[0].length;
  if (k < 2) return { alpha: 1, k };

  const itemVariances = [];
  for (let j = 0; j < k; j++) {
    const vals = itemsMatrix.map(row => Number(row[j]) || 0);
    const mean = vals.reduce((a, b) => a + b, 0) / nRows;
    const variance = vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (nRows - 1);
    itemVariances.push(variance);
  }

  const sumItemVar = itemVariances.reduce((a, b) => a + b, 0);

  const totalScores = itemsMatrix.map(row => row.reduce((sum, v) => sum + (Number(v) || 0), 0));
  const totalMean = totalScores.reduce((a, b) => a + b, 0) / nRows;
  const totalVar = totalScores.reduce((sum, v) => sum + Math.pow(v - totalMean, 2), 0) / (nRows - 1);

  if (totalVar <= 0) return { alpha: 0, k, sumItemVar, totalVar };

  const alpha = (k / (k - 1)) * (1 - (sumItemVar / totalVar));
  return {
    alpha: Math.round(alpha * 1000) / 1000,
    k,
    sumItemVar: Math.round(sumItemVar * 100) / 100,
    totalVar: Math.round(totalVar * 100) / 100
  };
}

function clientAuditFullDataset(dataset, constructs = {}) {
  if (!dataset || dataset.length === 0) {
    return { error: 'Tập dữ liệu rỗng' };
  }

  const sampleRow = dataset[0];
  const keys = Object.keys(sampleRow).filter(k => k !== '_id' && typeof sampleRow[k] !== 'object');

  const numericCols = keys.filter(col => {
    return dataset.every(row => !isNaN(Number(row[col])) && Number(row[col]) >= 1 && Number(row[col]) <= 7);
  });

  if (numericCols.length === 0) {
    return {
      success: true,
      hasScales: false,
      message: 'Không tìm thấy cột thang đo số Likert trong tập dữ liệu'
    };
  }

  const fullNumericMatrix = dataset.map(row => numericCols.map(col => Number(row[col]) || 0));
  const overallAlpha = clientCalculateCronbachAlpha(fullNumericMatrix);

  const constructAlphas = {};
  for (const [cName, entryList] of Object.entries(constructs)) {
    const validCols = numericCols.filter(col => {
      return entryList.some(eId => col.includes(eId) || col.toLowerCase().includes(cName.toLowerCase().slice(0, 2)));
    });

    if (validCols.length >= 2) {
      const cMatrix = dataset.map(row => validCols.map(c => Number(row[c]) || 0));
      constructAlphas[cName] = clientCalculateCronbachAlpha(cMatrix);
    }
  }

  let straightLineCount = 0;
  for (const row of fullNumericMatrix) {
    const firstVal = row[0];
    const isSame = row.every(v => v === firstVal);
    if (isSame) straightLineCount++;
  }
  const straightLineRate = Math.round((straightLineCount / dataset.length) * 1000) / 10;

  return {
    success: true,
    hasScales: true,
    totalRows: dataset.length,
    numericColumnsCount: numericCols.length,
    numericColumns: numericCols,
    overallAlpha: overallAlpha.alpha,
    alphaDetails: overallAlpha,
    constructAlphas,
    straightLineCount,
    straightLineRate,
    forensicFlags: {
      isAlphaTooLow: overallAlpha.alpha < 0.6,
      isAlphaAcceptable: overallAlpha.alpha >= 0.7 && overallAlpha.alpha <= 0.95,
      isAlphaSuspectHigh: overallAlpha.alpha > 0.96,
      isStraightLineHigh: straightLineRate > 25
    }
  };
}

// 5. CSV Helpers
function clientDatasetToCsv(matrix) {
  if (!matrix || matrix.length === 0) return '';
  const headers = Object.keys(matrix[0]);
  const rows = [headers.join(',')];

  for (const row of matrix) {
    const values = headers.map(header => {
      let val = row[header];
      if (val === null || val === undefined) val = '';
      val = String(val).replace(/"/g, '""');
      if (val.includes(',') || val.includes('\n') || val.includes('"')) {
        return `"${val}"`;
      }
      return val;
    });
    rows.push(values.join(','));
  }

  return '\uFEFF' + rows.join('\r\n');
}

// Export to Global Scope
window.FormForgeEngine = {
  parseGoogleForm: clientParseGoogleForm,
  generateBatchDataset: clientGenerateBatchDataset,
  submitSingleResponse: clientSubmitSingleResponse,
  auditFullDataset: clientAuditFullDataset,
  datasetToCsv: clientDatasetToCsv
};
console.log('✅ FormForge Universal Standalone Engine loaded.');
