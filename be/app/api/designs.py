from __future__ import annotations

from typing import Any
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

from app.services.auth import get_wallet_for_token
from app.services.design_storage import persist_design_assets

router = APIRouter(tags=["designs"])

UPLOADS_ROOT = Path(__file__).resolve().parents[2] / "storage" / "uploads"


class UploadDesignRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    imageData: str = Field(min_length=20)
    strokeData: list[dict[str, Any]] | None = None


@router.post("/api/designs/upload")
async def upload_design(
    payload: UploadDesignRequest,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict[str, str]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.split(" ", 1)[1].strip()
    wallet = get_wallet_for_token(token)
    if not wallet:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    base_url = str(request.base_url).rstrip("/")

    try:
        stored = persist_design_assets(
            uploads_root=UPLOADS_ROOT,
            base_url=base_url,
            wallet=wallet,
            name=payload.name.strip(),
            image_data_url=payload.imageData,
            stroke_data=payload.strokeData,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return stored
