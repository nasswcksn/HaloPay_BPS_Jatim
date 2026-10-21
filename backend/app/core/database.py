import time
import asyncpg
from typing import Dict, Any, Optional
from backend.app.core.config import settings

# Inisialisasi Asynchronous Connection Pool PostgreSQL
_pg_pool: Optional[asyncpg.Pool] = None

async def get_pg_pool() -> Optional[asyncpg.Pool]:
    """
    Mengembalikan asyncpg Connection Pool ke database PostgreSQL on-premise.
    """
    global _pg_pool
    if not settings.DATABASE_URL:
        return None
    if _pg_pool is None:
        try:
            dsn = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
            _pg_pool = await asyncpg.create_pool(
                dsn=dsn,
                min_size=2,
                max_size=20,
                command_timeout=30.0,
            )
        except Exception as e:
            print(f"Warning: Gagal membuat asyncpg connection pool: {e}")
            return None
    return _pg_pool

async def check_database_connection() -> Dict[str, Any]:
    """
    Memeriksa konektivitas dan mengukur latensi ke database PostgreSQL on-premise via asyncpg.
    """
    start_time = time.perf_counter()
    if not settings.DATABASE_URL:
        return {
            "connected": False,
            "provider": "local_postgresql_docker",
            "schema": "karyawan_bps",
            "latency_ms": 0.0,
            "error": "DATABASE_URL environment variable is not configured.",
        }

    try:
        pool = await get_pg_pool()
        if pool:
            async with pool.acquire() as conn:
                count = await conn.fetchval("SELECT COUNT(*) FROM karyawan_bps.karyawan")
                latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
                return {
                    "connected": True,
                    "provider": "local_postgresql_docker",
                    "schema": "karyawan_bps",
                    "latency_ms": latency_ms,
                    "sample_records_accessible": True,
                    "total_karyawan": count,
                    "status_code": 200,
                }
        else:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "connected": False,
                "provider": "local_postgresql_docker",
                "schema": "karyawan_bps",
                "latency_ms": latency_ms,
                "error": "Failed to acquire asyncpg connection pool.",
            }
    except Exception as exc:
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return {
            "connected": False,
            "provider": "local_postgresql_docker",
            "schema": "karyawan_bps",
            "latency_ms": latency_ms,
            "error": str(exc),
        }

