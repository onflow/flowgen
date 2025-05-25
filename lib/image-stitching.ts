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

	// Make the fully transparent hole larger (64px radius) for AI inpainting
	const r1_transparent_px = CELL_SIZE; // 64px (was CELL_SIZE / 2)
	// Gradient still goes to the full edge of the 256x256 extraction area
	const r2_opaque_px = EXTRACTION_SIZE / 2; // 128px

	// SVG radialGradient offsets are percentages of the gradientRadius
	const r1_offset_percent = (r1_transparent_px / gradientRadius) * 100; // 64/128 = 50%
	const r2_offset_percent = (r2_opaque_px / gradientRadius) * 100; // 128/128 = 100%

	const svgCutoutShape = `
		<svg width="${EXTRACTION_SIZE}" height="${EXTRACTION_SIZE}" xmlns="http://www.w3.org/2000/svg">
			<defs>
				<radialGradient id="smoothCircularHole" cx="${gradientCenterX}px" cy="${gradientCenterY}px" r="${gradientRadius}px" gradientUnits="userSpaceOnUse">
					<stop offset="0%"                         style="stop-color:black; stop-opacity:1;" />
					<stop offset="${r1_offset_percent}%"      style="stop-color:black; stop-opacity:1;" /> 
					<stop offset="${r2_offset_percent}%"      style="stop-color:black; stop-opacity:0;" />
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
	generatedRegion: Buffer, // AI's output, typically 1024x1024
	pixelX: number,
	pixelY: number,
	stitchingMask: Buffer // Original stitchingMask, not directly used here anymore
): Promise<Buffer> {
	const bounds = calculateExtractionBounds(pixelX, pixelY);

	// 1. Get raw RGB pixel data from AI's output (resized)
	const resizedGeneratedSharp = sharp(generatedRegion)
		.resize(EXTRACTION_SIZE, EXTRACTION_SIZE, { fit: "fill" })
		.removeAlpha(); // Ensure we are working with 3 channels for RGB

	const resizedGeneratedRGB = await resizedGeneratedSharp.raw().toBuffer();

	const {
		width: imgWidth,
		height: imgHeight,
		channels: imgChannels,
	} = await resizedGeneratedSharp.metadata();
	if (imgChannels !== 3) {
		throw new Error(
			`Expected 3 channels (RGB) from resizedGenerated, but got ${imgChannels}`
		);
	}

	// 2. Programmatically create the desired alpha channel (256x256, 1 channel)
	const alphaData = Buffer.alloc(EXTRACTION_SIZE * EXTRACTION_SIZE);
	const R1_OPAQUE_RADIUS = CELL_SIZE; // 64px
	const R2_TRANSPARENT_RADIUS = EXTRACTION_SIZE / 2; // 128px
	const centerX = EXTRACTION_SIZE / 2;
	const centerY = EXTRACTION_SIZE / 2;

	for (let y = 0; y < EXTRACTION_SIZE; y++) {
		for (let x = 0; x < EXTRACTION_SIZE; x++) {
			const distance = Math.sqrt(
				Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
			);
			let alphaValue = 0;
			if (distance < R1_OPAQUE_RADIUS) {
				alphaValue = 255;
			} else if (distance < R2_TRANSPARENT_RADIUS) {
				const gradientRange = R2_TRANSPARENT_RADIUS - R1_OPAQUE_RADIUS;
				const distanceIntoGradient = distance - R1_OPAQUE_RADIUS;
				alphaValue = 255 * (1 - distanceIntoGradient / gradientRange);
			} else {
				alphaValue = 0;
			}
			alphaData[y * EXTRACTION_SIZE + x] = Math.max(
				0,
				Math.min(255, Math.round(alphaValue))
			);
		}
	}

	// 3. Manually construct a 4-channel (RGBA) buffer
	const rgbaBuffer = Buffer.alloc(EXTRACTION_SIZE * EXTRACTION_SIZE * 4);
	for (let i = 0; i < EXTRACTION_SIZE * EXTRACTION_SIZE; i++) {
		rgbaBuffer[i * 4 + 0] = resizedGeneratedRGB[i * 3 + 0]; // R
		rgbaBuffer[i * 4 + 1] = resizedGeneratedRGB[i * 3 + 1]; // G
		rgbaBuffer[i * 4 + 2] = resizedGeneratedRGB[i * 3 + 2]; // B
		rgbaBuffer[i * 4 + 3] = alphaData[i]; // Alpha
	}

	const finalInputForCompositing = await sharp(rgbaBuffer, {
		raw: { width: EXTRACTION_SIZE, height: EXTRACTION_SIZE, channels: 4 },
	})
		.png()
		.toBuffer();

	// 4. Ensure original background has an alpha channel for consistent compositing
	const originalBackgroundWithAlpha = await sharp(originalBackground)
		.ensureAlpha()
		.toBuffer();

	return sharp(originalBackgroundWithAlpha)
		.composite([
			{
				input: finalInputForCompositing,
				left: bounds.startX,
				top: bounds.startY,
				blend: "over",
			},
		])
		.png()
		.toBuffer();
}
