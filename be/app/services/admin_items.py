"""Admin items storage and purchase management."""

from __future__ import annotations

import json
import time
from copy import deepcopy
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
        "characterDefaultPosition": {"x": 0, "y": -24, "z": 28},
        "characterDefaultScale": {"x": 0.28, "y": 0.28, "z": 0.28},
        "characterDefaultRotation": {"x": 0, "y": 3.141592653589793, "z": 0},
        "roomDefaultPosition": {"x": 0, "y": 0.12, "z": 0.02},
        "roomDefaultScale": {"x": 1.05, "y": 1.05, "z": 1.05},
        "roomDefaultRotation": {"x": 0, "y": 0, "z": 0},
    },
    {
        "id": "clown-hat",
        "name": "Clown Hat",
        "category": "Headwear",
        "priceSol": 0.5,
        "modelUrl": "/models/clown_hat.glb",
        "thumbnailUrl": "/models/clown_hat.glb",
        "defaultPosition": {"x": 0, "y": -40, "z": 20},
        "defaultScale": {"x": 0.6, "y": 0.6, "z": 0.6},
        "defaultRotation": {"x": 0, "y": 0, "z": 0},
        "characterDefaultPosition": {"x": 0, "y": 200, "z": 0},
        "characterDefaultScale": {"x": 0.22, "y": 0.22, "z": 0.22},
        "characterDefaultRotation": {"x": 0, "y": 3.141592653589793, "z": 0},
        "roomDefaultPosition": {"x": 0, "y": 0.95, "z": 0},
        "roomDefaultScale": {"x": 0.85, "y": 0.85, "z": 0.85},
        "roomDefaultRotation": {"x": 0, "y": 0, "z": 0},
    },
    {
        "id": "futuristic-samurai-hat",
        "name": "Futuristic Samurai Hat",
        "category": "Headwear",
        "priceSol": 0.5,
        "modelUrl": "/models/futuristic_samurai_hat.glb",
        "thumbnailUrl": "/models/futuristic_samurai_hat.glb",
        "defaultPosition": {"x": 0, "y": -40, "z": 20},
        "defaultScale": {"x": 0.6, "y": 0.6, "z": 0.6},
        "defaultRotation": {"x": 0, "y": 0, "z": 0},
        "characterDefaultPosition": {"x": 0, "y": -4.25, "z": 28},
        "characterDefaultScale": {"x": 0.165, "y": 0.165, "z": 0.165},
        "characterDefaultRotation": {"x": 0, "y": 3.141592653589793, "z": 0},
        "roomDefaultPosition": {"x": 0, "y": 0.29, "z": 0.02},
        "roomDefaultScale": {"x": 0.615, "y": 0.615, "z": 0.615},
        "roomDefaultRotation": {"x": 0, "y": 0, "z": 0},
    },
    {
        "id": "golden-crown",
        "name": "Golden Crown",
        "category": "Headwear",
        "priceSol": 0.5,
        "modelUrl": "/models/golden_crown.glb",
        "thumbnailUrl": "/models/golden_crown.glb",
        "defaultPosition": {"x": 0, "y": -40, "z": 20},
        "defaultScale": {"x": 0.6, "y": 0.6, "z": 0.6},
        "defaultRotation": {"x": 0, "y": 0, "z": 0},
        "characterDefaultPosition": {"x": 0, "y": 100, "z": 0},
        "characterDefaultScale": {"x": 0.1, "y": 0.1, "z": 0.1},
        "characterDefaultRotation": {"x": 0, "y": 3.141592653589793, "z": 0},
        "roomDefaultPosition": {"x": 0, "y": 0.34, "z": -0.03},
        "roomDefaultScale": {"x": 0.56, "y": 0.56, "z": 0.56},
        "roomDefaultRotation": {"x": 0, "y": 0, "z": 0},
    },
    {
        "id": "victorian-abigail-hat",
        "name": "Victorian Abigail Hat",
        "category": "Headwear",
        "priceSol": 0.5,
        "modelUrl": "/models/victorian_abigail_hat.glb",
        "thumbnailUrl": "/models/victorian_abigail_hat.glb",
        "defaultPosition": {"x": 0, "y": -40, "z": 20},
        "defaultScale": {"x": 0.6, "y": 0.6, "z": 0.6},
        "defaultRotation": {"x": 0, "y": 0, "z": 0},
        "characterDefaultPosition": {"x": 0, "y": -24, "z": 28},
        "characterDefaultScale": {"x": 0.28, "y": 0.28, "z": 0.28},
        "characterDefaultRotation": {"x": 0, "y": 3.141592653589793, "z": 0},
        "roomDefaultPosition": {"x": 0, "y": 0.12, "z": 0.02},
        "roomDefaultScale": {"x": 1.05, "y": 1.05, "z": 1.05},
        "roomDefaultRotation": {"x": 0, "y": 0, "z": 0},
    },
]
def _ensure_purchases(purchases_path: Path) -> None:
    """Ensure purchases file exists."""
    if not purchases_path.exists():
        purchases_path.parent.mkdir(parents=True, exist_ok=True)
        with open(purchases_path, "w", encoding="utf-8") as f:
            json.dump({"purchases": []}, f, indent=2)


def list_admin_items(catalog_path: Path) -> list[dict[str, Any]]:
    """Return global admin items defaults."""
    _ = catalog_path
    return deepcopy(DEFAULT_ADMIN_ITEMS)


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
