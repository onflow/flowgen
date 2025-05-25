import { NextResponse } from "next/server";
import { extractRegion, GRID_SIZE } from "@/lib/image-stitching";

export async function GET(
	request: Request,
	{
		params,
	}: { params: Promise<{ coordinates: [x: string, y: string, cid: string] }> }
) {
	const { coordinates } = await params;

	if (!Array.isArray(coordinates) || coordinates.length !== 3) {
		return NextResponse.json(
			{ error: "Missing x, y coordinates, or background CID" },
			{ status: 400 }
		);
	}

	try {
		const x = parseInt(coordinates[0], 10);
		const y = parseInt(coordinates[1], 10);
		const backgroundCID = coordinates[2];

		// Validate coordinates
		if (
			isNaN(x) ||
			isNaN(y) ||
			x < 0 ||
			x >= GRID_SIZE ||
			y < 0 ||
			y >= GRID_SIZE
		) {
			return NextResponse.json(
				{
					error: `Invalid coordinates. x and y must be integers between 0 and ${
						GRID_SIZE - 1
					}.`,
				},
				{ status: 400 }
			);
		}

		// Validate background CID
		if (!backgroundCID || typeof backgroundCID !== "string") {
			return NextResponse.json(
				{ error: "Invalid background CID" },
				{ status: 400 }
			);
		}

		// Fetch the background image
		const backgroundImageUrl = `https://${backgroundCID}.ipfs.w3s.link/`;
		const bgImageResponse = await fetch(backgroundImageUrl);

		if (!bgImageResponse.ok) {
			throw new Error(
				`Failed to fetch background image from ${backgroundImageUrl}: ${bgImageResponse.status} ${bgImageResponse.statusText}`
			);
		}

		const backgroundBlob = await bgImageResponse.blob();
		const backgroundBuffer = Buffer.from(await backgroundBlob.arrayBuffer());

		// Extract the region
		const { extractedRegion, bounds } = await extractRegion(
			backgroundBuffer,
			x,
			y
		);

		return new Response(extractedRegion, {
			headers: {
				"Content-Type": "image/png",
				"Cache-Control": "s-maxage=31536000, stale-while-revalidate",
				"Content-Length": extractedRegion.length.toString(),
				// Include bounds information in headers for debugging
				"X-Extraction-Bounds": JSON.stringify(bounds),
			},
		});
	} catch (error) {
		console.error("Error extracting region:", error);
		return NextResponse.json(
			{ error: "Failed to extract image region" },
			{ status: 500 }
		);
	}
}

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const { backgroundImageCID, pixelX, pixelY } = body;

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

		const pX = parseInt(pixelX as string, 10);
		const pY = parseInt(pixelY as string, 10);

		if (isNaN(pX) || isNaN(pY)) {
			return NextResponse.json(
				{ error: "pixelX and pixelY must be valid numbers." },
				{ status: 400 }
			);
		}

		// Validate coordinates
		if (pX < 0 || pX >= GRID_SIZE || pY < 0 || pY >= GRID_SIZE) {
			return NextResponse.json(
				{
					error: `Invalid coordinates. x and y must be integers between 0 and ${
						GRID_SIZE - 1
					}.`,
				},
				{ status: 400 }
			);
		}

		// Fetch the background image
		const backgroundImageUrl = `https://${backgroundImageCID}.ipfs.w3s.link/`;
		const bgImageResponse = await fetch(backgroundImageUrl);

		if (!bgImageResponse.ok) {
			throw new Error(
				`Failed to fetch background image from ${backgroundImageUrl}: ${bgImageResponse.status} ${bgImageResponse.statusText}`
			);
		}

		const backgroundBlob = await bgImageResponse.blob();
		const backgroundBuffer = Buffer.from(await backgroundBlob.arrayBuffer());

		// Extract the region
		const { extractedRegion, bounds } = await extractRegion(
			backgroundBuffer,
			pX,
			pY
		);

		return NextResponse.json({
			success: true,
			bounds,
			imageUrl: `data:image/png;base64,${extractedRegion.toString("base64")}`,
		});
	} catch (error: any) {
		console.error("Error in POST /api/extract-region:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Failed to extract region";
		return NextResponse.json({ error: errorMessage }, { status: 500 });
	}
}
