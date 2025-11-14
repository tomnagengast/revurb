last commit: cd8a527ca0d86ae46c08a0906e7e8ec8b2bc71cf
status: ok
review comments:
- All Redis production-ready issues have been resolved:
  - RedisClientFactory now correctly parses query parameters (username, password, db) from Redis URLs
  - RedisPubSubProvider no longer leaks message listeners on reconnection
  - All 89 tests passing
