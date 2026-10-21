# Panduan Orkestrasi Kontainer Docker & Docker Compose: HaloPay BPS Jatim

Dokumentasi ini menyediakan panduan operasional sistematis untuk membangun (*build image*), membuat kontainer (*create container*), dan menjalankan (*run container*) seluruh layanan **HaloPay** (Database PostgreSQL On-Premise, Backend FastAPI, dan Frontend Next.js) baik secara **terorkestrasi (Docker Compose)** maupun secara **mandiri/individual (Docker CLI)**.

---

## 🏛️ Topologi Jaringan & Arsitektur Kontainer

Layanan berjalan di atas jaringan terisolasi Docker Bridge bernama `halopay-network`:

```mermaid
flowchart TD
    Browser["Peramban Klien (Host: Browser)"]
    
    subgraph DockerBridge["Docker Network: halopay-network"]
        Frontend["Kontainer Frontend (halopay-frontend)<br/>Next.js Standalone • Port 3000 (Host: 3005)"]
        Backend["Kontainer Backend (halopay-backend)<br/>FastAPI ASGI • Port 8000 (Host: 8005)"]
        DB[("Kontainer Database (halopay-db)<br/>PostgreSQL 16 Alpine • Port 5432")]
    end

    Browser -->|Akses UI: http://server-ip:3005| Frontend
    Browser -->|Akses API/Docs: http://server-ip:8005/docs| Backend
    Frontend -->|Internal Proxy: http://backend:8000| Backend
    Backend -->|Koneksi asyncpg (Zero Leakage)| DB
```

### Pemetaan Port & Alur Komunikasi:
* **Host Port `3005` (atau `3000`) $\rightarrow$ Kontainer Frontend:** Melayani tampilan antarmuka web Next.js.
* **Host Port `8005` (atau `8000`) $\rightarrow$ Kontainer Backend:** Melayani endpoint REST API FastAPI dan dokumentasi Swagger UI.
* **Host Port `5432` $\rightarrow$ Kontainer Database:** PostgreSQL Server lokal (skema `karyawan_bps`).
* **Komunikasi Antar-Kontainer:** Frontend meneruskan permintaan `/api/v1/*` ke backend secara internal melalui alamat `http://backend:8000`. Backend mengakses database melalui nama host DNS `db:5432`.
* **Prinsip Keamanan:**
  * `JWT_SECRET` hanya dikelola dan didefinisikan pada backend & file `.env` root, **tidak pernah diletakkan di frontend**.
  * Password database tidak pernah ditulis *hardcoded* di berkas `docker-compose.yml`, melainkan diinjeksikan secara aman dari berkas `.env`.
  * Tidak ada ketergantungan pada layanan cloud pihak ketiga (Supabase).

---

## 📋 Prasyarat Sistem

1. **Docker Desktop** (Windows / macOS) atau **Docker Engine + Docker Compose v2** (Linux Server).
2. Verifikasi instalasi melalui terminal:
   ```bash
   docker --version
   docker compose version
   ```

---

## 🚀 METODE 1: Menjalankan Terorkestrasi (Docker Compose — Direkomendasikan)

Metode ini mengotomatiskan pembuatan jaringan, persistensi volume data database, pembangunan image kedua service, dan pengaturan urutan peluncuran kontainer (*dependency graph*).

### Langkah 1: Persiapan Variabel Lingkungan (`.env`)
Salin file `.env.example` di direktori utama menjadi `.env`:
```bash
cp .env.example .env
```

Sesuaikan nilai kredensial di dalam file `.env`:
```ini
# PostgreSQL Database Credentials
POSTGRES_USER=halopay_admin
POSTGRES_PASSWORD=ganti_dengan_password_aman_anda
POSTGRES_DB=halopay_db

# Backend Database URL
DATABASE_URL=postgresql://halopay_admin:ganti_dengan_password_aman_anda@db:5432/halopay_db

# JWT Secret Key (Hanya untuk backend)
JWT_SECRET=ganti_dengan_kunci_jwt_acak_rahasia_minimal_32_karakter

# Keycloak SSO OIDC
KEYCLOAK_URL=https://auth.majapah.it
KEYCLOAK_REALM=majapahit
KEYCLOAK_CLIENT_ID=halopay
NEXT_PUBLIC_APP_URL=http://localhost:3005

# Port Mapping (Opsional, bawaan: frontend 3005, backend 8005)
FRONTEND_PORT=3005
BACKEND_PORT=8005
```

### Langkah 2: Build Image & Jalankan Kontainer Sekaligus
Jalankan perintah berikut di direktori *root* proyek:
```bash
docker compose up --build -d
```
* **Penjelasan flag:**
  * `--build`: Memaksa pembangunan ulang image agar perubahan kode terbaru terkompilasi.
  * `-d` (*detached*): Menjalankan kontainer di latar belakang sehingga terminal tetap bebas.

### Langkah 3: Verifikasi Status Kontainer
Periksa status kontainer yang sedang berjalan:
```bash
docker compose ps
```
**Ekspektasi Output:**
```text
NAME                IMAGE                     COMMAND                  SERVICE    STATUS              PORTS
halopay-db          postgres:16-alpine        "docker-entrypoint.s…"   db         running (healthy)   0.0.0.0:5432->5432/tcp
halopay-backend     halopay-backend:latest    "uvicorn backend.app…"   backend    running (healthy)   0.0.0.0:8005->8000/tcp
halopay-frontend    halopay-frontend:latest   "node server.js"         frontend   running             0.0.0.0:3005->3000/tcp
```
> Urutan peluncuran: `db` (healthy) $\rightarrow$ `backend` (healthy) $\rightarrow$ `frontend` (running).

