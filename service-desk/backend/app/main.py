from app.core.db_objects import init_db_objects
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.database import engine, Base
from app.api import auth, tickets, kb, admin

Base.metadata.create_all(bind=engine)
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

app = FastAPI(
    title="Service Desk IS API",
    description="API сервиса приема заявок на обслуживание и ремонт информационных систем",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

app.include_router(auth.router)
app.include_router(tickets.router)
app.include_router(kb.router)
app.include_router(admin.router)

@app.get("/")
def root():
    return {"status": "ok", "docs": "/docs"}

init_db_objects()
