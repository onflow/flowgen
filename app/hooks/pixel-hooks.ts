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
} from "../../lib/pixel-api";
import {
	PixelData,
	PixelSpaceResult,
	PixelMarketResult,
	CanvasOverview,
	PixelOnChainData,
} from "../../lib/pixel-types";
import {
	trackNftPurchaseAndUpdateDb,
	getAllGridDataServerAction,
} from "../actions/canvas-actions"; // Import server action directly

import { useFlowMutate, useFlowQuery, useFlowTransaction } from "@onflow/kit";

// Import the Cadence script as a raw string
import PURCHASE_PIXEL_CADENCE from "@/cadence/transactions/PurchasePixel.cdc";
import GET_CANVAS_OVERVIEW_CDC from "@/cadence/scripts/GetCanvasOverview.cdc"; // Re-add this import
import GET_CANVAS_SECTION_DATA_CDC from "@/cadence/scripts/GetCanvasSectionData.cdc";
import GET_PIXEL_PRICE_CDC from "@/cadence/scripts/GetPixelPrice.cdc";
import GET_LATEST_BACKGROUND_INFO_CDC from "@/cadence/scripts/GetLatestBackgroundInfo.cdc"; // Import new script
import { createIpfsCidFromImageUrl } from "../actions/create-ipfs-cid";
import { CuteArtStyle, generateStyledPrompt } from "@/lib/prompt-style";

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
	prompt: string; // Used for AI prompt and Cadence aiPrompt & artworkDescription
	style: CuteArtStyle; // For backend
	imageURL: string; // For backend & Cadence ipfsImageCID
	imageMediaType: string; // For Cadence imageMediaType
	flowPaymentAmount: string; // UFix64 string for Cadence paymentAmount
	backendPaymentAmount: number; // For backend server action
	userId: string; // User's Flow address, for backend ownerId (signer is implicit buyer for Cadence)

	// These are no longer direct Cadence script args but kept for potential future use or consistency
	// feeReceiverAddress?: string; // Handled by contract
	// royaltyRate?: string; // Handled by contract
	// pixelContractAdminAddress?: string; // Handled by contract
}

