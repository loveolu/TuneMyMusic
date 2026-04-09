# Phase 1: Monorepo Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the TuneMyMusic monorepo with pnpm workspaces, Turborepo, shared TypeScript config, Docker Compose (Postgres + Redis), Prisma schema, Fastify server scaffold with auth, shared types/schemas, and the core package with base adapter interface + matching utilities.

**Architecture:** pnpm workspaces monorepo with Turborepo for orchestration. Five workspace packages (`apps/web`, `apps/mobile`, `packages/core`, `packages/types`, `packages/api-client`) plus a `server/` workspace. Shared tsconfig base extended per package. Fastify server with JWT auth, Prisma ORM for Postgres, BullMQ for Redis job queues.

**Tech Stack:** pnpm, Turborepo, TypeScript 5.x strict, Fastify, Prisma, PostgreSQL 16, Redis 7, BullMQ, Zod, bcrypt, jsonwebtoken, Vitest

---

## File Structure

```
tunemymusic/
├── package.json                    # Workspace root
├── pnpm-workspace.yaml             # Workspace definitions
├── turbo.json                      # Turborepo pipeline config
├── tsconfig.base.json              # Shared TS config
├── .eslintrc.js                    # Shared ESLint config
├── .prettierrc                     # Prettier config
├── .gitignore
├── .env.example
├── docker-compose.yml              # Postgres + Redis
├── packages/
│   └── types/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts            # Re-exports
│           ├── platform.ts         # Platform enums + types
│           ├── user.ts             # User types + schemas
│           ├── playlist.ts         # Playlist/Track types + schemas
│           ├── transfer.ts         # Transfer types + schemas
│           └── auth.ts             # Auth types + schemas
├── packages/
│   └── core/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── adapters/
│           │   └── base.ts         # MusicPlatformAdapter interface
│           ├── matching/
│           │   ├── normalizer.ts   # Track/artist name normalization
│           │   ├── fuzzy-matcher.ts # String similarity matching
│           │   ├── confidence-scorer.ts # Score 0-100
│           │   └── track-matcher.ts # Orchestrates matching pipeline
│           └── transfer/
│               └── transfer-state.ts # Transfer state machine
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                # Server entry point
│       ├── app.ts                  # Fastify app factory
│       ├── config.ts               # Environment config
│       ├── prisma.ts               # Prisma client singleton
│       ├── plugins/
│       │   └── auth.ts             # JWT auth plugin
│       ├── routes/
│       │   ├── auth.ts             # Auth routes
│       │   └── connections.ts      # Platform connection routes (stub)
│       ├── middleware/
│       │   └── require-auth.ts     # Auth guard middleware
│       └── utils/
│           ├── encryption.ts       # AES-256-GCM encrypt/decrypt
│           └── password.ts         # bcrypt hash/verify
├── server/prisma/
│   └── schema.prisma               # Full database schema
└── server/tests/
    ├── auth.test.ts
    ├── encryption.test.ts
    └── setup.ts                    # Test setup
```

---

### Task 1: Initialize monorepo root

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `.npmrc`

- [ ] **Step 1: Initialize git repo**

Run:
```bash
cd /c/Users/Comec/TuneMyMusic
git init
```
Expected: `Initialized empty Git repository`

- [ ] **Step 2: Create root package.json**

```json
{
  "name": "tunemymusic",
  "private": true,
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md}\"",
    "db:generate": "pnpm --filter server prisma generate",
    "db:push": "pnpm --filter server prisma db push",
    "db:migrate": "pnpm --filter server prisma migrate dev",
    "db:studio": "pnpm --filter server prisma studio"
  },
  "devDependencies": {
    "turbo": "^2.4.0",
    "typescript": "^5.7.0",
    "prettier": "^3.4.0",
    "eslint": "^9.17.0",
    "@typescript-eslint/eslint-plugin": "^8.19.0",
    "@typescript-eslint/parser": "^8.19.0"
  },
  "packageManager": "pnpm@11.9.0",
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 3: Create pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "server"
```

- [ ] **Step 4: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
.next/
.expo/
.turbo/
*.tsbuildinfo
.env
.env.local
.env.*.local
coverage/
```

- [ ] **Step 6: Create .npmrc**

```
auto-install-peers=true
strict-peer-dependencies=false
```

- [ ] **Step 7: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 8: Create .prettierrc**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 9: Create .env.example**

```
# Server
DATABASE_URL=postgresql://tunemymusic:tunemymusic@localhost:5432/tunemymusic
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me-in-production
ENCRYPTION_KEY=change-me-32-byte-hex-key-00000000

# Platforms (add your keys)
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
APPLE_MUSIC_KEY_ID=
APPLE_MUSIC_TEAM_ID=
APPLE_MUSIC_PRIVATE_KEY=
AMAZON_CLIENT_ID=
AMAZON_CLIENT_SECRET=
TIDAL_CLIENT_ID=
TIDAL_CLIENT_SECRET=
DEEZER_APP_ID=
DEEZER_APP_SECRET=
SOUNDCLOUD_CLIENT_ID=
SOUNDCLOUD_CLIENT_SECRET=
LASTFM_API_KEY=

# Services
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PUBLISHABLE_KEY=
RESEND_API_KEY=
OPENAI_API_KEY=
EXPO_ACCESS_TOKEN=

# Web
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

- [ ] **Step 10: Install dependencies and commit**

Run:
```bash
pnpm install
git add -A
git commit -m "chore: initialize monorepo with pnpm workspaces + turborepo"
```

---

### Task 2: Docker Compose for Postgres + Redis

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Create docker-compose.yml**

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: tunemymusic
      POSTGRES_PASSWORD: tunemymusic
      POSTGRES_DB: tunemymusic
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

- [ ] **Step 2: Start services and verify**

Run:
```bash
docker compose up -d
docker compose ps
```
Expected: Both `postgres` and `redis` services show as running.

- [ ] **Step 3: Commit**

Run:
```bash
git add docker-compose.yml
git commit -m "infra: add docker-compose with postgres and redis"
```

---

