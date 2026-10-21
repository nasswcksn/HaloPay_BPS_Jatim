from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException, status, Depends
from jose import jwt, JWTError
from backend.app.core.config import settings
from backend.app.schemas.auth import UserSession

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Membuat token JWT dengan durasi masa berlaku standar (8 jam).
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=8)
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Mendekode dan memvalidasi integritas tanda tangan token JWT.
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        return None

async def get_current_user(request: Request) -> UserSession:
    """
    Ekstraksi dan validasi identitas pengguna dari HTTP Header atau Cookie 'bps_payroll_session'.
    Menolak request jika token tidak ada, rusak, atau kedaluwarsa.
    """
    token: Optional[str] = None
    
    # 1. Cek Header Authorization: Bearer <token>
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1].strip()
        
    # 2. Fallback ke Cookie bps_payroll_session
    if not token:
        token = request.cookies.get("bps_payroll_session")
        
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autentikasi diperlukan. Silakan masuk terlebih dahulu melalui SSO BPS.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesi login tidak sah atau telah kedaluwarsa.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    nip = payload.get("nip")
    if not nip:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Klaim NIP tidak ditemukan pada tiket autentikasi.",
        )
        
    return UserSession(
        id=str(payload.get("id", nip)),
        nip=str(nip),
        nama_lengkap=str(payload.get("nama_lengkap", payload.get("name", "Pegawai BPS"))),
        username=str(payload.get("username", payload.get("username_slug", nip))),
        role=payload.get("role", "karyawan"),
        email=payload.get("email"),
        jabatan=payload.get("jabatan"),
        satker=payload.get("satker", "3500"),
    )

async def require_admin(current_user: UserSession = Depends(get_current_user)) -> UserSession:
    """
    Dependency pemeriksa otorisasi RBAC Administrator.
    Menolak pegawai biasa dengan status 403 Forbidden.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak. Fitur ini hanya dapat diakses oleh Administrator.",
        )
    return current_user
