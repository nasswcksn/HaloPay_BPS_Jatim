import asyncio
from typing import Optional, List, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from backend.app.core.security import get_current_user
from backend.app.schemas.auth import UserSession, UserProfile
from backend.app.schemas.payroll import (
    SlipGajiResponse,
    GajiDetail,
    TKDetail,
    FinancialSummary,
    HistoryDataPoint,
    DashboardBundleResponse,
)
from backend.app.core.repository import PayrollRepository

router = APIRouter(prefix="/payroll", tags=["Payroll"])

def _to_float(val: Any) -> float:
    try:
        return float(val or 0.0)
    except (ValueError, TypeError):
        return 0.0

def build_dashboard_bundle_data(
    karyawan_profile: UserProfile,
    available_periods: List[str],
    all_gaji: List[dict],
    all_tk: List[dict],
    requested_periode: Optional[str] = None,
) -> DashboardBundleResponse:
    """
    Mengagregasikan data slip gaji, tunjangan kinerja, dan riwayat bulanan
    ke dalam 1 payload terpadu berkecepatan tinggi tanpa redundansi database query.
    """
    active_periode = requested_periode
    if not active_periode and available_periods:
        active_periode = available_periods[0]
    elif not active_periode:
        active_periode = "2026-08"

    gaji_row = next((g for g in all_gaji if g.get("periode") == active_periode), None)
    tk_row = next((t for t in all_tk if t.get("periode") == active_periode), None)

    gaji_detail: Optional[GajiDetail] = None
    tk_detail: Optional[TKDetail] = None

    total_bruto = 0.0
    total_pot_gaji = 0.0
    total_pot_tk = 0.0
    thp_gaji = 0.0
    thp_tk = 0.0

    if gaji_row:
        g_bruto = _to_float(gaji_row.get("gaji_bruto"))
        sp = _to_float(gaji_row.get("simpanan_pokok"))
        ss = _to_float(gaji_row.get("simpanan_sukarela"))
        sw = _to_float(gaji_row.get("simpanan_wajib"))
        dwp = _to_float(gaji_row.get("iuran_dwp"))
        korpri = _to_float(gaji_row.get("iuran_korpri"))
        pinj = _to_float(gaji_row.get("potongan_pinjaman_koperasi"))
        pot = sp + ss + sw + dwp + korpri + pinj
        thp_g = _to_float(gaji_row.get("jumlah_diterima")) or (g_bruto - pot)

        total_bruto += g_bruto
        total_pot_gaji += pot
        thp_gaji = thp_g

        gaji_detail = GajiDetail(
            periode=active_periode,
            gaji_bruto=g_bruto,
            simpanan_pokok=sp,
            simpanan_sukarela=ss,
            simpanan_wajib=sw,
            iuran_dwp=dwp,
            iuran_korpri=korpri,
            potongan_pinjaman_koperasi=pinj,
            total_potongan=pot,
            jumlah_diterima=thp_g,
        )

    if tk_row:
        tk_bruto = _to_float(tk_row.get("tunjangan_kinerja"))
        ss_tk = _to_float(tk_row.get("simpanan_sukarela"))
        toko = _to_float(tk_row.get("potongan_toko"))
        brg = _to_float(tk_row.get("potongan_barang_koperasi"))
        pinj_tk = _to_float(tk_row.get("potongan_pinjaman_koperasi"))
        pinj_dwp = _to_float(tk_row.get("potongan_pinjaman_dwp"))
        untalan = _to_float(tk_row.get("potongan_untalan"))
        arisan = _to_float(tk_row.get("potongan_arisan_dwp"))
        gagal = _to_float(tk_row.get("potongan_gagal_debet"))

        pot_tk = ss_tk + toko + brg + pinj_tk + pinj_dwp + untalan + arisan
        thp_t = _to_float(tk_row.get("jumlah_diterima")) or (tk_bruto - pot_tk)

        total_bruto += tk_bruto
        total_pot_tk += pot_tk
        thp_tk = thp_t

        tk_detail = TKDetail(
            periode=active_periode,
            tunjangan_kinerja=tk_bruto,
            simpanan_sukarela=ss_tk,
            potongan_toko=toko,
            potongan_barang_koperasi=brg,
            potongan_pinjaman_koperasi=pinj_tk,
            potongan_pinjaman_dwp=pinj_dwp,
            potongan_untalan=untalan,
            potongan_arisan_dwp=arisan,
            potongan_gagal_debet=gagal,
            total_potongan=pot_tk,
            jumlah_diterima=thp_t,
        )

    total_potongan = total_pot_gaji + total_pot_tk
    total_thp = thp_gaji + thp_tk

    summary = FinancialSummary(
        total_bruto=round(total_bruto, 2),
        total_potongan_gaji=round(total_pot_gaji, 2),
        total_potongan_tk=round(total_pot_tk, 2),
        total_potongan=round(total_potongan, 2),
        thp_gaji=round(thp_gaji, 2),
        thp_tk=round(thp_tk, 2),
        total_thp=round(total_thp, 2),
    )

    history_map = {}
    for g in all_gaji:
        p = g.get("periode")
        if not p:
            continue
        gb = _to_float(g.get("gaji_bruto"))
        thp = _to_float(g.get("jumlah_diterima"))
        pt = gb - thp
        history_map[p] = {
            "periode": p,
            "gaji_bruto": gb,
            "tunjangan_kinerja": 0.0,
            "total_bruto": gb,
            "total_potongan": max(0.0, pt),
            "total_thp": thp,
        }

    for t in all_tk:
        p = t.get("periode")
        if not p:
            continue
        tb = _to_float(t.get("tunjangan_kinerja"))
        thp = _to_float(t.get("jumlah_diterima"))
        pt = tb - thp
        if p in history_map:
            history_map[p]["tunjangan_kinerja"] = tb
            history_map[p]["total_bruto"] += tb
            history_map[p]["total_potongan"] += max(0.0, pt)
            history_map[p]["total_thp"] += thp
        else:
            history_map[p] = {
                "periode": p,
                "gaji_bruto": 0.0,
                "tunjangan_kinerja": tb,
                "total_bruto": tb,
                "total_potongan": max(0.0, pt),
                "total_thp": thp,
            }

    sorted_periods = sorted(history_map.keys())
    history_list = [HistoryDataPoint(**history_map[p]) for p in sorted_periods]

    return DashboardBundleResponse(
        karyawan=karyawan_profile,
        periode=active_periode,
        available_periods=available_periods,
        gaji=gaji_detail,
        tk=tk_detail,
        summary=summary,
        history=history_list,
    )

