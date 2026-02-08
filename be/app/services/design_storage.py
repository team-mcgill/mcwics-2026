from __future__ import annotations

import base64
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
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


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def _normalize_vec3(
    value: Any,
    *,
    default: dict[str, float],
    min_value: float,
    max_value: float,
) -> dict[str, float]:
    if not isinstance(value, dict):
        return dict(default)

    return {
        "x": _clamp(_to_float(value.get("x"), default["x"]), min_value, max_value),
        "y": _clamp(_to_float(value.get("y"), default["y"]), min_value, max_value),
        "z": _clamp(_to_float(value.get("z"), default["z"]), min_value, max_value),
    }


def _normalize_accessory_data(accessory_data: Any) -> list[dict[str, Any]]:
    if not isinstance(accessory_data, list):
        return []

    normalized: list[dict[str, Any]] = []

    for raw in accessory_data[:12]:
        if not isinstance(raw, dict):
            continue

        item_id = raw.get("id")
        model_url = raw.get("modelUrl")

        if not isinstance(item_id, str) or not item_id.strip():
            continue

        if not isinstance(model_url, str) or not model_url.startswith("/models/"):
            continue

        item_id_clean = item_id.strip()[:80]
        model_url_clean = model_url.strip()[:220]

        if not item_id_clean or not model_url_clean:
            continue

        name_value = raw.get("name")
        category_value = raw.get("category")
        thumb_value = raw.get("thumbnailUrl")

        entry: dict[str, Any] = {
            "id": item_id_clean,
            "modelUrl": model_url_clean,
            "defaultPosition": _normalize_vec3(
                raw.get("defaultPosition"),
                default={"x": 0.0, "y": 0.0, "z": 0.0},
                min_value=-1200.0,
                max_value=1200.0,
            ),
            "defaultScale": _normalize_vec3(
                raw.get("defaultScale"),
                default={"x": 1.0, "y": 1.0, "z": 1.0},
                min_value=0.05,
                max_value=20.0,
            ),
            "defaultRotation": _normalize_vec3(
                raw.get("defaultRotation"),
                default={"x": 0.0, "y": 0.0, "z": 0.0},
                min_value=-6.5,
                max_value=6.5,
            ),
            "characterDefaultPosition": _normalize_vec3(
                raw.get("characterDefaultPosition"),
                default={"x": 0.0, "y": 0.0, "z": 0.0},
                min_value=-1200.0,
                max_value=1200.0,
            ),
            "characterDefaultScale": _normalize_vec3(
                raw.get("characterDefaultScale"),
                default={"x": 1.0, "y": 1.0, "z": 1.0},
                min_value=0.05,
                max_value=20.0,
            ),
            "characterDefaultRotation": _normalize_vec3(
                raw.get("characterDefaultRotation"),
                default={"x": 0.0, "y": 0.0, "z": 0.0},
                min_value=-6.5,
                max_value=6.5,
            ),
            "roomDefaultPosition": _normalize_vec3(
                raw.get("roomDefaultPosition"),
                default={"x": 0.0, "y": 0.0, "z": 0.0},
                min_value=-4.0,
                max_value=4.0,
            ),
            "roomDefaultScale": _normalize_vec3(
                raw.get("roomDefaultScale"),
                default={"x": 1.0, "y": 1.0, "z": 1.0},
                min_value=0.05,
                max_value=8.0,
            ),
            "roomDefaultRotation": _normalize_vec3(
                raw.get("roomDefaultRotation"),
                default={"x": 0.0, "y": 0.0, "z": 0.0},
                min_value=-6.5,
                max_value=6.5,
            ),
        }

        if isinstance(name_value, str) and name_value.strip():
            entry["name"] = name_value.strip()[:120]

        if isinstance(category_value, str) and category_value.strip():
            entry["category"] = category_value.strip()[:60]

        if isinstance(thumb_value, str) and thumb_value.strip():
            entry["thumbnailUrl"] = thumb_value.strip()[:400]

        normalized.append(entry)

    return normalized


def _resolve_local_upload_file(
    uploads_root: Path,
    base_url: str,
    wallet: str,
    file_url: str,
    *,
    expected_suffix: str,
) -> Path | None:
    if not isinstance(file_url, str) or not file_url.strip():
        return None

    parsed = urlparse(file_url.strip())
    parsed_base = urlparse(base_url)

    if parsed.scheme not in {"http", "https"}:
        return None

    if parsed.netloc != parsed_base.netloc:
        return None

    wallet_prefix = f"/uploads/designs/{wallet}/"
    if not parsed.path.startswith(wallet_prefix):
        return None

    if not parsed.path.endswith(expected_suffix):
        return None

    relative_path = parsed.path.removeprefix("/uploads/")
    resolved = (uploads_root / relative_path).resolve()

    try:
        resolved.relative_to(uploads_root.resolve())
    except ValueError:
        return None

    return resolved


