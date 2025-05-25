import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import {
	calculateExtractionBounds,
	createStitchingMask,
	extractRegion,
	GRID_SIZE,
	CELL_SIZE,
	BACKGROUND_SIZE,
	EXTRACTION_SIZE,
	type ExtractionBounds,
} from "../image-stitching";

describe("Image Stitching Logic", () => {
	describe("calculateExtractionBounds", () => {
		describe("Middle pixels (no edge handling needed)", () => {
			it("should calculate correct bounds for center pixel (7,7)", () => {
				const bounds = calculateExtractionBounds(7, 7);
				const expectedCenterX = 7 * CELL_SIZE + CELL_SIZE / 2; // 480
				const expectedCenterY = 7 * CELL_SIZE + CELL_SIZE / 2; // 480

				expect(bounds).toEqual({
					startX: expectedCenterX - EXTRACTION_SIZE / 2, // 352
					startY: expectedCenterY - EXTRACTION_SIZE / 2, // 352
					endX: expectedCenterX + EXTRACTION_SIZE / 2, // 608
					endY: expectedCenterY + EXTRACTION_SIZE / 2, // 608
					offsetX: 0,
					offsetY: 0,
				});
			});

			it("should calculate correct bounds for pixel (8,8)", () => {
				const bounds = calculateExtractionBounds(8, 8);
				const expectedCenterX = 8 * CELL_SIZE + CELL_SIZE / 2; // 544
				const expectedCenterY = 8 * CELL_SIZE + CELL_SIZE / 2; // 544

				expect(bounds).toEqual({
					startX: expectedCenterX - EXTRACTION_SIZE / 2, // 416
					startY: expectedCenterY - EXTRACTION_SIZE / 2, // 416
					endX: expectedCenterX + EXTRACTION_SIZE / 2, // 672
					endY: expectedCenterY + EXTRACTION_SIZE / 2, // 672
					offsetX: 0,
					offsetY: 0,
				});
			});
		});

		describe("Edge pixels (need boundary adjustment)", () => {
			it("should handle left edge pixel (0,7)", () => {
				const bounds = calculateExtractionBounds(0, 7);

				expect(bounds.startX).toBe(0); // Clamped to left edge
				expect(bounds.endX).toBe(EXTRACTION_SIZE); // 256
				expect(bounds.offsetX).toBeGreaterThan(0); // Adjusted due to edge
				expect(bounds.offsetY).toBe(0); // No Y adjustment needed
			});

			it("should handle right edge pixel (15,7)", () => {
				const bounds = calculateExtractionBounds(15, 7);

				expect(bounds.endX).toBe(BACKGROUND_SIZE); // Clamped to right edge (1024)
				expect(bounds.startX).toBe(BACKGROUND_SIZE - EXTRACTION_SIZE); // 768
				expect(bounds.offsetX).toBeGreaterThan(0); // Adjusted due to edge
				expect(bounds.offsetY).toBe(0); // No Y adjustment needed
			});

			it("should handle top edge pixel (7,0)", () => {
				const bounds = calculateExtractionBounds(7, 0);

				expect(bounds.startY).toBe(0); // Clamped to top edge
				expect(bounds.endY).toBe(EXTRACTION_SIZE); // 256
				expect(bounds.offsetY).toBeGreaterThan(0); // Adjusted due to edge
				expect(bounds.offsetX).toBe(0); // No X adjustment needed
			});

			it("should handle bottom edge pixel (7,15)", () => {
				const bounds = calculateExtractionBounds(7, 15);

				expect(bounds.endY).toBe(BACKGROUND_SIZE); // Clamped to bottom edge (1024)
				expect(bounds.startY).toBe(BACKGROUND_SIZE - EXTRACTION_SIZE); // 768
				expect(bounds.offsetY).toBeGreaterThan(0); // Adjusted due to edge
				expect(bounds.offsetX).toBe(0); // No X adjustment needed
			});
		});

		describe("Corner pixels (need both X and Y adjustment)", () => {
			it("should handle top-left corner (0,0)", () => {
				const bounds = calculateExtractionBounds(0, 0);

				expect(bounds.startX).toBe(0);
				expect(bounds.startY).toBe(0);
				expect(bounds.endX).toBe(EXTRACTION_SIZE);
				expect(bounds.endY).toBe(EXTRACTION_SIZE);
				expect(bounds.offsetX).toBeGreaterThan(0);
				expect(bounds.offsetY).toBeGreaterThan(0);
			});

			it("should handle top-right corner (15,0)", () => {
				const bounds = calculateExtractionBounds(15, 0);

				expect(bounds.startX).toBe(BACKGROUND_SIZE - EXTRACTION_SIZE);
				expect(bounds.startY).toBe(0);
				expect(bounds.endX).toBe(BACKGROUND_SIZE);
				expect(bounds.endY).toBe(EXTRACTION_SIZE);
				expect(bounds.offsetX).toBeGreaterThan(0);
				expect(bounds.offsetY).toBeGreaterThan(0);
			});

			it("should handle bottom-left corner (0,15)", () => {
				const bounds = calculateExtractionBounds(0, 15);

				expect(bounds.startX).toBe(0);
				expect(bounds.startY).toBe(BACKGROUND_SIZE - EXTRACTION_SIZE);
				expect(bounds.endX).toBe(EXTRACTION_SIZE);
				expect(bounds.endY).toBe(BACKGROUND_SIZE);
				expect(bounds.offsetX).toBeGreaterThan(0);
				expect(bounds.offsetY).toBeGreaterThan(0);
			});

			it("should handle bottom-right corner (15,15)", () => {
				const bounds = calculateExtractionBounds(15, 15);

				expect(bounds.startX).toBe(BACKGROUND_SIZE - EXTRACTION_SIZE);
				expect(bounds.startY).toBe(BACKGROUND_SIZE - EXTRACTION_SIZE);
				expect(bounds.endX).toBe(BACKGROUND_SIZE);
				expect(bounds.endY).toBe(BACKGROUND_SIZE);
				expect(bounds.offsetX).toBeGreaterThan(0);
				expect(bounds.offsetY).toBeGreaterThan(0);
			});
		});

		describe("Boundary validation", () => {
			it("should ensure extraction bounds never exceed background size", () => {
				// Test all grid positions
				for (let x = 0; x < GRID_SIZE; x++) {
					for (let y = 0; y < GRID_SIZE; y++) {
						const bounds = calculateExtractionBounds(x, y);

						expect(bounds.startX).toBeGreaterThanOrEqual(0);
						expect(bounds.startY).toBeGreaterThanOrEqual(0);
						expect(bounds.endX).toBeLessThanOrEqual(BACKGROUND_SIZE);
						expect(bounds.endY).toBeLessThanOrEqual(BACKGROUND_SIZE);
						expect(bounds.endX - bounds.startX).toBeLessThanOrEqual(
							EXTRACTION_SIZE
						);
						expect(bounds.endY - bounds.startY).toBeLessThanOrEqual(
							EXTRACTION_SIZE
						);
					}
				}
			});
		});
	});

	describe("createStitchingMask", () => {
		it("should create a mask with correct dimensions", async () => {
			const maskBuffer = await createStitchingMask();
			const maskImage = sharp(maskBuffer);
			const metadata = await maskImage.metadata();

			expect(metadata.width).toBe(EXTRACTION_SIZE);
			expect(metadata.height).toBe(EXTRACTION_SIZE);
			expect(metadata.channels).toBe(4); // RGBA
		});

		it("should have transparent center and opaque edges", async () => {
			const maskBuffer = await createStitchingMask();
			const maskImage = sharp(maskBuffer);

			// Extract pixel data
			const { data } = await maskImage
				.raw()
				.toBuffer({ resolveWithObject: true });

			// Check center of the main hole (96,96) which should be fully transparent
			const mainHoleCenterX = (EXTRACTION_SIZE - CELL_SIZE) / 2 + CELL_SIZE / 2; // 96 + 32 = 128
			const mainHoleCenterY = (EXTRACTION_SIZE - CELL_SIZE) / 2 + CELL_SIZE / 2; // 96 + 32 = 128
			const mainHoleIndex =
				(mainHoleCenterY * EXTRACTION_SIZE + mainHoleCenterX) * 4;
			const mainHoleAlpha = data[mainHoleIndex + 3];

			// Check a pixel in the gradient area (e.g., center of the top-middle gradient block)
			// This block is at (grid3x3Offset + 1*CELL_SIZE, grid3x3Offset + 0*CELL_SIZE)
			// So its top-left is (32+64, 32) = (96, 32). Its center is (96+32, 32+32) = (128, 64)
			const gradientBlockCenterX =
				(EXTRACTION_SIZE - 3 * CELL_SIZE) / 2 + CELL_SIZE + CELL_SIZE / 2; // 32 + 64 + 32 = 128
			const gradientBlockCenterY =
				(EXTRACTION_SIZE - 3 * CELL_SIZE) / 2 + CELL_SIZE / 2; // 32 + 32 = 64
			const gradientIndex =
				(gradientBlockCenterY * EXTRACTION_SIZE + gradientBlockCenterX) * 4;
			const gradientAlpha = data[gradientIndex + 3];

			// Check an actual corner pixel of the 256x256 mask (should be fully opaque)
			const cornerX = 5; // Very close to actual corner
			const cornerY = 5; // Very close to actual corner
			const cornerIndex = (cornerY * EXTRACTION_SIZE + cornerX) * 4;
			const cornerAlpha = data[cornerIndex + 3];

			expect(mainHoleAlpha).toBeLessThan(10); // Center of main hole should be very transparent (almost 0)
			expect(gradientAlpha).toBeGreaterThan(10); // Gradient area should have some opacity
			expect(gradientAlpha).toBeLessThan(245); // And not be fully opaque
			expect(cornerAlpha).toBe(255); // Actual corners of the mask should be fully opaque
		});
	});

	describe("extractRegion with mock image", () => {
		let testImageBuffer: Buffer;

		beforeAll(async () => {
			// Create a test image with a grid pattern for easy verification
			testImageBuffer = await sharp({
				create: {
					width: BACKGROUND_SIZE,
					height: BACKGROUND_SIZE,
					channels: 3,
					background: { r: 100, g: 150, b: 200 },
				},
			})
				.png()
				.toBuffer();
		});

		it("should extract correct region size for middle pixel", async () => {
			const { extractedRegion, bounds } = await extractRegion(
				testImageBuffer,
				7,
				7
			);
			const extractedImage = sharp(extractedRegion);
			const metadata = await extractedImage.metadata();

			expect(metadata.width).toBe(EXTRACTION_SIZE);
			expect(metadata.height).toBe(EXTRACTION_SIZE);
			expect(bounds.offsetX).toBe(0);
			expect(bounds.offsetY).toBe(0);
		});

		it("should extract correct region size for corner pixel", async () => {
			const { extractedRegion, bounds } = await extractRegion(
				testImageBuffer,
				0,
				0
			);
			const extractedImage = sharp(extractedRegion);
			const metadata = await extractedImage.metadata();

			expect(metadata.width).toBe(EXTRACTION_SIZE);
			expect(metadata.height).toBe(EXTRACTION_SIZE);
			expect(bounds.offsetX).toBeGreaterThan(0);
			expect(bounds.offsetY).toBeGreaterThan(0);
		});

		it("should extract correct region size for edge pixel", async () => {
			const { extractedRegion, bounds } = await extractRegion(
				testImageBuffer,
				0,
				7
			);
			const extractedImage = sharp(extractedRegion);
			const metadata = await extractedImage.metadata();

			expect(metadata.width).toBe(EXTRACTION_SIZE);
			expect(metadata.height).toBe(EXTRACTION_SIZE);
			expect(bounds.offsetX).toBeGreaterThan(0);
			expect(bounds.offsetY).toBe(0);
		});
	});

	describe("Edge case scenarios", () => {
		it("should handle extraction near boundaries consistently", () => {
			const testCases = [
				{ x: 1, y: 1, description: "near top-left" },
				{ x: 14, y: 1, description: "near top-right" },
				{ x: 1, y: 14, description: "near bottom-left" },
				{ x: 14, y: 14, description: "near bottom-right" },
				{ x: 0, y: 8, description: "left edge middle" },
				{ x: 15, y: 8, description: "right edge middle" },
				{ x: 8, y: 0, description: "top edge middle" },
				{ x: 8, y: 15, description: "bottom edge middle" },
			];

			testCases.forEach(({ x, y, description }) => {
				const bounds = calculateExtractionBounds(x, y);

				// All extractions should result in the same size
				expect(bounds.endX - bounds.startX).toBeLessThanOrEqual(
					EXTRACTION_SIZE
				);
				expect(bounds.endY - bounds.startY).toBeLessThanOrEqual(
					EXTRACTION_SIZE
				);

				// Bounds should be within background
				expect(bounds.startX).toBeGreaterThanOrEqual(0);
				expect(bounds.startY).toBeGreaterThanOrEqual(0);
				expect(bounds.endX).toBeLessThanOrEqual(BACKGROUND_SIZE);
				expect(bounds.endY).toBeLessThanOrEqual(BACKGROUND_SIZE);
			});
		});

		it("should maintain extraction area consistency", () => {
			// Test that extraction areas are consistent regardless of position
			const middleBounds = calculateExtractionBounds(7, 7);
			const cornerBounds = calculateExtractionBounds(0, 0);
			const edgeBounds = calculateExtractionBounds(0, 7);

			const middleArea =
				(middleBounds.endX - middleBounds.startX) *
				(middleBounds.endY - middleBounds.startY);
			const cornerArea =
				(cornerBounds.endX - cornerBounds.startX) *
				(cornerBounds.endY - cornerBounds.startY);
			const edgeArea =
				(edgeBounds.endX - edgeBounds.startX) *
				(edgeBounds.endY - edgeBounds.startY);

			expect(middleArea).toBe(EXTRACTION_SIZE * EXTRACTION_SIZE);
			expect(cornerArea).toBe(EXTRACTION_SIZE * EXTRACTION_SIZE);
			expect(edgeArea).toBe(EXTRACTION_SIZE * EXTRACTION_SIZE);
		});
	});
});
