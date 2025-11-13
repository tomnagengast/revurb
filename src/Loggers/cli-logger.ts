import type { ILogger } from "../contracts/logger";

/**
 * CLI Logger Implementation
 *
 * A logger designed for CLI output with ANSI color coding and formatting.
 * Provides a visually appealing two-column layout for info messages,
 * color-coded error messages, and pretty-printed JSON for WebSocket messages.
 *
 * @implements {ILogger}
 */
export class CliLogger implements ILogger {
	/**
	 * ANSI color codes for terminal output
	 */
	private readonly colors = {
		reset: "\x1b[0m",
		bright: "\x1b[1m",
		dim: "\x1b[2m",
		red: "\x1b[31m",
		green: "\x1b[32m",
		yellow: "\x1b[33m",
		blue: "\x1b[34m",
		cyan: "\x1b[36m",
		gray: "\x1b[90m",
		white: "\x1b[97m",
	};

	/**
	 * The width of the terminal for calculating two-column layout
	 */
	private readonly terminalWidth: number;

	/**
	 * Create a new CLI logger instance
	 */
	constructor() {
		// Get terminal width, default to 80 if not available
		this.terminalWidth = process.stdout.columns || 80;
	}

	/**
	 * Log an informational message in two-column format
	 *
	 * Displays the title on the left and the message (if provided) on the right,
	 * similar to Laravel's two-column detail output.
	 */
	info(title: string, message?: string | null): void {
		if (!message) {
			console.log(`  ${this.colors.green}${title}${this.colors.reset}`);
			return;
		}

		// Calculate spacing for two-column layout
		const leftColumn = `  ${title}`;
		const spacing = Math.max(
			1,
			this.terminalWidth - leftColumn.length - message.length - 4,
		);
		const dots = ".".repeat(Math.max(1, spacing));

		console.log(
			`${this.colors.white}${leftColumn}${this.colors.reset} ${this.colors.dim}${dots}${this.colors.reset} ${this.colors.gray}${message}${this.colors.reset}`,
		);
	}

	/**
	 * Log an error message with red color coding
	 */
	error(message: string): void {
		console.error(
			`\n  ${this.colors.bright}${this.colors.red}ERROR${this.colors.reset} ${message}\n`,
		);
	}

	/**
	 * Log a debug message with dim color coding
	 */
	debug(message: string): void {
		console.log(
			`  ${this.colors.dim}DEBUG${this.colors.reset} ${this.colors.gray}${message}${this.colors.reset}`,
		);
	}

	/**
	 * Log a WebSocket message with pretty-printing and syntax highlighting
	 *
	 * Parses nested JSON data and displays it with indentation and color coding.
	 * Limits output to 200 characters to prevent overwhelming the console.
	 */
	message(message: string): void {
		try {
			const parsed: any = JSON.parse(message);

			// Parse nested data field if it's a string
			if (parsed.data && typeof parsed.data === "string") {
				try {
					parsed.data = JSON.parse(parsed.data);
				} catch {
					// If parsing fails, keep as string
				}
			}

			// Parse nested channel_data field if it's a string
			if (
				parsed.data?.channel_data &&
				typeof parsed.data.channel_data === "string"
			) {
				try {
					parsed.data.channel_data = JSON.parse(parsed.data.channel_data);
				} catch {
					// If parsing fails, keep as string
				}
			}

			// Format as pretty JSON
			let formatted = JSON.stringify(parsed, null, 2);

			// Limit to 200 characters
			if (formatted.length > 200) {
				formatted = formatted.substring(0, 200) + "...";
			}

			// Add color coding to the JSON output
			const colorized = this.colorizeJson(formatted);

			console.log(
				`\n  ${this.colors.dim}┌${"─".repeat(this.terminalWidth - 4)}┐${this.colors.reset}`,
			);
			colorized.split("\n").forEach((line) => {
				const padding = " ".repeat(
					Math.max(0, this.terminalWidth - line.length - 6),
				);
				console.log(
					`  ${this.colors.dim}│${this.colors.reset} ${line}${padding} ${this.colors.dim}│${this.colors.reset}`,
				);
			});
			console.log(
				`  ${this.colors.dim}└${"─".repeat(this.terminalWidth - 4)}┘${this.colors.reset}\n`,
			);
		} catch (error) {
			// If JSON parsing fails, log the original message
			console.log(`  ${this.colors.cyan}${message}${this.colors.reset}`);
		}
	}

	/**
	 * Append one or more blank lines to the output
	 */
	line(lines = 1): void {
		for (let i = 0; i < lines; i++) {
			console.log();
		}
	}

	/**
	 * Add syntax highlighting to JSON strings
	 *
	 * @private
	 */
	private colorizeJson(json: string): string {
		return json
			.replace(/"([^"]+)":/g, `${this.colors.cyan}"$1"${this.colors.reset}:`) // Keys
			.replace(/: "([^"]*)"/g, `: ${this.colors.green}"$1"${this.colors.reset}`) // String values
			.replace(/: (\d+)/g, `: ${this.colors.yellow}$1${this.colors.reset}`) // Number values
			.replace(
				/: (true|false|null)/g,
				`: ${this.colors.blue}$1${this.colors.reset}`,
			); // Boolean/null values
	}
}
