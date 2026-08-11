"""FlatMate+ backend regression: swipe->match, matches list, messages, WS broadcast."""
import os, uuid, asyncio, json, random
import pytest
import requests
import websockets

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://flatmate-plus-1.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


def _register(suffix):
    email = f"TEST_{suffix}_{uuid.uuid4().hex[:8]}@test.com"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "password123", "name": f"Test {suffix}"})
    assert r.status_code == 200, r.text
    return r.json()  # {token, user}


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


def _onboard(tok, gender, housing_status, flatmate_gender_pref="any"):
    payload = {
        "age": 25, "gender": gender, "city": "bangalore", "locality": "koramangala",
        "housing_status": housing_status, "budget_min": 10000, "budget_max": 25000,
        "move_in_date": "2026-02-01", "flatmate_gender_pref": flatmate_gender_pref,
        "work_profile": "working_professional", "company_or_college": "Acme",
        "food_pref": "veg", "cooks_at_home": "sometimes", "cleanliness": 4,
        "sleep_schedule": "flexible", "social_level": "ambivert",
        "drinking": "no", "smoking": "no", "pets_ok": True, "guests_freq": "sometimes",
        "music_ok": True, "languages": ["english", "hindi"], "interests": ["reading", "hiking"]
    }
    r = requests.put(f"{API}/onboarding", json=payload, headers=_hdr(tok))
    assert r.status_code == 200, r.text
    r = requests.post(f"{API}/liveness/verify", json={"steps_completed": 4, "face_descriptor": [random.random() for _ in range(128)]}, headers=_hdr(tok))
    assert r.status_code == 200, r.text


@pytest.fixture(scope="module")
def pair():
    a = _register("alice")
    b = _register("bob")
    _onboard(a["token"], "female", "have_house", "any")
    _onboard(b["token"], "male", "need_house_from_someone", "any")
    return a, b


def test_swipe_mutual_match_returns_clean_json(pair):
    a, b = pair
    # a likes b (non-mutual)
    r1 = requests.post(f"{API}/swipe", json={"target_user_id": b["user"]["user_id"], "direction": "like"}, headers=_hdr(a["token"]))
    assert r1.status_code == 200, r1.text
    assert r1.json()["matched"] is False
    # b likes a (mutual - triggers match creation)
    r2 = requests.post(f"{API}/swipe", json={"target_user_id": a["user"]["user_id"], "direction": "like"}, headers=_hdr(b["token"]))
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body["matched"] is True
    assert "match" in body and "match_id" in body["match"]
    assert "_id" not in body["match"]
    assert "other" in body and body["other"]["user_id"] == a["user"]["user_id"]
    # persistable json
    json.dumps(body)


def test_matches_list_has_other_and_last_message(pair):
    a, _ = pair
    r = requests.get(f"{API}/matches", headers=_hdr(a["token"]))
    assert r.status_code == 200, r.text
    lst = r.json()
    assert isinstance(lst, list) and len(lst) >= 1
    item = lst[0]
    assert "match" in item and "other" in item and "last_message" in item
    assert "_id" not in item["match"]


def test_messages_send_and_list_order(pair):
    a, b = pair
    ms = requests.get(f"{API}/matches", headers=_hdr(a["token"])).json()
    match_id = ms[0]["match"]["match_id"]
    for txt in ["hi bob", "how are you", "want to meet?"]:
        r = requests.post(f"{API}/messages", json={"match_id": match_id, "text": txt}, headers=_hdr(a["token"]))
        assert r.status_code == 200, r.text
        m = r.json()
        assert "_id" not in m
        assert m["text"] == txt
    r = requests.get(f"{API}/messages/{match_id}", headers=_hdr(b["token"]))
    assert r.status_code == 200
    msgs = r.json()
    assert [m["text"] for m in msgs[-3:]] == ["hi bob", "how are you", "want to meet?"]


def test_ws_broadcasts_new_message(pair):
    a, b = pair
    ms = requests.get(f"{API}/matches", headers=_hdr(a["token"])).json()
    match_id = ms[0]["match"]["match_id"]
    ws_url = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + f"/api/ws/{b['user']['user_id']}?token={b['token']}"

    async def run():
        async with websockets.connect(ws_url, open_timeout=15) as ws:
            await asyncio.sleep(0.5)
            # a sends message; b should receive on ws
            r = requests.post(f"{API}/messages", json={"match_id": match_id, "text": "ws-hello"}, headers=_hdr(a["token"]))
            assert r.status_code == 200
            data = await asyncio.wait_for(ws.recv(), timeout=10)
            payload = json.loads(data)
            assert payload["type"] == "message"
            assert payload["message"]["text"] == "ws-hello"

    asyncio.get_event_loop().run_until_complete(run()) if False else asyncio.run(run())
