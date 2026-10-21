from typing import Optional, Literal
from pydantic import BaseModel

class UserSession(BaseModel):
    id: str
    nip: str
    nama_lengkap: str
    username: str
    role: Literal["admin", "karyawan"]
    email: Optional[str] = None
    jabatan: Optional[str] = None
    satker: Optional[str] = "3500"

class UserProfile(BaseModel):
    nip: str
    nama: str
    no_rekening: Optional[str] = "-"
    email: Optional[str] = None
    jabatan: Optional[str] = None
    satker: Optional[str] = "3500"
    role: Literal["admin", "karyawan"] = "karyawan"

class SyncSessionPayload(BaseModel):
    id_token: Optional[str] = None
    access_token: Optional[str] = None

class SyncSessionResponse(BaseModel):
    id: str
    nip: str
    role: Literal["admin", "karyawan"] = "karyawan"
    nama_lengkap: str
    access_token: str
    token_type: str = "bearer"


