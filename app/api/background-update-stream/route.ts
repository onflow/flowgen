import { NextResponse } from "next/server";
import { fcl } from "@/lib/fcl-server-config";
import { db } from "@/db";
import { backgroundUpdateLocks, processedEvents } from "@/db/schema";
import { eq, and, lt } from "drizzle-orm";
import { createIpfsCidFromImageUrl } from "@/app/actions/create-ipfs-cid";
import { serverAuthorization } from "@/lib/server-authz";
import UpdateCanvasBackground from "@/cadence/transactions/canvas/UpdateCanvasBackground.cdc";
import GetLatestBackgroundInfo from "@/cadence/scripts/GetLatestBackgroundInfo.cdc";

interface BackgroundUpdateRequest {
	eventType: "PixelMinted" | "PixelImageUpdated";
	transactionId: string;
	pixelId: string;
	x: number;
	y: number;
	ipfsImageCID: string;
	triggeringAiImageID?: number;
}

interface ProgressUpdate {
	step: string;
	progress: number;
	message: string;
	error?: string;
	result?: any;
}

// Helper functions from the original route
async function cleanupExpiredLocks() {
	try {
		await db
			.delete(backgroundUpdateLocks)
			.where(lt(backgroundUpdateLocks.expiresAt, new Date()));
	} catch (error) {
		console.error("Failed to cleanup expired locks:", error);
	}
}

async function acquireLock(lockKey: string, durationMs: number = 600000) {
	const holderId = crypto.randomUUID();
	const expiresAt = new Date(Date.now() + durationMs);

	try {
		const result = await db
			.insert(backgroundUpdateLocks)
			.values({
				lockKey,
				expiresAt,
				holderId,
			})
			.onConflictDoNothing()
			.returning();

		return result.length > 0 ? holderId : null;
	} catch (error) {
		console.error("Failed to acquire lock:", error);
		return null;
	}
}

async function releaseLock(lockKey: string, holderId: string) {
	try {
		await db
			.delete(backgroundUpdateLocks)
			.where(
				and(
					eq(backgroundUpdateLocks.lockKey, lockKey),
					eq(backgroundUpdateLocks.holderId, holderId)
				)
			);
	} catch (error) {
		console.error("Failed to release lock:", error);
	}
}

async function markEventProcessed(
	transactionId: string,
	eventType: string,
	pixelId: string,
	status: "success" | "failed",
	errorMessage?: string,
	metadata?: any
) {
	try {
		await db.insert(processedEvents).values({
			transactionId,
			eventType,
			pixelId,
			status,
			errorMessage,
			metadata: metadata ? JSON.stringify(metadata) : null,
		});
	} catch (error) {
		console.error("Failed to mark event as processed:", error);
	}
}

async function isEventAlreadyProcessed(
	transactionId: string
): Promise<boolean> {
	const result = await db
		.select()
		.from(processedEvents)
		.where(eq(processedEvents.transactionId, transactionId))
		.limit(1);

	return result.length > 0;
}

async function getCurrentBackgroundInfo() {
	const adminAddress = process.env.NEXT_PUBLIC_FLOW_ADMIN_ADDRESS;
	if (!adminAddress) {
		throw new Error("Admin address not configured");
	}

	const script = GetLatestBackgroundInfo;

	const result = await fcl.query({
		cadence: script,
		args: (arg: any, t: any) => [arg(adminAddress, t.Address)],
	});

	return result;
}

