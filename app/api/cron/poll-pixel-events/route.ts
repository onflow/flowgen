import { NextResponse } from "next/server";
import { fcl } from "@/lib/fcl-server-config";
import { db } from "@/db"; // Ensure this path is correct for your Drizzle db instance
import { eventPollingStatus } from "@/db/schema";
import { eq } from "drizzle-orm";

// --- Configuration ---
const NEXT_PUBLIC_FLOW_NETWORK =
	process.env.NEXT_PUBLIC_FLOW_NETWORK || "emulator"; // 'emulator', 'testnet', 'mainnet'

const CONTRACT_ADDRESSES = {
	emulator: "0xf8d6e0586b0a20c7",
	testnet: process.env.NEXT_PUBLIC_FLOW_ADMIN_ADDRESS,
	mainnet:
		process.env.NEXT_PUBLIC_FLOW_ADMIN_ADDRESS ||
		"YOUR_MAINNET_FLOWGEN_PIXEL_CONTRACT_ADDRESS_PLACEHOLDER",
};

const STARTING_BLOCKS = {
	emulator: 0,
	testnet: 259000,
	mainnet: 113000,
};

const getContractAddress = (): string => {
	return (
		CONTRACT_ADDRESSES[
			NEXT_PUBLIC_FLOW_NETWORK as keyof typeof CONTRACT_ADDRESSES
		] || CONTRACT_ADDRESSES.emulator
	);
};

const getStartingBlock = (): number => {
	return (
		STARTING_BLOCKS[NEXT_PUBLIC_FLOW_NETWORK as keyof typeof STARTING_BLOCKS] ||
		0
	);
};

const PIXEL_EVENT_TEMPLATES = [
	{ contractRelativeName: "FlowGenPixel.PixelMinted" },
	{ contractRelativeName: "FlowGenPixel.PixelImageUpdated" },
];
const MAX_BLOCK_RANGE = 400; // Number of blocks to query at a time, adjust as needed
// const CRON_SECRET = process.env.CRON_SECRET;

