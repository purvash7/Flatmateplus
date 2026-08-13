import asyncio, json, os
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client=AsyncIOMotorClient(os.environ["MONGO_URL"])
    db=client[os.environ["DB_NAME"]]
    with open(os.path.join(os.path.dirname(__file__),"dummy_profiles.json"),encoding="utf-8") as f:
        profiles=json.load(f)
    for p in profiles:
        doc={**p,"radius_km":15,"housing_status":"need_house_together","budget_min":12000,"budget_max":30000,"move_in_date":"2026-09-01","flatmate_gender_pref":"any","company_or_college":"Test Company","work_schedule":"hybrid","cooks_at_home":"sometimes","cleanliness":4,"sleep_schedule":"flexible","social_level":"ambivert","drinking":"no","smoking":"no","pets_ok":True,"guests_freq":"sometimes","male_guests_ok":True,"family_visits_ok":True,"hosts_parties":"rarely","music_ok":True,"languages":["English","Hindi"],"interests":["Travel","Music","Reading"],"flat_preferences":[],"non_negotiables":[],"onboarding_done":True,"liveness_verified":False,"profile_complete":True,"main_photo_verified":False,"photos":[],"prompts":[{"q":"My ideal flatmate is","a":"Respectful and easy to live with."}],"bio":f"Demo profile for {p['locality']}.","is_dummy":True}
        await db.users.update_one({"user_id":p["user_id"]},{"$set":doc},upsert=True)
    print(f"Seeded {len(profiles)} dummy profiles")
    client.close()

if __name__=="__main__": asyncio.run(main())
