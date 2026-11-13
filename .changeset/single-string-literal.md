---
"@quartal/plugin": patch
---

A field typed with a single string literal, such as `kind: "only"`, gets a one-value enum. Previously its schema and validation incorrectly allowed any value.
