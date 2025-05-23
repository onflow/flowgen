export interface PixelData {
	id?: number; // Database primary key
	x: number;
	y: number;
	isTaken: boolean;
	ownerId?: string | null; // User ID of the owner
	nftId?: string | null; // Would be the NFT ID on Flow / unique ID for the pixel in Web2
	ipfsImageCID?: string | null;
	imageMediaType?: string | null;
	prompt?: string | null;
	style?: string | null;
	// For marketplace features later
	price?: number | string | null; // price is numeric in DB, can be string for display, or null
	isListed?: boolean | null;
	listingId?: string | null;
	error?: string; // Optional error field
}

export interface PixelOnChainData {
	id: number; // Database primary key
	x: number;
	y: number;
	isTaken: boolean;
	nftId: string | null; // Would be the NFT ID on Flow / unique ID for the pixel in Web2
}

export interface PixelSpaceResult {
	success: boolean;
	pixelId?: string;
	txId?: string;
	ipfsImageCID?: string;
	triggeringAiImageID?: number;
	error?: string;
}

export interface PixelBlockAvailabilityResult {
	isAvailable: boolean;
	firstUnavailablePixel?: { x: number; y: number };
	error?: string;
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
