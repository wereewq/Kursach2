from app.core.database import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models.models import (
    Role, User, Category, Priority, SLAPolicy, TicketStatus, KnowledgeBase
)

def seed_data():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    if db.query(Role).first():
        print("База данных уже инициализирована.")
        db.close()
        return

    # 1. Роли
    roles = {
        "client": Role(role_name="client", description="Клиент / Сотрудник (Заявитель)"),
        "dispatcher": Role(role_name="dispatcher", description="Диспетчер службы поддержки"),
        "specialist": Role(role_name="specialist", description="Специалист техподдержки"),
        "admin": Role(role_name="admin", description="Администратор системы"),
    }
    db.add_all(roles.values())
    db.flush()

    # 2. Тестовые пользователи (пароль: 123456)
    pwd = get_password_hash("123456")
    users = [
        User(role_id=roles["admin"].role_id, email="admin@sd.local", password_hash=pwd, full_name="Администратор Системы", phone="+79000000001"),
        User(role_id=roles["dispatcher"].role_id, email="disp@sd.local", password_hash=pwd, full_name="Смирнова Елена (Диспетчер)", phone="+79000000002"),
        User(role_id=roles["specialist"].role_id, email="spec@sd.local", password_hash=pwd, full_name="Иванов Алексей (Инженер ТП)", phone="+79000000003"),
        User(role_id=roles["client"].role_id, email="client@sd.local", password_hash=pwd, full_name="Петров Дмитрий (Заявитель)", phone="+79000000004"),
    ]
    db.add_all(users)
    db.flush()

    # 3. Категории ИС и оборудования
    categories = [
        Category(category_name="1С и учетные системы", description="Ошибки в 1С:Предприятие, права доступа, обновления"),
        Category(category_name="Сетевая инфраструктура и VPN", description="Доступ в интернет, корпоративный VPN, Wi-Fi"),
        Category(category_name="Аппаратное обеспечение и периферия", description="Ремонт ПК, мониторов, принтеров, замена картриджей"),
        Category(category_name="Корпоративная почта и ПО", description="Почтовый клиент, офисные пакеты, ЭЦП"),
    ]
    db.add_all(categories)
    db.flush()

    # 4. Приоритеты и SLA
    p_low = Priority(priority_name="Низкий", weight=1)
    p_med = Priority(priority_name="Средний", weight=2)
    p_high = Priority(priority_name="Высокий", weight=3)
    p_crit = Priority(priority_name="Критический", weight=4)
    db.add_all([p_low, p_med, p_high, p_crit])
    db.flush()

    slas = [
        SLAPolicy(priority_id=p_low.priority_id, response_time_minutes=120, resolve_time_hours=48),
        SLAPolicy(priority_id=p_med.priority_id, response_time_minutes=60, resolve_time_hours=24),
        SLAPolicy(priority_id=p_high.priority_id, response_time_minutes=30, resolve_time_hours=8),
        SLAPolicy(priority_id=p_crit.priority_id, response_time_minutes=15, resolve_time_hours=2),
    ]
    db.add_all(slas)

    # 5. Статусы жизненного цикла заявки
    statuses = [
        TicketStatus(status_name="Новая", is_final=False),
        TicketStatus(status_name="Назначена", is_final=False),
        TicketStatus(status_name="В работе", is_final=False),
        TicketStatus(status_name="Ожидание ответа", is_final=False),
        TicketStatus(status_name="Решена", is_final=False),
        TicketStatus(status_name="Закрыта", is_final=True),
        TicketStatus(status_name="Отклонена", is_final=True),
    ]
    db.add_all(statuses)
    db.flush()

    # 6. Стартовая статья в Базе Знаний
    kb = KnowledgeBase(
        category_id=categories[1].category_id,
        author_id=users[2].user_id,
        title="Ошибка подключения к корпоративному VPN (код 809)",
        solution_text="1. Проверьте стабильность интернет-соединения.\n2. Перезапустите службу IKEEXT.\n3. Убедитесь, что порт UDP 500 и 4500 не блокируется антивирусом."
    )
    db.add(kb)

    db.commit()
    db.close()
    print("Инициализация БД успешно завершена!")

if __name__ == "__main__":
    seed_data()
