# HaloPay Backend Service (FastAPI)

Layanan backend REST API mandiri (*dedicated service*) untuk Sistem Pemantauan Pendapatan & Tunjangan Kinerja Pegawai BPS Jatim (HaloPay). Dibangun menggunakan **Python 3.11** dan framework **FastAPI** dengan jaminan **Zero Data Leakage**, pengolahan query paralel (`asyncio.gather`), persistent connection pooling (`httpx`), dan autentikasi berbasis JWT / Keycloak SSO.

---

## 🏛️ Arsitektur & Peran Layanan

Backend ini berfungsi sebagai gerbang data tunggal (*Single Source of Truth*) yang memisahkan seluruh query data sensitif dari browser client:
* **Zero Data Leakage:** Menggantikan query client-side langsung ke basis data. NIP dan data finansial pegawai lain tidak dapat diintip melalui browser DevTools (Inspect Network/Payload).
* **Paralelisasi & Agregasi:** Menyediakan endpoint komposit berkecepatan tinggi seperti `/api/v1/payroll/dashboard-bundle` yang menggabungkan nota slip dan grafik riwayat dalam 1 round-trip HTTP (<80 ms).
* **Sanitasi Skema Otomatis:** Menangani batch upsert data gaji dan tunjangan kinerja dengan pembersihan kolom non-skema secara ketat, serta mendeteksi otomatis (*auto-discovery*) pegawai baru untuk didaftarkan ke tabel master `karyawan`.

---

## 📁 Struktur Direktori Backend

```text
backend/
├── app/
│   ├── api/                    # Router Controller API v1
│   │   ├── admin.py            # Endpoint supervisi admin, payroll-sync, RBAC, CRUD
│   │   ├── auth.py             # Endpoint autentikasi & Keycloak OIDC helper
│   │   └── payroll.py          # Endpoint slip gaji, riwayat charts, & dashboard-bundle
│   ├── core/                   # Konfigurasi inti dan akses basis data
│   │   ├── config.py           # Pydantic Settings & pemuatan file .env
│   │   ├── database.py         # Pemeriksaan koneksi & healthcheck basis data
│   │   ├── repository.py       # Data Access Layer berkinerja tinggi (connection pool)
│   │   └── security.py         # Verifikasi JWT, dependensi RBAC (admin/karyawan)
│   ├── models/                 # Model ORM SQLAlchemy
│   │   ├── base.py             # DeclarativeBase
│   │   ├── karyawan.py         # Model Karyawan
│   │   ├── user.py             # Model User RBAC
│   │   ├── gaji.py             # Model GajiBulanan
│   │   ├── tk.py               # Model TKBulanan
│   ├── schemas/                # Skema validasi Pydantic (Request/Response)
│   │   ├── admin.py            # Skema input payload admin, sync, & grid
│   │   ├── auth.py             # Skema sesi pengguna & profil pegawai
│   │   └── payroll.py          # Skema slip gaji, ringkasan finansial, & bundle
│   └── main.py                 # Titik masuk utama FastAPI Application & middleware CORS
├── tests/                      # Rangkaian pengujian otomatis (Pytest & AnyIO)
│   ├── test_health.py          # Uji root & healthcheck endpoint
│   └── test_payroll_and_security.py # Uji Zero Leakage, RBAC, sanitasi, & bundle
├── .dockerignore               # Berkas pengecualian Docker
├── .env.example                # Templat variabel lingkungan
├── Dockerfile                  # Konfigurasi multi-stage Docker image backend
├── requirements.txt            # Daftar pustaka Python produksi & pengujian
└── run.py                      # Skrip peluncur Uvicorn mandiri
```

---

## ⚙️ Persyaratan Sistem (Lokal)

* **Python:** Versi 3.11 atau lebih baru
* **Pip / Virtualenv:** Package manager Python bawaan

---

## 🚀 Panduan Menjalankan di Lingkungan Lokal (Tanpa Docker)

### 1. Masuk ke Direktori Backend
```bash
cd backend
```

### 2. Buat dan Aktifkan Virtual Environment
* **Windows (PowerShell):**
  ```powershell
  python -m venv venv
  .\venv\Scripts\Activate.ps1
  ```
* **Linux / macOS:**
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  ```

### 3. Pasang Seluruh Dependensi
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Konfigurasi Variabel Lingkungan (`.env`)
Salin templat konfigurasi dan sesuaikan nilainya:
```bash
cp .env.example .env
```
Isi konfigurasi standar pada `.env`:
```ini
PROJECT_NAME="HaloPay BPS Jatim Backend"
API_V1_STR="/api/v1"

# Database PostgreSQL On-Premise (asyncpg)
DATABASE_URL=postgresql://your_db_user:your_secure_password@localhost:5432/halopay_db

# Keycloak SSO OIDC Configuration
KEYCLOAK_URL=your_keycloak_url_here
KEYCLOAK_REALM=your_keycloak_realm_here
KEYCLOAK_CLIENT_ID=your_keycloak_client_id_here

# JWT Sesi Internal (Dikelola penuh oleh Backend)
JWT_SECRET=your_super_secure_random_jwt_secret_key_here
JWT_ALGORITHM="HS256"


# CORS Origins
CORS_ORIGINS='["http://localhost:3000","http://127.0.0.1:3000"]'
```

### 5. Jalankan Backend Server
Jalankan server pengembangan dengan fitur *auto-reload*:
```bash
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```
Atau gunakan skrip bantu bawaan:
```bash
python run.py
```

Server backend akan aktif di:
* **API Base:** `http://127.0.0.1:8000`
* **Dokumentasi Interaktif (Swagger UI):** `http://127.0.0.1:8000/docs`
* **Dokumentasi Alternatif (ReDoc):** `http://127.0.0.1:8000/redoc`
* **Healthcheck:** `http://127.0.0.1:8000/api/health`

---

## 🧪 Menjalankan Pengujian Otomatis (Pytest)

Pastikan virtual environment telah aktif, lalu jalankan perintah:
```bash
pytest -v -s tests/
```
Pengujian mencakup:
* Keamanan endpoint unauthorized & verifikasi hak akses admin (RBAC 403)
* Validasi **Zero Data Leakage** pada `/api/v1/payroll/my-slip`
* Uji sanitasi payload dan persistensi pada `/api/v1/admin/payroll-sync`
* Validasi agregasi komposit `/api/v1/payroll/dashboard-bundle`
