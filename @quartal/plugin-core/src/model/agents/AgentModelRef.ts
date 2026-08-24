/**
 * The model an agent runs on, normalized to a provider-qualified id.
 *
 * Authors may write a provider-qualified id (`openai/gpt-5.1`), a bare model id
 * (`claude-opus-5`), a Claude alias (`sonnet`) or `inherit`. Bare ids and aliases are read as
 * Claude models — the Claude agent format is the baseline — but the resolved value always names
 * its provider so non-Claude hosts do not have to guess.
 */
export interface AgentModelRef {
  /** Model exactly as authored (`sonnet`, `claude-opus-5`, `openai/gpt-5.1`, `inherit`). */
  value: string;
  /** Provider id (`anthropic` when the value carried no `provider/` prefix). Omitted for `inherit`. */
  provider?: string;
  /** Provider-specific model id (`claude-sonnet-5`). Omitted for `inherit`. */
  model?: string;
  /** Canonical `provider/model` id. Omitted for `inherit`. */
  id?: string;
  /** Claude alias used in the source (`sonnet`, `opus`, `haiku`, `fable`), when one was used. */
  alias?: string;
  /** True when the agent runs on whatever model the host session is using. */
  inherit?: boolean;
}
