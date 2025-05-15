export interface PixelData {
	x: number;
	y: number;
	isTaken: boolean;
	ownerId?: string; // User ID of the owner
	nftId?: string; // Would be the NFT ID on Flow / unique ID for the pixel in Web2
	imageURL?: string;
	prompt?: string;
	style?: string;
	// For marketplace features later
	price?: number;
	isListed?: boolean;
	listingId?: string;
}

export interface PixelSpaceResult {
	success: boolean;
	pixelId?: string;
	error?: string;
}

export interface PixelBlockAvailabilityResult {
	isAvailable: boolean;
	firstUnavailablePixel?: { x: number; y: number };
}

export interface PixelMarketResult {
	success: boolean;
	listingId?: string;
	error?: string;
}

export interface PixelMarketListing {
	pixelId: string;
	price: number;
	sellerId: string;
}

export interface PixelBuyResult {
	success: boolean;
	transactionId?: string;
	error?: string;
}

export interface CanvasOverview {
	resolution: string;
	totalPixels: number;
	soldPixels: number;
	currentPrice: number;
}
