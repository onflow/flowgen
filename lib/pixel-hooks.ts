import { useState, useCallback, useEffect } from "react";
import {
	initializeUserProfile,
	// acquirePixelSpace, // Original API call, direct server action call will be used by the hook
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
	CanvasOverview,
	CanvasOverviewResponse,
	// PixelMarketListing, // Not directly used in this file after changes
} from "./pixel-types";
import { acquirePixelSpaceServerAction } from "../app/actions/canvas-actions"; // Import server action directly

import { useFlowMutate, useFlowQuery } from "@onflow/kit";
import * as fcl from "@onflow/fcl";
// import { arg, ArgumentFunction } from "@onflow/fcl"; // ArgumentFunction type might not be directly exported or needed with `any`

// Import the Cadence script as a raw string
import PURCHASE_PIXEL_CADENCE from "@/cadence/transactions/PurchasePixel.cdc";
import GET_CANVAS_OVERVIEW_CDC from "../../cadence/scripts/GetCanvasOverview.cdc";
import GET_CANVAS_SECTION_DATA_CDC from "../../cadence/scripts/GetCanvasSectionData.cdc";

// TODO: These should come from a configuration file or environment variables
const DEFAULT_FEE_RECEIVER_ADDRESS = "0xSERVICEACCOUNT"; // Replace with actual service/fee account address
const DEFAULT_ROYALTY_RATE = "0.05000000"; // 5% royalty rate as UFix64

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

interface AcquirePixelParams {
	x: number;
	y: number;
	prompt: string; // Used for AI prompt and Cadence description/aiPrompt
	style: string; // For backend
	imageURL: string; // For backend & Cadence thumbnail/imageURI/pixelArtURI
	flowPaymentAmount: string; // UFix64 string for Cadence paymentAmount
	backendPaymentAmount: number; // For backend server action
	userId: string; // User's Flow address, for Cadence creatorAddress & backend ownerId

	// Optional: Allow overriding if these constants aren't sufficient for some edge case
	feeReceiverAddress?: string;
	royaltyRate?: string;
	pixelContractAdminAddress?: string;
}

