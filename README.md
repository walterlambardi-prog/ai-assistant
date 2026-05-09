# AI Local Assistant

Sistema local full-stack para conversar con modelos de **Ollama**, con sesiones persistentes, historial, **tools dinámicas** administrables desde un panel, y soporte de **voz (STT/TTS)**.

> Repo: https://github.com/walterlambardi-prog/ai-assistant.git

## Stack

- **Backend:** Node.js + TypeScript + Express
- **Frontend:** Next.js (App Router) + TypeScript + React
- **DB:** SQLite + Prisma
- **AI:** Ollama (local) — `qwen2.5:7b` recomendado
- **Voz:** Whisper CLI (STT) + macOS `say` (TTS)

## Estructura

```
ai-local-assistant/
  backend/
  frontend/
  docs/
  README.md
```

## Requisitos

- Node.js 20+
- Ollama instalado y corriendo: https://ollama.com
- macOS (para TTS con `say`) — opcional
- Whisper.cpp CLI — opcional, solo si querés STT

## Modelos Ollama recomendados

```bash
ollama pull qwen2.5:7b      # default recomendado (tool calling robusto)
ollama pull llama3.1:8b
```

> Por qué `qwen2.5:7b`: buen seguimiento de instrucciones, JSON bien formado y tool calling estable en hardware Mac M3 Pro 36GB.

## Instalación

```bash
# 1. Ollama
ollama serve
ollama pull qwen2.5:7b

# 2. Backend
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run dev   # http://localhost:4000

# 3. Frontend (en otra terminal)
cd frontend
cp .env.example .env
npm install
npm run dev   # http://localhost:3000
```

Abrí `http://localhost:3000`.

## Funcionalidades

- Crear/renombrar/borrar sesiones de chat.
- Historial por sesión (texto, voz, tool calls, tool results).
- Input por texto o voz; respuesta por texto y opcionalmente audio.
- Panel admin `/admin/tools` para crear, editar, activar/desactivar y probar tools.
- Tools 100% dinámicas desde DB — no hay tools hardcodeadas.
- Ollama decide cuándo usar una tool y puede pedir datos faltantes (parameter policy).
- Validación JSON Schema (Ajv), SSRF protection, allowedHosts, timeout y límite de respuesta.

## Ejemplo de tool (sin API key) para probar

Ver [docs/EXAMPLE_TOOL.md](docs/EXAMPLE_TOOL.md). Crearla desde `/admin/tools`.

## Documentación

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/API.md](docs/API.md)
- [docs/TOOLS.md](docs/TOOLS.md)
- [docs/PROGRESS.md](docs/PROGRESS.md)

## Criterios de aceptación

Ver §19 del prompt original. Todos verificables ejecutando `npm run dev` en backend + frontend con Ollama corriendo.
# ai-assistant
