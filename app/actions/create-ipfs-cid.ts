"use server";

import { CarWriter } from "@ipld/car/writer";
import * as dagPb from "@ipld/dag-pb";
import { sha256 } from "multiformats/hashes/sha2";
import { CID } from "multiformats/cid";
import { UnixFS } from "ipfs-unixfs";

// We will use the global File object available in Node.js v18+
// If you encounter issues or are on an older Node.js version, you might need:
// import { File } from '@web-std/file';

// Helper to create a CAR file from raw bytes
async function createCarFromBytes(
	fileName: string,
	fileBytes: Uint8Array
): Promise<{ rootCID: CID; carBytes: Uint8Array }> {
	console.time("createCarFromBytes_total");

	console.time("createCarFromBytes_unixfs_pb");
	const unixfs = new UnixFS({ type: "file", data: fileBytes });
	const unixfsMarshalledBytes = unixfs.marshal();
	const pbNodeBytes = dagPb.encode({ Data: unixfsMarshalledBytes, Links: [] });
	console.log(`pbNodeBytes length: ${pbNodeBytes.length}`);
	console.timeEnd("createCarFromBytes_unixfs_pb");

	console.time("createCarFromBytes_hash");
	const hash = await sha256.digest(pbNodeBytes);
	const rootCID = CID.create(1, dagPb.code, hash);
	console.log("Root CID for CAR:", rootCID.toString());
	console.timeEnd("createCarFromBytes_hash");

	console.time("createCarFromBytes_carwriter_setup_and_put");
	const { writer, out } = CarWriter.create([rootCID]);

	// Start consuming 'out' concurrently.
	const carBytesPromise = (async () => {
		const carChunks: Uint8Array[] = [];
		for await (const chunk of out) {
			carChunks.push(chunk);
		}
		return Buffer.concat(carChunks);
	})();

	console.log("Before writer.put");
	await writer.put({ cid: rootCID, bytes: pbNodeBytes });
	console.log("After writer.put, before writer.close");
	console.timeEnd("createCarFromBytes_carwriter_setup_and_put");

	console.time("createCarFromBytes_writer_close");
	await writer.close(); // This will signal the 'out' async iterable to end.
	console.log("After writer.close");
	console.timeEnd("createCarFromBytes_writer_close");

	console.time("createCarFromBytes_car_stream_consume");
	// Now, wait for the concurrent consumption to finish.
	const carBytes = await carBytesPromise;
	console.timeEnd("createCarFromBytes_car_stream_consume");
	console.log(
		`In-memory CAR stream consumed. Total CAR size: ${carBytes.length}`
	);

	console.timeEnd("createCarFromBytes_total");
	return { rootCID, carBytes: carBytes };
}

export interface IpfsCidResponse {
	cid: string;
	mediaType: string;
}

/**
 * Creates an IPFS CID from an image URL by uploading it as a CAR file
 * to Web3.Storage using the HTTP Bridge.
 *
 * @param imageUrl The URL of the image to process.
 * @returns A promise that resolves with the IPFS CID string and media type.
 * @throws Will throw an error if the image URL is not provided, if fetching fails,
 *         or if uploading via the HTTP Bridge fails.
 */
