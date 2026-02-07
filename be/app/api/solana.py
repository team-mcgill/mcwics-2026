from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.services.solana_client import get_current_slot

router = APIRouter(tags=["solana"])


@router.get("/solana/status")
async def solana_status() -> dict[str, str | int]:
    settings = get_settings()

    try:
        slot = await get_current_slot(settings.solana_rpc_url)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Devnet RPC unavailable: {exc}") from exc

    return {
        "cluster": settings.solana_cluster,
        "rpc_url": settings.solana_rpc_url,
        "slot": slot,
    }
