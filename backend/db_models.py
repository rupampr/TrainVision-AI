from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, UniqueConstraint

from database import Base


class OverrideRecord(Base):
    __tablename__ = "overrides"
    __table_args__ = (UniqueConstraint("train_id", "station_id", name="uq_override_train_station"),)

    id = Column(Integer, primary_key=True, index=True)
    train_id = Column(String, nullable=False, index=True)
    station_id = Column(String, nullable=False, index=True)
    platform = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AuditLogEntry(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    action = Column(String, nullable=False)
    train_id = Column(String, nullable=True)
    station_id = Column(String, nullable=True)
    platform = Column(Integer, nullable=True)
    details = Column(String, nullable=True)

    def __init__(self, **kwargs):
        if "detail" in kwargs and "details" not in kwargs:
            kwargs["details"] = kwargs.pop("detail")
        super().__init__(**kwargs)