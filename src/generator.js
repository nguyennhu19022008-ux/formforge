/**
 * FormForge - Synthetic Data & Response Generator (V2 Enhanced)
 * Supports Multi-Factor Structural Covariance (SPSS/SEM), Reverse Coding, and CSV Import.
 */

const SAMPLE_FEEDBACK_TEXTS = [
  'Dịch vụ rất tốt và nhân viên tư vấn nhiệt tình.',
  'Giao diện trực quan, dễ thao tác, tôi hài lòng.',
  'Cần cải thiện thêm thời gian phản hồi vào buổi tối.',
  'Chất lượng sản phẩm tương đối tốt, đúng như kỳ vọng.',
  'Mong hệ thống cập nhật thêm nhiều tính năng mới.',
  'Tôi cảm thấy mức giá hiện tại khá hợp lý.',
  'Trải nghiệm sử dụng nhìn chung mượt mà và ổn định.',
  'Nên bổ sung tài liệu hướng dẫn chi tiết hơn cho người mới.'
];

/**
 * Standard Box-Muller transform for generating normally distributed values
 */
function randomGaussian(mean = 0, stdev = 1) {
  let u1 = 1 - Math.random();
  let u2 = 1 - Math.random();
  let randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
  return mean + stdev * randStdNormal;
}

/**
 * Weighted random choice from options
 */
function pickWeighted(options, weights) {
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

/**
 * Generate a single response payload for all questions with Multi-Factor Covariance
 */
export function generateSingleResponse(questions, config = {}) {
  const payload = {};
  const readableRow = {};

  const {
    mode = 'covariance',
    weights = {},
    constructs = {},       // e.g. { "F1": ["entry.101", "entry.102"], "F2": ["entry.103"] }
    reverseItems = []      // list of entryIds that are reverse-coded
  } = config;

  // 1. Generate latent factor scores for constructs
  // Factor F_k ~ N(0, 1)
  const factorScores = {
    _general: randomGaussian(0, 1)
  };

  const constructKeys = Object.keys(constructs);
  constructKeys.forEach(cName => {
    // Each factor has its own latent score, slightly correlated with general factor
    factorScores[cName] = 0.6 * factorScores._general + 0.8 * randomGaussian(0, 1);
  });

  // Map each entryId to its construct
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
        chosenVal = pickWeighted(q.options, customWeight);
        break;

      case 'CHECKBOX':
        if (q.options.length > 0) {
          const countToSelect = Math.max(1, Math.floor(Math.random() * Math.min(3, q.options.length)));
          const shuffled = [...q.options].sort(() => 0.5 - Math.random());
          chosenVal = shuffled.slice(0, countToSelect);
        }
        break;

      case 'SCALE_LIKERT':
        if (mode === 'covariance') {
          // Identify construct
          const cName = entryToConstruct[entryKey] || '_general';
          const factorVal = factorScores[cName] !== undefined ? factorScores[cName] : factorScores._general;

          // Latent model: Score = Base (3.8) + FactorLoading (0.75) * F + Error (0.35)
          const factorLoading = 0.72 + (Math.random() * 0.15); // Outer loading between 0.72 and 0.87
          const rawScore = 3.85 + (factorLoading * factorVal) + randomGaussian(0, 0.38);

          let score = Math.round(rawScore);
          score = Math.max(1, Math.min(5, score));

          // Reverse coding if flagged: Score_new = 6 - Score
          if (isReverse) {
            score = 6 - score;
          }

          chosenVal = String(score);
        } else {
          const defaultLikertWeights = [5, 10, 25, 35, 25];
          chosenVal = pickWeighted(q.options, customWeight || defaultLikertWeights);
        }
        break;

      case 'SHORT_TEXT':
        chosenVal = `Khảo sát số ${Math.floor(1000 + Math.random() * 9000)}`;
        break;

      case 'PARAGRAPH':
        chosenVal = SAMPLE_FEEDBACK_TEXTS[Math.floor(Math.random() * SAMPLE_FEEDBACK_TEXTS.length)];
        break;

      default:
        chosenVal = q.options && q.options.length > 0 ? q.options[0] : 'N/A';
    }

    payload[entryKey] = chosenVal;
    readableRow[q.title] = Array.isArray(chosenVal) ? chosenVal.join(', ') : chosenVal;
  }

  return { payload, readableRow };
}

/**
 * Generate a batch of N records
 */
export function generateBatchDataset(questions, count = 10, config = {}) {
  const batch = [];
  const matrix = [];

  for (let i = 0; i < count; i++) {
    const { payload, readableRow } = generateSingleResponse(questions, config);
    batch.push(payload);
    matrix.push({
      _id: i + 1,
      ...readableRow
    });
  }

  return {
    count,
    batch,
    matrix
  };
}

/**
 * Export dataset matrix to CSV format
 */
export function datasetToCsv(matrix) {
  if (!matrix || matrix.length === 0) return '';
  const headers = Object.keys(matrix[0]);

  const escapeCell = val => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerRow = headers.map(escapeCell).join(',');
  const dataRows = matrix.map(row => headers.map(h => escapeCell(row[h])).join(','));

  return [headerRow, ...dataRows].join('\r\n');
}

/**
 * Parse an imported CSV string into a dataset matrix and submission batch
 */
export function parseCsvToDataset(csvString, questions = []) {
  const lines = csvString.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('File CSV phải chứa ít nhất 1 dòng tiêu đề và 1 dòng dữ liệu.');
  }

  // Parse CSV header
  const parseRow = line => {
    const result = [];
    let insideQuote = false;
    let current = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
    return result;
  };

  const headers = parseRow(lines[0]);
  const matrix = [];
  const batch = [];

  // Match headers to question titles or entry IDs
  const headerToQuestion = {};
  headers.forEach((h, idx) => {
    const matchedQ = questions.find(q => q.title.trim().toLowerCase() === h.trim().toLowerCase() || q.entryId === h);
    if (matchedQ) {
      headerToQuestion[idx] = matchedQ;
    }
  });

  for (let i = 1; i < lines.length; i++) {
    const rowValues = parseRow(lines[i]);
    const rowObj = { _id: i };
    const payload = {};

    headers.forEach((h, hIdx) => {
      const val = rowValues[hIdx] || '';
      rowObj[h] = val;

      const q = headerToQuestion[hIdx];
      if (q) {
        payload[q.entryId] = val;
      }
    });

    matrix.push(rowObj);
    batch.push(payload);
  }

  return { matrix, batch, totalRows: matrix.length };
}
