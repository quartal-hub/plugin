/**
 * `@quartal/plugin/elicit` — ask the user for input in the middle of a tool call (MCP
 * elicitation): a form with `elicitForm`, or a page to open with `elicitUrl`.
 * @module
 */
export { elicitForm } from "./elicitForm.ts";
export { elicitUrl } from "./elicitUrl.ts";
export type {
  ElicitFormOptions,
  ElicitFormResult,
  ElicitUrlOptions,
  ElicitUrlResult,
} from "../model/index.ts";
