# Restructure to monorepo

Given what we've learned during development, we need to restructure our repo into a monorepo.
This should utilize Bun APIs as much as possible and should align with the laravel implemenation and spirit as much as possible.

Currently we have:
```
.
├── example              # Revurb demo app
├── scripts
├── src                  # Revurb source
└── tests                # Revurb tests
```

Which feel awkward now that we've realized we want to include another package, Echo, in this repo.
We should restrucuture the demo to the following:
```
.
├── apps
│   └── demo             # Revurb demo app
├── packages
│   ├── echo             # Echo source
│   └── revurb           # Revurb source
└── scripts
```

We've started a rough-cut of Echo in `example/src/lib/useRevurb.ts` which should be replaced by.
We want to migrate that and improve upon it based on these influential sources:
- `~/personal/_clones/laravel/echo`
- `~/personal/_clones/stephenjason89/bun-pulse`


## Reference
- Read `.claude/skills/bun`
- Use `rg` to navigate `.claude/skills/bun/references/llms-full.txt` since it's a _very_ large file
