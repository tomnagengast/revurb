last commit: de5877358f84b894b9fd0a4afe4b4dd110de9bf3
status: ok
review comments:
- All previous issues have been resolved:
  - .github/workflows/spec-tests.yml:34 now mounts tests/spec/reports at /mnt/autobahn/reports so Autobahn drops artifacts where spec-analyze expects them.
  - README.md:139-146 includes --platform linux/amd64 in the sample docker command, so Apple Silicon users can run the suite.
