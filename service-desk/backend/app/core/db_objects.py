from sqlalchemy import text
from app.core.database import engine, Base
from app.models import models

SQL_OBJECTS_SCRIPT = """
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id SERIAL PRIMARY KEY,
    user_email VARCHAR(150),
    action VARCHAR(100) NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE VIEW v_tickets_overview AS
SELECT
    t.ticket_id,
    t.title,
    c.category_name,
    p.priority_name,
    p.weight AS priority_weight,
    s.status_name,
    s.is_final,
    u_client.full_name AS client_name,
    COALESCE(u_spec.full_name, 'Не назначен') AS specialist_name,
    t.created_at,
    t.sla_deadline,
    t.closed_at,
    CASE
        WHEN t.closed_at IS NULL AND t.sla_deadline < CURRENT_TIMESTAMP THEN TRUE
        ELSE FALSE
    END AS is_overdue
FROM tickets t
JOIN categories c ON t.category_id = c.category_id
JOIN priorities p ON t.priority_id = p.priority_id
JOIN ticket_statuses s ON t.status_id = s.status_id
JOIN users u_client ON t.client_id = u_client.user_id
LEFT JOIN users u_spec ON t.assigned_to = u_spec.user_id;

CREATE OR REPLACE VIEW v_specialist_kpi AS
SELECT
    u.user_id AS specialist_id,
    u.full_name AS specialist_name,
    COUNT(t.ticket_id) AS total_assigned,
    COUNT(CASE WHEN s.is_final THEN 1 END) AS resolved_count,
    ROUND(COALESCE(AVG(r.score), 0)::numeric, 2) AS avg_rating
FROM users u
JOIN roles rl ON u.role_id = rl.role_id
LEFT JOIN tickets t ON t.assigned_to = u.user_id
LEFT JOIN ticket_statuses s ON t.status_id = s.status_id
LEFT JOIN ticket_ratings r ON r.ticket_id = t.ticket_id
WHERE rl.role_name = 'specialist'
GROUP BY u.user_id, u.full_name;

CREATE OR REPLACE FUNCTION fn_calculate_sla_compliance()
RETURNS NUMERIC AS $$
DECLARE
    total_cnt INTEGER;
    ok_cnt INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_cnt FROM tickets;
    IF total_cnt = 0 THEN
        RETURN 100.0;
    END IF;
    SELECT COUNT(*) INTO ok_cnt
    FROM tickets
    WHERE (closed_at IS NOT NULL AND closed_at <= sla_deadline)
       OR (closed_at IS NULL AND (sla_deadline IS NULL OR sla_deadline >= CURRENT_TIMESTAMP));
    RETURN ROUND((ok_cnt::numeric / total_cnt::numeric) * 100, 1);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE PROCEDURE sp_log_audit_event(
    p_email VARCHAR,
    p_action VARCHAR,
    p_details TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO audit_logs (user_email, action, details, created_at)
    VALUES (p_email, p_action, p_details, CURRENT_TIMESTAMP);
END;
$$;
"""

def init_db_objects():
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        conn.execute(text(SQL_OBJECTS_SCRIPT))

def log_audit(email: str, action: str, details: str = ""):
    try:
        with engine.begin() as conn:
            conn.execute(
                text("CALL sp_log_audit_event(:email, :action, :details)"),
                {"email": email, "action": action, "details": details}
            )
    except Exception as e:
        print(f"[Audit warn] {e}")
