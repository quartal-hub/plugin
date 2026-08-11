import type {
  TypeTesterArraysInput,
  TypeTesterArraysResult,
  TypeTesterJsonSchemaFormats,
  TypeTesterMixed,
  TypeTesterNestedObjectInput,
  TypeTesterNestedObjectResult,
  TypeTesterOptionalAndNull,
  TypeTesterPrimitives,
  TypeTesterTree,
  TypeTesterUnionParam,
} from "./model/index.ts";

/**
 * Tester class for validating different parameter types via the Hub API.
 * Each method takes a single object parameter for easy Open API / MCP / RPC schema generation and validation.
 */
export class TypesTester {
  /**
   * Recursive tree type (named interface). Used to verify JSON serialization of codeFiles does not fail with cycles.
   * @param input - Root tree node.
   * @returns Sum of all node values.
   */
  static treeSum(input: TypeTesterTree): number {
    return input.value + (input.children ?? []).reduce((acc, c) => acc + TypesTester.treeSum(c), 0);
  }
  /**
   * Primitives: string, number, boolean.
   * @param input - Object with primitive fields.
   * @returns Echo of the input for verification.
   */
  static primitives(input: TypeTesterPrimitives): TypeTesterPrimitives {
    return { text: input.text, count: input.count, flag: input.flag };
  }

  /**
   * The formats defined in the JSON schema specification. These ar then specified as @format tags in the function documentation.
   *
   * @param input - Object with JSON schema formats.
   * @returns Object with the same values.
   */
  static jsonSchemaFormats(input: TypeTesterJsonSchemaFormats): TypeTesterJsonSchemaFormats {
    return {
      date: input.date,
      dateTime: input.dateTime,
      time: input.time,
      duration: input.duration,
      email: input.email,
      uri: input.uri,
      uriReference: input.uriReference,
      uuid: input.uuid,
    };
  }

  /**
   * Optional and nullable fields.
   * @param input - Object with optional and nullable fields.
   * @returns Summary string.
   */
  static optionalAndNull(input: TypeTesterOptionalAndNull): string {
    const opt = input.optional ?? "(missing)";
    const n = input.nullable ?? 0;
    const nish = input.nullish ?? false;
    return `required=${input.required} optional=${opt} nullable=${n} nullish=${nish}`;
  }

  /**
   * Array types: array of strings and array of numbers.
   * @param input - Object with array fields.
   * @returns Concatenated and summed result.
   */
  static arrays(input: TypeTesterArraysInput): TypeTesterArraysResult {
    const labels = input.labels?.join(", ") ?? "";
    const sum = (input.values ?? []).reduce((a: number, b: number) => a + b, 0);
    return { labels, sum };
  }

  /**
   * Nested object in params.
   * @param input - Object containing a nested object.
   * @returns Flattened result.
   */
  static nestedObject(input: TypeTesterNestedObjectInput): TypeTesterNestedObjectResult {
    return {
      id: input.id,
      name: input.payload.name,
      score: input.payload.score,
    };
  }

  /**
   * Union type parameter (string literal union).
   * @param input - Object with a union field.
   * @returns The chosen value.
   */
  static unionParam(input: TypeTesterUnionParam): { kind: string } {
    return { kind: input.kind };
  }

  /**
   * Mixed: primitives, array, and optional in one object.
   * @param input - Mixed fields for broader validation tests.
   * @returns Echo of key fields.
   */
  static mixed(input: TypeTesterMixed): Record<string, unknown> {
    return {
      title: input.title,
      count: input.count,
      tags: input.tags ?? [],
      meta: input.meta ?? null,
    };
  }
}
