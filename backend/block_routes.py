from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

class BlockIn(BaseModel):
    user_id: str

def register_block_routes(api_router, db, get_current_user, compute_match, user_public):
    @api_router.post("/blocks/{target_user_id}")
    async def block_user(target_user_id: str, user: dict = Depends(get_current_user)):
        uid = user["user_id"]
        if target_user_id == uid:
            raise HTTPException(status_code=400, detail="You cannot block yourself")
        target = await db.users.find_one({"user_id": target_user_id}, {"_id": 0, "user_id": 1})
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        now = datetime.now(timezone.utc).isoformat()
        await db.blocks.update_one(
            {"blocker_id": uid, "blocked_id": target_user_id},
            {"$set": {"blocker_id": uid, "blocked_id": target_user_id, "created_at": now}},
            upsert=True,
        )
        # A blocked relationship is also a permanent server-side exclusion from discovery.
        # Use a distinct swipe direction so the existing "review passed" reset never removes it.
        await db.swipes.update_one(
            {"user_id": uid, "target_user_id": target_user_id},
            {"$set": {"direction": "blocked", "created_at": now}},
            upsert=True,
        )
        await db.swipes.update_one(
            {"user_id": target_user_id, "target_user_id": uid},
            {"$set": {"direction": "blocked", "created_at": now}},
            upsert=True,
        )
        match = await db.matches.find_one({"user_ids": {"$all": [uid, target_user_id]}} , {"_id": 0, "match_id": 1})
        if match:
            await db.messages.delete_many({"match_id": match["match_id"]})
            await db.matches.delete_one({"match_id": match["match_id"]})
        return {"ok": True, "blocked_user_id": target_user_id}

    @api_router.get("/blocks")
    async def list_blocks(user: dict = Depends(get_current_user)):
        rows = await db.blocks.find({"blocker_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
        return rows

    @api_router.delete("/blocks/{target_user_id}")
    async def unblock_user(target_user_id: str, user: dict = Depends(get_current_user)):
        # Unblocking is deliberately explicit. It does not recreate a match or undo previous passes.
        result = await db.blocks.delete_one({"blocker_id": user["user_id"], "blocked_id": target_user_id})
        if not result.deleted_count:
            raise HTTPException(status_code=404, detail="Block not found")
        return {"ok": True}
