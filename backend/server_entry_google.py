import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
import requests
import server as base

app = base.app
router = APIRouter(prefix='/api')

class GoogleLoginIn(base.BaseModel):
    credential: str

@router.post('/auth/google')
async def google_login(data: GoogleLoginIn):
    client_id=os.environ.get('GOOGLE_CLIENT_ID','')
    if not client_id:
        raise HTTPException(status_code=503, detail='Google login is not configured')
    try:
        r=requests.get('https://oauth2.googleapis.com/tokeninfo',params={'id_token':data.credential},timeout=10)
        claims=r.json()
        if r.status_code!=200 or claims.get('aud')!=client_id or claims.get('iss') not in ('accounts.google.com','https://accounts.google.com') or claims.get('email_verified') not in (True,'true','True'):
            raise ValueError()
        email=(claims.get('email') or '').lower().strip(); sub=claims.get('sub')
        if not email or not sub: raise ValueError()
    except Exception:
        raise HTTPException(status_code=401, detail='Invalid Google credential')
    user=await base.db.users.find_one({'google_sub':sub},{'_id':0}) or await base.db.users.find_one({'email':email},{'_id':0})
    if not user:
        uid=f'user_{base.uuid.uuid4().hex[:12]}'
        user={'user_id':uid,'email':email,'name':claims.get('name') or email.split('@')[0],'picture':claims.get('picture'),'google_sub':sub,'onboarding_done':False,'liveness_verified':False,'profile_complete':False,'main_photo_verified':False,'created_at':datetime.now(timezone.utc).isoformat()}
        await base.db.users.insert_one(user)
    else:
        await base.db.users.update_one({'user_id':user['user_id']},{'$set':{'google_sub':sub,'picture':user.get('picture') or claims.get('picture')}})
        user=await base.db.users.find_one({'user_id':user['user_id']},{'_id':0})
    return {'token':base.create_jwt(user['user_id']),'user':base.user_public(user)}

app.include_router(router)
