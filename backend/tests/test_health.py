import pytest
from httpx import ASGITransport, AsyncClient
from backend.app.main import app

@pytest.mark.anyio
async def test_root_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "online"
        assert "HaloPay" in data["app"]

@pytest.mark.anyio
async def test_health_check_endpoint():
    """Healthcheck hanya mengembalikan status, tanpa detail database/Keycloak."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}

@pytest.mark.anyio
async def test_health_and_docs_not_exposed_under_api_v1():
    """/api/v1/health (diteruskan proxy frontend) dan dokumentasi API tidak tersedia."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for path in ("/api/v1/health", "/docs", "/redoc", "/openapi.json"):
            response = await client.get(path)
            assert response.status_code == 404, path
