# API

Base: `http://localhost:4000`

## Health

```
GET /api/health → { ok: true }
```

## Sessions

```
GET    /api/sessions
POST   /api/sessions          { title?, model?, systemPrompt? }
GET    /api/sessions/:id
PATCH  /api/sessions/:id      { title?, model?, systemPrompt? }
DELETE /api/sessions/:id
```

## Messages

```
GET  /api/sessions/:id/messages
POST /api/sessions/:id/messages/text   { content }
POST /api/sessions/:id/messages/voice  multipart: audio=<file>
```

`text` response:

```json
{
  "assistantMessageId": "...",
  "content": "...",
  "toolCalls": [{ "name": "...", "args": {...}, "ok": true }]
}
```

`voice` response:

```json
{
  "transcript": "...",
  "content": "...",
  "audioUrl": "audio/tts_123.aiff",
  "assistantMessageId": "...",
  "toolCalls": []
}
```

## Tools

```
GET    /api/tools
POST   /api/tools
GET    /api/tools/:id
PATCH  /api/tools/:id
DELETE /api/tools/:id
POST   /api/tools/:id/test    { args: {...} }
```

Campos JSON (string serializada):
`headers`, `queryParams`, `bodyTemplate`, `parameters`, `parameterPolicy`,
`responseMapping`, `allowedHosts`.

## Config

```
GET   /api/config
PATCH /api/config   { defaultModel?, temperature?, topP?, ollamaBaseUrl?, ttsEnabled?, sttEnabled? }
```

## Audio

```
GET /audio/:filename
```

Sirve archivos de `backend/uploads/audio/`.
