# AI Assistant — Copilot Instructions

## Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript 5.6 | Port 3001, `"use client"` components |
| Styling | Tailwind CSS 3, shadcn/ui | Components in `frontend/src/components/ui/` |
| Linter | Biome | Enforced — no ESLint/Prettier |
| Backend | Express, TypeScript | Port 4000 |
| ORM | Prisma + SQLite | `backend/prisma/dev.db`, WAL mode |
| LLM | Ollama (`llama3.1:8b`) | SSE streaming via `/api/sessions/:id/messages/text/stream` |
| TTS | macOS `say` | Only on `/voice/run` and `/voice` endpoints |
| STT | Whisper / STT service | Voice transcription |

## Architecture

```
AI-ASSISTANT/
├── backend/
│   ├── prisma/           # schema.prisma + migrations
│   └── src/
│       ├── index.ts      # Express entry, startup reset of isProcessing sessions
│       ├── routes/       # sessions, messages, tools, config
│       └── services/
│           ├── chat-orchestrator.service.ts  # LLM turns, tool loop, SSE streaming
│           ├── ollama.service.ts             # Ollama HTTP client
│           ├── dynamic-tools.service.ts      # Tool registry from DB
│           └── tts.service.ts / tts-provider.ts
└── frontend/
    └── src/
        ├── app/
        │   ├── page.tsx          # Main chat page (sessions + streaming UI)
        │   └── admin/            # Config + tools admin panels
        ├── components/
        │   ├── MessageList.tsx   # Renders messages + TypingRow + StreamingRow
        │   ├── SessionSidebar.tsx
        │   ├── MessageInput.tsx
        │   ├── AudioPlayer.tsx
        │   ├── SessionFlowModal.tsx
        │   └── ui/               # shadcn/ui primitives
        ├── lib/
        │   ├── api.ts            # All fetch calls to backend
        │   └── types.ts          # Session, Message, Tool, AppConfig types
        └── i18n/                 # en.json / es.json + I18nProvider
```

## Key Conventions

### Git Workflow
- **`main`**: stable releases only. **`develop`**: active development.
- Feature branches: `feat/<name>`, fixes: `fix/<name>`, chores: `chore/<name>`.
- Always branch off `develop`, merge back with `--no-ff`.
- Commit format: **Conventional Commits** — `type(scope): description`.
- Merge to `main` only for releases: `release: vX.Y.Z — description`.

### Frontend
- React state updates are asynchronous — use `ref` for values needed synchronously in callbacks (e.g. `activeIdRef`, `abortRef`, `messagesRef`).
- Guard all async callbacks with `if (activeIdRef.current !== sid) return` to prevent stale-closure contamination across session switches.
- `setStreamingText(null)` (not `""`) to clear streaming state — `null` means "no streaming row", `""` would show an empty `StreamingRow`.
- Streaming SSE events: `token`, `tool_start`, `tool_end`, `done`.
- `ensureSession()` creates a new session if none is active — the `useEffect([activeId])` must NOT abort in-flight requests when `prevId === null`.

### Backend
- `chat-orchestrator.service.ts` handles both streaming (`runChatTurnStreaming`) and non-streaming (`runChatTurn`) turns.
- `isProcessing` is set to `true` at turn start, reset to `false` at end or on server startup (catches crashes).
- `cancelRequested` flag is polled each tool iteration — allows graceful mid-loop cancellation.
- `MAX_TOOL_ITERATIONS = 10` (hardcoded in orchestrator).
- Prisma client is a singleton in `backend/src/db/prisma.ts`.

### Styling
- Use Tailwind utility classes. No inline styles unless unavoidable.
- Dark mode via `.dark` class on `<html>` — handled by Tailwind config.
- Animations: `animate-pulse` for live indicators, `typing-dots` CSS class for the 3-dot loader.

## Build & Dev Commands

```bash
# Backend
cd backend && npm run dev        # ts-node-dev, port 4000

# Frontend
cd frontend && npm run dev -- -p 3001   # Next.js dev server

# Prisma
cd backend && npx prisma migrate dev --name <name>
cd backend && npx prisma studio

# Linting
cd frontend && npx biome check src/
```

## Common Gotchas

- **SQLite lock on migration**: kill backend first (`lsof -i:4000 | kill`), then run migrate.
- **Race condition on session create + send**: `useEffect([activeId])` was aborting the in-flight request when a new session was created to handle the first message. Fix: only abort when `prevId !== null && prevId !== activeId`.
- **`tsconfig.tsbuildinfo`** is gitignored — don't commit it.
- **`dev.db-shm` / `dev.db-wal`** are SQLite WAL files — gitignored.
- TTS only works on macOS with the `say` command available.
