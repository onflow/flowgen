import * as fcl from "@onflow/fcl";
import { CanvasOverview } from "@/lib/pixel-types";

// Assuming your FCL config (e.g., access node, contract addresses) is set up elsewhere in your app entry point.
// If not, you might need to configure FCL here or ensure it's configured before these actions are called.

// Import the Cadence code as a string
// Make sure this path is correct relative to your project structure for imports
import GET_CANVAS_OVERVIEW_CDC from "@/cadence/scripts/GetCanvasOverview.cdc";

/**
 * Fetches the canvas overview data directly from the Flow blockchain.
 * Replaces the previous server action `getCanvasOverviewServerAction`.
 */
export async function getCanvasOverviewServerAction(): Promise<CanvasOverview> {
	console.log("Flow Action: Fetching canvas overview...");
	try {
		const result = await fcl.query({
			cadence: GET_CANVAS_OVERVIEW_CDC,
			// args: (arg, t) => [] // No arguments for this script
		});

		// Validate and transform the result to match the CanvasOverview type
		if (
			result &&
			typeof result.resolution === "string" &&
			result.totalPixels !== null &&
			result.totalPixels !== undefined && // Check for null/undefined before parsing
			result.soldPixels !== null &&
			result.soldPixels !== undefined &&
			result.currentPrice !== null &&
			result.currentPrice !== undefined
		) {
			return {
				resolution: result.resolution,
				totalPixels: parseInt(result.totalPixels, 10),
				soldPixels: parseInt(result.soldPixels, 10),
				currentPrice: parseFloat(result.currentPrice),
			};
		} else {
			console.error(
				"Invalid data structure received from GetCanvasOverview.cdc:",
				result
			);
			throw new Error(
				"Failed to fetch or parse canvas overview data from Flow."
			);
		}
	} catch (error) {
		console.error("Error in getCanvasOverviewServerAction (Flow):", error);
		throw error; // Re-throw the error for the caller to handle
	}
}

// We will add other action replacements here...
