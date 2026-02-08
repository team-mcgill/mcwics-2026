"""Admin items API endpoints."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.config import get_settings
from app.services.admin_items import (
    get_admin_item,
    get_user_inventory_with_details,
    has_purchased,
    list_admin_items,
    record_purchase,
)
from app.services.auth import get_wallet_for_token
from app.services.solana_client import verify_transaction

router = APIRouter(tags=["admin-items"])

CATALOG_PATH = Path(__file__).resolve().parents[2] / "storage" / "admin_items" / "catalog.json"
PURCHASES_PATH = Path(__file__).resolve().parents[2] / "storage" / "admin_items" / "purchases.json"


class BuyItemRequest(BaseModel):
    itemId: str = Field(min_length=1, max_length=64)
    paymentSignature: str = Field(min_length=20, max_length=120)


def _require_wallet_from_bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.split(" ", 1)[1].strip()
    wallet = get_wallet_for_token(token)
    if not wallet:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return wallet


@router.get("/api/admin/items")
async def get_items() -> dict[str, list[dict[str, Any]]]:
    """Get all admin items available for purchase."""
    items = list_admin_items(CATALOG_PATH)
    return {"items": items}


@router.get("/api/admin/items/inventory")
async def get_inventory(
    authorization: str | None = Header(default=None),
) -> dict[str, list[dict[str, Any]]]:
    """Get current user's purchased admin items."""
    wallet = _require_wallet_from_bearer(authorization)
    inventory = get_user_inventory_with_details(CATALOG_PATH, PURCHASES_PATH, wallet)
    return {"inventory": inventory}


@router.post("/api/admin/items/buy")
async def buy_item(
    payload: BuyItemRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    """Purchase an admin item."""
    settings = get_settings()
    wallet = _require_wallet_from_bearer(authorization)

    # Get item details
    item = get_admin_item(CATALOG_PATH, payload.itemId)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Check if already purchased
    if has_purchased(PURCHASES_PATH, wallet, payload.itemId):
        raise HTTPException(status_code=400, detail="Item already purchased")

    # Verify payment transaction
    try:
        is_valid = await verify_transaction(
            rpc_url=settings.solana_rpc_url,
            signature=payload.paymentSignature.strip(),
            expected_signer=wallet,
            expected_lamports=int(item["priceSol"] * 1_000_000_000),
        )
        if not is_valid:
            raise HTTPException(status_code=400, detail="Invalid payment transaction")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Payment verification failed: {exc}")

    # Record purchase
    try:
        purchase = record_purchase(
            PURCHASES_PATH,
            wallet=wallet,
            item_id=payload.itemId,
            payment_signature=payload.paymentSignature.strip(),
            price_sol=item["priceSol"],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {
        "success": True,
        "purchase": purchase,
        "item": item,
    }
