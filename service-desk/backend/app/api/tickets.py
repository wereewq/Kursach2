import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Body, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.models.models import (
    User, Ticket, TicketStatus, SLAPolicy, TicketHistory,
    TicketMessage, Attachment, TicketRating, Category, Priority
)
from app.schemas.schemas import (
    TicketCreate, TicketShortOut, TicketDetailOut, TicketAssign,
    TicketPriorityUpdate, TicketStatusUpdate, MessageCreate, MessageOut,
    AttachmentOut, RatingCreate, RatingOut, CategoryOut, PriorityOut, StatusOut
)
from app.api.deps import get_current_user, require_roles

router = APIRouter(prefix="/api/tickets", tags=["Заявки (Service Desk)"])

# Справочники для форм
@router.get("/dictionaries/all")
def get_dictionaries(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return {
        "categories": [CategoryOut.model_validate(c) for c in db.query(Category).all()],
        "priorities": [PriorityOut.model_validate(p) for p in db.query(Priority).order_by(Priority.weight).all()],
        "statuses": [StatusOut.model_validate(s) for s in db.query(TicketStatus).all()],
    }

@router.post("/", response_model=TicketDetailOut)
def create_ticket(
    data: TicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_status = db.query(TicketStatus).filter(TicketStatus.status_name == "Новая").first()
    sla = db.query(SLAPolicy).filter(SLAPolicy.priority_id == data.priority_id).first()
    now = datetime.now(timezone.utc)
    deadline = now + timedelta(hours=sla.resolve_time_hours) if sla else None

    ticket = Ticket(
        client_id=current_user.user_id,
        category_id=data.category_id,
        priority_id=data.priority_id,
        status_id=new_status.status_id,
        title=data.title,
        description=data.description,
        created_at=now,
        sla_deadline=deadline
    )
    db.add(ticket)
    db.flush()

    db.add(TicketHistory(
        ticket_id=ticket.ticket_id,
        old_status_id=None,
        new_status_id=new_status.status_id,
        changed_by=current_user.user_id
    ))
    db.commit()
    db.refresh(ticket)
    return ticket

@router.get("/", response_model=List[TicketShortOut])
def list_tickets(
    status_id: Optional[int] = None,
    priority_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Ticket)
    role = current_user.role.role_name

    if role == "client":
        query = query.filter(Ticket.client_id == current_user.user_id)
    elif role == "specialist":
        query = query.filter((Ticket.assigned_to == current_user.user_id) | (Ticket.assigned_to.is_(None)))

    if status_id:
        query = query.filter(Ticket.status_id == status_id)
    if priority_id:
        query = query.filter(Ticket.priority_id == priority_id)
    if search:
        query = query.filter(Ticket.title.ilike(f"%{search}%"))

    return query.order_by(Ticket.created_at.desc()).all()

@router.get("/{ticket_id}", response_model=TicketDetailOut)
def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    role = current_user.role.role_name
    if role == "client" and ticket.client_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Нет доступа к чужой заявке")

    # Скрываем внутренние заметки инженеров от клиента
    if role == "client":
        ticket.messages = [m for m in ticket.messages if not m.is_internal]

    return ticket

@router.patch("/{ticket_id}/assign", response_model=TicketDetailOut)
def assign_specialist(
    ticket_id: int,
    data: TicketAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["dispatcher", "specialist", "admin"]))
):
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    assigned_status = db.query(TicketStatus).filter(TicketStatus.status_name == "Назначена").first()
    old_status_id = ticket.status_id

    ticket.assigned_to = data.assigned_to
    if current_user.role.role_name == "dispatcher":
        ticket.dispatcher_id = current_user.user_id

    if old_status_id != assigned_status.status_id:
        ticket.status_id = assigned_status.status_id
        db.add(TicketHistory(
            ticket_id=ticket.ticket_id,
            old_status_id=old_status_id,
            new_status_id=assigned_status.status_id,
            changed_by=current_user.user_id
        ))

    db.commit()
    db.refresh(ticket)
    return ticket

@router.patch("/{ticket_id}/priority", response_model=TicketDetailOut)
def update_priority(
    ticket_id: int,
    data: TicketPriorityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["dispatcher", "admin"]))
):
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    sla = db.query(SLAPolicy).filter(SLAPolicy.priority_id == data.priority_id).first()
    ticket.priority_id = data.priority_id
    if sla:
        ticket.sla_deadline = ticket.created_at + timedelta(hours=sla.resolve_time_hours)

    db.commit()
    db.refresh(ticket)
    return ticket

@router.patch("/{ticket_id}/status", response_model=TicketDetailOut)
def update_status(
    ticket_id: int,
    data: TicketStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    new_status = db.query(TicketStatus).filter(TicketStatus.status_id == data.status_id).first()
    if not new_status:
        raise HTTPException(status_code=404, detail="Статус не найден")

    role = current_user.role.role_name
    if role == "client" and new_status.status_name != "Закрыта":
        raise HTTPException(status_code=403, detail="Клиент может только подтвердить закрытие заявки")

    old_status_id = ticket.status_id
    ticket.status_id = new_status.status_id
    if new_status.is_final:
        ticket.closed_at = datetime.now(timezone.utc)

    db.add(TicketHistory(
        ticket_id=ticket.ticket_id,
        old_status_id=old_status_id,
        new_status_id=new_status.status_id,
        changed_by=current_user.user_id
    ))
    db.commit()
    db.refresh(ticket)
    return ticket

@router.post("/{ticket_id}/messages", response_model=MessageOut)
def add_message(
    ticket_id: int,
    data: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    is_internal = data.is_internal if current_user.role.role_name != "client" else False
    msg = TicketMessage(
        ticket_id=ticket_id,
        sender_id=current_user.user_id,
        message_text=data.message_text,
        is_internal=is_internal
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg

@router.post("/{ticket_id}/attachments", response_model=AttachmentOut)
async def upload_attachment(
    ticket_id: int,
    file: UploadFile = File(...),
    message_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename)[1]
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_name)

    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    attachment = Attachment(
        ticket_id=ticket_id,
        message_id=message_id,
        file_name=file.filename,
        file_path=f"/uploads/{unique_name}"
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment

@router.post("/{ticket_id}/rating", response_model=RatingOut)
def rate_ticket(
    ticket_id: int,
    data: RatingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["client"]))
):
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket or ticket.client_id != current_user.user_id:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    if ticket.rating:
        raise HTTPException(status_code=400, detail="Оценка уже выставлена")

    rating = TicketRating(ticket_id=ticket_id, score=data.score, comment=data.comment)
    db.add(rating)
    db.commit()
    db.refresh(rating)
    return rating

@router.post("/{ticket_id}/rate")
def rate_ticket(
    ticket_id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    if ticket.client_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Оценить заявку может только её автор")
    if ticket.status.status_name not in ("Решена", "Закрыта"):
        raise HTTPException(status_code=400, detail="Оценить можно только решенную или закрытую заявку")
    if ticket.rating:
        raise HTTPException(status_code=400, detail="Заявка уже оценена")

    score = int(payload.get("score", 5))
    if not 1 <= score <= 5:
        raise HTTPException(status_code=400, detail="Оценка должна быть от 1 до 5")

    rating = TicketRating(
        ticket_id=ticket_id,
        score=score,
        comment=payload.get("comment")
    )
    db.add(rating)
    db.commit()
    return {"status": "ok", "score": score}
