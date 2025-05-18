"use server";

import { db } from "@/db"; // Adjusted import path
import { pixels } from "@/db/schema"; // Adjusted import path
import { eq, and, gte, lte, sql } from "drizzle-orm";
import {
	PixelBlockAvailabilityResult,
	PixelData,
	PixelSpaceResult,
	PixelMarketResult,
	PixelBuyResult,
	CanvasOverview,
} from "@/lib/pixel-types";
import { fcl } from "@/lib/fcl-server-config"; // Import server-configured FCL

// In-memory store to simulate a database.
// The key is a string like "x_y" (e.g., "10_20").
// const pixelStore = new Map<string, PixelData>(); // Will be removed or commented out

/**
 * Server Action: Acquires a pixel space by creating a record in the database.
 */
export async function acquirePixelSpaceServerAction(data: {
	x: number;
	y: number;
	prompt: string;
	style: string;
	ipfsImageCID: string;
	imageMediaType: string;
	paymentAmount: number; // Consider how this might be used (e.g., for logging)
	userId: string;
}): Promise<PixelSpaceResult> {
	const { x, y, prompt, style, ipfsImageCID, imageMediaType, userId } = data;

	try {
		// Check if the pixel is already taken
		const existingPixel = await db
			.select()
			.from(pixels)
			.where(and(eq(pixels.x, x), eq(pixels.y, y)))
			.limit(1);

		if (existingPixel.length > 0 && existingPixel[0].isTaken) {
			return { success: false, error: "Pixel already taken." };
		}

		// If the pixel exists but is not taken (e.g. soft delete or placeholder), update it.
		// Otherwise, insert a new pixel.
		// For simplicity, this example assumes we insert if no *taken* pixel is found.
		// A more robust approach might involve an explicit check for existing row vs. taken status.

		const newPixelId = `pixel_${x}_${y}_${Date.now()}`; // Still okay for a non-primary key unique ID

		const result = await db
			.insert(pixels)
			.values({
				x,
				y,
				isTaken: true,
				ownerId: userId,
				nftId: newPixelId, // Ensure this is unique if used as a lookup key
				ipfsImageCID,
				imageMediaType,
				prompt,
				style,
				// price, isListed, listingId will default or be null
			})
			.returning({
				id: pixels.id,
				nftId: pixels.nftId,
			});

		if (result.length === 0 || !result[0].nftId) {
			return {
				success: false,
				error: "Failed to acquire pixel or retrieve its ID.",
			};
		}

		console.log(
			`Pixel (${x},${y}) acquired by ${userId} and saved to DB. NFT ID: ${result[0].nftId}`
		);
		return { success: true, pixelId: result[0].nftId };
	} catch (error) {
		console.error("Error in acquirePixelSpaceServerAction:", error);
		// Check for unique constraint violation specifically for x,y
		if (
			error instanceof Error &&
			error.message.includes("unique_coordinates_idx")
		) {
			return {
				success: false,
				error: "Pixel already taken (concurrent request).",
			};
		}
		return { success: false, error: "An unexpected error occurred." };
	}
}

/**
 * Server Action: Checks if a block of pixels is available for purchase using the database.
 */
