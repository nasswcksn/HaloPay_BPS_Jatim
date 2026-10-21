import asyncio
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from backend.app.core.security import require_admin
from backend.app.schemas.auth import UserSession, UserProfile
from backend.app.schemas.admin import (
    EmployeeAdminItem,
    PayrollSyncPayload,
    RoleUpdatePayload,
    PayrollDeletePayload,
    PayrollEntryUpdate,
)
from backend.app.schemas.payroll import (
    SlipGajiResponse,
    GajiDetail,
    TKDetail,
    FinancialSummary,
    HistoryDataPoint,
    DashboardBundleResponse,
)
from backend.app.core.repository import PayrollRepository
from backend.app.api.payroll import build_dashboard_bundle_data

router = APIRouter(prefix="/admin", tags=["Administrator"])

def _to_float(val: Any) -> float:
    try:
        return float(val or 0.0)
    except (ValueError, TypeError):
        return 0.0

@router.get("/employees", response_model=List[EmployeeAdminItem])
async def get_all_employees_admin(admin_user: UserSession = Depends(require_admin)):
    """
    Mengambil seluruh daftar master pegawai untuk kebutuhan dropdown dan manajemen RBAC Admin.
    Terproteksi: Ditolak dengan 403 jika dipanggil oleh user biasa.
    """
    karyawan_list, users_list = await asyncio.gather(
        PayrollRepository.get_all_karyawan(),
        PayrollRepository.get_all_users(),
    )

    user_map = {u.get("nip"): u for u in users_list if u.get("nip")}

    results = []
    for k in karyawan_list:
        nip = k.get("nip")
        u = user_map.get(nip)
        results.append(
            EmployeeAdminItem(
                nip=nip,
                nama=k.get("nama", "-"),
                no_rekening=k.get("no_rekening", "-"),
                email=k.get("email"),
                jabatan=k.get("jabatan"),
                satker=k.get("satker", "3500"),
                role=u.get("role", "karyawan") if u else "karyawan",
                has_account=bool(u),
                username=u.get("username") if u else None,
                last_login_at=u.get("last_login_at") if u else None,
            )
        )
    return results

@router.get("/employee-dashboard/{nip}", response_model=DashboardBundleResponse)
async def get_employee_dashboard_admin(
    nip: str,
    periode: Optional[str] = Query(None),
    admin_user: UserSession = Depends(require_admin)
):
    """
    Mengambil data terpadu (slip + history chart) untuk satu pegawai dalam SATU round-trip (Supervisi Admin).
    """
    karyawan_db, available_periods, all_gaji, all_tk = await asyncio.gather(
        PayrollRepository.get_karyawan_by_nip(nip),
        PayrollRepository.get_available_periods(),
        PayrollRepository.get_gaji_by_nip(nip),
        PayrollRepository.get_tk_by_nip(nip),
    )

    if not karyawan_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pegawai dengan NIP {nip} tidak ditemukan.",
        )

    karyawan_profile = UserProfile(
        nip=nip,
        nama=karyawan_db.get("nama", "-"),
        no_rekening=karyawan_db.get("no_rekening", "-"),
        email=karyawan_db.get("email"),
        jabatan=karyawan_db.get("jabatan"),
        satker=karyawan_db.get("satker", "3500"),
        role="karyawan",
    )

    return build_dashboard_bundle_data(
        karyawan_profile=karyawan_profile,
        available_periods=available_periods,
        all_gaji=all_gaji,
        all_tk=all_tk,
        requested_periode=periode,
    )

