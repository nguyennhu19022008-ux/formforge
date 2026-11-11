/**
 * Test Multi-Section & Multi-Page Parsing and Submission
 */
import { generateBatchDataset } from './src/generator.js';

const mockMultiSectionQuestions = [
  {
    id: 1,
    entryId: 'entry.1001',
    rawEntryId: '1001',
    title: 'Câu 1 - Phần 1',
    type: 'RADIO',
    sectionIndex: 0,
    sectionTitle: 'Phần 1: Thông tin cơ bản',
    options: ['A', 'B']
  },
  {
    id: 2,
    entryId: 'entry.1002',
    rawEntryId: '1002',
    title: 'Câu 2 - Phần 1',
    type: 'RADIO',
    sectionIndex: 0,
    sectionTitle: 'Phần 1: Thông tin cơ bản',
    options: ['C', 'D']
  },
  {
    id: 3,
    entryId: 'entry.2001',
    rawEntryId: '2001',
    title: 'Câu 3 - Phần 2',
    type: 'SCALE_LIKERT',
    sectionIndex: 1,
    sectionTitle: 'Phần 2: Đánh giá chi tiết',
    options: ['1', '2', '3', '4', '5']
  },
  {
    id: 4,
    entryId: 'entry.2002',
    rawEntryId: '2002',
    title: 'Câu 4 - Phần 2',
    type: 'SCALE_LIKERT',
    sectionIndex: 1,
    sectionTitle: 'Phần 2: Đánh giá chi tiết',
    options: ['1', '2', '3', '4', '5']
  }
];

console.log('Testing Multi-Section Dataset Generation...');
const { batch, matrix } = generateBatchDataset(mockMultiSectionQuestions, 5, { mode: 'covariance' });

console.log(`Generated ${batch.length} records.`);
const record1 = batch[0];
console.log('Record 1 Keys:', Object.keys(record1));

const hasPart1 = 'entry.1001' in record1 && 'entry.1002' in record1;
const hasPart2 = 'entry.2001' in record1 && 'entry.2002' in record1;

console.log('Has Section 1 Questions:', hasPart1);
console.log('Has Section 2 Questions:', hasPart2);

if (hasPart1 && hasPart2) {
  console.log('✅ TEST PASSED: All questions across both Section 1 and Section 2 are populated!');
} else {
  console.error('❌ TEST FAILED: Missing questions!');
  process.exit(1);
}
