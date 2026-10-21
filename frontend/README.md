# HaloPay Frontend Service (Next.js 16)

Antarmuka web modern (*User Interface*) untuk Sistem Pemantauan Pendapatan & Tunjangan Kinerja Pegawai BPS Jatim (HaloPay). Dibangun menggunakan **Next.js 16 (App Router)** dengan **Turbopack**, **React 19**, **Tailwind CSS v4**, **Recharts**, dan **Lucide Icons**.

---

## 🏛️ Arsitektur & Pola Komunikasi

* **Zero Direct Client DB Access:** Seluruh komponen client tidak memanggil basis data secara langsung. Seluruh kebutuhan data diarahkan ke proxy backend internal.
* **Smart Dynamic API Proxy (`app/api/v1/[...path]/route.ts`):**
  Setiap permintaan client ke path `/api/v1/*` diteruskan secara dinamis saat runtime oleh Next.js server engine ke Backend FastAPI (`FASTAPI_INTERNAL_URL`):
  * **Di Lingkungan Lokal:** diteruskan ke `http://127.0.0.1:8000`
  * **Di Kontainer Docker:** diteruskan ke `http://backend:8000` via jaringan internal bridge
* **Autentikasi Aman & Stateless:** Sesi login disimpan dalam cookie `HttpOnly` bernama `bps_payroll_session` yang ditandatangani secara kriptografis menggunakan token JWT (HS256).

---

## 📁 Struktur Direktori Frontend

```text
frontend/
├── app/                        # App Router Pages & Layouts
│   ├── admin/
│   │   ├── data/page.tsx       # Panel Kendali Data (Grid CRUD Transaksi & RBAC)
│   │   └── upload/page.tsx     # Smart Spreadsheet Auto-ETL Ingestion
│   ├── api/
│   │   ├── auth/               # Route Handlers Autentikasi Internal (Sesi, Me, Logout)
│   │   └── v1/[...path]/       # Dynamic Catch-All Proxy ke Backend FastAPI (Runtime)
│   ├── dashboard/page.tsx      # Dashboard Nota Slip & Grafik Tren Analitik Karyawan
│   ├── login/page.tsx          # Halaman Masuk Terpadu Akun Pegawai
│   ├── globals.css             # Konfigurasi Tailwind CSS v4 & Styling Cetak (@media print)
│   ├── layout.tsx              # Root Layout & Metadata Dokumen
│   └── page.tsx                # Gerbang Root Redirector (ke /dashboard atau /login)
├── components/                 # Komponen Antarmuka Moduler (UI Components)
│   ├── deductions-breakdown.tsx # Waterfall visualisasi aliran pendapatan & potongan
│   ├── history-charts.tsx      # Grafik tren historis pendapatan berbasis Recharts
│   ├── navbar.tsx              # Navigasi utama, status sesi, & trigger modal profil
│   ├── pay-slip-card.tsx       # Nota rincian slip gaji & TK format resmi siap cetak A4
│   └── profile-modal.tsx       # Modal profil pegawai & fitur ubah kata sandi mandiri
├── public/                     # Aset statis publik (logo BPS, favicon, gambar)
├── scripts/                    # Skrip utilitas pengujian & verifikasi basis data
├── utils/                      # Helper & Business Logic
│   ├── auth.ts                 # Utilitas enkripsi JWT (jose) & verifikasi cookie sesi
│   └── etl.ts                  # Parser cerdas Excel (SheetJS), normalisasi rupiah & format periode
├── .dockerignore               # Pengecualian berkas build Docker
├── .env.example                # Templat konfigurasi lingkungan lokal
├── Dockerfile                  # Multi-stage production build Dockerfile (standalone runner)
├── middleware.ts               # Pelindung rute URL berbasis sesi (Route Guards)
├── next.config.mjs             # Konfigurasi Next.js (output standalone & proxy rewrites)
├── package.json                # Daftar pustaka & skrip NPM
└── tsconfig.json               # Konfigurasi compiler TypeScript
```

---

## ⚙️ Persyaratan Sistem (Lokal)

* **Node.js:** Versi 20.x atau 22.x LTS
* **Package Manager:** `npm` (disarankan) atau `pnpm` / `yarn`

---

## 🚀 Panduan Menjalankan di Lingkungan Lokal (Tanpa Docker)

### 1. Masuk ke Direktori Frontend
```bash
cd frontend
```

### 2. Pasang Seluruh Dependensi
```bash
npm install
```

### 3. Konfigurasi Variabel Lingkungan (`.env.local`)
Buat berkas `.env.local` pada folder `frontend`:
```bash
cp .env.example .env.local
```
Isi konfigurasi pada `.env.local`:
```ini
# Internal FastAPI Proxy Destination (Lokal)
FASTAPI_INTERNAL_URL="http://127.0.0.1:8000"

# Keycloak SSO BPS (OIDC)
KEYCLOAK_URL=https://auth.majapah.it
KEYCLOAK_REALM=majapahit
KEYCLOAK_CLIENT_ID=halopay
NEXT_PUBLIC_APP_URL=http://localhost:3000
```


### 4. Jalankan Server Pengembangan (Dev Server)
```bash
npm run dev
```
Aplikasi frontend akan aktif di:
* **URL:** `http://localhost:3000`

### 5. Kompilasi & Menjalankan Mode Produksi (Opsional)
```bash
# Kompilasi berkas produksi Next.js
npm run build

# Menjalankan server produksi
npm run start
```
---

## 🖨️ Cetak Nota Resmi (Format A4)
Komponen [PaySlipCard](file:///c:/COOLYEAHH/semester_7_(INTERNSHIP)/sistem_payroll/frontend/components/pay-slip-card.tsx) telah dilengkapi dengan CSS media `@media print`. Saat tombol **Cetak Nota** ditekan atau menggunakan pintasan keyboard `Ctrl + P`, seluruh elemen navigasi, tombol, dan banner otomatis disembunyikan sehingga dokumen tercetak rapi sesuai standar kop dinas Badan Pusat Statistik.