@router.get("/employee-slip/{nip}", response_model=SlipGajiResponse)
async def get_employee_slip_admin(
    nip: str,
    periode: Optional[str] = Query(None),
    admin_user: UserSession = Depends(require_admin)
):
    """
    Mengambil slip gaji pegawai tertentu (khusus diakses oleh Admin untuk keperluan supervisi).
    """
    # Ambil master karyawan dan periode secara paralel
    karyawan_db, available_periods = await asyncio.gather(
        PayrollRepository.get_karyawan_by_nip(nip),
        PayrollRepository.get_available_periods(),
    )
    if not karyawan_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pegawai dengan NIP {nip} tidak ditemukan.",
        )

    active_periode = periode or (available_periods[0] if available_periods else "2026-08")

    # Ambil data Gaji & TK secara paralel
    gaji_rows, tk_rows = await asyncio.gather(
        PayrollRepository.get_gaji_by_nip(nip, active_periode),
        PayrollRepository.get_tk_by_nip(nip, active_periode),
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

    summary = FinancialSummary(
        total_bruto=round(total_bruto, 2),
        total_potongan_gaji=round(total_pot_gaji, 2),
        total_potongan_tk=round(total_pot_tk, 2),
        total_potongan=round(total_pot_gaji + total_pot_tk, 2),
        thp_gaji=round(thp_gaji, 2),
        thp_tk=round(thp_tk, 2),
        total_thp=round(thp_gaji + thp_tk, 2),
    )

    return SlipGajiResponse(
        karyawan=UserProfile(
            nip=nip,
            nama=karyawan_db.get("nama", "-"),
            no_rekening=karyawan_db.get("no_rekening", "-"),
            email=karyawan_db.get("email"),
            jabatan=karyawan_db.get("jabatan"),
            satker=karyawan_db.get("satker", "3500"),
            role="karyawan",
        ),
        periode=active_periode,
        available_periods=available_periods,
        gaji=gaji_detail,
        tk=tk_detail,
        summary=summary,
    )

@router.get("/payroll-grid")
async def get_payroll_grid_admin(
    periode: str = Query(..., description="Format YYYY-MM"),
    admin_user: UserSession = Depends(require_admin)
):
    """
    Mengambil data rekap gabungan Gaji + TK per periode untuk tabel Admin Data Grid.
    """
    karyawan_list, gaji_list, tk_list = await asyncio.gather(
        PayrollRepository.get_all_karyawan(),
        PayrollRepository.get_all_gaji_for_period(periode),
        PayrollRepository.get_all_tk_for_period(periode),
    )

    karyawan_map = {k.get("nip"): k for k in karyawan_list}
    gaji_map = {g.get("nip"): g for g in gaji_list}
    tk_map = {t.get("nip"): t for t in tk_list}

    all_nips = set(karyawan_map.keys()) | set(gaji_map.keys()) | set(tk_map.keys())
    rows = []

    for nip in sorted(all_nips):
        k = karyawan_map.get(nip, {})
        g = gaji_map.get(nip, {})
        t = tk_map.get(nip, {})

        g_bruto = _to_float(g.get("gaji_bruto"))
        sp = _to_float(g.get("simpanan_pokok"))
        ss_g = _to_float(g.get("simpanan_sukarela"))
        sw = _to_float(g.get("simpanan_wajib"))
        dwp = _to_float(g.get("iuran_dwp"))
        korpri = _to_float(g.get("iuran_korpri"))
        pinj_g = _to_float(g.get("potongan_pinjaman_koperasi"))
        thp_g = _to_float(g.get("jumlah_diterima")) or (g_bruto - (sp + ss_g + sw + dwp + korpri + pinj_g))

        tk_bruto = _to_float(t.get("tunjangan_kinerja"))
        ss_tk = _to_float(t.get("simpanan_sukarela"))
        toko = _to_float(t.get("potongan_toko"))
        brg = _to_float(t.get("potongan_barang_koperasi"))
        pinj_tk = _to_float(t.get("potongan_pinjaman_koperasi"))
        pinj_dwp = _to_float(t.get("potongan_pinjaman_dwp"))
        untalan = _to_float(t.get("potongan_untalan"))
        arisan = _to_float(t.get("potongan_arisan_dwp"))
        gagal = _to_float(t.get("potongan_gagal_debet"))
        thp_tk = _to_float(t.get("jumlah_diterima")) or (tk_bruto - (ss_tk + toko + brg + pinj_tk + pinj_dwp + untalan + arisan))

        tot_bruto = g_bruto + tk_bruto
        tot_pot = (sp + ss_g + sw + dwp + korpri + pinj_g) + (ss_tk + toko + brg + pinj_tk + pinj_dwp + untalan + arisan)
        tot_thp = thp_g + thp_tk

        rows.append({
            "nip": nip,
            "nama": k.get("nama", "-"),
            "no_rekening": k.get("no_rekening", "-"),
            "periode": periode,
            "gaji_bruto": g_bruto,
            "simpanan_pokok": sp,
            "simpanan_sukarela_gaji": ss_g,
            "simpanan_wajib": sw,
            "iuran_dwp": dwp,
            "iuran_korpri": korpri,
            "potongan_pinjaman_koperasi_gaji": pinj_g,
            "thp_gaji": thp_g,
            "tunjangan_kinerja": tk_bruto,
            "simpanan_sukarela_tk": ss_tk,
            "potongan_toko": toko,
            "potongan_barang_koperasi": brg,
            "potongan_pinjaman_koperasi_tk": pinj_tk,
            "potongan_pinjaman_dwp": pinj_dwp,
            "potongan_untalan": untalan,
            "potongan_arisan_dwp": arisan,
            "potongan_gagal_debet": gagal,
            "thp_tk": thp_tk,
            "total_bruto": tot_bruto,
            "total_potongan": tot_pot,
            "total_thp": tot_thp,
        })

    return {
        "periode": periode,
        "total_records": len(rows),
        "rows": rows,
    }

@router.post("/payroll-sync")
async def sync_payroll_data_admin(
    payload: PayrollSyncPayload,
    admin_user: UserSession = Depends(require_admin)
):
    """
    Menyimpan hasil parsing file Excel payroll secara transaksional ke database.
    """
    try:
        counts = await PayrollRepository.sync_payroll_batch(
            karyawan_list=payload.karyawanList,
            gaji_list=payload.gajiList,
            tk_list=payload.tkList,
            default_periode=payload.periode,
        )
        return {
            "success": True,
            "message": f"Berhasil menyinkronkan data periode {payload.periode}.",
            "counts": counts,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal menyinkronkan data payroll: {str(e)}",
        )

@router.put("/users/role")
async def update_user_role_admin(
    payload: RoleUpdatePayload,
    admin_user: UserSession = Depends(require_admin)
):
    """
    Mengubah hak akses (Role) pengguna ke 'admin' atau 'karyawan'.
    Mencegah admin mencabut hak akses dirinya sendiri.
    """
    if payload.nip == admin_user.nip and payload.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Anda tidak dapat mencabut hak akses Administrator dari akun Anda sendiri.",
        )

    success = await PayrollRepository.update_user_role(payload.nip, payload.role)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Gagal memperbarui peran pengguna.",
        )
    return {
        "success": True,
        "message": f"Role pengguna NIP {payload.nip} berhasil diubah menjadi {payload.role}.",
    }

