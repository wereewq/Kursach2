import os
import io
import csv
import subprocess
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse, PlainTextResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db, engine
from app.core.security import get_password_hash
from app.api.deps import require_roles as require_roles
from app.core.crypto import encrypt_text, decrypt_text
from app.core.db_objects import log_audit
from app.models.models import User, Role, SLAPolicy, Category, KnowledgeBase

router = APIRouter(prefix="/api/admin", tags=["Admin & Reports"])
BACKUP_DIR = "backups"
os.makedirs(BACKUP_DIR, exist_ok=True)


@router.get("/specialists")
def list_specialists(db: Session = Depends(get_db)):
    specs = (
        db.query(User)
        .join(Role)
        .filter(Role.role_name == "specialist", User.is_active == True)
        .all()
    )
    return [{"user_id": s.user_id, "full_name": s.full_name, "email": s.email} for s in specs]


@router.get("/analytics")
def get_analytics(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(["admin", "dispatcher"])),
):
    # Используем SQL VIEW v_tickets_overview и хранимую функцию fn_calculate_sla_compliance()
    total = db.execute(text("SELECT COUNT(*) FROM v_tickets_overview")).scalar() or 0
    overdue = db.execute(text("SELECT COUNT(*) FROM v_tickets_overview WHERE is_overdue = TRUE")).scalar() or 0
    sla_compliance = float(db.execute(text("SELECT fn_calculate_sla_compliance()")).scalar() or 100.0)
    avg_rating = db.execute(text("SELECT ROUND(COALESCE(AVG(score), 0)::numeric, 2) FROM ticket_ratings")).scalar() or 0

    by_status_rows = db.execute(
        text("SELECT status_name, COUNT(*) AS cnt FROM v_tickets_overview GROUP BY status_name ORDER BY cnt DESC")
    ).fetchall()
    by_category_rows = db.execute(
        text("SELECT category_name, COUNT(*) AS cnt FROM v_tickets_overview GROUP BY category_name ORDER BY cnt DESC")
    ).fetchall()
    kpi_rows = db.execute(
        text("SELECT specialist_name, total_assigned, resolved_count, avg_rating FROM v_specialist_kpi ORDER BY total_assigned DESC")
    ).fetchall()

    return {
        "total_tickets": total,
        "overdue_sla_count": overdue,
        "sla_compliance_percent": sla_compliance,
        "average_rating": float(avg_rating),
        "by_status": [{"status": r[0], "count": r[1]} for r in by_status_rows],
        "by_category": [{"category": r[0], "count": r[1]} for r in by_category_rows],
        "specialist_kpi": [
            {"name": r[0], "assigned": r[1], "resolved": r[2], "rating": float(r[3])}
            for r in kpi_rows
        ],
    }


@router.get("/users")
def list_users(db: Session = Depends(get_db), _: User = Depends(require_roles(["admin"]))):
    users = db.query(User).order_by(User.user_id).all()
    res = []
    for u in users:
        res.append({
            "user_id": u.user_id,
            "email": u.email,
            "full_name": u.full_name,
            "phone": decrypt_text(u.phone),
            "role_id": u.role_id,
            "is_active": u.is_active,
        })
    return res


@router.post("/users")
def create_user(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    if db.query(User).filter(User.email == payload["email"]).first():
        raise HTTPException(status_code=400, detail="Пользователь с таким Email уже существует")
    user = User(
        email=payload["email"],
        full_name=payload["full_name"],
        phone=encrypt_text(payload.get("phone")),
        password_hash=get_password_hash(payload.get("password", "123456")),
        role_id=int(payload["role_id"]),
        is_active=True,
    )
    db.add(user)
    db.commit()
    log_audit(current_user.email, "CREATE_USER", f"Создан пользователь {user.email}")
    return {"status": "ok", "user_id": user.user_id}


@router.patch("/users/{user_id}")
def update_user(
    user_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if "full_name" in payload:
        user.full_name = payload["full_name"]
    if "phone" in payload:
        user.phone = encrypt_text(payload["phone"])
    if "role_id" in payload:
        user.role_id = int(payload["role_id"])
    if "is_active" in payload:
        user.is_active = bool(payload["is_active"])
    db.commit()
    log_audit(current_user.email, "UPDATE_USER", f"Обновлен пользователь ID={user_id}")
    return {"status": "ok"}


@router.post("/users/{user_id}/reset-password")
def admin_reset_password(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    user.password_hash = get_password_hash("123456")
    db.commit()
    log_audit(current_user.email, "RESET_PASSWORD", f"Сброшен пароль пользователю {user.email}")
    return {"status": "ok"}


@router.get("/roles")
def list_roles(db: Session = Depends(get_db), _: User = Depends(require_roles(["admin"]))):
    return db.query(Role).all()


@router.get("/sla")
def list_sla(db: Session = Depends(get_db), _: User = Depends(require_roles(["admin"]))):
    return db.query(SLAPolicy).order_by(SLAPolicy.sla_id).all()


@router.put("/sla/{sla_id}")
def update_sla(
    sla_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    sla = db.query(SLAPolicy).filter(SLAPolicy.sla_id == sla_id).first()
    if not sla:
        raise HTTPException(status_code=404, detail="Регламент SLA не найден")
    sla.response_time_minutes = int(payload["response_time_minutes"])
    sla.resolve_time_hours = int(payload["resolve_time_hours"])
    db.commit()
    log_audit(current_user.email, "UPDATE_SLA", f"Изменен SLA ID={sla_id}")
    return {"status": "ok"}


# --- ЭКСПОРТ И ИМПОРТ В ФОРМАТАХ CSV И SQL ---

@router.get("/export-report")
def export_csv_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "dispatcher"])),
):
    rows = db.execute(text("SELECT * FROM v_tickets_overview ORDER BY ticket_id")).fetchall()
    buf = io.StringIO()
    buf.write("\ufeff")
    writer = csv.writer(buf, delimiter=";")
    writer.writerow(["ID", "Тема", "Категория", "Приоритет", "Статус", "Заявитель", "Исполнитель", "Создана", "Дедлайн SLA", "Просрочена"])
    for r in rows:
        writer.writerow([
            r.ticket_id, r.title, r.category_name, r.priority_name,
            r.status_name, r.client_name, r.specialist_name,
            str(r.created_at), str(r.sla_deadline or ""), "Да" if r.is_overdue else "Нет"
        ])
    log_audit(current_user.email, "EXPORT_CSV", "Выгружен отчет по заявкам в CSV")
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=fastsup_tickets_report.csv"},
    )


