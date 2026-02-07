from __future__ import annotations

import base64
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4


def _decode_data_url(data_url: str) -> tuple[bytes, str]:
    if not isinstance(data_url, str) or not data_url.startswith("data:image/"):
        raise ValueError("imageData must be a valid image data URL")

    header, _, encoded = data_url.partition(",")
    if not encoded:
        raise ValueError("imageData payload is missing")

    if ";base64" not in header:
        raise ValueError("imageData must be base64-encoded")

    mime_type = header[5:].split(";", 1)[0]
    extension = "png" if "png" in mime_type else "jpg" if "jpeg" in mime_type else "webp" if "webp" in mime_type else "bin"

    try:
        payload = base64.b64decode(encoded, validate=True)
    except Exception as exc:
        raise ValueError("imageData base64 payload is invalid") from exc

    if not payload:
        raise ValueError("imageData is empty")

    return payload, extension


def _normalize_stroke_data(stroke_data: Any) -> list[dict[str, Any]]:
    if not isinstance(stroke_data, list):
        return []

    normalized: list[dict[str, Any]] = []

    for stroke in stroke_data:
        if not isinstance(stroke, dict):
            continue

        color = stroke.get("color")
        size = stroke.get("size")
        points = stroke.get("points")

        if not isinstance(color, str) or not color.strip():
            continue
        if not isinstance(size, (int, float)):
            continue
        if not isinstance(points, list):
            continue

        normalized_points: list[dict[str, float]] = []
        for point in points:
            if not isinstance(point, dict):
                continue
            x = point.get("x")
            y = point.get("y")
            if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
                continue

            normalized_points.append(
                {
                    "x": max(0.0, min(1.0, float(x))),
                    "y": max(0.0, min(1.0, float(y))),
                }
            )

        if not normalized_points:
            continue

        normalized.append(
            {
                "color": color,
                "size": max(1.0, float(size)),
                "points": normalized_points,
            }
        )

    return normalized


def persist_design_assets(
    uploads_root: Path,
    base_url: str,
    wallet: str,
    name: str,
    image_data_url: str,
    stroke_data: Any = None,
) -> dict[str, str]:
    image_bytes, extension = _decode_data_url(image_data_url)
    normalized_strokes = _normalize_stroke_data(stroke_data)

    design_id = uuid4().hex
    wallet_folder = uploads_root / "designs" / wallet
    wallet_folder.mkdir(parents=True, exist_ok=True)

    image_filename = f"{design_id}.{extension}"
    metadata_filename = f"{design_id}.json"

    image_path = wallet_folder / image_filename
    metadata_path = wallet_folder / metadata_filename

    image_path.write_bytes(image_bytes)

    relative_image = f"/uploads/designs/{wallet}/{image_filename}"
    relative_metadata = f"/uploads/designs/{wallet}/{metadata_filename}"
    image_url = f"{base_url}{relative_image}"
    metadata_url = f"{base_url}{relative_metadata}"

    created_at = datetime.now(timezone.utc).isoformat()
    metadata = {
        "name": name,
        "symbol": "MASK",
        "description": "Masquerade mask design",
        "image": image_url,
        "createdAt": created_at,
        "properties": {
            "maskTexture": image_url,
            "creatorWallet": wallet,
            "strokeData": normalized_strokes,
        },
    }

    metadata_path.write_text(json.dumps(metadata), encoding="utf-8")

    return {
        "designId": design_id,
        "imageUrl": image_url,
        "metadataUrl": metadata_url,
        "maskTextureUrl": image_url,
    }
