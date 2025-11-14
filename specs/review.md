last commit: 3253f78b4bdaa1336f1d0929cefdb4aece184141
status: not ok
review comments:
- .github/workflows/spec-tests.yml:34 mounts tests/spec at /config and tests/spec/reports at /reports even though tests/spec/client-spec.json:3 writes to /mnt/autobahn/reports and tests/spec/spec-analyze.ts:6 reads tests/spec/reports/index.json, so no artifacts ever reach the analyzer.
- README.md:134-146 adds an Autobahn docker command that omits --platform linux/amd64 even though crossbario/autobahn-testsuite ships only amd64 layers, so the instructions fail outright on Apple Silicon.
