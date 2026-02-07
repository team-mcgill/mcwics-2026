<coding_guidelines>
# AGENTS.md - DrippyFi (MCWICS 2026)

## Project Overview

**Name**: Masquerade  
**Concept**: Web3 digital fashion platform where users customize a live avatar, style outfits, and later own/trade wearable NFTs.

Core product direction:
- Real-time face tracking and avatar interaction
- Wearable-based customization experience
- Social posting and discovery around outfits
- Solana-backed ownership + marketplace

---

## Current Repository Structure

```text
mcwics-2026/
├── fe/   # Frontend (Vite + React)
└── be/   # Backend (FASTAPI - planned/starting here)
```

---

## What We Have So Far

### Frontend (`/fe`)
Implemented:
- Vite + React 18 setup
- Tailwind CSS v4 integration
- React Router routing with pages:
  - `/` Home
  - `/about` About
  - `/character` Character
  - `*` NotFound
- Character customization prototype using:
  - Webcam access (`getUserMedia`)
  - MediaPipe Face Landmarker (`@mediapipe/tasks-vision`)
  - Three.js face mesh rendering
  - Paint-on-face UV texture workflow
  - Brush controls (color, size, clear)
  - Toggle face mesh overlay

Current user-visible milestone:
- User can open Character page, allow camera, see tracked face mesh, and paint directly on the mesh in real time.

### Backend (`/be`)
Current state:
- Backend folder exists
- Python-focused `.gitignore` is in place
- No API app scaffold committed yet

---

## Backend Decision

Backend will be built with **FASTAPI**.

### Planned Backend Stack
- FastAPI (API framework)
- Uvicorn (ASGI server)
- Pydantic (request/response models)
- PostgreSQL (primary app/social data)
- Redis (caching and realtime helpers)

### Initial API Goals
- `GET /health` basic health check
- User profile endpoints
- Outfit post endpoints (fit checks)
- Wearables metadata endpoints
- Basic feed endpoints for social timeline

---

## Product Scope (MVP)

### In Progress
- [x] Frontend app shell + routing
- [x] Face mesh tracking + visual customization prototype
- [ ] FASTAPI backend scaffold
- [ ] Database schema + migrations
- [ ] Wallet connection (Phantom)
- [ ] Solana NFT ownership flow
- [ ] Equip/unequip wearable system
- [ ] Social fit check posting
- [ ] Marketplace list/buy flow

---

## Engineering Notes

### Frontend Conventions
- Keep React components functional and hook-based
- Prefer local component state unless cross-page state is needed
- Keep camera/face-tracking performance in mind (avoid unnecessary rerenders)

### Backend Conventions (FASTAPI)
- Organize by domain modules (`users`, `wearables`, `social`, `marketplace`)
- Separate API schemas from persistence models
- Use async endpoints where network/io is involved
- Add input validation and explicit response models for each route

### Security + Privacy
- Never log private keys, wallet secrets, or sensitive identifiers
- Camera data should remain client-side unless explicitly needed
- Validate/sanitize all backend inputs

---

## Near-Term Next Steps

1. Scaffold FASTAPI app in `/be`
2. Add health check + base router structure
3. Define first DB models (`User`, `OutfitPost`, `Wearable`)
4. Connect frontend Character flow to backend profile/outfit endpoints
5. Start Solana wallet integration in frontend

</coding_guidelines>