@router.get("/periods", response_model=List[str])
async def get_periods(current_user: UserSession = Depends(get_current_user)):
    """
    Mengambil daftar seluruh periode transaksi payroll yang tersedia di database.
    """
    return await PayrollRepository.get_available_periods()

@router.get("/dashboard-bundle", response_model=DashboardBundleResponse)
async def get_dashboard_bundle(
    periode: Optional[str] = Query(None, description="Format YYYY-MM. Jika kosong, default ke periode terbaru."),
    current_user: UserSession = Depends(get_current_user)
):
    """
    OPTIMASI UTAMA: SINGLE ROUND-TRIP DASHBOARD ENDPOINT
    Mengembalikan data slip transaksi (gaji + TK) dan deret riwayat analitik dalam SATU request.
    Memangkas koneksi HTTP hingga 50% dan memicu re-render atomik di sisi frontend.
    """
    target_nip = current_user.nip

    karyawan_db, available_periods, all_gaji, all_tk = await asyncio.gather(
        PayrollRepository.get_karyawan_by_nip(target_nip),
        PayrollRepository.get_available_periods(),
        PayrollRepository.get_gaji_by_nip(target_nip),
        PayrollRepository.get_tk_by_nip(target_nip),
    )

    karyawan_profile = UserProfile(
        nip=target_nip,
        nama=karyawan_db.get("nama") if karyawan_db else current_user.nama_lengkap,
        no_rekening=karyawan_db.get("no_rekening", "-") if karyawan_db else "-",
        email=karyawan_db.get("email") if karyawan_db else current_user.email,
        jabatan=karyawan_db.get("jabatan") if karyawan_db else current_user.jabatan,
        satker=karyawan_db.get("satker", "3500") if karyawan_db else current_user.satker,
        role=current_user.role,
    )

    return build_dashboard_bundle_data(
        karyawan_profile=karyawan_profile,
        available_periods=available_periods,
        all_gaji=all_gaji,
        all_tk=all_tk,
        requested_periode=periode,
    )

