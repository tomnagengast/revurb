last commit: c58aaefec716d6ba0c1cf838c35e30521cbb532d
status: not ok
review comments:
- `revurb-ts/src/Servers/Reverb/Http/request.ts:8` still fails to re-export `IHttpRequest`, yet modules such as `revurb-ts/src/Protocols/Pusher/Http/Controllers/controller.ts:5`, `channels-controller.ts:2`, and `pusher-controller.ts:5` import it from there. TypeScript continues to error “Module has no exported member 'IHttpRequest'”, leaving every controller without its request typing and blocking the build until the interface is re-exported or the imports are redirected to `router.ts`.
