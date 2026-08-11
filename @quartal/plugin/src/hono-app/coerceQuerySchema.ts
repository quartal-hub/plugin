import { z } from "@hono/zod-openapi";

/** Read description and example from a Zod type (unwrap optional so we read from inner). */
function getDescriptionAndExample(
  value: z.ZodTypeAny,
): { description?: string; example?: unknown } {
  const inner: z.ZodTypeAny = value instanceof z.ZodOptional ? (value as any)._def.innerType : value;
  const def = (inner as any)._def;
  const description = def?.description ?? (inner as any).description;
  const example = def?.openapi?.example ?? def?.example;
  return { description, example };
}

function withMeta<T extends z.ZodTypeAny>(
  schema: T,
  meta: { description?: string; example?: unknown },
): T {
  let s = schema;
  if (meta.description) {
    s = s.describe(meta.description) as T;
  }
  if (meta.example !== undefined && typeof (s as any).openapi === "function") {
    s = (s as any).openapi({ example: meta.example }) as T;
  }
  return s;
}

/** Coerce query-string values to numbers/booleans for GET OpenAPI routes. */
export function coerceNumberAndBooleanObject(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (!(schema instanceof z.ZodObject)) return schema;

  const shape = schema.shape as Record<string, z.ZodTypeAny>;
  const newShape: Record<string, z.ZodTypeAny> = {};

  for (const [key, value] of Object.entries(shape)) {
    if (value instanceof z.ZodNumber) {
      const meta = getDescriptionAndExample(value);
      const base = z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number());
      newShape[key] = withMeta(base, meta);
      continue;
    }

    if (value instanceof z.ZodBoolean) {
      const meta = getDescriptionAndExample(value);
      const base = z.preprocess((v) => (v === "" ? undefined : v), z.coerce.boolean());
      newShape[key] = withMeta(base, meta);
      continue;
    }

    if (
      value instanceof z.ZodOptional &&
      (value as any)._def.innerType instanceof z.ZodNumber
    ) {
      const meta = getDescriptionAndExample(value);
      const base = z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number()).optional();
      newShape[key] = withMeta(base, meta);
      continue;
    }

    if (
      value instanceof z.ZodOptional &&
      (value as any)._def.innerType instanceof z.ZodBoolean
    ) {
      const meta = getDescriptionAndExample(value);
      const base = z.preprocess((v) => (v === "" ? undefined : v), z.coerce.boolean()).optional();
      newShape[key] = withMeta(base, meta);
      continue;
    }

    newShape[key] = value;
  }

  return z.object(newShape);
}
