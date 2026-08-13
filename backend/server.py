"""FlatMate+ Backend v2 — with face verification, geo radius, non-negotiables, and richer profile."""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Header, Query, Response, WebSocket, WebSocketDisconnect, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, jwt, bcrypt, requests, math
from pathlib import Path
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
APP_NAME = os.environ.get('APP_NAME', 'flatmate-plus')

app = FastAPI(title="FlatMate+ API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------- Storage (local disk) ----------------
# NOTE: on most free hosts (e.g. Render free tier) this directory is wiped on
# every redeploy/restart. Fine for early testing; move to S3/Cloudinary
# before you have real users depending on uploaded photos sticking around.
STORAGE_DIR = Path(os.environ.get("STORAGE_DIR", ROOT_DIR / "storage"))
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

def _safe_storage_path(path: str) -> Path:
    full = (STORAGE_DIR / path).resolve()
    if not str(full).startswith(str(STORAGE_DIR.resolve())):
        raise ValueError("invalid storage path")
    return full

def put_object(path: str, data: bytes, content_type: str) -> dict:
    full = _safe_storage_path(path)
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_bytes(data)
    (full.parent / (full.name + ".meta")).write_text(content_type)
    return {"path": path, "size": len(data)}

def get_object(path: str) -> tuple:
    full = _safe_storage_path(path)
    if not full.exists():
        raise FileNotFoundError(path)
    data = full.read_bytes()
    meta_file = full.parent / (full.name + ".meta")
    content_type = meta_file.read_text() if meta_file.exists() else "application/octet-stream"
    return data, content_type

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
    gender: str
    city: str
    locality: str
    home_lat: Optional[float] = None
    home_lng: Optional[float] = None
    radius_km: int = 5
    office_locality: Optional[str] = ""
    office_lat: Optional[float] = None
    office_lng: Optional[float] = None
    housing_status: str
    budget_min: int
    budget_max: int
    move_in_date: str
    flatmate_gender_pref: str
    work_profile: str
    company_or_college: Optional[str] = ""
    work_schedule: str = "hybrid"  # wfh, wfo, hybrid
    food_pref: str
    cooks_at_home: str
    cleanliness: int
    sleep_schedule: str
    social_level: str
    drinking: str
    smoking: str
    pets_ok: bool
    guests_freq: str
    male_guests_ok: bool = True
    family_visits_ok: bool = True
    hosts_parties: str = "sometimes"  # rarely, sometimes, often
    music_ok: bool
    languages: List[str] = []
    interests: List[str] = []
    # Flat-owner only
    flat_preferences: List[str] = []

class NonNegotiablesIn(BaseModel):
    non_negotiables: List[str] = []  # keys: food_pref, smoking, drinking, cleanliness, pets_ok, male_guests_ok, family_visits_ok, hosts_parties, sleep_schedule, budget, radius

class ProfileUpdate(BaseModel):
    bio: Optional[str] = None
    prompts: Optional[List[Dict[str, str]]] = None
    photos: Optional[List[str]] = None       # user photos
    flat_photos: Optional[List[str]] = None  # only relevant for have_house
    main_photo_verified: Optional[bool] = None
    face_descriptor_main: Optional[List[float]] = None  # descriptor of main photo

class EditProfileIn(BaseModel):
    # All editable fields except name
    age: Optional[int] = None
    gender: Optional[str] = None
    city: Optional[str] = None
    locality: Optional[str] = None
    home_lat: Optional[float] = None
    home_lng: Optional[float] = None
    radius_km: Optional[int] = None
    office_locality: Optional[str] = None
    office_lat: Optional[float] = None
    office_lng: Optional[float] = None
    housing_status: Optional[str] = None
    budget_min: Optional[int] = None
    budget_max: Optional[int] = None
    move_in_date: Optional[str] = None
    flatmate_gender_pref: Optional[str] = None
    work_profile: Optional[str] = None
    company_or_college: Optional[str] = None
    work_schedule: Optional[str] = None
    food_pref: Optional[str] = None
    cooks_at_home: Optional[str] = None
    cleanliness: Optional[int] = None
    sleep_schedule: Optional[str] = None
    social_level: Optional[str] = None
    drinking: Optional[str] = None
    smoking: Optional[str] = None
    pets_ok: Optional[bool] = None
    guests_freq: Optional[str] = None
    male_guests_ok: Optional[bool] = None
    family_visits_ok: Optional[bool] = None
    hosts_parties: Optional[str] = None
    music_ok: Optional[bool] = None
    languages: Optional[List[str]] = None
    interests: Optional[List[str]] = None
    flat_preferences: Optional[List[str]] = None
    bio: Optional[str] = None
    prompts: Optional[List[Dict[str, str]]] = None

class SwipeIn(BaseModel):
    target_user_id: str
    direction: str

class ResetPassedIn(BaseModel):
    reset: bool = True

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
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0})
        if user:
            return user
    except Exception:
        pass
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
    return {k: v for k, v in u.items() if k not in ("password_hash", "_id", "face_descriptor_selfie")}