@router.get("/my-slip", response_model=SlipGajiResponse)
async def get_my_slip(
    periode: Optional[str] = Query(None, description="Format YYYY-MM. Jika kosong, default ke periode terbaru."),
    current_user: UserSession = Depends(get_current_user)
):
    """
    ENDPOINT ZERO LEAKAGE BERPERFORMA TINGGI:
    Mengambil rincian slip gaji & tunjangan kinerja HANYA untuk pegawai yang sedang login.
    Seluruh query ke database dieksekusi secara paralel untuk memangkas latensi.
    """
    target_nip = current_user.nip

    # 1. Ambil data master karyawan dan periode transaksi secara paralel
    karyawan_db, available_periods = await asyncio.gather(
        PayrollRepository.get_karyawan_by_nip(target_nip),
        PayrollRepository.get_available_periods(),
    )

    karyawan_profile = UserProfile(
        nip=target_nip,
        nama=karyawan_db.get("nama") if karyawan_db else current_user.nama_lengkap,
        no_rekening=karyawan_db.get("no_rekening", "-") if karyawan_db else "-",
        email=karyawan_db.get("email") if karyawan_db else current_user.email,
        jabatan=karyawan_db.get("jabatan") if karyawan_db else current_user.jabatan,
        satker=karyawan_db.get("satker", "3500") if karyawan_db else current_user.satker,
        role=current_user.role,
    )

    # 2. Tentukan periode target
    active_periode = periode
    if not active_periode and available_periods:
        active_periode = available_periods[0]
    elif not active_periode:
        active_periode = "2026-08"

    # 3. Ambil data Gaji & TK secara paralel
    gaji_rows, tk_rows = await asyncio.gather(
        PayrollRepository.get_gaji_by_nip(target_nip, active_periode),
        PayrollRepository.get_tk_by_nip(target_nip, active_periode),
    )

    gaji_detail: Optional[GajiDetail] = None
    tk_detail: Optional[TKDetail] = None

    total_bruto = 0.0
    total_pot_gaji = 0.0
    total_pot_tk = 0.0
    thp_gaji = 0.0
    thp_tk = 0.0

    if gaji_rows:
        g = gaji_rows[0]
        g_bruto = _to_float(g.get("gaji_bruto"))
        sp = _to_float(g.get("simpanan_pokok"))
        ss = _to_float(g.get("simpanan_sukarela"))
        sw = _to_float(g.get("simpanan_wajib"))
        dwp = _to_float(g.get("iuran_dwp"))
        korpri = _to_float(g.get("iuran_korpri"))
        pinj = _to_float(g.get("potongan_pinjaman_koperasi"))
        pot = sp + ss + sw + dwp + korpri + pinj
        thp_g = _to_float(g.get("jumlah_diterima")) or (g_bruto - pot)

        total_bruto += g_bruto
        total_pot_gaji += pot
        thp_gaji = thp_g

        gaji_detail = GajiDetail(
            periode=active_periode,
            gaji_bruto=g_bruto,
            simpanan_pokok=sp,
            simpanan_sukarela=ss,
            simpanan_wajib=sw,
            iuran_dwp=dwp,
            iuran_korpri=korpri,
            potongan_pinjaman_koperasi=pinj,
            total_potongan=pot,
            jumlah_diterima=thp_g,
        )

    if tk_rows:
        t = tk_rows[0]
        tk_bruto = _to_float(t.get("tunjangan_kinerja"))
        ss_tk = _to_float(t.get("simpanan_sukarela"))
        toko = _to_float(t.get("potongan_toko"))
        brg = _to_float(t.get("potongan_barang_koperasi"))
        pinj_tk = _to_float(t.get("potongan_pinjaman_koperasi"))
        pinj_dwp = _to_float(t.get("potongan_pinjaman_dwp"))
        untalan = _to_float(t.get("potongan_untalan"))
        arisan = _to_float(t.get("potongan_arisan_dwp"))
        gagal = _to_float(t.get("potongan_gagal_debet"))
        
        pot_tk = ss_tk + toko + brg + pinj_tk + pinj_dwp + untalan + arisan
        thp_t = _to_float(t.get("jumlah_diterima")) or (tk_bruto - pot_tk)

        total_bruto += tk_bruto
        total_pot_tk += pot_tk
        thp_tk = thp_t

        tk_detail = TKDetail(
            periode=active_periode,
            tunjangan_kinerja=tk_bruto,
            simpanan_sukarela=ss_tk,
            potongan_toko=toko,
            potongan_barang_koperasi=brg,
            potongan_pinjaman_koperasi=pinj_tk,
            potongan_pinjaman_dwp=pinj_dwp,
            potongan_untalan=untalan,
            potongan_arisan_dwp=arisan,
            potongan_gagal_debet=gagal,
            total_potongan=pot_tk,
            jumlah_diterima=thp_t,
        )

    total_potongan = total_pot_gaji + total_pot_tk
    total_thp = thp_gaji + thp_tk

    summary = FinancialSummary(
        total_bruto=round(total_bruto, 2),
        total_potongan_gaji=round(total_pot_gaji, 2),
        total_potongan_tk=round(total_pot_tk, 2),
        total_potongan=round(total_potongan, 2),
        thp_gaji=round(thp_gaji, 2),
        thp_tk=round(thp_tk, 2),
        total_thp=round(total_thp, 2),
    )

    return SlipGajiResponse(
        karyawan=karyawan_profile,
        periode=active_periode,
        available_periods=available_periods,
        gaji=gaji_detail,
        tk=tk_detail,
        summary=summary,
    )

