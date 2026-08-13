# Deploying FlatMate+

This app was originally scaffolded on Emergent's platform, which wired the
image storage and Google login to Emergent's own private services. Those
have been removed/replaced so the app runs standalone:

- Photo/selfie storage now writes to local disk instead of Emergent's
  storage proxy.
- "Continue with Google" has been removed from the login screen (it relied
  on Emergent's OAuth proxy). Email/password login and registration still
  work exactly as before — no changes needed there.
- The `emergentintegrations` package was removed from `requirements.txt`
  (it's a private package, not on public PyPI, and wasn't actually used by
  any code in this repo).

Recommended free stack: **MongoDB Atlas** (database) + **Render** (backend)
+ **Vercel** (frontend).

## 1. Database — MongoDB Atlas

1. Create a free cluster at https://www.mongodb.com/cloud/atlas
2. Create a database user (username + password)
3. Under Network Access, allow access from anywhere (0.0.0.0/0) — simplest
   for now, tighten later if you want
4. Copy the connection string (Drivers → Python) — looks like
   `mongodb+srv://user:password@cluster0.xxxxx.mongodb.net`

## 2. Backend — Render

1. Push this repo to your own GitHub (already done)
2. On https://render.com → New → Web Service → connect the repo
3. Root directory: `backend`
4. Build command: `pip install -r requirements.txt`
5. Start command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
6. Add environment variables (see `backend/.env.example`):
   - `MONGO_URL` — your Atlas connection string
   - `DB_NAME` — e.g. `flatmateplus`
   - `JWT_SECRET` — generate with `python -c "import secrets; print(secrets.token_hex(32))"`
   - `CORS_ORIGINS` — fill in after step 3 with your Vercel URL
7. Deploy. Note the resulting URL, e.g. `https://flatmateplus-api.onrender.com`

**Caveat:** Render's free tier has an ephemeral filesystem — uploaded
photos are wiped on every redeploy or restart (and the service sleeps
after inactivity, so a restart happens often on the free tier). Fine for
testing the app end-to-end; before you rely on real user photos sticking
around, swap `put_object`/`get_object` in `backend/server.py` for S3 or
Cloudinary (the function signatures are the only thing other code depends
on, so it's a self-contained swap).

## 3. Frontend — Vercel

1. On https://vercel.com → Add New → Project → import the repo
2. Root directory: `frontend`
3. Framework preset: Create React App
4. Add environment variable `REACT_APP_BACKEND_URL` = your Render URL from
   step 2 (no trailing slash)
5. Deploy. Note the resulting URL, e.g. `https://flatmateplus.vercel.app`

## 4. Close the loop

Go back to Render → your backend service → environment variables → set
`CORS_ORIGINS` to your Vercel URL from step 3, then redeploy the backend.

## 5. Test

Visit your Vercel URL, register a new account, go through onboarding, and
try uploading a profile photo to confirm storage is working.
