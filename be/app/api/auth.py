from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from solders.pubkey import Pubkey

from app.services.auth import create_wallet_challenge, verify_wallet_signature

router = APIRouter(tags=["auth"])


class ChallengeRequest(BaseModel):
    wallet: str = Field(min_length=32, max_length=64)


class VerifyRequest(BaseModel):
    wallet: str = Field(min_length=32, max_length=64)
    nonce: str = Field(min_length=10)
    message: str = Field(min_length=10)
    signature: str = Field(min_length=40)


@router.post("/api/auth/challenge")
async def create_challenge(payload: ChallengeRequest) -> dict[str, str]:
    try:
        Pubkey.from_string(payload.wallet)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid wallet address") from exc

    nonce, message, expires_at = create_wallet_challenge(payload.wallet)
    return {
        "nonce": nonce,
        "message": message,
        "expiresAt": expires_at.isoformat(),
    }


@router.post("/api/auth/verify")
async def verify_challenge(payload: VerifyRequest) -> dict[str, str]:
    try:
        token = verify_wallet_signature(
            wallet=payload.wallet,
            nonce=payload.nonce,
            message=payload.message,
            signature_base64=payload.signature,
        )
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    return {
        "accessToken": token,
        "tokenType": "Bearer",
    }
