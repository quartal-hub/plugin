---
"@quartal/plugin": patch
---

REST routes answer HTTP 200 when a tool succeeds and its result has an `error` property. A failure is
detected from the thrown error, not from the shape of the result: a thrown error is answered with
HTTP 500 and `{ "error": "<message>" }`, and an `HTTPException` keeps its own status.
