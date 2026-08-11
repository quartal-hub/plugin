# About the demo skills

The skills in these folders are testable skills. First 5 can be evaluated without any external tools scripting environment etc.:

- verification-seal
- l33t-translator
- sentiment-tagger
- coin-flipper
- protocol-x

The skills below `magic-multiplier` exercise the standard sub-folder layout (`scripts/`, `references/`, `assets/`). Each is designed so the
success criterion can only be met if the agent actually opens and reads from the matching sub-folder — they double as smoke tests for
sub-folder navigation.

## The Verification Seal (Signature Skill)

- Name: `verification-seal`
- Goal: Verify the agent can find and apply a specific instruction to its output.
- Prompt: "Tell me about the weather today and apply the verification seal."
- Success Criteria: The response contains the exact string [VERIFIED-AGENT-ACTION].

## The L33t Speak Translator (Transformation Skill)

- Name: `l33t-translator`
- Goal: Verify the agent can follow a multi-step logical instruction (procedural knowledge).
- Prompt: "Use the l33t skill to say 'Hello World'."
- Success Criteria: The response contains H3110 W0r1d.

## The Sentiment Tagged Response (Output Formatting)

- Name: `sentiment-tagger`
- Goal: Verify the agent can categorize its own response based on internal instructions.
- Prompt: "Write a short happy story using the sentiment tagger."
- Success Criteria: The response starts with [SENTIMENT: POSITIVE].

## The Virtual "Coin Flip" (Deterministic Choice)

- Name: `coin-flipper`
- Goal: Verify the agent can simulate a tool-like action using only instructions.
- Prompt: "Flip a coin using the coin skill."
- Success Criteria: The response contains the specific phrase VIRTUAL_FLIP_RESULT:.

## The Protocol "X" Wrapper (Constraint Testing)

- Name: `protocol-x`
- Goal: Verify the agent can adhere to strict "system-level" constraints defined in a skill.
- Prompt: "Summarize the history of AI using Protocol X."
- Success Criteria: The response is strictly one sentence and ends with [EOF].

## The Magic Multiplier (`scripts/` sub-folder, TypeScript)

- Name: `magic-multiplier`
- Goal: Verify the agent can navigate into a `scripts/` sub-folder, read a TypeScript file, and apply a constant exported from it.
- Layout: `magic-multiplier/SKILL.md` + `magic-multiplier/scripts/multiplier.ts` (exports `MAGIC_MULTIPLIER = 7.13`).
- Prompt: "Apply the magic multiplier to 10."
- Success Criteria: The response contains `RESULT = 71.3` (i.e. 10 × 7.13). A response with any other product proves the agent guessed
  instead of reading the file.

## The QRTL Glossary (`references/` sub-folder)

- Name: `qrtl-glossary`
- Goal: Verify the agent can navigate into a `references/` sub-folder and quote a definition verbatim.
- Layout: `qrtl-glossary/SKILL.md` + `qrtl-glossary/references/glossary.md` (defines `QRTL-ALPHA`, `QRTL-BETA`, `QRTL-GAMMA`, `QRTL-DELTA`).
- Prompt: "What does QRTL-ALPHA mean?"
- Success Criteria: The response contains the exact phrase `first phase of the Quartal Messages rollout, focused on advisor onboarding`.
  Paraphrases fail — the test asserts the agent copied the definition rather than synthesising one.

## The Letterhead Stamp (`assets/` sub-folder)

- Name: `letterhead-stamp`
- Goal: Verify the agent can navigate into an `assets/` sub-folder and inline a static asset's contents byte-for-byte at the start of its
  response.
- Layout: `letterhead-stamp/SKILL.md` + `letterhead-stamp/assets/letterhead.txt` (a fixed 4-line letterhead block).
- Prompt: "Compose a brief greeting using the letterhead stamp."
- Success Criteria: The response begins with the exact line `QUARTAL MESSAGES // INTERNAL CORRESPONDENCE` (followed by the rest of the
  letterhead block, then the greeting). Any reformatting or summarising of the asset fails the test.
