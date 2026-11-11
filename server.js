/**
 * FormForge Server - Built with native Node.js HTTP (Zero external dependencies)
 * With Auto-Port Fallback, Psychometric Auditing & CSV Dataset Import
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseGoogleForm } from './src/parser.js';
import { generateBatchDataset, datasetToCsv, parseCsvToDataset } from './src/generator.js';
import { submitSingleResponse, dispatchBatch } from './src/dispatcher.js';
import { GOOGLE_APPS_SCRIPT_CODE } from './src/sheets-companion.js';
import { auditFullDataset } from './src/auditor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_PORT = parseInt(process.env.PORT || '3000', 10);
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

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

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload quá lớn (Giới hạn 10MB)'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('JSON không hợp lệ: ' + e.message));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // API ROUTING
  if (pathname.startsWith('/api/')) {
    try {
      // GET /api/sample-form (Mock test schema)
      if (pathname === '/api/sample-form' && req.method === 'GET') {
        return sendJson(res, 200, { success: true, formMeta: SAMPLE_MOCK_SCHEMA });
      }

      // 1. POST /api/parse
      if (pathname === '/api/parse' && req.method === 'POST') {
        const body = await parseJsonBody(req);
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
      if (pathname === '/api/generate' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const { questions = [], count = 10, config = {} } = body;
        const result = generateBatchDataset(questions, count, config);
        return sendJson(res, 200, { success: true, ...result });
      }

      // 3. POST /api/audit-dataset
      if (pathname === '/api/audit-dataset' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const { matrix = [], questions = [], constructs = {} } = body;
        const auditReport = auditFullDataset(matrix, questions, constructs);
        return sendJson(res, 200, { success: true, report: auditReport });
      }

      // 4. POST /api/import-csv
      if (pathname === '/api/import-csv' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const { csvContent = '', questions = [] } = body;
        const parsed = parseCsvToDataset(csvContent, questions);
        return sendJson(res, 200, { success: true, ...parsed });
      }

      // 5. POST /api/submit-single
      if (pathname === '/api/submit-single' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const { formAction, payload, fbzx, pageHistory } = body;

        if (formAction && formAction.includes('MockFormSample2026')) {
          await new Promise(r => setTimeout(r, Math.floor(120 + Math.random() * 200)));
          return sendJson(res, 200, {
            success: true,
            status: 200,
            statusText: 'OK (Mock Simulated)',
            latencyMs: Math.floor(120 + Math.random() * 150),
            timestamp: new Date().toISOString()
          });
        }

        const result = await submitSingleResponse(formAction, payload, fbzx, pageHistory);
        return sendJson(res, 200, result);
      }

      // 6. POST /api/dispatch-batch
      if (pathname === '/api/dispatch-batch' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const { formAction, batch = [], fbzx, options = {}, pageHistory } = body;
        if (pageHistory && !options.pageHistory) {
          options.pageHistory = pageHistory;
        }
        const result = await dispatchBatch(formAction, batch, fbzx, options);
        return sendJson(res, 200, { success: true, ...result });
      }

      // 7. POST /api/export-csv
      if (pathname === '/api/export-csv' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const { matrix = [] } = body;
        const csv = datasetToCsv(matrix);
        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="formforge_dataset.csv"'
        });
        return res.end(csv);
      }

      // 8. GET /api/gas-code
      if (pathname === '/api/gas-code' && req.method === 'GET') {
        return sendJson(res, 200, { success: true, code: GOOGLE_APPS_SCRIPT_CODE });
      }

      return sendJson(res, 404, { success: false, error: 'Endpoint API không tồn tại' });
    } catch (err) {
      console.error('API Error:', err);
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // STATIC FILE SERVING
  let safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403 Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexPath, (err2, content) => {
        if (err2) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end('404 Not Found');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

/**
 * Intelligent Port Binding with Fallback
 */
function startServer(port) {
  server.listen(port, () => {
    console.log(`
========================================================================
  FORMFORGE STUDIO ĐANG CHẠY THÀNH CÔNG
  Địa chỉ truy cập : http://localhost:${port}
  Môi trường Node.js: ${process.version} (Native Zero-Dependency)
========================================================================
    `);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const nextPort = server.address() ? server.address().port + 1 : DEFAULT_PORT + 1;
    console.warn(`⚠️ Cổng ${DEFAULT_PORT} đang bận, tự động chuyển sang cổng: ${nextPort}...`);
    setTimeout(() => {
      startServer(nextPort);
    }, 500);
  } else {
    console.error('❌ Lỗi máy chủ:', err.message);
  }
});

startServer(DEFAULT_PORT);
