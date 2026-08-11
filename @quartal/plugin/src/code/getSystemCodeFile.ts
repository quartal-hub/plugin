import type { CodeFile } from "../model/index.ts";
import type { CodePropOrParam } from "../model/index.ts";
import type { CodeType } from "../model/index.ts";

function valueProp(type: CodePropOrParam["type"]): CodePropOrParam {
  return {
    name: "value",
    type,
    description: "",
  };
}

/**
 * Virtual "system" code file that defines value-wrapper types.
 * Used so that OpenAPI and Zod reflect the rule: result is always an object;
 * when the method returns a primitive or array, the response is { value: result }.
 */
export function getSystemCodeFile(): CodeFile {
  const types: CodeType[] = [
    {
      name: "StringValue",
      description: "Input/reponse is simple string value, but in API we wrap values as objects.",
      properties: [valueProp("string")],
      extends: [],
    },
    {
      name: "NumberValue",
      description: "Input/reponse is simple number value, but in API we wrap values as objects.",
      properties: [valueProp("number")],
      extends: [],
    },
    {
      name: "BooleanValue",
      description: "Input/reponse is simple boolean value, but in API we wrap values as objects.",
      properties: [valueProp("boolean")],
      extends: [],
    },
    {
      name: "NullValue",
      description: "Input/reponse is simple null value, but in API we wrap values as objects.",
      properties: [valueProp("null")],
      extends: [],
    },
    {
      name: "ArrayValue",
      description: "Input/reponse is simple array value, but in API we wrap values as objects.",
      properties: [valueProp({ items: "unknown" })],
      extends: [],
    },
    {
      name: "UndefinedValue",
      description: "Input/reponse is 'undefined'. This is a marker for no return value / input parameter. => Object with no properties.",
      properties: [],
      extends: [],
    },
    {
      name: "VoidValue",
      description: "Input/reponse is 'void'. This is a marker for no return value / input parameter. => Currently an empty object.",
      properties: [],
      extends: [],
    },
    {
      name: "UnknownValue",
      description: "Unknown value type.",
      properties: [valueProp("unknown")],
      extends: [],
    },
  ];

  return {
    name: "__system__.ts",
    lang: "ts",
    path: "__system__.ts",
    content: "",
    classes: [],
    types,
  };
}
