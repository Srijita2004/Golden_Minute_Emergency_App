from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.schemas.schemas import AdminStatsOut
from app.services.admin_service import AdminService
from app.api.deps import get_current_admin
from app.models.all_models import User

router = APIRouter(prefix="/admin", tags=["Admin Dashboard"])

@router.get("/system-status", response_model=AdminStatsOut)
def get_admin_system_status(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    stats = AdminService.get_system_stats(db)
    return AdminStatsOut(**stats)

@router.get("/users")
def get_admin_users(
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    return AdminService.list_users(db, search, page, page_size)

@router.get("/devices")
def get_admin_devices(
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    return AdminService.list_devices(db, search, page, page_size)

@router.get("/incidents")
def get_admin_incidents(
    status: Optional[str] = None,
    incident_type: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    return AdminService.list_incidents(
        db, status=status, incident_type=incident_type, search=search, page=page, page_size=page_size
    )

@router.get("/audit-logs")
def get_admin_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    return AdminService.list_audit_logs(db, page, page_size)

@router.get("/notification-logs")
def get_admin_notification_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    return AdminService.list_notification_logs(db, page, page_size)
