```markdown
# Prompt para GitHub Copilot / Copilot Workspace

Actúa como **arquitecto full-stack senior** y ayudame a desarrollar un sistema local con:

- **Backend:** Node.js + TypeScript
- **Frontend:** Next.js + TypeScript
- **AI local:** Ollama
- **Base de datos:** SQLite con Prisma
- **Tools dinámicas:** cargadas desde panel admin, sin builtin tools
- **Sesiones e historial de conversaciones**
- **Entrada por texto y voz**
- **Respuesta por texto y opcionalmente voz**

Necesito que implementes el sistema de forma incremental, ordenada y funcional.

---

# 1. Objetivo del sistema

Crear una aplicación web/mobile responsive donde el usuario pueda conversar con un modelo local de Ollama.

El sistema debe permitir:

1. Crear sesiones de chat.
2. Guardar historial por sesión.
3. Enviar prompts por texto.
4. Enviar prompts por voz.
5. Obtener respuesta de Ollama en texto.
6. Si el input fue por voz, generar también respuesta en audio.
7. Administrar tools dinámicas desde un panel.
8. Enviar las tools activas a Ollama en cada request.
9. Permitir que Ollama decida cuándo usar una tool.
10. Permitir que Ollama pregunte datos faltantes antes de ejecutar una tool.
11. Ejecutar tools desde backend de forma segura.
12. Guardar tool calls y resultados en historial.

---

# 2. Stack obligatorio

Usar:

```txt
Node.js
TypeScript
Express o Fastify
Prisma
SQLite
Next.js
React
TypeScript
Ollama API
```

Preferencia:

```txt
Backend: Express + TypeScript
Frontend: Next.js App Router + TypeScript
DB: SQLite local
```

---

# 3. Arquitectura general

Crear un monorepo simple:

```txt
ai-local-assistant/
  backend/
  frontend/
  README.md
```

Backend:

```txt
backend/
  src/
    index.ts
    config/
      env.ts
    db/
      prisma.ts
    routes/
      sessions.routes.ts
      messages.routes.ts
      tools.routes.ts
      config.routes.ts
      audio.routes.ts
    services/
      ollama.service.ts
      chat-orchestrator.service.ts
      dynamic-tools.service.ts
      http-tool-executor.service.ts
      stt.service.ts
      tts.service.ts
    utils/
      logger.ts
      errors.ts
      validateJsonSchema.ts
      template.ts
      security.ts
    types/
      chat.ts
      tools.ts
  prisma/
    schema.prisma
  uploads/
    audio/
  package.json
  tsconfig.json
  .env.example
```

Frontend:

```txt
frontend/
  src/
    app/
      page.tsx
      layout.tsx
      admin/
        tools/
          page.tsx
      sessions/
        [sessionId]/
          page.tsx
    components/
      ChatWindow.tsx
      SessionSidebar.tsx
      MessageList.tsx
      MessageInput.tsx
      VoiceRecorder.tsx
      ToolForm.tsx
      ToolList.tsx
    lib/
      api.ts
      types.ts
  package.json
  tsconfig.json
  .env.example