# ---------------- Auth routes ----------------
@api_router.post("/auth/register")
async def register(data: UserRegister):
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    doc = {
        "user_id": user_id, "email": data.email, "name": data.name,
        "password_hash": hash_password(data.password),
        "onboarding_done": False, "liveness_verified": False, "profile_complete": False,
        "main_photo_verified": False,
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
    resp = requests.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                        headers={"X-Session-ID": session_id}, timeout=30)
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    data = resp.json()
    email = data["email"]
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {"user_id": user_id, "email": email, "name": data.get("name") or email.split("@")[0],
                "picture": data.get("picture"), "onboarding_done": False, "liveness_verified": False,
                "profile_complete": False, "main_photo_verified": False,
                "created_at": datetime.now(timezone.utc).isoformat()}
        await db.users.insert_one(user)
    session_token = data["session_token"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({"user_id": user["user_id"], "session_token": session_token,
                                       "expires_at": expires_at.isoformat(),
                                       "created_at": datetime.now(timezone.utc).isoformat()})
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

# ---------------- Onboarding / Liveness / Non-negotiables ----------------
@api_router.put("/onboarding")
async def save_onboarding(data: OnboardingData, user: dict = Depends(get_current_user)):
    update = data.model_dump()
    update["onboarding_done"] = True
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": update})
    return {"ok": True}

@api_router.post("/liveness/verify")
async def verify_liveness(body: Dict[str, Any], user: dict = Depends(get_current_user)):
    steps = int(body.get("steps_completed", 0))
    if steps < 3:
        raise HTTPException(status_code=400, detail="Liveness incomplete")
    face_desc = body.get("face_descriptor")  # list of 128 floats
    if not face_desc or not isinstance(face_desc, list) or len(face_desc) < 64:
        raise HTTPException(status_code=400, detail="No face detected in selfie — please retry")
    selfie_path = None
    selfie_b64 = body.get("selfie_base64", "")
    if selfie_b64:
        import base64
        _, _, b64data = selfie_b64.partition(",")
        try:
            data_bytes = base64.b64decode(b64data or selfie_b64)
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
                              {"$set": {"liveness_verified": True, "selfie_path": selfie_path,
                                        "face_descriptor_selfie": face_desc}})
    return {"ok": True, "selfie_path": selfie_path}

@api_router.put("/non-negotiables")
async def save_non_negotiables(data: NonNegotiablesIn, user: dict = Depends(get_current_user)):
    await db.users.update_one({"user_id": user["user_id"]},
                              {"$set": {"non_negotiables": data.non_negotiables}})
    return {"ok": True}

# ---------------- Profile / Uploads ----------------
def _cosine_sim(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x*y for x, y in zip(a, b))
    na = math.sqrt(sum(x*x for x in a)); nb = math.sqrt(sum(y*y for y in b))
    return dot / (na*nb) if na and nb else 0.0

