from __future__ import annotations

import json
import threading
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any
from uuid import uuid4

from solana.rpc.async_api import AsyncClient
from solana.rpc.types import TxOpts
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.signature import Signature
from solders.transaction import Transaction
from spl.token.constants import TOKEN_PROGRAM_ID
from spl.token.instructions import (
    TransferCheckedParams,
    create_idempotent_associated_token_account,
    get_associated_token_address,
    transfer_checked,
)


LAMPORTS_PER_SOL = 1_000_000_000
STORE_VERSION = 1
ACTIVE_STATUS = "active"
LOCKED_STATUS = "locked"
SOLD_STATUS = "sold"
CANCELLED_STATUS = "cancelled"

_store_lock = threading.RLock()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _utc_now_iso() -> str:
    return _utc_now().isoformat()


def _empty_store() -> dict[str, Any]:
    return {
        "version": STORE_VERSION,
        "listings": [],
    }


def _ensure_storage_file(storage_path: Path) -> None:
    storage_path.parent.mkdir(parents=True, exist_ok=True)
    if not storage_path.exists():
        storage_path.write_text(json.dumps(_empty_store()), encoding="utf-8")


def _load_store_unlocked(storage_path: Path) -> dict[str, Any]:
    _ensure_storage_file(storage_path)

    try:
        payload = json.loads(storage_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ValueError("Marketplace storage is invalid") from exc

    if not isinstance(payload, dict):
        raise ValueError("Marketplace storage format is invalid")

    listings = payload.get("listings")
    if not isinstance(listings, list):
        payload["listings"] = []

    payload.setdefault("version", STORE_VERSION)
    return payload


def _write_store_unlocked(storage_path: Path, payload: dict[str, Any]) -> None:
    temp_path = storage_path.with_suffix(f"{storage_path.suffix}.tmp")
    temp_path.write_text(json.dumps(payload), encoding="utf-8")
    temp_path.replace(storage_path)


def _normalize_category(category: str | None) -> str:
    if not isinstance(category, str):
        return "Masks"
    cleaned = category.strip()
    return cleaned[:48] if cleaned else "Masks"


def _to_lamports(price_sol: float) -> int:
    if not isinstance(price_sol, (int, float)):
        raise ValueError("Listing price is invalid")

    if price_sol <= 0:
        raise ValueError("Listing price must be greater than zero")

    lamports = int(round(float(price_sol) * LAMPORTS_PER_SOL))
    if lamports <= 0:
        raise ValueError("Listing price is too small")

    return lamports


def _normalize_pubkey(value: str, *, field_name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field_name} is required")

    cleaned = value.strip()
    try:
        Pubkey.from_string(cleaned)
    except Exception as exc:
        raise ValueError(f"{field_name} is invalid") from exc

    return cleaned


@lru_cache(maxsize=1)
def load_marketplace_authority(secret_base58: str) -> Keypair:
    if not isinstance(secret_base58, str) or not secret_base58.strip():
        raise ValueError("Marketplace authority secret is not configured")

    try:
        return Keypair.from_base58_string(secret_base58.strip())
    except Exception as exc:
        raise ValueError("Marketplace authority secret is invalid") from exc


def get_marketplace_authority_pubkey(secret_base58: str) -> str:
    return str(load_marketplace_authority(secret_base58).pubkey())


def list_active_listings(storage_path: Path) -> list[dict[str, Any]]:
    with _store_lock:
        store = _load_store_unlocked(storage_path)
        active = [item for item in store["listings"] if item.get("status") == ACTIVE_STATUS]

    active.sort(key=lambda item: item.get("createdAt") or "", reverse=True)
    return deepcopy(active)


def create_listing(
    storage_path: Path,
    *,
    seller_wallet: str,
    mint_address: str,
    metadata_uri: str,
    name: str,
    image_data: str,
    category: str,
    price_sol: float,
) -> dict[str, Any]:
    seller_wallet = _normalize_pubkey(seller_wallet, field_name="Seller wallet")
    mint_address = _normalize_pubkey(mint_address, field_name="Mint address")

    if not isinstance(metadata_uri, str) or not metadata_uri.strip():
        raise ValueError("Metadata URI is required")

    if not isinstance(name, str) or not name.strip():
        raise ValueError("Listing name is required")

    if not isinstance(image_data, str) or not image_data.strip():
        raise ValueError("Listing image is required")

    price_lamports = _to_lamports(price_sol)
    normalized_category = _normalize_category(category)

    listing = {
        "id": uuid4().hex,
        "sellerWallet": seller_wallet,
        "mintAddress": mint_address,
        "metadataUri": metadata_uri.strip(),
        "name": name.strip()[:120],
        "imageData": image_data.strip(),
        "category": normalized_category,
        "priceSol": price_lamports / LAMPORTS_PER_SOL,
        "priceLamports": price_lamports,
        "status": ACTIVE_STATUS,
        "createdAt": _utc_now_iso(),
        "updatedAt": _utc_now_iso(),
    }

    with _store_lock:
        store = _load_store_unlocked(storage_path)

        for item in store["listings"]:
            same_mint = item.get("mintAddress") == mint_address
            active_like = item.get("status") in {ACTIVE_STATUS, LOCKED_STATUS}
            if same_mint and active_like:
                raise ValueError("This item is already listed")

        store["listings"].append(listing)
        _write_store_unlocked(storage_path, store)

    return deepcopy(listing)


def cancel_listing(
    storage_path: Path,
    *,
    listing_id: str,
    wallet: str,
) -> dict[str, Any]:
    wallet = _normalize_pubkey(wallet, field_name="Wallet")

    with _store_lock:
        store = _load_store_unlocked(storage_path)
        for item in store["listings"]:
            if item.get("id") != listing_id:
                continue

            if item.get("sellerWallet") != wallet:
                raise ValueError("You do not own this listing")

            if item.get("status") != ACTIVE_STATUS:
                raise ValueError("Listing is not active")

            item["status"] = CANCELLED_STATUS
            item["updatedAt"] = _utc_now_iso()
            _write_store_unlocked(storage_path, store)
            return deepcopy(item)

    raise ValueError("Listing not found")


def lock_listing_for_purchase(
    storage_path: Path,
    *,
    listing_id: str,
    buyer_wallet: str,
    lock_ttl_seconds: int,
) -> dict[str, Any]:
    buyer_wallet = _normalize_pubkey(buyer_wallet, field_name="Buyer wallet")
    now = _utc_now()

    with _store_lock:
        store = _load_store_unlocked(storage_path)
        for item in store["listings"]:
            if item.get("id") != listing_id:
                continue

            status = item.get("status")
            if status == LOCKED_STATUS:
                expires_at_raw = item.get("lockExpiresAt")
                try:
                    expires_at = datetime.fromisoformat(expires_at_raw) if isinstance(expires_at_raw, str) else now
                except ValueError:
                    expires_at = now

                if expires_at <= now:
                    item["status"] = ACTIVE_STATUS
                    item.pop("lockBuyerWallet", None)
                    item.pop("lockExpiresAt", None)
                    status = ACTIVE_STATUS

            if status != ACTIVE_STATUS:
                raise ValueError("Listing is not available")

            item["status"] = LOCKED_STATUS
            item["lockBuyerWallet"] = buyer_wallet
            item["lockExpiresAt"] = (now + timedelta(seconds=max(30, lock_ttl_seconds))).isoformat()
            item["updatedAt"] = _utc_now_iso()
            _write_store_unlocked(storage_path, store)
            return deepcopy(item)

    raise ValueError("Listing not found")


def release_listing_lock(
    storage_path: Path,
    *,
    listing_id: str,
    buyer_wallet: str,
) -> None:
    with _store_lock:
        store = _load_store_unlocked(storage_path)
        changed = False

        for item in store["listings"]:
            if item.get("id") != listing_id:
                continue

            if item.get("status") != LOCKED_STATUS:
                continue

            if item.get("lockBuyerWallet") != buyer_wallet:
                continue

            item["status"] = ACTIVE_STATUS
            item.pop("lockBuyerWallet", None)
            item.pop("lockExpiresAt", None)
            item["updatedAt"] = _utc_now_iso()
            changed = True
            break

        if changed:
            _write_store_unlocked(storage_path, store)


def is_payment_signature_used(storage_path: Path, payment_signature: str) -> bool:
    with _store_lock:
        store = _load_store_unlocked(storage_path)
        return any(item.get("paymentSignature") == payment_signature for item in store["listings"])


def mark_listing_sold(
    storage_path: Path,
    *,
    listing_id: str,
    buyer_wallet: str,
    payment_signature: str,
    transfer_signature: str,
) -> dict[str, Any]:
    with _store_lock:
        store = _load_store_unlocked(storage_path)
        for item in store["listings"]:
            if item.get("id") != listing_id:
                continue

            if item.get("status") != LOCKED_STATUS:
                raise ValueError("Listing is not locked for purchase")

            if item.get("lockBuyerWallet") != buyer_wallet:
                raise ValueError("Listing lock does not match buyer")

            item["status"] = SOLD_STATUS
            item["buyerWallet"] = buyer_wallet
            item["paymentSignature"] = payment_signature
            item["transferSignature"] = transfer_signature
            item["soldAt"] = _utc_now_iso()
            item.pop("lockBuyerWallet", None)
            item.pop("lockExpiresAt", None)
            item["updatedAt"] = _utc_now_iso()

            _write_store_unlocked(storage_path, store)
            return deepcopy(item)

    raise ValueError("Listing not found")


async def verify_payment_transaction(
    *,
    rpc_url: str,
    signature: str,
    buyer_wallet: str,
    seller_wallet: str,
    expected_lamports: int,
) -> None:
    buyer_wallet = _normalize_pubkey(buyer_wallet, field_name="Buyer wallet")
    seller_wallet = _normalize_pubkey(seller_wallet, field_name="Seller wallet")

    try:
        tx_signature = Signature.from_string(signature)
    except Exception as exc:
        raise ValueError("Payment signature is invalid") from exc

    async with AsyncClient(rpc_url) as client:
        response = await client.get_transaction(
            tx_signature,
            encoding="jsonParsed",
            commitment="confirmed",
            max_supported_transaction_version=0,
        )

    payload = json.loads(response.to_json())
    result = payload.get("result")
    if not isinstance(result, dict):
        raise ValueError("Payment transaction was not found on chain")

    meta = result.get("meta") or {}
    if meta.get("err") is not None:
        raise ValueError("Payment transaction failed")

    message = ((result.get("transaction") or {}).get("message") or {})
    account_keys = message.get("accountKeys") or []
    buyer_signed = any(
        isinstance(entry, dict)
        and entry.get("pubkey") == buyer_wallet
        and bool(entry.get("signer"))
        for entry in account_keys
    )
    if not buyer_signed:
        raise ValueError("Payment transaction is not signed by buyer")

    transfer_found = False
    for instruction in message.get("instructions") or []:
        if not isinstance(instruction, dict):
            continue

        parsed = instruction.get("parsed")
        if not isinstance(parsed, dict):
            continue

        if parsed.get("type") != "transfer":
            continue

        info = parsed.get("info") or {}
        source = info.get("source")
        destination = info.get("destination")
        lamports = info.get("lamports")

        if source != buyer_wallet or destination != seller_wallet:
            continue

        if not isinstance(lamports, int):
            continue

        if lamports < expected_lamports:
            raise ValueError("Payment amount is lower than listing price")

        transfer_found = True
        break

    if not transfer_found:
        raise ValueError("Could not verify expected SOL transfer in payment transaction")


async def transfer_nft_with_marketplace_delegate(
    *,
    rpc_url: str,
    authority_secret_base58: str,
    mint_address: str,
    seller_wallet: str,
    buyer_wallet: str,
) -> str:
    authority = load_marketplace_authority(authority_secret_base58)

    mint = Pubkey.from_string(mint_address)
    seller = Pubkey.from_string(seller_wallet)
    buyer = Pubkey.from_string(buyer_wallet)

    seller_ata = get_associated_token_address(owner=seller, mint=mint, token_program_id=TOKEN_PROGRAM_ID)
    buyer_ata = get_associated_token_address(owner=buyer, mint=mint, token_program_id=TOKEN_PROGRAM_ID)

    instructions = [
        create_idempotent_associated_token_account(
            payer=authority.pubkey(),
            owner=buyer,
            mint=mint,
            token_program_id=TOKEN_PROGRAM_ID,
        ),
        transfer_checked(
            TransferCheckedParams(
                program_id=TOKEN_PROGRAM_ID,
                source=seller_ata,
                mint=mint,
                dest=buyer_ata,
                owner=authority.pubkey(),
                amount=1,
                decimals=0,
                signers=[],
            )
        ),
    ]

    async with AsyncClient(rpc_url) as client:
        latest = await client.get_latest_blockhash(commitment="confirmed")
        blockhash = latest.value.blockhash

        transaction = Transaction.new_signed_with_payer(
            instructions,
            authority.pubkey(),
            [authority],
            blockhash,
        )

        send_resp = await client.send_transaction(
            transaction,
            opts=TxOpts(
                skip_preflight=False,
                preflight_commitment="confirmed",
                skip_confirmation=False,
                last_valid_block_height=latest.value.last_valid_block_height,
            ),
        )

        signature = send_resp.value

        status_resp = await client.get_signature_statuses([signature], search_transaction_history=True)
        status_value = status_resp.value[0] if status_resp.value else None
        if status_value is None or status_value.err is not None:
            raise ValueError("Marketplace transfer transaction failed")

        return str(signature)
