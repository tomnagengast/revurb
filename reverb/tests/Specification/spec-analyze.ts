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

// Handle both array and object formats
const firstResult = Array.isArray(results) ? results[0] : results;

// Find the agent results (should be under a key like "Reverb")
const agentKey = Object.keys(firstResult).find(key => key !== "options");
if (!agentKey) {
	console.error("No agent results found in index.json");
	console.error(`Available keys: ${Object.keys(firstResult).join(", ")}`);
	console.error(`Full structure: ${JSON.stringify(firstResult, null, 2).slice(0, 500)}`);
	process.exit(1);
}

const agentResults = firstResult[agentKey];
let hasFailures = false;
let passCount = 0;
let failCount = 0;
const failures: string[] = [];

for (const [name, result] of Object.entries(agentResults)) {
	const testResult = result as {
		behavior: string;
		behaviorClose?: string;
	};

	if (testResult.behavior === "INFORMATIONAL") {
		continue;
	}

	if (testResult.behavior === "OK" || testResult.behavior === "NON-STRICT") {
		passCount++;
	} else {
		hasFailures = true;
		failCount++;
		failures.push(`${name}: ${testResult.behavior}`);
	}
}

console.log(`\nTest Results Summary:`);
console.log(`  Passed: ${passCount}`);
console.log(`  Failed: ${failCount}`);

if (hasFailures) {
	console.log(`\nFailed Tests:`);
	for (const failure of failures.slice(0, 20)) {
		console.log(`  ❌ ${failure}`);
	}
	if (failures.length > 20) {
		console.log(`  ... and ${failures.length - 20} more failures`);
	}
}

process.exit(hasFailures ? 1 : 0);
