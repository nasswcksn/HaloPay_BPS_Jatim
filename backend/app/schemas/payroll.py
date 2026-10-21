from typing import Optional, List
from pydantic import BaseModel
from backend.app.schemas.auth import UserProfile

class GajiDetail(BaseModel):
    periode: str
    gaji_bruto: float
    simpanan_pokok: float = 0.0
    simpanan_sukarela: float = 0.0
    simpanan_wajib: float = 0.0
    iuran_dwp: float = 0.0
    iuran_korpri: float = 0.0
    potongan_pinjaman_koperasi: float = 0.0
    total_potongan: float = 0.0
    jumlah_diterima: float = 0.0

class TKDetail(BaseModel):
    periode: str
    tunjangan_kinerja: float
    simpanan_sukarela: float = 0.0
    potongan_toko: float = 0.0
    potongan_barang_koperasi: float = 0.0
    potongan_pinjaman_koperasi: float = 0.0
    potongan_pinjaman_dwp: float = 0.0
    potongan_untalan: float = 0.0
    potongan_arisan_dwp: float = 0.0
    potongan_gagal_debet: float = 0.0
    total_potongan: float = 0.0
    jumlah_diterima: float = 0.0

class FinancialSummary(BaseModel):
    total_bruto: float
    total_potongan_gaji: float
    total_potongan_tk: float
    total_potongan: float
    thp_gaji: float
    thp_tk: float
    total_thp: float

class SlipGajiResponse(BaseModel):
    karyawan: UserProfile
    periode: str
    available_periods: List[str]
    gaji: Optional[GajiDetail] = None
    tk: Optional[TKDetail] = None
    summary: FinancialSummary

class HistoryDataPoint(BaseModel):
    periode: str
    gaji_bruto: float
    tunjangan_kinerja: float
    total_bruto: float
    total_potongan: float
    total_thp: float

class DashboardBundleResponse(BaseModel):
    karyawan: UserProfile
    periode: str
    available_periods: List[str]
    gaji: Optional[GajiDetail] = None
    tk: Optional[TKDetail] = None
    summary: FinancialSummary
    history: List[HistoryDataPoint]
