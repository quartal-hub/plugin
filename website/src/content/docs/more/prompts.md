---
title: "Prompts"
description: "MCP prompts as simple TypeScript functions — guided starting points for interactive chat."
section: more
order: 1
---

An **MCP prompt** is a reusable, parameterized starting point the user can pick in an interactive
chat — for example "Create invoice", asking only the minimum questions instead of the user writing
a free-form request.

## Create a prompt

Prompt classes live in `src/prompts/` and follow the same convention as tools: each public method
becomes a prompt, its single object parameter's properties become the prompt arguments, and it
returns the instruction text for the agent (a `string`, or `{ messages }` for multi-message
prompts).

```ts
// file: src/prompts/InvoicePrompts.ts

/** Prompts for invoice workflows. */
export class InvoicePrompts {
  /**
   * Guides the user through creating a new invoice.
   * @summary New invoice
   * @param input The prompt arguments.
   */
  newInvoice(input: {
    /** Customer name or business id. */
    customer: string;
    /** Invoice total, e.g. "250 EUR". */
    total?: string;
  }): string {
    return `Create an invoice for ${input.customer}` +
      (input.total ? ` with a total of ${input.total}.` : ". Ask for the total.");
  }
}
```

Export the class from `src/prompts/mod.ts`, and it is advertised via MCP `prompts/list`.

## Important: prompt arguments are strings

The MCP protocol defines prompt arguments as **plain strings** — only `name`, `title` (from
`@summary`), `description` (from the property JSDoc) and `required` (from the property being
non-optional) survive from your TypeScript. Even an argument typed `number` arrives as `"42"` at
runtime, so type prompt arguments as `string` and parse them in your method.