def _euclidean(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 999.0
    return math.sqrt(sum((x-y)**2 for x, y in zip(a, b)))

@api_router.put("/profile")
async def update_profile(data: ProfileUpdate, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    photos = upd.get("photos", user.get("photos", []) or [])
    flat_photos = upd.get("flat_photos", user.get("flat_photos", []) or [])
    housing = user.get("housing_status")

    # Face verification of MAIN photo against liveness selfie
    prev_main = (user.get("photos") or [None])[0]
    new_main = (photos or [None])[0]
    face_desc_main = upd.pop("face_descriptor_main", None)

    if new_main and new_main != prev_main:
        selfie_desc = user.get("face_descriptor_selfie")
        if not selfie_desc:
            raise HTTPException(status_code=400, detail="Please complete the liveness check first")
        if not face_desc_main or not isinstance(face_desc_main, list) or len(face_desc_main) < 64:
            raise HTTPException(status_code=400, detail="Your main photo must show a clear single human face")
        dist = _euclidean(selfie_desc, face_desc_main)
        # face-api recommends threshold ~0.6 for match
        if dist > 0.6:
            upd["main_photo_verified"] = False
            raise HTTPException(status_code=400,
                                detail=f"Main photo does not match your live selfie (distance {dist:.2f}). Please upload a photo of yourself.")
        upd["main_photo_verified"] = True
        upd["face_descriptor_main"] = face_desc_main
    elif not new_main:
        upd["main_photo_verified"] = False

    # Housing gate: if user has_house, require flat_photos
    if housing == "have_house":
        if len(flat_photos) < 1:
            raise HTTPException(status_code=400, detail="Please add at least 1 flat photo")

    has_photos = bool(photos)
    has_prompts = bool(upd.get("prompts") or user.get("prompts"))
    housing_ok = housing != "have_house" or bool(flat_photos)
    upd["profile_complete"] = has_photos and has_prompts and housing_ok

    await db.users.update_one({"user_id": user["user_id"]}, {"$set": upd})
    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return user_public(updated)

@api_router.patch("/profile/edit")
async def edit_profile(data: EditProfileIn, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    if not upd:
        return user_public(user)
    # Housing gate: if switching to have_house, ensure flat photos exist
    new_housing = upd.get("housing_status", user.get("housing_status"))
    if new_housing == "have_house":
        flat_photos = user.get("flat_photos") or []
        if len(flat_photos) < 1:
            raise HTTPException(status_code=400,
                                detail="Please add at least 1 flat photo from 'Manage photos' before switching to 'I have a house'")
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
        "id": str(uuid.uuid4()), "user_id": user["user_id"],
        "storage_path": result["path"], "content_type": content_type,
        "size": result["size"], "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"path": result["path"]}

@api_router.get("/files/{path:path}")
async def serve_file(path: str):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not record:
        selfie_user = await db.users.find_one({"selfie_path": path}, {"_id": 0})
        if not selfie_user:
            raise HTTPException(status_code=404, detail="Not found")
    try:
        data, ct = get_object(path)
    except Exception:
        raise HTTPException(status_code=404, detail="Object missing")
    media_type = (record or {}).get("content_type") or ct or "application/octet-stream"
    return Response(content=data, media_type=media_type)

# ---------------- Nominatim proxy (avoid CORS + rate-limit headers) ----------------
@api_router.get("/geo/search")
async def geo_search(q: str = Query(..., min_length=3)):
    """Photon (Komoot) geocoder — real prefix autocomplete tuned for India."""
    seen = set()
    out = []
    try:
        resp = requests.get(
            "https://photon.komoot.io/api/",
            params={"q": q, "limit": 20, "lang": "en", "lat": 20.5937, "lon": 78.9629},
            headers={"User-Agent": "FlatMatePlus/1.0"}, timeout=8,
        )
        if resp.status_code != 200:
            return []
        features = resp.json().get("features", [])
    except Exception as e:
        logger.warning(f"Photon failed: {e}")
        return []

    for f in features:
        props = f.get("properties", {})
        if (props.get("country") or "").lower() not in ("india", "in"):
            continue
        coords = f.get("geometry", {}).get("coordinates") or []
        if len(coords) < 2:
            continue
        lng, lat = float(coords[0]), float(coords[1])
        primary = props.get("name") or ""
        if not primary:
            continue
        city = (props.get("city") or props.get("county") or props.get("district")
                or props.get("state") or "")
        state = props.get("state") or ""
        # Build a friendly display line
        display = ", ".join([x for x in (primary, city, state, "India") if x])
        key = (round(lat, 4), round(lng, 4), primary.lower())
        if key in seen:
            continue
        seen.add(key)
        out.append({"display_name": display, "primary": primary, "city": city, "lat": lat, "lng": lng})
    return out[:15]

# ---------------- Matching ----------------
def haversine_km(lat1, lng1, lat2, lng2):
    if None in (lat1, lng1, lat2, lng2):
        return None
    R = 6371.0
    from math import radians, sin, cos, asin, sqrt
    dlat = radians(lat2-lat1); dlng = radians(lng2-lng1)
    a = sin(dlat/2)**2 + cos(radians(lat1))*cos(radians(lat2))*sin(dlng/2)**2
    return 2*R*asin(sqrt(a))

MATCH_HIGHLIGHT_LABELS = {
    "same_locality": "Same neighbourhood",
    "close_by": "Nearby",
    "housing_complementary": "Housing needs match",
    "budget_overlap": "Budget aligns",
    "food_same": "Same food vibe",
    "clean_same": "Similar cleanliness",
    "sleep_same": "Same sleep schedule",
    "social_same": "Same social energy",
    "smoking_same": "Smoking match",
    "drinking_same": "Drinking match",
    "pets_same": "Both pet-friendly" ,
    "guests_align": "Guest habits align",
    "work_schedule_same": "Same work schedule",
    "interests_shared": "Shared interests",
    "languages_shared": "Same language",
}

def compute_match(a: dict, b: dict) -> Dict[str, Any]:
    """Returns dict with score(0-100), highlights list, distance_km, hard_fail:bool, hard_reasons:list."""
    highlights = []
    score = 0
    non_neg = set(a.get("non_negotiables") or [])

    def add(cond, key, points, mult_if_nn=2.0):
        nonlocal score
        if cond:
            pts = int(points * (mult_if_nn if key in non_neg else 1))
            score += pts
            highlights.append(key)

    # distance
    dist = haversine_km(a.get("home_lat"), a.get("home_lng"), b.get("home_lat"), b.get("home_lng"))

    same_city = a.get("city") and a.get("city") == b.get("city")
    same_locality = a.get("locality") and a.get("locality").strip().lower() == (b.get("locality") or "").strip().lower()

    add(same_locality, "same_locality", 15)
    if dist is not None and dist <= max(a.get("radius_km", 5), b.get("radius_km", 5)):
        if not same_locality:
            add(True, "close_by", 10)

    # housing complementary
    ah, bh = a.get("housing_status"), b.get("housing_status")
    good_pairs = {("have_house", "need_house_from_someone"), ("need_house_from_someone", "have_house"),
                  ("need_house_together", "need_house_together")}
    add((ah, bh) in good_pairs, "housing_complementary", 15)

    # budget overlap
    a_min, a_max = a.get("budget_min", 0), a.get("budget_max", 999999)
    b_min, b_max = b.get("budget_min", 0), b.get("budget_max", 999999)
    add(a_max >= b_min and b_max >= a_min, "budget_overlap", 10)

    add(a.get("food_pref") == b.get("food_pref") and a.get("food_pref"), "food_same", 8)
    ca, cb = a.get("cleanliness"), b.get("cleanliness")
    add(isinstance(ca, int) and isinstance(cb, int) and abs(ca-cb) <= 1, "clean_same", 8)
    add(a.get("sleep_schedule") == b.get("sleep_schedule") and a.get("sleep_schedule"), "sleep_same", 6)
    add(a.get("social_level") == b.get("social_level") and a.get("social_level"), "social_same", 5)
    add(a.get("smoking") == b.get("smoking") and a.get("smoking"), "smoking_same", 4)
    add(a.get("drinking") == b.get("drinking") and a.get("drinking"), "drinking_same", 4)
    add(a.get("pets_ok") == b.get("pets_ok"), "pets_same", 3)
    add(a.get("guests_freq") == b.get("guests_freq") and a.get("guests_freq"), "guests_align", 3)
    add(a.get("work_schedule") == b.get("work_schedule") and a.get("work_schedule"), "work_schedule_same", 4)

    ai = set(a.get("interests") or []); bi = set(b.get("interests") or [])
    overlap = len(ai & bi)
    add(overlap >= 2, "interests_shared", min(6, overlap*2))
    la = set(a.get("languages") or []); lb = set(b.get("languages") or [])
    add(bool(la & lb), "languages_shared", 3)

    score = min(100, score)

    return {"score": score, "highlights": highlights, "distance_km": dist}

def gender_ok(x, y):
    pref = x.get("flatmate_gender_pref", "any")
    return pref == "any" or pref == y.get("gender")

def passes_hard_filters(a: dict, b: dict, filters: Dict[str, Any]) -> bool:
    """User-side live filters passed via query params override defaults."""
    non_neg = set(a.get("non_negotiables") or [])
    # Enforce non-negotiables strictly
    if "food_pref" in non_neg and a.get("food_pref") != b.get("food_pref"):
        return False
    if "smoking" in non_neg and a.get("smoking") != b.get("smoking"):
        return False
    if "drinking" in non_neg and a.get("drinking") != b.get("drinking"):
        return False
    if "pets_ok" in non_neg and a.get("pets_ok") != b.get("pets_ok"):
        return False
    if "male_guests_ok" in non_neg and a.get("male_guests_ok") != b.get("male_guests_ok"):
        return False
    if "family_visits_ok" in non_neg and a.get("family_visits_ok") != b.get("family_visits_ok"):
        return False
    if "cleanliness" in non_neg:
        try:
            if abs(int(a.get("cleanliness") or 3) - int(b.get("cleanliness") or 3)) > 1:
                return False
        except Exception: pass
    # Live filters
    if filters.get("food") and b.get("food_pref") not in filters["food"]:
        return False
    if filters.get("smoking") and b.get("smoking") not in filters["smoking"]:
        return False
    if filters.get("drinking") and b.get("drinking") not in filters["drinking"]:
        return False
    if filters.get("housing") and b.get("housing_status") not in filters["housing"]:
        return False
    if filters.get("budget_max") is not None and (b.get("budget_min") or 0) > filters["budget_max"]:
        return False
    if filters.get("budget_min") is not None and (b.get("budget_max") or 999999) < filters["budget_min"]:
        return False
    return True

@api_router.get("/discover")
async def discover(
    user: dict = Depends(get_current_user),
    radius_km: Optional[int] = None,
    food: Optional[str] = None,  # comma list
    smoking: Optional[str] = None,
    drinking: Optional[str] = None,
    housing: Optional[str] = None,
    budget_min: Optional[int] = None,
    budget_max: Optional[int] = None,
):
    if not user.get("onboarding_done"):
        raise HTTPException(status_code=400, detail="Complete onboarding first")

    swiped = await db.swipes.find({"user_id": user["user_id"]}, {"_id": 0, "target_user_id": 1}).to_list(5000)
    exclude_ids = {s["target_user_id"] for s in swiped}
    exclude_ids.add(user["user_id"])

    q = {"user_id": {"$nin": list(exclude_ids)}, "onboarding_done": True, "profile_complete": True}
    if user.get("city"):
        q["city"] = user["city"]
    candidates = await db.users.find(q, {"_id": 0, "password_hash": 0, "face_descriptor_selfie": 0}).to_list(500)

    filters = {
        "food": [x for x in (food or "").split(",") if x] or None,
        "smoking": [x for x in (smoking or "").split(",") if x] or None,
        "drinking": [x for x in (drinking or "").split(",") if x] or None,
        "housing": [x for x in (housing or "").split(",") if x] or None,
        "budget_min": budget_min, "budget_max": budget_max,
    }
    r_km = radius_km if radius_km is not None else user.get("radius_km", 5)

    # score all valid candidates
    scored = []
    for c in candidates:
        if not gender_ok(user, c) or not gender_ok(c, user):
            continue
        if not passes_hard_filters(user, c, filters):
            continue
        m = compute_match(user, c)
        scored.append({"user": c, "score": m["score"], "highlights": m["highlights"], "distance_km": m["distance_km"]})

    # Same-locality bucket first
    same_locality = (user.get("locality") or "").strip().lower()
    within_radius, outside_radius = [], []
    same_loc_bucket = []
    for s in scored:
        loc = (s["user"].get("locality") or "").strip().lower()
        d = s["distance_km"]
        if same_locality and loc == same_locality:
            same_loc_bucket.append(s)
        elif d is not None and d <= r_km:
            within_radius.append(s)
        else:
            outside_radius.append(s)

    same_loc_bucket.sort(key=lambda x: -x["score"])
    within_radius.sort(key=lambda x: (x["distance_km"] if x["distance_km"] is not None else 9999, -x["score"]))
    outside_radius.sort(key=lambda x: (x["distance_km"] if x["distance_km"] is not None else 9999, -x["score"]))

    primary = same_loc_bucket + within_radius
    nearby = outside_radius[:20]
    fallback_message = None
    if not primary and nearby:
        nearest = nearby[0]
        d = nearest.get("distance_km")
        loc = nearest["user"].get("locality") or nearest["user"].get("city")
        fallback_message = f"No one in {user.get('locality') or 'your area'} yet — showing folks from {loc}" + (f" ({d:.1f}km away)" if d else "")

    return {
        "primary": primary[:50],
        "nearby": nearby if primary else nearby[:50],
        "fallback_message": fallback_message,
    }

@api_router.post("/swipe")
async def swipe(data: SwipeIn, user: dict = Depends(get_current_user)):
    if data.direction not in ("like", "pass"):
        raise HTTPException(status_code=400, detail="Invalid direction")
    await db.swipes.update_one(
        {"user_id": user["user_id"], "target_user_id": data.target_user_id},
        {"$set": {"direction": data.direction, "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    if data.direction == "pass":
        return {"matched": False}
    reverse = await db.swipes.find_one(
        {"user_id": data.target_user_id, "target_user_id": user["user_id"], "direction": "like"}, {"_id": 0}
    )
    if not reverse:
        return {"matched": False}
    other = await db.users.find_one({"user_id": data.target_user_id}, {"_id": 0, "password_hash": 0})
    m = compute_match(user, other or {})
    existing = await db.matches.find_one({"user_ids": {"$all": [user["user_id"], data.target_user_id]}}, {"_id": 0})
    if existing:
        return {"matched": True, "match": existing, "other": user_public(other or {}),
                "highlights": m["highlights"]}
    match_id = f"match_{uuid.uuid4().hex[:12]}"
    doc = {"match_id": match_id, "user_ids": [user["user_id"], data.target_user_id],
           "score": m["score"], "highlights": m["highlights"],
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.matches.insert_one(doc)
    doc.pop("_id", None)
    return {"matched": True, "match": doc, "other": user_public(other or {}), "highlights": m["highlights"]}

@api_router.post("/swipes/reset-passed")
async def reset_passed(user: dict = Depends(get_current_user)):
    """Clear all 'pass' swipes so user can review rejected profiles again."""
    result = await db.swipes.delete_many({"user_id": user["user_id"], "direction": "pass"})
    return {"reset": result.deleted_count}

@api_router.get("/matches")
async def list_matches(user: dict = Depends(get_current_user)):
    ms = await db.matches.find({"user_ids": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    out = []
    for m in ms:
        other_id = [u for u in m["user_ids"] if u != user["user_id"]][0]
        other = await db.users.find_one({"user_id": other_id}, {"_id": 0, "password_hash": 0, "face_descriptor_selfie": 0})
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
    msg = {"message_id": f"msg_{uuid.uuid4().hex[:12]}", "match_id": data.match_id,
           "sender_id": user["user_id"], "text": data.text,
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.messages.insert_one(msg)
    msg.pop("_id", None)
    other_id = [u for u in match["user_ids"] if u != user["user_id"]][0]
    await manager.push(other_id, {"type": "message", "message": msg})
    return msg

# ---------------- WebSocket ----------------
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
            try: await ws.send_json(data)
            except Exception: pass

manager = ConnectionManager()

@app.websocket("/api/ws/{user_id}")
async def ws_endpoint(ws: WebSocket, user_id: str, token: str = Query(...)):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        if payload["user_id"] != user_id:
            await ws.close(code=1008); return
    except Exception:
        session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
        if not session or session["user_id"] != user_id:
            await ws.close(code=1008); return
    await manager.connect(user_id, ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id, ws)

@api_router.get("/")
async def root():
    return {"app": "FlatMate+", "status": "ok"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware, allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"], allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("email", unique=True)
    await db.swipes.create_index([("user_id", 1), ("target_user_id", 1)], unique=True)
    await db.matches.create_index("match_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
