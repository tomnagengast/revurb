last commit: 3a15be23cb26517192c651a8a9f8b49847f893dc
status: not ok
review comments:
- `revurb-ts/src/Servers/Reverb/Http/response.ts:54` always sets `Content-Type: application/json` without checking for existing `content-type` keys that only differ by casing (see `revurb-ts/src/Servers/Reverb/Http/server.ts:197` and :203/:212, which intentionally send `text/plain`). Because `Map.has('Content-Type')` misses the lowercase entries, the response now emits two conflicting headers and clients may follow the JSON one, so callers can no longer override the MIME type; normalize header keys or skip the default whenever any Content-Type header is present.
