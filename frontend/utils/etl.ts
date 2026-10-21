import * as XLSX from 'xlsx';

export interface EmployeeMasterPayload {
  nip: string;
  nama: string;
  no_rekening: string;
}

export interface GajiPayload {
  nip: string;
  nama?: string;
  periode: string;
  gaji_bruto: number;
  simpanan_pokok: number;
  simpanan_sukarela: number;
  simpanan_wajib: number;
  iuran_dwp: number;
  iuran_korpri: number;
  potongan_pinjaman_koperasi: number;
  jumlah_diterima: number;
}

export interface TKPayload {
  nip: string;
  nama?: string;
  periode: string;
  tunjangan_kinerja: number;
  simpanan_sukarela: number;
  potongan_toko: number;
  potongan_barang_koperasi: number;
  potongan_pinjaman_koperasi: number;
  potongan_pinjaman_dwp: number;
  potongan_untalan: number;
  potongan_arisan_dwp: number;
  potongan_gagal_debet: number;
  jumlah_diterima: number;
}

export interface ParsedETLResult {
  karyawanList: EmployeeMasterPayload[];
  gajiList: GajiPayload[];
  tkList: TKPayload[];
  detectedSheets?: {
    gaji?: string;
    tk?: string;
  };
  summary: {
    totalEmployees: number;
    totalGajiRows: number;
    totalTKRows: number;
    totalGajiBruto: number;
    totalGajiDiterima: number;
    totalTKBruto: number;
    totalTKDiterima: number;
  };
}

/**
 * Memastikan nilai angka terbebas dari format teks strip, spasi, pemisah ribuan titik/koma, atau undefined.
 * Mendukung format akuntansi Indonesia (titik ribuan, koma desimal) maupun internasional (koma ribuan, titik desimal),
 * serta awalan seperti 'Rp.', 'Rp', 'IDR', dsb.
 */
export const parseNumeric = (val: any): number => {
  if (val === null || val === undefined || val === '-' || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val);

  let str = String(val).trim();
  if (str === '-' || str === '') return 0;

  // Deteksi nilai negatif (misal '-300.000' atau format akuntansi '(300.000)')
  const isNegative = str.startsWith('-') || (str.startsWith('(') && str.endsWith(')'));

  // Bersihkan teks awalan mata uang seperti Rp., Rp, IDR dsb secara eksplisit
  str = str.replace(/Rp\.?/gi, '').replace(/IDR/gi, '').trim();

  // Bersihkan karakter selain angka, titik, dan koma
  str = str.replace(/[^0-9.,]/g, '');
  // Bersihkan titik atau koma yang tidak sengaja berada di paling depan atau belakang
  str = str.replace(/^[.,]+|[.,]+$/g, '');
  if (!str) return 0;

  let result = 0;
  const hasDot = str.includes('.');
  const hasComma = str.includes(',');

  if (hasDot && hasComma) {
    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Format Indo/Eropa: 1.500.000,00 atau 300.000,00
      const afterComma = str.slice(lastComma + 1);
      if (afterComma.length === 3) {
        // Kasus khusus pemisah ribuan campur: buang semua titik dan koma
        result = parseInt(str.replace(/[.,]/g, ''), 10);
      } else {
        const withoutThousand = str.slice(0, lastComma).replace(/\./g, '');
        result = parseFloat(withoutThousand + '.' + afterComma);
      }
    } else {
      // Format US: 1,500,000.00 atau 300,000.00
      const afterDot = str.slice(lastDot + 1);
      if (afterDot.length === 3) {
        result = parseInt(str.replace(/[.,]/g, ''), 10);
      } else {
        const withoutThousand = str.slice(0, lastDot).replace(/,/g, '');
        result = parseFloat(withoutThousand + '.' + afterDot);
      }
    }
  } else if (hasDot) {
    const parts = str.split('.');
    if (parts.length > 2) {
      // Multi dot: 1.500.000 -> pemisah ribuan
      result = parseInt(parts.join(''), 10);
    } else {
      // Single dot: 300.000 vs 300.00 vs 300.5
      const dec = parts[1];
      if (dec.length === 3) {
        // Tepat 3 digit di belakang titik adalah pemisah ribuan di Indonesia: 300.000 -> 300000
        result = parseInt(parts.join(''), 10);
      } else {
        result = parseFloat(str);
      }
    }
  } else if (hasComma) {
    const parts = str.split(',');
    if (parts.length > 2) {
      // Multi comma: 1,500,000 -> pemisah ribuan
      result = parseInt(parts.join(''), 10);
    } else {
      // Single comma: 300,000 vs 300,00
      const dec = parts[1];
      if (dec.length === 3) {
        // Tepat 3 digit di belakang koma adalah pemisah ribuan: 300,000 -> 300000
        result = parseInt(parts.join(''), 10);
      } else {
        result = parseFloat(parts[0] + '.' + dec);
      }
    }
  } else {
    result = parseInt(str, 10);
  }

  if (isNaN(result)) return 0;
  result = Math.round(result);
  return isNegative ? -result : result;
};

