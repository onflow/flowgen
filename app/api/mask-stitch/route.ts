import { NextResponse } from "next/server";
import { createStitchingMask } from "@/lib/image-stitching";

export async function GET(request: Request) {
	try {
		// Generate the stitching mask
		const maskBuffer = await createStitchingMask();

		return new Response(maskBuffer, {
			headers: {
				"Content-Type": "image/png",
				"Cache-Control": "s-maxage=31536000, stale-while-revalidate",
				"Content-Length": maskBuffer.length.toString(),
			},
		});
	} catch (error) {
		console.error("Error generating stitching mask:", error);
		return NextResponse.json(
			{ error: "Failed to generate stitching mask" },
			{ status: 500 }
		);
	}
}

export async function POST(request: Request) {
	try {
		// For POST requests, return the mask as base64 in JSON
		const maskBuffer = await createStitchingMask();

		return NextResponse.json({
			success: true,
			maskUrl: `data:image/png;base64,${maskBuffer.toString("base64")}`,
		});
	} catch (error: any) {
		console.error("Error in POST /api/mask-stitch:", error);
		const errorMessage =
			error instanceof Error
				? error.message
				: "Failed to generate stitching mask";
		return NextResponse.json({ error: errorMessage }, { status: 500 });
	}
}
