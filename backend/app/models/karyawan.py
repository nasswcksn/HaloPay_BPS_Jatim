from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from backend.app.models.base import Base

class Karyawan(Base):
    __tablename__ = "karyawan"
    __table_args__ = {"schema": "karyawan_bps"}

    nip: Mapped[str] = mapped_column(String(18), primary_key=True)
    nama: Mapped[str] = mapped_column(String(255), nullable=False)
    no_rekening: Mapped[Optional[str]] = mapped_column(String(50), default="-")
    email: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    jabatan: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    satker: Mapped[Optional[str]] = mapped_column(String(10), default="3500")
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
