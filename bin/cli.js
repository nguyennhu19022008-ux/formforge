#!/usr/bin/env node

/**
 * FormForge CLI - Automated Google Form Inspector & Response Engine
 */

import { parseGoogleForm } from '../src/parser.js';
import { generateBatchDataset, datasetToCsv } from '../src/generator.js';
import { dispatchBatch } from '../src/dispatcher.js';
import fs from 'node:fs';

const SAMPLE_MOCK_QUESTIONS = [
  {
    id: 101,
    entryId: 'entry.101001',
    title: 'Giới tính của bạn',
    type: 'RADIO',
    isRequired: true,
    options: ['Nam', 'Nữ']
  },
  {
    id: 102,
    entryId: 'entry.101002',
    title: 'Độ tuổi của bạn',
    type: 'RADIO',
    isRequired: true,
    options: ['Dưới 22 tuổi', 'Từ 22 - 30 tuổi', 'Trên 30 tuổi']
  },
  {
    id: 103,
    entryId: 'entry.201001',
    title: 'HL1: Giao diện và tốc độ phản hồi nhanh',
    type: 'SCALE_LIKERT',
    isRequired: true,
    options: ['1', '2', '3', '4', '5']
  },
  {
    id: 104,
    entryId: 'entry.201002',
    title: 'HL2: Nhân viên hỗ trợ giải đáp thỏa đáng',
    type: 'SCALE_LIKERT',
    isRequired: true,
    options: ['1', '2', '3', '4', '5']
  },
  {
    id: 105,
    entryId: 'entry.301001',
    title: 'Ý kiến góp ý khác',
    type: 'PARAGRAPH',
    isRequired: false,
    options: []
  }
];

function printBanner() {
  console.log(`
========================================================================
  FORMFORGE /// REVERSE-ENGINEERED AUTOMATION ENGINE
  Google Form Schema Inspector, Response Synthesizer & Dispatcher
========================================================================
`);
}

function printUsage() {
  console.log(`
Cách sử dụng:
  node bin/cli.js --url "https://docs.google.com/..." [options]
  node bin/cli.js --sample  (Chạy thử nghiệm ngay với dữ liệu mẫu)

Các tùy chọn:
  --url <url>            Đường dẫn Google Form (dạng /viewform hoặc /edit)
  --sample               Chạy thử nghiệm ngay với biểu mẫu khảo sát mẫu tích hợp sẵn
  --count <num>          Số lượng phản hồi cần tạo (mặc định: 5)
  --mode <mode>          Chế độ thực thi:
                           'dry-run'   : Bóc tách schema và sinh ma trận CSV xem trước (không gửi)
                           'instant'   : Gửi toàn bộ phiếu lập tức qua HTTP POST (mặc định)
                           'throttled' : Gửi rải rác mô phỏng thời gian người thật
                           'parallel'  : Bơm hàng loạt song song đa luồng
  --concurrency <num>    Số luồng gửi đồng thời (mặc định: 1, tối ưu: 5 - 20)
  --export <file>        Xuất bộ dữ liệu ma trận ra file CSV (vd: dataset.csv)
  --help                 Hiển thị hướng dẫn này

Ví dụ thực tế:
  node bin/cli.js --sample --count 50 --concurrency 10
  node bin/cli.js --url "https://docs.google.com/..." --count 100 --mode parallel --concurrency 15
`);
}