### Task 3: packages/types — Shared types and Zod schemas

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/src/index.ts`
- Create: `packages/types/src/platform.ts`
- Create: `packages/types/src/user.ts`
- Create: `packages/types/src/playlist.ts`
- Create: `packages/types/src/transfer.ts`
- Create: `packages/types/src/auth.ts`

- [ ] **Step 1: Create packages/types/package.json**

```json
{
  "name": "@tunemymusic/types",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create packages/types/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/types/src/platform.ts**

```typescript
import { z } from 'zod';

export const PlatformId = z.enum([
  'SPOTIFY',
  'APPLE_MUSIC',
  'YOUTUBE_MUSIC',
  'AMAZON_MUSIC',
  'TIDAL',
  'DEEZER',
  'SOUNDCLOUD',
  'PANDORA',
  'QOBUZ',
  'NAPSTER',
  'LASTFM',
  'CSV',
  'ITUNES_XML',
]);
export type PlatformId = z.infer<typeof PlatformId>;

export const PLATFORM_META: Record<
  PlatformId,
  { displayName: string; brandColor: string; tier: 1 | 2 | 3 }
> = {
  SPOTIFY: { displayName: 'Spotify', brandColor: '#1DB954', tier: 1 },
  APPLE_MUSIC: { displayName: 'Apple Music', brandColor: '#FC3C44', tier: 1 },
  YOUTUBE_MUSIC: { displayName: 'YouTube Music', brandColor: '#FF0000', tier: 1 },
  AMAZON_MUSIC: { displayName: 'Amazon Music', brandColor: '#00A8E1', tier: 1 },
  TIDAL: { displayName: 'Tidal', brandColor: '#000000', tier: 1 },
  DEEZER: { displayName: 'Deezer', brandColor: '#EF5466', tier: 2 },
  SOUNDCLOUD: { displayName: 'SoundCloud', brandColor: '#FF5500', tier: 2 },
  PANDORA: { displayName: 'Pandora', brandColor: '#3668FF', tier: 2 },
  QOBUZ: { displayName: 'Qobuz', brandColor: '#1D8FE1', tier: 2 },
  NAPSTER: { displayName: 'Napster', brandColor: '#000000', tier: 2 },
  LASTFM: { displayName: 'Last.fm', brandColor: '#D51007', tier: 3 },
  CSV: { displayName: 'CSV / M3U File', brandColor: '#6B7280', tier: 3 },
  ITUNES_XML: { displayName: 'iTunes XML', brandColor: '#FB5BC5', tier: 3 },
};

export const OAuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresAt: z.date(),
  tokenType: z.string().default('Bearer'),
  scope: z.string().optional(),
});
export type OAuthTokens = z.infer<typeof OAuthTokensSchema>;
```

- [ ] **Step 4: Create packages/types/src/user.ts**

```typescript
import { z } from 'zod';

export const UserPlan = z.enum(['FREE', 'PRO', 'UNLIMITED']);
export type UserPlan = z.infer<typeof UserPlan>;

export const PLAN_LIMITS: Record<UserPlan, {
  maxConnections: number;
  transfersPerMonth: number;
  maxTracksPerTransfer: number;
  scheduledSyncs: number;
  multiDestination: number;
  historyDays: number;
}> = {
  FREE: {
    maxConnections: 2,
    transfersPerMonth: 3,
    maxTracksPerTransfer: 200,
    scheduledSyncs: 0,
    multiDestination: 0,
    historyDays: 7,
  },
  PRO: {
    maxConnections: 5,
    transfersPerMonth: Infinity,
    maxTracksPerTransfer: 5000,
    scheduledSyncs: 3,
    multiDestination: 3,
    historyDays: 90,
  },
  UNLIMITED: {
    maxConnections: Infinity,
    transfersPerMonth: Infinity,
    maxTracksPerTransfer: Infinity,
    scheduledSyncs: Infinity,
    multiDestination: Infinity,
    historyDays: Infinity,
  },
};

export const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  plan: UserPlan,
  createdAt: z.date(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;
```

- [ ] **Step 5: Create packages/types/src/playlist.ts**

```typescript
import { z } from 'zod';
import { PlatformId } from './platform.js';

export const TrackSchema = z.object({
  id: z.string(),
  name: z.string(),
  artists: z.array(z.string()),
  album: z.string().optional(),
  albumArtUrl: z.string().optional(),
  durationMs: z.number().int().optional(),
  isrc: z.string().optional(),
  previewUrl: z.string().optional(),
  platformId: PlatformId.optional(),
  platformTrackId: z.string().optional(),
  releaseYear: z.number().int().optional(),
});
export type Track = z.infer<typeof TrackSchema>;

export const PlaylistSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  platform: PlatformId,
  trackCount: z.number().int(),
  artworkUrl: z.string().optional(),
  isPublic: z.boolean().default(true),
  owner: z.string().optional(),
  externalUrl: z.string().optional(),
});
export type Playlist = z.infer<typeof PlaylistSchema>;

export const TrackQuerySchema = z.object({
  name: z.string(),
  artist: z.string(),
  album: z.string().optional(),
  isrc: z.string().optional(),
  durationMs: z.number().int().optional(),
});
export type TrackQuery = z.infer<typeof TrackQuerySchema>;

export const AlbumQuerySchema = z.object({
  name: z.string(),
  artist: z.string(),
});
export type AlbumQuery = z.infer<typeof AlbumQuerySchema>;

export const AlbumSchema = z.object({
  id: z.string(),
  name: z.string(),
  artist: z.string(),
  artworkUrl: z.string().optional(),
  releaseYear: z.number().int().optional(),
  trackCount: z.number().int().optional(),
});
export type Album = z.infer<typeof AlbumSchema>;

export const TrackSearchResultSchema = z.object({
  track: TrackSchema,
  score: z.number().min(0).max(100),
});
export type TrackSearchResult = z.infer<typeof TrackSearchResultSchema>;
```

- [ ] **Step 6: Create packages/types/src/transfer.ts**

```typescript
import { z } from 'zod';
import { PlatformId } from './platform.js';

export const TransferStatus = z.enum([
  'PENDING',
  'QUEUED',
  'PROCESSING',
  'MATCHING',
  'IMPORTING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);
export type TransferStatus = z.infer<typeof TransferStatus>;

export const TrackMatchStatus = z.enum([
  'MATCHED',
  'NOT_FOUND',
  'PARTIAL_MATCH',
  'SKIPPED',
  'FAILED',
]);
export type TrackMatchStatus = z.infer<typeof TrackMatchStatus>;

export const MatchMethod = z.enum(['ISRC', 'EXACT', 'FUZZY', 'MANUAL']);
export type MatchMethod = z.infer<typeof MatchMethod>;

export const TransferOptionsSchema = z.object({
  createNew: z.boolean().default(true),
  addToExisting: z.boolean().default(false),
  existingPlaylistId: z.string().optional(),
  keepOrder: z.boolean().default(true),
  makePublic: z.boolean().default(true),
  copyDescription: z.boolean().default(true),
  skipDuplicates: z.boolean().default(true),
  confidenceThreshold: z.number().min(0).max(100).default(70),
  transferLiked: z.boolean().default(false),
});
export type TransferOptions = z.infer<typeof TransferOptionsSchema>;

export const CreateTransferSchema = z.object({
  sourcePlatform: PlatformId,
  destinationPlatform: PlatformId,
  sourcePlaylistId: z.string(),
  sourcePlaylistName: z.string(),
  options: TransferOptionsSchema,
});
export type CreateTransfer = z.infer<typeof CreateTransferSchema>;

export const TransferProgressSchema = z.object({
  transferId: z.string(),
  status: TransferStatus,
  totalTracks: z.number().int(),
  processedTracks: z.number().int(),
  matchedTracks: z.number().int(),
  failedTracks: z.number().int(),
  currentTrack: z.string().optional(),
  matchRate: z.number().min(0).max(100),
  phase: z.enum(['FETCHING', 'MATCHING', 'IMPORTING', 'DONE']),
});
export type TransferProgress = z.infer<typeof TransferProgressSchema>;

export const TransferTrackResultSchema = z.object({
  sourceTrackName: z.string(),
  sourceArtist: z.string(),
  destinationTrackName: z.string().optional(),
  destinationArtist: z.string().optional(),
  status: TrackMatchStatus,
  confidenceScore: z.number().min(0).max(100),
  matchMethod: MatchMethod.optional(),
});
export type TransferTrackResult = z.infer<typeof TransferTrackResultSchema>;
```

- [ ] **Step 7: Create packages/types/src/auth.ts**

```typescript
import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(100),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const AuthResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    plan: z.string(),
  }),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
```

- [ ] **Step 8: Create packages/types/src/index.ts**

```typescript
export * from './platform.js';
export * from './user.js';
export * from './playlist.js';
export * from './transfer.js';
export * from './auth.js';
```

- [ ] **Step 9: Install and commit**

Run:
```bash
pnpm install
pnpm --filter @tunemymusic/types build
git add packages/types/
git commit -m "feat: add shared types package with Zod schemas"
```

---

### Task 4: packages/core — Base adapter interface + matching utilities

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/src/adapters/base.ts`
- Create: `packages/core/src/matching/normalizer.ts`
- Create: `packages/core/src/matching/fuzzy-matcher.ts`
- Create: `packages/core/src/matching/confidence-scorer.ts`
- Create: `packages/core/src/matching/track-matcher.ts`
- Create: `packages/core/src/transfer/transfer-state.ts`
- Test: `packages/core/tests/normalizer.test.ts`
- Test: `packages/core/tests/fuzzy-matcher.test.ts`
- Test: `packages/core/tests/confidence-scorer.test.ts`
- Test: `packages/core/tests/track-matcher.test.ts`
- Test: `packages/core/tests/transfer-state.test.ts`

- [ ] **Step 1: Create packages/core/package.json**

```json
{
  "name": "@tunemymusic/core",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@tunemymusic/types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create packages/core/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/core/src/adapters/base.ts**

```typescript
import type {
  PlatformId,
  OAuthTokens,
  Playlist,
  Track,
  TrackQuery,
  TrackSearchResult,
  AlbumQuery,
  Album,
} from '@tunemymusic/types';

export interface PlatformUserProfile {
  platformUserId: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
}

export interface MusicPlatformAdapter {
  readonly platformId: PlatformId;
  readonly displayName: string;
  readonly supportsWrite: boolean;

  // Auth
  getAuthUrl(state: string, redirectUri: string): string;
  exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens>;
  refreshTokens(refreshToken: string): Promise<OAuthTokens>;

  // User
  getUserProfile(accessToken: string): Promise<PlatformUserProfile>;

  // Playlists
  getUserPlaylists(accessToken: string): Promise<Playlist[]>;
  getPlaylistTracks(accessToken: string, playlistId: string): Promise<Track[]>;

  // Write
  createPlaylist(
    accessToken: string,
    name: string,
    description?: string,
    isPublic?: boolean,
  ): Promise<Playlist>;
  addTracksToPlaylist(
    accessToken: string,
    playlistId: string,
    trackIds: string[],
  ): Promise<void>;

  // Search
  searchTrack(accessToken: string, query: TrackQuery): Promise<TrackSearchResult[]>;
  searchAlbum(accessToken: string, query: AlbumQuery): Promise<Album[]>;

  // Liked songs
  getLikedSongs(accessToken: string, limit?: number): Promise<Track[]>;
  likeTrack(accessToken: string, trackId: string): Promise<void>;
}

export abstract class BasePlatformAdapter implements MusicPlatformAdapter {
  abstract readonly platformId: PlatformId;
  abstract readonly displayName: string;
  readonly supportsWrite: boolean = true;

  abstract getAuthUrl(state: string, redirectUri: string): string;
  abstract exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens>;
  abstract refreshTokens(refreshToken: string): Promise<OAuthTokens>;
  abstract getUserProfile(accessToken: string): Promise<PlatformUserProfile>;
  abstract getUserPlaylists(accessToken: string): Promise<Playlist[]>;
  abstract getPlaylistTracks(accessToken: string, playlistId: string): Promise<Track[]>;
  abstract createPlaylist(
    accessToken: string,
    name: string,
    description?: string,
    isPublic?: boolean,
  ): Promise<Playlist>;
  abstract addTracksToPlaylist(
    accessToken: string,
    playlistId: string,
    trackIds: string[],
  ): Promise<void>;
  abstract searchTrack(accessToken: string, query: TrackQuery): Promise<TrackSearchResult[]>;
  abstract searchAlbum(accessToken: string, query: AlbumQuery): Promise<Album[]>;
  abstract getLikedSongs(accessToken: string, limit?: number): Promise<Track[]>;
  abstract likeTrack(accessToken: string, trackId: string): Promise<void>;
}
```

- [ ] **Step 4: Write failing tests for normalizer**

Create `packages/core/tests/normalizer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeTrackName, normalizeArtistName } from '../src/matching/normalizer.js';

describe('normalizeTrackName', () => {
  it('lowercases the name', () => {
    expect(normalizeTrackName('Bohemian Rhapsody')).toBe('bohemian rhapsody');
  });

  it('removes feat. parenthetical', () => {
    expect(normalizeTrackName('Song (feat. Artist)')).toBe('song');
  });

  it('removes ft. parenthetical', () => {
    expect(normalizeTrackName('Song (ft. Artist)')).toBe('song');
  });

  it('removes [Remastered] brackets', () => {
    expect(normalizeTrackName('Song [Remastered 2011]')).toBe('song');
  });

  it('removes (Live) parenthetical', () => {
    expect(normalizeTrackName('Song (Live)')).toBe('song');
  });

  it('removes (Deluxe Edition)', () => {
    expect(normalizeTrackName('Song (Deluxe Edition)')).toBe('song');
  });

  it('removes extra whitespace', () => {
    expect(normalizeTrackName('  Song   Name  ')).toBe('song name');
  });

  it('removes punctuation except spaces', () => {
    expect(normalizeTrackName("Don't Stop Me Now!")).toBe('dont stop me now');
  });

  it('handles combined cases', () => {
    expect(normalizeTrackName('Song Title (feat. X) [Remastered 2020]')).toBe('song title');
  });
});

describe('normalizeArtistName', () => {
  it('lowercases the name', () => {
    expect(normalizeArtistName('The Beatles')).toBe('beatles');
  });

  it('removes leading "The"', () => {
    expect(normalizeArtistName('The Rolling Stones')).toBe('rolling stones');
  });

  it('removes punctuation', () => {
    expect(normalizeArtistName('AC/DC')).toBe('acdc');
  });

  it('trims whitespace', () => {
    expect(normalizeArtistName('  Queen  ')).toBe('queen');
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run:
```bash
pnpm install
cd /c/Users/Comec/TuneMyMusic && pnpm --filter @tunemymusic/core test
```
Expected: FAIL — module not found

- [ ] **Step 6: Implement normalizer**

Create `packages/core/src/matching/normalizer.ts`:

```typescript
const BRACKET_PATTERNS = [
  /\s*\(feat\.?\s+[^)]*\)/gi,
  /\s*\(ft\.?\s+[^)]*\)/gi,
  /\s*\(with\s+[^)]*\)/gi,
  /\s*\[remastered[^\]]*\]/gi,
  /\s*\(remastered[^)]*\)/gi,
  /\s*\(live[^)]*\)/gi,
  /\s*\[live[^\]]*\]/gi,
  /\s*\(deluxe[^)]*\)/gi,
  /\s*\(bonus[^)]*\)/gi,
  /\s*\(radio edit\)/gi,
  /\s*\(explicit\)/gi,
  /\s*\(clean\)/gi,
  /\s*-\s*remastered\s*\d*/gi,
];