export async function createIpfsCidFromImageUrl(
	imageUrl: string
): Promise<IpfsCidResponse> {
	if (!imageUrl) {
		throw new Error("Image URL must be provided.");
	}

	const W3_STORAGE_SECRET = process.env.W3_STORAGE_AUTH_SECRET;
	const W3_STORAGE_AUTH = process.env.W3_STORAGE_AUTH_HEADER;

	if (!W3_STORAGE_SECRET || !W3_STORAGE_AUTH) {
		throw new Error(
			"W3_STORAGE_AUTH_SECRET or W3_STORAGE_AUTH_HEADER environment variable is not set."
		);
	}

	let imageBlob: Blob;
	let mediaType: string;
	let fileName: string;

	try {
		console.log(`Fetching image from: ${imageUrl}`);
		const response = await fetch(imageUrl);
		if (!response.ok) {
			throw new Error(
				`Failed to fetch image from ${imageUrl}: ${response.status} ${response.statusText}`
			);
		}
		imageBlob = await response.blob();
		mediaType = imageBlob.type || "application/octet-stream";
		fileName =
			imageUrl.substring(imageUrl.lastIndexOf("/") + 1) || "uploaded-image";
		fileName = decodeURIComponent(fileName);
	} catch (error) {
		console.error("Error fetching image:", error);
		let errorMessage = "Failed to fetch image. ";
		if (error instanceof Error) {
			errorMessage += `Details: ${error.message}`;
		}
		throw new Error(errorMessage);
	}

	try {
		const imageBytes = new Uint8Array(await imageBlob.arrayBuffer());
		console.log(
			`Calling createCarFromBytes for: ${fileName} (${imageBytes.length} bytes)`
		);
		const { rootCID, carBytes } = await createCarFromBytes(
			fileName,
			imageBytes
		);
		console.log(
			`CAR file created. Root CID (content): ${rootCID.toString()}, CAR size: ${
				carBytes.length
			} bytes`
		);

		// Calculate CID of the CAR file itself
		const carFileHash = await sha256.digest(carBytes);
		// Use CAR codec (0x0202) for the CAR file CID
		const CAR_CODEC = 0x0202;
		const carFileCID = CID.create(1, CAR_CODEC, carFileHash);
		console.log(
			`CAR file CID: ${carFileCID.toString()} (using CAR codec ${CAR_CODEC})`
		);

		const uploadAddPayload = {
			tasks: [
				[
					"store/add",
					process.env.W3_DELEGATED_DID,
					{
						link: {
							"/": carFileCID.toString(),
						},
						size: carBytes.length,
					},
				],
			],
		};

		console.log(
			"Invoking upload/add via HTTP Bridge to https://up.web3.storage with JSON payload:",
			JSON.stringify(uploadAddPayload, null, 2)
		);

		const bridgeResponse = await fetch("https://up.storacha.network/bridge", {
			method: "POST",
			headers: {
				Authorization: W3_STORAGE_AUTH,
				"X-Auth-Secret": W3_STORAGE_SECRET,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(uploadAddPayload),
			cache: "no-store",
		});

		if (!bridgeResponse.ok) {
			throw new Error(
				`Failed to invoke upload/add via HTTP Bridge: ${bridgeResponse.status} ${bridgeResponse.statusText}}`
			);
		}
		const responseJson = await bridgeResponse.json();
		console.log(
			`HTTP Bridge response status: ${bridgeResponse.status} ${bridgeResponse.statusText}`
		);

		console.log("HTTP Bridge response text:", JSON.stringify(responseJson));

		if (!Array.isArray(responseJson) || responseJson.length === 0) {
			throw new Error(
				`Invalid response from HTTP Bridge: ${JSON.stringify(responseJson)}`
			);
		}
		console.log("responseJson", JSON.stringify(responseJson, null, 2));

		const task = responseJson[0];
		if (!task.p.out?.ok) {
			throw new Error(
				`Invalid response from HTTP Bridge: ${JSON.stringify(task.p.out)}`
			);
		}
		if (task.p.out?.ok?.status === "upload") {
			// We need to upload the file
			const url = task.p.out.ok.url;
			const headers = task.p.out.ok.headers;
			const uploadResponse = await fetch(url, {
				method: "PUT",
				headers: headers,
				body: carBytes,
				cache: "no-store",
			});

			if (!uploadResponse.ok) {
				throw new Error(
					`Failed to upload file to ${url}: ${uploadResponse.status} ${uploadResponse.statusText}`
				);
			}

			// Now we need to register the file with the HTTP Bridge

			const registerPayload = {
				tasks: [
					[
						"upload/add",
						process.env.W3_DELEGATED_DID,
						{
							root: {
								"/": rootCID.toString(),
							},
							shards: [
								{
									"/": carFileCID.toString(),
								},
							],
						},
					],
				],
			};
			const registerResponse = await fetch(
				"https://up.storacha.network/bridge",
				{
					method: "POST",
					headers: {
						Authorization: W3_STORAGE_AUTH,
						"X-Auth-Secret": W3_STORAGE_SECRET,
						"Content-Type": "application/json",
					},
					body: JSON.stringify(registerPayload),
					cache: "no-store",
				}
			);

			if (!registerResponse.ok) {
				throw new Error(
					`Failed to register file with HTTP Bridge: ${registerResponse.status} ${registerResponse.statusText}`
				);
			}
		}

		return { cid: rootCID.toString(), mediaType };
	} catch (error) {
		console.error("Error during CAR creation or HTTP Bridge upload:", error);
		let errorMessage = "Failed to process and upload image via HTTP Bridge. ";
		if (error instanceof Error) {
			errorMessage += `Details: ${error.message}`;
		}
		throw new Error(errorMessage);
	}
}
