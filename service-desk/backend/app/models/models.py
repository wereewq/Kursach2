from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, ForeignKey, DateTime, CheckConstraint
)
from sqlalchemy.orm import relationship
from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class Role(Base):
    __tablename__ = "roles"
    role_id = Column(Integer, primary_key=True, index=True)
    role_name = Column(String(50), unique=True, nullable=False)
    description = Column(String(255))

    users = relationship("User", back_populates="role")

class User(Base):
    __tablename__ = "users"
    user_id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.role_id"), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=False)
    phone = Column(String(20))
    is_active = Column(Boolean, default=True)

    role = relationship("Role", back_populates="users")
    created_tickets = relationship("Ticket", foreign_keys="Ticket.client_id", back_populates="client")
    assigned_tickets = relationship("Ticket", foreign_keys="Ticket.assigned_to", back_populates="specialist")
    dispatched_tickets = relationship("Ticket", foreign_keys="Ticket.dispatcher_id", back_populates="dispatcher")

class Category(Base):
    __tablename__ = "categories"
    category_id = Column(Integer, primary_key=True, index=True)
    category_name = Column(String(100), unique=True, nullable=False)
    description = Column(String(255))

class Priority(Base):
    __tablename__ = "priorities"
    priority_id = Column(Integer, primary_key=True, index=True)
    priority_name = Column(String(50), unique=True, nullable=False)
    weight = Column(Integer, nullable=False)

    sla_policy = relationship("SLAPolicy", back_populates="priority", uselist=False)

class SLAPolicy(Base):
    __tablename__ = "sla_policies"
    sla_id = Column(Integer, primary_key=True, index=True)
    priority_id = Column(Integer, ForeignKey("priorities.priority_id"), unique=True, nullable=False)
    response_time_minutes = Column(Integer, nullable=False)
    resolve_time_hours = Column(Integer, nullable=False)

    priority = relationship("Priority", back_populates="sla_policy")

class TicketStatus(Base):
    __tablename__ = "ticket_statuses"
    status_id = Column(Integer, primary_key=True, index=True)
    status_name = Column(String(50), unique=True, nullable=False)
    is_final = Column(Boolean, default=False)

class Ticket(Base):
    __tablename__ = "tickets"
    ticket_id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    assigned_to = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    dispatcher_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    category_id = Column(Integer, ForeignKey("categories.category_id"), nullable=False)
    priority_id = Column(Integer, ForeignKey("priorities.priority_id"), nullable=False)
    status_id = Column(Integer, ForeignKey("ticket_statuses.status_id"), nullable=False)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    sla_deadline = Column(DateTime(timezone=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)

    client = relationship("User", foreign_keys=[client_id], back_populates="created_tickets")
    specialist = relationship("User", foreign_keys=[assigned_to], back_populates="assigned_tickets")
    dispatcher = relationship("User", foreign_keys=[dispatcher_id], back_populates="dispatched_tickets")
    category = relationship("Category")
    priority = relationship("Priority")
    status = relationship("TicketStatus")
    messages = relationship("TicketMessage", back_populates="ticket", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="ticket", cascade="all, delete-orphan")
    history = relationship("TicketHistory", back_populates="ticket", cascade="all, delete-orphan")
    rating = relationship("TicketRating", back_populates="ticket", uselist=False, cascade="all, delete-orphan")

class TicketMessage(Base):
    __tablename__ = "ticket_messages"
    message_id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.ticket_id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    message_text = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    ticket = relationship("Ticket", back_populates="messages")
    sender = relationship("User")

class Attachment(Base):
    __tablename__ = "attachments"
    attachment_id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.ticket_id"), nullable=False)
    message_id = Column(Integer, ForeignKey("ticket_messages.message_id"), nullable=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), default=utcnow)

    ticket = relationship("Ticket", back_populates="attachments")

class TicketHistory(Base):
    __tablename__ = "ticket_history"
    history_id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.ticket_id"), nullable=False)
    old_status_id = Column(Integer, ForeignKey("ticket_statuses.status_id"), nullable=True)
    new_status_id = Column(Integer, ForeignKey("ticket_statuses.status_id"), nullable=False)
    changed_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    changed_at = Column(DateTime(timezone=True), default=utcnow)

    ticket = relationship("Ticket", back_populates="history")
    old_status = relationship("TicketStatus", foreign_keys=[old_status_id])
    new_status = relationship("TicketStatus", foreign_keys=[new_status_id])

class KnowledgeBase(Base):
    __tablename__ = "knowledge_base"
    kb_id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.category_id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    title = Column(String(255), nullable=False)
    solution_text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    category = relationship("Category")
    author = relationship("User")

class TicketRating(Base):
    __tablename__ = "ticket_ratings"
    rating_id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.ticket_id"), unique=True, nullable=False)
    score = Column(Integer, CheckConstraint("score >= 1 AND score <= 5"), nullable=False)
    comment = Column(Text)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    ticket = relationship("Ticket", back_populates="rating")
