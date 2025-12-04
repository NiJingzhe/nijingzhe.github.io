<!-- Copilot instructions for this repo - concise, actionable -->
# Guidance for AI coding agents

This file contains focused, discoverable knowledge to make an AI agent immediately productive in this repository.

## High-level architecture

**LilDino's personal digital garden** — a vim-mode infinite canvas for organizing Markdown articles, GitHub repos, and drawings with real-time collaboration.

| Layer           | Tech                                | Key Files                                      |
|-----------------|-------------------------------------|------------------------------------------------|
| **Frontend**    | React 18 + TypeScript               | `src/main.tsx` → `src/App.tsx`                 |
| **Canvas/UI**   | HTML5 Canvas + Tailwind CSS 4       | `src/components/Canvas.tsx`, `CanvasItem.tsx`  |
| **Backend**     | Supabase (Postgres + Realtime)      | `src/utils/{db.ts, supabase.ts}`               |
| **Build**       | Vite 6 + TypeScript                 | `vite.config.ts`, `pnpm build` = `tsc && vite` |
| **Deploy**      | GitHub Actions → GitHub Pages       | `.github/workflows/deploy.yml`                 |

### Core data flows

```
┌──────────────────────────────────────────────────┐
│             App.tsx (state hub)                  │
│  items[], drawPaths[], vimMode, selectedId, ... │
└────────────────┬──────────────────────────────┬──┘
                 │                              │
      ┌──────────▼──────────┐      ┌────────────▼──────────┐
      │  db.ts (CRUD)       │      │  realtime/* (subs)    │
      │  saveCard()         │◀────▶│  subscribeCards()     │
      │  saveDrawing()      │      │  subscribeEditLocks() │
      │  deleteCard()       │      │  subscribeCursors()   │
      └──────────┬──────────┘      └────────────┬──────────┘
                 │                              │
                 └──────────┬───────────────────┘
                            ▼
                   ┌────────────────────────┐
                   │ Supabase (Realtime)    │
                   │ tables: cards, drawings│
                   │ topics: updates, locks │
                   └────────────────────────┘
```

## Critical patterns (do not break)

### 1. **Save queue & debounce** (prevents UI stalls & duplicate writes)
- All card/drawing saves flow through `pendingSaveQueueRef` and batch with `requestIdleCallback`.
- Debounce timers (`saveCardTimerRef`, `saveDrawingTimerRef`) delay writes.
- **Do not** call `saveCard()` or `saveDrawing()` directly in tight loops—add to `pendingSaveQueueRef` instead.
- Example: `App.tsx` line 77–90 shows queue initialization and flush logic.

### 2. **Avoid feedback loops** (remote updates must not trigger local saves)
- `initializingCardIdsRef`: tracks cards created during app init; skip save if in this set.
- `isSyncingRemoteUpdateRef`: set `true` when applying remote update, reset to `false` after.
- Example: `subscribeCards` in `App.tsx` line 390–395 sets this flag when applying remote changes.
- **Rule**: If code modifies `items` state in response to a realtime event, always set this flag.

### 3. **Edit locks** (concurrency control for multi-user editing)
- Before editing a card, call `acquireLock(cardId)` from `src/utils/editLock.ts`.
- Periodically call `renewLock(cardId)` to keep the lock alive (see `App.tsx` for interval logic).
- On exit or save, call `releaseLock(cardId)`.
- Lock state is published via Realtime; `subscribeEditLocks` in `App.tsx` handles incoming lock changes.
- **Rule**: Never skip lock acquisition for card edits—it prevents concurrent overwrites.

### 4. **Realtime subscriptions** (always unsubscribe in cleanup)
- All subscriptions return an `unsubscribe()` function.
- Store unsubscribe handles in a ref (e.g., `unsubscribeRefsRef`).
- Call them all in a `useEffect` cleanup function to avoid dangling listeners.
- Example: `subscribeOnlineCount`, `subscribeCards`, `subscribeEditLocks` in `App.tsx`.

### 5. **Vim modes** (state-driven keyboard handling)
- Modes: `normal` (default), `edit` (modify card), `draw` (paint on canvas), `command` (`:` commands).
- Mode transitions are explicit: `setVimMode()` in `App.tsx`.
- Each mode has its own key event handler; see `handleKeyDown` in `App.tsx` for routing.

## Component responsibilities

| Component                    | Role                                                              |
|------------------------------|-------------------------------------------------------------------|
| `Canvas.tsx`                 | Infinite canvas (pan, zoom, holds layers: items, drawing, cursors)|
| `CanvasItem.tsx`             | Single card: drag, resize, lock state, type rendering            |
| `ArticleEditor.tsx`          | Markdown editor with live preview                                 |
| `RetroMarkdown.tsx`          | Markdown to JSX: supports KaTeX, code highlight, blockquotes      |
| `CanvasDrawingLayer.tsx`     | Canvas drawing: path collection, erase, stroke optimization      |
| `Dock.tsx`                   | Draw mode toolbar: colors, widths, undo/redo                     |
| `CursorLayer.tsx` + `CursorManager.tsx` | Multi-user cursors                                 |
| `GitHubCard.tsx`             | Render GitHub repo data                                           |
| `StatusBar.tsx`              | Footer: online count, visit stats, mode indicator                |

## Utility modules

