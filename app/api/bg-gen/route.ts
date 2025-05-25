import {
	generateBackgroundPrompt,
	generateStitchingPrompt,
} from "@/lib/prompt-style";
import {
	extractRegion,
	createStitchingMask,
	compositeResult,
	GRID_SIZE,
} from "@/lib/image-stitching";
import { NextResponse } from "next/server";
import OpenAI from "openai";

// Server-side API key fetch from env
const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

const userPrompt =
	"A 2D anime-style digital illustration of a tropical landscape designed to fit a 16x16 grid layout. The scene is viewed from a high, 45-degree isometric angle. The environment features evenly spaced, detailed palm trees with clean outlines and subtle shading. Vegetation is sparse—minimal low jungle plants and grasses—so that each grid cell remains clear and distinct. The terrain is mostly natural ground in warm, earthy tones, with subtle use of brand colors #00EF8B and #02D87E in the foliage accents. A small beach curves through the background, with a hint of calm, turquoise water beyond it. The color palette avoids overly bright greens, favoring balanced, natural hues. The entire composition is clean and open, perfect for placing custom characters or objects into individual grid cells.";

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const { backgroundImageCID, pixelImageCID, pixelX, pixelY } = body;

		// Validate required parameters
		if (
			!backgroundImageCID ||
			!pixelImageCID ||
			pixelX === undefined ||
			pixelY === undefined
		) {
			return NextResponse.json(
				{
					error:
						"Missing required parameters: backgroundImageCID, pixelImageCID, pixelX, pixelY",
				},
				{ status: 400 }
			);
		}

		const pX = parseInt(pixelX as string, 10);
		const pY = parseInt(pixelY as string, 10);

		if (isNaN(pX) || isNaN(pY)) {
			return NextResponse.json(
				{ error: "pixelX and pixelY must be valid numbers." },
				{ status: 400 }
			);
		}

		// Validate coordinates are within grid bounds
		if (pX < 0 || pX >= GRID_SIZE || pY < 0 || pY >= GRID_SIZE) {
			return NextResponse.json(
				{ error: `Coordinates must be between 0 and ${GRID_SIZE - 1}` },
				{ status: 400 }
			);
		}

		// Fetch images
		const backgroundImageUrl = `https://${backgroundImageCID}.ipfs.w3s.link/`;
		const pixelImageUrl = `https://${pixelImageCID}.ipfs.w3s.link/`;

		console.log("backgroundImageUrl:", backgroundImageUrl);
		console.log("pixelImageUrl:", pixelImageUrl);
		console.log("Processing pixel coordinates:", { pX, pY });

		const [bgImageResponse, pixelImageResponse] = await Promise.all([
			fetch(backgroundImageUrl),
			fetch(pixelImageUrl),
		]);

		if (!bgImageResponse.ok) {
			throw new Error(
				`Failed to fetch background image from ${backgroundImageUrl}: ${bgImageResponse.status} ${bgImageResponse.statusText}`
			);
		}

		if (!pixelImageResponse.ok) {
			console.warn(
				`Failed to fetch pixel image from ${pixelImageUrl}: ${pixelImageResponse.status} ${pixelImageResponse.statusText}`
			);
		}

		// Get image buffers
		const [backgroundBlob, pixelImageBlob] = await Promise.all([
			bgImageResponse.blob(),
			pixelImageResponse.blob(),
		]);

		const backgroundBuffer = Buffer.from(await backgroundBlob.arrayBuffer());
		const pixelImageBuffer = Buffer.from(await pixelImageBlob.arrayBuffer());

		// Extract the 4x4 region around the target pixel
		console.log("Extracting region for coordinates:", { pX, pY });
		const { extractedRegion, bounds } = await extractRegion(
			backgroundBuffer,
			pX,
			pY
		);
		console.log("Extraction bounds:", bounds);

		// Create the stitching mask
		const stitchingMask = await createStitchingMask();

		// Generate enhanced prompt for stitching
		const basePrompt = generateBackgroundPrompt(userPrompt, pX, pY);
		const enhancedPrompt = generateStitchingPrompt(basePrompt);

		console.log("Using stitching prompt:", enhancedPrompt);

		// Build File objects for OpenAI
		const extractedRegionFile = new File([extractedRegion], "region.png", {
			type: "image/png",
		});

		const pixelImageFile = new File([pixelImageBuffer], "pixel.png", {
			type: "image/png",
		});

		const stitchingMaskFile = new File([stitchingMask], "mask.png", {
			type: "image/png",
		});

		console.log(
			"Sending to OpenAI with extracted region size:",
			extractedRegion.length
		);

		// Call OpenAI with the extracted region
		const response = await openai.images.edit({
			model: "gpt-image-1",
			image: [extractedRegionFile, pixelImageFile],
			mask: stitchingMaskFile,
			prompt: enhancedPrompt,
			n: 1,
			size: "1024x1024", // OpenAI will upscale our 256x256 region
		});

		console.log("OpenAI API response received");

		if (!response.data || !response.data[0]) {
			return NextResponse.json(
				{ error: "No image data returned from OpenAI" },
				{ status: 500 }
			);
		}

		let generatedRegionBuffer: Buffer;

		if (response.data[0].url) {
			// Fetch the generated image from URL
			const generatedResponse = await fetch(response.data[0].url);
			if (!generatedResponse.ok) {
				throw new Error("Failed to fetch generated image from OpenAI URL");
			}
			const generatedBlob = await generatedResponse.blob();
			generatedRegionBuffer = Buffer.from(await generatedBlob.arrayBuffer());
		} else if (response.data[0].b64_json) {
			// Convert base64 to buffer
			generatedRegionBuffer = Buffer.from(response.data[0].b64_json, "base64");
		} else {
			return NextResponse.json(
				{ error: "No image URL or base64 data returned from OpenAI" },
				{ status: 500 }
			);
		}

		console.log("Compositing result back onto original background");

		// Composite the generated result back onto the original background
		const finalBackground = await compositeResult(
			backgroundBuffer,
			generatedRegionBuffer,
			pX,
			pY,
			stitchingMask
		);

		console.log("Stitching complete, returning final result");

		// Return the final stitched background as base64
		return NextResponse.json({
			imageUrl: `data:image/png;base64,${finalBackground.toString("base64")}`,
			debug: {
				extractionBounds: bounds,
				originalSize: backgroundBuffer.length,
				extractedSize: extractedRegion.length,
				generatedSize: generatedRegionBuffer.length,
				finalSize: finalBackground.length,
			},
		});
	} catch (error: any) {
		console.error("Error in POST /api/bg-gen:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Failed to generate image";
		return NextResponse.json({ error: errorMessage }, { status: 500 });
	}
}

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);

	const backgroundImageCID = searchParams.get("backgroundImageCID");
	const pixelImageCID = searchParams.get("pixelImageCID");
	const pixelXStr = searchParams.get("pixelX");
	const pixelYStr = searchParams.get("pixelY");

	if (!backgroundImageCID || !pixelImageCID || !pixelXStr || !pixelYStr) {
		return NextResponse.json(
			{
				error:
					"Missing one or more required query parameters: backgroundImageCID, pixelImageCID, pixelX, pixelY",
			},
			{ status: 400 }
		);
	}

	const pixelX = parseInt(pixelXStr, 10);
	const pixelY = parseInt(pixelYStr, 10);

	if (isNaN(pixelX) || isNaN(pixelY)) {
		return NextResponse.json(
			{ error: "pixelX and pixelY must be valid numbers." },
			{ status: 400 }
		);
	}

	const payload = {
		backgroundImageCID,
		pixelImageCID,
		pixelX,
		pixelY,
	};

	// Construct a new Request object to pass to the POST handler
	const postRequestUrl = new URL(request.url); // Base URL for context
	postRequestUrl.pathname = "/api/bg-gen"; // Ensure it points to the correct POST endpoint logically

	const postRequest = new Request(postRequestUrl.toString(), {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			// You might want to copy other relevant headers from the original GET request
			// if the POST handler depends on them (e.g., authorization)
		},
		body: JSON.stringify(payload),
		// signal: request.signal, // If you need to support cancellation from the original GET request
	});

	// Call the existing POST handler
	const postResponse = await POST(postRequest);

	if (!postResponse.ok) {
		// If the POST handler returned an error, forward that error response
		const errorJson = await postResponse.json();
		return NextResponse.json(errorJson, { status: postResponse.status });
	}

	const result = await postResponse.json();

	if (result.imageUrl) {
		if (result.imageUrl.startsWith("data:image/png;base64,")) {
			const base64Data = result.imageUrl.replace("data:image/png;base64,", "");
			const imageBuffer = Buffer.from(base64Data, "base64");
			return new Response(imageBuffer, {
				status: 200,
				headers: {
					"Content-Type": "image/png",
					"Content-Length": imageBuffer.length.toString(),
				},
			});
		} else {
			// If it's a URL, you could potentially fetch and stream it,
			// but for now, we'll indicate this case isn't directly handled for raw image return.
			// Or, you could redirect to the URL:
			// return NextResponse.redirect(result.imageUrl);
			return NextResponse.json(
				{
					error:
						"Image generated as a URL, direct image return for URLs not implemented.",
				},
				{ status: 501 } // Not Implemented
			);
		}
	} else {
		return NextResponse.json(
			{ error: "Failed to retrieve image URL from generation process" },
			{ status: 500 }
		);
	}
}

// To test try this

// http://localhost:3000/api/bg-gen?backgroundImageCID=bafybeidgxttsoguwrg3m3pkbrhvtj6pe63ym2uc4hwun5rngnk7i7we65q&pixelImageCID=bafybeigne2e7462zi6xqghcgxkgyl6rvcuwe3dxxqpcrgbotx26s3rmxge&pixelX=7&pixelY=7
