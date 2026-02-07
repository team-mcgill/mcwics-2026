from __future__ import annotations

from typing import Any
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

from app.services.auth import get_wallet_for_token
from app.services.design_storage import delete_design_assets, persist_design_assets, update_design_assets

router = APIRouter(tags=["designs"])

UPLOADS_ROOT = Path(__file__).resolve().parents[2] / "storage" / "uploads"


class UploadDesignRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    imageData: str = Field(min_length=20)
    strokeData: list[dict[str, Any]] | None = None


class UpdateDesignRequest(BaseModel):
    metadataUri: str = Field(min_length=10, max_length=400)
    name: str = Field(min_length=1, max_length=120)
    imageData: str = Field(min_length=20)
    strokeData: list[dict[str, Any]] | None = None


class DeleteDesignRequest(BaseModel):
    metadataUri: str = Field(min_length=10, max_length=400)


def _require_wallet_from_bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.split(" ", 1)[1].strip()
    wallet = get_wallet_for_token(token)
    if not wallet:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return wallet


@router.post("/api/designs/upload")
async def upload_design(
    payload: UploadDesignRequest,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict[str, str]:
    wallet = _require_wallet_from_bearer(authorization)

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


@router.post("/api/designs/update")
async def update_design(
    payload: UpdateDesignRequest,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict[str, str]:
    wallet = _require_wallet_from_bearer(authorization)
    base_url = str(request.base_url).rstrip("/")

    try:
        stored = update_design_assets(
            uploads_root=UPLOADS_ROOT,
            base_url=base_url,
            wallet=wallet,
            metadata_uri=payload.metadataUri.strip(),
            name=payload.name.strip(),
            image_data_url=payload.imageData,
            stroke_data=payload.strokeData,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return stored


@router.post("/api/designs/delete")
async def delete_design(
    payload: DeleteDesignRequest,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    wallet = _require_wallet_from_bearer(authorization)
    base_url = str(request.base_url).rstrip("/")

    try:
        deleted = delete_design_assets(
            uploads_root=UPLOADS_ROOT,
            base_url=base_url,
            wallet=wallet,
            metadata_uri=payload.metadataUri.strip(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return deleted