async function main() {
  printBanner();
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const getArg = flag => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  };

  const isSample = args.includes('--sample') || args.includes('--mock');
  const rawUrl = getArg('--url');
  const count = parseInt(getArg('--count') || '5', 10);
  const mode = getArg('--mode') || 'instant';
  const concurrency = parseInt(getArg('--concurrency') || getArg('--parallel') || '1', 10);
  const exportPath = getArg('--export');

  let formMeta;

  if (isSample || (rawUrl && (rawUrl.includes('<') || rawUrl.includes('sample')))) {
    console.log('💡 Đang chạy ở chế độ MẪU THỬ NGHIỆM TÍCH HỢP SẴN (--sample)...');
    formMeta = {
      title: 'Khảo sát Nghiên cứu Hành vi Khách hàng (Đề tài Mẫu)',
      questionCount: SAMPLE_MOCK_QUESTIONS.length,
      requiresLogin: false,
      formAction: 'https://docs.google.com/forms/d/e/SAMPLE_MOCK_ACTION/formResponse',
      fbzx: '-8492019482019482',
      questions: SAMPLE_MOCK_QUESTIONS
    };
  } else {
    if (!rawUrl) {
      console.error('❌ Lỗi: Bạn chưa cung cấp --url hoặc --sample.');
      console.error('👉 Gõ: node bin/cli.js --sample  để chạy thử nghiệm ngay.');
      process.exit(1);
    }

    if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
      console.error(`❌ Lỗi: Đường dẫn URL không hợp lệ: "${rawUrl}"`);
      console.error('👉 URL phải bắt đầu bằng https://docs.google.com/forms/...');
      process.exit(1);
    }

    console.log(`🔍 [1/4] Đang phân tích biểu mẫu: ${rawUrl}`);
    try {
      formMeta = await parseGoogleForm(rawUrl);
    } catch (err) {
      console.error(`❌ Lỗi khi phân tích biểu mẫu: ${err.message}`);
      process.exit(1);
    }
  }

  console.log(`✅ Tiêu đề biểu mẫu : "${formMeta.title}"`);
  console.log(`📝 Số câu hỏi tìm thấy: ${formMeta.questionCount}`);
  console.log(`🔒 Yêu cầu đăng nhập  : ${formMeta.requiresLogin ? 'BẬT (CẢNH BÁO: Cần quyền Edit để tắt)' : 'TẮT (Sẵn sàng submit)'}`);
  console.log(`🎯 Endpoint nhận data : ${formMeta.formAction}\n`);

  console.log('--- DANH SÁCH ENTRY ID ĐƯỢC BÓC TÁCH ---');
  formMeta.questions.forEach((q, idx) => {
    if (q.isSection) {
      console.log(`  [Mục ${idx + 1}] ${q.title}`);
    } else {
      console.log(`  [${q.entryId}] [${q.type}] ${q.title} (${q.options.length} lựa chọn)`);
    }
  });
  console.log('----------------------------------------\n');

  console.log(`⚙️ [2/4] Đang sinh bộ dữ liệu ma trận (${count} bản ghi)...`);
  const { batch, matrix } = generateBatchDataset(formMeta.questions, count, { mode: 'covariance' });
  console.log(`✅ Đã sinh thành công ${batch.length} ma trận câu trả lời đạt chuẩn tương quan SPSS.`);

  if (exportPath) {
    const csvContent = datasetToCsv(matrix);
    fs.writeFileSync(exportPath, csvContent, 'utf-8');
    console.log(`💾 Đã xuất file CSV tại: ${exportPath}`);
  }

  if (mode === 'dry-run' || isSample) {
    console.log('\n💡 Chế độ KIỂM THỬ XEM TRƯỚC (DRY-RUN):');
    console.log('Mẫu bản ghi số 1:');
    console.log(JSON.stringify(matrix[0], null, 2));
    if (isSample) {
      console.log('\n🎉 Chạy thử nghiệm thành công! Bạn có thể dùng cờ --export để xuất file CSV.');
    }
    process.exit(0);
  }

  if (formMeta.requiresLogin) {
    console.error('\n⚠️ CẢNH BÁO NGUY CƠ: Form này đang bật "Bắt buộc đăng nhập Google".');
    console.error('Mọi request ẩn danh sẽ bị Google chặn. Hãy dùng link /edit để tắt "Giới hạn 1 câu trả lời" trước.');
  }

  console.log(`\n🚀 [3/4] Đang bắt đầu phát dữ liệu (Chế độ: ${mode.toUpperCase()} | Luồng song song: ${concurrency})...`);

  const dispatchResult = await dispatchBatch(
    formMeta.formAction,
    batch,
    formMeta.fbzx,
    {
      mode,
      concurrency,
      pageHistory: formMeta.pageHistory || '0',
      minDelayMs: 800,
      maxDelayMs: 2500
    },
    item => {
      const statusIcon = item.success ? '✅' : '❌';
      const workerPrefix = item.workerId ? `[Luồng ${item.workerId}] ` : '';
      console.log(`  ${statusIcon} ${workerPrefix}[${item.index}/${item.total}] HTTP ${item.status} - Độ trễ: ${item.latencyMs}ms`);
    }
  );

  console.log(`\n🏁 [4/4] Hoàn tất quá trình gửi phiếu:`);
  console.log(`  - Thành công: ${dispatchResult.successCount} / ${dispatchResult.total}`);
  console.log(`  - Thất bại  : ${dispatchResult.failureCount} / ${dispatchResult.total}`);
}

main().catch(err => {
  console.error('❌ Lỗi hệ thống:', err);
  process.exit(1);
});
