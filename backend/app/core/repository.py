import time
import datetime
from decimal import Decimal
from uuid import UUID
from typing import Optional, List, Dict, Any
from backend.app.core.database import get_pg_pool
from backend.app.schemas.admin import PayrollSyncPayload

# In-Memory Cache untuk Periode (menghindari roundtrip basis data berulang)
_periods_cache: Optional[List[str]] = None
_periods_cache_time: float = 0.0

def invalidate_periods_cache():
    global _periods_cache, _periods_cache_time
    _periods_cache = None
    _periods_cache_time = 0.0

def _serialize_record(record: Any) -> Dict[str, Any]:
    """Mengubah record asyncpg (termasuk Decimal, UUID, dan Datetime) menjadi dictionary JSON serializable."""
    if record is None:
        return {}
    d = dict(record)
    res = {}
    for k, v in d.items():
        if isinstance(v, Decimal):
            res[k] = float(v)
        elif isinstance(v, UUID):
            res[k] = str(v)
        elif isinstance(v, (datetime.datetime, datetime.date)):
            res[k] = v.isoformat()
        else:
            res[k] = v
    return res

class PayrollRepository:
    """
    Data Access Layer berkinerja tinggi dengan Connection Pooling PostgreSQL (asyncpg).
    """

    @staticmethod
    async def get_karyawan_by_nip(nip: str) -> Optional[Dict[str, Any]]:
        nip_clean = str(nip).strip()
        pool = await get_pg_pool()
        if not pool:
            return None
        async with pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM karyawan_bps.karyawan WHERE nip = $1", nip_clean)
            return _serialize_record(row) if row else None

    @staticmethod
    async def get_all_karyawan() -> List[Dict[str, Any]]:
        pool = await get_pg_pool()
        if not pool:
            return []
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM karyawan_bps.karyawan ORDER BY nama ASC")
            return [_serialize_record(r) for r in rows]

    @staticmethod
    async def get_user_by_nip(nip: str) -> Optional[Dict[str, Any]]:
        nip_clean = str(nip).strip()
        pool = await get_pg_pool()
        if not pool:
            return None
        async with pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM karyawan_bps.users WHERE nip = $1", nip_clean)
            return _serialize_record(row) if row else None

    @staticmethod
    async def get_all_users() -> List[Dict[str, Any]]:
        pool = await get_pg_pool()
        if not pool:
            return []
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM karyawan_bps.users ORDER BY created_at DESC")
            return [_serialize_record(r) for r in rows]

    @staticmethod
    async def get_gaji_by_nip(nip: str, periode: Optional[str] = None) -> List[Dict[str, Any]]:
        nip_clean = str(nip).strip()
        pool = await get_pg_pool()
        if not pool:
            return []
        async with pool.acquire() as conn:
            if periode:
                rows = await conn.fetch(
                    "SELECT * FROM karyawan_bps.gaji_bulanan WHERE nip = $1 AND periode = $2 ORDER BY periode ASC",
                    nip_clean, str(periode).strip()
                )
            else:
                rows = await conn.fetch(
                    "SELECT * FROM karyawan_bps.gaji_bulanan WHERE nip = $1 ORDER BY periode ASC",
                    nip_clean
                )
            return [_serialize_record(r) for r in rows]

    @staticmethod
    async def get_tk_by_nip(nip: str, periode: Optional[str] = None) -> List[Dict[str, Any]]:
        nip_clean = str(nip).strip()
        pool = await get_pg_pool()
        if not pool:
            return []
        async with pool.acquire() as conn:
            if periode:
                rows = await conn.fetch(
                    "SELECT * FROM karyawan_bps.tk_bulanan WHERE nip = $1 AND periode = $2 ORDER BY periode ASC",
                    nip_clean, str(periode).strip()
                )
            else:
                rows = await conn.fetch(
                    "SELECT * FROM karyawan_bps.tk_bulanan WHERE nip = $1 ORDER BY periode ASC",
                    nip_clean
                )
            return [_serialize_record(r) for r in rows]

    @staticmethod
    async def get_available_periods() -> List[str]:
        """
        Mengambil daftar unik seluruh periode transaksi dengan TTL in-memory cache (15 detik).
        """
        global _periods_cache, _periods_cache_time
        now = time.time()
        if _periods_cache is not None and (now - _periods_cache_time) < 15.0:
            return _periods_cache

        pool = await get_pg_pool()
        if not pool:
            return ["2026-09", "2026-08"]

        async with pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT DISTINCT periode FROM (
                    SELECT periode FROM karyawan_bps.gaji_bulanan
                    UNION
                    SELECT periode FROM karyawan_bps.tk_bulanan
                ) p ORDER BY periode DESC
            """)
            res = [r["periode"] for r in rows if r["periode"]]
            if res:
                _periods_cache = res
                _periods_cache_time = now
                return res
            return ["2026-09", "2026-08"]

    @staticmethod
    async def get_all_gaji_for_period(periode: str) -> List[Dict[str, Any]]:
        periode_clean = str(periode).strip()
        pool = await get_pg_pool()
        if not pool:
            return []
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM karyawan_bps.gaji_bulanan WHERE periode = $1", periode_clean)
            return [_serialize_record(r) for r in rows]

    @staticmethod
    async def get_all_tk_for_period(periode: str) -> List[Dict[str, Any]]:
        periode_clean = str(periode).strip()
        pool = await get_pg_pool()
        if not pool:
            return []
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM karyawan_bps.tk_bulanan WHERE periode = $1", periode_clean)
            return [_serialize_record(r) for r in rows]

    @staticmethod
    async def update_user_role(nip: str, role: str) -> bool:
        nip_clean = str(nip).strip()
        role_clean = str(role).strip()
        pool = await get_pg_pool()
        if not pool:
            return False
        async with pool.acquire() as conn:
            await conn.execute("UPDATE karyawan_bps.users SET role = $1 WHERE nip = $2", role_clean, nip_clean)
            return True

    @staticmethod
    async def sync_payroll_batch(
        karyawan_list: List[Dict[str, Any]],
        gaji_list: List[Dict[str, Any]],
        tk_list: List[Dict[str, Any]],
        default_periode: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Batch upsert master karyawan, gaji bulanan, dan TK bulanan dengan sanitasi skema ketat.
        """
        counts = {"karyawan": 0, "gaji": 0, "tk": 0}

        # 1. Sanitasi & Upsert Master Karyawan
        clean_karyawan = []
        known_nips = set()
        for k in (karyawan_list or []):
            nip = str(k.get("nip", "")).strip()
            if nip:
                clean_karyawan.append({
                    "nip": nip,
                    "nama": str(k.get("nama", "")).strip(),
                    "no_rekening": str(k.get("no_rekening", "-")).strip() or "-",
                })
                known_nips.add(nip)

        # Fallback deteksi karyawan baru dari baris gaji/TK
        for item in (gaji_list or []) + (tk_list or []):
            item_nip = str(item.get("nip", "")).strip()
            item_nama = str(item.get("nama", "")).strip()
            if item_nip and item_nip not in known_nips:
                clean_karyawan.append({
                    "nip": item_nip,
                    "nama": item_nama or "-",
                    "no_rekening": str(item.get("no_rekening", "-")).strip() or "-",
                })
                known_nips.add(item_nip)

        # 2. Sanitasi Gaji Bulanan
        clean_gaji = []
        for g in gaji_list:
            clean_gaji.append({
                "nip": str(g.get("nip", "")).strip(),
                "periode": str(g.get("periode") or default_periode or "").strip(),
                "gaji_bruto": float(g.get("gaji_bruto") or 0.0),
                "simpanan_pokok": float(g.get("simpanan_pokok") or 0.0),
                "simpanan_sukarela": float(g.get("simpanan_sukarela") or 0.0),
                "simpanan_wajib": float(g.get("simpanan_wajib") or 0.0),
                "iuran_dwp": float(g.get("iuran_dwp") or 0.0),
                "iuran_korpri": float(g.get("iuran_korpri") or 0.0),
                "potongan_pinjaman_koperasi": float(g.get("potongan_pinjaman_koperasi") or 0.0),
                "jumlah_diterima": float(g.get("jumlah_diterima") or 0.0),
            })

        # 3. Sanitasi TK Bulanan
        clean_tk = []
        for t in tk_list:
            clean_tk.append({
                "nip": str(t.get("nip", "")).strip(),
                "periode": str(t.get("periode") or default_periode or "").strip(),
                "tunjangan_kinerja": float(t.get("tunjangan_kinerja") or 0.0),
                "simpanan_sukarela": float(t.get("simpanan_sukarela") or 0.0),
                "potongan_toko": float(t.get("potongan_toko") or 0.0),
                "potongan_barang_koperasi": float(t.get("potongan_barang_koperasi") or 0.0),
                "potongan_pinjaman_koperasi": float(t.get("potongan_pinjaman_koperasi") or 0.0),
                "potongan_pinjaman_dwp": float(t.get("potongan_pinjaman_dwp") or 0.0),
                "potongan_untalan": float(t.get("potongan_untalan") or 0.0),
                "potongan_arisan_dwp": float(t.get("potongan_arisan_dwp") or 0.0),
                "potongan_gagal_debet": float(t.get("potongan_gagal_debet") or 0.0),
                "jumlah_diterima": float(t.get("jumlah_diterima") or 0.0),
            })

        pool = await get_pg_pool()
        if not pool:
            raise RuntimeError("PostgreSQL Connection Pool tidak tersedia.")

        async with pool.acquire() as conn:
            async with conn.transaction():
                for k in clean_karyawan:
                    await conn.execute("""
                        INSERT INTO karyawan_bps.karyawan (nip, nama, no_rekening)
                        VALUES ($1, $2, $3)
                        ON CONFLICT (nip) DO UPDATE SET
                            nama = EXCLUDED.nama,
                            no_rekening = EXCLUDED.no_rekening;
                    """, k["nip"], k["nama"], k["no_rekening"])
                counts["karyawan"] = len(clean_karyawan)

                for g in clean_gaji:
                    await conn.execute("""
                        INSERT INTO karyawan_bps.gaji_bulanan (
                            nip, periode, gaji_bruto, simpanan_pokok, simpanan_sukarela,
                            simpanan_wajib, iuran_dwp, iuran_korpri, potongan_pinjaman_koperasi,
                            jumlah_diterima
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                        ON CONFLICT (nip, periode) DO UPDATE SET
                            gaji_bruto = EXCLUDED.gaji_bruto,
                            simpanan_pokok = EXCLUDED.simpanan_pokok,
                            simpanan_sukarela = EXCLUDED.simpanan_sukarela,
                            simpanan_wajib = EXCLUDED.simpanan_wajib,
                            iuran_dwp = EXCLUDED.iuran_dwp,
                            iuran_korpri = EXCLUDED.iuran_korpri,
                            potongan_pinjaman_koperasi = EXCLUDED.potongan_pinjaman_koperasi,
                            jumlah_diterima = EXCLUDED.jumlah_diterima;
                    """, g["nip"], g["periode"], g["gaji_bruto"], g["simpanan_pokok"],
                         g["simpanan_sukarela"], g["simpanan_wajib"], g["iuran_dwp"],
                         g["iuran_korpri"], g["potongan_pinjaman_koperasi"], g["jumlah_diterima"])
                counts["gaji"] = len(clean_gaji)

                for t in clean_tk:
                    await conn.execute("""
                        INSERT INTO karyawan_bps.tk_bulanan (
                            nip, periode, tunjangan_kinerja, simpanan_sukarela, potongan_toko,
                            potongan_barang_koperasi, potongan_pinjaman_koperasi, potongan_pinjaman_dwp,
                            potongan_untalan, potongan_arisan_dwp, potongan_gagal_debet, jumlah_diterima
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                        ON CONFLICT (nip, periode) DO UPDATE SET
                            tunjangan_kinerja = EXCLUDED.tunjangan_kinerja,
                            simpanan_sukarela = EXCLUDED.simpanan_sukarela,
                            potongan_toko = EXCLUDED.potongan_toko,
                            potongan_barang_koperasi = EXCLUDED.potongan_barang_koperasi,
                            potongan_pinjaman_koperasi = EXCLUDED.potongan_pinjaman_koperasi,
                            potongan_pinjaman_dwp = EXCLUDED.potongan_pinjaman_dwp,
                            potongan_untalan = EXCLUDED.potongan_untalan,
                            potongan_arisan_dwp = EXCLUDED.potongan_arisan_dwp,
                            potongan_gagal_debet = EXCLUDED.potongan_gagal_debet,
                            jumlah_diterima = EXCLUDED.jumlah_diterima;
                    """, t["nip"], t["periode"], t["tunjangan_kinerja"], t["simpanan_sukarela"],
                         t["potongan_toko"], t["potongan_barang_koperasi"], t["potongan_pinjaman_koperasi"],
                         t["potongan_pinjaman_dwp"], t["potongan_untalan"], t["potongan_arisan_dwp"],
                         t["potongan_gagal_debet"], t["jumlah_diterima"])
                counts["tk"] = len(clean_tk)

        invalidate_periods_cache()
        return counts

    @staticmethod
    async def delete_payroll_entry(nip: str, periode: str) -> bool:
        nip_clean = str(nip).strip()
        periode_clean = str(periode).strip()
        pool = await get_pg_pool()
        if not pool:
            return False
        async with pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute("DELETE FROM karyawan_bps.gaji_bulanan WHERE nip = $1 AND periode = $2", nip_clean, periode_clean)
                await conn.execute("DELETE FROM karyawan_bps.tk_bulanan WHERE nip = $1 AND periode = $2", nip_clean, periode_clean)
        invalidate_periods_cache()
        return True

    @staticmethod
    async def update_payroll_entry(entry: Dict[str, Any]) -> bool:
        nip = str(entry.get("nip", "")).strip()
        periode = str(entry.get("periode", "")).strip()

        # Payload Gaji Bulanan
        g_bruto = float(entry.get("gaji_bruto") or 0.0)
        sp = float(entry.get("simpanan_pokok") or 0.0)
        ss_g = float(entry.get("simpanan_sukarela_gaji") or 0.0)
        sw = float(entry.get("simpanan_wajib") or 0.0)
        dwp = float(entry.get("iuran_dwp") or 0.0)
        korpri = float(entry.get("iuran_korpri") or 0.0)
        pinj_g = float(entry.get("potongan_pinjaman_koperasi_gaji") or 0.0)
        pot_gaji = sp + ss_g + sw + dwp + korpri + pinj_g
        thp_gaji = g_bruto - pot_gaji

        # Payload TK Bulanan
        tk_bruto = float(entry.get("tunjangan_kinerja") or 0.0)
        ss_tk = float(entry.get("simpanan_sukarela_tk") or 0.0)
        toko = float(entry.get("potongan_toko") or 0.0)
        brg = float(entry.get("potongan_barang_koperasi") or 0.0)
        pinj_tk = float(entry.get("potongan_pinjaman_koperasi_tk") or 0.0)
        pinj_dwp = float(entry.get("potongan_pinjaman_dwp") or 0.0)
        untalan = float(entry.get("potongan_untalan") or 0.0)
        arisan = float(entry.get("potongan_arisan_dwp") or 0.0)
        gagal = float(entry.get("potongan_gagal_debet") or 0.0)
        pot_tk = ss_tk + toko + brg + pinj_tk + pinj_dwp + untalan + arisan
        thp_tk = tk_bruto - pot_tk

        pool = await get_pg_pool()
        if not pool:
            return False
        async with pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute("""
                    INSERT INTO karyawan_bps.gaji_bulanan (
                        nip, periode, gaji_bruto, simpanan_pokok, simpanan_sukarela,
                        simpanan_wajib, iuran_dwp, iuran_korpri, potongan_pinjaman_koperasi,
                        jumlah_diterima
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    ON CONFLICT (nip, periode) DO UPDATE SET
                        gaji_bruto = EXCLUDED.gaji_bruto,
                        simpanan_pokok = EXCLUDED.simpanan_pokok,
                        simpanan_sukarela = EXCLUDED.simpanan_sukarela,
                        simpanan_wajib = EXCLUDED.simpanan_wajib,
                        iuran_dwp = EXCLUDED.iuran_dwp,
                        iuran_korpri = EXCLUDED.iuran_korpri,
                        potongan_pinjaman_koperasi = EXCLUDED.potongan_pinjaman_koperasi,
                        jumlah_diterima = EXCLUDED.jumlah_diterima;
                """, nip, periode, g_bruto, sp, ss_g, sw, dwp, korpri, pinj_g, thp_gaji)

                await conn.execute("""
                    INSERT INTO karyawan_bps.tk_bulanan (
                        nip, periode, tunjangan_kinerja, simpanan_sukarela, potongan_toko,
                        potongan_barang_koperasi, potongan_pinjaman_koperasi, potongan_pinjaman_dwp,
                        potongan_untalan, potongan_arisan_dwp, potongan_gagal_debet, jumlah_diterima
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    ON CONFLICT (nip, periode) DO UPDATE SET
                        tunjangan_kinerja = EXCLUDED.tunjangan_kinerja,
                        simpanan_sukarela = EXCLUDED.simpanan_sukarela,
                        potongan_toko = EXCLUDED.potongan_toko,
                        potongan_barang_koperasi = EXCLUDED.potongan_barang_koperasi,
                        potongan_pinjaman_koperasi = EXCLUDED.potongan_pinjaman_koperasi,
                        potongan_pinjaman_dwp = EXCLUDED.potongan_pinjaman_dwp,
                        potongan_untalan = EXCLUDED.potongan_untalan,
                        potongan_arisan_dwp = EXCLUDED.potongan_arisan_dwp,
                        potongan_gagal_debet = EXCLUDED.potongan_gagal_debet,
                        jumlah_diterima = EXCLUDED.jumlah_diterima;
                """, nip, periode, tk_bruto, ss_tk, toko, brg, pinj_tk, pinj_dwp, untalan, arisan, gagal, thp_tk)
        return True

    @staticmethod
    async def sync_user_session(
        nip: str,
        nama: str,
        username: str,
        email: Optional[str] = None,
        jabatan: Optional[str] = None,
        satker: Optional[str] = "3500",
    ) -> Dict[str, Any]:
        """
        Sinkronisasi profil pegawai dan akun user pasca-login SSO Keycloak ke database lokal.
        """
        nip_clean = str(nip).strip()
        nama_clean = str(nama).strip()
        username_clean = str(username).strip() or nip_clean

        pool = await get_pg_pool()
        if not pool:
            raise RuntimeError("PostgreSQL Connection Pool tidak tersedia.")

        async with pool.acquire() as conn:
            # 1. Upsert tabel karyawan
            await conn.execute("""
                INSERT INTO karyawan_bps.karyawan (nip, nama, email, jabatan, satker, updated_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
                ON CONFLICT (nip) DO UPDATE SET
                    nama = EXCLUDED.nama,
                    email = COALESCE(EXCLUDED.email, karyawan_bps.karyawan.email),
                    jabatan = COALESCE(EXCLUDED.jabatan, karyawan_bps.karyawan.jabatan),
                    satker = COALESCE(EXCLUDED.satker, karyawan_bps.karyawan.satker),
                    updated_at = NOW();
            """, nip_clean, nama_clean, email, jabatan, satker or "3500")

            # 2. Cek/Upsert tabel users
            user_row = await conn.fetchrow(
                "SELECT id, nip, role FROM karyawan_bps.users WHERE nip = $1", nip_clean
            )
            if not user_row:
                slug = nama_clean.lower().replace(" ", "_")
                new_id = await conn.fetchval("""
                    INSERT INTO karyawan_bps.users (nip, nama_lengkap, username, username_slug, role, last_login_at)
                    VALUES ($1, $2, $3, $4, 'karyawan', NOW())
                    RETURNING id;
                """, nip_clean, nama_clean, username_clean, slug)
                return {"id": str(new_id), "nip": nip_clean, "role": "karyawan", "nama_lengkap": nama_clean}
            else:
                await conn.execute(
                    "UPDATE karyawan_bps.users SET username = $1, last_login_at = NOW() WHERE nip = $2",
                    username_clean, nip_clean
                )
                return {
                    "id": str(user_row["id"]),
                    "nip": nip_clean,
                    "role": user_row["role"],
                    "nama_lengkap": nama_clean,
                }