@router.delete("/payroll-entry")
async def delete_payroll_entry_admin(
    payload: PayrollDeletePayload,
    admin_user: UserSession = Depends(require_admin)
):
    """
    Menghapus data transaksi Gaji & TK untuk pegawai dan periode tertentu.
    """
    success = await PayrollRepository.delete_payroll_entry(payload.nip, payload.periode)
    return {
        "success": True,
        "message": f"Transaksi NIP {payload.nip} periode {payload.periode} berhasil dihapus.",
    }

@router.put("/payroll-entry")
async def update_payroll_entry_admin(
    payload: PayrollEntryUpdate,
    admin_user: UserSession = Depends(require_admin)
):
    """
    Memperbarui rincian transaksi Gaji & TK untuk satu pegawai pada periode tertentu.
    """
    success = await PayrollRepository.update_payroll_entry(payload.dict())
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Gagal memperbarui transaksi payroll.",
        )
    return {
        "success": True,
        "message": f"Transaksi NIP {payload.nip} periode {payload.periode} berhasil diperbarui.",
    }

@router.get("/employee-history/{nip}", response_model=List[HistoryDataPoint])
async def get_employee_history_admin(
    nip: str,
    admin_user: UserSession = Depends(require_admin)
):
    """
    Mengambil data riwayat tren gaji & TK bulanan untuk visualisasi chart pegawai tertentu (akses admin).
    """
    all_gaji, all_tk = await asyncio.gather(
        PayrollRepository.get_gaji_by_nip(nip),
        PayrollRepository.get_tk_by_nip(nip),
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

    sorted_periods = sorted(history_map.keys())
    return [HistoryDataPoint(**history_map[p]) for p in sorted_periods]

