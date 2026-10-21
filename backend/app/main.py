import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.core.config import settings
from backend.app.core.database import check_database_connection
from backend.app.api import auth, payroll, admin

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Dedicated Backend REST API untuk Sistem Pemantauan Pendapatan & TK Pegawai BPS Jatim (HaloPay) dengan jaminan Zero Data Leakage.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
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

START_TIME = time.time()

# Daftarkan Router API v1
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(payroll.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)

@app.get("/", tags=["Root"])
async def root():
    return {
        "app": settings.PROJECT_NAME,
        "version": "1.0.0",
        "status": "online",
        "docs_url": "/docs",
        "timestamp": time.time(),
    }

@app.get("/api/health", tags=["Health"])
@app.get("/api/v1/health", tags=["Health"])
async def health_check():
    """
    Endpoint pemantauan kesehatan sistem dan uji latensi basis data.
    """
    uptime_seconds = round(time.time() - START_TIME, 2)
    db_status = await check_database_connection()
    
    is_healthy = db_status.get("connected", False)
    
    return {
        "status": "healthy" if is_healthy else "degraded",
        "app": settings.PROJECT_NAME,
        "uptime_seconds": uptime_seconds,
        "database": db_status,
        "keycloak": {
            "url": settings.KEYCLOAK_URL,
            "realm": settings.KEYCLOAK_REALM,
            "client_id": settings.KEYCLOAK_CLIENT_ID,
        },
    }
