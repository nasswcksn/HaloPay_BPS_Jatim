import * as XLSX from 'xlsx';
import { identifySheetRole, processPayrollExcel } from '../utils/etl.ts';

console.log('================================================================');
console.log('  TEST DETEKSI LEMBAR EXCEL (GAJI / TK / 15 / 16)');
console.log('================================================================\n');

function testIdentify(title, allSheets, expectedMap) {
  console.log(`Testing: ${title}`);
  let allPassed = true;
  for (const [sheet, expectedRole] of Object.entries(expectedMap)) {
    const role = identifySheetRole(sheet, allSheets);
    const passed = role === expectedRole;
    if (!passed) allPassed = false;
    console.log(`  [${passed ? 'PASS' : 'FAIL'}] "${sheet}" -> detected as "${role}", expected "${expectedRole}"`);
  }
  if (!allPassed) throw new Error(`Test failed for ${title}`);
  console.log('');
}

// 1. Uji variasi GAJI & TK huruf kapital
testIdentify('Sheet GAJI dan TK (Uppercase)', ['GAJI', 'TK'], {
  'GAJI': 'gaji',
  'TK': 'tk'
});

// 2. Uji variasi Gaji & Tk (Titlecase)
testIdentify('Sheet Gaji dan Tk (Titlecase)', ['Gaji', 'Tk'], {
  'Gaji': 'gaji',
  'Tk': 'tk'
});

// 3. Uji variasi gaji & tk (Lowercase)
testIdentify('Sheet gaji dan tk (Lowercase)', ['gaji', 'tk'], {
  'gaji': 'gaji',
  'tk': 'tk'
});

// 4. Uji file dengan penomoran sheet 15 dan 16
testIdentify('Sheet 15 dan 16 (BPS Monthly)', ['15', '16'], {
  '15': 'gaji',
  '16': 'tk'
});

// 5. Uji file dengan sheet multi 1..16 (hanya 15 dan 16 yang terdeteksi)
testIdentify('Sheet 1..16 (Abaikan sheet 1..14)', ['1', '2', '14', '15', '16'], {
  '1': null,
  '2': null,
  '14': null,
  '15': 'gaji',
  '16': 'tk'
});

// 6. Uji file dengan sheet Rekap, Summary, GAJI, TK
testIdentify('Sheet dengan Rekap/Summary + GAJI & TK', ['Rekap', 'Summary', 'GAJI', 'TK'], {
  'Rekap': null,
  'Summary': null,
  'GAJI': 'gaji',
  'TK': 'tk'
});

async function runWorkbookTests() {
  console.log('Testing End-to-End Workbook 1: Sheets "Gaji", "Tk", "Catatan"');
  const wb1 = XLSX.utils.book_new();
  const wsGaji = XLSX.utils.json_to_sheet([
    {
      'NIP': '198503142009022003',
      'N A M A': 'Rahma Nuryanti',
      'NO. REK.': '1234567890',
      'G A J I (Rp.)': 5000000,
      'S.POKOK': 100000,
      'S.WAJIB': 50000,
    }
  ]);
  XLSX.utils.book_append_sheet(wb1, wsGaji, 'Gaji');

  const wsTK = XLSX.utils.json_to_sheet([
    {
      'NIP': '198503142009022003',
      'N A M A': 'Rahma Nuryanti',
      'NO. REK.': '1234567890',
      'TK': 4000000,
      'TOKO': 50000,
      'Gagal Debet': 200000,
    }
  ]);
  XLSX.utils.book_append_sheet(wb1, wsTK, 'Tk');

  const wsIgnored = XLSX.utils.json_to_sheet([
    { 'Info': 'Catatan Rekap', 'Total': 999999 }
  ]);
  XLSX.utils.book_append_sheet(wb1, wsIgnored, 'Catatan');

  const buf1 = XLSX.write(wb1, { type: 'array', bookType: 'xlsx' });
  const res1 = await processPayrollExcel(buf1, '2026-08');

  console.log(`  Sheets: Gaji -> "${res1.detectedSheets?.gaji}", TK -> "${res1.detectedSheets?.tk}"`);
  console.log(`  Gaji rows: ${res1.gajiList.length}, TK rows: ${res1.tkList.length}`);
  if (res1.detectedSheets?.gaji !== 'Gaji' || res1.detectedSheets?.tk !== 'Tk') {
    throw new Error('Workbook 1 sheet detection failed');
  }
  if (res1.gajiList[0]?.jumlah_diterima !== 4850000) throw new Error('THP Gaji mismatch');
  if (res1.tkList[0]?.jumlah_diterima !== 3950000) throw new Error('THP TK mismatch');

  console.log('\nTesting End-to-End Workbook 2: Sheets "15", "16", "Rekap"');
  const wb2 = XLSX.utils.book_new();
  const ws15 = XLSX.utils.json_to_sheet([
    {
      'NIP': '198503142009022003',
      'NAMA': 'Rahma Nuryanti',
      'GAJI': 6000000,
      'KORPRI': 20000,
    }
  ]);
  XLSX.utils.book_append_sheet(wb2, ws15, '15');

  const ws16 = XLSX.utils.json_to_sheet([
    {
      'NIP': '198503142009022003',
      'NAMA': 'Rahma Nuryanti',
      'TUNJANGAN KINERJA': 5000000,
      'BRG/KOP': 100000,
    }
  ]);
  XLSX.utils.book_append_sheet(wb2, ws16, '16');

  const wsRekap = XLSX.utils.json_to_sheet([
    { 'Rekapitulasi': 'Total Kas' }
  ]);
  XLSX.utils.book_append_sheet(wb2, wsRekap, 'Rekap');

  const buf2 = XLSX.write(wb2, { type: 'array', bookType: 'xlsx' });
  const res2 = await processPayrollExcel(buf2, '2026-08');

  console.log(`  Sheets: Gaji -> "${res2.detectedSheets?.gaji}", TK -> "${res2.detectedSheets?.tk}"`);
  console.log(`  Gaji rows: ${res2.gajiList.length}, TK rows: ${res2.tkList.length}`);
  if (res2.detectedSheets?.gaji !== '15' || res2.detectedSheets?.tk !== '16') {
    throw new Error('Workbook 2 sheet detection failed');
  }
  if (res2.gajiList[0]?.jumlah_diterima !== 5980000) throw new Error('THP Gaji 2 mismatch');
  if (res2.tkList[0]?.jumlah_diterima !== 4900000) throw new Error('THP TK 2 mismatch');

  console.log('\n✅ SEMUA PENGUJIAN WORKBOOK SUKSES!');
}

runWorkbookTests().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
