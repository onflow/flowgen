import { NextResponse } from "next/server";
import { fcl } from "@/lib/fcl-server-config";
import { db } from "@/db"; // Ensure this path is correct for your Drizzle db instance
import { eventPollingStatus } from "@/db/schema";
import { eq } from "drizzle-orm";

// --- Configuration ---
// Best practice: Store these in environment variables
const FLOW_NETWORK = process.env.NEXT_PUBLIC_FLOW_NETWORK || "emulator"; // 'emulator', 'testnet', 'mainnet'

const CONTRACT_ADDRESSES = {
	emulator: "0xf8d6e0586b0a20c7",
	testnet: "0x832e53531bdc8fc5",
	mainnet:
		process.env.NEXT_PUBLIC_CANVAS_BACKGROUND_CONTRACT_ADDRESS ||
		"YOUR_MAINNET_CANVAS_BACKGROUND_CONTRACT_ADDRESS_PLACEHOLDER",
};

const STARTING_BLOCKS = {
	emulator: 0,
	testnet: 259000,
	mainnet: 113000,
};

const getContractAddress = (): string => {
	return (
		CONTRACT_ADDRESSES[FLOW_NETWORK as keyof typeof CONTRACT_ADDRESSES] ||
		CONTRACT_ADDRESSES.emulator
	);
};

const getStartingBlock = (): number => {
	return STARTING_BLOCKS[FLOW_NETWORK as keyof typeof STARTING_BLOCKS] || 0;
};

const EVENT_NAME_NEW_BACKGROUND_MINTED_TEMPLATE =
	"CanvasBackground.NewBackgroundMinted";
const MAX_BLOCK_RANGE = 400; // Number of blocks to query at a time, adjust as needed
// Cron Protection: Consider adding a secret key check if this endpoint is publicly accessible
// const CRON_SECRET = process.env.CRON_SECRET;

// --- Helper Functions ---
async function getEventPollingStatus(
	eventName: string
): Promise<{ lastPolledBlock: number; seeded: boolean }> {
	const status = await db
		.select()
		.from(eventPollingStatus)
		.where(eq(eventPollingStatus.eventName, eventName))
		.limit(1)
		.execute();

	if (status.length > 0 && typeof status[0].lastPolledBlock === "number") {
		return { lastPolledBlock: status[0].lastPolledBlock, seeded: true };
	}

	// If not seeded, return the network-specific default starting block
	console.warn(
		`Event ${eventName} not found in event_polling_status. Using default starting block for ${FLOW_NETWORK}. Consider seeding the table.`
	);
	return { lastPolledBlock: getStartingBlock(), seeded: false };
}