// --- Helper Functions (Duplicated for now, consider refactoring to a shared lib if they evolve) ---
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

	console.warn(
		`Event ${eventName} not found in event_polling_status. Using default starting block for ${NEXT_PUBLIC_FLOW_NETWORK}. Consider seeding the table.`
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
		await db
			.insert(eventPollingStatus)
			.values({
				eventName: eventName,
				lastPolledBlock: blockHeight,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.onConflictDoNothing()
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
		NEXT_PUBLIC_FLOW_NETWORK === "mainnet" &&
		contractAddress ===
			"YOUR_MAINNET_FLOWGEN_PIXEL_CONTRACT_ADDRESS_PLACEHOLDER"
	) {
		console.error(
			"Mainnet contract address for FlowGenPixel is not configured (NEXT_PUBLIC_FLOW_ADMIN_ADDRESS)."
		);
		return NextResponse.json(
			{ error: "Mainnet FlowGenPixel contract address not configured" },
			{ status: 500 }
		);
	}

	console.log(
		`Starting cron job for FlowGenPixel events on ${NEXT_PUBLIC_FLOW_NETWORK} network, contract ${contractAddress}.`
	);
	const results = [];

	for (const eventTemplate of PIXEL_EVENT_TEMPLATES) {
		const eventFQN = `A.${contractAddress}.${eventTemplate.contractRelativeName}`;
		console.log(`Polling for event: ${eventFQN}`);
		let gotoNextEventType = false; // Declare here

		try {
			const { lastPolledBlock: initialFromBlock, seeded: wasSeeded } =
				await getEventPollingStatus(eventFQN);

			const latestBlockInfo = await fcl.block({ sealed: true });
			const currentChainHeight = latestBlockInfo.height;

			const fromBlock = initialFromBlock + 1;

			if (fromBlock > currentChainHeight) {
				console.log(
					`No new blocks to poll for ${eventFQN}. Last polled block: ${initialFromBlock}, Current chain height: ${currentChainHeight}`
				);
				results.push({
					event: eventFQN,
					message: "No new blocks to poll",
					lastPolledBlock: initialFromBlock,
					currentChainHeight,
				});
				continue; // Move to the next event type
			}

			console.log(
				`Polling ${eventFQN} from block ${fromBlock} to ${currentChainHeight}.`
			);

			let allEventsForType: any[] = [];
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
						allEventsForType = allEventsForType.concat(eventsInRange);

						for (const event of eventsInRange) {
							console.log(
								"Processing Event:",
								JSON.stringify(event.data, null, 2)
							);
							console.log(`  Event Type: ${event.type}`);
							console.log(`  Transaction ID: ${event.transactionId}`);
							console.log(`  Block Height: ${event.blockHeight}`);

							// Process PixelMinted and PixelImageUpdated events
							if (event.type.endsWith("PixelMinted")) {
								const {
									id,
									x,
									y,
									initialAiImageNftID,
									artworkName,
									artworkDescription,
									aiPrompt,
									ipfsImageCID, // This is the image hash you need!
									imageMediaType,
									paymentAmount,
								} = event.data;

								console.log(
									`PixelMinted Event - Pixel ID: ${id}, Position: (${x}, ${y}), Image Hash: ${ipfsImageCID}`
								);

								// Trigger background update
								try {
									const baseUrl =
										process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
									const response = await fetch(
										`${baseUrl}/api/background-update`,
										{
											method: "POST",
											headers: {
												"Content-Type": "application/json",
											},
											body: JSON.stringify({
												eventType: "PixelMinted",
												transactionId: event.transactionId,
												pixelId: id,
												x: x,
												y: y,
												ipfsImageCID: ipfsImageCID,
												triggeringAiImageID: initialAiImageNftID,
											}),
										}
									);

									if (!response.ok) {
										console.error(
											`Failed to trigger background update: ${await response.text()}`
										);
									} else {
										const result = await response.json();
										console.log("Background update triggered:", result);
									}
								} catch (error) {
									console.error("Error triggering background update:", error);
								}

								// TODO: Store pixel data in database
								// await db.insert(pixelsTable).values({
								//     id,
								//     x,
								//     y,
								//     aiImageNftID: initialAiImageNftID,
								//     ipfsImageCID,
								//     artworkName,
								//     artworkDescription,
								//     aiPrompt,
								//     imageMediaType,
								//     ownerId: event.authorizers?.[0] // or extract from event
								// });
							} else if (event.type.endsWith("PixelImageUpdated")) {
								const {
									pixelId,
									newAiImageNftID,
									x,
									y,
									artworkName,
									artworkDescription,
									aiPrompt,
									ipfsImageCID, // Updated image hash
									imageMediaType,
								} = event.data;

								console.log(
									`PixelImageUpdated Event - Pixel ID: ${pixelId}, Position: (${x}, ${y}), New Image Hash: ${ipfsImageCID}`
								);

								// Trigger background update
								try {
									const baseUrl =
										process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
									const response = await fetch(
										`${baseUrl}/api/background-update`,
										{
											method: "POST",
											headers: {
												"Content-Type": "application/json",
											},
											body: JSON.stringify({
												eventType: "PixelImageUpdated",
												transactionId: event.transactionId,
												pixelId: pixelId,
												x: x,
												y: y,
												ipfsImageCID: ipfsImageCID,
												triggeringAiImageID: newAiImageNftID,
											}),
										}
									);

									if (!response.ok) {
										console.error(
											`Failed to trigger background update: ${await response.text()}`
										);
									} else {
										const result = await response.json();
										console.log("Background update triggered:", result);
									}
								} catch (error) {
									console.error("Error triggering background update:", error);
								}

								// TODO: Update pixel image in database
								// await db.update(pixelsTable)
								//     .set({
								//         aiImageNftID: newAiImageNftID,
								//         ipfsImageCID,
								//         artworkName,
								//         artworkDescription,
								//         aiPrompt,
								//         imageMediaType,
								//         updatedAt: new Date()
								//     })
								//     .where(eq(pixelsTable.id, pixelId));

								// You can now use ipfsImageCID to update your background image
								// The full IPFS URL would be: https://ipfs.io/ipfs/${ipfsImageCID}
							}
						}
					}
					lastSuccessfullyProcessedBlock = currentQueryToBlock;
				} catch (rangeError) {
					console.error(
						`Error fetching/processing events for range ${currentQueryFromBlock}-${currentQueryToBlock} for ${eventFQN}:`,
						rangeError
					);
					await updateLastPolledBlock(
						eventFQN,
						lastSuccessfullyProcessedBlock,
						wasSeeded
					);
					console.log(
						`Partial success for ${eventFQN}. Updated lastPolledBlock to ${lastSuccessfullyProcessedBlock} due to error.`
					);
					results.push({
						error: "Failed to poll a range of events for " + eventFQN,
						details: (rangeError as Error).message,
						event: eventFQN,
						lastSuccessfullyProcessedBlock,
					});
					// Break from inner loop (block ranges) for this event type and go to next event type
					// Or, decide if you want to throw and stop the whole cron job for all event types
					gotoNextEventType = true;
					break;
				}
			}

			if (gotoNextEventType) continue;

			await updateLastPolledBlock(
				eventFQN,
				lastSuccessfullyProcessedBlock,
				wasSeeded
			);
			console.log(
				`Successfully polled ${eventFQN}. Updated lastPolledBlock to ${lastSuccessfullyProcessedBlock}. Total events processed: ${allEventsForType.length}`
			);
			results.push({
				message: "Polling successful for " + eventFQN,
				event: eventFQN,
				queriedFromBlock: fromBlock,
				queriedToBlock: currentChainHeight,
				lastSuccessfullyProcessedBlock: lastSuccessfullyProcessedBlock,
				eventsFound: allEventsForType.length,
			});
		} catch (error) {
			console.error(`Unhandled error during cron job for ${eventFQN}:`, error);
			results.push({
				error: "Failed to poll events for " + eventFQN,
				details: (error as Error).message,
				event: eventFQN,
			});
			// Continue to the next event type even if one fails catastrophically
		}
	}

	// Check if any individual event polling resulted in an error to determine overall status
	const overallSuccess = !results.some((r) => r.error);
	return NextResponse.json(
		{
			overallStatus: overallSuccess
				? "Polling completed"
				: "Polling completed with errors",
			results,
		},
		{ status: overallSuccess ? 200 : 500 }
	);
}
