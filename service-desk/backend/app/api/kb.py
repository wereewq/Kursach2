from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import User, KnowledgeBase
from app.schemas.schemas import KBCreate, KBOut
from app.api.deps import get_current_user, require_roles

router = APIRouter(prefix="/api/kb", tags=["База Знаний"])

@router.get("/", response_model=List[KBOut])
def list_articles(
    category_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    q = db.query(KnowledgeBase)
    if category_id:
        q = q.filter(KnowledgeBase.category_id == category_id)
    if search:
        q = q.filter(KnowledgeBase.title.ilike(f"%{search}%") | KnowledgeBase.solution_text.ilike(f"%{search}%"))
    return q.order_by(KnowledgeBase.created_at.desc()).all()

@router.post("/", response_model=KBOut)
def create_article(
    data: KBCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["specialist", "admin"]))
):
    article = KnowledgeBase(
        category_id=data.category_id,
        author_id=current_user.user_id,
        title=data.title,
        solution_text=data.solution_text
    )
    db.add(article)
    db.commit()
    db.refresh(article)
    return article

@router.put("/{kb_id}", response_model=KBOut)
def update_article(
    kb_id: int,
    data: KBCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(["specialist", "admin"]))
):
    article = db.query(KnowledgeBase).filter(KnowledgeBase.kb_id == kb_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Статья не найдена")
    article.category_id = data.category_id
    article.title = data.title
    article.solution_text = data.solution_text
    db.commit()
    db.refresh(article)
    return article

@router.delete("/{kb_id}")
def delete_article(
    kb_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(["specialist", "admin"]))
):
    article = db.query(KnowledgeBase).filter(KnowledgeBase.kb_id == kb_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Статья не найдена")
    db.delete(article)
    db.commit()
    return {"message": "Статья удалена"}
