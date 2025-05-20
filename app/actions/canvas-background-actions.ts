"use server";

import { fcl } from "@/lib/fcl-server-config";

import UPDATE_CANVAS_BACKGROUND from "@/cadence/transactions/UpdateCanvasBackground.cdc";

interface RecordNewCanvasBackgroundParams {
	imageHash: string;
	triggeringPixelID?: string | null; // Cadence UInt64?
	triggeringEventTransactionID?: string | null; // Cadence String?
	triggeringAiImageID?: string | null; // Cadence UInt64?
}

export async function recordNewCanvasBackgroundVersion(
	params: RecordNewCanvasBackgroundParams
): Promise<{ transactionId: string | null; error: string | null }> {
	console.log(
		"Attempting to record new canvas background version with params:",
		params
	);

	try {
		const cadenceCode = UPDATE_CANVAS_BACKGROUND;

		// Your fcl-server-config.ts must handle server-side authorization.
		// This usually involves configuring an authorizer that uses a private key
		// stored in an environment variable (e.g., FLOW_PRIVATE_KEY) and the corresponding
		// account address (e.g., FLOW_ACCOUNT_ADDRESS) and key index (e.g., FLOW_KEY_INDEX).

		const transactionId = await fcl.mutate({
			cadence: cadenceCode,
			args: (arg: typeof fcl.arg, T) => [
				// Ensure your fcl-server-config exports fcl.arg as arg and t
				arg(params.imageHash, T.String),
				arg(params.triggeringPixelID || null, T.Optional(T.UInt64)),
				arg(params.triggeringEventTransactionID || null, T.Optional(T.String)),
				arg(params.triggeringAiImageID || null, T.Optional(T.UInt64)),
			],
			// Proposer, Payer, and Authorizations are typically handled by the server-side FCL config
			// For server-signing, there's usually one authorization (the server's account)
			// that acts as proposer, payer, and authorizer.
			limit: 9999, // Set a reasonable transaction gas limit
		});

		console.log(`Transaction submitted: ${transactionId}`);
		// You can optionally wait for the transaction to be sealed
		// await fcl.tx(transactionId).onceSealed();
		// console.log(`Transaction ${transactionId} sealed.`);

		return { transactionId, error: null };
	} catch (error: any) {
		console.error("Error recording new canvas background version:", error);
		const errorMessage =
			error.message || "Unknown error occurred during transaction.";
		// Attempt to get more details from FCL error if available
		const fclErrorDetails =
			error.errorMessage ||
			(error.data ? JSON.stringify(error.data.message || error.data) : null);
		return {
			transactionId: null,
			error: fclErrorDetails
				? `${errorMessage} (Details: ${fclErrorDetails})`
				: errorMessage,
		};
	}
}
