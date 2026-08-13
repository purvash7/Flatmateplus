"""FlatMate+ Backend v2 — with face verification, geo radius, non-negotiables, and richer profile."""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Header, Query, Response, WebSocket, WebSocketDisconnect, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, jwt, bcrypt, requests, math, shutil, asyncio, sys
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

@app.on_event("startup")
async def seed_dummy_profiles_on_startup():
    if os.environ.get("SEED_DUMMY_PROFILES", "false").lower() != "true":
        return
    try:
        logger.info("SEED_DUMMY_PROFILES=true; seeding demo profiles")
        proc = await asyncio.create_subprocess_exec(
            sys.executable, str(ROOT_DIR / "seed_dummy_profiles.py"),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        output, _ = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(output.decode(errors="replace"))
        logger.info(output.decode(errors="replace").strip())
    except Exception as exc:
        logger.exception("Dummy profile seeding failed: %s", exc)
        raise

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
    work_schedule: Optional[str] = ""
    food_pref: str
    cooks_at_home: Optional[str] = ""
    cleanliness: int
    sleep_schedule: str
    social_level: str
    drinking: str
    smoking: str
    pets_ok: bool
    guests_freq: str
    male_guests_ok: bool
    family_visits_ok: bool
    hosts_parties: str
    music_ok: bool
    languages: List[str] = []
    interests: List[str] = []
    flat_preferences: List[str] = []
    non_negotiables: List[str] = []

# The remainder of the existing backend follows unchanged.
