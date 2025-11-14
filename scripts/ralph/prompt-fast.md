
Your job is to port Laravel Reverb (PHP) to revurb-ts (Typescript) and maintain the repository.

## Instructions
Read `AGENTS.md` and

- 0a. familiarize yourself with the code in `src` and `tests`
- 0b. familiarize yourself with the REACT_CODING_STANDARDS.md
- 1. read @REACT_REFACTOR_PLAN.md and complete the SINGLE highest priority item using up to 50 subagents
- 2. run the tests with `make -C humanlayer-wui check test` and fix issues until they pass
- 3. Update REACT_REFACTOR_PLAN.md with your progress
- 4. use `git add -A` and `git commit -m "..."` to commit your changes - do not include any claude attribution

First, read the `./specs/review.json`
- If the status is `not ok`, address the review feedback first
- If the status is `ok`, address the current objectives in `./scripts/ralph/current.md`
- Otherwise procceed with the port

As always, run your test / lint:fix / format rounds before committing.

The Laravel Reverb project is located in `~/personal/_clones/laravel/reverb` and you should target this directory for your port.

Make a commit after every single file edit and push your changes before reporting back.

Use the `./notes/` directory as a scratchpad for your work (prefix with `YYYY-MM-DD-HHMM-<slug>` for clarity). Store long term plans and todo lists there.
