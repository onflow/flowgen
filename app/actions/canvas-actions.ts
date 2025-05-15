"use server";

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
const pixelStore = new Map<string, PixelData>();

/**
 * Server Action: Simulates the primary sale of a pixel space.
 * In a real backend, this would be an atomic transaction.
 */
export async function acquirePixelSpaceServerAction(data: {
	x: number;
	y: number;
	prompt: string;
	style: string;
	imageURL: string;
	paymentAmount: number; // Currently unused in this mock
	userId: string;
}): Promise<PixelSpaceResult> {
	const { x, y, prompt, style, imageURL, userId } = data;
	const pixelKey = `${x}_${y}`;

	if (pixelStore.has(pixelKey) && pixelStore.get(pixelKey)?.isTaken) {
		return { success: false, error: "Pixel already taken." };
	}

	const newPixelId = `pixel_${x}_${y}_${Date.now()}`; // Simple unique ID for Web2

	const newPixel: PixelData = {
		x,
		y,
		isTaken: true,
		ownerId: userId,
		nftId: newPixelId,
		imageURL,
		prompt,
		style,
	};

	pixelStore.set(pixelKey, newPixel);
	console.log(
		`Pixel (${x},${y}) acquired by ${userId}. Store size: ${pixelStore.size}`
	);
	return { success: true, pixelId: newPixelId };
}

/**
 * Server Action: Checks if a block of pixels is available for purchase.
 */
export async function checkPixelBlockAvailabilityServerAction(data: {
	startX: number;
	startY: number;
	width: number;
	height: number;
}): Promise<PixelBlockAvailabilityResult> {
	const { startX, startY, width, height } = data;

	for (let y = startY; y < startY + height; y++) {
		for (let x = startX; x < startX + width; x++) {
			const pixelKey = `${x}_${y}`;
			if (pixelStore.has(pixelKey) && pixelStore.get(pixelKey)?.isTaken) {
				return { isAvailable: false, firstUnavailablePixel: { x, y } };
			}
		}
	}
	return { isAvailable: true };
}

/**
 * Server Action: Retrieves detailed information for all pixels within a specified rectangular section of the canvas.
 */