// Hook for acquiring pixel space (with Flow transaction)
export function useAcquirePixelSpace({
	onSuccess,
	onError,
}: {
	onSuccess: (data: unknown) => void;
	onError: (error: unknown) => void;
}) {
	// Store the params needed for the server action, to be used when txId is available
	const [actionParams, setActionParams] = useState<Omit<
		Parameters<typeof trackNftPurchaseAndUpdateDb>[0],
		"txId"
	> | null>(null);

	const {
		mutate,
		isPending: isFlowMutating,
		error: flowErrorFromHook,
		data: txIdFromHookData,
	} = useFlowMutate({
		mutation: {
			onSuccess: (txId: string) => {
				console.log(
					"Flow transaction submitted via useFlowMutate with ID:",
					txId
				);
				setIsTrackingAndUpdating(true);
				trackNftPurchaseAndUpdateDb({
					txId: txId,
					prompt: actionParams?.prompt || "",
					style: actionParams?.style || "",
					ipfsImageCID: actionParams?.ipfsImageCID || "",
					imageMediaType: actionParams?.imageMediaType || "",
				})
					.then((result) => {
						setFinalPixelData(result);
						if (!result.success) {
							throw new Error(result.error);
						} else {
							onSuccess(result);
						}
					})
					.catch((err) => {
						console.error("Error calling trackNftPurchaseAndUpdateDb:", err);
						onError(err);
						setCombinedError(
							err instanceof Error
								? err
								: new Error(
										"An unexpected error occurred during transaction tracking."
								  )
						);
						setFinalPixelData(null);
					})
					.finally(() => {
						setIsTrackingAndUpdating(false);
						setActionParams(null); // Clear action params after use
					});
			},
			onError: (error) => {
				console.error(
					"Flow transaction submission via useFlowMutate failed:",
					error
				);
			},
		},
	});

	const [isTrackingAndUpdating, setIsTrackingAndUpdating] = useState(false);
	const [combinedError, setCombinedError] = useState<Error | null>(null);
	const [finalPixelData, setFinalPixelData] = useState<PixelSpaceResult | null>(
		null
	);

	const acquire = useCallback(
		async ({
			x,
			y,
			prompt,
			style,
			imageURL,
			flowPaymentAmount,
			userId,
		}: AcquirePixelParams) => {
			setCombinedError(null);
			setFinalPixelData(null);
			setIsTrackingAndUpdating(false); // Reset tracking state

			const { cid, mediaType } = await createIpfsCidFromImageUrl(imageURL);

			// Store params for the server action call that will happen in useEffect
			setActionParams({
				prompt,
				style,
				ipfsImageCID: cid,
				imageMediaType: mediaType,
			});

			console.log("Initiating Flow transaction for pixel purchase...");

			const finalPixelName = `Pixel Art #${x}-${y}`;
			const finalDescription = prompt;
			const finalAiCadencePrompt = generateStyledPrompt(style, prompt);
			const finalIpfsImageCID = cid;

			console.log("args", {
				x,
				y,
				finalPixelName,
				finalDescription,
				finalAiCadencePrompt,
				finalIpfsImageCID,
				mediaType,
				flowPaymentAmount,
			});

			const args = (arg: any, t: any): any[] => [
				arg(x, t.UInt16),
				arg(y, t.UInt16),
				arg(finalPixelName, t.String),
				arg(finalDescription, t.String),
				arg(finalAiCadencePrompt, t.String),
				arg(finalIpfsImageCID, t.String),
				arg(mediaType, t.String),
				arg(flowPaymentAmount, t.UFix64),
			];
			try {
				// Mutate will set txIdFromHookData when the transaction is submitted
				mutate({
					cadence: PURCHASE_PIXEL_CADENCE,
					args: args,
					limit: 999,
				});
				// The actual call to trackNftPurchaseAndUpdateDb will happen in the useEffect below
				// once txIdFromHookData is set by useFlowMutate.
			} catch (e: unknown) {
				console.error("Error calling mutate for Flow transaction:", e);
				const caughtError = e as any;
				let errorMessage = "Flow transaction submission failed.";
				if (caughtError && (caughtError.message || caughtError.errorMessage)) {
					errorMessage = caughtError.message || caughtError.errorMessage;
				}
				setCombinedError(new Error(errorMessage));
				setActionParams(null); // Clear action params on error
				// No explicit PixelSpaceResult to return here, error is set
				// The surrounding component should handle the error state.
				// We throw to ensure the promise from acquire rejects if mutate itself throws.
				throw e;
			}
			// Note: The promise returned by `acquire` will resolve once `mutate` is called.
			// The actual result of the transaction and DB update will be reflected in `finalPixelData` and `combinedError` state.
			// Components using this hook should observe these state variables for the outcome.
			// For direct return, one might await the server action, but that requires txId immediately.
			// This hook is designed to be more reactive.
		},
		[mutate]
	);

	// Determine overall error to display
	// Prioritize Flow client-side error (e.g., from user rejecting tx in wallet)
	// Then, errors from the tracking/DB update process
	const displayError = flowErrorFromHook
		? new Error(flowErrorFromHook.message || "Flow transaction setup failed.")
		: combinedError;

	// The hook now returns the data from the server action that tracks the transaction
	return {
		acquire,
		data: finalPixelData,
		isLoading: isFlowMutating || isTrackingAndUpdating, // Loading if Flow tx pending OR server action tracking
		error: displayError,
		isFlowMutating, // True when useFlowMutate is submitting the tx to the chain
		isTrackingAndUpdating, // True when the server action is tracking and updating DB
		flowError: flowErrorFromHook,
		txId: txIdFromHookData,
	};
}