/**
 * Mengonversi NIP berformat desimal / notasi ilmiah ke string 18 digit presisi.
 */
export const parseNIP = (val: any): string => {
  if (!val) return '';
  const str = String(val).trim();
  if (str.includes('e+') || str.includes('E+') || str.includes('.')) {
    const num = Math.floor(Number(str));
    return String(num).padStart(18, '0');
  }
  return str.padStart(18, '0');
};

/**
 * Format mata uang Rupiah standar Indonesia.
 */
export const formatRupiah = (val: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val || 0);
};

/**
 * Mencari nilai pada baris objek Excel berdasarkan kecocokan nama kunci (case-insensitive & spasi toleran).
 */
export function findRowValue(row: any, ...keys: string[]): any {
  if (!row) return undefined;
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== '') return row[k];
  }
  const rowEntries = Object.entries(row);
  for (const k of keys) {
    const normalizedKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const [rk, rv] of rowEntries) {
      if (rv !== undefined && rv !== '') {
        const normalizedRk = rk.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalizedRk === normalizedKey) {
          return rv;
        }
      }
    }
  }
  return undefined;
}

/**
 * Mengidentifikasi peran sheet spreadsheet:
 * - 'gaji': Bernama "GAJI", "Gaji", "gaji", atau mengandung "gaji", ATAU sheet "15" jika workbook menggunakan penomoran 15/16.
 * - 'tk': Bernama "TK", "tk", "Tk", atau mengandung "tk"/"tukin", ATAU sheet "16" jika workbook menggunakan penomoran 15/16.
 * - null: Sheet lain di luar kriteria di atas (diabaikan secara ketat).
 */
export function identifySheetRole(
  sheetName: string,
  allSheetNames: string[]
): 'gaji' | 'tk' | null {
  const clean = sheetName.trim();
  const lower = clean.toLowerCase();

  // Cek apakah ada sheet eksplisit GAJI / TK di workbook
  const hasExplicitGaji = allSheetNames.some((s) => {
    const l = s.trim().toLowerCase();
    return l === 'gaji' || l.startsWith('gaji') || l.includes('gaji');
  });

  const hasExplicitTK = allSheetNames.some((s) => {
    const l = s.trim().toLowerCase();
    return l === 'tk' || l.startsWith('tk') || l.includes('tk') || l.includes('tukin');
  });

  // 1. Prioritas Utama: Penamaan lembar GAJI (GAJI, Gaji, gaji)
  if (lower === 'gaji' || lower.startsWith('gaji') || lower.includes('gaji')) {
    return 'gaji';
  }

  // 2. Prioritas Utama: Penamaan lembar TK (TK, tk, Tk)
  if (lower === 'tk' || lower.startsWith('tk') || lower.includes('tk') || lower.includes('tukin')) {
    return 'tk';
  }

  // 3. Dukungan sheet 15 dan 16 (format bulanan tertentu)
  const hasSheet15 = allSheetNames.some((s) => s.trim() === '15');
  const hasSheet16 = allSheetNames.some((s) => s.trim() === '16');

  if (clean === '15' && (hasSheet15 && (hasSheet16 || !hasExplicitGaji))) {
    return 'gaji';
  }

  if (clean === '16' && (hasSheet16 && (hasSheet15 || !hasExplicitTK))) {
    return 'tk';
  }

  // Sheet lain tidak dikenali sebagai target penggajian
  return null;
}

