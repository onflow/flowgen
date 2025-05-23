import { NextResponse } from "next/server";
import sharp from "sharp";

const MASK_DIMENSION = 1024;
const CELL_DIMENSION = 64;
const MAX_COORD_INDEX = MASK_DIMENSION / CELL_DIMENSION - 1; // Should be 15 for 1024/64

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ coordinates: [x: string, y: string] }> }
) {
	const { coordinates } = await params;
	if (!Array.isArray(coordinates) || coordinates.length !== 2) {
		return new Response("Missing x or y coordinates", { status: 400 });
	}

	try {
		const x = parseInt(coordinates[0], 10);
		const y = parseInt(coordinates[1], 10);

		if (
			isNaN(x) ||
			isNaN(y) ||
			x < 0 ||
			x > MAX_COORD_INDEX ||
			y < 0 ||
			y > MAX_COORD_INDEX
		) {
			return NextResponse.json(
				{
					error: `Invalid coordinates. x and y must be integers between 0 and ${MAX_COORD_INDEX}.`,
				},
				{ status: 400 }
			);
		}

		const xCoord = x * CELL_DIMENSION;
		const yCoord = y * CELL_DIMENSION;

		// Create a fully opaque white square that will be used to cut a hole
		const cuttingSquareBuffer = await sharp({
			create: {
				width: CELL_DIMENSION,
				height: CELL_DIMENSION,
				channels: 4, // RGBA
				background: { r: 255, g: 255, b: 255, alpha: 1 }, // Fully opaque white
			},
		})
			.png()
			.toBuffer();

		// Create the base 1024x1024 opaque image and composite the cutting square with dest-out
		// dest-out blend mode will remove pixels where the cutting square is opaque
		const maskBuffer = await sharp({
			create: {
				width: MASK_DIMENSION,
				height: MASK_DIMENSION,
				channels: 4, // RGBA
				background: { r: 0, g: 0, b: 0, alpha: 1 }, // Opaque black background
			},
		})
			.composite([
				{
					input: cuttingSquareBuffer,
					left: xCoord,
					top: yCoord,
					blend: "dest-out", // This cuts a hole in the base image
				},
			])
			.png()
			.toBuffer();

		return new Response(maskBuffer, {
			headers: {
				"Content-Type": "image/png",
				"Cache-Control": "s-maxage=31536000, stale-while-revalidate",
				"Content-Length": maskBuffer.length.toString(),
			},
		});
	} catch (error) {
		console.error("Error generating mask:", error);
		return NextResponse.json(
			{ error: "Failed to generate mask image" },
			{ status: 500 }
		);
	}
}
