# FlatMate+ — Product Requirements

## Problem Statement
Build a flatmate matching web app (India-focused) called FlatMate+ with:
- Onboarding flow (location, gender pref, housing situation, behavioural/work/food/cleanliness preferences)
- Selfie liveness check via webcam (client-side blink/head-turn)
- Profile builder (prompts + photos)
- Swipe-based discovery with mutual-match algorithm and match score
- Real-time chat between matched users

## Architecture
- Backend: FastAPI + MongoDB (motor)
- Frontend: React 19, Framer Motion, shadcn/ui, Tailwind
- Auth: JWT (email/password) + Emergent-managed Google OAuth
- Storage: Emergent Object Storage (profile photos & selfie)
- Chat: WebSocket + HTTP fallback
- Design: Warm & friendly palette (terracotta/sand/off-white), Cabinet Grotesk + Manrope fonts

## Implemented (Feb 2026)
- Landing page with dual auth (JWT + Google)
- Multi-step onboarding wizard with area autocomplete + radius + office pin
- Liveness check + face descriptor (face-api.js) stored server-side
- Profile builder: photo face-match against selfie, mandatory flat photos for have_house
- Non-negotiables step → hard filters in matching
- Swipe discovery: same-locality first, nearby fallback, live filter sheet (radius, budget, food, smoking, drinking, housing)
- Compatibility algorithm returning score + highlights; cards show top 4 matched-attribute chips (no numeric score)
- Verified badge on cards for face-matched users
- Mutual match detection → celebratory modal
- Matches list, real-time WebSocket chat
- Full edit-profile page (all fields except name) with housing-switch guard

## Backend endpoints (v3)
- /api/geo/search — Nominatim proxy (India-scoped)
- /api/non-negotiables — save hard-filter preferences
- /api/profile/edit — PATCH any field except name; housing-switch validated
- /api/discover — buckets primary/nearby + fallback_message; supports live filter query params

## User Persona
- Young Indian professionals & students (22-32) seeking flatmates in major cities
- Cares about compatibility, safety (liveness), and vibe alignment

## Backlog (P1)
- Filters on discover (city switch, budget, gender)
- Report/block users
- Push notifications for new matches/messages
- Verified badge on profile cards in discover feed
- Image lightbox in chat

## Backlog (P2)
- Group flat listings (3+ people)
- Rent split calculator
- ID verification (Aadhaar mask)