| File                          | Exports                                                          |
|-------------------------------|------------------------------------------------------------------|
| `db.ts`                       | `loadCards`, `saveCard`, `deleteCard`, `loadDrawings`, `saveDrawing`, `deleteDrawing`, `getActiveCursors`, `upsertCursor`, `getTotalVisits`, `getTodayVisits` |
| `supabase.ts`                 | `supabase` client (initialized with `import.meta.env` vars)     |
| `editLock.ts`                 | `acquireLock`, `renewLock`, `releaseLock`, `isCardLocked`, `getLockInfo` |
| `githubApi.ts`                | `fetchGitHubRepoInfo(url)` → fetches repo metadata               |
| `pathFilter.ts`               | `optimizePath(points)` → smoothing + Douglas-Peucker decimation |
| `user.ts`                     | `initializeUser`, `updateSessionHeartbeat`, `setUserName`        |
| `cleanup.ts`                  | `cleanupOnAppStart()` → purge stale locks, cursors, sessions     |
| `realtime/*.ts`               | Subscription factories: `subscribeCards`, `subscribeCursors`, `subscribeEditLocks`, `subscribeOnlineCount`, `subscribeVisits`, `subscribeDrawings` |

## Build, run, debug

- **Prereqs**: Node ≥ 20, pnpm ≥ 8.
- **Dev**: `pnpm install && pnpm dev` → http://localhost:5173
- **Build**: `pnpm build` (runs `tsc && vite build`) — **TypeScript must compile**.
- **Preview**: `pnpm preview` → test production build locally.
- **Environment** (required, add to `.env.local` or GitHub Secrets):
  - `VITE_SUPABASE_URL`: Supabase project URL.
  - `VITE_SUPABASE_ANON_KEY`: Supabase anon key.
  - `VITE_UNLOCK_PASSWORD`: Password for unlocking protected cards.

## Task workflows

### Adding a new card type
1. Extend `CanvasItemData['type']` union in `src/types/index.ts`.
2. Create component in `src/components/` (e.g., `NewCard.tsx`).
3. Add render case in `CanvasItem.tsx`.
4. Add command in `App.tsx` `executeCommand()` (e.g., `:nx`).
5. Update `db.ts` serialization if needed.

### Modifying save/sync logic
1. Understand `pendingSaveQueueRef`, `saveCardTimerRef` usage in `App.tsx`.
2. Use debounce + queue pattern—do not make synchronous saves.
3. Always set `isSyncingRemoteUpdateRef` when applying remote updates.

### Adding a realtime subscription
1. Create `src/utils/realtime/newTopic.ts` with `subscribeNewTopic()` function.
2. Export from `src/utils/realtime/index.ts`.
3. Call in `App.tsx` `initUserAndStats()` and store unsubscribe handle.
4. Add cleanup call in `useEffect` return.

### Database schema changes
1. Modify table in Supabase Dashboard or migration file.
2. Update queries/types in `src/utils/db.ts`.
3. If subscribing via Realtime, verify `supabase/config.toml` includes table in `realtime.tables`.
4. Test locally, then CI will deploy to Pages (DB requires manual migration in production).

## Key files to inspect for changes

| File                        | Why                                                         |
|-----------------------------|-------------------------------------------------------------|
| `src/App.tsx`               | App state machine; all major flows pass through here        |
| `src/utils/db.ts`           | Supabase CRUD; schema-aware queries                         |
| `src/utils/supabase.ts`     | Client initialization                                       |
| `src/utils/editLock.ts`     | Lock lifecycle; read before adding collaborative features   |
| `src/utils/realtime/`       | Subscription handlers; update when adding/changing topics   |
| `vite.config.ts`            | Build config; `base: '/'` affects Pages deployment         |
| `.github/workflows/deploy.yml` | CI pipeline; `pnpm build` must pass                         |

## Code-agent rules

1. **Always read `src/App.tsx` first** before changing persistence or subscriptions—understand `isSyncingRemoteUpdateRef`, `initializingCardIdsRef`, and queue semantics.
2. **Never call `saveCard()`/`saveDrawing()` directly**—use queue + debounce pattern via refs.
3. **Set `isSyncingRemoteUpdateRef = true/false`** when handling realtime updates to suppress feedback loops.
4. **Pair subscriptions with unsubscribe cleanup**—leaks cause realtime events to fire multiple times.
5. **Use existing lock APIs**—`acquireLock`, `renewLock`, `releaseLock`—for any card content modification.
6. **Ensure `pnpm build` passes**—CI enforces TypeScript compilation.
7. **Update both publisher and subscriber** when adding a new realtime topic (e.g., `db.ts` publish + `realtime/newTopic.ts` subscribe).

## Testing & documentation

- **No unit tests** in repo. If adding tests, create `src/__tests__/` and add `pnpm test` script; keep `tsc` in CI.
- **See also**: `AGENT.md` for deeper task decomposition; `docs/` for schema, cleanup, realtime config details.

## If something is unclear

- Ask for intended user-facing behavior and where state should persist.
- Reference existing patterns (e.g., how `saveCard` is used in `App.tsx` init, how `subscribeCards` sets the sync flag).
- Check `docs/` for detailed guides (e.g., `database-schema.md`, `cleanup-mechanism.md`).

---
*Last updated: 2025-12-04 | Based on codebase analysis and AGENT.md*