// Hook for getting canvas overview using useFlowQuery (reverted to original functionality)
export function useCanvasOverview() {
	const {
		data: transformedData, // This will be CanvasOverview | null after select
		isLoading,
		error: queryError,
		refetch,
	} = useFlowQuery({
		cadence: GET_CANVAS_OVERVIEW_CDC,
		// No args for this script
		args: () => [], // Ensure args is a function, even if it returns an empty array
		query: {
			staleTime: 30000, // Cache for 30 seconds
			select: (rawData: any): CanvasOverview | null => {
				if (!rawData) return null;
				// Add robust checking based on the expected structure of rawData from GET_CANVAS_OVERVIEW_CDC
				// For example, if it's expected to be { resolution: string, totalPixels: number, soldPixels: number, currentPrice: number }
				if (
					rawData &&
					typeof rawData.resolution === "string" &&
					rawData.totalPixels !== null &&
					typeof rawData.totalPixels !== "undefined" && // More robust check
					rawData.soldPixels !== null &&
					typeof rawData.soldPixels !== "undefined" && // More robust check
					rawData.currentPrice !== null &&
					typeof rawData.currentPrice !== "undefined" // More robust check
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
					throw new Error("Failed to parse canvas overview data from Flow.");
				}
			},
		},
	});

	return {
		data: transformedData as CanvasOverview | null, // This is CanvasOverview | null
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

// Types for useCanvasSectionData
interface CanvasSectionParams {
	startX: number;
	startY: number;
	width: number;
	height: number;
}

export function useCanvasSectionData(params: CanvasSectionParams | null) {
	const {
		data: selectedData,
		isLoading,
		error: queryError,
		refetch,
	} = useFlowQuery({
		cadence: GET_CANVAS_SECTION_DATA_CDC,
		args: params
			? (arg: any, t: any) => [
					arg(params.startX, t.UInt16),
					arg(params.startY, t.UInt16),
					arg(params.width, t.UInt16),
					arg(params.height, t.UInt16),
			  ]
			: () => [],
		query: {
			enabled: !!params,
			staleTime: 10000,
			select: (rawQueryData: unknown): PixelData[] | null => {
				if (!params) return null;

				const rawScriptOutput = rawQueryData as PixelOnChainData[];
				if (!rawScriptOutput) return null;

				return rawScriptOutput;
			},
		},
	});

	return {
		data: selectedData as PixelOnChainData[] | null,
		isLoading,
		error: queryError,
		refetch,
	};
}

// Hook for fetching all pixel data directly from the database
export function useAllPixelData() {
	const [data, setData] = useState<PixelData[] | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const fetchData = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			// Ensure getAllGridDataServerAction is imported at the top of the file
			const allPixelData = await getAllGridDataServerAction();
			setData(allPixelData);
		} catch (e: any) {
			console.error("Error fetching all pixel data in useAllPixelData:", e);
			setError(
				e instanceof Error ? e : new Error("Failed to fetch all pixel data.")
			);
			setData(null);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	return {
		data, // PixelData[] | null
		isLoading,
		error,
		refetch: fetchData,
	};
}

// Hook for getting the current price of a pixel
interface UsePixelPriceProps {
	x: number | undefined | null;
	y: number | undefined | null;
}

export function usePixelPrice({ x, y }: UsePixelPriceProps) {
	const {
		data: price,
		isLoading,
		error: queryError,
		refetch,
	} = useFlowQuery({
		cadence: GET_PIXEL_PRICE_CDC,
		args: (arg: any, t: any) => [arg(x, t.UInt16), arg(y, t.UInt16)],
		query: {
			enabled: typeof x === "number" && typeof y === "number",
			staleTime: 0, // Cache for 30 seconds
			select: (rawData: any): number | null => {
				console.log("rawData", rawData, x, y);
				if (rawData === null || typeof rawData === "undefined") return null;
				const priceString = String(rawData);
				const parsedPrice = parseFloat(priceString);
				if (isNaN(parsedPrice)) {
					console.error(
						"Invalid price data from get-pixel-price.cdc:",
						rawData
					);
					throw new Error("Failed to parse pixel price data from Flow.");
				}
				return parsedPrice;
			},
		},
	});

	return {
		price: price as number | null,
		isLoading,
		error: queryError,
		refetch,
	};
}

// --- New Hook for Current Background Info ---

export interface LatestBackgroundInfo {
	id: string;
	imageHash: string;
	versionNumber: string;
	name: string | null;
	description: string | null;
}

export const getIpfsUrl = (
	hash: string | null | undefined,
	gateway?: string
): string | null => {
	if (!hash) return null;
	return `https://${hash}.ipfs.w3s.link`;
};
type BackgroundInfo = {
	data: LatestBackgroundInfo | null;
	imageUrl: string | null;
	isLoading: boolean;
	error: Error | null;
	refetch: () => void;
};

export function useCurrentBackgroundInfo(): BackgroundInfo {
	const adminAddress = process.env.NEXT_PUBLIC_FLOW_ADMIN_ADDRESS;

	const {
		data: queryData, // This will be unknown, select will type it
		isLoading,
		error: queryError,
		refetch,
	} = useFlowQuery({
		// Removed generic type argument
		cadence: GET_LATEST_BACKGROUND_INFO_CDC,
		args: adminAddress ? (arg, T) => [arg(adminAddress, T.Address)] : () => [],
		query: {
			enabled: !!adminAddress,
			staleTime: 60000,
			select: (rawData: unknown): LatestBackgroundInfo | null => {
				if (!rawData) return null;
				const result = rawData as any;
				if (
					result &&
					typeof result.id === "string" &&
					typeof result.imageHash === "string" &&
					typeof result.versionNumber === "string"
				) {
					return {
						id: result.id,
						imageHash: result.imageHash,
						versionNumber: result.versionNumber,
						name: result.name ?? null,
						description: result.description ?? null,
					};
				} else {
					console.error(
						"Invalid data structure from get-latest-background-info.cdc:",
						rawData
					);
					return null;
				}
			},
		},
	});

	// Explicitly type scriptResult based on the select function's return type
	const scriptResult = queryData as LatestBackgroundInfo | null;

	return {
		data: scriptResult,
		imageUrl: getIpfsUrl(scriptResult?.imageHash),
		isLoading,
		error: queryError,
		refetch,
	};
}