/**
 * Mesin utama pemroses berkas spreadsheet Excel ke payload Database.
 * Mengikuti spesifikasi PRD Bagian 5 dan pembaruan identifikasi sheet.
 */

export const processPayrollExcel = async (
  fileBuffer: ArrayBuffer,
  selectedPeriode: string // Format 'YYYY-MM'
): Promise<ParsedETLResult> => {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const masterKaryawan = new Map<string, EmployeeMasterPayload>();
  const gajiList: GajiPayload[] = [];
  const tkList: TKPayload[] = [];
  const detectedSheets: { gaji?: string; tk?: string } = {};

  for (const sheetName of workbook.SheetNames) {
    const role = identifySheetRole(sheetName, workbook.SheetNames);

    // HANYA proses sheet yang diidentifikasi sebagai 'gaji' atau 'tk'
    if (!role) {
      continue;
    }

    const worksheet = workbook.Sheets[sheetName];
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    if (rawData.length === 0) continue;

    if (role === 'gaji') {
      detectedSheets.gaji = sheetName;
    } else if (role === 'tk') {
      detectedSheets.tk = sheetName;
    }

    rawData.forEach((row) => {
      const rawNIP = findRowValue(row, 'NIP', 'nip', 'Nip');
      if (!rawNIP) return;

      const nip = parseNIP(rawNIP);
      if (!nip || nip === '000000000000000000') return;

      const nama = String(findRowValue(row, 'N A M A', 'NAMA', 'Nama', 'nama') || '').trim();
      const rawRek = String(
        findRowValue(
          row,
          'NO. REK./GIRO BANK MANDIRI',
          'NO. REK.',
          'NO REKENING',
          'No. Rekening',
          'NO REK',
          'no_rekening'
        ) || ''
      ).trim();
      const noRekening = rawRek.replace('.0', '') || '-';

      // 1. Ekstraksi Master Karyawan (UPSERT Target)
      if (nip && nama && !masterKaryawan.has(nip)) {
        masterKaryawan.set(nip, { nip, nama, no_rekening: noRekening });
      }

      // 2. Ekstraksi Transaksi Lembar Gaji
      if (role === 'gaji') {
        const gajiBruto = parseNumeric(
          findRowValue(row, 'G A J I (Rp.)', 'GAJI (Rp.)', 'GAJI BRUTO', 'GAJI', 'gaji', 'Gaji')
        );
        const sPokok = parseNumeric(
          findRowValue(row, 'S.POKOK', 'S POKOK', 'SIMPANAN POKOK', 's_pokok')
        );
        const sRela = parseNumeric(
          findRowValue(row, 'S. RELA', 'S.RELA', 'S RELA', 'SIMPANAN SUKARELA', 's_sukarela')
        );
        const sWajib = parseNumeric(
          findRowValue(row, 'S.WAJIB', 'S WAJIB', 'SIMPANAN WAJIB', 's_wajib')
        );
        const iuranDwp = parseNumeric(
          findRowValue(row, 'IURAN DWP', 'DWP', 'iuran_dwp')
        );
        const iuranKorpri = parseNumeric(
          findRowValue(row, 'KORPRI', 'IURAN KORPRI', 'korpri')
        );
        const sPinjamKop = parseNumeric(
          findRowValue(row, 'S.Pinjam Kop', 'PINJAMAN KOPERASI', 'S.PINJAM KOP', 'S.Pinjam(Kop)', 'pinjaman_koperasi')
        );

        const totalPotongan = sPokok + sRela + sWajib + iuranDwp + iuranKorpri + sPinjamKop;
        const thpGaji = gajiBruto - totalPotongan;

        gajiList.push({
          nip,
          nama,
          periode: selectedPeriode,
          gaji_bruto: gajiBruto,
          simpanan_pokok: sPokok,
          simpanan_sukarela: sRela,
          simpanan_wajib: sWajib,
          iuran_dwp: iuranDwp,
          iuran_korpri: iuranKorpri,
          potongan_pinjaman_koperasi: sPinjamKop,
          jumlah_diterima: thpGaji,
        });
      }

      // 3. Ekstraksi Transaksi Lembar Tunjangan Kinerja (TK)
      if (role === 'tk') {
        const tkBruto = parseNumeric(
          findRowValue(row, 'TK', 'TUNJANGAN KINERJA', 'Tunjangan Kinerja', 'tukin', 'TUKIN')
        );
        const sRela = parseNumeric(
          findRowValue(row, 'S. RELA', 'S.RELA', 'S RELA', 'SIMPANAN SUKARELA')
        );
        const toko = parseNumeric(
          findRowValue(row, 'TOKO', 'POTONGAN TOKO', 'Toko')
        );
        const brgKop = parseNumeric(
          findRowValue(row, 'BRG/KOP', 'BARANG KOPERASI', 'Brg/Kop', 'BRG / KOP')
        );
        const sPinjamKop = parseNumeric(
          findRowValue(row, 'S.Pinjam(Kop)', 'S.Pinjam Kop', 'PINJAMAN KOPERASI', 'S.PINJAM KOP')
        );
        const sPnjmDwp = parseNumeric(
          findRowValue(row, 'S.Pnjm D.W.P', 'PINJAMAN DWP', 'S.Pnjm DWP', 'S.PNJM DWP')
        );
        const untalan = parseNumeric(
          findRowValue(row, 'Untalan/Keu+', 'UNTALAN', 'Untalan', 'UNTALAN/KEU+')
        );
        const arisanDwp = parseNumeric(
          findRowValue(row, 'Arisan DWP', 'ARISAN DWP', 'Arisan dwp')
        );
        const gagalDebet = parseNumeric(
          findRowValue(
            row,
            'Gagal Debet Gaji 8',
            'Gagal Debet',
            'Potongan Gagal Debet',
            'GAGAL DEBET',
            'Gagal Debet Gaji'
          )
        );

        // Aturan PRD: potongan_gagal_debet TIDAK mengurangi nilai tunjangan bersih
        const totalPotonganTK = sRela + toko + brgKop + sPinjamKop + sPnjmDwp + untalan + arisanDwp;
        const thpTK = tkBruto - totalPotonganTK;

        tkList.push({
          nip,
          nama,
          periode: selectedPeriode,
          tunjangan_kinerja: tkBruto,
          simpanan_sukarela: sRela,
          potongan_toko: toko,
          potongan_barang_koperasi: brgKop,
          potongan_pinjaman_koperasi: sPinjamKop,
          potongan_pinjaman_dwp: sPnjmDwp,
          potongan_untalan: untalan,
          potongan_arisan_dwp: arisanDwp,
          potongan_gagal_debet: gagalDebet,
          jumlah_diterima: thpTK,
        });
      }
    });
  }

  // Hitung Summary Statistik
  const totalGajiBruto = gajiList.reduce((acc, curr) => acc + curr.gaji_bruto, 0);
  const totalGajiDiterima = gajiList.reduce((acc, curr) => acc + curr.jumlah_diterima, 0);
  const totalTKBruto = tkList.reduce((acc, curr) => acc + curr.tunjangan_kinerja, 0);
  const totalTKDiterima = tkList.reduce((acc, curr) => acc + curr.jumlah_diterima, 0);

  return {
    karyawanList: Array.from(masterKaryawan.values()),
    gajiList,
    tkList,
    detectedSheets,
    summary: {
      totalEmployees: masterKaryawan.size,
      totalGajiRows: gajiList.length,
      totalTKRows: tkList.length,
      totalGajiBruto,
      totalGajiDiterima,
      totalTKBruto,
      totalTKDiterima,
    },
  };
};

/**
 * Format label periode: "2026-09" -> "September 2026 (2026-09)"
 */
export const formatPeriodeLabel = (periodeStr: string): string => {
  if (!periodeStr || !periodeStr.includes('-')) return periodeStr || '-';
  const [year, month] = periodeStr.split('-');
  const monthNames: Record<string, string> = {
    '01': 'Januari',
    '02': 'Februari',
    '03': 'Maret',
    '04': 'April',
    '05': 'Mei',
    '06': 'Juni',
    '07': 'Juli',
    '08': 'Agustus',
    '09': 'September',
    '10': 'Oktober',
    '11': 'November',
    '12': 'Desember',
  };
  const monthName = monthNames[month] || month;
  return `${monthName} ${year} (${periodeStr})`;
};