def persist_design_assets(
    uploads_root: Path,
    base_url: str,
    wallet: str,
    name: str,
    image_data_url: str,
    stroke_data: Any = None,
    accessory_data: Any = None,
) -> dict[str, str]:
    image_bytes, extension = _decode_data_url(image_data_url)
    normalized_strokes = _normalize_stroke_data(stroke_data)
    normalized_accessories = _normalize_accessory_data(accessory_data)

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
            "accessories": normalized_accessories,
        },
    }

    metadata_path.write_text(json.dumps(metadata), encoding="utf-8")

    return {
        "designId": design_id,
        "imageUrl": image_url,
        "metadataUrl": metadata_url,
        "maskTextureUrl": image_url,
    }


def update_design_assets(
    uploads_root: Path,
    base_url: str,
    wallet: str,
    metadata_uri: str,
    name: str,
    image_data_url: str,
    stroke_data: Any = None,
    accessory_data: Any = None,
) -> dict[str, str]:
    metadata_path = _resolve_local_upload_file(
        uploads_root,
        base_url,
        wallet,
        metadata_uri,
        expected_suffix=".json",
    )
    if metadata_path is None or not metadata_path.exists():
        raise ValueError("Design metadata is not hosted on this backend or not found")

    try:
        existing_metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ValueError("Stored metadata is invalid") from exc

    image_url = existing_metadata.get("image")
    image_path = _resolve_local_upload_file(
        uploads_root,
        base_url,
        wallet,
        image_url,
        expected_suffix="",
    )
    if image_path is None:
        raise ValueError("Design image is not hosted on this backend")

    image_bytes, _ = _decode_data_url(image_data_url)
    image_path.write_bytes(image_bytes)

    normalized_strokes = _normalize_stroke_data(stroke_data)
    normalized_accessories = _normalize_accessory_data(accessory_data)
    updated_at = datetime.now(timezone.utc).isoformat()

    existing_metadata["name"] = name
    existing_metadata["image"] = image_url
    existing_metadata["updatedAt"] = updated_at

    properties = existing_metadata.get("properties")
    if not isinstance(properties, dict):
        properties = {}

    properties["maskTexture"] = image_url
    properties["creatorWallet"] = wallet
    properties["strokeData"] = normalized_strokes
    properties["accessories"] = normalized_accessories
    existing_metadata["properties"] = properties

    metadata_path.write_text(json.dumps(existing_metadata), encoding="utf-8")

    design_id = metadata_path.stem
    metadata_url = f"{base_url}/uploads/designs/{wallet}/{metadata_path.name}"

    return {
        "designId": design_id,
        "imageUrl": image_url,
        "metadataUrl": metadata_url,
        "maskTextureUrl": image_url,
    }


def delete_design_assets(
    uploads_root: Path,
    base_url: str,
    wallet: str,
    metadata_uri: str,
) -> dict[str, Any]:
    metadata_path = _resolve_local_upload_file(
        uploads_root,
        base_url,
        wallet,
        metadata_uri,
        expected_suffix=".json",
    )

    if metadata_path is None:
        return {
            "deleted": False,
            "deletedMetadata": False,
            "deletedImage": False,
            "skipped": True,
            "reason": "Metadata URI is not local to this backend",
        }

    image_path: Path | None = None
    if metadata_path.exists():
        try:
            metadata_json = json.loads(metadata_path.read_text(encoding="utf-8"))
            image_url = metadata_json.get("image")
            image_path = _resolve_local_upload_file(
                uploads_root,
                base_url,
                wallet,
                image_url,
                expected_suffix="",
            )
        except Exception:
            image_path = None

    deleted_metadata = False
    deleted_image = False

    if metadata_path.exists():
        metadata_path.unlink()
        deleted_metadata = True

    if image_path is not None and image_path.exists():
        image_path.unlink()
        deleted_image = True

    wallet_folder = uploads_root / "designs" / wallet
    if wallet_folder.exists() and wallet_folder.is_dir() and not any(wallet_folder.iterdir()):
        wallet_folder.rmdir()

    return {
        "deleted": deleted_metadata or deleted_image,
        "deletedMetadata": deleted_metadata,
        "deletedImage": deleted_image,
        "skipped": False,
    }
