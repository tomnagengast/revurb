last commit: a37c1b2d7c977132e51bd2f1ebff850fbaef1d93
status: not ok
review comments:
- `revurb-ts/src/Servers/Reverb/factory.ts:1090` now forwards headers from `HttpResponse`, but `revurb-ts/src/Servers/Reverb/Http/response.ts:40` never sets a default `Content-Type` and callers such as `revurb-ts/src/Protocols/Pusher/Http/Controllers/channels-controller.ts:83` don’t define one either, so every JSON endpoint is currently emitted without a `Content-Type` header, breaking the Pusher HTTP contract for `application/json` responses; please set the header in `HttpResponse` or inject a default inside `convertToResponse`.
