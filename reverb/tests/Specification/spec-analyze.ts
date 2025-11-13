#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const reportsDir = join(__dirname, "reports");
const indexFile = join(reportsDir, "index.json");

if (!existsSync(indexFile)) {
	console.error("No test results found.");
	process.exit(1);
}

const results = JSON.parse(readFileSync(indexFile, "utf-8"));
const firstResult = Array.isArray(results) ? results[0] : results;

let hasFailures = false;

for (const [name, result] of Object.entries(firstResult)) {
	const testResult = result as {
		behavior: string;
	};

	if (testResult.behavior === "INFORMATIONAL") {
		continue;
	}

	if (testResult.behavior === "OK" || testResult.behavior === "NON-STRICT") {
		console.log(`✅ Test case ${name} passed.`);
	} else {
		hasFailures = true;
		console.log(`❌ Test case ${name} failed.`);
	}
}

process.exit(hasFailures ? 1 : 0);