async function updateLastPolledBlock(
	eventName: string,
	blockHeight: number,
	wasSeeded: boolean
) {
	if (wasSeeded) {
		await db
			.update(eventPollingStatus)
			.set({ lastPolledBlock: blockHeight, updatedAt: new Date() })
			.where(eq(eventPollingStatus.eventName, eventName))
			.execute();
	} else {
		// If it wasn't seeded, insert the record for the first time
		await db
			.insert(eventPollingStatus)
			.values({
				eventName: eventName,
				lastPolledBlock: blockHeight,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.onConflictDoNothing() // Or use onConflictDoUpdate if you expect races, though getEventPollingStatus should handle one-time default
			.execute();
	}
}

// --- API Route ---
export async function GET(request: Request) {
	// // Cron Protection Example
	// const authHeader = request.headers.get('authorization');
	// if (authHeader !== `Bearer ${CRON_SECRET}`) {
	//   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	// }

	const contractAddress = getContractAddress();
	if (
		FLOW_NETWORK === "mainnet" &&
		contractAddress ===
			"YOUR_MAINNET_CANVAS_BACKGROUND_CONTRACT_ADDRESS_PLACEHOLDER"
	) {
		console.error(
			"Mainnet contract address for CanvasBackground is not configured (NEXT_PUBLIC_CANVAS_BACKGROUND_CONTRACT_ADDRESS)."
		);
		return NextResponse.json(
			{ error: "Mainnet contract address not configured" },
			{ status: 500 }
		);
	}

	const eventFQN = `A.${contractAddress}.${EVENT_NAME_NEW_BACKGROUND_MINTED_TEMPLATE}`;
	console.log(`Starting cron job for ${eventFQN} on ${FLOW_NETWORK} network.`);

	try {
		const { lastPolledBlock: initialFromBlock, seeded: wasSeeded } =
			await getEventPollingStatus(eventFQN);

		const latestBlock = await fcl.block({ sealed: true });
		const currentChainHeight = latestBlock.height;

		let fromBlock = initialFromBlock + 1; // Start from the block after the last one polled

		if (fromBlock > currentChainHeight) {
			console.log(
				`No new blocks to poll for ${eventFQN}. Last polled block: ${initialFromBlock}, Current chain height: ${currentChainHeight}`
			);
			return NextResponse.json({
				message: "No new blocks to poll",
				lastPolledBlock: initialFromBlock,
				currentChainHeight,
			});
		}

		console.log(
			`Polling ${eventFQN} from block ${fromBlock} to ${currentChainHeight}.`
		);

		let allEvents: any[] = [];
		let lastSuccessfullyProcessedBlock = initialFromBlock;

		for (
			let currentQueryFromBlock = fromBlock;
			currentQueryFromBlock <= currentChainHeight;
			currentQueryFromBlock += MAX_BLOCK_RANGE
		) {
			const currentQueryToBlock = Math.min(
				currentQueryFromBlock + MAX_BLOCK_RANGE - 1,
				currentChainHeight
			);

			console.log(
				`Fetching ${eventFQN} events for block range: ${currentQueryFromBlock} - ${currentQueryToBlock}`
			);

			try {
				const eventsInRange = (await fcl.getEventsAtBlockHeightRange(
					eventFQN,
					currentQueryFromBlock,
					currentQueryToBlock
				)) as unknown as any[];

				if (eventsInRange && eventsInRange.length > 0) {
					console.log(
						`Found ${eventsInRange.length} '${eventFQN}' events in range ${currentQueryFromBlock}-${currentQueryToBlock}.`
					);
					allEvents = allEvents.concat(eventsInRange);
					// --- Process Events ---
					for (const event of eventsInRange) {
						console.log(
							"Processing Event:",
							JSON.stringify(event.data, null, 2)
						);
						console.log(`  Event Type: ${event.type}`);
						console.log(`  Transaction ID: ${event.transactionId}`);
						console.log(`  Block Height: ${event.blockHeight}`);

						// TODO: Implement your actual data processing logic here
						// Example: Save to database, trigger notifications, etc.
						// const { id, imageHash, versionNumber, latestBackgroundNftID } = event.data;
						// await db.insert(someOtherTable).values({ field1: id, field2: imageHash, ... });
					}
					// --- End Process Events ---
				}
				lastSuccessfullyProcessedBlock = currentQueryToBlock; // Update to the end of the successfully fetched and processed range
			} catch (rangeError) {
				console.error(
					`Error fetching or processing events for range ${currentQueryFromBlock}-${currentQueryToBlock} for ${eventFQN}:`,
					rangeError
				);
				// If a range fails, we stop and update up to the last fully successful block before this failed range.
				// lastSuccessfullyProcessedBlock would still hold the value from the end of the *previous* successful range.
				await updateLastPolledBlock(
					eventFQN,
					lastSuccessfullyProcessedBlock,
					wasSeeded
				);
				console.log(
					`Partial success. Updated lastPolledBlock for ${eventFQN} to ${lastSuccessfullyProcessedBlock} due to error in a subsequent range.`
				);
				return NextResponse.json(
					{
						error: "Failed to poll a range of events",
						details: (rangeError as Error).message,
						event: eventFQN,
						lastSuccessfullyProcessedBlock,
					},
					{ status: 500 }
				);
			}
		}

		await updateLastPolledBlock(
			eventFQN,
			lastSuccessfullyProcessedBlock,
			wasSeeded
		);
		console.log(
			`Successfully polled ${eventFQN}. Updated lastPolledBlock to ${lastSuccessfullyProcessedBlock}. Total events processed: ${allEvents.length}`
		);

		return NextResponse.json({
			message: "Polling successful",
			event: eventFQN,
			queriedFromBlock: fromBlock,
			queriedToBlock: currentChainHeight,
			lastSuccessfullyProcessedBlock: lastSuccessfullyProcessedBlock,
			eventsFound: allEvents.length,
			processedEventsData: allEvents.map((e) => e.data), // Optional: return data if needed by cron caller
		});
	} catch (error) {
		console.error(`Unhandled error during cron job for ${eventFQN}:`, error);
		// For unhandled errors, lastPolledBlock is not updated, so it retries from the same point.
		return NextResponse.json(
			{ error: "Failed to poll events", details: (error as Error).message },
			{ status: 500 }
		);
	}
}
