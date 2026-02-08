"""Admin items storage and purchase management."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

# Default admin items catalog - only wearable items that actually exist
DEFAULT_ADMIN_ITEMS = [
    {
        "id": "sci-fi-helmet",
        "name": "Sci-Fi Helmet",
        "category": "Headwear",
        "priceSol": 0.5,
        "modelUrl": "/models/sci-fi-helmet.glb",
        "thumbnailUrl": "/models/sci-fi-helmet.glb",
        "defaultPosition": {"x": 0, "y": -40, "z": 20},
        "defaultScale": {"x": 0.6, "y": 0.6, "z": 0.6},
        "defaultRotation": {"x": 0, "y": 0, "z": 0},
    },
]


def _ensure_catalog(catalog_path: Path) -> None:
    """Ensure catalog file exists with default items."""
    catalog_path.parent.mkdir(parents=True, exist_ok=True)
    # Always write default items to ensure consistency
    with open(catalog_path, "w", encoding="utf-8") as f:
        json.dump({"items": DEFAULT_ADMIN_ITEMS}, f, indent=2)


def _ensure_purchases(purchases_path: Path) -> None:
    """Ensure purchases file exists."""
    if not purchases_path.exists():
        purchases_path.parent.mkdir(parents=True, exist_ok=True)
        with open(purchases_path, "w", encoding="utf-8") as f:
            json.dump({"purchases": []}, f, indent=2)


def list_admin_items(catalog_path: Path) -> list[dict[str, Any]]:
    """Return list of all admin items."""
    _ensure_catalog(catalog_path)
    with open(catalog_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("items", [])


def get_admin_item(catalog_path: Path, item_id: str) -> dict[str, Any] | None:
    """Get a specific admin item by ID."""
    items = list_admin_items(catalog_path)
    for item in items:
        if item.get("id") == item_id:
            return item
    return None


def list_user_purchases(purchases_path: Path, wallet: str) -> list[dict[str, Any]]:
    """Return list of purchases for a specific wallet."""
    _ensure_purchases(purchases_path)
    with open(purchases_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    purchases = data.get("purchases", [])
    return [p for p in purchases if p.get("wallet") == wallet]


def has_purchased(purchases_path: Path, wallet: str, item_id: str) -> bool:
    """Check if a wallet has purchased a specific item."""
    user_purchases = list_user_purchases(purchases_path, wallet)
    for purchase in user_purchases:
        if purchase.get("itemId") == item_id:
            return True
    return False


def record_purchase(
    purchases_path: Path,
    wallet: str,
    item_id: str,
    payment_signature: str,
    price_sol: float,
) -> dict[str, Any]:
    """Record a new purchase."""
    _ensure_purchases(purchases_path)

    with open(purchases_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    purchase = {
        "id": f"purchase-{int(time.time() * 1000)}-{wallet[:8]}",
        "wallet": wallet,
        "itemId": item_id,
        "paymentSignature": payment_signature,
        "priceSol": price_sol,
        "purchasedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    data["purchases"].append(purchase)

    with open(purchases_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    return purchase


def get_user_inventory_with_details(
    catalog_path: Path,
    purchases_path: Path,
    wallet: str,
) -> list[dict[str, Any]]:
    """Get user's purchased items with full item details."""
    purchases = list_user_purchases(purchases_path, wallet)
    items = list_admin_items(catalog_path)
    item_map = {item["id"]: item for item in items}

    inventory = []
    for purchase in purchases:
        item_id = purchase.get("itemId")
        if item_id in item_map:
            inventory.append({
                "purchaseId": purchase.get("id"),
                "purchasedAt": purchase.get("purchasedAt"),
                "paymentSignature": purchase.get("paymentSignature"),
                "item": item_map[item_id],
            })

    return inventory