export function normalizeTrackName(name: string): string {
  let result = name.toLowerCase();
  for (const pattern of BRACKET_PATTERNS) {
    result = result.replace(pattern, '');
  }
  result = result.replace(/[^\w\s]/g, '');
  result = result.replace(/\s+/g, ' ').trim();
  return result;
}

export function normalizeArtistName(name: string): string {
  let result = name.toLowerCase().trim();
  result = result.replace(/^the\s+/i, '');
  result = result.replace(/[^\w\s]/g, '');
  result = result.replace(/\s+/g, ' ').trim();
  return result;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run:
```bash
cd /c/Users/Comec/TuneMyMusic && pnpm --filter @tunemymusic/core test
```
Expected: All normalizer tests PASS.

- [ ] **Step 8: Write failing tests for fuzzy-matcher**

Create `packages/core/tests/fuzzy-matcher.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { jaroWinkler, levenshteinDistance, fuzzyMatch } from '../src/matching/fuzzy-matcher.js';

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0);
  });

  it('returns length for empty vs non-empty', () => {
    expect(levenshteinDistance('', 'hello')).toBe(5);
  });

  it('computes correct distance', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
  });
});

describe('jaroWinkler', () => {
  it('returns 1 for identical strings', () => {
    expect(jaroWinkler('hello', 'hello')).toBe(1);
  });

  it('returns 0 for completely different strings', () => {
    expect(jaroWinkler('', 'hello')).toBe(0);
  });

  it('returns high score for similar strings', () => {
    expect(jaroWinkler('bohemian rhapsody', 'bohemian rapsody')).toBeGreaterThan(0.95);
  });

  it('returns lower score for dissimilar strings', () => {
    expect(jaroWinkler('hello', 'world')).toBeLessThan(0.5);
  });
});

describe('fuzzyMatch', () => {
  it('returns 100 for exact match', () => {
    expect(fuzzyMatch('bohemian rhapsody', 'bohemian rhapsody')).toBe(100);
  });

  it('returns high score for close match', () => {
    const score = fuzzyMatch('bohemian rhapsody', 'bohemian rapsody');
    expect(score).toBeGreaterThan(90);
  });

  it('returns low score for poor match', () => {
    const score = fuzzyMatch('bohemian rhapsody', 'stairway to heaven');
    expect(score).toBeLessThan(50);
  });
});
```

- [ ] **Step 9: Run tests to verify they fail**

Run:
```bash
cd /c/Users/Comec/TuneMyMusic && pnpm --filter @tunemymusic/core test
```
Expected: Fuzzy matcher tests FAIL.

- [ ] **Step 10: Implement fuzzy-matcher**

Create `packages/core/src/matching/fuzzy-matcher.ts`:

```typescript
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

export function jaroWinkler(s1: string, s2: string): number {
  if (s1.length === 0 && s2.length === 0) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const matchWindow = Math.max(Math.floor(Math.max(s1.length, s2.length) / 2) - 1, 0);

  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;

  // Winkler prefix bonus
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

export function fuzzyMatch(a: string, b: string): number {
  if (a === b) return 100;
  if (a.length === 0 || b.length === 0) return 0;

  const jw = jaroWinkler(a, b);
  const maxLen = Math.max(a.length, b.length);
  const lev = levenshteinDistance(a, b);
  const levScore = 1 - lev / maxLen;

  // Weighted average: Jaro-Winkler 60%, Levenshtein 40%
  const combined = jw * 0.6 + levScore * 0.4;
  return Math.round(combined * 100);
}
```

- [ ] **Step 11: Run tests to verify they pass**

Run:
```bash
cd /c/Users/Comec/TuneMyMusic && pnpm --filter @tunemymusic/core test
```
Expected: All fuzzy matcher tests PASS.

- [ ] **Step 12: Write failing tests for confidence-scorer**

Create `packages/core/tests/confidence-scorer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { scoreMatch } from '../src/matching/confidence-scorer.js';
import type { Track } from '@tunemymusic/types';

const makeTrack = (overrides: Partial<Track> = {}): Track => ({
  id: '1',
  name: 'Bohemian Rhapsody',
  artists: ['Queen'],
  album: 'A Night at the Opera',
  durationMs: 354000,
  isrc: 'GBAYE0601498',
  ...overrides,
});

describe('scoreMatch', () => {
  it('returns 100 for ISRC match', () => {
    const source = makeTrack();
    const candidate = makeTrack({ id: '2', isrc: 'GBAYE0601498' });
    const result = scoreMatch(source, candidate);
    expect(result.score).toBe(100);
    expect(result.method).toBe('ISRC');
  });

  it('returns high score for exact name + artist match', () => {
    const source = makeTrack({ isrc: undefined });
    const candidate = makeTrack({ id: '2', isrc: undefined });
    const result = scoreMatch(source, candidate);
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.method).toBe('EXACT');
  });

  it('boosts score when duration matches within 3s', () => {
    const source = makeTrack({ isrc: undefined, durationMs: 354000 });
    const noDuration = makeTrack({ id: '2', isrc: undefined, durationMs: undefined });
    const withDuration = makeTrack({ id: '3', isrc: undefined, durationMs: 355000 });
    const scoreNone = scoreMatch(source, noDuration);
    const scoreClose = scoreMatch(source, withDuration);
    expect(scoreClose.score).toBeGreaterThanOrEqual(scoreNone.score);
  });

  it('returns fuzzy score for similar but not exact match', () => {
    const source = makeTrack({ isrc: undefined, name: 'Bohemian Rhapsody' });
    const candidate = makeTrack({
      id: '2',
      isrc: undefined,
      name: 'Bohemian Rapsody',
      artists: ['Queen'],
    });
    const result = scoreMatch(source, candidate);
    expect(result.score).toBeGreaterThan(50);
    expect(result.score).toBeLessThan(85);
    expect(result.method).toBe('FUZZY');
  });

  it('returns 0 for completely different tracks', () => {
    const source = makeTrack({ isrc: undefined });
    const candidate = makeTrack({
      id: '2',
      isrc: undefined,
      name: 'Completely Different Song',
      artists: ['Unknown Artist'],
      album: 'Unknown Album',
    });
    const result = scoreMatch(source, candidate);
    expect(result.score).toBeLessThan(50);
  });
});
```

- [ ] **Step 13: Run tests to verify they fail**

Run:
```bash
cd /c/Users/Comec/TuneMyMusic && pnpm --filter @tunemymusic/core test
```
Expected: confidence-scorer tests FAIL.

- [ ] **Step 14: Implement confidence-scorer**

Create `packages/core/src/matching/confidence-scorer.ts`:

```typescript
import type { Track, MatchMethod } from '@tunemymusic/types';
import { normalizeTrackName, normalizeArtistName } from './normalizer.js';
import { fuzzyMatch } from './fuzzy-matcher.js';

export interface MatchResult {
  score: number;
  method: MatchMethod;
}

export function scoreMatch(source: Track, candidate: Track): MatchResult {
  // 1. ISRC match — perfect
  if (source.isrc && candidate.isrc && source.isrc === candidate.isrc) {
    return { score: 100, method: 'ISRC' };
  }

  const srcName = normalizeTrackName(source.name);
  const candName = normalizeTrackName(candidate.name);
  const srcArtist = normalizeArtistName(source.artists[0] ?? '');
  const candArtist = normalizeArtistName(candidate.artists[0] ?? '');

  const nameScore = fuzzyMatch(srcName, candName);
  const artistScore = fuzzyMatch(srcArtist, candArtist);

  // 2. Exact match — normalized name + artist both very high
  if (nameScore >= 95 && artistScore >= 95) {
    let score = 85 + Math.floor((nameScore + artistScore - 190) / 2);

    // Duration bonus
    if (source.durationMs && candidate.durationMs) {
      const diff = Math.abs(source.durationMs - candidate.durationMs);
      if (diff <= 3000) score = Math.min(99, score + 5);
      else if (diff <= 5000) score = Math.min(99, score + 2);
    }

    // Album bonus
    if (source.album && candidate.album) {
      const albumScore = fuzzyMatch(
        normalizeTrackName(source.album),
        normalizeTrackName(candidate.album),
      );
      if (albumScore >= 90) score = Math.min(99, score + 3);
    }

    return { score: Math.min(99, score), method: 'EXACT' };
  }

  // 3. Fuzzy match
  const combinedScore = Math.round(nameScore * 0.6 + artistScore * 0.4);

  if (combinedScore >= 50) {
    let score = combinedScore;

    // Duration bonus for fuzzy too
    if (source.durationMs && candidate.durationMs) {
      const diff = Math.abs(source.durationMs - candidate.durationMs);
      if (diff <= 5000) score = Math.min(84, score + 3);
    }

    return { score: Math.min(84, score), method: 'FUZZY' };
  }

  // 4. Not a match
  return { score: combinedScore, method: 'FUZZY' };
}
```

- [ ] **Step 15: Run tests to verify they pass**

Run:
```bash
cd /c/Users/Comec/TuneMyMusic && pnpm --filter @tunemymusic/core test
```
Expected: All confidence-scorer tests PASS.

- [ ] **Step 16: Write failing tests for transfer-state**

Create `packages/core/tests/transfer-state.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { TransferStateMachine } from '../src/transfer/transfer-state.js';

describe('TransferStateMachine', () => {
  it('starts in PENDING state', () => {
    const sm = new TransferStateMachine();
    expect(sm.status).toBe('PENDING');
  });

  it('transitions PENDING → QUEUED', () => {
    const sm = new TransferStateMachine();
    sm.transition('QUEUED');
    expect(sm.status).toBe('QUEUED');
  });

  it('transitions QUEUED → PROCESSING → MATCHING → IMPORTING → COMPLETED', () => {
    const sm = new TransferStateMachine();
    sm.transition('QUEUED');
    sm.transition('PROCESSING');
    sm.transition('MATCHING');
    sm.transition('IMPORTING');
    sm.transition('COMPLETED');
    expect(sm.status).toBe('COMPLETED');
  });

  it('allows CANCELLED from any active state', () => {
    const sm = new TransferStateMachine();
    sm.transition('QUEUED');
    sm.transition('PROCESSING');
    sm.transition('CANCELLED');
    expect(sm.status).toBe('CANCELLED');
  });

  it('allows FAILED from any active state', () => {
    const sm = new TransferStateMachine();
    sm.transition('QUEUED');
    sm.transition('FAILED');
    expect(sm.status).toBe('FAILED');
  });

  it('throws on invalid transition', () => {
    const sm = new TransferStateMachine();
    expect(() => sm.transition('COMPLETED')).toThrow();
  });

  it('throws when transitioning from terminal state', () => {
    const sm = new TransferStateMachine();
    sm.transition('QUEUED');
    sm.transition('FAILED');
    expect(() => sm.transition('PROCESSING')).toThrow();
  });
});
```

- [ ] **Step 17: Run tests to verify they fail**

Run:
```bash
cd /c/Users/Comec/TuneMyMusic && pnpm --filter @tunemymusic/core test
```
Expected: transfer-state tests FAIL.

- [ ] **Step 18: Implement transfer-state**

Create `packages/core/src/transfer/transfer-state.ts`:

```typescript
import type { TransferStatus } from '@tunemymusic/types';

const VALID_TRANSITIONS: Record<TransferStatus, TransferStatus[]> = {
  PENDING: ['QUEUED', 'CANCELLED', 'FAILED'],
  QUEUED: ['PROCESSING', 'CANCELLED', 'FAILED'],
  PROCESSING: ['MATCHING', 'CANCELLED', 'FAILED'],
  MATCHING: ['IMPORTING', 'CANCELLED', 'FAILED'],
  IMPORTING: ['COMPLETED', 'CANCELLED', 'FAILED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export class TransferStateMachine {
  private _status: TransferStatus = 'PENDING';

  get status(): TransferStatus {
    return this._status;
  }

  transition(to: TransferStatus): void {
    const allowed = VALID_TRANSITIONS[this._status];
    if (!allowed.includes(to)) {
      throw new Error(`Invalid transition: ${this._status} → ${to}`);
    }
    this._status = to;
  }

  get isTerminal(): boolean {
    return VALID_TRANSITIONS[this._status].length === 0;
  }
}
```

- [ ] **Step 19: Write failing test for track-matcher**

Create `packages/core/tests/track-matcher.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { TrackMatcher } from '../src/matching/track-matcher.js';
import type { Track, TrackSearchResult } from '@tunemymusic/types';

const makeTrack = (overrides: Partial<Track> = {}): Track => ({
  id: '1',
  name: 'Bohemian Rhapsody',
  artists: ['Queen'],
  album: 'A Night at the Opera',
  durationMs: 354000,
  isrc: 'GBAYE0601498',
  ...overrides,
});

describe('TrackMatcher', () => {
  it('finds best match from candidates', () => {
    const matcher = new TrackMatcher({ confidenceThreshold: 70 });
    const source = makeTrack();
    const candidates: TrackSearchResult[] = [
      { track: makeTrack({ id: '2', isrc: 'GBAYE0601498' }), score: 0 },
      { track: makeTrack({ id: '3', isrc: undefined, name: 'Something Else' }), score: 0 },
    ];

    const result = matcher.findBestMatch(source, candidates);
    expect(result).not.toBeNull();
    expect(result!.track.id).toBe('2');
    expect(result!.score).toBe(100);
    expect(result!.method).toBe('ISRC');
  });

  it('returns null when no candidate meets threshold', () => {
    const matcher = new TrackMatcher({ confidenceThreshold: 90 });
    const source = makeTrack({ isrc: undefined });
    const candidates: TrackSearchResult[] = [
      {
        track: makeTrack({ id: '2', isrc: undefined, name: 'Totally Different', artists: ['Nobody'] }),
        score: 0,
      },
    ];

    const result = matcher.findBestMatch(source, candidates);
    expect(result).toBeNull();
  });

  it('prefers higher confidence matches', () => {
    const matcher = new TrackMatcher({ confidenceThreshold: 50 });
    const source = makeTrack({ isrc: undefined });
    const candidates: TrackSearchResult[] = [
      {
        track: makeTrack({ id: '2', isrc: undefined, name: 'Bohemian Rapsody', artists: ['Queen'] }),
        score: 0,
      },
      {
        track: makeTrack({ id: '3', isrc: undefined, name: 'Bohemian Rhapsody', artists: ['Queen'] }),
        score: 0,
      },
    ];

    const result = matcher.findBestMatch(source, candidates);
    expect(result).not.toBeNull();
    expect(result!.track.id).toBe('3');
  });
});
```

- [ ] **Step 20: Run tests to verify they fail**

Run:
```bash
cd /c/Users/Comec/TuneMyMusic && pnpm --filter @tunemymusic/core test
```
Expected: track-matcher tests FAIL.

- [ ] **Step 21: Implement track-matcher**

Create `packages/core/src/matching/track-matcher.ts`:

```typescript
import type { Track, TrackSearchResult, MatchMethod } from '@tunemymusic/types';
import { scoreMatch } from './confidence-scorer.js';

export interface TrackMatchResult {
  track: Track;
  score: number;
  method: MatchMethod;
}

export interface TrackMatcherOptions {
  confidenceThreshold: number;
}

export class TrackMatcher {
  private readonly threshold: number;

  constructor(options: TrackMatcherOptions) {
    this.threshold = options.confidenceThreshold;
  }

  findBestMatch(source: Track, candidates: TrackSearchResult[]): TrackMatchResult | null {
    let bestMatch: TrackMatchResult | null = null;

    for (const candidate of candidates) {
      const { score, method } = scoreMatch(source, candidate.track);

      if (score >= this.threshold && (bestMatch === null || score > bestMatch.score)) {
        bestMatch = { track: candidate.track, score, method };
      }
    }

    return bestMatch;
  }
}
```

- [ ] **Step 22: Run tests to verify they pass**

Run:
```bash
cd /c/Users/Comec/TuneMyMusic && pnpm --filter @tunemymusic/core test
```
Expected: All tests PASS.

- [ ] **Step 23: Create packages/core/src/index.ts**

```typescript
export * from './adapters/base.js';
export * from './matching/normalizer.js';
export * from './matching/fuzzy-matcher.js';
export * from './matching/confidence-scorer.js';
export * from './matching/track-matcher.js';
export * from './transfer/transfer-state.js';
```

- [ ] **Step 24: Commit**

Run:
```bash
git add packages/core/
git commit -m "feat: add core package with adapter interface, matching engine, and transfer state machine"
```

---

### Task 5: Prisma schema + server scaffold

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/prisma/schema.prisma`
- Create: `server/src/config.ts`
- Create: `server/src/prisma.ts`
- Create: `server/src/app.ts`
- Create: `server/src/index.ts`

- [ ] **Step 1: Create server/package.json**

```json
{
  "name": "server",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@tunemymusic/types": "workspace:*",
    "@tunemymusic/core": "workspace:*",
    "@prisma/client": "^6.2.0",
    "fastify": "^5.2.0",
    "@fastify/cors": "^11.0.0",
    "@fastify/cookie": "^11.0.0",
    "bullmq": "^5.34.0",
    "ioredis": "^5.4.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "zod": "^3.24.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "tsx": "^4.19.0",
    "vitest": "^3.0.0",
    "prisma": "^6.2.0",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/bcryptjs": "^2.4.6"
  }
}
```

- [ ] **Step 2: Create server/tsconfig.json**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "ESNext",
    "moduleResolution": "bundler"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create server/prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserPlan {
  FREE
  PRO
  UNLIMITED
}

enum Platform {
  SPOTIFY
  APPLE_MUSIC
  YOUTUBE_MUSIC
  AMAZON_MUSIC
  TIDAL
  DEEZER
  SOUNDCLOUD
  PANDORA
  QOBUZ
  NAPSTER
}

enum TransferStatus {
  PENDING
  QUEUED
  PROCESSING
  MATCHING
  IMPORTING
  COMPLETED
  FAILED
  CANCELLED
}

enum TrackMatchStatus {
  MATCHED
  NOT_FOUND
  PARTIAL_MATCH
  SKIPPED
  FAILED
}

enum MatchMethod {
  ISRC
  EXACT
  FUZZY
  MANUAL
}

model User {
  id               String   @id @default(cuid())
  email            String   @unique
  passwordHash     String
  name             String?
  avatarUrl        String?
  plan             UserPlan @default(FREE)
  stripeCustomerId String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  connections      PlatformConnection[]
  transfers        Transfer[]
  savedPlaylists   SavedPlaylist[]
  schedules        TransferSchedule[]
  notifications    Notification[]
}

model PlatformConnection {
  id               String   @id @default(cuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  platform         Platform
  accessToken      String
  refreshToken     String?
  expiresAt        DateTime?
  platformUserId   String?
  platformUsername String?
  isActive         Boolean  @default(true)
  connectedAt      DateTime @default(now())

  @@unique([userId, platform, platformUserId])
  @@index([userId])
}

model Transfer {
  id                      String         @id @default(cuid())
  userId                  String
  user                    User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  sourcePlatform          Platform
  destinationPlatform     Platform
  sourcePlaylistId        String
  sourcePlaylistName      String
  destinationPlaylistId   String?
  destinationPlaylistName String?
  status                  TransferStatus @default(PENDING)
  totalTracks             Int            @default(0)
  matchedTracks           Int            @default(0)
  failedTracks            Int            @default(0)
  skippedTracks           Int            @default(0)
  matchRate               Float          @default(0)
  options                 Json           @default("{}")
  startedAt               DateTime?
  completedAt             DateTime?
  createdAt               DateTime       @default(now())
  errorMessage            String?
  jobId                   String?

  tracks                  TransferTrack[]

  @@index([userId])
  @@index([status])
}

model TransferTrack {
  id                   String           @id @default(cuid())
  transferId           String
  transfer             Transfer         @relation(fields: [transferId], references: [id], onDelete: Cascade)
  sourceTrackId        String?
  sourceTrackName      String
  sourceArtist         String
  sourceAlbum          String?
  sourceDuration       Int?
  sourceIsrc           String?
  destinationTrackId   String?
  destinationTrackName String?
  destinationArtist    String?
  status               TrackMatchStatus @default(FAILED)
  confidenceScore      Float            @default(0)
  matchMethod          MatchMethod?
  manuallyReviewed     Boolean          @default(false)
  manuallySelectedId   String?

  @@index([transferId])
}

model SavedPlaylist {
  id                 String   @id @default(cuid())
  userId             String
  user               User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name               String
  description        String?
  platform           Platform
  platformPlaylistId String
  trackCount         Int      @default(0)
  artworkUrl         String?
  snapshot           Json?
  lastSyncedAt       DateTime?

  schedules          TransferSchedule[]

  @@index([userId])
}

model TransferSchedule {
  id                    String        @id @default(cuid())
  userId                String
  user                  User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  savedPlaylistId       String
  savedPlaylist         SavedPlaylist @relation(fields: [savedPlaylistId], references: [id], onDelete: Cascade)
  destinationPlatform   Platform
  destinationPlaylistId String?
  cronExpression        String
  timezone              String        @default("UTC")
  isActive              Boolean       @default(true)
  lastRanAt             DateTime?
  nextRunAt             DateTime?

  @@index([userId])
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      String
  title     String
  body      String
  data      Json?
  read      Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([userId, read])
}
```

