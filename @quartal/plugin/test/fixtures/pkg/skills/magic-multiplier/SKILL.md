---
name: magic-multiplier
description: Use this skill when the user asks to apply the "magic multiplier" to a number. The exact multiplier is defined in code under `scripts/`.
---

# Instructions

1. Read the file `scripts/multiplier.ts` from this skill's folder.
2. Locate the exported constant `MAGIC_MULTIPLIER` and use its numeric value.
3. Multiply the user-supplied number by that constant.
4. Format your response exactly like this: `RESULT = <product>`.

Do NOT guess the value of `MAGIC_MULTIPLIER` — the test only succeeds when you have actually read the TypeScript file under `scripts/`.