@router.get("/history", response_model=List[HistoryDataPoint])
async def get_my_history(current_user: UserSession = Depends(get_current_user)):
    """
    Mengambil data riwayat tren gaji & TK bulanan untuk visualisasi chart milik user aktif.
    """
    target_nip = current_user.nip

    all_gaji, all_tk = await asyncio.gather(
        PayrollRepository.get_gaji_by_nip(target_nip),
        PayrollRepository.get_tk_by_nip(target_nip),
    )

    history_map = {}

    for g in all_gaji:
        p = g.get("periode")
        if not p:
            continue
        g_bruto = _to_float(g.get("gaji_bruto"))
        thp = _to_float(g.get("jumlah_diterima"))
        pot = g_bruto - thp
        history_map[p] = {
            "periode": p,
            "gaji_bruto": g_bruto,
            "tunjangan_kinerja": 0.0,
            "total_bruto": g_bruto,
            "total_potongan": max(0.0, pot),
            "total_thp": thp,
        }

    for t in all_tk:
        p = t.get("periode")
        if not p:
            continue
        tk_bruto = _to_float(t.get("tunjangan_kinerja"))
        thp_tk = _to_float(t.get("jumlah_diterima"))
        pot_tk = tk_bruto - thp_tk

        if p in history_map:
            history_map[p]["tunjangan_kinerja"] = tk_bruto
            history_map[p]["total_bruto"] += tk_bruto
            history_map[p]["total_potongan"] += max(0.0, pot_tk)
            history_map[p]["total_thp"] += thp_tk
        else:
            history_map[p] = {
                "periode": p,
                "gaji_bruto": 0.0,
                "tunjangan_kinerja": tk_bruto,
                "total_bruto": tk_bruto,
                "total_potongan": max(0.0, pot_tk),
                "total_thp": thp_tk,
            }

    # Urutkan berdasarkan periode kronologis (terlama ke terbaru)
    sorted_periods = sorted(history_map.keys())
    return [HistoryDataPoint(**history_map[p]) for p in sorted_periods]
