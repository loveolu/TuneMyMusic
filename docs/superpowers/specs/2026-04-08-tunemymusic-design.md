# TuneMyMusic — Design Spec

## Overview
Full-stack music playlist transfer platform. Users connect streaming accounts and move playlists between services. Monorepo with Next.js web app, Expo mobile app, Fastify API server, and shared packages.

## Architecture
- **Monorepo**: pnpm workspaces + Turborepo
- **Web**: Next.js 14 App Router, Tailwind + shadcn/ui, NextAuth v5
- **Mobile**: Expo SDK 51, NativeWind v4, Expo Router v3
- **Server**: Fastify + Prisma + PostgreSQL + Redis (BullMQ)
- **Shared**: `packages/core` (adapters, matching), `packages/types` (Zod schemas), `packages/api-client`, `packages/ui`

## Key Design Decisions
1. **Platform adapter pattern** — each streaming service implements `MusicPlatformAdapter` interface
2. **Track matching pipeline** — ISRC > exact > fuzzy > phonetic, with confidence scoring 0-100
3. **Async transfers via BullMQ** — jobs queued in Redis, progress streamed via SSE
4. **OAuth tokens encrypted at rest** — AES-256-GCM
5. **Tiered pricing** — FREE (limited) / PRO ($4.99/mo) / UNLIMITED ($9.99/mo)

## Decomposition Strategy
Given the massive scope, implementation follows 7 phases:
- **Phase 1**: Monorepo foundation, DB, server scaffold, shared types
- **Phase 2**: Tier 1 platform adapters (Spotify, YouTube, Apple, Amazon, Tidal)
- **Phase 3**: Transfer engine (matching, workers, SSE)
- **Phase 4**: Web app (all pages)
- **Phase 5**: Mobile app (all screens)
- **Phase 6**: Enhanced features (sync, merge, split, AI, stats)
- **Phase 7**: Polish (billing, tests, docs)

## Database
PostgreSQL via Prisma. Core models: User, PlatformConnection, Transfer, TransferTrack, SavedPlaylist, TransferSchedule, Notification.

## Design System
Dark theme, music-forward. Near-black backgrounds (#0A0A0B), electric yellow-green accent (#E8FF47). Syne for headings, Cabinet Grotesk for body.

## Security
- OAuth tokens AES-256-GCM encrypted
- Zod validation on all API routes
- PKCE where supported
- Rate limiting on public endpoints
- Never log access tokens
