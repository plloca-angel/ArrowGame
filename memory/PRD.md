# Arrow Escape - Product Requirements

## Overview
**Arrow Escape** is a minimalist neon mobile puzzle game. Players tap arrows on a grid to release them in their pointing direction. Goal: escape every arrow off the board without letting any two flight paths collide.

## Target Platform
Expo (React Native) - iOS, Android, Web preview

## Core Mechanics
- Each level presents a grid (4x4 to 7x7) with arrows pointing up/down/left/right
- Tapping an arrow releases it; it flies cell-by-cell in its direction
- An arrow **escapes** when it exits the grid → success
- An arrow **collides** if its path encounters another arrow (or wall) → level fail
- Win condition: all arrows escape

## Features
- 12 hand-crafted levels with increasing difficulty (some include walls)
- Procedurally generated levels beyond level 12 (endless ∞)
- Star ratings (1-3) per level based on move efficiency
- Local progression saved via AsyncStorage (no backend, fully offline)
- Level select grid with locked/unlocked states + reset progress
- Haptic feedback for taps, escapes, collisions, and wins
- Smooth Animated.timing arrow flight + shake on collision

## Visual / UX
- Minimalist neon dark theme (cyan + magenta on near-black)
- Glowing animated title on home screen
- 8pt grid spacing, 44px+ touch targets
- Modal overlays for win/lose with star rewards

## Tech Stack
- expo-router (file-based navigation: `/`, `/levels`, `/game?level=N`)
- React Native Animated API (Animated.ValueXY)
- @react-native-async-storage/async-storage for persistence
- expo-haptics for tactile feedback
- @expo/vector-icons (Ionicons)

## Routes
- `/` - Home (title + Continue/Play, stats: solved, levels, stars)
- `/levels` - Level select grid
- `/game?level=N` - Game board for level N
