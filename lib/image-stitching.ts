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
 * Create a smooth, circular gradient mask for seamless stitching.
 * - Fully transparent circular hole in the center (radius CELL_SIZE / 2).
 * - Smooth gradient to fully opaque at radius (3 * CELL_SIZE / 2).
 * - Fully opaque beyond that radius to the mask edges.
 */
export async function createStitchingMask(): Promise<Buffer> {
	const baseCanvas = sharp({
		create: {
			width: EXTRACTION_SIZE, // 256
			height: EXTRACTION_SIZE, // 256
			channels: 4,
			background: { r: 255, g: 255, b: 255, alpha: 1.0 }, // Start fully opaque white
		},
	});

	const gradientCenterX = EXTRACTION_SIZE / 2; // 128px
	const gradientCenterY = EXTRACTION_SIZE / 2; // 128px
	const gradientRadius = EXTRACTION_SIZE / 2; // 128px for the r attribute of radialGradient

	const r1_transparent_px = CELL_SIZE / 2; // 32px
	const r2_opaque_px = (3 * CELL_SIZE) / 2; // 96px

	// SVG radialGradient offsets are percentages of the gradientRadius
	const r1_offset_percent = (r1_transparent_px / gradientRadius) * 100; // 32/128 = 25%
	const r2_offset_percent = (r2_opaque_px / gradientRadius) * 100; // 96/128 = 75%

	const svgCutoutShape = `
		<svg width="${EXTRACTION_SIZE}" height="${EXTRACTION_SIZE}" xmlns="http://www.w3.org/2000/svg">
			<defs>
				<radialGradient id="smoothCircularHole" cx="${gradientCenterX}px" cy="${gradientCenterY}px" r="${gradientRadius}px" gradientUnits="userSpaceOnUse">
					<stop offset="0%"                         style="stop-color:black; stop-opacity:1;" />
					<stop offset="${r1_offset_percent}%"      style="stop-color:black; stop-opacity:1;" /> 
					<stop offset="${r2_offset_percent}%"      style="stop-color:black; stop-opacity:0;" />
					<stop offset="100%"                        style="stop-color:black; stop-opacity:0;" />
				</radialGradient>
			</defs>
			<rect x="0" y="0" width="${EXTRACTION_SIZE}" height="${EXTRACTION_SIZE}" fill="url(#smoothCircularHole)" />
		</svg>
	`;

	const cutoutShapeBuffer = await sharp(Buffer.from(svgCutoutShape))
		.png()
		.toBuffer();

	return baseCanvas
		.composite([
			{
				input: cutoutShapeBuffer,
				blend: "dest-out",
			},
		])
		.png()
		.toBuffer();
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
	generatedRegion: Buffer, // AI's output, typically 1024x1024, new pixel already inpainted
	pixelX: number,
	pixelY: number,
	stitchingMask: Buffer // Mask with transparent center, opaque/gradient edges (256x256)
): Promise<Buffer> {
	const bounds = calculateExtractionBounds(pixelX, pixelY);

	const resizedGenerated = await sharp(generatedRegion)
		.resize(EXTRACTION_SIZE, EXTRACTION_SIZE, { fit: "fill" })
		.ensureAlpha() // Ensure it has an alpha channel
		.toBuffer();

	// Create the mask for blending resizedGenerated onto originalBackground:
	// Opaque center (to show all of new pixel area), gradient transparent edges.
	// This is an inverted version of stitchingMask.
	const blendingMask = await sharp(stitchingMask)
		.negate({ alpha: false }) // Invert colors (transparent black -> white, opaque white -> black)
		// The alpha of stitchingMask is what we care about for its shape.
		// After negate, areas that were transparent in stitchingMask (alpha 0, color black)
		// become white (color) but retain alpha 0 from original if not careful.
		// We need to ensure the final blendingMask's alpha channel is what drives the blend.
		// Let's re-evaluate: Sharp's .composite uses the alpha of the INPUT image when blend is 'over'.
		// So, we need to apply an inverted alpha to resizedGenerated.
		.toBuffer(); // This buffer is now (opaque center, transparent gradient edges) if we interpret its color as alpha

	// We need resizedGenerated to have an alpha channel that is opaque in the center
	// and has gradient transparency at the edges.
	// This alpha shape comes from inverting the alpha of stitchingMask.

	const invertedAlphaForBlending = await sharp(stitchingMask)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true })
		.then(({ data, info }) => {
			for (let i = 3; i < data.length; i += 4) {
				data[i] = 255 - data[i]; // Invert alpha
			}
			return sharp(data, { raw: info }).png().toBuffer();
		});

	// Combine RGB of AI output with this new inverted alpha channel.
	const finalInputForCompositing = await sharp(resizedGenerated)
		.joinChannel(invertedAlphaForBlending)
		.png()
		.toBuffer();

	return sharp(originalBackground)
		.composite([
			{
				input: finalInputForCompositing, // This now has the correct alpha for blending
				left: bounds.startX,
				top: bounds.startY,
				blend: "over",
			},
		])
		.png()
		.toBuffer();
}
