# Ralph

Ralph is simple. It's an endless `while` loop that passes a prompt to an agent. With each turn the agent reads the prompt and brings the codebase closer to the expected truth of the prompt. Think of it as a practice in eventual consistency.

Start ralph with:
```sh
bash scripts/ralph/ralph.sh
```

---

This project has a few extra bells and whistles to see what it would look like to get creative with ralph.

It relies on a few key files:

- `ralph.sh`: This is the while loop mentioned above. I've added a loop counter which can be handy to see how many turns have occurred.
- `sync.sh`: This is what happens with each turn. Here we get a little creative:
    1. Setup by pulling any changes on remote and sending a message to discord that ralph is trying something new
    2. The first call is to the `doer` (Composer 1). We pass it `prompt-fast.md` and it just needs throw things at the wall come back to us
    3. The second call is to the `reviewer` (GPT 5 Codex High). We pass it `prompt-smart.md` and it's just to guide the `doer` in the right direction
    4. Wrap up by sending a summary to discord
- `current.md`: This allows us to gently guide ralph. The core prompts are intentionally vauge and this file let's up nudge it a direction the `reviewer` might not have done otherwise.

And that's it! Shout out to the [repomirror](https://github.com/repomirrorhq/repomirror/blob/main/repomirror.md) team for pushing this concept.
