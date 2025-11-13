last commit: df6777b987e02bd16bfddbf2dbc8e97cde56d132
status: not ok
review comments:
- `revurb-ts/src/Servers/Reverb/Http/request.ts:257` no longer exports `IHttpRequest`, but `revurb-ts/src/Protocols/Pusher/Http/Controllers/controller.ts:5`, `channels-controller.ts:2`, and `pusher-controller.ts:5` still import it. TypeScript now errors "Module has no exported member 'IHttpRequest'" and these controllers lose their request typing, so the port doesn’t compile until the interface is re-exported or the imports are pointed at `router.ts` instead.
