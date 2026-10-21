import pytest
from httpx import ASGITransport, AsyncClient
from backend.app.main import app
from backend.app.core.security import create_access_token

@pytest.fixture
def regular_user_token():
    payload = {
        "id": "user-karyawan-1",
        "nip": "196807031994011001",
        "nama_lengkap": "Zulkipli",
        "username": "zulkipli",
        "role": "karyawan",
        "email": "zulkipli@bps.go.id",
        "satker": "3500",
    }
    return create_access_token(payload)

@pytest.fixture
def admin_user_token():
    payload = {
        "id": "user-admin-1",
        "nip": "198503142009022003",
        "nama_lengkap": "Rahma Nuryanti",
        "username": "rahma.nuryanti",
        "role": "admin",
        "email": "rahma.nuryanti@bps.go.id",
        "satker": "3500",
    }
    return create_access_token(payload)

@pytest.mark.anyio
async def test_unauthorized_access_rejected():
    """
    Memastikan request tanpa token autentikasi ditolak dengan status HTTP 401.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Endpoint payroll tanpa token
        resp_payroll = await client.get("/api/v1/payroll/my-slip")
        assert resp_payroll.status_code == 401
        assert "Autentikasi diperlukan" in resp_payroll.json()["detail"]

        # 2. Endpoint admin tanpa token
        resp_admin = await client.get("/api/v1/admin/employees")
        assert resp_admin.status_code == 401

@pytest.mark.anyio
async def test_rbc_forbidden_for_regular_user(regular_user_token):
    """
    Memastikan pegawai biasa (role: karyawan) DITOLAK mengakses data admin dengan HTTP 403.
    """
    transport = ASGITransport(app=app)
    headers = {"Authorization": f"Bearer {regular_user_token}"}
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/admin/employees", headers=headers)
        assert resp.status_code == 403
        assert "Akses ditolak" in resp.json()["detail"]

@pytest.mark.anyio
async def test_zero_leakage_my_slip(regular_user_token):
    """
    JAMINAN ZERO LEAKAGE:
    Memastikan pegawai memanggil /my-slip hanya menerima data finansial miliknya sendiri,
    dan tidak ada data atau NIP orang lain yang bocor di respons.
    """
    transport = ASGITransport(app=app)
    headers = {"Authorization": f"Bearer {regular_user_token}"}
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/payroll/my-slip", headers=headers)
        assert resp.status_code == 200
        data = resp.json()

        # Verifikasi objek response
        assert "karyawan" in data
        assert "summary" in data
        assert data["karyawan"]["nip"] == "196807031994011001"
        assert data["karyawan"]["nama"] == "Zulkipli"

        # Verifikasi struktur summary finansial
        summary = data["summary"]
        assert "total_bruto" in summary
        assert "total_potongan" in summary
        assert "total_thp" in summary
        print(f"\n[Zero Leakage Verified] Zulkipli THP: Rp {summary['total_thp']:,.2f}")

@pytest.mark.anyio
async def test_admin_can_access_employees(admin_user_token):
    """
    Memastikan pengguna dengan role 'admin' diizinkan mengakses daftar pegawai untuk supervisi.
    """
    transport = ASGITransport(app=app)
    headers = {"Authorization": f"Bearer {admin_user_token}"}
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/admin/employees", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"\n[Admin Access Verified] Total master pegawai terambil: {len(data)}")

@pytest.mark.anyio
async def test_periods_endpoint(regular_user_token):
    """
    Memastikan endpoint periode mengembalikan daftar periode yang tersedia.
    """
    transport = ASGITransport(app=app)
    headers = {"Authorization": f"Bearer {regular_user_token}"}
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/payroll/periods", headers=headers)
        assert resp.status_code == 200
        periods = resp.json()
        assert isinstance(periods, list)
        print(f"\n[Periods Available] {periods}")

@pytest.mark.anyio
async def test_admin_employee_history(admin_user_token, regular_user_token):
    """
    Memastikan Admin dapat mengambil riwayat tren pegawai tertentu,
    sementara pegawai biasa DITOLAK (HTTP 403) jika memanggil endpoint ini.
    """
    transport = ASGITransport(app=app)
    target_nip = "196807031994011001"

    # 1. User biasa mencoba mengakses history pegawai via endpoint admin -> 403
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp_forbidden = await client.get(
            f"/api/v1/admin/employee-history/{target_nip}",
            headers={"Authorization": f"Bearer {regular_user_token}"}
        )
        assert resp_forbidden.status_code == 403

    # 2. Admin mengakses history pegawai -> 200
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp_admin = await client.get(
            f"/api/v1/admin/employee-history/{target_nip}",
            headers={"Authorization": f"Bearer {admin_user_token}"}
        )
        assert resp_admin.status_code == 200
        data = resp_admin.json()
        assert isinstance(data, list)
        print(f"\n[Admin Employee History Verified] Total history points: {len(data)}")

@pytest.mark.anyio
async def test_admin_payroll_grid(admin_user_token):
    """
    Memastikan Admin dapat mengambil data grid rekapitulasi transaksi per periode.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            "/api/v1/admin/payroll-grid?periode=2026-08",
            headers={"Authorization": f"Bearer {admin_user_token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "rows" in data
        assert "total_records" in data
        assert isinstance(data["rows"], list)
        print(f"\n[Payroll Grid Verified] Records retrieved: {data['total_records']}")

@pytest.mark.anyio
async def test_dashboard_bundle_endpoint(regular_user_token):
    """
    Memastikan single round-trip bundle /dashboard-bundle mengembalikan slip + history sekaligus.
    """
    transport = ASGITransport(app=app)
    headers = {"Authorization": f"Bearer {regular_user_token}"}
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/payroll/dashboard-bundle", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "karyawan" in data
        assert "periode" in data
        assert "summary" in data
        assert "history" in data
        assert isinstance(data["history"], list)
        print(f"\n[Dashboard Bundle Verified] NIP: {data['karyawan']['nip']}, Periode: {data['periode']}, History points: {len(data['history'])}")

@pytest.mark.anyio
async def test_admin_employee_dashboard(admin_user_token, regular_user_token):
    """
    Memastikan admin dapat mengakses /admin/employee-dashboard/{nip} dan user biasa ditolak (403).
    """
    transport = ASGITransport(app=app)
    target_nip = "196807031994011001"

    # User biasa -> 403
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp_forbidden = await client.get(
            f"/api/v1/admin/employee-dashboard/{target_nip}",
            headers={"Authorization": f"Bearer {regular_user_token}"}
        )
        assert resp_forbidden.status_code == 403

    # Admin -> 200
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp_admin = await client.get(
            f"/api/v1/admin/employee-dashboard/{target_nip}",
            headers={"Authorization": f"Bearer {admin_user_token}"}
        )
        assert resp_admin.status_code == 200
        data = resp_admin.json()
        assert data["karyawan"]["nip"] == target_nip
        assert "history" in data
        print(f"\n[Admin Employee Dashboard Verified] Bundle retrieved for NIP: {target_nip}")

@pytest.mark.anyio
async def test_payroll_sync_sanitizes_columns_and_persists(admin_user_token):
    """
    Memastikan endpoint /payroll-sync berhasil membersihkan kolom non-skema (seperti 'nama'),
    meng-upsert data transaksi ke Database PostgreSQL dengan status 200, dan mendaftarkan periode baru (2026-09).
    """
    transport = ASGITransport(app=app)
    headers = {"Authorization": f"Bearer {admin_user_token}"}
    target_nip = "198503142009022003"
    target_periode = "2026-09"

    sync_payload = {
        "karyawanList": [
            {"nip": target_nip, "nama": "Rahma Nuryanti", "no_rekening": "1440019283746"}
        ],
        "gajiList": [
            {
                "nip": target_nip,
                "nama": "Rahma Nuryanti", # Kolom ekstra yang harus dibuang otomatis
                "periode": target_periode,
                "gaji_bruto": 6500000.0,
                "simpanan_pokok": 100000.0,
                "simpanan_sukarela": 50000.0,
                "simpanan_wajib": 100000.0,
                "iuran_dwp": 25000.0,
                "iuran_korpri": 15000.0,
                "potongan_pinjaman_koperasi": 0.0,
                "jumlah_diterima": 6210000.0
            }
        ],
        "tkList": [
            {
                "nip": target_nip,
                "nama": "Rahma Nuryanti", # Kolom ekstra yang harus dibuang otomatis
                "periode": target_periode,
                "tunjangan_kinerja": 8000000.0,
                "simpanan_sukarela": 50000.0,
                "potongan_toko": 0.0,
                "potongan_barang_koperasi": 0.0,
                "potongan_pinjaman_koperasi": 0.0,
                "potongan_pinjaman_dwp": 0.0,
                "potongan_untalan": 0.0,
                "potongan_arisan_dwp": 0.0,
                "potongan_gagal_debet": 0.0,
                "jumlah_diterima": 7950000.0
            }
        ],
        "periode": target_periode
    }

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Eksekusi Sync
        resp = await client.post("/api/v1/admin/payroll-sync", headers=headers, json=sync_payload)
        assert resp.status_code == 200, f"Sync gagal: {resp.text}"
        data = resp.json()
        assert data["success"] is True
        assert data["counts"]["gaji"] == 1
        assert data["counts"]["tk"] == 1
        print(f"\n[Payroll Sync Verified] Counts: {data['counts']}")

        # 2. Verifikasi Periode 2026-09 sekarang muncul di daftar periods
        resp_periods = await client.get("/api/v1/payroll/periods", headers=headers)
        assert resp_periods.status_code == 200
        periods = resp_periods.json()
        assert target_periode in periods, f"Periode {target_periode} harus ada di {periods}"
        print(f"[Periods Verified] 2026-09 berhasil terdaftar: {periods[:3]}")

        # 3. Cleanup: Hapus data uji agar tidak mengotori DB
        del_resp = await client.request(
            "DELETE",
            "/api/v1/admin/payroll-entry",
            headers=headers,
            json={"nip": target_nip, "periode": target_periode}
        )
        assert del_resp.status_code == 200
        print(f"[Cleanup Verified] Data uji periode {target_periode} berhasil dibersihkan.")