- [ ] **Step 4: Create server/src/config.ts**

```typescript
import 'dotenv/config';

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  port: parseInt(optional('PORT', '3001'), 10),
  host: optional('HOST', '0.0.0.0'),
  databaseUrl: required('DATABASE_URL'),
  redisUrl: optional('REDIS_URL', 'redis://localhost:6379'),
  jwtSecret: required('JWT_SECRET'),
  encryptionKey: required('ENCRYPTION_KEY'),
  corsOrigin: optional('CORS_ORIGIN', 'http://localhost:3000'),
} as const;
```

- [ ] **Step 5: Create server/src/prisma.ts**

```typescript
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
```

- [ ] **Step 6: Create server/src/app.ts**

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { authRoutes } from './routes/auth.js';
import { connectionRoutes } from './routes/connections.js';

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: config.corsOrigin, credentials: true });

  app.get('/api/health', async () => ({ status: 'ok' }));

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(connectionRoutes, { prefix: '/api/connections' });

  return app;
}
```

- [ ] **Step 7: Create server/src/index.ts**

```typescript
import { buildApp } from './app.js';
import { config } from './config.js';

async function main() {
  const app = await buildApp();

  await app.listen({ port: config.port, host: config.host });
  console.log(`Server running on http://${config.host}:${config.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 8: Install dependencies and generate Prisma client**

Run:
```bash
pnpm install
cp .env.example .env
pnpm --filter server prisma generate
pnpm --filter server prisma db push
```

- [ ] **Step 9: Commit**

Run:
```bash
git add server/package.json server/tsconfig.json server/prisma/ server/src/config.ts server/src/prisma.ts server/src/app.ts server/src/index.ts
git commit -m "feat: add server scaffold with Fastify, Prisma schema, and config"
```

---

### Task 6: Server utilities — encryption + password hashing

**Files:**
- Create: `server/src/utils/encryption.ts`
- Create: `server/src/utils/password.ts`
- Test: `server/tests/encryption.test.ts`

- [ ] **Step 1: Write failing tests for encryption**

Create `server/tests/encryption.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../src/utils/encryption.js';

describe('encryption', () => {
  const testKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  it('encrypts and decrypts a string', () => {
    const plaintext = 'my-secret-oauth-token';
    const encrypted = encrypt(plaintext, testKey);
    expect(encrypted).not.toBe(plaintext);
    const decrypted = decrypt(encrypted, testKey);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertext each time (random IV)', () => {
    const plaintext = 'same-input';
    const a = encrypt(plaintext, testKey);
    const b = encrypt(plaintext, testKey);
    expect(a).not.toBe(b);
  });

  it('throws on tampered ciphertext', () => {
    const encrypted = encrypt('test', testKey);
    const tampered = encrypted.slice(0, -4) + 'XXXX';
    expect(() => decrypt(tampered, testKey)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /c/Users/Comec/TuneMyMusic && pnpm --filter server test
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement encryption utility**

Create `server/src/utils/encryption.ts`:

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

export function encrypt(plaintext: string, hexKey: string): string {
  const key = Buffer.from(hexKey, 'hex');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all base64)
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(
    ':',
  );
}

export function decrypt(ciphertext: string, hexKey: string): string {
  const key = Buffer.from(hexKey, 'hex');
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid ciphertext format');

  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const encrypted = Buffer.from(parts[2], 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
```

- [ ] **Step 4: Implement password utility**

Create `server/src/utils/password.ts`:

```typescript
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
cd /c/Users/Comec/TuneMyMusic && pnpm --filter server test
```
Expected: All encryption tests PASS.

- [ ] **Step 6: Commit**

Run:
```bash
git add server/src/utils/ server/tests/
git commit -m "feat: add AES-256-GCM encryption and bcrypt password utilities"
```

---

### Task 7: Auth routes + JWT middleware

**Files:**
- Create: `server/src/plugins/auth.ts`
- Create: `server/src/middleware/require-auth.ts`
- Create: `server/src/routes/auth.ts`
- Create: `server/src/routes/connections.ts`
- Test: `server/tests/auth.test.ts`

- [ ] **Step 1: Create JWT auth plugin**

Create `server/src/plugins/auth.ts`:

```typescript
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface JwtPayload {
  userId: string;
  email: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
}
```

- [ ] **Step 2: Create require-auth middleware**

Create `server/src/middleware/require-auth.ts`:

```typescript
import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from '../plugins/auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    userEmail: string;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    request.userId = payload.userId;
    request.userEmail = payload.email;
  } catch {
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }
}
```

- [ ] **Step 3: Create auth routes**

Create `server/src/routes/auth.ts`:

```typescript
import type { FastifyInstance } from 'fastify';
import { prisma } from '../prisma.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signToken } from '../plugins/auth.js';
import { requireAuth } from '../middleware/require-auth.js';
import { RegisterSchema, LoginSchema } from '@tunemymusic/types';

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (request, reply) => {
    const parsed = RegisterSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    const { email, password, name } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, name },
    });

    const token = signToken({ userId: user.id, email: user.email });

    return reply.status(201).send({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        plan: user.plan,
      },
    });
  });

  app.post('/login', async (request, reply) => {
    const parsed = LoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const token = signToken({ userId: user.id, email: user.email });

    return reply.send({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        plan: user.plan,
      },
    });
  });

  app.get('/me', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        plan: true,
        createdAt: true,
      },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send({ user });
  });

  app.post('/logout', async (_request, reply) => {
    // JWT is stateless — client discards token
    return reply.send({ message: 'Logged out' });
  });
}
```

- [ ] **Step 4: Create connections route stub**

Create `server/src/routes/connections.ts`:

```typescript
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/require-auth.js';
import { prisma } from '../prisma.js';