export async function checkPixelBlockAvailabilityServerAction(data: {
	startX: number;
	startY: number;
	width: number;
	height: number;
}): Promise<PixelBlockAvailabilityResult> {
	const { startX, startY, width, height } = data;

	try {
		// Query for any taken pixel within the specified block.
		// We only need to find one to determine the block is not available.
		const unavailablePixel = await db
			.select({
				x: pixels.x,
				y: pixels.y,
			})
			.from(pixels)
			.where(
				and(
					eq(pixels.isTaken, true),
					eq(pixels.x, startX), // Corrected this logic below - loop needed or smarter SQL
					eq(pixels.y, startY)
				)
			)
			.limit(1); // Check if this simple query is enough, might need to iterate or use BETWEEN

		// The above query is too simple. We need to check each cell in the block.
		// A more efficient SQL query could use BETWEEN for x and y ranges,
		// but for clarity and to match the original loop, iterating might be initially clearer
		// or we fetch all taken pixels in the range and check in code.

		// Let's fetch all taken pixels in the broader bounding box and then check.
		const potentiallyBlockingPixels = await db
			.select({
				x: pixels.x,
				y: pixels.y,
			})
			.from(pixels)
			.where(
				and(
					eq(pixels.isTaken, true),
					gte(pixels.x, startX),
					lte(pixels.x, startX + width - 1),
					gte(pixels.y, startY),
					lte(pixels.y, startY + height - 1)
				)
			);

		for (let y = startY; y < startY + height; y++) {
			for (let x = startX; x < startX + width; x++) {
				const isBlocked = potentiallyBlockingPixels.some(
					(p) => p.x === x && p.y === y
				);
				if (isBlocked) {
					return { isAvailable: false, firstUnavailablePixel: { x, y } };
				}
			}
		}

		return { isAvailable: true };
	} catch (error) {
		console.error("Error in checkPixelBlockAvailabilityServerAction:", error);
		return {
			isAvailable: false,
			firstUnavailablePixel: { x: startX, y: startY }, // Fallback, consider better error reporting
			error: "An unexpected error occurred while checking availability.",
		};
	}
}

/**
 * Server Action: Retrieves detailed information for all pixels within a specified rectangular section of the canvas from the database.
 */
export async function getCanvasSectionDataServerAction(data: {
	startX: number;
	startY: number;
	width: number;
	height: number;
}): Promise<PixelData[]> {
	const { startX, startY, width, height } = data;

	try {
		const sectionPixels = await db
			.select()
			.from(pixels)
			.where(
				and(
					gte(pixels.x, startX),
					lte(pixels.x, startX + width - 1),
					gte(pixels.y, startY),
					lte(pixels.y, startY + height - 1)
				)
			)
			.orderBy(pixels.y, pixels.x); // Optional: order the results

		// The above query fetches all stored pixels in the range.
		// The original code also created placeholder objects for empty pixels.
		// If that behavior is still desired, we would need to iterate through the grid
		// and fill in missing pixels.
		// For now, this will return only the pixels that exist in the database within the section.

		// Ensure the returned data conforms to PixelData[], especially if not all columns are selected
		// or if there are transformations needed. Since we used select() it should be fine if
		// the table schema matches PixelData closely (which it does after our type adjustments).
		return sectionPixels.map((p) => ({
			...p,
			price: p.price ? String(p.price) : null, // Ensure price is string or null as per PixelData
		})) as PixelData[];
	} catch (error) {
		console.error("Error in getCanvasSectionDataServerAction:", error);
		return []; // Return empty array on error
	}
}

/**
 * Server Action: Retrieves all pixel data records from the database.
 * WARNING: If the pixels table is very large, this could lead to performance issues
 * due to large data transfer and server/client memory usage.
 */
export async function getAllGridDataServerAction(): Promise<PixelData[]> {
	console.log("Server Action: Get all grid pixel data from database");
	try {
		const allPixels = await db
			.select()
			.from(pixels)
			.orderBy(pixels.y, pixels.x); // Optional: order the results, e.g., by y then x coordinate

		// Ensure the returned data conforms to PixelData[]
		// This mapping is important if your database schema for numeric/decimal types (like price)
		// needs explicit conversion to string for the PixelData type.
		return allPixels.map((p) => ({
			...p,
			// Assuming price is stored as a type that needs conversion to string or null
			// If price is already string | null in your db schema, this specific mapping for price might not be needed.
			price: p.price ? String(p.price) : null,
			// Add any other necessary transformations here if DB schema differs from PixelData
		})) as PixelData[]; // Cast to PixelData[] assuming transformations align with the type
	} catch (error) {
		console.error("Error in getAllGridDataServerAction:", error);
		return []; // Return empty array on error
	}
}

// --- Other server actions from pixel-api.ts to be implemented ---

/**
 * Server Action: Simulates initializing a user's account.
 */
export async function initializeUserProfileServerAction(
	userId: string
): Promise<void> {
	console.log(`Server Action: Initialize user profile for ${userId}`);
	// In a real backend, this might check/create a user record.
	// For this mock, it's a no-op.
	return Promise.resolve();
}

