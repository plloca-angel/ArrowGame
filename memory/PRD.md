# Arrow Escape - Product Requirements

## Overview
**Arrow Escape** is an infinite minimalist neon mobile puzzle game. Players tap arrows on a grid to release them in their pointing direction. Goal: escape every arrow off the board without letting any two flight paths collide.

## Platform
Expo (React Native) SDK 54 + FastAPI + MongoDB + Stripe (test mode)

## Core Mechanics
- Each level presents a fully-filled grid (every cell = an arrow) of size 3×3 → up to 12×12
- Tapping an arrow releases it; it flies cell-by-cell in its pointing direction
- An arrow **escapes** when it exits the grid; **collides** if its path encounters another arrow
- Win condition: all arrows escape

## Difficulty / Levels
- Infinite procedural levels — no level selector
- Deterministic per-id (seeded PRNG) so each "level N" is the same on every device
- Grid size scales gradually: 3×3 (L1) → 12×12 (L121+)
- Solvability is **mathematically guaranteed** by construction (center-out placement so each new arrow has a clear path of all prior placements)

## Screens (expo-router file-based)
- `/` Home — title + Continue/Play, stats (Lv reached, Solved, Stars), Store/Settings/Accessibility tabs, banner ad
- `/game?level=N` Gameplay — board, hint button, skip button, restart, banner ad, win/lose modal
- `/store` Stripe-powered store with two products
- `/settings` Sound, haptics, theme variant (cyan/magenta/green), reduced motion, reset progress
- `/accessibility` Larger arrows, high-contrast, color-blind safe palette, reduced motion

## Monetization
**Banner Ads:** Visual-only (mocked) banner that hides automatically once `Remove Ads` is purchased.

**In-App Purchases (Stripe Checkout, test mode):**
- `remove_ads` — $2.99 one-time, removes banner ads forever
- `hint_pack_10` — $0.99 consumable, grants 10 hint credits (highlight the next safe arrow)

Server-side `PRODUCTS` dict is the single source of truth for prices. Frontend never sends amounts.

## Stripe flow
1. Frontend calls `POST /api/checkout/session` with `{product_id, origin_url, user_id}`
2. Backend creates Stripe Checkout session, persists row in `payment_transactions` (`status=initiated`)
3. Returns `{url, session_id}`; frontend redirects (web) or opens WebBrowser (native)
4. Stripe redirects back to `/store?session_id=…`
5. Frontend polls `GET /api/checkout/status/{session_id}` until `payment_status=paid`
6. On paid, client calls `grantPurchase(sessionId, productId)` (idempotent via `grantedSessions[]` in AsyncStorage)
7. `POST /api/webhook/stripe` mirrors the same status update server-side

## Persistence (AsyncStorage)
- `arrow_escape_progress_v2` — current level, completed count, total stars, per-level best moves/stars
- `arrow_escape_settings_v1` — sound, haptics, reducedMotion, theme, largeArrows, highContrast, colorBlindSafe
- `arrow_escape_entitlements_v1` — `removeAds`, `hintCredits`, `grantedSessions[]`
- `arrow_escape_device_id_v1` — random local id (sent as `user_id` in checkout for entitlement tracking)

## Tech
- Frontend: expo-router, React Native Animated, AsyncStorage, expo-haptics, expo-web-browser, @expo/vector-icons
- Backend: FastAPI, motor (Mongo), `emergentintegrations.payments.stripe.checkout`
- Theme: 3 neon palettes + color-blind-safe + high-contrast mode
