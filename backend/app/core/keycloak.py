import time
import logging
from typing import Dict, Any, Optional
import httpx
from fastapi import HTTPException, status
from jose import jwt, jwk, JWTError
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

# In-Memory Cache untuk Public Keys Keycloak (JWKS)
_jwks_cache: Optional[Dict[str, Any]] = None
_jwks_cache_time: float = 0.0
JWKS_CACHE_TTL: float = 3600.0  # 1 jam

def get_keycloak_issuer() -> str:
    return f"{settings.KEYCLOAK_URL.rstrip('/')}/realms/{settings.KEYCLOAK_REALM}"

def get_keycloak_jwks_url() -> str:
    return f"{get_keycloak_issuer()}/protocol/openid-connect/certs"

def get_keycloak_userinfo_url() -> str:
    return f"{get_keycloak_issuer()}/protocol/openid-connect/userinfo"

async def fetch_keycloak_jwks(force_refresh: bool = False) -> Dict[str, Any]:
    """
    Mengunduh Public Key Set (JWKS) dari server Keycloak dengan caching in-memory.
    """
    global _jwks_cache, _jwks_cache_time
    now = time.time()
    
    if not force_refresh and _jwks_cache and (now - _jwks_cache_time < JWKS_CACHE_TTL):
        return _jwks_cache

    jwks_url = get_keycloak_jwks_url()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(jwks_url)
            if resp.status_code != 200:
                logger.error(f"Gagal mengunduh JWKS Keycloak dari {jwks_url}, status: {resp.status_code}")
                if _jwks_cache:
                    return _jwks_cache  # Fallback ke cache sebelumnya jika Keycloak sempat error
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Tidak dapat menghubungi server autentikasi Keycloak BPS (JWKS HTTP {resp.status_code})."
                )
            data = resp.json()
            _jwks_cache = data
            _jwks_cache_time = now
            return data
    except httpx.RequestError as exc:
        logger.error(f"Koneksi ke Keycloak JWKS endpoint gagal: {exc}")
        if _jwks_cache:
            return _jwks_cache
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Gagal menghubungi server autentikasi Keycloak BPS. Periksa koneksi jaringan server."
        )

async def verify_keycloak_jwt(token: str, access_token: Optional[str] = None) -> Dict[str, Any]:
    """
    Memverifikasi tanda tangan kriptografis token Keycloak (RS256) menggunakan JWKS public keys,
    serta memvalidasi issuer (iss), audience/azp (aud), dan masa berlaku (exp).
    Jika access_token disertakan, klaim at_hash (Access Token Hash) divalidasi silang.
    """
    if not token or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token Keycloak tidak boleh kosong."
        )

    try:
        header = jwt.get_unverified_header(token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Format header token JWT Keycloak tidak valid."
        )

    kid = header.get("kid")
    alg = header.get("alg", "RS256")

    # Ambil JWKS dari cache / server Keycloak
    jwks = await fetch_keycloak_jwks(force_refresh=False)
    keys = jwks.get("keys", [])
    key_dict = next((k for k in keys if k.get("kid") == kid), None)

    # Jika kid tidak ditemukan, refresh JWKS sekali (kemungkinan Keycloak baru melakukan rotasi key)
    if not key_dict:
        jwks = await fetch_keycloak_jwks(force_refresh=True)
        keys = jwks.get("keys", [])
        key_dict = next((k for k in keys if k.get("kid") == kid), None)

    if not key_dict:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Kunci publik untuk token (kid: {kid}) tidak terdaftar pada Keycloak server."
        )

    try:
        public_key = jwk.construct(key_dict)
    except Exception as e:
        logger.error(f"Gagal mengonstruksi public key dari JWK: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Gagal memproses kunci publik Keycloak."
        )

    expected_issuer = get_keycloak_issuer()

    # Validasi at_hash hanya jika access_token disertakan (menghindari error No access_token provided)
    should_verify_at_hash = bool(access_token)

    try:
        # Verifikasi tanda tangan kriptografis dan waktu kedaluwarsa (exp) dengan clock skew tolerance 60s
        payload = jwt.decode(
            token,
            public_key,
            algorithms=[alg],
            access_token=access_token if should_verify_at_hash else None,
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_nbf": True,
                "verify_iat": True,
                "verify_aud": False,  # Kita lakukan verifikasi aud/azp manual di bawah
                "verify_at_hash": should_verify_at_hash,
                "leeway": 60,
            }
        )
    except JWTError as exc:
        logger.warning(f"Verifikasi kriptografis token Keycloak gagal: {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Verifikasi tanda tangan digital token Keycloak gagal: {str(exc)}"
        )

    # 1. Validasi Issuer (iss)
    token_iss = str(payload.get("iss", "")).rstrip("/")
    if token_iss != expected_issuer.rstrip("/"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Issuer token tidak sesuai. Diharapkan: {expected_issuer}, Diterima: {token_iss}"
        )

    # 2. Validasi Audience (aud) atau Authorized Party (azp)
    # Pada Keycloak: id_token memiliki aud = client_id; access_token memiliki azp = client_id atau aud = [..., client_id]
    token_aud = payload.get("aud")
    token_azp = payload.get("azp")
    target_client = settings.KEYCLOAK_CLIENT_ID

    aud_valid = False
    if isinstance(token_aud, str) and token_aud == target_client:
        aud_valid = True
    elif isinstance(token_aud, list) and target_client in token_aud:
        aud_valid = True
    elif token_azp == target_client:
        aud_valid = True

    if not aud_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Audience/Client token tidak sah untuk aplikasi ini (Client ID: {target_client})."
        )

    return payload

