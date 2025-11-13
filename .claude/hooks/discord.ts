#!/usr/bin/env bun
// bun run .claude/hooks/discord.ts --start --message "Prompt submitted"
// bun run .claude/hooks/discord.ts --stop  --message "Task finished"

const DISCORD_WEBHOOK_URL = Bun.env.CLAUDE_CODE_DISCORD_WEBHOOK_URL;
if (!DISCORD_WEBHOOK_URL) {
	console.error("Missing CLAUDE_CODE_DISCORD_WEBHOOK_URL in env");
}

const argv = Bun.argv.slice(2);

let mode: "start" | "stop" | null = null;
let message: string | null = null;

// Simple arg parser
for (let i = 0; i < argv.length; i++) {
	const a = argv[i];

	if (a === "--start") mode = "start";
	else if (a === "--stop") mode = "stop";
	else if (a === "--message") {
		message = argv[i + 1];
		i++; // skip value
	}
}

// if no --message get it from stdin
if (!message) {
	message = await Bun.stdin.getReader().read();
}

if (!mode) {
	console.error("Must provide --start or --stop");
	Bun.exit(1);
}

if (!message) {
	console.error('Must provide message');
	Bun.exit(1);
}

async function sendDiscord(title: string, desc: string, color: number) {
	const payload = {
		title,
		description: desc,
		color,
		timestamp: new Date().toISOString(),
	};

	const res = await fetch(DISCORD_WEBHOOK_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ embeds: [payload] }),
	});

	if (!res.ok) {
		console.error("Discord webhook failed:", res.status, await res.text());
		Bun.exit(1);
	}
}

const color = mode === "start" ? 0x0099ff : 0xd2691e;
const cleanHome = () => process.cwd().replace(Bun.env.HOME ?? "", "~");

sendDiscord(cleanHome(), message, color).catch((err) => {
	console.error(err);
	Bun.exit(1);
});
