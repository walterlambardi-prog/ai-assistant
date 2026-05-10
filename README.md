# AI Local Assistant

A local full-stack AI assistant that lets you chat with **Ollama** models using persistent sessions, dynamic tool calling, voice input/output, and a full admin panel — all running on your own machine.

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 20 · TypeScript · Express |
| Frontend | Next.js 14 (App Router) · React 18 · Tailwind CSS 3 · shadcn/ui |
| Database | SQLite · Prisma ORM |
| AI | Ollama (local LLM inference) |
| Voice | Whisper.cpp CLI (STT) · macOS `say` (TTS) |

## Project Structure

```
ai-assistant/
├── backend/                  # Express API + Prisma + LLM orchestrator
│   ├── prisma/               # Schema and migrations
│   ├── src/
│   │   ├── config/           # Environment config
│   │   ├── routes/           # REST endpoints
│   │   ├── services/         # Orchestrator, Ollama, TTS, STT, tools
│   │   └── index.ts          # Entry point
│   └── .env.example
├── frontend/                 # Next.js application
│   ├── src/
│   │   ├── app/              # App Router pages (/, /admin/*)
│   │   ├── components/       # UI components
│   │   ├── i18n/             # EN/ES translations
│   │   └── lib/              # API client, types, utils
│   └── .env.example
└── README.md
```

## Requirements

- **Node.js 20+**
- **Ollama** running locally — [ollama.com](https://ollama.com)
- **macOS** — required only for TTS (`say` command)
- **Whisper.cpp CLI** — required only for STT (voice input)

## Recommended Models

```bash
ollama pull llama3.1:8b    # good balance of speed and tool calling
ollama pull qwen2.5:7b     # stronger tool calling, slightly slower
```

Both models support multi-step tool calling. Configure the active model from `/admin/config`.

## Installation

```bash
# 1. Start Ollama
ollama serve
ollama pull llama3.1:8b

# 2. Backend
cd backend
cp .env.example .env       # edit as needed
npm install
npx prisma migrate dev --name init
npm run dev                # → http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev -- -p 3001    # → http://localhost:3001
```

Open [http://localhost:3001](http://localhost:3001).

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Express server port |
| `DATABASE_URL` | `file:./dev.db` | Prisma SQLite connection |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API base URL |
| `OLLAMA_DEFAULT_MODEL` | `qwen2.5:7b` | Default model (overridable per session) |
| `DEFAULT_TEMPERATURE` | `0.3` | LLM temperature |
| `DEFAULT_TOP_P` | `0.9` | LLM top-p sampling |
| `UPLOAD_DIR` | `uploads` | Directory for audio files |
| `TTS_ENABLED` | `true` | Enable text-to-speech |
| `TTS_VOICE` | `Monica` | macOS `say` voice name |
| `TTS_RATE` | `190` | TTS words per minute |
| `STT_ENABLED` | `false` | Enable speech-to-text |
| `WHISPER_CLI_PATH` | _(empty)_ | Absolute path to `whisper` binary |
| `WHISPER_MODEL_PATH` | _(empty)_ | Absolute path to Whisper `.bin` model |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:4000` | Backend API URL |

## Features

### Chat & Sessions
- Create, rename, and delete sessions individually or all at once.
- **Auto-title**: session is named automatically from the first user message.
- **Search**: find sessions by title or message content.
- **Isolated context**: each session has its own independent message history sent to the LLM.
- Collapsible sidebar with date-grouped session list.
- Copy message content from the message header (hover to reveal).
- Lightbox image viewer with source link.
- Session flow modal — visual timeline of LLM turns, tool calls, and timing.

### Streaming & UX
- **SSE streaming** for text responses — tokens appear as they are generated.
- **Real-time tool status**: shows the active tool name (e.g. `● Wikipedia…`) while the LLM is calling a service.
- **Background session indicator**: pulsing dot in the sidebar for sessions still processing after switching away.
- **Reload resilience**: if you reload during a request, the app detects `isProcessing` from the database and shows the loader until the backend finishes.
- **Cancel**: the Stop button cancels both the frontend SSE connection and signals the backend to exit the tool-calling loop.

### Tool Calling
- Tools are **fully dynamic** — managed from `/admin/tools`, no hardcoded tools.
- The LLM can call **multiple tools per turn** (batch tool calls) and chain them across iterations.
- Up to **10 tool iterations** per response (configurable).
- Full **JSON Schema validation** (Ajv) on tool arguments.
- **SSRF protection** via `allowedHosts` allowlist per tool.
- Configurable timeout and max response size per tool.
- **Intermediate message persistence**: the Ollama `user → assistant(tool_calls) → tool_result → assistant` protocol is correctly maintained across session reloads.
- **Re-execute support**: the system prompt instructs the LLM to re-run all listed tasks when the user asks to repeat them.

### Voice
- Voice input via microphone (requires STT/Whisper).
- Voice output via macOS `say` TTS after AI responses.
- Custom `AudioPlayer` component with waveform visualization, seek bar, speed control (0.75×–2×), mute, and download.

### Admin Panel
- **`/admin/tools`** — full CRUD for tools: name, URL, HTTP method, headers, query params, body template, JSON Schema parameters, allowed hosts, secrets, timeout.
- **`/admin/config`** — configure the default Ollama model, temperature, top-p, base URL, language (EN/ES), TTS voice/rate, and custom system prompts per language.

### Internationalization
- UI and assistant system prompt switch between **English** and **Spanish** from `/admin/config`.

## Development Workflow
## API Reference (summary)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/sessions` | List all sessions |
| `POST` | `/api/sessions` | Create session |
| `PATCH` | `/api/sessions/:id` | Rename / update session |
| `DELETE` | `/api/sessions/:id` | Delete session |
| `GET` | `/api/sessions/:id/messages` | List messages (excludes internal) |
| `POST` | `/api/sessions/:id/messages/text/stream` | Send text (SSE streaming) |
| `POST` | `/api/sessions/:id/messages/voice/run` | Voice turn (TTS response) |
| `POST` | `/api/sessions/:id/messages/voice/transcribe` | STT only |
| `POST` | `/api/sessions/:id/cancel` | Signal backend to stop tool loop |
| `POST` | `/api/sessions/:id/cancel-last` | Mark last turn as cancelled |
| `GET` | `/api/tools` | List tools |
| `POST` | `/api/tools` | Create tool |
| `PATCH` | `/api/tools/:id` | Update tool |
| `DELETE` | `/api/tools/:id` | Delete tool |
| `POST` | `/api/tools/:id/test` | Test tool with given args |
| `GET` | `/api/config` | Get app configuration |
| `PATCH` | `/api/config` | Update app configuration |
| `GET` | `/audio/:filename` | Serve audio file |