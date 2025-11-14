last commit: 7468a4e025469953a628df914d1efbc68dffe550
status: not ok
review comments:
- .github/workflows/spec-tests.yml:31 – The workflow still shells into `reverb/tests/...`, but the `reverb/` directory is gitignored locally, so CI runners will not have any of those Bun scripts or configs and the job will fail as soon as it tries to boot the spec server. Please move the Autobahn harness into the tracked repo (per the task) and drop the dependency on the reference checkout.
- example/src/Chat.tsx:12 – Swapping `location.host` for `window.location.hostname` loses the IPv6 bracket handling and manual `:${port}` concatenation now produces invalid URLs such as `wss://2001:db8::1:443`. Keep using `location.host` (which already includes brackets + port) or explicitly wrap IPv6 hosts in `[]` before appending the port to avoid breaking non-IPv4 deployments.