```

---

# 4. Modelos de datos

Implementar Prisma schema con estos modelos:

## Session

Campos:

```txt
id
title
model
systemPrompt
createdAt
updatedAt
```

## Message

Campos:

```txt
id
sessionId
role: user | assistant | system | tool
content
inputType: text | voice | tool | none
outputType: text | voice | text_voice | tool_result | none
audioUrl opcional
toolName opcional
metadata JSON opcional
createdAt
```

## Tool

Todas las tools deben venir de DB/panel admin. No crear builtin tools.

Campos:

```txt
id
name
displayName
description
usageGuidance
enabled
type: http
method
url
headers JSON
queryParams JSON
bodyTemplate JSON
parameters JSON
parameterPolicy JSON
responseMapping JSON
timeoutMs
maxResponseKb
allowedHosts JSON
createdAt
updatedAt
```

## AppConfig

Campos:

```txt
id
defaultModel
temperature
topP
ollamaBaseUrl
ttsEnabled
sttEnabled
createdAt
updatedAt
```

---

# 5. Funcionalidades del backend

## 5.1 Sesiones

Endpoints:

```http
GET /api/sessions
POST /api/sessions
GET /api/sessions/:id
PATCH /api/sessions/:id
DELETE /api/sessions/:id
```

Requisitos:

- Crear sesión con título opcional.
- Listar sesiones ordenadas por `updatedAt desc`.
- Borrar sesión con mensajes.
- Renombrar sesión.
- Permitir configurar modelo por sesión.

---

## 5.2 Mensajes

Endpoints:

```http
GET /api/sessions/:id/messages
POST /api/sessions/:id/messages/text
POST /api/sessions/:id/messages/voice
```

### Texto

Body:

```json
{
  "content": "Qué actividades hay en Palermo?"
}
```

Flujo:

1. Guardar mensaje user.
2. Cargar historial de sesión.
3. Cargar tools activas desde DB.
4. Enviar historial + tools a Ollama.
5. Si Ollama responde normal, guardar assistant message.
6. Si Ollama pide tool, validar y ejecutar tool.
7. Guardar tool call y tool result.
8. Enviar resultado a Ollama.
9. Guardar respuesta final.
10. Devolver respuesta final.

### Voz

Usar upload multipart:

```http
POST /api/sessions/:id/messages/voice
```

Flujo:

1. Recibir audio.
2. Guardar archivo.
3. Convertir audio a texto usando STT local.
4. Guardar mensaje user con `inputType=voice`.
5. Enviar a Ollama.
6. Guardar respuesta assistant.
7. Generar audio con TTS.
8. Guardar audioUrl.
9. Devolver texto + audioUrl.

---

# 6. Ollama

Implementar `ollama.service.ts`.

Usar endpoint:

```txt
POST http://localhost:11434/api/chat
```

Soportar:

- `model`
- `messages`
- `tools`
- `stream: false` inicialmente
- `options.temperature`
- `options.top_p`

Formato:

```ts
type OllamaMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
};
```

Implementar función:

```ts
chatWithOllama(input: {
  model: string;
  messages: OllamaMessage[];
  tools?: any[];
  temperature?: number;
  topP?: number;
}): Promise<any>
```

---

# 7. Tools dinámicas

Importante:

```txt
No deben existir tools hardcodeadas como clima/tránsito/actividades.
Todas las tools deben cargarse desde DB y panel admin.
```

Implementar:

```txt
dynamic-tools.service.ts
http-tool-executor.service.ts
```

## 7.1 DynamicToolsService

Funciones:

```ts
getEnabledTools(): Promise<Tool[]>
getToolDefinitionsForOllama(): Promise<any[]>
getServicesDescriptionForPrompt(): Promise<string>
getToolByName(name: string): Promise<Tool | null>
validateToolArguments(tool: Tool, args: any): ValidationResult
```

`getToolDefinitionsForOllama()` debe transformar tools DB a formato Ollama:

```json
{
  "type": "function",
  "function": {
    "name": "tool_name",
    "description": "Descripción + usageGuidance",
    "parameters": {}
  }
}
```

## 7.2 HTTP Tool Executor

Ejecutar tools tipo HTTP desde configuración DB.

Debe soportar:

```txt
GET
POST
PUT
PATCH
DELETE
headers con templates
queryParams con templates
bodyTemplate con templates
timeout
max response size
allowed hosts
```

Template:

```txt
{{location}}
{{date}}
{{API_KEY_NAME}}
```

Los templates pueden leer:

- argumentos generados por Ollama
- variables de entorno

Ejemplo:

```json
{
  "Authorization": "Bearer {{ACTIVITIES_API_KEY}}"
}
```

---

# 8. Seguridad para tools

Implementar seguridad obligatoria:

1. Validar que la tool esté enabled.
2. Validar JSON Schema de parámetros con Ajv.
3. No permitir `eval`.
4. No permitir URLs locales o privadas:
   - localhost
   - 127.0.0.1
   - 0.0.0.0
   - 10.x.x.x
   - 192.168.x.x
   - 172.16.x.x - 172.31.x.x
   - 169.254.x.x
5. Validar allowedHosts si están configurados.
6. Timeout por request.
7. Límite de tamaño de respuesta.
8. Guardar errores como metadata.
9. Nunca exponer secrets al frontend.
10. No devolver headers con API keys al cliente.

---

# 9. Preguntas aclaratorias

El sistema debe permitir que Ollama pregunte datos faltantes antes de llamar una tool.

Agregar al system prompt dinámico:

```txt
Eres un asistente conversacional local.

Puedes conversar normalmente con el usuario.

También tienes acceso a servicios externos dinámicos provistos por el backend.

Servicios disponibles actualmente:
{{SERVICES_LIST}}