@router.get("/export-kb-csv")
def export_kb_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    articles = db.query(KnowledgeBase).all()
    buf = io.StringIO()
    buf.write("\ufeff")
    writer = csv.writer(buf, delimiter=";")
    writer.writerow(["category_id", "title", "solution_text"])
    for a in articles:
        writer.writerow([a.category_id, a.title, a.solution_text])
    log_audit(current_user.email, "EXPORT_KB_CSV", "Экспорт Базы Знаний в CSV")
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=fastsup_kb.csv"},
    )


@router.post("/import-kb-csv")
def import_kb_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    raw = file.file.read().decode("utf-8-sig")
    dialect_delim = ";" if ";" in raw.splitlines()[0] else ","
    reader = csv.DictReader(io.StringIO(raw), delimiter=dialect_delim)
    default_cat = db.query(Category).first()
    added = 0
    for row in reader:
        title = (row.get("title") or "").strip()
        sol = (row.get("solution_text") or "").strip()
        if not title or not sol:
            continue
        if not db.query(KnowledgeBase).filter(KnowledgeBase.title == title).first():
            cat_id = int(row["category_id"]) if str(row.get("category_id", "")).isdigit() else default_cat.category_id
            db.add(KnowledgeBase(
                category_id=cat_id,
                author_id=current_user.user_id,
                title=title,
                solution_text=sol,
            ))
            added += 1
    db.commit()
    log_audit(current_user.email, "IMPORT_KB_CSV", f"Импортировано статей БЗ из CSV: {added}")
    return {"status": "ok", "imported_count": added}


def _generate_sql_dump() -> str:
    lines = [
        f"-- FastSup PostgreSQL Dump ({datetime.now().isoformat()})",
        "BEGIN;",
    ]
    tables = ["roles", "users", "categories", "priorities", "ticket_statuses", "sla_policies", "knowledge_base", "tickets", "ticket_messages", "ticket_ratings"]
    with engine.connect() as conn:
        for tbl in tables:
            res = conn.execute(text(f"SELECT * FROM {tbl}"))
            cols = list(res.keys())
            for row in res.fetchall():
                vals = []
                for v in row:
                    if v is None:
                        vals.append("NULL")
                    elif isinstance(v, bool):
                        vals.append("TRUE" if v else "FALSE")
                    elif isinstance(v, (int, float)):
                        vals.append(str(v))
                    else:
                        escaped = str(v).replace("'", "''")
                        vals.append(f"'{escaped}'")
                lines.append(f"INSERT INTO {tbl} ({', '.join(cols)}) VALUES ({', '.join(vals)}) ON CONFLICT DO NOTHING;")
    lines.append("COMMIT;")
    return "\n".join(lines)


@router.get("/export-sql")
def export_sql_dump(current_user: User = Depends(require_roles(["admin"]))):
    sql_text = _generate_sql_dump()
    log_audit(current_user.email, "EXPORT_SQL", "Выгружен SQL-дамп базы данных")
    return PlainTextResponse(
        content=sql_text,
        media_type="application/sql; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=fastsup_backup.sql"},
    )


@router.post("/import-sql")
def import_sql_dump(
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles(["admin"])),
):
    sql_script = file.file.read().decode("utf-8-sig")
    with engine.begin() as conn:
        conn.execute(text(sql_script))
    log_audit(current_user.email, "IMPORT_SQL", f"Выполнен импорт SQL-скрипта ({file.filename})")
    return {"status": "ok"}


# --- ЖУРНАЛ АУДИТА И РЕЗЕРВНЫЕ КОПИИ ---

@router.get("/audit-logs")
def get_audit_logs(db: Session = Depends(get_db), _: User = Depends(require_roles(["admin"]))):
    rows = db.execute(
        text("SELECT log_id, user_email, action, details, created_at FROM audit_logs ORDER BY log_id DESC LIMIT 30")
    ).fetchall()
    return [
        {"log_id": r[0], "user_email": r[1], "action": r[2], "details": r[3], "created_at": str(r[4])}
        for r in rows
    ]


@router.get("/backups")
def list_backups(_: User = Depends(require_roles(["admin"]))):
    files = sorted(os.listdir(BACKUP_DIR), reverse=True)
    result = []
    for f in files:
        if f.endswith(".sql"):
            full = os.path.join(BACKUP_DIR, f)
            result.append({"filename": f, "size_kb": round(os.path.getsize(full) / 1024, 2)})
    return result


@router.post("/backups/create")
def create_backup_now(current_user: User = Depends(require_roles(["admin"]))):
    fname = f"fastsup_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
    fpath = os.path.join(BACKUP_DIR, fname)
    with open(fpath, "w", encoding="utf-8") as f:
        f.write(_generate_sql_dump())
    log_audit(current_user.email, "MANUAL_BACKUP", f"Создана резервная копия {fname}")
    return {"status": "ok", "filename": fname}
