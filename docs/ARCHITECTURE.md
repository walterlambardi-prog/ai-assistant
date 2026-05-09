# Arquitectura

## Visión general

```
┌──────────────┐   HTTP/JSON   ┌────────────────┐   HTTP   ┌────────────┐
│  Next.js UI  │ ─────────────▶│ Express API    │ ───────▶ │  Ollama    │
│  (3000)      │               │  (4000)        │          │  (11434)   │
└──────────────┘               │                │          └────────────┘
                               │  Prisma/SQLite │
                               │  HTTP Tool exec│ ───────▶  APIs externas
                               │  STT (whisper) │           (validadas)
                               │  TTS (say)     │
                               └────────────────┘
```

## Componentes backend

- `index.ts`: bootstrap Express, CORS, error handler centralizado.
- `config/env.ts`: lee `.env` y expone constantes.
- `db/prisma.ts`: cliente Prisma singleton.
- `routes/`:
  - `sessions.routes.ts` – CRUD sesiones.
  - `messages.routes.ts` – `GET`, `POST /text`, `POST /voice` (multipart).
  - `tools.routes.ts` – CRUD tools + `POST /:id/test`.
  - `config.routes.ts` – `AppConfig` singleton.
  - `audio.routes.ts` – sirve archivos generados por TTS/STT.
- `services/`:
  - `ollama.service.ts` – cliente HTTP de Ollama (`/api/chat`).
  - `dynamic-tools.service.ts` – carga tools desde DB, las traduce al formato Ollama y valida argumentos con Ajv.
  - `http-tool-executor.service.ts` – ejecuta tools HTTP con timeout, max response y validación SSRF.
  - `chat-orchestrator.service.ts` – orquesta el turno de chat: prompt dinámico → Ollama → tool call (opcional) → ejecución → re-prompt → assistant final.
  - `stt.service.ts` – transcripción con whisper.cpp CLI.
  - `tts.service.ts` – síntesis con `say` (macOS).
- `utils/`:
  - `validateJsonSchema.ts` – Ajv compilado y cacheado, soporta `useDefaults`.
  - `template.ts` – render de `{{var}}` con args + `process.env`.
  - `security.ts` – SSRF protection (bloqueo de IPs privadas), redacción de headers secretos.
  - `errors.ts`, `logger.ts`.

## Flujo de un turno de chat (texto)

1. `POST /api/sessions/:id/messages/text` con `{content}`.
2. `runChatTurn`:
   1. Persiste user message.
   2. Construye system prompt dinámico embebiendo lista de servicios (tools activas).
   3. Carga historial completo de la sesión.
   4. Llama a Ollama con `tools` (formato OpenAI-compat).
   5. Si `message.tool_calls[0]` existe:
      - Busca tool en DB; si no existe o está deshabilitada, responde error.
      - Aplica `parameterPolicy.defaults`.
      - Valida args contra JSON Schema con Ajv.
      - Si faltan required, formula pregunta usando `parameterPolicy.questions` y devuelve sin ejecutar.
      - Ejecuta `executeHttpTool` (SSRF check, timeout, max bytes).
      - Persiste mensaje `role=tool` con resultado.
      - Llama a Ollama otra vez con el historial actualizado.
   6. Persiste assistant final y devuelve.

## Flujo de voz

1. `POST /api/sessions/:id/messages/voice` (multipart `audio`).
2. Se guarda el archivo en `uploads/audio/`.
3. `transcribeAudio` (Whisper CLI) genera el texto. Si STT no está configurado → 501.
4. Mismo flujo que texto, pero `inputType=voice`.
5. Después de generar la respuesta assistant, se llama a `textToSpeech` (macOS `say`) y se guarda `audioUrl`.
6. Frontend reproduce automáticamente.

## Seguridad

- **SSRF**: bloqueo de hostnames/IPs privadas, soporte de allowlist por tool.
- **JSON Schema**: validación estricta antes de ejecutar.
- **No `eval`**: templating limitado a `{{var}}` con regex.
- **Timeout**: por tool (`timeoutMs`).
- **Max response**: `maxResponseKb` truncado por streaming.
- **Headers redactados**: `Authorization`, `*api-key*`, `token`, `secret` no se devuelven al cliente.
- **Secrets** vienen de `process.env`, nunca del frontend ni de la DB en plano si se prefieren ambientales.
- **CORS** permisivo en dev; restringir en prod.

## Datos

Todos los modelos en `backend/prisma/schema.prisma`. SQLite en `backend/prisma/dev.db`.