Reglas:
- Si el usuario pregunta qué servicios tienes, lista los servicios disponibles en lenguaje simple.
- No menciones nombres técnicos de tools salvo que el usuario lo pida.
- Si una consulta requiere datos actuales o externos, usa la tool adecuada.
- Antes de llamar una tool, revisa su schema.
- Si faltan parámetros requeridos y no hay default, pregunta al usuario antes de usar la tool.
- Si un parámetro opcional ayudaría mucho, puedes hacer una sola pregunta aclaratoria.
- Si no existe una tool adecuada, dilo claramente.
- Nunca inventes datos actuales si hay una tool apropiada.
- Después de recibir resultado de una tool, resume la información de forma útil.
```

---

# 10. Parameter policy

Además del JSON Schema estándar, cada tool puede tener `parameterPolicy`.

Ejemplo:

```json
{
  "defaults": {
    "date": "today"
  },
  "askIfMissing": {
    "date": true,
    "category": false
  },
  "questions": {
    "date": "¿Para qué fecha querés buscar?",
    "category": "¿Qué tipo de actividad preferís?"
  }
}
```

Backend debe:

1. Aplicar defaults antes de validar.
2. Validar required params.
3. Si faltan required params sin default, no ejecutar tool.
4. Pedir a Ollama que formule una pregunta breve usando `questions`.
5. Guardar esta respuesta como assistant.

---

# 11. Chat Orchestrator

Implementar `chat-orchestrator.service.ts`.

Responsabilidades:

```txt
- Recibir sessionId y user content
- Guardar mensaje user
- Construir system prompt dinámico
- Cargar historial
- Cargar tools activas
- Llamar Ollama
- Detectar tool calls
- Validar tool call
- Ejecutar HTTP tool
- Guardar tool message
- Reenviar resultado a Ollama
- Guardar assistant final
- Devolver respuesta
```

Soportar inicialmente una tool call por request. Dejar estructura para múltiples.

Debe manejar:

```txt
respuesta normal
tool call válida
tool call con argumentos faltantes
tool inexistente
tool deshabilitada
error de API externa
```

---

# 12. Panel admin de tools

Crear UI en Next.js:

```txt
/admin/tools
```

Funcionalidades:

1. Listar tools.
2. Crear tool.
3. Editar tool.
4. Activar/desactivar.
5. Borrar tool.
6. Probar tool con argumentos JSON.
7. Ver resultado o error.

Endpoints:

```http
GET /api/tools
POST /api/tools
GET /api/tools/:id
PATCH /api/tools/:id
DELETE /api/tools/:id
POST /api/tools/:id/test
```

Formulario debe permitir editar:

```txt
name
displayName
description
usageGuidance
enabled
method
url
headers JSON
queryParams JSON
bodyTemplate JSON
parameters JSON
parameterPolicy JSON
responseMapping JSON
timeoutMs
maxResponseKb
allowedHosts JSON
```

Validar que campos JSON sean JSON válido.

---

# 13. Frontend chat

Crear UI principal:

```txt
/
```

Debe tener:

- Sidebar con sesiones.
- Botón nueva sesión.
- Lista de mensajes.
- Input de texto.
- Botón enviar.
- Botón micrófono.
- Estado loading.
- Mostrar mensajes tool de forma colapsable o debug opcional.
- Reproducir audio si assistant devuelve audioUrl.
- Botón para preguntar “¿Qué servicios tenés?”

Vista responsive mobile-first.

---

# 14. STT y TTS

Implementar servicios iniciales simples.

## STT

Crear `stt.service.ts`.

Inicialmente puede devolver error claro si no está configurado.

Preparar para usar Whisper CLI:

```ts
transcribeAudio(filePath: string): Promise<string>
```

Usar env:

```txt
WHISPER_CLI_PATH
WHISPER_MODEL_PATH
```

Si no está configurado:

```txt
throw new Error("STT no configurado")
```

## TTS

Crear `tts.service.ts`.

En macOS usar comando `say`:

```ts
textToSpeech(text: string): Promise<string>
```

Debe generar archivo `.aiff` o `.m4a` en uploads/audio.

Usar child_process execFile.

Si TTS desactivado, no generar audio.

---

# 15. Configuración

Crear `.env.example`.

Backend:

```env
PORT=4000
DATABASE_URL="file:./dev.db"
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=qwen2.5:7b
DEFAULT_TEMPERATURE=0.3
DEFAULT_TOP_P=0.9
UPLOAD_DIR=uploads
TTS_ENABLED=true
STT_ENABLED=false
WHISPER_CLI_PATH=
WHISPER_MODEL_PATH=
```

Frontend:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

---

# 16. Modelos Ollama recomendados

Documentar en README:

```bash
ollama pull qwen2.5:7b
ollama pull llama3.1:8b
```

Default recomendado:

```txt
qwen2.5:7b
```

Motivo:

```txt
Buen seguimiento de instrucciones, JSON y tool calling en hardware Mac M3 Pro 36GB.
```

---

# 17. Instalación esperada

README con pasos:

```bash
ollama serve
ollama pull qwen2.5:7b

