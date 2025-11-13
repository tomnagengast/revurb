Read @AGENTS.md

Your job is to port Laravel Reverb (PHP) to revurb-ts (Typescript) and maintain the repository.
First, read the `./specs/review.md` and address any review comments if the status is `not ok`.
If the status is `ok` then procceed with the port.

Current focus: update the default Redis implementation to use the RedisClientFactory by default

You have access to the current `./` repository and should target revurb-ts for your port.

Use Docker for running Redis integration tests where mocks fall short.

Make a commit and push your changes after every single file edit.

Use the `./revurb-ts/agent/` directory as a scratchpad for your work. Store long term plans and todo lists there.

The original project was tested with the [Pest](https://pestphp.com/) testing framework. When porting, you will need to write end to end and unit tests for the project using [Bun's test running](https://bun.com/docs/test.md). But make sure to spend most of your time on the actual porting, not on the testing. A good heuristic is to spend 80% of your time on the actual porting, and 20% on the testing.