export async function connectionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/', async (request, reply) => {
    const connections = await prisma.platformConnection.findMany({
      where: { userId: request.userId, isActive: true },
      select: {
        id: true,
        platform: true,
        platformUserId: true,
        platformUsername: true,
        connectedAt: true,
        isActive: true,
      },
    });

    return reply.send({ connections });
  });
}
```

- [ ] **Step 5: Write auth integration test**

Create `server/tests/setup.ts`:

```typescript
import { beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://tunemymusic:tunemymusic@localhost:5432/tunemymusic';
  process.env.JWT_SECRET = 'test-secret-for-testing-only';
  process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  process.env.REDIS_URL = 'redis://localhost:6379';

  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

export function getApp() {
  return app;
}
```

Create `server/tests/auth.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { getApp } from './setup.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(() => {
  app = getApp();
});

describe('POST /api/auth/register', () => {
  const uniqueEmail = `test-${Date.now()}@example.com`;

  it('registers a new user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: uniqueEmail, password: 'password123', name: 'Test User' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.token).toBeDefined();
    expect(body.user.email).toBe(uniqueEmail);
    expect(body.user.plan).toBe('FREE');
  });

  it('rejects duplicate email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: uniqueEmail, password: 'password123', name: 'Dupe' },
    });

    expect(res.statusCode).toBe(409);
  });

  it('validates input', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'bad-email', password: '123', name: '' },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  const email = `login-test-${Date.now()}@example.com`;

  beforeAll(async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email, password: 'mypassword', name: 'Login Test' },
    });
  });

  it('logs in with correct credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'mypassword' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().token).toBeDefined();
  });

  it('rejects wrong password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'wrongpassword' },
    });

    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns user with valid token', async () => {
    const email = `me-test-${Date.now()}@example.com`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email, password: 'password123', name: 'Me Test' },
    });
    const { token } = regRes.json();

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().user.email).toBe(email);
  });

  it('rejects without token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 6: Run tests**

Run:
```bash
cd /c/Users/Comec/TuneMyMusic && pnpm --filter server test
```
Expected: All auth tests PASS (requires Docker Postgres running).

- [ ] **Step 7: Commit**

Run:
```bash
git add server/src/plugins/ server/src/middleware/ server/src/routes/ server/tests/
git commit -m "feat: add JWT auth routes (register, login, me) with tests"
```

---

### Task 8: Placeholder apps + final workspace validation

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/tsconfig.json`
- Create: `packages/api-client/package.json`
- Create: `packages/api-client/tsconfig.json`
- Create: `packages/api-client/src/index.ts`

- [ ] **Step 1: Create minimal web app placeholder**

Create `apps/web/package.json`:

```json
{
  "name": "web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "echo 'Web app placeholder — Next.js setup in Phase 4'",
    "build": "echo 'Web app placeholder'",
    "lint": "echo 'Web app placeholder'"
  }
}
```

Create `apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