cd backend
npm install
npx prisma migrate dev
npm run dev

cd frontend
npm install
npm run dev
```

Abrir:

```txt
http://localhost:3000
```

Backend:

```txt
http://localhost:4000
```

---

# 18. Implementación incremental

Desarrollar en este orden:

## Fase 1: Base

1. Crear monorepo.
2. Backend Express TypeScript.
3. Prisma SQLite.
4. Session CRUD.
5. Message CRUD básico.
6. Frontend chat básico.

## Fase 2: Ollama

1. Integrar Ollama API.
2. Enviar prompts de texto.
3. Guardar respuestas.
4. Mostrar historial.

## Fase 3: Tools dinámicas

1. Crear modelo Tool.
2. Crear endpoints tools.
3. Crear panel admin.
4. Crear executor HTTP genérico.
5. Enviar tools activas a Ollama.
6. Detectar tool calls.
7. Ejecutar tool.
8. Guardar tool result.
9. Respuesta final.

## Fase 4: Preguntas aclaratorias

1. Implementar parameterPolicy.
2. Defaults.
3. Validación JSON Schema.
4. Preguntas por faltantes.

## Fase 5: Voz

1. Upload audio.
2. STT.
3. TTS.
4. Reproducción frontend.

## Fase 6: Seguridad y UX

1. SSRF protection.
2. allowedHosts.
3. max response size.
4. logs.
5. UI responsive.
6. manejo de errores.

---

# 19. Criterios de aceptación

El sistema se considera funcional si:

1. Puedo crear una sesión.
2. Puedo escribir un mensaje.
3. Backend llama a Ollama.
4. Respuesta queda guardada.
5. Puedo crear una tool desde el panel.
6. La tool queda disponible sin tocar código.
7. Si pregunto “¿Qué servicios tenés?”, la AI lista tools activas.
8. Si pregunto algo relacionado a una tool, Ollama puede usarla.
9. Si faltan parámetros requeridos, pregunta antes de ejecutar.
10. Si están todos los parámetros, backend ejecuta la API configurada.
11. El resultado vuelve a Ollama.
12. La respuesta final se muestra al usuario.
13. Puedo ver historial de la sesión.
14. Puedo borrar o renombrar sesiones.

---

# 20. Ejemplo de tool para probar

Crear desde el panel una tool usando una API pública simple.

Ejemplo sin API key:

```json
{
  "name": "get_public_holidays",
  "displayName": "Feriados públicos",
  "description": "Consulta feriados públicos por país y año.",
  "usageGuidance": "Usar cuando el usuario pregunte por feriados, días no laborables o festivos.",
  "enabled": true,
  "type": "http",
  "method": "GET",
  "url": "https://date.nager.at/api/v3/PublicHolidays/{{year}}/{{countryCode}}",
  "headers": {},
  "queryParams": {},
  "bodyTemplate": {},
  "parameters": {
    "type": "object",
    "properties": {
      "year": {
        "type": "string",
        "description": "Año en formato YYYY. Ejemplo: 2026"
      },
      "countryCode": {
        "type": "string",
        "description": "Código de país ISO 3166-1 alpha-2. Ejemplo: AR, US, ES"
      }
    },
    "required": ["year", "countryCode"]
  },
  "parameterPolicy": {
    "defaults": {},
    "askIfMissing": {
      "year": true,
      "countryCode": true
    },
    "questions": {
      "year": "¿De qué año querés consultar los feriados?",
      "countryCode": "¿De qué país? Indicame el código, por ejemplo AR, US o ES."
    }
  },
  "timeoutMs": 10000,
  "maxResponseKb": 256,
  "allowedHosts": ["date.nager.at"]
}
```

Prueba:

```txt
Usuario: ¿Qué feriados hay en Argentina?
AI: ¿De qué año querés consultar los feriados?
Usuario: 2026
AI: [usa tool get_public_holidays con countryCode AR y year 2026]
```

---

# 21. Importante

Generá código real, no pseudocódigo.

Priorizá que compile y funcione.

Si hay que simplificar, simplificá UI antes que arquitectura.

No agregues autenticación todavía.

No agregues Docker inicialmente.

No uses servicios cloud obligatorios.

No hardcodees tools.

Todas las tools deben venir desde la base de datos/panel admin.


# 22. Documentación obligatoria del avance y del sistema

Durante la implementación, debés documentar tanto el **avance del desarrollo** como el **funcionamiento técnico del sistema**.

La documentación debe mantenerse actualizada en el repositorio.
```