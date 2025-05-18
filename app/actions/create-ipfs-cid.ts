"use server";

import { create, Client } from "@web3-storage/w3up-client";
import { parse } from "@web3-storage/w3up-client/proof";
import { Signer } from "@web3-storage/w3up-client/principal/ed25519";

// We will use the global File object available in Node.js v18+
// If you encounter issues or are on an older Node.js version, you might need:
// import { File } from '@web-std/file';

// A global variable to hold the w3up client instance.
// This helps to reuse the client and its configuration across multiple calls in a server environment.
let w3upClientInstance: Client | null = null;

/**
 * Initializes and returns a w3up client instance.
 * This function assumes that the server environment is already configured
 * with an agent that has been authorized (e.g., via `w3 agent import` or similar setup)
 * and has a current space selected.
 */
async function getClient() {
	if (!w3upClientInstance) {
		try {
			console.log("Initializing w3up-client...");
			// Create will attempt to load the default agent and its store.
			// For server-side, this agent needs to be pre-configured.
			w3upClientInstance = await create();

			// It's good practice to check if the client is usable, e.g., by verifying a space.
			const currentSpace = await w3upClientInstance.currentSpace();
			if (currentSpace) {
				console.log(
					`w3up-client initialized. Current space: ${currentSpace.did()}`
				);
			} else {
				const DELEGATION_PROOF = process.env.WC_DELEGATION_PROOF;
				if (!DELEGATION_PROOF) {
					throw new Error("WC_DELEGATION_PROOF is not set");
				}

				const proof = await parse(DELEGATION_PROOF);
				const space = await w3upClientInstance.addSpace(proof);
				await w3upClientInstance.setCurrentSpace(space.did());
			}
		} catch (error) {
			console.error("Failed to create/initialize w3up-client:", error);
			w3upClientInstance = null; // Reset on failure to allow retry on subsequent calls
			let errorMessage =
				"Failed to initialize w3up-client. Ensure the server environment is correctly configured. ";
			if (error instanceof Error) {
				errorMessage += `Details: ${error.message}`;
			}
			throw new Error(errorMessage);
		}
	}
	return w3upClientInstance;
}

/**
 * Creates an IPFS CID from an image URL by uploading it to Web3.Storage using w3up-client.
 *
 * @param imageUrl The URL of the image to process.
 * @returns A promise that resolves with the IPFS CID string.
 * @throws Will throw an error if the image URL is not provided, if fetching fails,
 *         if w3up-client fails to initialize, or if uploading to Web3.Storage fails.
 */
export async function createIpfsCidFromImageUrl(
	imageUrl: string
): Promise<string> {
	if (!imageUrl) {
		throw new Error("Image URL must be provided.");
	}

	let client;
	try {
		client = await getClient();
	} catch (error) {
		// getClient() already logs and throws a detailed error
		throw error;
	}

	// Ensure client is not null, though getClient should throw if it fails to initialize.
	if (!client) {
		throw new Error("w3up client is not available. Initialization failed.");
	}

	try {
		console.log(`Fetching image from: ${imageUrl}`);
		const response = await fetch(imageUrl);
		if (!response.ok) {
			throw new Error(
				`Failed to fetch image from ${imageUrl}: ${response.status} ${response.statusText}`
			);
		}

		const imageBlob = await response.blob();

		let filename = "image-from-url"; // Default filename
		try {
			const urlPath = new URL(imageUrl).pathname;
			const parts = urlPath.split("/");
			if (parts.length > 0 && parts[parts.length - 1]) {
				const decodedName = decodeURIComponent(parts[parts.length - 1]);
				// Ensure filename is not empty after decoding
				if (decodedName) filename = decodedName;
			}
		} catch (e) {
			console.warn(
				`Could not parse filename from URL "${imageUrl}", using default "${filename}".`
			);
		}

		// Use the global File constructor (available in Node.js v18+)
		const imageFile = new File([imageBlob], filename, { type: imageBlob.type });

		console.log(
			`Uploading "${imageFile.name}" (${imageFile.size} bytes) using w3up-client...`
		);

		// The `uploadFile` method uploads the file to the agent's "current" space.
		// This requires the agent to have `upload/add` capability for that space.
		const cid = await client.uploadFile(imageFile);
		console.log("Stored file with CID (w3up):", cid);

		if (!cid) {
			throw new Error(
				"Failed to upload image via w3up-client: CID returned was null or undefined."
			);
		}

		return cid.toString(); // The CID object from w3up-client has a .toString() method
	} catch (error) {
		console.error(
			"Error during image processing or upload with w3up-client:",
			error
		);
		let errorMessage = `Failed to create IPFS CID for ${imageUrl} using w3up-client.`;
		if (error instanceof Error) {
			errorMessage += ` Details: ${error.message}`;
		}
		// Log the full error structure for better debugging on the server
		console.error(
			"Full error object for w3up operation:",
			JSON.stringify(error, null, 2)
		);
		throw new Error(errorMessage);
	}
}
