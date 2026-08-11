"""FlatMate+ v3 backend tests: geo/search, non-negotiables, profile face-verify,
profile/edit, discover buckets & filters."""
import os, uuid, random
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')


def _hdr(tok): return {"Authorization": f"Bearer {tok}"}


def _register(suffix="u"):
    email = f"TEST_v3_{suffix}_{uuid.uuid4().hex[:8]}@test.com"
    r = requests.post(f"{API}/auth/register",
                      json={"email": email, "password": "password123", "name": f"T {suffix}"})
    assert r.status_code == 200, r.text
    return r.json()


def _onboard(tok, **overrides):
    payload = {
        "age": 26, "gender": "female", "city": "bangalore", "locality": "indiranagar",
        "home_lat": 12.9784, "home_lng": 77.6408, "radius_km": 5,
        "office_locality": "koramangala", "office_lat": 12.9352, "office_lng": 77.6245,
        "housing_status": "need_house_from_someone",
        "budget_min": 12000, "budget_max": 25000, "move_in_date": "2026-02-01",
        "flatmate_gender_pref": "any", "work_profile": "working_professional",
        "company_or_college": "Acme", "work_schedule": "hybrid",
        "food_pref": "veg", "cooks_at_home": "sometimes", "cleanliness": 4,
        "sleep_schedule": "flexible", "social_level": "ambivert",
        "drinking": "no", "smoking": "no", "pets_ok": True, "guests_freq": "sometimes",
        "male_guests_ok": True, "family_visits_ok": True, "hosts_parties": "sometimes",
        "music_ok": True, "languages": ["english"], "interests": ["reading"],
        "flat_preferences": [],
    }
    payload.update(overrides)
    r = requests.put(f"{API}/onboarding", json=payload, headers=_hdr(tok))
    assert r.status_code == 200, r.text


