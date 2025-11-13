last commit: e9f97a8
status: not ok
review comments:
- src/certificate.ts:29 – The static helpers now call Certificate.resolve/paths/herdPath directly instead of using `this`, so any subclass overrides are ignored. The PHP source uses `static::` for late binding, so this change regresses the ability to customize certificate directories and deviates from Laravel Reverb’s behavior.
