---
name: letterhead-stamp
description: Use this skill when the user asks to apply the "letterhead stamp" to a response. The exact letterhead block is stored under `assets/`.
---

# Instructions

1. Read the file `assets/letterhead.txt` from this skill's folder.
2. Begin your response with the contents of that file, byte-for-byte.
3. Add a single blank line after the letterhead block, then write the actual reply to the user's request.

Do NOT reformat, summarise, or trim the letterhead — the test asserts the response begins with the file's exact contents.
