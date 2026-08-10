"""FlatMate+ Backend - India's flatmate matching app.

Features: JWT + Emergent Google auth, onboarding, liveness, photos (object storage),
swipe/match algorithm, WebSocket chat.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Header, Query, Response, WebSocket, WebSocketDisconnect, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, jwt, bcrypt, requests, json
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
APP_NAME = os.environ.get('APP_NAME', 'flatmate-plus')
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")

app = FastAPI(title="FlatMate+ API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ---------------- Storage ----------------
storage_key: Optional[str] = None

def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type},
                        data=data, timeout=120)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": key, "Content-Type": content_type},
                            data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()

def get_object(path: str) -> tuple:
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# ---------------- Models ----------------
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class OnboardingData(BaseModel):
    age: int
    gender: str  # male, female, non_binary
    city: str  # bangalore, mumbai, delhi, etc.
    locality: str
    housing_status: str  # have_house, need_house_together, need_house_from_someone
    budget_min: int
    budget_max: int
    move_in_date: str
    flatmate_gender_pref: str  # male, female, any
    work_profile: str  # student, working_professional, freelancer, business
    company_or_college: Optional[str] = ""
    food_pref: str  # veg, non_veg, eggetarian, vegan
    cooks_at_home: str  # daily, sometimes, rarely, never
    cleanliness: int  # 1-5
    sleep_schedule: str  # early_bird, night_owl, flexible
    social_level: str  # introvert, ambivert, extrovert
    drinking: str  # yes, no, occasionally
    smoking: str  # yes, no, occasionally
    pets_ok: bool
    guests_freq: str  # often, sometimes, rarely
    music_ok: bool
    languages: List[str] = []
    interests: List[str] = []

class ProfileUpdate(BaseModel):
    bio: Optional[str] = ""
    prompts: List[Dict[str, str]] = []  # [{q, a}]
    photos: List[str] = []  # list of storage paths

class SwipeIn(BaseModel):
    target_user_id: str
    direction: str  # like or pass

class MessageIn(BaseModel):
    match_id: str
    text: str

# ---------------- Auth helpers ----------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_jwt(user_id: str) -> str:
    payload = {"user_id": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def get_current_user(request: Request, authorization: Optional[str] = Header(None)) -> dict:
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    if not token:
        token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # try JWT
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0})
        if user:
            return user
    except Exception:
        pass

    # try session (Emergent auth)
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid token")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def user_public(u: dict) -> dict:
    return {k: v for k, v in u.items() if k not in ("password_hash", "_id")}

# ---------------- Auth routes ----------------
@api_router.post("/auth/register")
async def register(data: UserRegister):
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    doc = {
        "user_id": user_id,
        "email": data.email,
        "name": data.name,
        "password_hash": hash_password(data.password),
        "onboarding_done": False,
        "liveness_verified": False,
        "profile_complete": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    token = create_jwt(user_id)
    return {"token": token, "user": user_public(doc)}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not user.get("password_hash") or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_jwt(user["user_id"])
    return {"token": token, "user": user_public(user)}

@api_router.post("/auth/session")
async def process_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    resp = requests.get(
        "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
        headers={"X-Session-ID": session_id}, timeout=30
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    data = resp.json()
    email = data["email"]

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": email,
            "name": data.get("name") or email.split("@")[0],
            "picture": data.get("picture"),
            "onboarding_done": False,
            "liveness_verified": False,
            "profile_complete": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(user)

    session_token = data["session_token"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    response.set_cookie("session_token", session_token, path="/", secure=True, samesite="none", httponly=True, max_age=7*24*3600)
    return {"user": user_public(user), "token": session_token}

@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user_public(user)

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}

# ---------------- Onboarding & profile ----------------
@api_router.put("/onboarding")
async def save_onboarding(data: OnboardingData, user: dict = Depends(get_current_user)):
    update = data.model_dump()
    update["onboarding_done"] = True
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": update})
    return {"ok": True}

@api_router.post("/liveness/verify")
async def verify_liveness(body: Dict[str, Any], user: dict = Depends(get_current_user)):
    # Client sends {steps_completed: N, selfie_base64: str}
    steps = int(body.get("steps_completed", 0))
    if steps < 3:
        raise HTTPException(status_code=400, detail="Liveness incomplete")
    # store selfie in object storage (from base64)
    selfie_path = None
    selfie_b64 = body.get("selfie_base64", "")
    if selfie_b64:
        import base64
        header, _, b64data = selfie_b64.partition(",")
        try:
            data_bytes = base64.b64decode(b64data or header)
        except Exception:
            data_bytes = b""
        if data_bytes:
            selfie_path = f"{APP_NAME}/uploads/{user['user_id']}/selfie_{uuid.uuid4().hex}.jpg"
            try:
                put_object(selfie_path, data_bytes, "image/jpeg")
            except Exception as e:
                logger.error(f"Selfie upload failed: {e}")
                selfie_path = None
    await db.users.update_one({"user_id": user["user_id"]},
                              {"$set": {"liveness_verified": True, "selfie_path": selfie_path}})
    return {"ok": True, "selfie_path": selfie_path}

@api_router.put("/profile")
async def update_profile(data: ProfileUpdate, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    upd["profile_complete"] = bool((data.photos or []) and (data.prompts or []))
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": upd})
    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return user_public(updated)

@api_router.post("/upload")
async def upload_photo(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "jpg"
    if ext not in ("jpg", "jpeg", "png", "webp"):
        raise HTTPException(status_code=400, detail="Unsupported image format")
    path = f"{APP_NAME}/uploads/{user['user_id']}/{uuid.uuid4().hex}.{ext}"
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 8MB)")
    content_type = file.content_type or f"image/{'jpeg' if ext in ('jpg','jpeg') else ext}"
    result = put_object(path, data, content_type)
    await db.files.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "storage_path": result["path"],
        "content_type": content_type,
        "size": result["size"],
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"path": result["path"]}

@api_router.get("/files/{path:path}")
async def serve_file(path: str):
    # public read for profile photos (paths contain uuid, hard to guess)
    record = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not record:
        # allow selfie (not in files collection)
        user = await db.users.find_one({"selfie_path": path}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="Not found")
    try:
        data, ct = get_object(path)
    except Exception:
        raise HTTPException(status_code=404, detail="Object missing")
    return Response(content=data, media_type=(record or {}).get("content_type", ct))

# ---------------- Matching ----------------
def compute_match_score(a: dict, b: dict) -> int:
    """Return a match score out of 100 between users a and b."""
    score = 0
    reasons = 0

    # City must match (hard filter is done in discover; here just award)
    if a.get("city") and a.get("city") == b.get("city"):
        score += 20
        reasons += 1

    # Housing complementary
    ah, bh = a.get("housing_status"), b.get("housing_status")
    if ah and bh:
        # complementary pairs
        good_pairs = {("have_house", "need_house_from_someone"),
                      ("need_house_from_someone", "have_house"),
                      ("need_house_together", "need_house_together")}
        if (ah, bh) in good_pairs:
            score += 20
        elif ah == bh and ah != "need_house_together":
            score += 5
        else:
            score += 2

    # Gender preference (mutual)
    def gender_ok(x, y):
        pref = x.get("flatmate_gender_pref", "any")
        return pref == "any" or pref == y.get("gender")
    if gender_ok(a, b) and gender_ok(b, a):
        score += 10

    # Budget overlap
    a_min, a_max = a.get("budget_min", 0), a.get("budget_max", 999999)
    b_min, b_max = b.get("budget_min", 0), b.get("budget_max", 999999)
    if a_max >= b_min and b_max >= a_min:
        score += 10

    # Food pref
    if a.get("food_pref") == b.get("food_pref"):
        score += 8
    elif {a.get("food_pref"), b.get("food_pref")} <= {"veg", "eggetarian"}:
        score += 5

    # Cleanliness closeness (1-5 scale)
    ca, cb = a.get("cleanliness"), b.get("cleanliness")
    if isinstance(ca, int) and isinstance(cb, int):
        score += max(0, 10 - abs(ca - cb) * 3)

    # Sleep schedule
    if a.get("sleep_schedule") == b.get("sleep_schedule") or "flexible" in (a.get("sleep_schedule"), b.get("sleep_schedule")):
        score += 6

    # Social level
    if a.get("social_level") == b.get("social_level"):
        score += 5

    # Habits
    for key in ("drinking", "smoking"):
        if a.get(key) == b.get(key):
            score += 3

    # Pets
    if a.get("pets_ok") == b.get("pets_ok"):
        score += 3

    # Interest overlap
    ai = set(a.get("interests") or [])
    bi = set(b.get("interests") or [])
    if ai and bi:
        overlap = len(ai & bi)
        score += min(6, overlap * 2)

    return min(100, score)

@api_router.get("/discover")
async def discover(user: dict = Depends(get_current_user)):
    if not user.get("onboarding_done"):
        raise HTTPException(status_code=400, detail="Complete onboarding first")

    # exclude self + already swiped
    swiped = await db.swipes.find({"user_id": user["user_id"]}, {"_id": 0, "target_user_id": 1}).to_list(1000)
    exclude_ids = {s["target_user_id"] for s in swiped}
    exclude_ids.add(user["user_id"])

    # city filter + onboarding_done
    q = {"user_id": {"$nin": list(exclude_ids)}, "onboarding_done": True}
    if user.get("city"):
        q["city"] = user["city"]
    candidates = await db.users.find(q, {"_id": 0, "password_hash": 0}).to_list(200)

    # gender preference filter (mutual)
    def gender_ok(x, y):
        pref = x.get("flatmate_gender_pref", "any")
        return pref == "any" or pref == y.get("gender")

    filtered = [c for c in candidates if gender_ok(user, c) and gender_ok(c, user)]
    scored = [{"user": c, "score": compute_match_score(user, c)} for c in filtered]
    scored.sort(key=lambda x: -x["score"])
    return scored[:50]

@api_router.post("/swipe")
async def swipe(data: SwipeIn, user: dict = Depends(get_current_user)):
    if data.direction not in ("like", "pass"):
        raise HTTPException(status_code=400, detail="Invalid direction")
    # store
    await db.swipes.update_one(
        {"user_id": user["user_id"], "target_user_id": data.target_user_id},
        {"$set": {"direction": data.direction, "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    if data.direction == "pass":
        return {"matched": False}
    # check mutual like
    reverse = await db.swipes.find_one({
        "user_id": data.target_user_id, "target_user_id": user["user_id"], "direction": "like"
    }, {"_id": 0})
    if not reverse:
        return {"matched": False}
    # create match
    match_id = f"match_{uuid.uuid4().hex[:12]}"
    other = await db.users.find_one({"user_id": data.target_user_id}, {"_id": 0, "password_hash": 0})
    score = compute_match_score(user, other or {})
    existing = await db.matches.find_one({
        "user_ids": {"$all": [user["user_id"], data.target_user_id]}
    }, {"_id": 0})
    if existing:
        return {"matched": True, "match": existing, "other": user_public(other or {})}
    doc = {
        "match_id": match_id,
        "user_ids": [user["user_id"], data.target_user_id],
        "score": score,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.matches.insert_one(doc)
    doc.pop("_id", None)
    return {"matched": True, "match": doc, "other": user_public(other or {})}

@api_router.get("/matches")
async def list_matches(user: dict = Depends(get_current_user)):
    ms = await db.matches.find({"user_ids": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    out = []
    for m in ms:
        other_id = [u for u in m["user_ids"] if u != user["user_id"]][0]
        other = await db.users.find_one({"user_id": other_id}, {"_id": 0, "password_hash": 0})
        last_msg = await db.messages.find_one({"match_id": m["match_id"]}, {"_id": 0}, sort=[("created_at", -1)])
        out.append({"match": m, "other": user_public(other or {}), "last_message": last_msg})
    return out

@api_router.get("/messages/{match_id}")
async def get_messages(match_id: str, user: dict = Depends(get_current_user)):
    match = await db.matches.find_one({"match_id": match_id, "user_ids": user["user_id"]}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    msgs = await db.messages.find({"match_id": match_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return msgs

@api_router.post("/messages")
async def send_message(data: MessageIn, user: dict = Depends(get_current_user)):
    match = await db.matches.find_one({"match_id": data.match_id, "user_ids": user["user_id"]}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    msg = {
        "message_id": f"msg_{uuid.uuid4().hex[:12]}",
        "match_id": data.match_id,
        "sender_id": user["user_id"],
        "text": data.text,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.messages.insert_one(msg)
    msg.pop("_id", None)
    # broadcast via ws
    other_id = [u for u in match["user_ids"] if u != user["user_id"]][0]
    await manager.push(other_id, {"type": "message", "message": msg})
    return msg

# ---------------- WebSocket chat ----------------
class ConnectionManager:
    def __init__(self):
        self.active: Dict[str, List[WebSocket]] = {}

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(user_id, []).append(ws)

    def disconnect(self, user_id: str, ws: WebSocket):
        if user_id in self.active:
            self.active[user_id] = [w for w in self.active[user_id] if w is not ws]

    async def push(self, user_id: str, data: dict):
        for ws in list(self.active.get(user_id, [])):
            try:
                await ws.send_json(data)
            except Exception:
                pass

manager = ConnectionManager()

@app.websocket("/api/ws/{user_id}")
async def ws_endpoint(ws: WebSocket, user_id: str, token: str = Query(...)):
    # verify token
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        if payload["user_id"] != user_id:
            await ws.close(code=1008)
            return
    except Exception:
        # try session
        session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
        if not session or session["user_id"] != user_id:
            await ws.close(code=1008)
            return
    await manager.connect(user_id, ws)
    try:
        while True:
            await ws.receive_text()  # keep-alive; sending is via HTTP endpoint
    except WebSocketDisconnect:
        manager.disconnect(user_id, ws)

# ---------------- Basic ----------------
@api_router.get("/")
async def root():
    return {"app": "FlatMate+", "status": "ok"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("email", unique=True)
    await db.swipes.create_index([("user_id", 1), ("target_user_id", 1)], unique=True)
    await db.matches.create_index("match_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
