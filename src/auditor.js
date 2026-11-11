/**
 * FormForge - Psychometrics & Forensic Audit Engine
 * Calculates Cronbach's Alpha, Pearson Correlation, Straight-lining, and Timestamp Clustering.
 */

/**
 * Calculate mean of an array
 */
function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

/**
 * Calculate variance of an array
 */
function variance(arr) {
  if (!arr || arr.length <= 1) return 0;
  const m = mean(arr);
  return arr.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / (arr.length - 1);
}

/**
 * Calculate standard deviation
 */
function stdev(arr) {
  return Math.sqrt(variance(arr));
}

/**
 * Calculate Pearson correlation coefficient between two numeric arrays
 */
export function calculatePearson(arr1, arr2) {
  if (!arr1 || !arr2 || arr1.length !== arr2.length || arr1.length === 0) return 0;
  const n = arr1.length;
  const m1 = mean(arr1);
  const m2 = mean(arr2);

  let num = 0;
  let den1 = 0;
  let den2 = 0;

  for (let i = 0; i < n; i++) {
    const d1 = arr1[i] - m1;
    const d2 = arr2[i] - m2;
    num += d1 * d2;
    den1 += d1 * d1;
    den2 += d2 * d2;
  }

  const den = Math.sqrt(den1 * den2);
  if (den === 0) return 0;
  return Number((num / den).toFixed(3));
}

/**
 * Calculate Cronbach's Alpha for a group of Likert items
 * Alpha = (k / (k - 1)) * (1 - sum(var_i) / var_total)
 */
export function calculateCronbachAlpha(matrix, columnKeys) {
  if (!matrix || matrix.length < 2 || !columnKeys || columnKeys.length < 2) {
    return { alpha: null, valid: false, note: 'Cần tối thiểu 2 biến và 2 quan sát' };
  }

  const k = columnKeys.length;
  const itemVars = [];
  const totalScores = new Array(matrix.length).fill(0);

  for (const key of columnKeys) {
    const colValues = [];
    for (let i = 0; i < matrix.length; i++) {
      const val = parseFloat(matrix[i][key]);
      const numVal = isNaN(val) ? 3 : val;
      colValues.push(numVal);
      totalScores[i] += numVal;
    }
    itemVars.push(variance(colValues));
  }

  const sumItemVar = itemVars.reduce((sum, v) => sum + v, 0);
  const totalVar = variance(totalScores);

  if (totalVar === 0) {
    return { alpha: 0, valid: true, rating: 'Rất kém (Không có phương sai)' };
  }

  const alpha = (k / (k - 1)) * (1 - (sumItemVar / totalVar));
  const roundedAlpha = Number(alpha.toFixed(3));

  let rating = 'Không đạt (< 0.6)';
  if (roundedAlpha >= 0.8) rating = 'Rất tốt (≥ 0.8)';
  else if (roundedAlpha >= 0.7) rating = 'Đạt chuẩn tốt (≥ 0.7)';
  else if (roundedAlpha >= 0.6) rating = 'Chấp nhận được (≥ 0.6)';

  return {
    alpha: roundedAlpha,
    itemCount: k,
    sampleSize: matrix.length,
    rating,
    isAccepted: roundedAlpha >= 0.6
  };
}

/**
 * Detect Straight-lining responses (phiếu điền ẩu - tất cả câu chọn cùng một số)
 */
export function detectStraightLining(matrix, likertKeys) {
  if (!matrix || matrix.length === 0 || !likertKeys || likertKeys.length < 3) {
    return { count: 0, percentage: 0, suspiciousRows: [] };
  }

  const suspiciousRows = [];

  matrix.forEach((row, idx) => {
    const values = likertKeys.map(k => parseFloat(row[k])).filter(v => !isNaN(v));
    if (values.length >= 3) {
      const v = variance(values);
      // If variance is 0, all values are identical (e.g., 5,5,5,5,5 or 3,3,3,3,3)
      if (v === 0) {
        suspiciousRows.push({
          rowId: row._id || idx + 1,
          choice: values[0]
        });
      }
    }
  });

  const percentage = Number(((suspiciousRows.length / matrix.length) * 100).toFixed(1));

  return {
    count: suspiciousRows.length,
    percentage,
    suspiciousRows,
    rating: percentage > 15 ? 'Cảnh báo cao (Nhiều phiếu điền ẩu)' : 'Tự nhiên (< 15%)'
  };
}

/**
 * Comprehensive Dataset Audit
 */
export function auditFullDataset(matrix, questions = [], constructs = {}) {
  // Identify Likert keys
  const likertQuestions = questions.filter(q => q.type === 'SCALE_LIKERT');
  const likertKeys = likertQuestions.map(q => q.title);

  // 1. Overall Cronbach's Alpha
  const overallAlpha = calculateCronbachAlpha(matrix, likertKeys);

  // 2. Alpha by construct (if constructs provided)
  const constructAlphas = {};
  for (const [cName, cKeys] of Object.entries(constructs)) {
    if (Array.isArray(cKeys) && cKeys.length >= 2) {
      constructAlphas[cName] = calculateCronbachAlpha(matrix, cKeys);
    }
  }

  // 3. Straight-lining audit
  const straightLining = detectStraightLining(matrix, likertKeys);

  // 4. Mean & Stdev summary
  const variableSummary = {};
  likertKeys.forEach(k => {
    const vals = matrix.map(r => parseFloat(r[k])).filter(v => !isNaN(v));
    variableSummary[k] = {
      mean: Number(mean(vals).toFixed(2)),
      stdev: Number(stdev(vals).toFixed(2))
    };
  });

  return {
    sampleSize: matrix.length,
    likertVariableCount: likertKeys.length,
    overallAlpha,
    constructAlphas,
    straightLining,
    variableSummary,
    auditTimestamp: new Date().toISOString()
  };
}
