import time
import base64
import pytest
from unittest.mock import patch, AsyncMock
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from jose import jwt
from fastapi import HTTPException
from backend.app.schemas.auth import SyncSessionPayload
from backend.app.api.auth import sync_session

# Keypair RSA untuk simulasi server Keycloak resmi
keycloak_priv = rsa.generate_private_key(public_exponent=65537, key_size=2048)
keycloak_priv_pem = keycloak_priv.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.PKCS8,
    serialization.NoEncryption()
).decode()

pub_numbers = keycloak_priv.public_key().public_numbers()

def int_to_b64(val):
    b = val.to_bytes((val.bit_length() + 7) // 8, byteorder='big')
    return base64.urlsafe_b64encode(b).decode('utf-8').rstrip('=')

official_jwk = {
    'kty': 'RSA',
    'kid': 'keycloak-official-key-1',
    'use': 'sig',
    'alg': 'RS256',
    'n': int_to_b64(pub_numbers.n),
    'e': int_to_b64(pub_numbers.e)
}
official_jwks_response = {'keys': [official_jwk]}

# Keypair RSA palsu milik penyerang
attacker_priv = rsa.generate_private_key(public_exponent=65537, key_size=2048)
attacker_priv_pem = attacker_priv.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.PKCS8,
    serialization.NoEncryption()
).decode()

@pytest.fixture
def mock_keycloak_jwks():
    with patch('backend.app.core.keycloak.fetch_keycloak_jwks', new_callable=AsyncMock) as mock_jwks:
        mock_jwks.return_value = official_jwks_response
        yield mock_jwks

@pytest.mark.anyio
async def test_sync_session_rejects_missing_token():
    """Memastikan request tanpa token Keycloak ditolak (HTTP 401)."""
    payload_no_token = SyncSessionPayload()
    with pytest.raises(HTTPException) as exc_info:
        await sync_session(payload_no_token)
    assert exc_info.value.status_code == 401
    assert "tidak disertakan" in exc_info.value.detail

@pytest.mark.anyio
async def test_sync_session_rejects_forged_token(mock_keycloak_jwks):
    """Memastikan token palsu ditolak oleh verifikasi kriptografis RS256 (HTTP 401)."""
    fake_admin_claims = {
        "iss": "https://auth.majapah.it/realms/majapahit",
        "aud": "halopay",
        "azp": "halopay",
        "nip_baru": "198503142009022003",
        "name": "Rahma Nuryanti",
        "exp": time.time() + 3600,
        "iat": time.time(),
    }
    forged_token = jwt.encode(
        fake_admin_claims,
        attacker_priv_pem,
        algorithm="RS256",
        headers={"kid": "keycloak-official-key-1"}
    )
    payload_forged = SyncSessionPayload(id_token=forged_token)
    with pytest.raises(HTTPException) as exc_info:
        await sync_session(payload_forged)
    assert exc_info.value.status_code == 401
    assert "Signature verification failed" in exc_info.value.detail

@pytest.mark.anyio
async def test_sync_session_rejects_expired_token(mock_keycloak_jwks):
    """Memastikan token yang sudah kedaluwarsa ditolak (HTTP 401)."""
    expired_claims = {
        "iss": "https://auth.majapah.it/realms/majapahit",
        "aud": "halopay",
        "azp": "halopay",
        "nip_baru": "198503142009022003",
        "exp": time.time() - 3600,
        "iat": time.time() - 7200,
    }
    expired_token = jwt.encode(
        expired_claims,
        keycloak_priv_pem,
        algorithm="RS256",
        headers={"kid": "keycloak-official-key-1"}
    )
    payload_expired = SyncSessionPayload(id_token=expired_token)
    with pytest.raises(HTTPException) as exc_info:
        await sync_session(payload_expired)
    assert exc_info.value.status_code == 401
    assert "expired" in exc_info.value.detail.lower()

@pytest.mark.anyio
async def test_sync_session_prevents_role_tampering(mock_keycloak_jwks):
    """
    Memastikan NIP diekstrak murni dari token Keycloak terverifikasi.
    User karyawan tidak bisa menyamar atau naik role menjadi admin.
    """
    pegawai_claims = {
        "iss": "https://auth.majapah.it/realms/majapahit",
        "aud": "halopay",
        "azp": "halopay",
        "nip_baru": "196807031994011001",
        "name": "Zulkipli",
        "preferred_username": "zulkipli",
        "exp": time.time() + 3600,
        "iat": time.time(),
    }
    valid_pegawai_token = jwt.encode(
        pegawai_claims,
        keycloak_priv_pem,
        algorithm="RS256",
        headers={"kid": "keycloak-official-key-1"}
    )

    with patch('backend.app.core.repository.PayrollRepository.sync_user_session', new_callable=AsyncMock) as mock_db:
        async def fake_sync(nip, **kwargs):
            if nip == "198503142009022003":
                return {"id": "admin-1", "nip": nip, "role": "admin", "nama_lengkap": "Rahma"}
            return {"id": "user-2", "nip": nip, "role": "karyawan", "nama_lengkap": "Zulkipli"}
        mock_db.side_effect = fake_sync

        payload = SyncSessionPayload(id_token=valid_pegawai_token)
        res = await sync_session(payload)

        assert res.nip == "196807031994011001"
        assert res.role == "karyawan"

@pytest.mark.anyio
async def test_sync_session_handles_at_hash_claim(mock_keycloak_jwks):
    """
    Memastikan token yang memiliki klaim 'at_hash' (Access Token Hash dari Keycloak OIDC)
    dapat didekode dan diverifikasi tanpa error 'No access_token provided to compare against at_hash claim'.
    """
    token_with_at_hash = jwt.encode(
        {
            "iss": "https://auth.majapah.it/realms/majapahit",
            "aud": "halopay",
            "azp": "halopay",
            "nip_baru": "196807031994011001",
            "name": "Zulkipli",
            "preferred_username": "zulkipli",
            "at_hash": "jx7_wK7L3_sample_at_hash_value",
            "exp": time.time() + 3600,
            "iat": time.time(),
        },
        keycloak_priv_pem,
        algorithm="RS256",
        headers={"kid": "keycloak-official-key-1"}
    )

    with patch('backend.app.core.repository.PayrollRepository.sync_user_session', new_callable=AsyncMock) as mock_db:
        mock_db.return_value = {"id": "user-2", "nip": "196807031994011001", "role": "karyawan", "nama_lengkap": "Zulkipli"}
        payload = SyncSessionPayload(id_token=token_with_at_hash)
        res = await sync_session(payload)
        assert res.nip == "196807031994011001"
        assert res.role == "karyawan"
