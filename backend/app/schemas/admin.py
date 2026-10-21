from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel

class EmployeeAdminItem(BaseModel):
    nip: str
    nama: str
    no_rekening: str
    email: Optional[str] = None
    jabatan: Optional[str] = None
    satker: Optional[str] = "3500"
    role: Literal["admin", "karyawan"] = "karyawan"
    has_account: bool = False
    username: Optional[str] = None
    last_login_at: Optional[str] = None

class PayrollSyncPayload(BaseModel):
    periode: str
    karyawanList: List[Dict[str, Any]]
    gajiList: List[Dict[str, Any]]
    tkList: List[Dict[str, Any]]

class RoleUpdatePayload(BaseModel):
    nip: str
    role: Literal["admin", "karyawan"]

class PayrollEntryUpdate(BaseModel):
    nip: str
    periode: str
    gaji_bruto: Optional[float] = None
    simpanan_pokok: Optional[float] = None
    simpanan_sukarela_gaji: Optional[float] = None
    simpanan_wajib: Optional[float] = None
    iuran_dwp: Optional[float] = None
    iuran_korpri: Optional[float] = None
    potongan_pinjaman_koperasi_gaji: Optional[float] = None
    tunjangan_kinerja: Optional[float] = None
    simpanan_sukarela_tk: Optional[float] = None
    potongan_toko: Optional[float] = None
    potongan_barang_koperasi: Optional[float] = None
    potongan_pinjaman_koperasi_tk: Optional[float] = None
    potongan_pinjaman_dwp: Optional[float] = None
    potongan_untalan: Optional[float] = None
    potongan_arisan_dwp: Optional[float] = None
    potongan_gagal_debet: Optional[float] = None

class PayrollDeletePayload(BaseModel):
    nip: str
    periode: str
