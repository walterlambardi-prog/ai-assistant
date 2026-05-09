# Progreso del desarrollo

Bitácora del avance del sistema. Actualizar tras cada hito.

## Fase 1 — Base ✅

- [x] Monorepo `backend/` + `frontend/` + `docs/`.
- [x] Backend Express + TypeScript, error handler centralizado.
- [x] Prisma + SQLite, migración inicial vía `npx prisma migrate dev`.
- [x] CRUD `Session`.
- [x] CRUD `Message` básico.
- [x] Frontend Next.js (App Router) con sidebar de sesiones, lista de mensajes e input.

## Fase 2 — Ollama ✅

- [x] `ollama.service.ts` con `POST /api/chat`, `stream:false`.
- [x] Envío de prompts texto desde el frontend.
- [x] Persistencia de respuesta assistant.
- [x] Visualización de historial.

## Fase 3 — Tools dinámicas ✅

- [x] Modelo `Tool` con todos los campos requeridos.
- [x] Endpoints `GET/POST/PATCH/DELETE /api/tools` y `POST /api/tools/:id/test`.
- [x] Panel admin `/admin/tools` con listado + formulario completo + test.
- [x] `dynamic-tools.service.ts`: carga, transformación a formato Ollama, validación.
- [x] `http-tool-executor.service.ts`: GET/POST/PUT/PATCH/DELETE, templating, timeout, max response, allowedHosts.
- [x] Detección de tool calls en orchestrator.
- [x] Persistencia de tool messages y reenvío a Ollama.
- [x] Respuesta final assistant.

## Fase 4 — Preguntas aclaratorias ✅

- [x] `parameterPolicy.defaults` aplicados.
- [x] Validación con Ajv (JSON Schema).
- [x] Si faltan required → assistant message con pregunta (`questions[param]`).

## Fase 5 — Voz ✅

- [x] Endpoint multipart `POST /messages/voice`.
- [x] `stt.service.ts` con Whisper CLI (opcional, si configurado).
- [x] `tts.service.ts` con macOS `say` (opcional).
- [x] Frontend `VoiceRecorder` + reproducción del audio assistant.

## Fase 6 — Seguridad y UX ✅

- [x] SSRF protection (DNS lookup + bloqueo IPs privadas).
- [x] `allowedHosts` por tool.
- [x] `maxResponseKb` por streaming.
- [x] Logger con niveles.
- [x] UI responsive mobile-first (CSS).
- [x] Manejo de errores en backend (handler) y frontend (banner).

## Pendientes / mejoras futuras

- [ ] Soporte de múltiples tool calls en una misma respuesta (loop).
- [ ] Streaming SSE de respuestas Ollama.
- [ ] Auth (intencionalmente fuera del scope inicial).
- [ ] Rate limiting por tool.
- [ ] Encriptación at-rest de secrets en `headers`.
- [ ] Tests automáticos.
- [ ] Página `/sessions/[sessionId]` (rutas profundas) — actualmente la home maneja la sesión activa con estado en cliente.

## Comandos clave

```bash
# Backend
cd backend
npm install
npx prisma migrate dev --name init
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```
