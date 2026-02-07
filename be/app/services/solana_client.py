from solana.rpc.async_api import AsyncClient


async def get_current_slot(rpc_url: str) -> int:
    async with AsyncClient(rpc_url) as client:
        response = await client.get_slot()

    slot = getattr(response, "value", None)
    if slot is None:
        raise RuntimeError("Could not read slot from Solana RPC response")
    return int(slot)
