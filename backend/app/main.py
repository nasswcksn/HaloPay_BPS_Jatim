from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from backend.app.core.config import settings
from backend.app.core.database import check_database_connection
from backend.app.api import auth, payroll, admin

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Dedicated Backend REST API untuk Sistem Pemantauan Pendapatan & TK Pegawai BPS Jatim (HaloPay) dengan jaminan Zero Data Leakage.",
    version="1.0.0",
    docs_url="/docs" if settings.ENABLE_DOCS else None,
    redoc_url="/redoc" if settings.ENABLE_DOCS else None,
    openapi_url="/openapi.json" if settings.ENABLE_DOCS else None,
)

# Konfigurasi CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Daftarkan Router API v1
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(payroll.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)

@app.get("/", tags=["Root"])
async def root():
    return {"app": settings.PROJECT_NAME, "status": "online"}

@app.get("/api/health", tags=["Health"], include_in_schema=False)
async def health_check():
    """
    Healthcheck internal kontainer Docker. Berada di luar /api/v1 sehingga tidak diteruskan
    oleh proxy frontend, dan hanya mengembalikan status tanpa detail infrastruktur.
    """
    db_status = await check_database_connection()
    if db_status.get("connected", False):
        return {"status": "healthy"}
    return JSONResponse(status_code=503, content={"status": "degraded"})
