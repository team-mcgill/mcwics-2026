from __future__ import annotations

import base64
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from solders.pubkey import Pubkey
from solders.signature import Signature


CHALLENGE_TTL_SECONDS = 300
TOKEN_TTL_SECONDS = 3600


@dataclass
class ChallengeRecord:
    wallet: str
    message: str
    expires_at: datetime


@dataclass
class TokenRecord:
    wallet: str
    expires_at: datetime


_challenges: dict[str, ChallengeRecord] = {}
_tokens: dict[str, TokenRecord] = {}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _cleanup_expired() -> None:
    now = _utc_now()

    expired_challenges = [nonce for nonce, record in _challenges.items() if record.expires_at <= now]
    for nonce in expired_challenges:
        _challenges.pop(nonce, None)

    expired_tokens = [token for token, record in _tokens.items() if record.expires_at <= now]
    for token in expired_tokens:
        _tokens.pop(token, None)


def create_wallet_challenge(wallet: str) -> tuple[str, str, datetime]:
    _cleanup_expired()

    now = _utc_now()
    nonce = secrets.token_urlsafe(24)
    expires_at = now + timedelta(seconds=CHALLENGE_TTL_SECONDS)

    message = (
        "Masquerade wallet verification\n"
        f"wallet:{wallet}\n"
        f"nonce:{nonce}\n"
        f"issuedAt:{now.isoformat()}\n"
        f"expiresAt:{expires_at.isoformat()}"
    )

    _challenges[nonce] = ChallengeRecord(wallet=wallet, message=message, expires_at=expires_at)
    return nonce, message, expires_at


def verify_wallet_signature(wallet: str, nonce: str, message: str, signature_base64: str) -> str:
    _cleanup_expired()

    challenge = _challenges.get(nonce)
    if challenge is None:
        raise ValueError("Challenge not found or expired")

    if challenge.wallet != wallet or challenge.message != message:
        raise ValueError("Challenge payload does not match")

    if challenge.expires_at <= _utc_now():
        _challenges.pop(nonce, None)
        raise ValueError("Challenge expired")

    try:
        pubkey = Pubkey.from_string(wallet)
    except Exception as exc:
        raise ValueError("Invalid wallet address") from exc

    try:
        signature_bytes = base64.b64decode(signature_base64, validate=True)
        signature = Signature.from_bytes(signature_bytes)
    except Exception as exc:
        raise ValueError("Invalid signature encoding") from exc

    if not signature.verify(pubkey, message.encode("utf-8")):
        raise ValueError("Signature verification failed")

    _challenges.pop(nonce, None)

    token = secrets.token_urlsafe(32)
    _tokens[token] = TokenRecord(wallet=wallet, expires_at=_utc_now() + timedelta(seconds=TOKEN_TTL_SECONDS))
    return token


def get_wallet_for_token(token: str) -> str | None:
    _cleanup_expired()
    record = _tokens.get(token)
    if record is None:
        return None
    return record.wallet