- [ ] **Step 2: Create minimal mobile app placeholder**

Create `apps/mobile/package.json`:

```json
{
  "name": "mobile",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "echo 'Mobile app placeholder — Expo setup in Phase 5'",
    "build": "echo 'Mobile app placeholder'",
    "lint": "echo 'Mobile app placeholder'"
  }
}
```

Create `apps/mobile/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

- [ ] **Step 3: Create api-client package placeholder**

Create `packages/api-client/package.json`:

```json
{
  "name": "@tunemymusic/api-client",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@tunemymusic/types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

Create `packages/api-client/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

Create `packages/api-client/src/index.ts`:

```typescript
// API client — full implementation in Phase 4
export const API_VERSION = '0.0.1';
```

- [ ] **Step 4: Install all workspace packages and validate**

Run:
```bash
pnpm install
pnpm run build
```
Expected: All packages build successfully.

- [ ] **Step 5: Run all tests**

Run:
```bash
pnpm run test
```
Expected: All tests pass across core and server packages.

- [ ] **Step 6: Commit**

Run:
```bash
git add apps/ packages/api-client/
git commit -m "chore: add placeholder apps and api-client package, validate full workspace"
```

---

## Summary

After completing all 8 tasks, you will have:

- **Monorepo**: pnpm workspaces + Turborepo with shared TypeScript config
- **Infrastructure**: Docker Compose with Postgres 16 + Redis 7
- **Database**: Full Prisma schema with all models (User, PlatformConnection, Transfer, TransferTrack, SavedPlaylist, TransferSchedule, Notification)
- **Server**: Fastify with JWT auth (register/login/me), encrypted token storage, health check
- **Shared types**: Complete Zod schemas for platforms, users, playlists, tracks, transfers, auth
- **Core package**: MusicPlatformAdapter interface, track name normalizer, fuzzy matcher (Jaro-Winkler + Levenshtein), confidence scorer, track matcher, transfer state machine
- **Tests**: Unit tests for normalizer, fuzzy matcher, confidence scorer, track matcher, transfer state machine, encryption, and auth routes
- **Placeholders**: Web app, mobile app, and api-client ready for Phase 2+
