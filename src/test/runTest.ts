import * as path from 'path';

import { runTests } from '@vscode/test-electron';

async function main() {
	try {
		// The folder containing the Extension Manifest package.json
		// Passed to `--extensionDevelopmentPath`
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');

		// The path to test runner
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(__dirname, './suite/index');

		// Run against the oldest supported VS Code family declared in package.json.
		await runTests({ extensionDevelopmentPath, extensionTestsPath, version: '1.84.2' });
	} catch (err) {
		console.error('Failed to run tests', err);
		process.exit(1);
	}
}

main();
