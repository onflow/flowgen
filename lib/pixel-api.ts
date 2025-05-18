/**
 * This module defines a set of functions that act as an interface for interacting
 * with the pixel canvas and marketplace. These functions call server actions
 * that initially simulate interactions with a Web 2.0 backend.
 */

import {
	acquirePixelSpaceServerAction,
	checkPixelBlockAvailabilityServerAction,
	getCanvasOverviewServerAction,
	getCanvasSectionDataServerAction,
	getPixelDetailsServerAction,
	initializeUserProfileServerAction,
	listPixelOnMarketServerAction,
	buyListedPixelServerAction,
	unlistPixelFromMarketServerAction,
	getActiveMarketListingsServerAction,
} from "../app/actions/canvas-actions";
import {
	PixelData,
	PixelSpaceResult,
	PixelMarketResult,
	PixelMarketListing,
} from "./pixel-types";

// Re-export PixelData if needed by the client, or define a similar client-side type
// For now, we assume the return types from server actions are directly usable or
// will be mapped by the calling client code.
// You might want to define client-specific types that mirror PixelData if necessary.

/**
 * Initializes a user's account to interact with the platform.
 * Calls the `initializeUserProfileServerAction` server action.
 *
 * @param userId - The unique identifier for the user.
 * @returns A promise that resolves when the operation is complete.
 */
export async function initializeUserProfile(userId: string): Promise<void> {
	console.log(`Calling server action: Initialize user profile for ${userId}`);
	return initializeUserProfileServerAction(userId);
}

/**
 * Acquires a pixel space, including metadata for an AI-generated image.
 * Calls the `acquirePixelSpaceServerAction` server action.
 *
 * @param x - The x-coordinate of the pixel.
 * @param y - The y-coordinate of the pixel.
 * @param prompt - The AI prompt used to generate the image.
 * @param style - The style preset used for image generation.
 * @param imageURL - The URL of the generated image.
 * @param paymentAmount - The amount paid for the pixel.
 * @param userId - The unique identifier of the user purchasing the pixel.
 * @returns A promise that resolves with an object indicating success or failure,
 *          and an optional pixelId (formerly transactionId) or error message.
 */
export async function acquirePixelSpace(
	x: number,
	y: number,
	prompt: string,
	style: string,
	ipfsImageCID: string,
	imageMediaType: string,
	paymentAmount: number,
	userId: string
): Promise<PixelSpaceResult> {
	console.log(
		`Calling server action: Acquire pixel space at (${x}, ${y}) by user ${userId}`
	);
	return acquirePixelSpaceServerAction({
		x,
		y,
		prompt,
		style,
		ipfsImageCID,
		imageMediaType,
		paymentAmount,
		userId,
	});
}

/**
 * Retrieves overall statistics for the pixel canvas.
 * Calls the `getCanvasOverviewServerAction` server action.
 *
 * @returns A promise that resolves with an object containing canvas statistics.
 */
export async function getCanvasOverview(): Promise<{
	resolution: string;
	totalPixels: number;
	soldPixels: number;
	currentPrice: number;
}> {
	console.log("Calling server action: Get canvas overview");
	return getCanvasOverviewServerAction();
}

/**
 * Fetches details for a specific pixel on the canvas.
 * Calls the `getPixelDetailsServerAction` server action.
 *
 * @param x - The x-coordinate of the pixel.
 * @param y - The y-coordinate of the pixel.
 * @returns A promise that resolves with details about the pixel.
 *          The structure will match the PixelData interface from canvas-actions.ts.
 */
export async function getPixelDetails(
	x: number,
	y: number
): Promise<PixelData> {
	// Consider defining a client-side PixelData type
	console.log(`Calling server action: Get pixel details for (${x}, ${y})`);
	return getPixelDetailsServerAction(x, y);
}

/**
 * Lists a pixel for sale on the marketplace.
 * Calls the `listPixelOnMarketServerAction` server action.
 *
 * @param pixelId - The unique identifier of the pixel (nftId from PixelData).
 * @param price - The price at which to list the pixel.
 * @param sellerUserId - The unique identifier of the user listing the pixel.
 * @returns A promise that resolves with an object indicating success or failure,
 *          and an optional listingId or error message.
 */