async function generateNewBackground(
	currentBackgroundCID: string,
	pixelImageCID: string,
	x: number,
	y: number
) {
	const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
	const response = await fetch(`${baseUrl}/api/bg-gen`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			backgroundImageCID: currentBackgroundCID,
			pixelImageCID: pixelImageCID,
			pixelX: x,
			pixelY: y,
		}),
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to generate background: ${error}`);
	}

	const result = await response.json();
	return result.imageUrl;
}

async function updateCanvasBackground(
	imageHash: string,
	triggeringPixelID: number,
	triggeringEventTransactionID: string,
	triggeringAiImageID?: number
) {
	const transaction = UpdateCanvasBackground;

	const transactionId = await fcl.mutate({
		cadence: transaction,
		args: (arg: any, t: any) => [
			arg(imageHash, t.String),
			arg(triggeringPixelID, t.Optional(t.UInt64)),
			arg(triggeringEventTransactionID, t.Optional(t.String)),
			arg(
				triggeringAiImageID ? triggeringAiImageID : null,
				t.Optional(t.UInt64)
			),
		],
		proposer: serverAuthorization,
		payer: serverAuthorization,
		authorizations: [serverAuthorization],
		limit: 9999,
	});

	const txResult = await fcl.tx(transactionId).onceSealed();
	return txResult;
}

function sendProgress(
	controller: ReadableStreamDefaultController,
	update: ProgressUpdate
) {
	const encoder = new TextEncoder();
	const data = `data: ${JSON.stringify(update)}\n\n`;
	controller.enqueue(encoder.encode(data));
}

export async function POST(request: Request) {
	let lockHolderId: string | null = null;
	let lockKey: string | null = null;

	const stream = new ReadableStream({
		async start(controller) {
			try {
				// Parse request body
				const body: BackgroundUpdateRequest = await request.json();
				const {
					eventType,
					transactionId,
					pixelId,
					x,
					y,
					ipfsImageCID,
					triggeringAiImageID,
				} = body;

				// Step 1: Initial validation
				sendProgress(controller, {
					step: "initializing",
					progress: 5,
					message: "Starting background update process...",
				});

				// Validate required fields
				if (
					!eventType ||
					!transactionId ||
					!pixelId ||
					x === undefined ||
					y === undefined ||
					!ipfsImageCID
				) {
					sendProgress(controller, {
						step: "error",
						progress: 0,
						message: "Validation failed",
						error: "Missing required fields",
					});
					return;
				}

				// Step 2: Clean up expired locks
				sendProgress(controller, {
					step: "cleanup",
					progress: 10,
					message: "Cleaning up expired locks...",
				});
				await cleanupExpiredLocks();

				// Step 3: Check if already processed
				sendProgress(controller, {
					step: "checking_processed",
					progress: 15,
					message: "Checking if event already processed...",
				});

				if (await isEventAlreadyProcessed(transactionId)) {
					sendProgress(controller, {
						step: "already_processed",
						progress: 100,
						message: "Event has already been processed",
						result: { status: "already_processed" },
					});
					return;
				}

				// Step 4: Acquire lock
				sendProgress(controller, {
					step: "acquiring_lock",
					progress: 20,
					message: "Acquiring update lock...",
				});

				lockKey = `bg_update_${transactionId}`;
				lockHolderId = await acquireLock(lockKey);

				if (!lockHolderId) {
					sendProgress(controller, {
						step: "already_processing",
						progress: 100,
						message: "Another process is handling this event",
						result: { status: "already_processing" },
					});
					return;
				}

				console.log(
					`Processing background update for pixel ${pixelId} at (${x}, ${y})`
				);

				// Step 5: Get current background info
				sendProgress(controller, {
					step: "fetching_background",
					progress: 25,
					message: "Getting current background information...",
				});

				const currentBackground = await getCurrentBackgroundInfo();
				if (!currentBackground) {
					throw new Error("No current background found");
				}

				console.log(`Current background CID: ${currentBackground.imageHash}`);

				// Step 6: Generate new background image
				sendProgress(controller, {
					step: "generating_image",
					progress: 30,
					message:
						"Generating new background image (this may take 30+ seconds)...",
				});

				const newImageUrl = await generateNewBackground(
					currentBackground.imageHash,
					ipfsImageCID,
					x,
					y
				);

				console.log("New background generated:", newImageUrl);

				// Step 7: Upload to IPFS
				sendProgress(controller, {
					step: "uploading_ipfs",
					progress: 70,
					message: "Uploading new background to IPFS...",
				});

				const ipfsResult = await createIpfsCidFromImageUrl(newImageUrl);
				const newImageCID = ipfsResult.cid;
				console.log("New background uploaded to IPFS:", newImageCID);

				// Step 8: Update on-chain
				sendProgress(controller, {
					step: "updating_chain",
					progress: 85,
					message: "Updating background on-chain...",
				});

				const txResult = await updateCanvasBackground(
					newImageCID,
					parseInt(pixelId, 10),
					transactionId,
					triggeringAiImageID
				);

				console.log("Background updated on-chain:", txResult);

				// Step 9: Mark as processed
				sendProgress(controller, {
					step: "finalizing",
					progress: 95,
					message: "Finalizing update...",
				});

				await markEventProcessed(
					transactionId,
					eventType,
					pixelId,
					"success",
					undefined,
					{
						oldBackgroundCID: currentBackground.imageHash,
						newBackgroundCID: newImageCID,
						blockEvents: txResult.events?.length || 0,
					}
				);

				// Step 10: Complete
				sendProgress(controller, {
					step: "complete",
					progress: 100,
					message: "Background update completed successfully!",
					result: {
						status: "success",
						oldBackgroundCID: currentBackground.imageHash,
						newBackgroundCID: newImageCID,
						transactionId: transactionId,
					},
				});
			} catch (error) {
				console.error("Error processing background update:", error);

				// Mark event as failed if we have transaction ID
				if (lockKey && lockKey.includes("_")) {
					const txId = lockKey.split("_")[2];
					await markEventProcessed(
						txId,
						"unknown",
						"0",
						"failed",
						error instanceof Error ? error.message : "Unknown error"
					);
				}

				sendProgress(controller, {
					step: "error",
					progress: 0,
					message: "Background update failed",
					error: error instanceof Error ? error.message : "Unknown error",
				});
			} finally {
				// Always release lock if acquired
				if (lockKey && lockHolderId) {
					await releaseLock(lockKey, lockHolderId);
				}
				controller.close();
			}
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "POST",
			"Access-Control-Allow-Headers": "Content-Type",
		},
	});
}
