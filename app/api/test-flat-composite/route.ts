import { NextResponse } from "next/server";
import sharp from "sharp";
import {
	createStitchingMask,
	calculateExtractionBounds,
	compositeResult, // We'll call the existing one to test its internal logic
	EXTRACTION_SIZE,
	BACKGROUND_SIZE,
	CELL_SIZE,
} from "@/lib/image-stitching";

export async function GET(request: Request) {
	try {
		// 1. Create a solid color original background (e.g., red)
		const testOriginalBackground = await sharp({
			create: {
				width: BACKGROUND_SIZE, // 1024
				height: BACKGROUND_SIZE,
				channels: 3,
				background: { r: 255, g: 0, b: 0 }, // Red
			},
		})
			.png()
			.toBuffer();

		// 2. Create a solid color AI-generated region (e.g., blue)
		// This represents the AI's output, which would normally be 1024x1024 then resized.
		// For this test, we make it directly 256x256 as if it was already resized.
		const testGeneratedRegion = await sharp({
			create: {
				width: EXTRACTION_SIZE, // 256
				height: EXTRACTION_SIZE,
				channels: 3,
				background: { r: 0, g: 0, b: 255 }, // Blue
			},
		})
			.png()
			.toBuffer();
		// Note: compositeResult expects the AI output to be 1024x1024 initially.
		// To simplify this flat color test, we can either make testGeneratedRegion 1024x1024
		// or temporarily adjust compositeResult if needed. For now, let's make it 1024x1024.
		const testAiOutput1024 = await sharp(testGeneratedRegion)
			.resize(BACKGROUND_SIZE, BACKGROUND_SIZE, {
				fit: "contain",
				background: { r: 0, g: 0, b: 255, alpha: 1 },
			})
			.png()
			.toBuffer();

		// 3. Get the current stitchingMask (transparent center 0-64px rad, gradient 64-128px rad)
		const stitchingMask = await createStitchingMask();

		// 4. Call the existing compositeResult function
		// It will resize testAiOutput1024 to 256x256, create inverted alpha, and composite.
		const pixelX = 7; // Center of the grid for placement
		const pixelY = 7;
		const finalImage = await compositeResult(
			testOriginalBackground,
			testAiOutput1024, // Pass the 1024x1024 blue image
			pixelX,
			pixelY,
			stitchingMask
		);

		return new Response(finalImage, {
			headers: {
				"Content-Type": "image/png",
			},
		});
	} catch (error: any) {
		console.error("Error in flat color composite test:", error);
		return NextResponse.json(
			{ error: error.message || "Failed to run flat color composite test" },
			{ status: 500 }
		);
	}
}
