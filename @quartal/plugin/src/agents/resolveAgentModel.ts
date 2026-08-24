import type { AgentModelRef } from "../model/index.ts";

/**
 * Claude model aliases accepted by the Claude agent format, mapped to the model ids they stand
 * for. Exported so a host can override the mapping when Anthropic ships a new generation.
 */
export const CLAUDE_MODEL_ALIASES: Record<string, string> = {
  fable: "claude-fable-5",
  opus: "claude-opus-5",
  sonnet: "claude-sonnet-5",
  haiku: "claude-haiku-4-5",
};

/** Provider assumed when a model is written without a `provider/` prefix. */
export const DEFAULT_MODEL_PROVIDER = "anthropic";

/**
 * Normalizes an authored model value into a provider-qualified reference.
 *
 * `inherit` is passed through as a flag. Everything else is split on the first `/` into
 * provider and model; a value without a `/` is read as a Claude model (an alias such as `sonnet`
 * or a full id such as `claude-opus-5`), which is what keeps the Claude agent format working
 * unchanged while giving non-Claude hosts an unambiguous id.
 * @param value Model as authored (`sonnet`, `claude-opus-5`, `openai/gpt-5.1`, `inherit`).
 * @param aliases Alias table to resolve short Claude names with.
 */
export function resolveAgentModel(
  value: string,
  aliases: Record<string, string> = CLAUDE_MODEL_ALIASES,
): AgentModelRef | undefined {
  const raw = value.trim();
  if (!raw) return undefined;
  if (raw === "inherit") return { value: raw, inherit: true };

  const slash = raw.indexOf("/");
  if (slash > 0) {
    const provider = raw.slice(0, slash).trim();
    const model = raw.slice(slash + 1).trim();
    if (!model) return { value: raw, provider, model: "", id: `${provider}/` };
    return { value: raw, provider, model, id: `${provider}/${model}` };
  }

  const alias = Object.hasOwn(aliases, raw) ? raw : undefined;
  const model = alias ? aliases[alias] : raw;
  return {
    value: raw,
    provider: DEFAULT_MODEL_PROVIDER,
    model,
    id: `${DEFAULT_MODEL_PROVIDER}/${model}`,
    ...(alias ? { alias } : {}),
  };
}