### Langkah 4: Memantau Log Kontainer Secara Realtime
* Memantau seluruh layanan:
  ```bash
  docker compose logs -f
  ```
* Memantau hanya layanan database:
  ```bash
  docker compose logs -f db
  ```
* Memantau hanya layanan backend:
  ```bash
  docker compose logs -f backend
  ```
* Memantau hanya layanan frontend:
  ```bash
  docker compose logs -f frontend
  ```

### Langkah 5: Menghentikan & Membersihkan Kontainer
Untuk mematikan seluruh layanan tanpa menghapus data database:
```bash
docker compose down
```
Jika ingin menghapus kontainer beserta *volume data* (Peringatan: menghapus isi database lokal):
```bash
docker compose down -v
```

---

## 🛠️ METODE 2: Menjalankan Secara Individual / Mandiri (Docker CLI)

Gunakan metode ini jika Anda ingin menguji atau menjalankan salah satu service secara terpisah.

### Langkah 1: Buat Jaringan Terisolasi (Bridge Network)
```bash
docker network create halopay-network
```

---

### Langkah 2: Jalankan Kontainer Database PostgreSQL
```bash
docker run -d \
  --name halopay-db \
  --network halopay-network \
  -p 5432:5432 \
  -e POSTGRES_USER=halopay_admin \
  -e POSTGRES_PASSWORD=your_secure_password \
  -e POSTGRES_DB=halopay_db \
  -v halopay_pgdata:/var/lib/postgresql/data \
  -v $(pwd)/database/init:/docker-entrypoint-initdb.d:ro \
  postgres:16-alpine
```

---

### Langkah 3: Build & Jalankan Backend FastAPI

1. **Build Image Backend:**
   ```bash
   docker build -t halopay-backend:latest ./backend
   ```
2. **Jalankan Kontainer Backend:**
   ```bash
   docker run -d \
     --name halopay-backend \
     --network halopay-network \
     -p 8005:8000 \
     -e PROJECT_NAME="HaloPay BPS Jatim Backend" \
     -e API_V1_STR="/api/v1" \
     -e DATABASE_URL="postgresql://halopay_admin:your_secure_password@halopay-db:5432/halopay_db" \
     -e JWT_SECRET="your_super_secure_random_jwt_secret_key_here" \
     -e KEYCLOAK_URL="https://auth.majapah.it" \
     -e KEYCLOAK_REALM="majapahit" \
     -e KEYCLOAK_CLIENT_ID="halopay" \
     -e CORS_ORIGINS='["http://localhost:3005","http://127.0.0.1:3005","http://frontend:3000"]' \
     halopay-backend:latest
   ```
3. **Cek Log Backend:**
   ```bash
   docker logs -f halopay-backend
   ```

---

### Langkah 4: Build & Jalankan Frontend Next.js

1. **Build Image Frontend:**
   ```bash
   docker build -t halopay-frontend:latest ./frontend
   ```
2. **Jalankan Kontainer Frontend:**
   *(Perhatikan: Tidak ada `JWT_SECRET` atau kredensial database di frontend)*
   ```bash
   docker run -d \
     --name halopay-frontend \
     --network halopay-network \
     -p 3005:3000 \
     -e PORT=3000 \
     -e HOSTNAME="0.0.0.0" \
     -e FASTAPI_INTERNAL_URL="http://halopay-backend:8000" \
     -e KEYCLOAK_URL="https://auth.majapah.it" \
     -e KEYCLOAK_REALM="majapahit" \
     -e KEYCLOAK_CLIENT_ID="halopay" \
     -e NEXT_PUBLIC_APP_URL="http://localhost:3005" \
     halopay-frontend:latest
   ```
3. **Cek Log Frontend:**
   ```bash
   docker logs -f halopay-frontend
   ```

---

## 🧪 Verifikasi & Uji Fungsional Kontainer

Setelah kontainer aktif, buka peramban Anda untuk menguji endpoint:

1. **Healthcheck Backend & Database:**
   Buka `http://localhost:8005/api/health` di browser atau jalankan terminal:
   ```bash
   curl http://localhost:8005/api/health
   ```
   **Respon yang Diharapkan:**
   ```json
   {
     "status": "healthy",
     "app": "HaloPay BPS Jatim Backend",
     "uptime_seconds": 12.4,
     "database": { "connected": true, "latency_ms": 15.2 }
   }
   ```
2. **Dokumentasi API Interaktif (Swagger UI):**
   Buka `http://localhost:8005/docs` untuk memeriksa seluruh rute endpoint API v1.
3. **Aplikasi Web Frontend:**
   Buka `http://localhost:3005` di browser:
   * Masuk melalui SSO Keycloak BPS.
   * Uji unduh slip nota, pergantian periode, dan unggah berkas Excel.
   * Periksa tab Network (F12) untuk memastikan seluruh request `/api/v1/*` diteruskan secara transparan tanpa kebocoran data.

---

## 🔧 Perintah Pemeliharaan & Troubleshooting

| Kebutuhan Operasional | Perintah Docker Compose |
| :--- | :--- |
| **Restart Salah Satu Service** | `docker compose restart backend` atau `docker compose restart frontend` |
| **Masuk ke Shell Kontainer** | `docker compose exec backend sh` atau `docker compose exec frontend sh` |
| **Akses Langsung ke Database via psql** | `docker compose exec db psql -U halopay_admin -d halopay_db` |
| **Melihat Penggunaan Sumber Daya (CPU/RAM)** | `docker stats` |
| **Pembersihan Cache & Image Kadaluarsa** | `docker system prune -f` |
| **Pengecekan Konfigurasi Compose** | `docker compose config` |
