import cron from "node-cron";

const POLLER_ENDPOINT = "http://localhost:3000/api/cron/flow-event-poller";

// Schedule to run every minute
// You can change the cron expression as needed. E.g., '*/5 * * * *' for every 5 minutes.
// See https://crontab.guru/ for help with cron expressions.
cron.schedule("* * * * *", async () => {
	console.log(
		`[${new Date().toISOString()}] Triggering local cron job for: ${POLLER_ENDPOINT}`
	);
	try {
		const response = await fetch(POLLER_ENDPOINT, {
			method: "POST",
		});
		const responseBody = await response.text(); // Use .json() if you expect JSON and want to parse it
		console.log(
			`[${new Date().toISOString()}] Cron job response (${
				response.status
			}): ${responseBody}`
		);
	} catch (error) {
		console.error(
			`[${new Date().toISOString()}] Error triggering cron job:`,
			error
		);
	}
});

console.log("Local cron scheduler started. Waiting for tasks...");
