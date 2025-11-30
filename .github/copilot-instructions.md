<!-- Copilot instructions for this repo - concise, actionable -->
# Guidance for AI coding agents

This file contains focused, discoverable knowledge to make an AI agent immediately productive in this repository.

## High level architecture
- Frontend single-page app using React 18 + TypeScript. Entry: `src/main.tsx` → `src/App.tsx`.
- Canvas-driven app: core components in `src/components/` — key ones: `Canvas.tsx`, `CanvasItem.tsx`, `ArticleEditor.tsx`, `RetroMarkdown.tsx`.
- Persistence and realtime: `src/utils/` contains `db.ts` (Supabase CRUD), `realtime/` (subscriptions), `editLock.ts` (lock lifecycle), and `supabase.ts` (Supabase client).
- External integrations: Supabase (database + realtime), GitHub API (see `src/utils/githubApi.ts`), GitHub Actions deploy to Pages (`.github/workflows/deploy.yml`).

## Important patterns and conventions (do not break)
- Save / sync behavior:
  - Writes are batched/queued. Look for `pendingSaveQueueRef`, debounce timers (`saveCardTimerRef`) and `requestIdleCallback` usage in `src/*`.
  - Avoid triggering duplicate saves—code uses `initializingCardIdsRef` to mark items created during init and `isSyncingRemoteUpdateRef` to suppress save-on-update when applying remote changes.
- Edit locks / concurrency:
  - Use `src/utils/editLock.ts` APIs (`acquireLock`, `renewLock`, `releaseLock`) when modifying card content to avoid conflicts.
  - Lock state is published via realtime subscriptions in `src/utils/realtime/editLocks.ts`.
- Cursor & presence:
  - Cursors are shared via `src/utils/realtime/cursors.ts`; colors/usernames are managed in `App.tsx` (`userColors`, `userNames`).

## Build / run / debug
- Prereqs: Node >= 20 and `pnpm` >= 8 (README.md). Use `pnpm` for all commands.
- Typical dev workflow:
  - Install: `pnpm install`
  - Dev server: `pnpm dev` (runs `vite`)
  - Build: `pnpm build` (runs `tsc && vite build` — TypeScript must compile)
  - Preview build: `pnpm preview`
- Environment variables (required for local dev & CI):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_UNLOCK_PASSWORD`
  - Add them to `.env.local` for local runs or GitHub Secrets for CI.

## Files to inspect for common changes
- `src/App.tsx` — app-level state machine (vim modes, save logic, subscriptions). Small changes here affect many flows.
- `src/utils/db.ts` — canonical place for Supabase CRUD; change schema-aware code here.
- `src/utils/supabase.ts` — Supabase client creation (`createClient` using `import.meta.env`).
- `src/utils/realtime/` — realtime subscription handlers (cards, cursors, locks, stats).
- `vite.config.ts` — base path and plugins (React + Tailwind). Note `base: '/'` influences GH Pages deployments.
- `.github/workflows/deploy.yml` — CI deploy pipeline; pushing `main` triggers GH Pages deploy.

## Quick code-agent rules (actionable)
1. Read `src/App.tsx` before modifying persistence or subscription logic; it contains defensive flags used to avoid feedback loops (`isSyncingRemoteUpdateRef`, `initializingCardIdsRef`).
2. When adding API calls that mutate cards/drawings, use existing helpers in `src/utils/db.ts` and respect the save queue and debounce semantics.
3. When changing realtime topics, update both publisher (db helper) and subscriber files under `src/utils/realtime/`.
4. Avoid direct edits to `supabase/config.toml` without ensuring CI and local migrations remain consistent.
5. Ensure any TypeScript changes compile (`pnpm build`); CI expects `tsc` to pass.

## Integration & deployment notes
- Supabase config is under `supabase/` — DB schema changes require coordinated migration and updated `src/utils/db.ts` mapping.
- Deployment: GitHub Actions builds and publishes to Pages. Ensure secrets mentioned above exist in repository settings.

## Where to add tests and checks
- There are no unit tests in the repo. If you add tests, place them under `src/__tests__/` and add `pnpm test` script. Keep `tsc` step in CI.

## If something is unclear
- Ask for the intended user-facing behavior and where state should persist. For edge cases, reference existing implementations (for example, how `saveCard` is used in `App.tsx` during initialization).

-- End of instructions
