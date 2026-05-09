# Tools dinámicas

Las tools se administran 100% desde `/admin/tools` (UI) o vía `POST /api/tools`. **No hay tools hardcodeadas**.

## Modelo

| Campo | Tipo | Descripción |
|---|---|---|
| `name` | string | Identificador técnico (`[a-zA-Z_][a-zA-Z0-9_]*`). Único. |
| `displayName` | string | Nombre legible para el usuario. |
| `description` | string | Qué hace la tool. |
| `usageGuidance` | string | Cuándo el modelo debe usarla. Concatenado al `description` enviado a Ollama. |
| `enabled` | bool | Si está activa, se envía a Ollama y puede ejecutarse. |
| `type` | "http" | Único tipo soportado. |
| `method` | GET\|POST\|PUT\|PATCH\|DELETE | HTTP method. |
| `url` | string | Soporta `{{var}}` en path. |
| `headers` | JSON | Pares `Header: valor`, soporta `{{var}}` y env vars. |
| `queryParams` | JSON | Pares `key: valor`, soporta `{{var}}`. |
| `bodyTemplate` | JSON | Para POST/PUT/PATCH/DELETE. |
| `parameters` | JSON Schema | Argumentos que Ollama debe generar. |
| `parameterPolicy` | JSON | `{ defaults, askIfMissing, questions }`. |
| `responseMapping` | JSON | Reservado para mapear/limitar campos (futuro). |
| `timeoutMs` | int | Default 10000. Max 60000. |
| `maxResponseKb` | int | Default 256. Max 8192. |
| `allowedHosts` | JSON array | Si está vacío, cualquier host público. Si tiene valores, se exige match exacto o subdominio. |

## Templates

Sintaxis: `{{nombre}}`.
Resolución por orden:

1. Argumentos generados por Ollama (validados).
2. `process.env`.

Ejemplo:

```json
{ "Authorization": "Bearer {{ACTIVITIES_API_KEY}}" }
```

## Parameter policy

```json
{
  "defaults": { "date": "today" },
  "askIfMissing": { "date": true, "category": false },
  "questions": {
    "date": "¿Para qué fecha querés buscar?",
    "category": "¿Qué tipo de actividad preferís?"
  }
}
```

Flujo:

1. Backend mergea `defaults` con args.
2. Valida JSON Schema con Ajv (`useDefaults: true`).
3. Si faltan required (no resueltos por defaults), no se ejecuta. Se devuelve un assistant message con la pregunta de `questions[param]` (o pregunta genérica si no está definida).
4. Si todo está completo, se ejecuta la tool y el resultado se reenvía a Ollama.

## Seguridad

- **SSRF**: hostnames `localhost`, `127.0.0.1`, `0.0.0.0`, `::1` bloqueados; rangos privados (10/8, 172.16/12, 192.168/16, 169.254/16) bloqueados; resolución DNS verificada.
- **allowedHosts**: opcional pero recomendado para producción.
- **Secrets**: usá env vars (`{{API_KEY_NAME}}`). Nunca pegues secrets en el campo `headers` que se persiste en DB salvo en dev.
- **Headers sensibles** (`Authorization`, `*api-key*`, `token`, `secret`) se redactan al devolver `meta.headers`.
- **Sin `eval`**: el templating es regex puro.
- **Timeout** + **max response size** obligatorios.

## Endpoint de prueba

```
POST /api/tools/:id/test
{ "args": { "year": "2026", "countryCode": "AR" } }
```

Respuesta: `{ ok, status, data, meta, error? }`.