export async function getCanvasSectionDataServerAction(data: {
	startX: number;
	startY: number;
	width: number;
	height: number;
}): Promise<PixelData[]> {
	const { startX, startY, width, height } = data;
	const sectionData: PixelData[] = [];

	for (let y = startY; y < startY + height; y++) {
		for (let x = startX; x < startX + width; x++) {
			const pixelKey = `${x}_${y}`;
			const storedPixel = pixelStore.get(pixelKey);

			if (storedPixel && storedPixel.isTaken) {
				sectionData.push(storedPixel);
			} else {
				// Represent an available pixel
				sectionData.push({
					x,
					y,
					isTaken: false,
				});
			}
		}
	}
	return sectionData;
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
 * Server Action: Simulates retrieving overall statistics for the pixel canvas.
 */
export async function getCanvasOverviewServerAction(): Promise<CanvasOverview> {
	console.log("Server Action: Get canvas overview");
	let takenCount = 0;
	pixelStore.forEach((pixel) => {
		if (pixel.isTaken) {
			takenCount++;
		}
	});

	// Assuming a fixed canvas size for now, as per project plan (e.g., 1024x1024)
	const canvasWidth = 1024;
	const canvasHeight = 1024;
	const totalPixels = canvasWidth * canvasHeight;

	return Promise.resolve({
		resolution: `${canvasWidth}x${canvasHeight}`,
		totalPixels: totalPixels,
		soldPixels: takenCount,
		currentPrice: 10.0, // Example static price, could be dynamic
	});
}

/**
 * Server Action: Simulates fetching details for a specific pixel on the canvas.
 */
export async function getPixelDetailsServerAction(
	x: number,
	y: number
): Promise<PixelData> {
	console.log(`Server Action: Get pixel details for (${x}, ${y})`);
	const pixelKey = `${x}_${y}`;
	const storedPixel = pixelStore.get(pixelKey);

	if (storedPixel && storedPixel.isTaken) {
		return Promise.resolve(storedPixel);
	} else {
		return Promise.resolve({
			x,
			y,
			isTaken: false,
		});
	}
}

// --- Marketplace related server actions (to be fleshed out) ---

export async function listPixelOnMarketServerAction(data: {
	pixelId: string; // Using nftId from PixelData as pixelId
	price: number;
	sellerUserId: string;
}): Promise<PixelMarketResult> {
	const { pixelId, price, sellerUserId } = data;
	let foundPixelKey: string | undefined;
	pixelStore.forEach((pixel, key) => {
		if (
			pixel.nftId === pixelId &&
			pixel.ownerId === sellerUserId &&
			pixel.isTaken
		) {
			foundPixelKey = key;
		}
	});

	if (!foundPixelKey) {
		return { success: false, error: "Pixel not found or not owned by seller." };
	}

	const pixelToUpdate = pixelStore.get(foundPixelKey)!;
	pixelToUpdate.isListed = true;
	pixelToUpdate.price = price;
	pixelToUpdate.listingId = `listing_${pixelId}_${Date.now()}`;
	pixelStore.set(foundPixelKey, pixelToUpdate);

	console.log(
		`Server Action: Pixel ${pixelId} listed by ${sellerUserId} for ${price}. Listing ID: ${pixelToUpdate.listingId}`
	);
	return { success: true, listingId: pixelToUpdate.listingId };
}

export async function buyListedPixelServerAction(data: {
	listingId: string;
	buyerUserId: string;
}): Promise<PixelBuyResult> {
	const { listingId, buyerUserId } = data;
	let foundPixelKey: string | undefined;
	let originalOwnerId: string | undefined;

	pixelStore.forEach((pixel, key) => {
		if (pixel.listingId === listingId && pixel.isListed && pixel.isTaken) {
			foundPixelKey = key;
			originalOwnerId = pixel.ownerId;
		}
	});

	if (!foundPixelKey) {
		return {
			success: false,
			error: "Listing not found or pixel not available.",
		};
	}

	const pixelToUpdate = pixelStore.get(foundPixelKey)!;
	pixelToUpdate.ownerId = buyerUserId;
	pixelToUpdate.isListed = false;
	// pixelToUpdate.price = undefined; // Clear price or keep for history
	// pixelToUpdate.listingId = undefined; // Clear listingId

	pixelStore.set(foundPixelKey, pixelToUpdate);
	const transactionId = `buytx_${listingId}_${Date.now()}`;
	console.log(
		`Server Action: Pixel from listing ${listingId} bought by ${buyerUserId}. Original owner: ${originalOwnerId}. TxID: ${transactionId}`
	);
	return { success: true, transactionId };
}

export async function unlistPixelFromMarketServerAction(data: {
	listingId: string;
	ownerUserId: string;
}): Promise<PixelMarketResult> {
	const { listingId, ownerUserId } = data;
	let foundPixelKey: string | undefined;

	pixelStore.forEach((pixel, key) => {
		if (
			pixel.listingId === listingId &&
			pixel.ownerId === ownerUserId &&
			pixel.isListed
		) {
			foundPixelKey = key;
		}
	});

	if (!foundPixelKey) {
		return { success: false, error: "Listing not found or not owned by user." };
	}

	const pixelToUpdate = pixelStore.get(foundPixelKey)!;
	pixelToUpdate.isListed = false;
	// pixelToUpdate.price = undefined;
	// pixelToUpdate.listingId = undefined;
	pixelStore.set(foundPixelKey, pixelToUpdate);

	console.log(
		`Server Action: Pixel from listing ${listingId} unlisted by ${ownerUserId}.`
	);
	return { success: true };
}

export async function getActiveMarketListingsServerAction(): Promise<
	PixelData[]
> {
	const listings: PixelData[] = [];
	pixelStore.forEach((pixel) => {
		if (pixel.isListed && pixel.isTaken) {
			listings.push(pixel);
		}
	});
	console.log(
		`Server Action: Returning ${listings.length} active market listings.`
	);
	return Promise.resolve(listings);
}
