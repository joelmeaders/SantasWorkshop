const DEFAULT_FUNCTIONS_URL =
	'http://127.0.0.1:5001/demo-santashop/us-central1';
const READY_FUNCTION_NAME = 'testClearAllData';
const RETRY_DELAY_MS = 500;
const TIMEOUT_MS = 60_000;

const functionsUrl =
	process.env.FUNCTIONS_EMULATOR_URL ?? DEFAULT_FUNCTIONS_URL;
const readinessUrl = `${functionsUrl}/${READY_FUNCTION_NAME}`;
const deadline = Date.now() + TIMEOUT_MS;
let lastFailure = 'Functions emulator did not respond.';

while (Date.now() < deadline) {
	try {
		const response = await fetch(readinessUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ data: {} }),
		});
		const responseBody = await response.text();

		if (response.ok) {
			console.log(
				`Functions emulator is ready (${READY_FUNCTION_NAME}).`,
			);
			process.exit(0);
		}

		lastFailure = `${response.status} ${response.statusText}: ${responseBody}`;
	} catch (error) {
		lastFailure = error instanceof Error ? error.message : String(error);
	}

	await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
}

throw new Error(
	`Functions emulator did not load ${READY_FUNCTION_NAME} within ${
		TIMEOUT_MS / 1000
	} seconds. Last failure: ${lastFailure}`,
);