/**
 * Server Action: Simulates retrieving overall statistics for the pixel canvas from the database.
 */
export async function getCanvasOverviewServerAction(): Promise<CanvasOverview> {
	console.log("Server Action: Get canvas overview");
	try {
		const takenPixelStats = await db
			.select({
				count: sql<number>`count(*)::int`,
			})
			.from(pixels)
			.where(eq(pixels.isTaken, true));

		const takenCount = takenPixelStats[0]?.count || 0;

		// Assuming a fixed canvas size for now, as per project plan (e.g., 1024x1024)
		const canvasWidth = 1024;
		const canvasHeight = 1024;
		const totalPixels = canvasWidth * canvasHeight;

		return {
			resolution: `${canvasWidth}x${canvasHeight}`,
			totalPixels: totalPixels,
			soldPixels: takenCount,
			currentPrice: 10.0, // Example static price, could be dynamic
		};
	} catch (error) {
		console.error("Error in getCanvasOverviewServerAction:", error);
		// Return a default/fallback overview in case of error
		const canvasWidth = 1024;
		const canvasHeight = 1024;
		return {
			resolution: `${canvasWidth}x${canvasHeight}`,
			totalPixels: canvasWidth * canvasHeight,
			soldPixels: 0,
			currentPrice: 10.0,
			// Consider adding an error flag or message to CanvasOverview type if needed
		};
	}
}

/**
 * Server Action: Fetches details for a specific pixel on the canvas from the database.
 */
export async function getPixelDetailsServerAction(
	x: number,
	y: number
): Promise<PixelData> {
	console.log(`Server Action: Get pixel details for (${x}, ${y})`);
	try {
		const result = await db
			.select()
			.from(pixels)
			.where(and(eq(pixels.x, x), eq(pixels.y, y)))
			.limit(1);

		if (result.length > 0) {
			const p = result[0];
			return {
				...p,
				price: p.price ? String(p.price) : null,
			} as PixelData;
		} else {
			// Pixel not found in DB, return as not taken
			return {
				x,
				y,
				isTaken: false,
			};
		}
	} catch (error) {
		console.error(
			`Error in getPixelDetailsServerAction for (${x}, ${y}):`,
			error
		);
		// Fallback in case of error
		return {
			x,
			y,
			isTaken: false,
			error: "Failed to fetch pixel details", // Consider adding error to PixelData or using a different return type
		};
	}
}

// --- Marketplace related server actions (to be fleshed out) ---

export async function listPixelOnMarketServerAction(data: {
	pixelId: string; // Using nftId from PixelData as pixelId
	price: number;
	sellerUserId: string;
}): Promise<PixelMarketResult> {
	const { pixelId, price, sellerUserId } = data;

	try {
		// Find the pixel by nftId and ownerId
		const pixelToList = await db
			.select()
			.from(pixels)
			.where(and(eq(pixels.nftId, pixelId), eq(pixels.ownerId, sellerUserId)))
			.limit(1);

		if (pixelToList.length === 0) {
			return {
				success: false,
				error: "Pixel not found or not owned by seller.",
			};
		}

		if (!pixelToList[0].isTaken) {
			return {
				success: false,
				error: "Pixel is not taken and cannot be listed.",
			};
		}

		if (pixelToList[0].isListed) {
			// Optionally, allow updating an existing listing, or return error
			return { success: false, error: "Pixel is already listed." };
		}

		const newListingId = `listing_${pixelId}_${Date.now()}`;

		const updateResult = await db
			.update(pixels)
			.set({
				isListed: true,
				price: price.toString(), // Drizzle expects string for numeric type
				listingId: newListingId,
				updatedAt: new Date(), // Manually update updatedAt
			})
			.where(eq(pixels.id, pixelToList[0].id))
			.returning({ updatedListingId: pixels.listingId });

		if (updateResult.length === 0 || !updateResult[0].updatedListingId) {
			return { success: false, error: "Failed to list pixel on market." };
		}

		console.log(
			`Server Action: Pixel ${pixelId} listed by ${sellerUserId} for ${price}. Listing ID: ${updateResult[0].updatedListingId}`
		);
		return { success: true, listingId: updateResult[0].updatedListingId };
	} catch (error) {
		console.error("Error in listPixelOnMarketServerAction:", error);
		// Check for unique constraint violation for listingId if that's a concern
		if (
			error instanceof Error &&
			error.message.includes("pixels_listing_id_key")
		) {
			return {
				success: false,
				error: "Listing ID conflict. Please try again.",
			};
		}
		return {
			success: false,
			error: "An unexpected error occurred while listing the pixel.",
		};
	}
}

