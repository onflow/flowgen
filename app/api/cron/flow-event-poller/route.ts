import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db"; // Corrected import path
import { flowEventTracker, flowEvents } from "@/db/schema";
import { eq } from "drizzle-orm";

const FLOW_ACCESS_NODE_URL = process.env.FLOW_ACCESS_NODE_URL;
const FLOW_CONTRACT_ADDRESS = process.env.FLOW_CONTRACT_ADDRESS;

const POLLING_BLOCK_CHUNK_SIZE = parseInt(
	process.env.POLLING_BLOCK_CHUNK_SIZE || "100",
	10
);
const MAX_BLOCKS_PER_CRON_RUN = parseInt(
	process.env.MAX_BLOCKS_PER_CRON_RUN || "500",
	10
);

// Define the event types to monitor based on your contract
const EVENT_TYPES_TO_MONITOR = [
	`A.${FLOW_CONTRACT_ADDRESS}.FlowGenPixel.Deposit`,
	`A.${FLOW_CONTRACT_ADDRESS}.FlowGenPixel.Withdraw`,
	`A.${FLOW_CONTRACT_ADDRESS}.FlowGenPixel.PixelMinted`,
];

export async function POST(req: NextRequest) {
	console.log("Flow event poller cron job started.");

	if (!FLOW_ACCESS_NODE_URL || !FLOW_CONTRACT_ADDRESS) {
		console.error(
			"Missing critical environment variables (FLOW_ACCESS_NODE_URL or FLOW_CONTRACT_ADDRESS) for Flow event poller."
		);
		return NextResponse.json(
			{ error: "Internal server configuration error" },
			{ status: 500 }
		);
	}

	let overallSuccess = true;
	const processingDetails = [];

	try {
		// 2. Fetch the current latest sealed block height from Flow
		const latestBlockResponse = await fetch(
			`${FLOW_ACCESS_NODE_URL}/v1/blocks?height=sealed&select=header.height`
		);
		if (!latestBlockResponse.ok) {
			console.error(
				`Failed to fetch latest block: ${latestBlockResponse.status}`
			);
			throw new Error("Failed to fetch latest block from Flow.");
		}
		const latestBlockData = await latestBlockResponse.json();
		const currentFlowHead = parseInt(latestBlockData[0]?.header?.height, 10);

		if (isNaN(currentFlowHead)) {
			console.error(
				"Could not parse current Flow head height:",
				latestBlockData
			);
			throw new Error("Could not parse current Flow head height.");
		}
		console.log(`Current Flow head block height: ${currentFlowHead}`);

		for (const eventType of EVENT_TYPES_TO_MONITOR) {
			console.log(`Processing event type: ${eventType}`);
			let lastProcessedBlockHeight = 0;

			// 3. Get last processed block height for this event type from DB
			const tracker = await db.query.flowEventTracker.findFirst({
				where: eq(flowEventTracker.eventType, eventType),
			});

			if (tracker) {
				lastProcessedBlockHeight = tracker.lastProcessedBlockHeight;
			} else {
				// First run for this event type, initialize tracker with currentFlowHead - 1 to start polling from current head on next run
				// Or decide to poll from a specific historical block if needed, e.g., currentFlowHead - N
				await db.insert(flowEventTracker).values({
					eventType: eventType,
					lastProcessedBlockHeight:
						currentFlowHead > 0 ? currentFlowHead - 1 : 0, // Start from current on next run
				});
				console.log(
					`Initialized tracker for ${eventType} at block ${
						currentFlowHead > 0 ? currentFlowHead - 1 : 0
					}. Will poll from next run.`
				);
				processingDetails.push({
					eventType,
					status: "initialized",
					polledTo: currentFlowHead > 0 ? currentFlowHead - 1 : 0,
				});
				continue;
			}

			console.log(
				`Last processed block for ${eventType}: ${lastProcessedBlockHeight}`
			);

			let fromBlock = lastProcessedBlockHeight + 1;
			const maxPolledBlockThisRun = Math.min(
				currentFlowHead,
				fromBlock + MAX_BLOCKS_PER_CRON_RUN - 1
			);

			if (fromBlock > currentFlowHead) {
				console.log(
					`No new blocks to process for ${eventType}. Last processed: ${lastProcessedBlockHeight}, Current head: ${currentFlowHead}`
				);
				processingDetails.push({
					eventType,
					status: "up-to-date",
					lastProcessedBlockHeight,
				});
				continue;
			}
			console.log(
				`Polling ${eventType} from block ${fromBlock} to ${maxPolledBlockThisRun} (Flow head: ${currentFlowHead})`
			);

			let currentPollingEndBlock = lastProcessedBlockHeight; // Tracks the highest block successfully processed in this loop

			for (
				let currentChunkStartBlock = fromBlock;
				currentChunkStartBlock <= maxPolledBlockThisRun;
				currentChunkStartBlock += POLLING_BLOCK_CHUNK_SIZE
			) {
				const currentChunkEndBlock = Math.min(
					currentChunkStartBlock + POLLING_BLOCK_CHUNK_SIZE - 1,
					maxPolledBlockThisRun
				);

				console.log(
					`Fetching ${eventType} for blocks ${currentChunkStartBlock}-${currentChunkEndBlock}`
				);
				const flowApiUrl = `${FLOW_ACCESS_NODE_URL}/events?type=${encodeURIComponent(
					eventType
				)}&start_height=${currentChunkStartBlock}&end_height=${currentChunkEndBlock}`;

				const eventResponse = await fetch(flowApiUrl);
				if (!eventResponse.ok) {
					console.error(
						`Error fetching events from Flow for ${eventType} (${currentChunkStartBlock}-${currentChunkEndBlock}): ${
							eventResponse.status
						} ${await eventResponse.text()}`
					);
					overallSuccess = false;
					break; // Stop processing this event type on error
				}

				const eventDataBlocks = await eventResponse.json();
				let eventsInChunk = 0;

				for (const blockData of eventDataBlocks) {
					if (blockData.events && blockData.events.length > 0) {
						const eventsToInsert = blockData.events.map((event: any) => ({
							eventType: event.type,
							transactionId: event.transaction_id,
							blockId: blockData.block_id,
							blockHeight: parseInt(blockData.block_height, 10),
							blockTimestamp: new Date(blockData.block_timestamp),
							eventIndex: parseInt(event.event_index, 10),
							payload: parseFlowEventPayload(event.payload), // Use helper
						}));

						if (eventsToInsert.length > 0) {
							try {
								await db
									.insert(flowEvents)
									.values(eventsToInsert)
									.onConflictDoNothing();
								console.log(
									`Inserted ${eventsToInsert.length} events for ${eventType} from block ${blockData.block_height}`
								);
								eventsInChunk += eventsToInsert.length;
							} catch (dbError) {
								console.error(
									`Database error inserting events for ${eventType}:`,
									dbError
								);
								overallSuccess = false;
								// Decide if to break or continue. For now, continue to next block in chunk but flag error.
							}
						}
					}
				}
				if (eventsInChunk > 0) {
					processingDetails.push({
						eventType,
						blocks: `${currentChunkStartBlock}-${currentChunkEndBlock}`,
						eventsFound: eventsInChunk,
					});
				}
				currentPollingEndBlock = currentChunkEndBlock; // Mark this chunk as processed
			}

			// 5. Update tracker in DB for this event type if any blocks were processed
			if (currentPollingEndBlock > lastProcessedBlockHeight) {
				await db
					.update(flowEventTracker)
					.set({ lastProcessedBlockHeight: currentPollingEndBlock })
					.where(eq(flowEventTracker.eventType, eventType));
				console.log(
					`Updated tracker for ${eventType} to block ${currentPollingEndBlock}`
				);
				if (
					!processingDetails.find(
						(p) => p.eventType === eventType && p.status === "processed_chunk"
					)
				) {
					processingDetails.push({
						eventType,
						status: "processed_chunk",
						polledTo: currentPollingEndBlock,
						eventsFoundThisRun: processingDetails
							.filter(
								(p) =>
									p.eventType === eventType && typeof p.eventsFound === "number"
							)
							.reduce((acc, curr) => acc + (curr.eventsFound || 0), 0),
					});
				}
			}
		}
	} catch (error: any) {
		console.error("Error in Flow event poller cron job:", error);
		overallSuccess = false;
		processingDetails.push({ status: "error", message: error.message });
		return NextResponse.json(
			{ success: false, error: error.message, details: processingDetails },
			{ status: 500 }
		);
	}

	console.log("Flow event poller cron job finished.");
	return NextResponse.json({
		success: overallSuccess,
		details: processingDetails,
	});
}

// Helper to parse event payload if it's JSON string
function parseFlowEventPayload(payload: string): any {
	try {
		return JSON.parse(payload);
	} catch (e) {
		console.warn("Failed to parse event payload as JSON:", payload);
		return payload; // Return as is if not JSON
	}
}
