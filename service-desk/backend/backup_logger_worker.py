"""
Параллельный фоновый сервис FastSup:
1. Мониторинг новых событий аудита в PostgreSQL и запись в системный файл logs/audit.log.
2. Автоматическое создание резервных копий базы данных (SQL-дампов) в каталог backups/.
"""
import os
import time
from datetime import datetime
from sqlalchemy import text
from app.core.database import engine
from app.api.admin import _generate_sql_dump

BACKUP_DIR = "backups"
LOG_DIR = "logs"
BACKUP_INTERVAL_SEC = 300  # авто-бэкап каждые 5 минут (300 сек)

os.makedirs(BACKUP_DIR, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)


def run_worker():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Запуск параллельного сервиса аудита и резервного копирования FastSup...")
    last_log_id = 0
    with engine.connect() as conn:
        last_log_id = conn.execute(text("SELECT COALESCE(MAX(log_id), 0) FROM audit_logs")).scalar() or 0

    last_backup_ts = 0.0

    while True:
        try:
            # 1. Вычитываем новые записи аудита и пишем в файл logs/audit.log
            with engine.connect() as conn:
                rows = conn.execute(
                    text("SELECT log_id, user_email, action, details, created_at FROM audit_logs WHERE log_id > :lid ORDER BY log_id ASC"),
                    {"lid": last_log_id}
                ).fetchall()

            if rows:
                with open(os.path.join(LOG_DIR, "audit.log"), "a", encoding="utf-8") as lf:
                    for r in rows:
                        line = f"[{r[4]}] USER={r[1]} ACTION={r[2]} DETAILS={r[3]}\n"
                        lf.write(line)
                        print(f"[AUDIT] {line.strip()}")
                        last_log_id = r[0]

            # 2. Резервное копирование по расписанию
            now = time.time()
            if now - last_backup_ts >= BACKUP_INTERVAL_SEC:
                fname = f"auto_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
                fpath = os.path.join(BACKUP_DIR, fname)
                with open(fpath, "w", encoding="utf-8") as bf:
                    bf.write(_generate_sql_dump())
                print(f"[BACKUP] Автоматически создана резервная копия: {fpath}")
                last_backup_ts = now

        except Exception as exc:
            print(f"[WORKER ERROR] {exc}")

        time.sleep(3)


if __name__ == "__main__":
    run_worker()
