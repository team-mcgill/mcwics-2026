from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.config import get_settings
from app.services.auth import get_wallet_for_token
from app.services.marketplace import (
    cancel_listing,
    create_listing,
    get_marketplace_authority_pubkey,
    is_payment_signature_used,
    list_active_listings,
    lock_listing_for_purchase,
    mark_listing_sold,
    release_listing_lock,
    transfer_nft_with_marketplace_delegate,
    verify_payment_transaction,
)

router = APIRouter(tags=["marketplace"])

MARKETPLACE_STORAGE_PATH = Path(__file__).resolve().parents[2] / "storage" / "marketplace" / "listings.json"


class CreateListingRequest(BaseModel):
    mintAddress: str = Field(min_length=32, max_length=64)
    metadataUri: str = Field(min_length=10, max_length=500)
    name: str = Field(min_length=1, max_length=120)
    imageData: str = Field(min_length=3)
    category: str = Field(default="Masks", max_length=48)
    priceSol: float = Field(gt=0)


class CancelListingRequest(BaseModel):
    listingId: str = Field(min_length=10, max_length=80)


class BuyListingRequest(BaseModel):
    listingId: str = Field(min_length=10, max_length=80)
    paymentSignature: str = Field(min_length=20, max_length=120)


def _require_wallet_from_bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.split(" ", 1)[1].strip()
    wallet = get_wallet_for_token(token)
    if not wallet:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return wallet


@router.get("/api/marketplace/config")
async def marketplace_config() -> dict[str, str]:
    settings = get_settings()

    try:
        authority_pubkey = get_marketplace_authority_pubkey(settings.marketplace_authority_secret)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return {
        "authorityPubkey": authority_pubkey,
        "cluster": settings.solana_cluster,
    }


@router.get("/api/marketplace/listings")
async def marketplace_listings() -> dict[str, list[dict[str, Any]]]:
    try:
        items = list_active_listings(MARKETPLACE_STORAGE_PATH)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {"items": items}


@router.post("/api/marketplace/listings/create")
async def create_marketplace_listing(
    payload: CreateListingRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    wallet = _require_wallet_from_bearer(authorization)

    try:
        listing = create_listing(
            MARKETPLACE_STORAGE_PATH,
            seller_wallet=wallet,
            mint_address=payload.mintAddress,
            metadata_uri=payload.metadataUri,
            name=payload.name,
            image_data=payload.imageData,
            category=payload.category,
            price_sol=payload.priceSol,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return listing


@router.post("/api/marketplace/listings/cancel")
async def cancel_marketplace_listing(
    payload: CancelListingRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    wallet = _require_wallet_from_bearer(authorization)

    try:
        listing = cancel_listing(
            MARKETPLACE_STORAGE_PATH,
            listing_id=payload.listingId,
            wallet=wallet,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return listing


@router.post("/api/marketplace/listings/buy")
async def buy_marketplace_listing(
    payload: BuyListingRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    settings = get_settings()
    buyer_wallet = _require_wallet_from_bearer(authorization)

    try:
        listing = lock_listing_for_purchase(
            MARKETPLACE_STORAGE_PATH,
            listing_id=payload.listingId,
            buyer_wallet=buyer_wallet,
            lock_ttl_seconds=settings.marketplace_listing_lock_ttl_seconds,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        if is_payment_signature_used(MARKETPLACE_STORAGE_PATH, payload.paymentSignature.strip()):
            raise ValueError("Payment signature was already used")

        await verify_payment_transaction(
            rpc_url=settings.solana_rpc_url,
            signature=payload.paymentSignature.strip(),
            buyer_wallet=buyer_wallet,
            seller_wallet=listing["sellerWallet"],
            expected_lamports=int(listing["priceLamports"]),
        )

        transfer_signature = await transfer_nft_with_marketplace_delegate(
            rpc_url=settings.solana_rpc_url,
            authority_secret_base58=settings.marketplace_authority_secret,
            mint_address=listing["mintAddress"],
            seller_wallet=listing["sellerWallet"],
            buyer_wallet=buyer_wallet,
        )

        sold = mark_listing_sold(
            MARKETPLACE_STORAGE_PATH,
            listing_id=listing["id"],
            buyer_wallet=buyer_wallet,
            payment_signature=payload.paymentSignature.strip(),
            transfer_signature=transfer_signature,
        )
    except ValueError as exc:
        release_listing_lock(
            MARKETPLACE_STORAGE_PATH,
            listing_id=payload.listingId,
            buyer_wallet=buyer_wallet,
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        release_listing_lock(
            MARKETPLACE_STORAGE_PATH,
            listing_id=payload.listingId,
            buyer_wallet=buyer_wallet,
        )
        raise HTTPException(status_code=502, detail=f"Marketplace buy failed: {exc}") from exc

    return sold
