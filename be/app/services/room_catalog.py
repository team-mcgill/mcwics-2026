from __future__ import annotations

import json
import threading
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4


STORE_VERSION = 1
MIN_ROOM_NAME_LENGTH = 1
MAX_ROOM_NAME_LENGTH = 80
MIN_TOPIC_LENGTH = 1
MAX_TOPIC_LENGTH = 60
MAX_IMAGE_LENGTH = 16
MIN_MAX_PLAYERS = 2
MAX_MAX_PLAYERS = 120
MIN_MAP_ID_LENGTH = 1
MAX_MAP_ID_LENGTH = 80
MAX_MAP_MODEL_LENGTH = 220
MIN_DEFAULT_Y_AXIS = -5000.0
MAX_DEFAULT_Y_AXIS = 5000.0
DEFAULT_MAP_ID = "futuristic-plaza"
DEFAULT_MAP_MODEL = "/models/futuristic_plaza.glb"
DEFAULT_Y_AXIS = 0.0

_store_lock = threading.RLock()

_DEFAULT_ROOMS: list[dict[str, Any]] = [
    {
        "id": "1",
        "name": "The Grand Ballroom",
        "topic": "Music",
        "image": "🎭",
        "maxPlayers": 50,
        "mapId": "futuristic-plaza",
        "mapModel": "/models/futuristic_plaza.glb",
        "defaultYAxis": 0,
    },
    {
        "id": "2",
        "name": "Garden of Whispers",
        "topic": "Romance",
        "image": "🌹",
        "maxPlayers": 30,
        "mapId": "japanese-garden",
        "mapModel": "/models/japanese_garden.glb",
        "defaultYAxis": 0,
    },
    {
        "id": "3",
        "name": "Midnight Gallery",
        "topic": "Art",
        "image": "🎨",
        "maxPlayers": 20,
        "mapId": "futuristic-plaza",
        "mapModel": "/models/futuristic_plaza.glb",
        "defaultYAxis": 0,
    },
    {
        "id": "4",
        "name": "Shadow Theater",
        "topic": "Mystery",
        "image": "🎪",
        "maxPlayers": 40,
        "mapId": "futuristic-plaza",
        "mapModel": "/models/futuristic_plaza.glb",
        "defaultYAxis": 0,
    },
    {
        "id": "5",
        "name": "Crystal Palace",
        "topic": "Fashion",
        "image": "💎",
        "maxPlayers": 60,
        "mapId": "japanese-garden",
        "mapModel": "/models/japanese_garden.glb",
        "defaultYAxis": 0,
    },
    {
        "id": "6",
        "name": "Velvet Lounge",
        "topic": "Poetry",
        "image": "📜",
        "maxPlayers": 25,
        "mapId": "futuristic-plaza",
        "mapModel": "/models/futuristic_plaza.glb",
        "defaultYAxis": 0,
    },
]


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_default_rooms() -> list[dict[str, Any]]:
    timestamp = _utc_now_iso()
    return [
        {
            "id": str(room["id"]),
            "name": room["name"],
            "topic": room["topic"],
            "image": room["image"],
            "maxPlayers": int(room["maxPlayers"]),
            "mapId": room.get("mapId", DEFAULT_MAP_ID),
            "mapModel": room.get("mapModel", DEFAULT_MAP_MODEL),
            "defaultYAxis": float(room.get("defaultYAxis", DEFAULT_Y_AXIS)),
            "createdAt": timestamp,
            "updatedAt": timestamp,
        }
        for room in _DEFAULT_ROOMS
    ]


def _empty_store() -> dict[str, Any]:
    return {
        "version": STORE_VERSION,
        "rooms": _build_default_rooms(),
    }


def _ensure_storage_file(storage_path: Path) -> None:
    storage_path.parent.mkdir(parents=True, exist_ok=True)
    if not storage_path.exists():
        storage_path.write_text(json.dumps(_empty_store()), encoding="utf-8")


def _sanitize_text(
    value: object,
    *,
    field_name: str,
    min_length: int,
    max_length: int,
) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{field_name} is required")

    cleaned = value.strip()
    if len(cleaned) < min_length:
        raise ValueError(f"{field_name} is required")

    return cleaned[:max_length]


def _sanitize_max_players(value: object) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("maxPlayers must be an integer") from exc

    if parsed < MIN_MAX_PLAYERS or parsed > MAX_MAX_PLAYERS:
        raise ValueError(f"maxPlayers must be between {MIN_MAX_PLAYERS} and {MAX_MAX_PLAYERS}")

    return parsed


def _sanitize_map_id(value: object) -> str:
    if not isinstance(value, str):
        raise ValueError("mapId is required")

    cleaned = value.strip()
    if len(cleaned) < MIN_MAP_ID_LENGTH:
        raise ValueError("mapId is required")

    return cleaned[:MAX_MAP_ID_LENGTH]


def _sanitize_map_model(value: object) -> str:
    if not isinstance(value, str):
        raise ValueError("mapModel is required")

    cleaned = value.strip()
    if not cleaned:
        raise ValueError("mapModel is required")

    if not cleaned.startswith("/models/"):
        raise ValueError("mapModel must be a /models/ path")

    return cleaned[:MAX_MAP_MODEL_LENGTH]