async def fetch_keycloak_userinfo(access_token: str) -> Dict[str, Any]:
    """
    Mengambil data profil pengguna dari UserInfo endpoint Keycloak menggunakan access_token resmi.
    """
    userinfo_url = get_keycloak_userinfo_url()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                userinfo_url,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if resp.status_code == 200:
                return resp.json()
            else:
                logger.warning(f"UserInfo endpoint return HTTP {resp.status_code}: {resp.text}")
                return {}
    except Exception as exc:
        logger.warning(f"Gagal memanggil Keycloak UserInfo endpoint: {exc}")
        return {}

async def authenticate_and_extract_identity(
    id_token: Optional[str] = None,
    access_token: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Memverifikasi token Keycloak dan mengekstrak klaim identitas resmi (NIP, nama, dsb).
    Menjamin identitas berasal 100% dari token kriptografis Keycloak BPS, bukan input user mentah.
    """
    if not id_token and not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autentikasi gagal: Token Keycloak (id_token atau access_token) tidak disertakan."
        )

    verified_claims: Dict[str, Any] = {}

    # 1. Verifikasi ID Token jika ada (validasi silang at_hash dengan access_token)
    if id_token:
        verified_claims = await verify_keycloak_jwt(id_token, access_token=access_token)

    # 2. Verifikasi Access Token jika ada (atau jika id_token tidak disediakan)
    if access_token:
        access_claims = await verify_keycloak_jwt(access_token)
        if not verified_claims:
            verified_claims = access_claims
        else:
            # Gabungkan klaim jika id_token kekurangan atribut
            for k, v in access_claims.items():
                if k not in verified_claims and v:
                    verified_claims[k] = v

    # 3. Ekstraksi NIP dari klaim terverifikasi
    nip = (
        verified_claims.get("nip_baru")
        or verified_claims.get("nipbaru")
        or verified_claims.get("niplama")
        or verified_claims.get("nip")
        or verified_claims.get("preferred_username")
    )

    # 4. Fallback ke UserInfo endpoint jika NIP belum ditemukan dan access_token tersedia
    if not nip and access_token:
        userinfo = await fetch_keycloak_userinfo(access_token)
        nip = (
            userinfo.get("nip_baru")
            or userinfo.get("nipbaru")
            or userinfo.get("niplama")
            or userinfo.get("nip")
            or userinfo.get("preferred_username")
        )
        for k, v in userinfo.items():
            if k not in verified_claims and v:
                verified_claims[k] = v

    if not nip:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token Keycloak valid tetapi tidak memuat klaim NIP resmi pegawai BPS."
        )

    nip_clean = str(nip).strip()
    nama = str(
        verified_claims.get("name")
        or verified_claims.get("preferred_username")
        or "Pegawai BPS"
    ).strip()
    username = str(
        verified_claims.get("preferred_username")
        or verified_claims.get("email")
        or nip_clean
    ).strip()
    email = verified_claims.get("email")
    jabatan = verified_claims.get("jabatan")
    satker = verified_claims.get("satker") or "3500"

    return {
        "nip": nip_clean,
        "nama": nama,
        "username": username,
        "email": str(email).strip() if email else None,
        "jabatan": str(jabatan).strip() if jabatan else None,
        "satker": str(satker).strip() if satker else "3500",
    }
