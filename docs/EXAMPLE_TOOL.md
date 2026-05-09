# Tool de ejemplo: Feriados públicos (sin API key)

Usá esta definición desde `/admin/tools` → "Nueva tool":

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
  "headers": "{}",
  "queryParams": "{}",
  "bodyTemplate": "{}",
  "parameters": "{\"type\":\"object\",\"properties\":{\"year\":{\"type\":\"string\",\"description\":\"Año YYYY\"},\"countryCode\":{\"type\":\"string\",\"description\":\"ISO 3166-1 alpha-2 (AR, US, ES)\"}},\"required\":[\"year\",\"countryCode\"]}",
  "parameterPolicy": "{\"defaults\":{},\"askIfMissing\":{\"year\":true,\"countryCode\":true},\"questions\":{\"year\":\"¿De qué año querés consultar los feriados?\",\"countryCode\":\"¿De qué país? Indicame el código, por ejemplo AR, US o ES.\"}}",
  "responseMapping": "{}",
  "timeoutMs": 10000,
  "maxResponseKb": 256,
  "allowedHosts": "[\"date.nager.at\"]"
}
```

> Nota: en el formulario UI los campos JSON se ingresan como strings JSON. Los valores arriba están escapados para `POST /api/tools` directo. Si los pegás en la UI, omití el escape exterior — pegalos ya parseados.

## Conversación esperada

```
Usuario: ¿Qué feriados hay en Argentina?
AI:      ¿De qué año querés consultar los feriados?
Usuario: 2026
AI:      [usa la tool con year=2026, countryCode=AR]
AI:      Estos son los feriados en Argentina para 2026: ...
```

## Verificación rápida vía API

```bash
curl -X POST http://localhost:4000/api/tools/<id>/test \
  -H 'Content-Type: application/json' \
  -d '{"args":{"year":"2026","countryCode":"AR"}}'
```
