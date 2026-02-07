from __future__ import annotations

import asyncio
from dataclasses import dataclass, field

from fastapi import WebSocket


@dataclass
class RoomParticipant:
    player_id: str
    room_id: str
    name: str
    wallet: str | None
    websocket: WebSocket
    position: dict[str, float] = field(default_factory=lambda: {"x": 0.0, "y": 0.0, "z": 0.0})
    rotation_y: float = 0.0
    cosmetic_image_data: str | None = None

    def serialize(self) -> dict[str, object]:
        return {
            "id": self.player_id,
            "name": self.name,
            "wallet": self.wallet,
            "position": {
                "x": float(self.position.get("x", 0.0)),
                "y": float(self.position.get("y", 0.0)),
                "z": float(self.position.get("z", 0.0)),
            },
            "rotationY": float(self.rotation_y),
            "cosmeticImageData": self.cosmetic_image_data,
        }


class RoomStateManager:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._rooms: dict[str, dict[str, RoomParticipant]] = {}

    async def add_participant(self, participant: RoomParticipant) -> tuple[list[dict[str, object]], list[WebSocket]]:
        async with self._lock:
            room = self._rooms.setdefault(participant.room_id, {})
            room[participant.player_id] = participant

            snapshot = [entry.serialize() for entry in room.values()]
            other_sockets = [
                entry.websocket
                for entry in room.values()
                if entry.player_id != participant.player_id
            ]

        return snapshot, other_sockets

    async def remove_participant(self, room_id: str, player_id: str) -> list[WebSocket]:
        async with self._lock:
            room = self._rooms.get(room_id)
            if not room:
                return []

            removed = room.pop(player_id, None)
            if removed is None:
                return []

            recipients = [entry.websocket for entry in room.values()]
            if not room:
                self._rooms.pop(room_id, None)

        return recipients

    async def update_movement(
        self,
        *,
        room_id: str,
        player_id: str,
        position: dict[str, float],
        rotation_y: float,
    ) -> tuple[RoomParticipant | None, list[WebSocket]]:
        async with self._lock:
            room = self._rooms.get(room_id)
            if not room:
                return None, []

            participant = room.get(player_id)
            if participant is None:
                return None, []

            participant.position = {
                "x": float(position.get("x", 0.0)),
                "y": float(position.get("y", 0.0)),
                "z": float(position.get("z", 0.0)),
            }
            participant.rotation_y = float(rotation_y)

            recipients = [
                entry.websocket
                for entry in room.values()
                if entry.player_id != player_id
            ]

        return participant, recipients

    async def update_cosmetic(
        self,
        *,
        room_id: str,
        player_id: str,
        cosmetic_image_data: str | None,
    ) -> tuple[RoomParticipant | None, list[WebSocket]]:
        async with self._lock:
            room = self._rooms.get(room_id)
            if not room:
                return None, []

            participant = room.get(player_id)
            if participant is None:
                return None, []

            participant.cosmetic_image_data = cosmetic_image_data
            recipients = [entry.websocket for entry in room.values()]

        return participant, recipients

    async def get_participant(self, *, room_id: str, player_id: str) -> RoomParticipant | None:
        async with self._lock:
            room = self._rooms.get(room_id)
            if not room:
                return None
            return room.get(player_id)

    async def get_room_recipients(self, room_id: str) -> list[WebSocket]:
        async with self._lock:
            room = self._rooms.get(room_id)
            if not room:
                return []
            return [entry.websocket for entry in room.values()]


room_state_manager = RoomStateManager()
