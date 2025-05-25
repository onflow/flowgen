import { NextResponse } from "next/server";
import {
	extractRegion,
	createStitchingMask,
	calculateExtractionBounds,
	GRID_SIZE,
} from "@/lib/image-stitching";

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const component = searchParams.get("component") || "mask";
	const x = parseInt(searchParams.get("x") || "7", 10);
	const y = parseInt(searchParams.get("y") || "7", 10);
	const backgroundCID = searchParams.get("backgroundCID");

	try {
		switch (component) {
			case "mask": {
				// Return the stitching mask
				const maskBuffer = await createStitchingMask();
				return new Response(maskBuffer, {
					headers: {
						"Content-Type": "image/png",
						"X-Component": "stitching-mask",
					},
				});
			}

			case "bounds": {
				// Return extraction bounds info
				if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
					return NextResponse.json(
						{
							error: `Coordinates must be between 0 and ${GRID_SIZE - 1}`,
						},
						{ status: 400 }
					);
				}

				const bounds = calculateExtractionBounds(x, y);
				return NextResponse.json({
					coordinates: { x, y },
					bounds,
					gridSize: GRID_SIZE,
				});
			}

			case "extract": {
				// Return extracted region if backgroundCID provided
				if (!backgroundCID) {
					return NextResponse.json(
						{
							error: "backgroundCID required for extraction test",
						},
						{ status: 400 }
					);
				}

				if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
					return NextResponse.json(
						{
							error: `Coordinates must be between 0 and ${GRID_SIZE - 1}`,
						},
						{ status: 400 }
					);
				}

				// Fetch background image
				const backgroundImageUrl = `https://${backgroundCID}.ipfs.w3s.link/`;
				const bgImageResponse = await fetch(backgroundImageUrl);

				if (!bgImageResponse.ok) {
					throw new Error(
						`Failed to fetch background: ${bgImageResponse.status}`
					);
				}

				const backgroundBlob = await bgImageResponse.blob();
				const backgroundBuffer = Buffer.from(
					await backgroundBlob.arrayBuffer()
				);

				// Extract region
				const { extractedRegion, bounds } = await extractRegion(
					backgroundBuffer,
					x,
					y
				);

				return new Response(extractedRegion, {
					headers: {
						"Content-Type": "image/png",
						"X-Component": "extracted-region",
						"X-Coordinates": `${x},${y}`,
						"X-Extraction-Bounds": JSON.stringify(bounds),
					},
				});
			}

			default: {
				return NextResponse.json({
					error: "Invalid component. Use: mask, bounds, or extract",
					availableComponents: ["mask", "bounds", "extract"],
					usage: {
						mask: "/api/test-stitch?component=mask",
						bounds: "/api/test-stitch?component=bounds&x=7&y=7",
						extract:
							"/api/test-stitch?component=extract&x=7&y=7&backgroundCID=your_cid",
					},
				});
			}
		}
	} catch (error) {
		console.error("Error in test-stitch:", error);
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : "Unknown error",
				component,
			},
			{ status: 500 }
		);
	}
}
