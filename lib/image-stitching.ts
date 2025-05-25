import sharp from "sharp";

export const GRID_SIZE = 16; // 16x16 grid
export const CELL_SIZE = 64; // 64x64 pixels per cell
export const BACKGROUND_SIZE = 1024; // 1024x1024 total background
export const EXTRACTION_BLOCKS = 4; // Extract 4x4 blocks
export const EXTRACTION_SIZE = CELL_SIZE * EXTRACTION_BLOCKS; // 256x256

interface Position {
	x: number;
	y: number;
}

export interface ExtractionBounds {
	startX: number;
	startY: number;
	endX: number;
	endY: number;
	offsetX: number; // How much we had to adjust due to edges
	offsetY: number;
}

/**
 * Calculate the extraction bounds for a 4x4 block region around a target pixel
 * Handles edge cases where the extraction would go outside the canvas
 */
export function calculateExtractionBounds(
	pixelX: number,
	pixelY: number
): ExtractionBounds {
	// Convert grid coordinates to pixel coordinates (center of the target block)
	const targetPixelX = pixelX * CELL_SIZE + CELL_SIZE / 2;
	const targetPixelY = pixelY * CELL_SIZE + CELL_SIZE / 2;

	// Calculate ideal extraction bounds (2 blocks in each direction from center)
	let startX = targetPixelX - EXTRACTION_SIZE / 2;
	let startY = targetPixelY - EXTRACTION_SIZE / 2;
	let endX = startX + EXTRACTION_SIZE;
	let endY = startY + EXTRACTION_SIZE;

	// Track how much we adjust for edge handling
	let offsetX = 0;
	let offsetY = 0;

	// Handle left edge
	if (startX < 0) {
		offsetX = -startX;
		startX = 0;
		endX = EXTRACTION_SIZE;
	}

	// Handle right edge
	if (endX > BACKGROUND_SIZE) {
		offsetX = endX - BACKGROUND_SIZE;
		endX = BACKGROUND_SIZE;
		startX = BACKGROUND_SIZE - EXTRACTION_SIZE;
	}

	// Handle top edge
	if (startY < 0) {
		offsetY = -startY;
		startY = 0;
		endY = EXTRACTION_SIZE;
	}

	// Handle bottom edge
	if (endY > BACKGROUND_SIZE) {
		offsetY = endY - BACKGROUND_SIZE;
		endY = BACKGROUND_SIZE;
		startY = BACKGROUND_SIZE - EXTRACTION_SIZE;
	}

	return {
		startX: Math.max(0, startX),
		startY: Math.max(0, startY),
		endX: Math.min(BACKGROUND_SIZE, endX),
		endY: Math.min(BACKGROUND_SIZE, endY),
		offsetX,
		offsetY,
	};
}

/**
 * Create a gradient mask for seamless stitching
 * Center block gets full transparency (hole), surrounding blocks get gradient opacity,
 * and the entire 3x3 pattern is centered in the 256x256 mask.
 */
