import { useState, useCallback, useEffect } from "react";
import {
	initializeUserProfile,
	acquirePixelSpace,
	getCanvasOverview,
	getPixelDetails,
	listPixelOnMarket,
	buyListedPixel,
	unlistPixelFromMarket,
	getActiveMarketListings,
	checkPixelBlockAvailability,
	getCanvasSectionData,
} from "./pixel-api";
import {
	PixelData,
	PixelSpaceResult,
	PixelMarketResult,
	PixelMarketListing,
} from "./pixel-types"; // Assuming pixel-types is in the same directory or adjust path

// Hook for initializing user profile
export function useInitializeUserProfile() {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const initialize = useCallback(async (userId: string) => {
		setIsLoading(true);
		setError(null);
		try {
			await initializeUserProfile(userId);
		} catch (e) {
			setError(e as Error);
		} finally {
			setIsLoading(false);
		}
	}, []);

	return { initialize, isLoading, error };
}

// Hook for acquiring pixel space
export function useAcquirePixelSpace() {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const [data, setData] = useState<PixelSpaceResult | null>(null);

	const acquire = useCallback(
		async (
			x: number,
			y: number,
			prompt: string,
			style: string,
			imageURL: string,
			paymentAmount: number,
			userId: string
		) => {
			setIsLoading(true);
			setError(null);
			try {
				const result = await acquirePixelSpace(
					x,
					y,
					prompt,
					style,
					imageURL,
					paymentAmount,
					userId
				);
				setData(result);
				return result;
			} catch (e) {
				setError(e as Error);
				setData(null);
				throw e;
			} finally {
				setIsLoading(false);
			}
		},
		[]
	);

	return { acquire, data, isLoading, error };
}

// Hook for getting canvas overview
export function useCanvasOverview() {
	const [data, setData] = useState<{
		resolution: string;
		totalPixels: number;
		soldPixels: number;
		currentPrice: number;
	} | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const fetchOverview = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const overviewData = await getCanvasOverview();
			setData(overviewData);
		} catch (e) {
			setError(e as Error);
		} finally {
			setIsLoading(false);
		}
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		fetchOverview();
	}, [fetchOverview]); // fetchOverview is stable due to useCallback

	return { data, isLoading, error, refetch: fetchOverview };
}

// Hook for getting pixel details
export function usePixelDetails(x: number, y: number) {
	const [data, setData] = useState<PixelData | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const fetchDetails = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const pixelData = await getPixelDetails(x, y);
			setData(pixelData);
		} catch (e) {
			setError(e as Error);
		} finally {
			setIsLoading(false);
		}
	}, [x, y]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		if (x !== undefined && y !== undefined) {
			fetchDetails();
		}
	}, [fetchDetails, x, y]); // fetchDetails updates if x or y changes

	return { data, isLoading, error, refetch: fetchDetails };
}

// Hook for listing a pixel on the market
export function useListPixelOnMarket() {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const [data, setData] = useState<PixelMarketResult | null>(null);

	const listPixel = useCallback(
		async (pixelId: string, price: number, sellerUserId: string) => {
			setIsLoading(true);
			setError(null);
			try {
				const result = await listPixelOnMarket(pixelId, price, sellerUserId);
				setData(result);
				return result;
			} catch (e) {
				setError(e as Error);
				setData(null);
				throw e;
			} finally {
				setIsLoading(false);
			}
		},
		[]
	);

	return { listPixel, data, isLoading, error };
}

// Hook for buying a listed pixel
export function useBuyListedPixel() {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const [data, setData] = useState<PixelMarketResult | null>(null);

	const buyPixel = useCallback(
		async (listingId: string, buyerUserId: string) => {
			setIsLoading(true);
			setError(null);
			try {
				const result = await buyListedPixel(listingId, buyerUserId);
				setData(result);
				return result;
			} catch (e) {
				setError(e as Error);
				setData(null);
				throw e;
			} finally {
				setIsLoading(false);
			}
		},
		[]
	);

	return { buyPixel, data, isLoading, error };
}

// Hook for unlisting a pixel from the market
export function useUnlistPixelFromMarket() {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const [data, setData] = useState<PixelMarketResult | null>(null);

	const unlistPixel = useCallback(
		async (listingId: string, ownerUserId: string) => {
			setIsLoading(true);
			setError(null);
			try {
				const result = await unlistPixelFromMarket(listingId, ownerUserId);
				setData(result);
				return result;
			} catch (e) {
				setError(e as Error);
				setData(null);
				throw e;
			} finally {
				setIsLoading(false);
			}
		},
		[]
	);

	return { unlistPixel, data, isLoading, error };
}

// Hook for getting active market listings
export function useActiveMarketListings() {
	const [data, setData] = useState<PixelData[] | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const fetchListings = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const listingsData = await getActiveMarketListings();
			setData(listingsData);
		} catch (e) {
			setError(e as Error);
		} finally {
			setIsLoading(false);
		}
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		fetchListings();
	}, [fetchListings]);

	return { data, isLoading, error, refetch: fetchListings };
}

// Hook for checking pixel block availability
export function useCheckPixelBlockAvailability() {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const [data, setData] = useState<{
		isAvailable: boolean;
		firstUnavailablePixel?: { x: number; y: number };
	} | null>(null);

	const checkAvailability = useCallback(
		async (blockData: {
			startX: number;
			startY: number;
			width: number;
			height: number;
		}) => {
			setIsLoading(true);
			setError(null);
			try {
				const result = await checkPixelBlockAvailability(blockData);
				setData(result);
				return result; // Return the result for immediate use if needed
			} catch (e) {
				setError(e as Error);
				setData(null); // Clear data on error
				throw e; // Re-throw error for the caller to handle
			} finally {
				setIsLoading(false);
			}
		},
		[]
	);

	return { checkAvailability, data, isLoading, error };
}

// Hook for getting canvas section data
export function useCanvasSectionData(initialData?: {
	startX: number;
	startY: number;
	width: number;
	height: number;
}) {
	const [data, setData] = useState<PixelData[] | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const fetchSectionData = useCallback(
		async (section: {
			startX: number;
			startY: number;
			width: number;
			height: number;
		}) => {
			setIsLoading(true);
			setError(null);
			try {
				const sectionPixelData = await getCanvasSectionData(section);
				setData(sectionPixelData);
			} catch (e) {
				setError(e as Error);
			} finally {
				setIsLoading(false);
			}
		},
		[]
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		if (initialData) {
			fetchSectionData(initialData);
		}
	}, [
		fetchSectionData,
		initialData?.startX,
		initialData?.startY,
		initialData?.width,
		initialData?.height,
	]); // Dependencies need to be primitive for stability if initialData is an object literal

	// Allow manual fetching
	const getSection = useCallback(
		async (section: {
			startX: number;
			startY: number;
			width: number;
			height: number;
		}) => {
			await fetchSectionData(section);
		},
		[fetchSectionData]
	);

	return { data, isLoading, error, fetchSection: getSection };
}
