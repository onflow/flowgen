// flowgenPromptStyles.ts

export const CUTE_ART_STYLES = [
	"pixelArt",
	"chibi",
	"kawaiiPastel",
	"softBlob",
	"sanrio",
	"vinylToy",
	"storybook",
	"flatDesign",
	"y2kBubble",
	"crochetAmigurumi",
] as const;

export type CuteArtStyle = (typeof CUTE_ART_STYLES)[number];

export const CUTE_ART_STYLE_LABELS: Record<CuteArtStyle, string> = {
	pixelArt: "Pixel Art",
	chibi: "Chibi",
	kawaiiPastel: "Kawaii Pastel",
	softBlob: "Soft Blob",
	sanrio: "Sanrio-Inspired",
	vinylToy: "Vinyl Toy",
	storybook: "Storybook",
	flatDesign: "Flat Design",
	y2kBubble: "Y2K Bubble",
	crochetAmigurumi: "Crochet / Amigurumi",
};

const stylePromptTemplates: Record<
	CuteArtStyle,
	(userPrompt: string) => string
> = {
	pixelArt: (prompt) =>
		`A pixel art version of ${prompt}, in retro 16-bit style, super cute and blocky.`,
	chibi: (prompt) =>
		`A chibi version of ${prompt}, with a big head, tiny body, and cute anime style.`,
	kawaiiPastel: (prompt) =>
		`A cute pastel illustration of ${prompt}, with soft colors, sparkles, and kawaii features.`,
	softBlob: (prompt) =>
		`A soft, blobby, round version of ${prompt}, with simple eyes and a squishy look.`,
	sanrio: (prompt) =>
		`A Sanrio-inspired cute version of ${prompt}, like Hello Kitty or Cinnamoroll, clean and iconic.`,
	vinylToy: (prompt) =>
		`A collectible vinyl toy version of ${prompt}, with stylized proportions and clean lines.`,
	storybook: (prompt) =>
		`A children's storybook illustration of ${prompt}, with watercolor textures and whimsy.`,
	flatDesign: (prompt) =>
		`A minimal, flat design version of ${prompt}, with bold shapes and bright colors.`,
	y2kBubble: (prompt) =>
		`A bubbly, glossy Y2K-style version of ${prompt}, with shiny effects and playful energy.`,
	crochetAmigurumi: (prompt) =>
		`An amigurumi crochet version of ${prompt}, made of yarn and very soft and cute.`,
};

/**
 * Generate a styled prompt for use in image generation.
 * @param style The selected cute art style.
 * @param userPrompt The user-provided base prompt.
 * @returns A styled image generation prompt.
 */
export function generateStyledPrompt(
	style: CuteArtStyle,
	userPrompt: string
): string {
	const template = stylePromptTemplates[style];
	return template(userPrompt);
}

export function generateBackgroundPrompt(
	userPrompt: string,
	pixelX: number,
	pixelY: number
): string {
	return `Can you place and squash the opaque parts of the second image onto the first image by using only the masked of the background area described by the 3rd image? The new element being placed should be incorporated into the backgrond at that spot as if it were part of the background. Please leave the rest of the background as is. The placed element should not take up more space than 64x64 pixels and should be placed at the coordinates ${pixelX},${pixelY}.`;
}

export function generateBackgroundInsertionPrompt(
	originalAiPrompt: string,
	pixelX?: number,
	pixelY?: number
): string {
	// The originalAiPrompt already contains style information (e.g., "A pixel art version of A little car, in retro 16-bit style, super cute and blocky.")
	// So we just need to create an insertion prompt using this already-styled prompt
	let insertPrompt = `Insert a tiny, miniature ${originalAiPrompt
		.slice(0, originalAiPrompt.length - 2)
		.toLowerCase()}`;

	// Add positioning context
	insertPrompt += ` into the masked area of the background. The inserted element should blend naturally with the background as if it belongs there, maintaining the overall scene's aesthetic. Keep the inserted element small and proportional to fit within a 64x64 pixel area in the masked area`;

	// Add coordinates if provided
	if (pixelX !== undefined && pixelY !== undefined) {
		insertPrompt += ` Place it precisely at coordinates (${pixelX * 64}, ${
			pixelY * 64
		}).`;
	}

	return insertPrompt;
}
