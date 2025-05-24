import {
	generateBackgroundPrompt,
	generateBackgroundInsertionPrompt,
	// generateStyledPrompt, // This seems unused, kept for now
} from "@/lib/prompt-style";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import sharp from "sharp";

// Server-side API key fetch from env
const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

const userPrompt =
	"A 2D anime-style digital illustration of a tropical landscape designed to fit a 16x16 grid layout. The scene is viewed from a high, 45-degree isometric angle. The environment features evenly spaced, detailed palm trees with clean outlines and subtle shading. Vegetation is sparse—minimal low jungle plants and grasses—so that each grid cell remains clear and distinct. The terrain is mostly natural ground in warm, earthy tones, with subtle use of brand colors #00EF8B and #02D87E in the foliage accents. A small beach curves through the background, with a hint of calm, turquoise water beyond it. The color palette avoids overly bright greens, favoring balanced, natural hues. The entire composition is clean and open, perfect for placing custom characters or objects into individual grid cells.";

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const { backgroundImageCID, pixelX, pixelY, aiPrompt } = body;

		console.log(
			`curl -X POST http://localhost:3000/api/bg-gen -H "Content-Type: application/json" -d '{"backgroundImageCID": "${backgroundImageCID}", "pixelX": "${pixelX}", "pixelY": "${pixelY}", "aiPrompt": "${
				aiPrompt || ""
			}"}'`
		);

		// Validate required parameters
		if (!backgroundImageCID || pixelX === undefined || pixelY === undefined) {
			return NextResponse.json(
				{
					error:
						"Missing required parameters: backgroundImageCID, pixelX, pixelY",
				},
				{ status: 400 }
			);
		}

		// Validate that we have either aiPrompt or the old pixelImageCID for backwards compatibility
		if ((!aiPrompt || aiPrompt.trim() === "") && !body.pixelImageCID) {
			return NextResponse.json(
				{
					error: "Either aiPrompt or pixelImageCID must be provided",
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

		const currentUrl = new URL(request.url);
		const baseUrl = currentUrl.origin; // e.g., http://localhost:3000 or https://yourdomain.com

		const backgroundImageUrl = `https://${backgroundImageCID}.ipfs.w3s.link/`;
		const maskImageUrl = `${baseUrl}/api/mask/${pX}/${pY}`;

		console.log("maskImageUrl", maskImageUrl);
		console.log("backgroundImageUrl", backgroundImageUrl);

		// Generate prompt based on whether we have aiPrompt (new way) or using old way
		let enhancedPrompt: string;
		if (aiPrompt && aiPrompt.trim() !== "") {
			enhancedPrompt = generateBackgroundInsertionPrompt(aiPrompt, pX, pY);
			console.log("Using new prompt-based approach:", enhancedPrompt);
		} else {
			throw new Error("No aiPrompt provided");
		}

		// Fetch image and mask data
		const bgImageResponse = await fetch(backgroundImageUrl);
		const maskResponse = await fetch(maskImageUrl);
		console.log("maskResponse", maskResponse);

		if (!bgImageResponse.ok) {
			throw new Error(
				`Failed to fetch background image from ${backgroundImageUrl}: ${bgImageResponse.status} ${bgImageResponse.statusText}`
			);
		}
		if (!maskResponse.ok) {
			throw new Error(
				`Failed to fetch mask from ${maskImageUrl}: ${maskResponse.status} ${maskResponse.statusText}`
			);
		}

		const imageFile = await bgImageResponse.blob();
		const maskFile = await maskResponse.blob();

		// Duplicate background image and apply mask's alpha channel
		const [bgBuf, maskBuf] = await Promise.all([
			imageFile.arrayBuffer(),
			maskFile.arrayBuffer(),
		]);

		// Extract alpha channel from mask
		const alphaChannel = await sharp(Buffer.from(maskBuf))
			.ensureAlpha()
			.extractChannel("alpha")
			.toBuffer();

		// Create a new image with background + mask's alpha channel
		const maskWithAlphaBuf = await sharp(Buffer.from(bgBuf))
			.joinChannel(alphaChannel)
			.png()
			.toBuffer();

		// Build File objects for OpenAI
		const backgroundFile = new File([imageFile], "background.png", {
			type: "image/png",
		});
		const maskFileWithAlpha = new File([maskWithAlphaBuf], "mask.png", {
			type: "image/png",
		});

		// For the new prompt-based approach, we don't need a second image
		// We use the background image as both the base and the reference
		let openAIResponse;
		if (aiPrompt) {
			console.log("Using NEW prompt-based approach");
			console.log("Enhanced prompt:", enhancedPrompt);
			console.log("Making OpenAI API call...");

			try {
				// New approach: use inpainting with just background and mask
				openAIResponse = await openai.images.edit({
					model: "gpt-image-1",
					image: backgroundFile,
					mask: maskFileWithAlpha,
					prompt: enhancedPrompt,
					n: 1,
					size: "1024x1024",
				});

				console.log("OpenAI API call completed successfully");
			} catch (openaiError) {
				console.error("OpenAI API call failed:", openaiError);
				throw openaiError;
			}
		} else {
			console.log("Using LEGACY approach");
			console.log("Enhanced prompt:", enhancedPrompt);

			// Legacy approach: needs pixelImageCID but still uses the same OpenAI API
			// We'll log that we're fetching the pixel image but won't use it in OpenAI call
			const pixelImageUrl = `https://${body.pixelImageCID}.ipfs.w3s.link/`;
			const pixelImageResponse = await fetch(pixelImageUrl);

			if (!pixelImageResponse.ok) {
				console.warn(
					`Failed to fetch pixel image from ${pixelImageUrl}: ${pixelImageResponse.status} ${pixelImageResponse.statusText}`
				);
			}

			console.log("Legacy approach: fetched pixel image but using inpainting");
			console.log("Making OpenAI API call...");

			try {
				// Use the same OpenAI inpainting API for backwards compatibility
				openAIResponse = await openai.images.edit({
					image: backgroundFile,
					mask: maskFileWithAlpha,
					prompt: enhancedPrompt,
					n: 1,
					size: "1024x1024",
				});

				console.log("OpenAI API call completed successfully");
			} catch (openaiError) {
				console.error("OpenAI API call failed:", openaiError);
				throw openaiError;
			}
		}

		console.log(
			"OpenAI API response:",
			JSON.stringify(openAIResponse, null, 2)
		);
		console.log("OpenAI response type:", typeof openAIResponse);
		console.log("OpenAI response data:", openAIResponse?.data);

		if (openAIResponse?.data && openAIResponse.data[0]?.url) {
			console.log("Returning URL:", openAIResponse.data[0].url);
			return NextResponse.json({ imageUrl: openAIResponse.data[0].url });
		} else if (openAIResponse?.data && openAIResponse.data[0]?.b64_json) {
			console.log("Returning base64 data");
			return NextResponse.json({
				imageUrl: `data:image/png;base64,${openAIResponse.data[0].b64_json}`,
			});
		} else {
			console.error("OpenAI response structure unexpected:", {
				hasResponse: !!openAIResponse,
				hasData: !!openAIResponse?.data,
				dataLength: openAIResponse?.data?.length,
				firstItem: openAIResponse?.data?.[0],
			});
			return NextResponse.json(
				{ error: "No image URL returned from OpenAI" },
				{ status: 500 }
			);
		}
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
	const aiPrompt = searchParams.get("aiPrompt");
	const pixelXStr = searchParams.get("pixelX");
	const pixelYStr = searchParams.get("pixelY");
	if (!backgroundImageCID || !pixelXStr || !pixelYStr) {
		return NextResponse.json(
			{
				error:
					"Missing one or more required query parameters: backgroundImageCID, pixelX, pixelY",
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
		pixelX,
		pixelY,
		aiPrompt,
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