export async function buyListedPixelServerAction(data: {
	listingId: string;
	buyerUserId: string;
}): Promise<PixelBuyResult> {
	const { listingId, buyerUserId } = data;

	try {
		// Find the pixel by listingId
		const listedPixel = await db
			.select()
			.from(pixels)
			.where(eq(pixels.listingId, listingId))
			.limit(1);

		if (listedPixel.length === 0) {
			return { success: false, error: "Listing not found." };
		}

		const pixelToUpdate = listedPixel[0];

		if (!pixelToUpdate.isListed || !pixelToUpdate.isTaken) {
			return {
				success: false,
				error: "Pixel is not listed for sale or is not a valid taken pixel.",
			};
		}

		if (pixelToUpdate.ownerId === buyerUserId) {
			return {
				success: false,
				error: "Buyer is already the owner of this pixel.",
			};
		}

		const originalOwnerId = pixelToUpdate.ownerId;
		const transactionId = `buytx_${listingId}_${Date.now()}`;

		const updateResult = await db
			.update(pixels)
			.set({
				ownerId: buyerUserId,
				isListed: false,
				price: null, // Clear the price
				listingId: null, // Clear the listing ID
				updatedAt: new Date(),
			})
			.where(eq(pixels.id, pixelToUpdate.id))
			.returning({ id: pixels.id }); // just to confirm update

		if (updateResult.length === 0) {
			return { success: false, error: "Failed to complete pixel purchase." };
		}

		console.log(
			`Server Action: Pixel from listing ${listingId} bought by ${buyerUserId}. Original owner: ${originalOwnerId}. TxID: ${transactionId}`
		);
		return { success: true, transactionId };
	} catch (error) {
		console.error("Error in buyListedPixelServerAction:", error);
		return {
			success: false,
			error: "An unexpected error occurred during purchase.",
		};
	}
}

export async function unlistPixelFromMarketServerAction(data: {
	listingId: string;
	ownerUserId: string;
}): Promise<PixelMarketResult> {
	const { listingId, ownerUserId } = data;

	try {
		// Find the pixel by listingId and ownerId
		const pixelToUnlist = await db
			.select({
				id: pixels.id,
				ownerId: pixels.ownerId,
				isListed: pixels.isListed,
			})
			.from(pixels)
			.where(eq(pixels.listingId, listingId))
			.limit(1);

		if (pixelToUnlist.length === 0) {
			return { success: false, error: "Listing not found." };
		}

		const pixelData = pixelToUnlist[0];

		if (pixelData.ownerId !== ownerUserId) {
			return { success: false, error: "User does not own this listing." };
		}

		if (!pixelData.isListed) {
			return { success: false, error: "Pixel is not currently listed." };
		}

		const updateResult = await db
			.update(pixels)
			.set({
				isListed: false,
				price: null, // Clear the price
				// listingId: null, // Keep listingId for history or clear it - decided to keep for now
				updatedAt: new Date(),
			})
			.where(eq(pixels.id, pixelData.id))
			.returning({ id: pixels.id });

		if (updateResult.length === 0) {
			return { success: false, error: "Failed to unlist pixel." };
		}

		console.log(
			`Server Action: Pixel from listing ${listingId} unlisted by ${ownerUserId}.`
		);
		return { success: true }; // listingId is no longer active, so not returning it here
	} catch (error) {
		console.error("Error in unlistPixelFromMarketServerAction:", error);
		return {
			success: false,
			error: "An unexpected error occurred while unlisting.",
		};
	}
}

export async function getActiveMarketListingsServerAction(): Promise<
	PixelData[]
