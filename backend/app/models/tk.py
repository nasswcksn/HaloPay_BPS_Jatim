from datetime import datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import String, Numeric, DateTime, ForeignKey, PrimaryKeyConstraint
from sqlalchemy.orm import Mapped, mapped_column
from backend.app.models.base import Base

class TKBulanan(Base):
    __tablename__ = "tk_bulanan"
    __table_args__ = (
        PrimaryKeyConstraint("nip", "periode"),
        {"schema": "karyawan_bps"},
    )

    nip: Mapped[str] = mapped_column(String(18), ForeignKey("karyawan_bps.karyawan.nip"), nullable=False)
    periode: Mapped[str] = mapped_column(String(7), nullable=False)  # Format 'YYYY-MM'
    
    tunjangan_kinerja: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    simpanan_sukarela: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"))
    potongan_toko: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"))
    potongan_barang_koperasi: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"))
    potongan_pinjaman_koperasi: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"))
    potongan_pinjaman_dwp: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"))
    potongan_untalan: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"))
    potongan_arisan_dwp: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"))
    potongan_gagal_debet: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"))
    jumlah_diterima: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