def _sanitize_default_y_axis(value: object) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("defaultYAxis must be a number") from exc

    return max(MIN_DEFAULT_Y_AXIS, min(MAX_DEFAULT_Y_AXIS, parsed))


def _normalize_room(raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None

    room_id = raw.get("id")
    if room_id is None:
        return None

    room_id_str = str(room_id).strip()
    if not room_id_str:
        return None

    try:
        name = _sanitize_text(
            raw.get("name"),
            field_name="name",
            min_length=MIN_ROOM_NAME_LENGTH,
            max_length=MAX_ROOM_NAME_LENGTH,
        )
        topic = _sanitize_text(
            raw.get("topic"),
            field_name="topic",
            min_length=MIN_TOPIC_LENGTH,
            max_length=MAX_TOPIC_LENGTH,
        )
        image = _sanitize_text(
            raw.get("image") if raw.get("image") is not None else "🎭",
            field_name="image",
            min_length=1,
            max_length=MAX_IMAGE_LENGTH,
        )
        max_players = _sanitize_max_players(raw.get("maxPlayers"))
    except ValueError:
        return None

    try:
        map_id = _sanitize_map_id(raw.get("mapId", DEFAULT_MAP_ID))
    except ValueError:
        map_id = DEFAULT_MAP_ID

    try:
        map_model = _sanitize_map_model(raw.get("mapModel", DEFAULT_MAP_MODEL))
    except ValueError:
        map_model = DEFAULT_MAP_MODEL

    try:
        default_y_axis = _sanitize_default_y_axis(raw.get("defaultYAxis", DEFAULT_Y_AXIS))
    except ValueError:
        default_y_axis = DEFAULT_Y_AXIS

    created_at = raw.get("createdAt") if isinstance(raw.get("createdAt"), str) else _utc_now_iso()
    updated_at = raw.get("updatedAt") if isinstance(raw.get("updatedAt"), str) else created_at

    return {
        "id": room_id_str,
        "name": name,
        "topic": topic,
        "image": image,
        "maxPlayers": max_players,
        "mapId": map_id,
        "mapModel": map_model,
        "defaultYAxis": default_y_axis,
        "createdAt": created_at,
        "updatedAt": updated_at,
    }


def _load_store_unlocked(storage_path: Path) -> dict[str, Any]:
    _ensure_storage_file(storage_path)

    try:
        payload = json.loads(storage_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ValueError("Room storage is invalid") from exc

    if not isinstance(payload, dict):
        raise ValueError("Room storage format is invalid")

    raw_rooms = payload.get("rooms")
    normalized_rooms: list[dict[str, Any]] = []

    if isinstance(raw_rooms, list):
        seen_ids: set[str] = set()
        for entry in raw_rooms:
            normalized = _normalize_room(entry)
            if normalized is None:
                continue
            if normalized["id"] in seen_ids:
                continue
            seen_ids.add(normalized["id"])
            normalized_rooms.append(normalized)

    if not normalized_rooms:
        normalized_rooms = _build_default_rooms()

    payload["version"] = STORE_VERSION
    payload["rooms"] = normalized_rooms
    return payload


def _write_store_unlocked(storage_path: Path, payload: dict[str, Any]) -> None:
    temp_path = storage_path.with_suffix(f"{storage_path.suffix}.tmp")
    temp_path.write_text(json.dumps(payload), encoding="utf-8")
    temp_path.replace(storage_path)


def list_rooms(storage_path: Path) -> list[dict[str, Any]]:
    with _store_lock:
        store = _load_store_unlocked(storage_path)
        _write_store_unlocked(storage_path, store)
        return deepcopy(store["rooms"])


def create_room(
    storage_path: Path,
    *,
    name: str,
    topic: str,
    image: str,
    max_players: int,
    map_id: str,
    map_model: str,
    default_y_axis: float,
) -> dict[str, Any]:
    room_name = _sanitize_text(
        name,
        field_name="name",
        min_length=MIN_ROOM_NAME_LENGTH,
        max_length=MAX_ROOM_NAME_LENGTH,
    )
    room_topic = _sanitize_text(
        topic,
        field_name="topic",
        min_length=MIN_TOPIC_LENGTH,
        max_length=MAX_TOPIC_LENGTH,
    )
    room_image = _sanitize_text(
        image,
        field_name="image",
        min_length=1,
        max_length=MAX_IMAGE_LENGTH,
    )
    room_max_players = _sanitize_max_players(max_players)
    room_map_id = _sanitize_map_id(map_id)
    room_map_model = _sanitize_map_model(map_model)
    room_default_y_axis = _sanitize_default_y_axis(default_y_axis)

    timestamp = _utc_now_iso()

    with _store_lock:
        store = _load_store_unlocked(storage_path)

        next_id = uuid4().hex[:12]
        existing_ids = {str(room.get("id")) for room in store["rooms"]}
        while next_id in existing_ids:
            next_id = uuid4().hex[:12]

        room = {
            "id": next_id,
            "name": room_name,
            "topic": room_topic,
            "image": room_image,
            "maxPlayers": room_max_players,
            "mapId": room_map_id,
            "mapModel": room_map_model,
            "defaultYAxis": room_default_y_axis,
            "createdAt": timestamp,
            "updatedAt": timestamp,
        }

        store["rooms"].append(room)
        _write_store_unlocked(storage_path, store)

    return deepcopy(room)
