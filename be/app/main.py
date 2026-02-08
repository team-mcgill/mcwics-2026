from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.admin_items import router as admin_items_router
from app.api.auth import router as auth_router
from app.api.designs import router as designs_router
from app.api.health import router as health_router
from app.api.marketplace import router as marketplace_router
from app.api.rooms import router as rooms_router
from app.api.solana import router as solana_router

app = FastAPI(title="Masquerade API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

uploads_root = Path(__file__).resolve().parents[1] / "storage" / "uploads"
uploads_root.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_root), name="uploads")

app.include_router(health_router)
app.include_router(solana_router)
app.include_router(auth_router)
app.include_router(designs_router)
app.include_router(marketplace_router)
app.include_router(admin_items_router)
app.include_router(rooms_router)