export async function createStitchingMask(): Promise<Buffer> {
	// Start with a fully opaque white canvas
	const canvas = sharp({
		create: {
			width: EXTRACTION_SIZE,
			height: EXTRACTION_SIZE,
			channels: 4,
			background: { r: 255, g: 255, b: 255, alpha: 1.0 }, // Start fully opaque
		},
	});

	const layers = [];

	const centerOffset = (EXTRACTION_SIZE - CELL_SIZE) / 2; // Should be (256-64)/2 = 96

	// Center block - fully transparent (cut a hole)
	const centerHole = await sharp({
		create: {
			width: CELL_SIZE,
			height: CELL_SIZE,
			channels: 4,
			background: { r: 0, g: 0, b: 0, alpha: 1.0 }, // Black for dest-out
		},
	})
		.png()
		.toBuffer();

	layers.push({
		input: centerHole,
		left: centerOffset, // Centered position: 96
		top: centerOffset, // Centered position: 96
		blend: "dest-out" as const, // Cut a hole (make transparent)
	});

	// Calculate the offset for the 3x3 grid of blocks to be centered
	const grid3x3Offset = (EXTRACTION_SIZE - 3 * CELL_SIZE) / 2; // (256 - 192) / 2 = 32

	// Adjacent blocks (ring 1) - gradient holes that fade outward
	// These are indices within a 3x3 grid (0,0 top-left, 1,1 center, 2,2 bottom-right)
	const ring1BlockCoordinates = [
		// Exclude center block (1,1) which is the main hole
		{ x: 0, y: 0 },
		{ x: 1, y: 0 },
		{ x: 2, y: 0 },
		{ x: 0, y: 1 },
		{ x: 2, y: 1 },
		{ x: 0, y: 2 },
		{ x: 1, y: 2 },
		{ x: 2, y: 2 },
	];

	for (const block of ring1BlockCoordinates) {
		// Create inverted gradient - starts transparent (center of block) and fades to opaque (edges of block)
		const gradientHole = await createInvertedGradientBlock(0.8, 0.2); // More transparent toward center of this block
		layers.push({
			input: gradientHole,
			left: grid3x3Offset + block.x * CELL_SIZE,
			top: grid3x3Offset + block.y * CELL_SIZE,
			blend: "dest-out" as const, // Cut gradient holes
		});
	}

	return canvas.composite(layers).png().toBuffer();
}

/**
 * Create an inverted gradient block that's more transparent at center, more opaque at edges
 */
async function createInvertedGradientBlock(
	centerOpacity: number,
	edgeOpacity: number
): Promise<Buffer> {
	// Create a radial gradient using SVG - inverted for dest-out usage
	const svgGradient = `
		<svg width="${CELL_SIZE}" height="${CELL_SIZE}" xmlns="http://www.w3.org/2000/svg">
			<defs>
				<radialGradient id="grad" cx="50%" cy="50%" r="70%">
					<stop offset="0%" style="stop-color:black;stop-opacity:${centerOpacity}" />
					<stop offset="100%" style="stop-color:black;stop-opacity:${edgeOpacity}" />
				</radialGradient>
			</defs>
			<rect width="100%" height="100%" fill="url(#grad)" />
		</svg>
	`;

	return sharp(Buffer.from(svgGradient)).png().toBuffer();
}

/**
 * Extract a region from the background image
 */
export async function extractRegion(
	backgroundBuffer: Buffer,
	pixelX: number,
	pixelY: number
): Promise<{ extractedRegion: Buffer; bounds: ExtractionBounds }> {
	const bounds = calculateExtractionBounds(pixelX, pixelY);

	const extractedRegion = await sharp(backgroundBuffer)
		.extract({
			left: bounds.startX,
			top: bounds.startY,
			width: bounds.endX - bounds.startX,
			height: bounds.endY - bounds.startY,
		})
		.resize(EXTRACTION_SIZE, EXTRACTION_SIZE, { fit: "fill" }) // Ensure exactly 256x256
		.png()
		.toBuffer();

	return { extractedRegion, bounds };
}

/**
 * Composite the generated result back onto the original background
 */
export async function compositeResult(
	originalBackground: Buffer,
	generatedRegion: Buffer,
	pixelX: number,
	pixelY: number,
	stitchingMask: Buffer
): Promise<Buffer> {
	const bounds = calculateExtractionBounds(pixelX, pixelY);

	// OpenAI returns 1024x1024, but we need to resize it back to our extraction size (256x256)
	const resizedGenerated = await sharp(generatedRegion)
		.resize(EXTRACTION_SIZE, EXTRACTION_SIZE, { fit: "fill" })
		.png()
		.toBuffer();

	// First, create the masked generated region
	const maskedGeneration = await sharp(resizedGenerated)
		.composite([
			{
				input: stitchingMask,
				blend: "dest-in", // Use mask as alpha channel
			},
		])
		.png()
		.toBuffer();

	// Then composite onto the original background
	return sharp(originalBackground)
		.composite([
			{
				input: maskedGeneration,
				left: bounds.startX,
				top: bounds.startY,
				blend: "over",
			},
		])
		.png()
		.toBuffer();
}
