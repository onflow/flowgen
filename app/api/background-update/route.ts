import { NextResponse } from "next/server";
import { fcl } from "@/lib/fcl-server-config";
import { db } from "@/db";
import { backgroundUpdateLocks, processedEvents } from "@/db/schema";
import { eq, and, lt } from "drizzle-orm";
import { createIpfsCidFromImageUrl } from "@/app/actions/create-ipfs-cid";
import { serverAuthorization } from "@/lib/server-authz";
import UpdateCanvasBackground from "@/cadence/transactions/canvas/UpdateCanvasBackground.cdc";
import GetLatestBackgroundInfo from "@/cadence/scripts/GetLatestBackgroundInfo.cdc";
import GetAiImageNftDetails from "@/cadence/scripts/GetAiImageNftDetails.cdc";

async function getAiImageDetails(ownerAddress: string, nftID: number) {
	try {
		console.log(
			`DEBUG - Querying AI image details: owner=${ownerAddress}, nftID=${nftID}`
		);
		const script = GetAiImageNftDetails;
		const result = await fcl.query({
			cadence: script,
			args: (arg: any, t: any) => [
				arg(ownerAddress, t.Address),
				arg(nftID, t.UInt64),
			],
		});
		console.log(
			`DEBUG - AI image query result:`,
			JSON.stringify(result, null, 2)
		);
		return result;
	} catch (error) {
		console.error(`Failed to fetch AI image details for NFT ${nftID}:`, error);
		console.error("Error details:", error);
		return null;
	}
}

interface BackgroundUpdateRequest {
	eventType: "PixelMinted" | "PixelImageUpdated";
	transactionId: string;
	pixelId: string;
	x: number;
	y: number;
	ipfsImageCID: string;
	triggeringAiImageID?: number;
	// aiPrompt will be fetched from the AI image NFT on-chain
}

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
	x: number,
	y: number,
	aiPrompt?: string
) {
	const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
	const response = await fetch(`${baseUrl}/api/bg-gen`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			backgroundImageCID: currentBackgroundCID,
			pixelX: x,
			pixelY: y,
			aiPrompt: aiPrompt,
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

export async function POST(request: Request) {
	let lockHolderId: string | null = null;
	let lockKey: string | null = null;

	try {
		// Clean up expired locks first
		await cleanupExpiredLocks();

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

		// Validate required fields
		if (
			!eventType ||
			!transactionId ||
			!pixelId ||
			x === undefined ||
			y === undefined
		) {
			return NextResponse.json(
				{ error: "Missing required fields" },
				{ status: 400 }
			);
		}

		// Check if event has already been processed
		if (await isEventAlreadyProcessed(transactionId)) {
			return NextResponse.json(
				{
					status: "already_processed",
					message: "Event has already been processed",
				},
				{ status: 200 }
			);
		}

		// Try to acquire lock
		lockKey = `bg_update_${transactionId}`;
		lockHolderId = await acquireLock(lockKey);

		if (!lockHolderId) {
			return NextResponse.json(
				{
					status: "already_processing",
					message: "Another process is handling this event",
				},
				{ status: 200 }
			);
		}

		console.log(
			`Processing background update for pixel ${pixelId} at (${x}, ${y})`
		);

		// Extract AI prompt from the triggering AI image NFT
		let aiPrompt = "";
		if (triggeringAiImageID) {
			// Get the owner address from the transaction
			let ownerAddress = null;
			try {
				console.log(
					`DEBUG - Fetching transaction details for ${transactionId}`
				);
				const txDetails = await fcl.tx(transactionId).onceSealed();
				console.log(
					"DEBUG - All transaction events:",
					JSON.stringify(
						txDetails.events.map((e) => ({
							type: e.type,
							data: e.data,
						})),
						null,
						2
					)
				);

				// Look for AI image deposit event specifically
				const aiImageDepositEvent = txDetails.events.find(
					(e) =>
						e.type.includes("NonFungibleToken.Deposit") &&
						(e.type.includes("FlowGenAiImage") ||
							e.data.id == triggeringAiImageID)
				);

				// Fallback to any deposit event
				const anyDepositEvent = txDetails.events.find((e) =>
					e.type.includes("NonFungibleToken.Deposit")
				);

				ownerAddress =
					aiImageDepositEvent?.data?.to || anyDepositEvent?.data?.to;
				console.log("DEBUG - AI Image Deposit Event:", aiImageDepositEvent);
				console.log("DEBUG - Any Deposit Event:", anyDepositEvent);
				console.log("DEBUG - Owner address:", ownerAddress);
			} catch (error) {
				console.error("Failed to get transaction details:", error);
			}

			// Fetch AI image details to get the prompt
			if (ownerAddress && triggeringAiImageID) {
				console.log(
					`Fetching AI image details for NFT ${triggeringAiImageID} owned by ${ownerAddress}`
				);
				const aiImageDetails = await getAiImageDetails(
					ownerAddress,
					triggeringAiImageID
				);

				if (aiImageDetails) {
					aiPrompt = aiImageDetails.aiPrompt || "";
					console.log("DEBUG - Fetched aiPrompt:", aiPrompt);
				} else {
					console.warn("Failed to fetch AI image details");
				}
			} else {
				console.warn("Missing owner address or AI image NFT ID");
			}
		} else {
			console.warn("No triggeringAiImageID provided");
		}

		if (!aiPrompt || aiPrompt.trim() === "") {
			throw new Error(
				"Could not retrieve AI prompt from NFT. triggeringAiImageID is required."
			);
		}

		// Get current background info
		const currentBackground = await getCurrentBackgroundInfo();
		if (!currentBackground) {
			throw new Error("No current background found");
		}

		console.log(`Current background CID: ${currentBackground.imageHash}`);
		console.log(`Generating background with: aiPrompt="${aiPrompt}"`);

		// Generate new background image
		const newImageUrl = await generateNewBackground(
			currentBackground.imageHash,
			x,
			y,
			aiPrompt
		);

		console.log("New background generated:", newImageUrl);

		// Upload to IPFS
		const ipfsResult = await createIpfsCidFromImageUrl(newImageUrl);
		const newImageCID = ipfsResult.cid;
		console.log("New background uploaded to IPFS:", newImageCID);

		// Update on-chain
		const txResult = await updateCanvasBackground(
			newImageCID,
			parseInt(pixelId, 10),
			transactionId,
			triggeringAiImageID
		);

		console.log("Background updated on-chain:", txResult);

		// Mark event as processed
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

		return NextResponse.json({
			status: "success",
			oldBackgroundCID: currentBackground.imageHash,
			newBackgroundCID: newImageCID,
			transactionId: transactionId,
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

		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to process background update",
			},
			{ status: 500 }
		);
	} finally {
		// Always release lock if acquired
		if (lockKey && lockHolderId) {
			await releaseLock(lockKey, lockHolderId);
		}
	}
}
