import { NextResponse } from "next/server";
import { fcl } from "@/lib/fcl-server-config";
import { db } from "@/db";
import { backgroundUpdateLocks, processedEvents } from "@/db/schema";
import { eq, and, lt } from "drizzle-orm";
import { createIpfsCidFromImageUrl } from "@/app/actions/create-ipfs-cid";
import { serverAuthorization } from "@/lib/server-authz";
import UpdateCanvasBackground from "@/cadence/transactions/canvas/UpdateCanvasBackground.cdc";

interface UpdateCanvasRequest {
	newImageCID: string;
	transactionId: string;
	pixelId: string;
	triggeringAiImageID?: string;
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

	const script = `
    import "NonFungibleToken"
    import "ViewResolver"
    import "MetadataViews"
    import "CanvasBackground"
    import "FlowGenPixel"

    access(all) struct LatestBackgroundInfo {
        access(all) let id: UInt64
        access(all) let imageHash: String
        access(all) let versionNumber: UInt64
        access(all) let name: String?
        access(all) let description: String?

        init(id: UInt64, imageHash: String, versionNumber: UInt64, name: String?, description: String?) {
            self.id = id
            self.imageHash = imageHash
            self.versionNumber = versionNumber
            self.name = name
            self.description = description
        }
    }

    access(all) fun main(ownerAddress: Address): LatestBackgroundInfo? {
        let latestID = CanvasBackground.latestBackgroundNftID
        if latestID == nil {
            log("CanvasBackground.latestBackgroundNftID is nil.")
            return nil
        }

        let collectionCap = getAccount(ownerAddress)
            .capabilities.get<&CanvasBackground.Collection>( 
                CanvasBackground.CollectionPublicPath
            )
        
        if !collectionCap.check() {
            log("Could not borrow collection capability from owner")
            return nil
        }

        let collectionRef = collectionCap.borrow()
            ?? panic("Failed to borrow reference from collection capability.")

        let nft = collectionRef.borrowNFT(latestID!) 
            ?? panic("NFT with ID not found in owner's collection.")

        let bgNFT = nft as! &CanvasBackground.NFT

        var displayName: String? = nil
        var displayDescription: String? = nil

        if let display = bgNFT.resolveView(Type<MetadataViews.Display>()) as? MetadataViews.Display {
            displayName = display.name
            displayDescription = display.description
        }
        
        return LatestBackgroundInfo(
            id: bgNFT.id,
            imageHash: bgNFT.imageHash,
            versionNumber: bgNFT.versionNumber,
            name: displayName,
            description: displayDescription
        )
    }
  `;

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
	triggeringPixelID: string,
	triggeringEventTransactionID: string,
	triggeringAiImageID?: string
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
	const lockHolderId: string | null = null;
	const lockKey: string | null = null;
	const body: UpdateCanvasRequest = await request.json();
	const { newImageCID, transactionId, pixelId, triggeringAiImageID } = body;

	try {
		// Clean up expired locks first
		await cleanupExpiredLocks();

		// Update on-chain
		const txResult = await updateCanvasBackground(
			newImageCID,
			pixelId,
			transactionId,
			triggeringAiImageID
		);

		console.log("Background updated on-chain:", txResult);

		return NextResponse.json({
			status: "success",
			newBackgroundCID: newImageCID,
			transactionId: transactionId,
		});
	} catch (error) {
		console.error("Error processing background update:", error);

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