# --- geo/search ---
class TestGeoSearch:
    def test_short_query_rejected(self):
        r = requests.get(f"{API}/geo/search", params={"q": "in"})
        assert r.status_code == 422  # min_length=3

    def test_returns_list_shape(self):
        r = requests.get(f"{API}/geo/search", params={"q": "indira"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        # Nominatim may occasionally fail — accept empty; if any results, validate shape
        if data:
            item = data[0]
            for k in ("primary", "city", "lat", "lng", "display_name"):
                assert k in item, f"missing {k} in {item}"
            assert isinstance(item["lat"], float)
            assert isinstance(item["lng"], float)


# --- non-negotiables ---
class TestNonNegotiables:
    def test_save_and_reflect_via_me(self):
        u = _register("nn")
        r = requests.put(f"{API}/non-negotiables",
                         json={"non_negotiables": ["food_pref", "smoking"]},
                         headers=_hdr(u["token"]))
        assert r.status_code == 200, r.text
        me = requests.get(f"{API}/auth/me", headers=_hdr(u["token"])).json()
        assert me.get("non_negotiables") == ["food_pref", "smoking"]

    def test_requires_auth(self):
        r = requests.put(f"{API}/non-negotiables", json={"non_negotiables": []})
        assert r.status_code == 401


# --- liveness/verify ---
class TestLiveness:
    def test_rejects_missing_descriptor(self):
        u = _register("lv1")
        r = requests.post(f"{API}/liveness/verify",
                          json={"steps_completed": 4},
                          headers=_hdr(u["token"]))
        assert r.status_code == 400
        assert "face" in r.json().get("detail", "").lower()

    def test_rejects_short_descriptor(self):
        u = _register("lv2")
        r = requests.post(f"{API}/liveness/verify",
                          json={"steps_completed": 4, "face_descriptor": [0.1, 0.2]},
                          headers=_hdr(u["token"]))
        assert r.status_code == 400

    def test_accepts_valid_descriptor_and_hides_it_from_me(self):
        u = _register("lv3")
        desc = [random.random() for _ in range(128)]
        r = requests.post(f"{API}/liveness/verify",
                          json={"steps_completed": 4, "face_descriptor": desc},
                          headers=_hdr(u["token"]))
        assert r.status_code == 200, r.text
        me = requests.get(f"{API}/auth/me", headers=_hdr(u["token"])).json()
        assert me.get("liveness_verified") is True
        assert "face_descriptor_selfie" not in me, "selfie descriptor must NOT leak via /auth/me"


# --- profile face verify + housing gate ---
class TestProfileFaceVerify:
    def _prime(self, suffix, housing="need_house_from_someone"):
        u = _register(suffix)
        _onboard(u["token"], housing_status=housing)
        desc = [random.random() for _ in range(128)]
        r = requests.post(f"{API}/liveness/verify",
                          json={"steps_completed": 4, "face_descriptor": desc},
                          headers=_hdr(u["token"]))
        assert r.status_code == 200
        return u, desc

    def test_main_photo_no_descriptor_rejected(self):
        u, desc = self._prime("pf1")
        r = requests.put(f"{API}/profile",
                         json={"photos": ["fake/path/main.jpg"], "prompts": [{"q": "x", "a": "y"}]},
                         headers=_hdr(u["token"]))
        assert r.status_code == 400
        assert "face" in r.json()["detail"].lower()

    def test_main_photo_mismatch_rejected(self):
        u, desc = self._prime("pf2")
        wrong = [random.random() for _ in range(128)]
        # very unlikely to match (random vectors are ~sqrt(N/6) apart >>0.6)
        r = requests.put(f"{API}/profile",
                         json={"photos": ["fake/main.jpg"], "prompts": [{"q":"x","a":"y"}],
                               "face_descriptor_main": wrong},
                         headers=_hdr(u["token"]))
        assert r.status_code == 400
        assert "match" in r.json()["detail"].lower()

    def test_main_photo_match_success_sets_verified(self):
        u, desc = self._prime("pf3")
        r = requests.put(f"{API}/profile",
                         json={"photos": ["fake/main.jpg"], "prompts": [{"q":"x","a":"y"}],
                               "face_descriptor_main": desc},  # identical -> distance 0
                         headers=_hdr(u["token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("main_photo_verified") is True
        # descriptor stored server-side but should not leak in /auth/me
        me = requests.get(f"{API}/auth/me", headers=_hdr(u["token"])).json()
        assert "face_descriptor_selfie" not in me

    def test_have_house_requires_flat_photos(self):
        u, desc = self._prime("pf4", housing="have_house")
        r = requests.put(f"{API}/profile",
                         json={"photos": ["fake/main.jpg"], "prompts": [{"q":"x","a":"y"}],
                               "face_descriptor_main": desc, "flat_photos": []},
                         headers=_hdr(u["token"]))
        assert r.status_code == 400
        assert "flat" in r.json()["detail"].lower()

    def test_have_house_with_flat_photos_ok(self):
        u, desc = self._prime("pf5", housing="have_house")
        r = requests.put(f"{API}/profile",
                         json={"photos": ["fake/main.jpg"], "prompts": [{"q":"x","a":"y"}],
                               "face_descriptor_main": desc,
                               "flat_photos": ["fake/flat1.jpg"]},
                         headers=_hdr(u["token"]))
        assert r.status_code == 200, r.text


# --- profile/edit ---
class TestProfileEdit:
    def test_patch_updates_arbitrary_fields(self):
        u = _register("ed1")
        _onboard(u["token"])
        r = requests.patch(f"{API}/profile/edit",
                           json={"age": 30, "bio": "hello v3", "radius_km": 10,
                                 "work_schedule": "wfh", "interests": ["yoga","coffee"]},
                           headers=_hdr(u["token"]))
        assert r.status_code == 200, r.text
        me = requests.get(f"{API}/auth/me", headers=_hdr(u["token"])).json()
        assert me["age"] == 30
        assert me["bio"] == "hello v3"
        assert me["radius_km"] == 10
        assert me["work_schedule"] == "wfh"
        assert me["interests"] == ["yoga","coffee"]

    def test_patch_ignores_name(self):
        u = _register("ed2")
        original_name = u["user"]["name"]
        # EditProfileIn has no name field, so extra should be dropped by pydantic
        r = requests.patch(f"{API}/profile/edit",
                           json={"name": "HACKED", "bio": "ok"},
                           headers=_hdr(u["token"]))
        assert r.status_code == 200
        me = requests.get(f"{API}/auth/me", headers=_hdr(u["token"])).json()
        assert me["name"] == original_name, "name must not be updatable via /profile/edit"
        assert me["bio"] == "ok"


# --- discover buckets + filters + non-negotiables ---
def _make_full_user(suffix, **overrides):
    """Register, onboard, liveness-verify, and mark profile_complete via DB
    (bypass storage upload). Returns (token, user_id)."""
    u = _register(suffix)
    _onboard(u["token"], **overrides)
    desc = [random.random() for _ in range(128)]
    r = requests.post(f"{API}/liveness/verify",
                      json={"steps_completed": 4, "face_descriptor": desc},
                      headers=_hdr(u["token"]))
    assert r.status_code == 200
    return u["token"], u["user"]["user_id"], desc


async def _mark_profile_complete(uid, extra=None):
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    upd = {"profile_complete": True, "main_photo_verified": True,
           "photos": ["fake/main.jpg"], "prompts": [{"q":"a","a":"b"}]}
    if extra: upd.update(extra)
    await db.users.update_one({"user_id": uid}, {"$set": upd})
    client.close()


def _mark(uid, extra=None):
    asyncio.run(_mark_profile_complete(uid, extra))


class TestDiscover:
    def test_primary_and_nearby_buckets(self):
        # user A in indiranagar, radius 3km
        tokA, uidA, _ = _make_full_user("dA", locality="indiranagar",
                                        home_lat=12.9784, home_lng=77.6408, radius_km=3)
        _mark(uidA)
        # B in indiranagar (same locality)
        tokB, uidB, _ = _make_full_user("dB", locality="indiranagar",
                                        home_lat=12.9790, home_lng=77.6410, radius_km=5)
        _mark(uidB)
        # C far away (whitefield ~15km) - outside radius
        tokC, uidC, _ = _make_full_user("dC", locality="whitefield",
                                        home_lat=12.9698, home_lng=77.7500, radius_km=5)
        _mark(uidC)

        r = requests.get(f"{API}/discover", headers=_hdr(tokA))
        assert r.status_code == 200, r.text
        body = r.json()
        assert "primary" in body and "nearby" in body and "fallback_message" in body
        primary_ids = [c["user"]["user_id"] for c in body["primary"]]
        nearby_ids = [c["user"]["user_id"] for c in body["nearby"]]
        assert uidB in primary_ids, f"B (same locality) expected in primary; got {primary_ids}"
        assert uidC in nearby_ids or uidC in primary_ids  # far one should be in nearby
        # ensure highlights on cards
        for c in body["primary"]:
            assert "highlights" in c and isinstance(c["highlights"], list)

    def test_live_filter_food(self):
        tokA, uidA, _ = _make_full_user("dfA", food_pref="veg", locality="hsr")
        _mark(uidA)
        tokV, uidV, _ = _make_full_user("dfV", food_pref="veg", locality="hsr",
                                        home_lat=12.9116, home_lng=77.6473)
        _mark(uidV)
        tokN, uidN, _ = _make_full_user("dfN", food_pref="non_veg", locality="hsr",
                                        home_lat=12.9116, home_lng=77.6473)
        _mark(uidN)

        r = requests.get(f"{API}/discover", params={"food": "veg"}, headers=_hdr(tokA))
        assert r.status_code == 200
        all_ids = [c["user"]["user_id"] for c in r.json()["primary"] + r.json()["nearby"]]
        assert uidV in all_ids
        assert uidN not in all_ids, "non_veg candidate should be filtered out with food=veg"

    def test_non_negotiable_food_filter(self):
        tokA, uidA, _ = _make_full_user("nnA", food_pref="veg", locality="btm")
        _mark(uidA)
        # set food_pref as non-negotiable for A
        r = requests.put(f"{API}/non-negotiables",
                         json={"non_negotiables": ["food_pref"]}, headers=_hdr(tokA))
        assert r.status_code == 200
        tokX, uidX, _ = _make_full_user("nnX", food_pref="non_veg", locality="btm",
                                        home_lat=12.9166, home_lng=77.6101)
        _mark(uidX)
        r = requests.get(f"{API}/discover", headers=_hdr(tokA))
        assert r.status_code == 200
        all_ids = [c["user"]["user_id"] for c in r.json()["primary"] + r.json()["nearby"]]
        assert uidX not in all_ids, "non-negotiable food_pref should exclude mismatched candidate"

    def test_fallback_message_when_primary_empty(self):
        # A in a unique locality with no same-locality candidate; only far C exists
        unique_loc = f"testloc_{uuid.uuid4().hex[:6]}"
        tokA, uidA, _ = _make_full_user("fbA", locality=unique_loc,
                                        home_lat=12.9784, home_lng=77.6408, radius_km=2)
        _mark(uidA)
        tokC, uidC, _ = _make_full_user("fbC", locality="whitefield",
                                        home_lat=12.9698, home_lng=77.7500, radius_km=5)
        _mark(uidC)
        r = requests.get(f"{API}/discover", headers=_hdr(tokA))
        assert r.status_code == 200
        body = r.json()
        if not body["primary"] and body["nearby"]:
            assert body["fallback_message"], "expected fallback_message when primary empty and nearby exists"
