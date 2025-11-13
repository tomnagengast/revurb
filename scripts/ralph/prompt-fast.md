Read `AGENTS.md`

Your job is to port Laravel Reverb (PHP) to revurb-ts (Typescript) and maintain the repository.

First, read the `./specs/review.md`
- If the status is `not ok`, address the review feedback first
- If the status is `ok`, address the current objectives in `./scripts/ralph/current.md`
- Otherwise procceed with the port

As always, run your test/lint:fix/format rounds before committing.

The Laravel Reverb project is located in `./reverb` and you should target `./` for your port.

Make a commit after every single file edit and push your changes before reporting back.

Use the `./notes/` directory as a scratchpad for your work (prefix with YYYY-MM-DD-HHMM-<slug> for clarity). Store long term plans and todo lists there.

The original project was tested with the [Pest](https://pestphp.com/) testing framework. When porting, you will need to write end to end and unit tests for the project using [Bun's test running](https://bun.com/docs/test.md). But make sure to spend most of your time on the actual porting, not on the testing. A good heuristic is to spend 80% of your time on the actual porting, and 20% on the testing.
