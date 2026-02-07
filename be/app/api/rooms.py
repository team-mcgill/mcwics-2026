from __future__ import annotations

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.room_state import RoomParticipant, room_state_manager

router = APIRouter(tags=["rooms"])

MAX_NAME_LENGTH = 48
MAX_CHAT_LENGTH = 240
MAX_COSMETIC_IMAGE_DATA_LENGTH = 3_000_000
MAX_COORDINATE_ABS = 200.0
MAX_ROTATION_ABS = 1000.0


def _to_float(value: object, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def _sanitize_name(value: object) -> str:
    if isinstance(value, str):
        cleaned = value.strip()
    else:
        cleaned = ""

    if not cleaned:
        return "Guest"

    return cleaned[:MAX_NAME_LENGTH]


def _sanitize_wallet(value: object) -> str | None:
    if not isinstance(value, str):
        return None

    cleaned = value.strip()
    if not cleaned:
        return None

    return cleaned[:64]


def _sanitize_cosmetic_image_data(value: object) -> str | None:
    accepted, cleaned, _, _ = _parse_cosmetic_image_data(value)
    return cleaned if accepted else None


def _parse_cosmetic_image_data(value: object) -> tuple[bool, str | None, str, str]:
    if value is None:
        return True, None, "empty", ""

    if not isinstance(value, str):
        return False, None, "invalid_type", "Cosmetic must be a string."

    cleaned = value.strip()
    if not cleaned:
        return True, None, "empty", ""

    if len(cleaned) > MAX_COSMETIC_IMAGE_DATA_LENGTH:
        return False, None, "too_large", "Cosmetic payload is too large."

    if cleaned.startswith("data:image"):
        return True, cleaned, "data_url", ""

    if cleaned.startswith("http://") or cleaned.startswith("https://"):
        return True, cleaned, "http_url", ""

    return False, None, "unsupported_format", "Use data:image or http(s) image URL."


def _parse_position(value: object) -> dict[str, float]:
    if not isinstance(value, dict):
        return {"x": 0.0, "y": 0.0, "z": 0.0}

    return {
        "x": _clamp(_to_float(value.get("x"), 0.0), -MAX_COORDINATE_ABS, MAX_COORDINATE_ABS),
        "y": _clamp(_to_float(value.get("y"), 0.0), -MAX_COORDINATE_ABS, MAX_COORDINATE_ABS),
        "z": _clamp(_to_float(value.get("z"), 0.0), -MAX_COORDINATE_ABS, MAX_COORDINATE_ABS),
    }


def _parse_rotation(value: object) -> float:
    return _clamp(_to_float(value, 0.0), -MAX_ROTATION_ABS, MAX_ROTATION_ABS)


async def _send_json_safe(websocket: WebSocket, payload: dict[str, object]) -> bool:
    try:
        await websocket.send_json(payload)
        return True
    except Exception:
        return False


async def _broadcast_json(websockets: list[WebSocket], payload: dict[str, object]) -> None:
    for websocket in websockets:
        await _send_json_safe(websocket, payload)


@router.websocket("/ws/rooms/{room_id}")
async def room_socket(websocket: WebSocket, room_id: str) -> None:
    await websocket.accept()

    normalized_room_id = room_id.strip()[:80] or "default"
    player_id = secrets.token_urlsafe(10)
    joined = False

    try:
        while True:
            message = await websocket.receive_json()
            if not isinstance(message, dict):
                await _send_json_safe(websocket, {"type": "error", "message": "Invalid message payload."})
                continue

            message_type = message.get("type")

            if message_type == "join":
                if joined:
                    await _send_json_safe(websocket, {"type": "error", "message": "Already joined room."})
                    continue

                participant = RoomParticipant(
                    player_id=player_id,
                    room_id=normalized_room_id,
                    name=_sanitize_name(message.get("name")),
                    wallet=_sanitize_wallet(message.get("wallet")),
                    websocket=websocket,
                    position=_parse_position(message.get("position")),
                    rotation_y=_parse_rotation(message.get("rotationY")),
                    cosmetic_image_data=_sanitize_cosmetic_image_data(message.get("cosmeticImageData")),
                )

                snapshot, recipients = await room_state_manager.add_participant(participant)
                joined = True

                await _send_json_safe(websocket, {"type": "joined", "playerId": player_id})
                await _send_json_safe(websocket, {"type": "snapshot", "players": snapshot})

                await _broadcast_json(
                    recipients,
                    {"type": "player_joined", "player": participant.serialize()},
                )
                continue

            if not joined:
                await _send_json_safe(websocket, {"type": "error", "message": "Join room first."})
                continue

            if message_type == "move":
                position = _parse_position(message.get("position"))
                rotation_y = _parse_rotation(message.get("rotationY"))

                updated, recipients = await room_state_manager.update_movement(
                    room_id=normalized_room_id,
                    player_id=player_id,
                    position=position,
                    rotation_y=rotation_y,
                )

                if updated is None:
                    continue

                await _broadcast_json(
                    recipients,
                    {
                        "type": "player_moved",
                        "playerId": player_id,
                        "position": updated.position,
                        "rotationY": updated.rotation_y,
                    },
                )
                continue

            if message_type == "set_cosmetic":
                accepted, cosmetic_image_data, cosmetic_kind, reason = _parse_cosmetic_image_data(
                    message.get("cosmeticImageData")
                )
                if not accepted:
                    await _send_json_safe(
                        websocket,
                        {
                            "type": "set_cosmetic_ack",
                            "accepted": False,
                            "reason": reason,
                            "kind": cosmetic_kind,
                        },
                    )
                    continue

                updated, recipients = await room_state_manager.update_cosmetic(
                    room_id=normalized_room_id,
                    player_id=player_id,
                    cosmetic_image_data=cosmetic_image_data,
                )

                if updated is None:
                    await _send_json_safe(
                        websocket,
                        {
                            "type": "set_cosmetic_ack",
                            "accepted": False,
                            "reason": "Player was not found in room.",
                            "kind": cosmetic_kind,
                        },
                    )
                    continue

                await _send_json_safe(
                    websocket,
                    {
                        "type": "set_cosmetic_ack",
                        "accepted": True,
                        "reason": "",
                        "kind": cosmetic_kind,
                        "length": len(cosmetic_image_data or ""),
                    },
                )

                await _broadcast_json(
                    recipients,
                    {
                        "type": "player_cosmetic_updated",
                        "playerId": player_id,
                        "cosmeticImageData": updated.cosmetic_image_data,
                    },
                )
                continue

            if message_type == "chat":
                raw_text = message.get("text")
                if not isinstance(raw_text, str):
                    continue

                text = raw_text.strip()
                if not text:
                    continue

                text = text[:MAX_CHAT_LENGTH]
                participant = await room_state_manager.get_participant(
                    room_id=normalized_room_id,
                    player_id=player_id,
                )

                if participant is None:
                    continue

                recipients = await room_state_manager.get_room_recipients(normalized_room_id)
                await _broadcast_json(
                    recipients,
                    {
                        "type": "chat",
                        "playerId": player_id,
                        "name": participant.name,
                        "text": text,
                        "createdAt": datetime.now(timezone.utc).isoformat(),
                    },
                )
                continue

            await _send_json_safe(websocket, {"type": "error", "message": "Unsupported message type."})

    except WebSocketDisconnect:
        pass
    except Exception:
        await _send_json_safe(websocket, {"type": "error", "message": "Socket error."})
    finally:
        if joined:
            recipients = await room_state_manager.remove_participant(normalized_room_id, player_id)
            await _broadcast_json(recipients, {"type": "player_left", "playerId": player_id})
