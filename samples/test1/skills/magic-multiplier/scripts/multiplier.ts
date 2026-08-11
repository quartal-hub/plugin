/**
 * Magic multiplier constant for the `magic-multiplier` demo skill.
 *
 * The value is deliberately a non-round number so a test prompt that
 * succeeds in producing the expected product proves the agent actually
 * read this file rather than guessing a plausible answer.
 */
export const MAGIC_MULTIPLIER = 7.13;

/**
 * Reference helper showing how the constant is meant to be applied.
 * The agent is expected to follow the SKILL.md instructions and
 * compute `n * MAGIC_MULTIPLIER` directly — this function is not
 * executed at runtime, it just documents the intent.
 */
export function applyMagicMultiplier(n: number): number {
  return n * MAGIC_MULTIPLIER;
}
