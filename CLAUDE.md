# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **proof-of-concept offline-first, real-time web framework** with a demo app managing users and groups. It consists of two parts:

- `backend/` — Node.js + Express + Socket.IO server with PostgreSQL via Prisma
- `frontend/` — Vue 3 + Vuetify SPA using Dexie (IndexedDB) as local cache

The files `backend/src/server.mjs` and `frontend/src/client.mts` are the **local development versions** of the npm packages `@jcbuisson/express-x` and `@jcbuisson/express-x-client` respectively. The `app.js` and `client-app.js` switch between the local and npm versions via import comments.

## Commands

### Backend
```bash
cd backend
npm run dev          # Start with hot-reload (node --watch --experimental-strip-types)
```
Requires `backend/.env` with `DATABASE_URL` (PostgreSQL connection string).

### Frontend
```bash
cd frontend
npm run dev          # Vite dev server on port 8080
npm run build        # Production build
npm run preview      # Preview production build
```
Vite proxies `/offline-socket-io/` WebSocket traffic to `http://localhost:3000`.

### Database (Prisma)
```bash
cd backend
npx prisma migrate dev      # Apply schema changes
npx prisma generate         # Regenerate client after schema changes
```
Generated Prisma client is output to `backend/generated/prisma/` (gitignored).

## Architecture

### Core Sync Pattern

The framework implements **optimistic updates with server reconciliation**:

1. All client mutations (create/update/delete) are applied immediately to the local **Dexie IndexedDB cache** (optimistic update), then sent to the server asynchronously.
2. On reconnect, the client calls the `sync.go()` service for each registered `where` query, which reconciles the client cache with the PostgreSQL database using timestamps from the `metadata` table.
3. Real-time updates flow server → client via Socket.IO `service-event` pub/sub.

### Backend (`backend/src/`)

- **`app.js`** — Entry point: creates the `expressX` app, configures plugins, starts HTTP server.
- **`server.mjs`** — The `express-x` library (local dev version). Provides:
  - `expressX(config)` — Creates Express + Socket.IO app with `createService`, `configure`, `joinChannel`, etc.
  - `offlinePlugin(app, modelNames)` — Auto-creates a database service per model with methods: `findUnique`, `findMany`, `createWithMeta`, `updateWithMeta`, `deleteWithMeta`. Also creates the `sync` service.
  - `reloadPlugin` — Preserves socket rooms/data across page reloads via server-side cache.
- **`prisma.js`** — Initializes Prisma client using `@prisma/adapter-pg` (PostgreSQL driver adapter).
- **`channels.js`** — Maps each service to pub/sub channels (currently all broadcast to `'anonymous'`).

### Frontend (`frontend/src/`)

- **`client-app.js`** — Creates the Socket.IO client, configures `reloadPlugin` and `offlinePlugin`, and exports model instances using `app.createOfflineModel()`.
- **`client.mts`** — The `express-x-client` library (local dev version). Provides:
  - `createClient(socket)` — Creates client app with `service()` proxy for RPC calls.
  - `offlinePlugin(app)` — Enriches `app` with `createOfflineModel(modelName, fields)`, which creates a Dexie DB and returns `{ create, update, remove, findByUID, findWhere, getObservable, addSynchroWhere }`.
  - `reloadPlugin` — On reconnect, transfers socket rooms/data from previous socket ID.

### Data Model Conventions

- Every record uses `uid` (UUIDv7) as its primary key — **no auto-incremented IDs**.
- Every record in a business model has a corresponding row in the `metadata` table (`uid`, `created_at`, `updated_at`, `deleted_at`).
- Soft deletes: client marks records with `__deleted__: true` in IndexedDB while offline; the server performs actual deletion on sync.
- Many-to-many relations require an explicit join model (e.g., `user_group_relation`) with its own `uid` and metadata entry.

### Prisma Schema

Models: `metadata`, `user`, `group`, `user_group_relation`. The `metadata` model is **required** by `offlinePlugin` — it must always exist.

