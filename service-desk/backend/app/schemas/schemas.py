from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

# --- Auth & Users ---
class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    user_id: int
    full_name: str

class RoleOut(BaseModel):
    role_id: int
    role_name: str
    description: Optional[str] = None
    class Config:
        from_attributes = True

class UserBase(BaseModel):
    email: str
    full_name: str
    phone: Optional[str] = None

class UserCreate(UserBase):
    password: str
    role_id: int

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role_id: Optional[int] = None
    is_active: Optional[bool] = None

class UserOut(UserBase):
    user_id: int
    role_id: int
    is_active: bool
    role: Optional[RoleOut] = None
    class Config:
        from_attributes = True

class PasswordChange(BaseModel):
    old_password: str
    new_password: str

# --- Dictionaries & SLA ---
class CategoryCreate(BaseModel):
    category_name: str
    description: Optional[str] = None

class CategoryOut(CategoryCreate):
    category_id: int
    class Config:
        from_attributes = True

class PriorityOut(BaseModel):
    priority_id: int
    priority_name: str
    weight: int
    class Config:
        from_attributes = True

class SLAPolicyUpdate(BaseModel):
    response_time_minutes: int
    resolve_time_hours: int

class SLAPolicyOut(SLAPolicyUpdate):
    sla_id: int
    priority_id: int
    priority: Optional[PriorityOut] = None
    class Config:
        from_attributes = True

class StatusOut(BaseModel):
    status_id: int
    status_name: str
    is_final: bool
    class Config:
        from_attributes = True

# --- Messages, Attachments, History, Ratings ---
class MessageCreate(BaseModel):
    message_text: str
    is_internal: bool = False

class MessageOut(BaseModel):
    message_id: int
    ticket_id: int
    sender_id: int
    message_text: str
    is_internal: bool
    created_at: datetime
    sender: Optional[UserOut] = None
    class Config:
        from_attributes = True

class AttachmentOut(BaseModel):
    attachment_id: int
    ticket_id: int
    message_id: Optional[int] = None
    file_name: str
    file_path: str
    uploaded_at: datetime
    class Config:
        from_attributes = True

class HistoryOut(BaseModel):
    history_id: int
    old_status: Optional[StatusOut] = None
    new_status: StatusOut
    changed_by: Optional[int] = None
    changed_at: datetime
    class Config:
        from_attributes = True

class RatingCreate(BaseModel):
    score: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None

class RatingOut(RatingCreate):
    rating_id: int
    ticket_id: int
    created_at: datetime
    class Config:
        from_attributes = True

# --- Tickets ---
class TicketCreate(BaseModel):
    category_id: int
    priority_id: int = 2  # По умолчанию "Средний"
    title: str
    description: str

class TicketAssign(BaseModel):
    assigned_to: int

class TicketPriorityUpdate(BaseModel):
    priority_id: int

class TicketStatusUpdate(BaseModel):
    status_id: int

class TicketShortOut(BaseModel):
    ticket_id: int
    title: str
    created_at: datetime
    sla_deadline: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    client: UserOut
    specialist: Optional[UserOut] = None
    dispatcher: Optional[UserOut] = None
    category: CategoryOut
    priority: PriorityOut
    status: StatusOut
    class Config:
        from_attributes = True

class TicketDetailOut(TicketShortOut):
    description: str
    messages: List[MessageOut] = []
    attachments: List[AttachmentOut] = []
    history: List[HistoryOut] = []
    rating: Optional[RatingOut] = None

# --- Knowledge Base ---
class KBCreate(BaseModel):
    category_id: int
    title: str
    solution_text: str

class KBOut(KBCreate):
    kb_id: int
    author_id: int
    created_at: datetime
    category: Optional[CategoryOut] = None
    author: Optional[UserOut] = None
    class Config:
        from_attributes = True
