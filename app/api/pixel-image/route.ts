import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const x = searchParams.get("x");
	const y = searchParams.get("y");

	if (x === null || y === null) {
		return new NextResponse(
			JSON.stringify({ error: "Missing x or y coordinates" }),
			{
				status: 400,
				headers: { "Content-Type": "application/json" },
			}
		);
	}

	const xCoord = parseInt(x, 10);
	const yCoord = parseInt(y, 10);

	if (isNaN(xCoord) || isNaN(yCoord) || xCoord < 0 || yCoord < 0) {
		return new NextResponse(JSON.stringify({ error: "Invalid coordinates" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	// Generate a unique color based on x and y
	const r = ((xCoord * 37 + yCoord * 59 + 70) % 186) + 70; // Range 70-255
	const g = ((xCoord * 73 + yCoord * 101 + 70) % 186) + 70; // Range 70-255
	const b = ((xCoord * 113 + yCoord * 137 + 70) % 186) + 70; // Range 70-255

	// Determine text color based on background brightness
	const brightness = (r * 299 + g * 587 + b * 114) / 1000;
	const textColor = brightness > 125 ? "#000000" : "#FFFFFF";

	const svgImage = `
<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" style="fill:rgb(${r},${g},${b});" />
  <style>
    .pixel-text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"; font-size: 20px; font-weight: 500;}
  </style>
  <text x="50%" y="50%" dy="0.1em" dominant-baseline="middle" text-anchor="middle" fill="${textColor}" class="pixel-text">${xCoord},${yCoord}</text>
</svg>
  `.trim();

	return new NextResponse(svgImage, {
		status: 200,
		headers: {
			"Content-Type": "image/svg+xml",
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
}
