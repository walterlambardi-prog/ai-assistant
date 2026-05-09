import Ajv, { ValidateFunction } from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv({ allErrors: true, strict: false, useDefaults: true });
addFormats(ajv);

const cache = new Map<string, ValidateFunction>();

export function compileSchema(key: string, schema: unknown): ValidateFunction {
  if (cache.has(key)) return cache.get(key)!;
  const validate = ajv.compile(schema as object);
  cache.set(key, validate);
  return validate;
}

export type ValidationResult =
  | { ok: true; value: any }
  | { ok: false; errors: string[]; missingRequired: string[] };

export function validateAgainstSchema(
  cacheKey: string,
  schema: unknown,
  data: any
): ValidationResult {
  const validate = compileSchema(cacheKey, schema);
  const value = data ? { ...data } : {};
  const valid = validate(value);
  if (valid) return { ok: true, value };
  const errors = (validate.errors || []).map(
    (e) => `${e.instancePath || "/"} ${e.message || ""}`.trim()
  );
  const missingRequired: string[] = [];
  for (const e of validate.errors || []) {
    if (e.keyword === "required") {
      const missing = (e.params as { missingProperty?: string }).missingProperty;
      if (missing) missingRequired.push(missing);
    }
  }
  return { ok: false, errors, missingRequired };
}
