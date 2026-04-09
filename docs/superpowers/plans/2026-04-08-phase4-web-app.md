# Phase 4: Next.js Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, production-quality Next.js 14 (App Router) web frontend for TuneMyMusic with all dashboard pages, a marketing landing page, authentication flows, and live transfer progress.

**Architecture:** App Router layout hierarchy — public routes (`/`, `/login`, `/signup`, `/pricing`) + auth-guarded dashboard routes (`/dashboard/*`). Auth state lives in Zustand (localStorage token), API calls via TanStack Query wrapping a typed `ApiClient` class that injects Bearer tokens. SSE consumed natively via `EventSource` on the transfer progress page.

**Tech Stack:** Next.js 14, React 18, TypeScript 5.7, Tailwind CSS 3.4, Framer Motion 11, TanStack Query 5, Zustand 5, Lucide React, clsx/tailwind-merge, `next/font/google` (Syne + Inter + JetBrains Mono).

---

## File Map

```
apps/web/
├── package.json                          — dependencies (new)
├── tsconfig.json                         — TS config (replace)
├── next.config.js                        — Next config
├── tailwind.config.ts                    — design tokens
├── postcss.config.js                     — autoprefixer
├── src/
│   ├── lib/
│   │   ├── utils.ts                      — cn() helper
│   │   ├── api.ts                        — ApiClient singleton
│   │   ├── store.ts                      — Zustand auth store
│   │   └── constants.ts                  — PLATFORM_CONFIG
│   ├── components/
│   │   └── ui/
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── input.tsx
│   │       ├── badge.tsx
│   │       ├── skeleton.tsx
│   │       ├── progress.tsx
│   │       ├── dialog.tsx
│   │       └── platform-icon.tsx
│   └── app/
│       ├── globals.css
│       ├── layout.tsx                    — root layout, fonts
│       ├── providers.tsx                 — QueryClient wrapper
│       ├── page.tsx                      — marketing landing
│       ├── login/page.tsx
│       ├── signup/page.tsx
│       ├── pricing/page.tsx
│       └── dashboard/
│           ├── layout.tsx                — sidebar + auth guard
│           ├── page.tsx                  — dashboard home
│           ├── connect/page.tsx
│           ├── playlists/
│           │   ├── page.tsx
│           │   └── [platform]/[id]/page.tsx
│           ├── transfer/
│           │   ├── new/page.tsx          — 3-step wizard
│           │   └── [id]/page.tsx         — live progress + SSE
│           ├── history/page.tsx
│           ├── sync/page.tsx
│           ├── liked-songs/page.tsx
│           ├── stats/page.tsx
│           ├── search/page.tsx
│           ├── tools/
│           │   ├── merge/page.tsx
│           │   ├── split/page.tsx
│           │   ├── health/page.tsx
│           │   └── duplicates/page.tsx
│           └── settings/
│               ├── page.tsx
│               └── billing/page.tsx
```

---

## Task 1: Project Config (package.json, tsconfig, tailwind, postcss, next.config)

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/tsconfig.json`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/next.config.js`

- [ ] **Step 1: Replace package.json**

```json
{
  "name": "web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@tunemymusic/types": "workspace:*",
    "@tanstack/react-query": "^5.60.0",
    "zustand": "^5.0.0",
    "framer-motion": "^11.15.0",
    "lucide-react": "^0.468.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.6.0",
    "class-variance-authority": "^0.7.0",
    "next-themes": "^0.4.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

- [ ] **Step 2: Create tailwind.config.ts, postcss.config.js, next.config.js, tsconfig.json** (see spec above)

- [ ] **Step 3: Run install**
```bash
cd /c/Users/Comec/TuneMyMusic && pnpm install
```

---

## Task 2: Foundation — globals.css, layout.tsx, providers.tsx, lib files

**Files:**
- Create: `apps/web/src/app/globals.css`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/providers.tsx`
- Create: `apps/web/src/lib/utils.ts`
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/lib/store.ts`
- Create: `apps/web/src/lib/constants.ts`

---

## Task 3: UI Components (button, card, input, badge, skeleton, progress, dialog, platform-icon)

**Files:** `apps/web/src/components/ui/*.tsx`

---

## Task 4: Public Pages (landing, login, signup, pricing)

**Files:**
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/login/page.tsx`
- `apps/web/src/app/signup/page.tsx`
- `apps/web/src/app/pricing/page.tsx`

---

## Task 5: Dashboard Layout + Home Page

**Files:**
- `apps/web/src/app/dashboard/layout.tsx`
- `apps/web/src/app/dashboard/page.tsx`

---

## Task 6: Playlists + Connect Pages

**Files:**
- `apps/web/src/app/dashboard/connect/page.tsx`
- `apps/web/src/app/dashboard/playlists/page.tsx`
- `apps/web/src/app/dashboard/playlists/[platform]/[id]/page.tsx`

---

## Task 7: Transfer Wizard + Live Progress

**Files:**
- `apps/web/src/app/dashboard/transfer/new/page.tsx`
- `apps/web/src/app/dashboard/transfer/[id]/page.tsx`

---

## Task 8: History, Sync, Liked Songs, Stats, Search

**Files:**
- `apps/web/src/app/dashboard/history/page.tsx`
- `apps/web/src/app/dashboard/sync/page.tsx`
- `apps/web/src/app/dashboard/liked-songs/page.tsx`
- `apps/web/src/app/dashboard/stats/page.tsx`
- `apps/web/src/app/dashboard/search/page.tsx`

---

## Task 9: Tools Pages

**Files:**
- `apps/web/src/app/dashboard/tools/merge/page.tsx`
- `apps/web/src/app/dashboard/tools/split/page.tsx`
- `apps/web/src/app/dashboard/tools/health/page.tsx`
- `apps/web/src/app/dashboard/tools/duplicates/page.tsx`

---

## Task 10: Settings + Billing

**Files:**
- `apps/web/src/app/dashboard/settings/page.tsx`
- `apps/web/src/app/dashboard/settings/billing/page.tsx`

---

## Task 11: Build Verification

```bash
cd /c/Users/Comec/TuneMyMusic && pnpm --filter web build
```

Expected: successful build with static/SSR pages listed, 0 TypeScript errors.
