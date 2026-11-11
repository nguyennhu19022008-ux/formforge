/**
 * FormForge Serverless API Handler for Vercel
 */

import { parseGoogleForm } from '../src/parser.js';
import { generateBatchDataset, datasetToCsv, parseCsvToDataset } from '../src/generator.js';
import { submitSingleResponse, dispatchBatch } from '../src/dispatcher.js';
import { GOOGLE_APPS_SCRIPT_CODE } from '../src/sheets-companion.js';
import { auditFullDataset } from '../src/auditor.js';

const SAMPLE_MOCK_SCHEMA = {
  success: true,
  url: 'https://docs.google.com/forms/d/e/1FAIpQLScMockFormSample2026/viewform',
  formId: '1FAIpQLScMockFormSample2026',
  formAction: 'https://docs.google.com/forms/d/e/1FAIpQLScMockFormSample2026/formResponse',
  title: 'Khảo sát Nghiên cứu Hành vi Khách hàng & Chất lượng Dịch vụ (Đề tài Mẫu)',
  description: 'Đề tài nghiên cứu định lượng khảo sát mức độ hài lòng và lòng trung thành thương hiệu',
  fbzx: '-8492019482019482',
  requiresLogin: false,
  pageCount: 2,
  pageHistory: '0,1',
  sections: [
    { index: 0, title: 'Phần 1: Thông tin nhân khẩu học', questionCount: 2 },
    { index: 1, title: 'Phần 2: Khảo sát mức độ hài lòng', questionCount: 4 }
  ],
  questionCount: 6,
  questions: [
    {
      id: 101,
      entryId: 'entry.101001',
      rawEntryId: '101001',
      title: 'Giới tính của bạn',
      type: 'RADIO',
      sectionIndex: 0,
      sectionTitle: 'Phần 1: Thông tin nhân khẩu học',
      isRequired: true,
      options: ['Nam', 'Nữ']
    },
    {
      id: 102,
      entryId: 'entry.101002',
      rawEntryId: '101002',
      title: 'Độ tuổi của bạn',
      type: 'RADIO',
      sectionIndex: 0,
      sectionTitle: 'Phần 1: Thông tin nhân khẩu học',
      isRequired: true,
      options: ['Dưới 22 tuổi', 'Từ 22 - 30 tuổi', 'Trên 30 tuổi']
    },
    {
      id: 103,
      entryId: 'entry.201001',
      rawEntryId: '201001',
      title: 'HL1: Tôi cảm thấy giao diện và tốc độ phản hồi rất nhanh chóng',
      type: 'SCALE_LIKERT',
      sectionIndex: 1,
      sectionTitle: 'Phần 2: Khảo sát mức độ hài lòng',
      isRequired: true,
      options: ['1', '2', '3', '4', '5']
    },
    {
      id: 104,
      entryId: 'entry.201002',
      rawEntryId: '201002',
      title: 'HL2: Nhân viên hỗ trợ giải đáp nhiệt tình và thỏa đáng',
      type: 'SCALE_LIKERT',
      sectionIndex: 1,
      sectionTitle: 'Phần 2: Khảo sát mức độ hài lòng',
      isRequired: true,
      options: ['1', '2', '3', '4', '5']
    },
    {
      id: 105,
      entryId: 'entry.201003',
      rawEntryId: '201003',
      title: 'TT1: Tôi sẵn sàng tiếp tục sử dụng dịch vụ trong tương lai',
      type: 'SCALE_LIKERT',
      sectionIndex: 1,
      sectionTitle: 'Phần 2: Khảo sát mức độ hài lòng',
      isRequired: true,
      options: ['1', '2', '3', '4', '5']
    },
    {
      id: 106,
      entryId: 'entry.301001',
      rawEntryId: '301001',
      title: 'Ý kiến đóng góp khác để chúng tôi cải thiện dịch vụ',
      type: 'PARAGRAPH',
      sectionIndex: 1,
      sectionTitle: 'Phần 2: Khảo sát mức độ hài lòng',
      isRequired: false,
      options: []
    }
  ]
};

function parseBody(req) {
  if (req.body) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch (e) {
        return {};
      }
    }
    return req.body;
  }
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    // 0. Sample Form
    if (pathname.endsWith('/sample-form') && req.method === 'GET') {
      return sendJson(res, 200, { success: true, formMeta: SAMPLE_MOCK_SCHEMA });
    }

    // 1. POST /api/parse
    if (pathname.endsWith('/parse') && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.url) {
        return sendJson(res, 400, { success: false, error: 'Thiếu tham số url biểu mẫu' });
      }
      if (body.url.includes('MockFormSample2026')) {
        return sendJson(res, 200, { success: true, formMeta: SAMPLE_MOCK_SCHEMA });
      }
      const formMeta = await parseGoogleForm(body.url);
      return sendJson(res, 200, { success: true, formMeta });
    }

    // 2. POST /api/generate
    if (pathname.endsWith('/generate') && req.method === 'POST') {
      const body = await parseBody(req);
      const { questions = [], count = 10, config = {} } = body;
      const result = generateBatchDataset(questions, count, config);
      return sendJson(res, 200, { success: true, ...result });
    }

    // 3. POST /api/audit-dataset
    if (pathname.endsWith('/audit-dataset') && req.method === 'POST') {
      const body = await parseBody(req);
      const { matrix = [], questions = [], constructs = {} } = body;
      const auditReport = auditFullDataset(matrix, questions, constructs);
      return sendJson(res, 200, { success: true, report: auditReport });
    }

    // 4. POST /api/import-csv
    if (pathname.endsWith('/import-csv') && req.method === 'POST') {
      const body = await parseBody(req);
      const { csvContent = '', questions = [] } = body;
      const parsed = parseCsvToDataset(csvContent, questions);
      return sendJson(res, 200, { success: true, ...parsed });
    }

    // 5. POST /api/submit-single
    if (pathname.endsWith('/submit-single') && req.method === 'POST') {
      const body = await parseBody(req);
      const { formAction, payload, fbzx, pageHistory } = body;
      if (formAction && formAction.includes('MockFormSample2026')) {
        return sendJson(res, 200, {
          success: true,
          status: 200,
          statusText: 'OK (Mock Simulated)',
          latencyMs: 150,
          timestamp: new Date().toISOString()
        });
      }
      const result = await submitSingleResponse(formAction, payload, fbzx, pageHistory);
      return sendJson(res, 200, result);
    }

    // 6. POST /api/dispatch-batch
    if (pathname.endsWith('/dispatch-batch') && req.method === 'POST') {
      const body = await parseBody(req);
      const { formAction, batch = [], fbzx, options = {}, pageHistory } = body;
      if (pageHistory && !options.pageHistory) {
        options.pageHistory = pageHistory;
      }
      const result = await dispatchBatch(formAction, batch, fbzx, options);
      return sendJson(res, 200, { success: true, ...result });
    }

    // 7. POST /api/export-csv
    if (pathname.endsWith('/export-csv') && req.method === 'POST') {
      const body = await parseBody(req);
      const { matrix = [] } = body;
      const csv = datasetToCsv(matrix);
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="formforge_dataset.csv"'
      });
      return res.end(csv);
    }

    // 8. GET /api/gas-code
    if (pathname.endsWith('/gas-code') && req.method === 'GET') {
      return sendJson(res, 200, { success: true, code: GOOGLE_APPS_SCRIPT_CODE });
    }

    return sendJson(res, 404, { success: false, error: `Endpoint không tồn tại: ${pathname}` });
  } catch (err) {
    return sendJson(res, 500, { success: false, error: err.message || 'Lỗi xử lý máy chủ' });
  }
}