// Hook for acquiring pixel space (with Flow transaction)
export function useAcquirePixelSpace() {
	const {
		mutate,
		isPending: isFlowMutating,
		error: flowErrorFromHook,
		data: txIdFromHookData, // This will hold the txId after mutate() resolves
	} = useFlowMutate();

	//const { transactionStatus, error } = useFlowTransaction({ id: txIdFromHookData })

	const [isLoadingBackend, setIsLoadingBackend] = useState(false);
	const [combinedError, setCombinedError] = useState<Error | null>(null);
	const [backendData, setBackendData] = useState<PixelSpaceResult | null>(null);

	const acquire = useCallback(
		async ({
			x,
			y,
			prompt,
			style,
			imageURL,
			flowPaymentAmount,
			backendPaymentAmount,
			userId,
			feeReceiverAddress = DEFAULT_FEE_RECEIVER_ADDRESS,
			royaltyRate = DEFAULT_ROYALTY_RATE,
			pixelContractAdminAddress,
		}: AcquirePixelParams): Promise<PixelSpaceResult> => {
			setIsLoadingBackend(false);
			setCombinedError(null);
			setBackendData(null);

			try {
				console.log("Executing Flow transaction for pixel purchase...");

				const finalPixelName = `Pixel Art #${x}-${y}`;
				const finalDescription = prompt;
				const finalThumbnailURL = imageURL;
				const finalAiCadencePrompt = prompt;
				const finalImageURI = imageURL;
				const finalPixelArtURI = imageURL;
				const finalImageHash = `image-hash-${Date.now()}`;

				const args = (arg: any, t: any): any[] => {
					const scriptArgs = [
						arg(x, t.UInt16),
						arg(y, t.UInt16),
						arg(finalPixelName, t.String),
						arg(finalDescription, t.String),
						arg(finalThumbnailURL, t.String),
						arg(finalAiCadencePrompt, t.String),
						arg(finalImageURI, t.String),
						arg(finalPixelArtURI, t.String),
						arg(finalImageHash, t.String),
						arg(flowPaymentAmount, t.UFix64),
						arg(userId, t.Address), // creatorAddress
						arg(royaltyRate, t.UFix64),
						arg(feeReceiverAddress, t.Address),
					];
					return scriptArgs;
				};

				mutate({
					cadence: PURCHASE_PIXEL_CADENCE,
					args: args,
					limit: 999,
				});
				/* 
				console.log(
					"Flow transaction submitted with ID:",
					txId,
					"(Hook data txId:",
					txIdFromHookData,
					")"
				);

				await fcl.tx(txId).onceSealed();
				console.log("Flow transaction sealed successfully.");
 */
				setIsLoadingBackend(true);
				const backendResultData = await acquirePixelSpaceServerAction({
					x,
					y,
					prompt,
					style,
					imageURL,
					paymentAmount: backendPaymentAmount,
					userId,
				});
				setBackendData(backendResultData);

				if (!backendResultData.success) {
					console.error(
						"Backend error after Flow success:",
						backendResultData.error
					);
					setCombinedError(
						new Error(
							backendResultData.error || "Backend failed to record pixel."
						)
					);
				}
				return backendResultData;
			} catch (e: unknown) {
				console.error("Error in acquire process:", e);
				const caughtError = e as any;
				if (caughtError && (caughtError.message || caughtError.errorMessage)) {
					setCombinedError(
						new Error(caughtError.message || caughtError.errorMessage)
					);
				} else if (e instanceof Error) {
					setCombinedError(e);
				} else {
					setCombinedError(
						new Error("An unknown error occurred during pixel acquisition.")
					);
				}
				setBackendData(null);
				throw e;
			} finally {
				setIsLoadingBackend(false);
			}
		},
		[mutate, txIdFromHookData]
	);

	// Determine overall error to display, prioritizing Flow error if it exists
	const displayError = flowErrorFromHook
		? new Error(flowErrorFromHook.message || "Flow transaction failed")
		: combinedError;

	return {
		acquire,
		data: backendData, // This is the result from the backend
		isLoading: isFlowMutating || isLoadingBackend,
		error: displayError,
		isFlowMutating,
		isBackendLoading: isLoadingBackend,
		flowError: flowErrorFromHook,
		txId: txIdFromHookData, // Expose the txId from the hook's data state
	};
}

// Hook for getting canvas overview using useFlowQuery
export function useCanvasOverview() {
	const {
		data: transformedData, // This will be CanvasOverview | null after select
		isLoading,
		error: queryError,
		refetch,
	} = useFlowQuery({
		// Type params: TQueryFnData, TError, TData (after select), TQueryKey
		cadence: GET_CANVAS_OVERVIEW_CDC,
		// No args for this script
		query: {
			staleTime: 30000, // Cache for 30 seconds
			select: (rawData: any): CanvasOverview | null => {
				if (!rawData) return null;
				if (
					rawData &&
					typeof rawData.resolution === "string" &&
					rawData.totalPixels !== null &&
					rawData.totalPixels !== undefined &&
					rawData.soldPixels !== null &&
					rawData.soldPixels !== undefined &&
					rawData.currentPrice !== null &&
					rawData.currentPrice !== undefined
				) {
					return {
						resolution: rawData.resolution,
						totalPixels: parseInt(String(rawData.totalPixels), 10),
						soldPixels: parseInt(String(rawData.soldPixels), 10),
						currentPrice: parseFloat(String(rawData.currentPrice)),
					};
				} else {
					console.error(
						"Invalid data structure from GetCanvasOverview.cdc:",
						rawData
					);
					// Throw an error that useFlowQuery will catch in its `error` state
					throw new Error("Failed to parse canvas overview data from Flow.");
				}
			},
		},
	});

	// If select throws an error, queryError will be populated.
	// transformedData is the direct result from the select function.
	return {
		data: transformedData as CanvasOverview,
		isLoading,
		error: queryError,
		refetch,
	};
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

// Revert useActiveMarketListings to use the API function
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
	]);

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
