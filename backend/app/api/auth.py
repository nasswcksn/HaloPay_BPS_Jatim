from fastapi import APIRouter, Depends
from backend.app.core.security import get_current_user, create_access_token
from backend.app.core.keycloak import authenticate_and_extract_identity
from backend.app.schemas.auth import UserSession, UserProfile, SyncSessionPayload, SyncSessionResponse
from backend.app.core.repository import PayrollRepository

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/sync-session", response_model=SyncSessionResponse)
async def sync_session(payload: SyncSessionPayload):
    """
    Sinkronisasi session pegawai pasca-login SSO Keycloak dan menerbitkan token sesi JWT.
    Memvalidasi integritas tanda tangan digital Keycloak OIDC (RS256 JWKS) sebelum menerbitkan sesi.
    """
    # 1. Validasi token Keycloak secara kriptografis & ekstrak identitas resmi
    identity = await authenticate_and_extract_identity(
        id_token=payload.id_token,
        access_token=payload.access_token,
    )

    # 2. Sinkronkan profil pegawai & akun pengguna ke database lokal
    result = await PayrollRepository.sync_user_session(
        nip=identity["nip"],
        nama=identity["nama"],
        username=identity["username"],
        email=identity["email"],
        jabatan=identity["jabatan"],
        satker=identity["satker"],
    )
    user_id = str(result["id"])
    nip_val = str(result["nip"])
    role_val = result.get("role", "karyawan")
    nama_val = str(result.get("nama_lengkap", identity["nama"]))

    # 3. Backend menerbitkan JWT access token sesi internal yang ditandatangani backend
    token_claims = {
        "id": user_id,
        "nip": nip_val,
        "nama_lengkap": nama_val,
        "username_slug": identity["username"],
        "username": identity["username"],
        "role": role_val,
        "email": identity["email"],
        "jabatan": identity["jabatan"],
        "satker": identity["satker"] or "3500",
    }
    access_token = create_access_token(data=token_claims)

    return SyncSessionResponse(
        id=user_id,
        nip=nip_val,
        role=role_val,
        nama_lengkap=nama_val,
        access_token=access_token,
        token_type="bearer",
    )


@router.get("/me", response_model=UserSession)
async def get_my_session(current_user: UserSession = Depends(get_current_user)):
    """
    Mengembalikan metadata sesi pengguna yang sedang terautentikasi (berdasarkan token OIDC).
    """
    return current_user

@router.get("/profile", response_model=UserProfile)
async def get_my_profile(current_user: UserSession = Depends(get_current_user)):
    """
    Mengambil data profil master pegawai dari database untuk NIP yang sedang login.
    """
    karyawan = await PayrollRepository.get_karyawan_by_nip(current_user.nip)
    if not karyawan:
        return UserProfile(
            nip=current_user.nip,
            nama=current_user.nama_lengkap,
            no_rekening="-",
            email=current_user.email,
            jabatan=current_user.jabatan,
            satker=current_user.satker or "3500",
            role=current_user.role,
        )

    return UserProfile(
        nip=karyawan.get("nip", current_user.nip),
        nama=karyawan.get("nama", current_user.nama_lengkap),
        no_rekening=karyawan.get("no_rekening", "-"),
        email=karyawan.get("email") or current_user.email,
        jabatan=karyawan.get("jabatan") or current_user.jabatan,
        satker=karyawan.get("satker") or current_user.satker or "3500",
        role=current_user.role,
    )

