---
"@quartal/plugin": patch
---

String literal values that are also TypeScript type keywords, such as `"unknown"` or `"string"`, are now treated as values. Previously, for a tool returning a field typed `"foobar" | "unknown"`, every result containing that field was rejected by MCP clients.
