import random
from fastapi import APIRouter, Depends, Body, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.models import User, Role
from app.schemas.schemas import Token, UserOut, PasswordChange, UserBase
from app.api.deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["Авторизация и профиль"])

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный email или пароль")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Учетная запись заблокирована")

    token = create_access_token({"sub": str(user.user_id), "role": user.role.role_name})
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role.role_name,
        "user_id": user.user_id,
        "full_name": user.full_name,
    }

@router.post("/register", response_model=UserOut)
def register_client(data: UserBase, password: str, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован")
    client_role = db.query(Role).filter(Role.role_name == "client").first()
    user = User(
        role_id=client_role.role_id,
        email=data.email,
        full_name=data.full_name,
        phone=data.phone,
        password_hash=get_password_hash(password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/change-password")
def change_password(data: PasswordChange, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(data.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Старый пароль указан неверно")
    current_user.password_hash = get_password_hash(data.new_password)
    db.commit()
    return {"message": "Пароль успешно изменен"}

@router.patch("/me", response_model=UserOut)
def update_me(
    full_name: str,
    phone: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.full_name = full_name
    current_user.phone = phone
    db.commit()
    db.refresh(current_user)
    return current_user

RESET_CODES: dict[str, str] = {}

@router.post("/forgot-password")
def forgot_password(payload: dict = Body(...), db: Session = Depends(get_db)):
    email = (payload.get("email") or "").strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь с таким Email не найден")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Учетная запись заблокирована администратором")
    code = f"{random.randint(100000, 999999)}"
    RESET_CODES[email] = code
    print(f"[FastSup Recovery] Код восстановления для {email}: {code}")
    return {"status": "ok", "demo_code": code, "message": f"Код подтверждения отправлен (демо-код: {code})"}

@router.post("/reset-password")
def reset_password(payload: dict = Body(...), db: Session = Depends(get_db)):
    email = (payload.get("email") or "").strip().lower()
    code = (payload.get("code") or "").strip()
    new_password = payload.get("new_password") or ""

    if len(new_password) < 4:
        raise HTTPException(status_code=400, detail="Пароль должен содержать минимум 4 символа")
    if RESET_CODES.get(email) != code:
        raise HTTPException(status_code=400, detail="Неверный или устаревший код подтверждения")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    user.password_hash = get_password_hash(new_password)
    db.commit()
    RESET_CODES.pop(email, None)
    return {"status": "ok", "message": "Пароль успешно восстановлен"}
