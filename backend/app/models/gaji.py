from datetime import datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import String, Numeric, DateTime, ForeignKey, PrimaryKeyConstraint
from sqlalchemy.orm import Mapped, mapped_column
from backend.app.models.base import Base

class GajiBulanan(Base):
    __tablename__ = "gaji_bulanan"
    __table_args__ = (
        PrimaryKeyConstraint("nip", "periode"),
        {"schema": "karyawan_bps"},
    )

    nip: Mapped[str] = mapped_column(String(18), ForeignKey("karyawan_bps.karyawan.nip"), nullable=False)
    periode: Mapped[str] = mapped_column(String(7), nullable=False)  # Format 'YYYY-MM'
    
    gaji_bruto: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    simpanan_pokok: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"))
    simpanan_sukarela: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"))
    simpanan_wajib: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"))
    iuran_dwp: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"))
    iuran_korpri: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"))
    potongan_pinjaman_koperasi: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"))
    jumlah_diterima: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
