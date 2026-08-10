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
- 7-step onboarding wizard (age, gender, city, budget, housing intent, work, habits, interests)
- Liveness check with 4-action prompts + selfie capture uploaded to object storage
- Profile builder (photos ×6, bio, prompts)
- Swipe discovery feed with framer-motion drag physics and match-score badges
- Compatibility algorithm (out of 100) using city, housing complement, budget overlap, food, cleanliness, sleep, social, habits, interests
- Mutual match detection → celebratory match modal
- Matches list with last-message preview
- Real-time chat via WebSocket + REST send

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
