import asyncio

from solana.rpc.async_api import AsyncClient
from solders.signature import Signature


TX_FETCH_MAX_WAIT_SECONDS = 30.0
TX_FETCH_INITIAL_DELAY_SECONDS = 0.75
TX_FETCH_MAX_DELAY_SECONDS = 3.0


async def get_current_slot(rpc_url: str) -> int:
    async with AsyncClient(rpc_url) as client:
        response = await client.get_slot()

    slot = getattr(response, "value", None)
    if slot is None:
        raise RuntimeError("Could not read slot from Solana RPC response")
    return int(slot)


async def verify_transaction(
    rpc_url: str,
    signature: str,
    expected_signer: str | None = None,
    expected_lamports: int | None = None,
) -> bool:
    """Verify a Solana transaction exists and optionally check signer and amount.

    Args:
        rpc_url: Solana RPC endpoint
        signature: Transaction signature
        expected_signer: Optional wallet address that should have signed
        expected_lamports: Optional lamport amount to verify

    Returns:
        True if transaction is valid and matches criteria
    """
    print(f"[VERIFY] Starting verification for signature: {signature[:20]}...", flush=True)
    print(f"[VERIFY] Expected signer: {expected_signer}", flush=True)
    print(f"[VERIFY] Expected lamports: {expected_lamports}", flush=True)
    async with AsyncClient(rpc_url) as client:
        try:
            sig = Signature.from_string(signature)
            print(f"[VERIFY] Signature parsed successfully", flush=True)
        except Exception as exc:
            print(f"[VERIFY] ERROR: Invalid signature format: {exc}", flush=True)
            raise ValueError(f"Invalid signature format: {exc}")

        print(f"[VERIFY] Fetching transaction from RPC...", flush=True)

        # Retry logic: allow enough time for propagation/indexing on RPC.
        elapsed = 0.0
        retry_delay = TX_FETCH_INITIAL_DELAY_SECONDS
        attempts = 0
        response = None

        while elapsed < TX_FETCH_MAX_WAIT_SECONDS:
            attempts += 1
            response = await client.get_transaction(
                sig,
                commitment="confirmed",
                max_supported_transaction_version=0,
            )
            if response and response.value:
                print(f"[VERIFY] Transaction found after {attempts} attempts", flush=True)
                break

            status_response = await client.get_signature_statuses(
                [sig],
                search_transaction_history=True,
            )
            status = None
            if status_response and getattr(status_response, "value", None):
                status = status_response.value[0]

            if status and getattr(status, "err", None):
                print(f"[VERIFY] ERROR: Signature status reports failure: {status.err}", flush=True)
                return False

            remaining = TX_FETCH_MAX_WAIT_SECONDS - elapsed
            sleep_for = min(retry_delay, remaining)
            if sleep_for <= 0:
                break

            print(
                f"[VERIFY] Attempt {attempts}: not indexed yet, retrying in {sleep_for:.2f}s "
                f"(elapsed {elapsed:.2f}/{TX_FETCH_MAX_WAIT_SECONDS:.2f}s)...",
                flush=True,
            )
            await asyncio.sleep(sleep_for)
            elapsed += sleep_for
            retry_delay = min(retry_delay * 1.5, TX_FETCH_MAX_DELAY_SECONDS)

        if not response or not response.value:
            print(
                f"[VERIFY] ERROR: Transaction not found in RPC after waiting "
                f"{TX_FETCH_MAX_WAIT_SECONDS:.2f}s",
                flush=True,
            )
            return False

        print(f"[VERIFY] Transaction found", flush=True)
        tx = response.value

        # Check transaction status
        if tx.transaction.meta.err:
            print(f"[VERIFY] ERROR: Transaction has error: {tx.transaction.meta.err}", flush=True)
            return False
        print(f"[VERIFY] Transaction status OK", flush=True)

        # Verify signer if provided
        if expected_signer:
            print(f"[VERIFY] Checking signer...", flush=True)
            account_keys = tx.transaction.transaction.message.account_keys
            print(f"[VERIFY] Account keys: {[str(k) for k in account_keys]}", flush=True)
            signer_found = False
            for i, key in enumerate(account_keys):
                key_str = str(key)
                print(f"[VERIFY] Checking key {i}: {key_str}", flush=True)
                if key_str == expected_signer:
                    signer_found = True
                    print(f"[VERIFY] Signer found at index {i}", flush=True)
                    break
            if not signer_found:
                print(f"[VERIFY] ERROR: Signer not found in account keys", flush=True)
                return False

        # Verify lamports if provided (check pre/post balances)
        if expected_lamports and expected_lamports > 0:
            meta = tx.transaction.meta
            account_keys = tx.transaction.transaction.message.account_keys

            # Find the signer's account index
            signer_index = None
            for i, key in enumerate(account_keys):
                if str(key) == expected_signer:
                    signer_index = i
                    break

            if signer_index is None:
                return False

            # Check the signer's balance decrease
            pre_balance = meta.pre_balances[signer_index]
            post_balance = meta.post_balances[signer_index]
            decrease = pre_balance - post_balance

            print(f"[DEBUG] Payment verification:")
            print(f"[DEBUG]   Expected: {expected_lamports} lamports ({expected_lamports / 1_000_000_000} SOL)")
            print(f"[DEBUG]   Pre-balance: {pre_balance}")
            print(f"[DEBUG]   Post-balance: {post_balance}")
            print(f"[DEBUG]   Decrease: {decrease} lamports ({decrease / 1_000_000_000} SOL)")
            print(f"[DEBUG]   Signer index: {signer_index}")
            print(f"[DEBUG]   Account keys: {[str(k) for k in account_keys]}")

            # Allow for transaction fees (up to 0.001 SOL)
            fee_tolerance = 1_000_000  # 0.001 SOL in lamports
            if decrease < expected_lamports or decrease > expected_lamports + fee_tolerance:
                print(f"[DEBUG]   FAILED: Decrease {decrease} not in range [{expected_lamports}, {expected_lamports + fee_tolerance}]")
                return False
            print(f"[DEBUG]   PASSED")

        return True
