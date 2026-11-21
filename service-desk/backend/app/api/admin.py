from datetime import datetime, timezone
from typing import List
import csv
import io
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.models import (
    User, Role, Category, SLAPolicy, Ticket, TicketStatus, TicketRating
)
from app.schemas.schemas import (
    UserCreate, UserUpdate, UserOut, RoleOut, CategoryCreate,
    CategoryOut, SLAPolicyUpdate, SLAPolicyOut
)
from app.api.deps import require_roles, get_current_user

router = APIRouter(prefix="/api/admin", tags=["Администрирование и Аналитика"])

# Список специалистов для назначения диспетчером
@router.get("/specialists", response_model=List[UserOut])
def get_specialists(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    spec_role = db.query(Role).filter(Role.role_name == "specialist").first()
    return db.query(User).filter(User.role_id == spec_role.role_id, User.is_active == True).all()

# Пользователи и роли
@router.get("/roles", response_model=List[RoleOut])
def get_roles(db: Session = Depends(get_db), _: User = Depends(require_roles(["admin"]))):
    return db.query(Role).all()

@router.get("/users", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_roles(["admin"]))):
    return db.query(User).order_by(User.user_id).all()

@router.post("/users", response_model=UserOut)
def create_user(data: UserCreate, db: Session = Depends(get_db), _: User = Depends(require_roles(["admin"]))):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email уже существует")
    user = User(
        role_id=data.role_id,
        email=data.email,
        full_name=data.full_name,
        phone=data.phone,
        password_hash=get_password_hash(data.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db), _: User = Depends(require_roles(["admin"]))):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user

# Категории
@router.post("/categories", response_model=CategoryOut)
def create_category(data: CategoryCreate, db: Session = Depends(get_db), _: User = Depends(require_roles(["admin"]))):
    cat = Category(**data.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat

# Настройка SLA
@router.get("/sla", response_model=List[SLAPolicyOut])
def list_sla(db: Session = Depends(get_db), _: User = Depends(require_roles(["admin", "dispatcher"]))):
    return db.query(SLAPolicy).all()

@router.put("/sla/{sla_id}", response_model=SLAPolicyOut)
def update_sla(sla_id: int, data: SLAPolicyUpdate, db: Session = Depends(get_db), _: User = Depends(require_roles(["admin"]))):
    sla = db.query(SLAPolicy).filter(SLAPolicy.sla_id == sla_id).first()
    if not sla:
        raise HTTPException(status_code=404, detail="Регламент SLA не найден")
    sla.response_time_minutes = data.response_time_minutes
    sla.resolve_time_hours = data.resolve_time_hours
    db.commit()
    db.refresh(sla)
    return sla

# Аналитическая отчетность и статистика SLA
@router.get("/analytics")
def get_analytics(db: Session = Depends(get_db), _: User = Depends(require_roles(["admin", "dispatcher"]))):
    total_tickets = db.query(Ticket).count()
    now = datetime.now(timezone.utc)

    # Распределение по статусам
    by_status = (
        db.query(TicketStatus.status_name, func.count(Ticket.ticket_id))
        .outerjoin(Ticket, Ticket.status_id == TicketStatus.status_id)
        .group_by(TicketStatus.status_name)
        .all()
    )

    # Нарушения SLA (закрыты позже дедлайна или не закрыты и дедлайн прошел)
    overdue_tickets = db.query(Ticket).filter(
        Ticket.sla_deadline.isnot(None),
        ((Ticket.closed_at.isnot(None)) & (Ticket.closed_at > Ticket.sla_deadline)) |
        ((Ticket.closed_at.is_(None)) & (Ticket.sla_deadline < now))
    ).count()

    avg_rating = db.query(func.avg(TicketRating.score)).scalar()

    return {
        "total_tickets": total_tickets,
        "overdue_sla_count": overdue_tickets,
        "average_rating": round(float(avg_rating), 2) if avg_rating else 0.0,
        "by_status": [{"status": s, "count": c} for s, c in by_status]
    }

@router.get("/export-report")
def export_report(db: Session = Depends(get_db), _: User = Depends(require_roles(["admin", "dispatcher"]))):
    tickets = db.query(Ticket).order_by(Ticket.ticket_id.desc()).all()
    now = datetime.now(timezone.utc)

    output = io.StringIO()
    output.write("\ufeff")  # BOM для корректного открытия кириллицы в Excel
    writer = csv.writer(output, delimiter=";")
    writer.writerow([
        "№ заявки", "Тема", "Категория", "Приоритет", "Статус",
        "Заявитель", "Исполнитель", "Дата создания", "Дедлайн SLA",
        "Дата закрытия", "Статус SLA", "Оценка (1-5)"
    ])

    for t in tickets:
        sla_status = "Без SLA"
        if t.sla_deadline:
            if t.closed_at:
                sla_status = "Нарушен" if t.closed_at > t.sla_deadline else "Выполнен в срок"
            else:
                sla_status = "Просрочен" if now > t.sla_deadline else "В пределах нормы"

        writer.writerow([
            t.ticket_id,
            t.title,
            t.category.category_name if t.category else "",
            t.priority.priority_name if t.priority else "",
            t.status.status_name if t.status else "",
            t.client.full_name if t.client else "",
            t.specialist.full_name if t.specialist else "Не назначен",
            t.created_at.strftime("%Y-%m-%d %H:%M") if t.created_at else "",
            t.sla_deadline.strftime("%Y-%m-%d %H:%M") if t.sla_deadline else "",
            t.closed_at.strftime("%Y-%m-%d %H:%M") if t.closed_at else "",
            sla_status,
            t.rating.score if t.rating else ""
        ])

    output.seek(0)
    headers = {"Content-Disposition": "attachment; filename=servicedesk_sla_report.csv"}
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv; charset=utf-8", headers=headers)

@router.post("/users/{user_id}/reset-password")
def admin_reset_password(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(["admin"]))):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    user.password_hash = get_password_hash("123456")
    db.commit()
    return {"status": "ok"}