> {
	try {
		const listings = await db
			.select()
			.from(pixels)
			.where(and(eq(pixels.isListed, true), eq(pixels.isTaken, true)))
			.orderBy(pixels.updatedAt); // Example: order by when they were last updated (listed)

		console.log(
			`Server Action: Returning ${listings.length} active market listings from DB.`
		);
		return listings.map((p) => ({
			...p,
			price: p.price ? String(p.price) : null, // Ensure price is string or null
		})) as PixelData[];
	} catch (error) {
		console.error("Error in getActiveMarketListingsServerAction:", error);
		return []; // Return empty array on error
	}
}

/**
 * Server Action: Tracks a Flow transaction and updates the database upon successful completion,
 * extracting necessary data from transaction events.
 */
export async function trackNftPurchaseAndUpdateDb(data: {
	txId: string;
	// x, y, userId will be extracted from events
	prompt: string;
	style: string;
	ipfsImageCID: string;
	imageMediaType: string;
}): Promise<PixelSpaceResult> {
	const { txId, prompt, style, ipfsImageCID, imageMediaType } = data;

	console.log(
		`Server Action: Tracking Flow transaction ${txId} for pixel purchase.`
	);

	try {
		const txStatus = await fcl.tx(txId).onceSealed();

		console.log(
			`Transaction ${txId} sealed. Status: ${txStatus.status}, Error: ${txStatus.errorMessage}, Events Count: ${txStatus.events.length}`
		);

		if (txStatus.status === 4 && !txStatus.errorMessage) {
			// Transaction was successful (sealed)
			let nftIdOnChain: string | undefined;
			let pixelX: number | undefined;
			let pixelY: number | undefined;
			let ownerId: string | undefined;

			// Extract data from events
			for (const event of txStatus.events) {
				// Adjust event type strings if your contract address or names differ
				// Example: "A.YOUR_ACCOUNT_ADDRESS.FlowGenPixel.PixelMinted"
				if (event.type.includes("FlowGenPixel.PixelMinted")) {
					nftIdOnChain = String(event.data.id); // Assuming id is UInt64, convert to string
					pixelX = parseInt(event.data.x, 10); // Assuming x is UInt16
					pixelY = parseInt(event.data.y, 10); // Assuming y is UInt16
					console.log(
						`Extracted from PixelMinted: nftId=${nftIdOnChain}, x=${pixelX}, y=${pixelY}`
					);
				}
				// Example: "A.STANDARD_NFT_ADDRESS.NonFungibleToken.Deposit"
				if (event.type.includes("NonFungibleToken.Deposit")) {
					if (event.data.to) {
						// Check if 'to' field exists
						ownerId = event.data.to;
						// If we already got nftIdOnChain from PixelMinted, we can verify it matches event.data.id from Deposit
						if (nftIdOnChain && nftIdOnChain !== String(event.data.id)) {
							console.warn(
								`Mismatch in NFT ID between PixelMinted event (${nftIdOnChain}) and Deposit event (${event.data.id}) for tx ${txId}`
							);
							// Potentially handle error or prioritize one source
						} else if (!nftIdOnChain) {
							nftIdOnChain = String(event.data.id);
						}
						console.log(
							`Extracted from Deposit: ownerId=${ownerId}, nftId=${nftIdOnChain}`
						);
					}
				}
			}

			if (
				nftIdOnChain === undefined ||
				pixelX === undefined ||
				pixelY === undefined ||
				ownerId === undefined
			) {
				console.error(
					`Failed to extract all necessary data from transaction events for tx ${txId}. Found: nftId=${nftIdOnChain}, x=${pixelX}, y=${pixelY}, ownerId=${ownerId}`
				);
				return {
					success: false,
					error: "Failed to parse transaction events for pixel data.",
				};
			}

			console.log(
				`Flow transaction ${txId} successful. Updating database for pixel (${pixelX},${pixelY}), NFT ID: ${nftIdOnChain}, Owner: ${ownerId}.`
			);

			try {
				const existingPixel = await db
					.select()
					.from(pixels)
					.where(and(eq(pixels.x, pixelX), eq(pixels.y, pixelY)))
					.limit(1);

				if (existingPixel.length > 0 && existingPixel[0].isTaken) {
					console.warn(
						`Pixel (${pixelX},${pixelY}) was already marked as taken in DB (NFT ID: ${existingPixel[0].nftId}), despite successful tx ${txId} for new NFT ${nftIdOnChain}. This might indicate a retry or an issue.`
					);
					// If the existing nftId matches, it's idempotent. If not, it's an issue.
					if (existingPixel[0].nftId === nftIdOnChain) {
						return {
							success: true,
							pixelId: existingPixel[0].nftId,
						};
					}
					// If NFT IDs don't match, this is a more complex situation.
					// For now, we might return an error or overwrite, depending on business logic.
					// Overwriting might be dangerous. Let's error for now.
					return {
						success: false,
						error: `Pixel (${pixelX},${pixelY}) already taken in DB with a DIFFERENT NFT ID (${existingPixel[0].nftId}) than the one from tx events (${nftIdOnChain}). Manual review needed.`,
					};
				}

				// Use the on-chain NFT ID
				const result = await db
					.insert(pixels)
					.values({
						x: pixelX,
						y: pixelY,
						isTaken: true,
						ownerId: ownerId,
						nftId: nftIdOnChain, // Use the actual NFT ID from the event
						ipfsImageCID,
						imageMediaType,
						prompt,
						style,
					})
					.returning({
						id: pixels.id,
						nftId: pixels.nftId,
					});

				if (result.length === 0 || !result[0].nftId) {
					console.error(
						`Failed to insert/update pixel in DB after tx ${txId} success for NFT ${nftIdOnChain}.`
					);
					return {
						success: false,
						error: "Database update failed after successful Flow transaction.",
					};
				}

				console.log(
					`Pixel (${pixelX},${pixelY}) acquired by ${ownerId}, DB updated. NFT ID: ${result[0].nftId}`
				);
				return { success: true, pixelId: result[0].nftId };
			} catch (dbError: any) {
				console.error(
					`Database error after Flow transaction ${txId} (NFT ${nftIdOnChain}) was successful:`,
					dbError
				);
				if (dbError.message.includes("unique_coordinates_idx")) {
					// This implies that x,y is unique. If we got here, it means the 'existingPixel' check above
					// might have had a race condition, or the DB write for a previous attempt for the same pixel failed
					// after the on-chain tx succeeded but before this unique constraint was hit.
					// We should try to fetch the pixel again to see if it matches our current nftIdOnChain.
					const currentDbPixel = await db.query.pixels.findFirst({
						where: and(eq(pixels.x, pixelX), eq(pixels.y, pixelY)),
					});
					if (
						currentDbPixel &&
						currentDbPixel.nftId === nftIdOnChain &&
						currentDbPixel.ownerId === ownerId
					) {
						console.log(
							`Pixel (${pixelX},${pixelY}) with NFT ID ${nftIdOnChain} already exists in DB due to unique constraint, likely a retry. Data matches.`
						);
						return { success: true, pixelId: nftIdOnChain };
					}
					console.error(
						`Unique constraint violation for pixel (${pixelX},${pixelY}), but current NFT ID ${nftIdOnChain} or owner ${ownerId} does not match DB record: ${JSON.stringify(
							currentDbPixel
						)}.`
					);
					return {
						success: false,
						error:
							"Pixel already taken (concurrent DB update with different data).",
					};
				}
				return {
					success: false,
					error:
						"An unexpected database error occurred after transaction success.",
				};
			}
		} else {
			console.error(
				`Flow transaction ${txId} failed or was not sealed. Status: ${txStatus.status}, Error: ${txStatus.errorMessage}`
			);
			return {
				success: false,
				error: `Flow transaction failed: ${
					txStatus.errorMessage || "Unknown error"
				}`,
			};
		}
	} catch (error: any) {
		console.error(`Error tracking Flow transaction ${txId}:`, error);
		return {
			success: false,
			error: `Failed to track Flow transaction: ${
				error.message || "Unknown error"
			}`,
		};
	}
}
