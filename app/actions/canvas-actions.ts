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
	imageURL: string;
	paymentAmount: number; // Consider how this might be used (e.g., for logging)
	userId: string;
}): Promise<PixelSpaceResult> {
	const { x, y, prompt, style, imageURL, userId } = data;

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
				imageURL,
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
