import { X } from "lucide-react";
import { NextApiRequest, NextApiResponse } from "next";

export async function GET(
	req: Request,
	{ params }: { params: Promise<{ coordinates: [x: string, y: string] }> }
) {
	const { coordinates } = await params;
	console.log(coordinates);
	if (!Array.isArray(coordinates) || coordinates.length !== 2) {
		return new Response("Missing x or y coordinates", { status: 400 });
	}

	const xCoord = parseInt(coordinates[0], 10);
	const yCoord = parseInt(coordinates[1], 10);

	if (isNaN(xCoord) || isNaN(yCoord) || xCoord < 0 || yCoord < 0) {
		return new Response("Invalid coordinates", { status: 400 });
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

	return new Response(svgImage, {
		headers: { "Content-Type": "image/svg+xml" },
	});
}
