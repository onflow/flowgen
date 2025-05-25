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

		it("should have transparent center and smooth circular gradient to opaque edges", async () => {
			const maskBuffer = await createStitchingMask();
			const maskImage = sharp(maskBuffer);

			// For debugging, save the mask to a file
			// await maskImage.clone().toFile('debug_mask.png');

			const { data, info } = await maskImage
				.raw()
				.toBuffer({ resolveWithObject: true });

			const getPixelAlpha = (x: number, y: number) => {
				if (x < 0 || x >= info.width || y < 0 || y >= info.height) return 255;
				return data[(y * info.width + x) * info.channels + 3];
			};

			const centerX = info.width / 2;
			const centerY = info.height / 2;

			const r1_transparent_px = CELL_SIZE / 2; // 32px
			const r2_opaque_px = (3 * CELL_SIZE) / 2; // 96px

			// 1. Center of the transparent hole (distance 0 from center)
			expect(getPixelAlpha(centerX, centerY)).toBeLessThan(10); // Should be fully transparent

			// 2. Just inside the transparent radius r1 (e.g., distance 30px from center)
			expect(
				getPixelAlpha(centerX + r1_transparent_px - 2, centerY)
			).toBeLessThan(10);

			// 3. Mid-point of the gradient (distance (r1+r2)/2 = (32+96)/2 = 64px from center)
			const midGradientRadius = (r1_transparent_px + r2_opaque_px) / 2;
			const midGradientAlpha = getPixelAlpha(
				centerX + Math.floor(midGradientRadius),
				centerY
			);
			expect(midGradientAlpha).toBeGreaterThan(100); // Expect significant opacity
			expect(midGradientAlpha).toBeLessThan(200); // But not fully opaque

			// 4. Just outside the opaque radius r2 (e.g., distance 98px from center)
			expect(getPixelAlpha(centerX + r2_opaque_px + 2, centerY)).toBe(255);

			// 5. Actual corner of the mask (should be fully opaque)
			expect(getPixelAlpha(5, 5)).toBe(255);
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