export async function listPixelOnMarket(
	pixelId: string,
	price: number,
	sellerUserId: string
): Promise<PixelMarketResult> {
	console.log(
		`Calling server action: List pixel ${pixelId} on market by user ${sellerUserId} for price ${price}`
	);
	return listPixelOnMarketServerAction({ pixelId, price, sellerUserId });
}

/**
 * Purchases a pixel that has been listed on the marketplace.
 * Calls the `buyListedPixelServerAction` server action.
 *
 * @param listingId - The unique identifier of the marketplace listing.
 * @param buyerUserId - The unique identifier of the user purchasing the pixel.
 * @returns A promise that resolves with an object indicating success or failure,
 *          and an optional transactionId or error message.
 */
export async function buyListedPixel(
	listingId: string,
	buyerUserId: string
): Promise<PixelMarketResult> {
	console.log(
		`Calling server action: Buy listed pixel (listing ${listingId}) by user ${buyerUserId}`
	);
	return buyListedPixelServerAction({ listingId, buyerUserId });
}

/**
 * Unlists a pixel from the marketplace.
 * Calls the `unlistPixelFromMarketServerAction` server action.
 *
 * @param listingId - The unique identifier of the marketplace listing to remove.
 * @param ownerUserId - The unique identifier of the user (owner) unlisting the pixel.
 * @returns A promise that resolves with an object indicating success or failure,
 *          and an optional error message.
 */
export async function unlistPixelFromMarket(
	listingId: string,
	ownerUserId: string
): Promise<PixelMarketResult> {
	console.log(
		`Calling server action: Unlist pixel (listing ${listingId}) from market by owner ${ownerUserId}`
	);
	return unlistPixelFromMarketServerAction({ listingId, ownerUserId });
}

/**
 * Fetches all active listings from the marketplace.
 * Calls the `getActiveMarketListingsServerAction` server action.
 *
 * @returns A promise that resolves with an array of active marketplace listings.
 *          Each item will match the PixelData interface from canvas-actions.ts.
 */
export async function getActiveMarketListings(): Promise<PixelData[]> {
	// Consider defining a client-side PixelData type
	console.log("Calling server action: Get active market listings");
	return getActiveMarketListingsServerAction();
}

// --- New functions for block operations and canvas section data ---

/**
 * Checks if a block of pixels is available for purchase.
 * Calls the `checkPixelBlockAvailabilityServerAction` server action.
 *
 * @param startX - The starting x-coordinate of the block.
 * @param startY - The starting y-coordinate of the block.
 * @param width - The width of the block.
 * @param height - The height of the block.
 * @returns A promise that resolves with an object indicating if the block is available
 *          and the coordinates of the first unavailable pixel if any.
 */
export async function checkPixelBlockAvailability(data: {
	startX: number;
	startY: number;
	width: number;
	height: number;
}): Promise<{
	isAvailable: boolean;
	firstUnavailablePixel?: { x: number; y: number };
}> {
	console.log(
		`Calling server action: Check pixel block availability for start: (${data.startX},${data.startY}), size: ${data.width}x${data.height}`
	);
	return checkPixelBlockAvailabilityServerAction(data);
}

/**
 * Retrieves detailed information for all pixels within a specified rectangular section of the canvas.
 * Calls the `getCanvasSectionDataServerAction` server action.
 *
 * @param startX - The starting x-coordinate of the section.
 * @param startY - The starting y-coordinate of the section.
 * @param width - The width of the section.
 * @param height - The height of the section.
 * @returns A promise that resolves with an array of pixel data objects for the section.
 *          Each item will match the PixelData interface from canvas-actions.ts.
 */
export async function getCanvasSectionData(data: {
	startX: number;
	startY: number;
	width: number;
	height: number;
}): Promise<PixelData[]> {
	// Consider defining a client-side PixelData type
	console.log(
		`Calling server action: Get canvas section data for start: (${data.startX},${data.startY}), size: ${data.width}x${data.height}`
	);
	return getCanvasSectionDataServerAction(data);
}

// Note: The return types from the server actions are often directly passed through.
// For a more robust client-side API, you might want to define specific client-side types
// (e.g., ClientPixelData, ClientListing) and map the server action responses to these types.
// This can be useful if the server-side data structure (PixelData) contains fields that
// the client doesn't need or if you want to transform the data for client-side use.
