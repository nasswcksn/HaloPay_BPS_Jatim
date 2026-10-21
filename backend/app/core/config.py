import os
from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

# Base directory backend
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "HaloPay BPS Jatim Backend"
    API_V1_STR: str = "/api/v1"
    
    # PostgreSQL Database URL (On-Premise)
    DATABASE_URL: Optional[str] = os.getenv("DATABASE_URL")

    
    # Keycloak SSO OIDC Configuration
    KEYCLOAK_URL: str = "https://auth.majapah.it"
    KEYCLOAK_REALM: str = "majapahit"
    KEYCLOAK_CLIENT_ID: str = "halopay"
    
    # JWT Sesi Internal
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    
    # CORS Origins
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    model_config = SettingsConfigDict(
        env_file=os.path.join(BACKEND_DIR, ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
