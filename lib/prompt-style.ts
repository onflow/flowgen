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

/**
 * Generate a background prompt for stitching approach
 * This version focuses on seamless integration rather than specific coordinates
 */
export function generateBackgroundPrompt(
	userPrompt: string,
	pixelX: number,
	pixelY: number
): string {
	return `Seamlessly integrate the second image into the center of the first image, using the mask provided as the third image. The integration should:

1. Place the new element naturally into the center area (marked by the mask)
2. Blend the edges smoothly with the surrounding environment 
3. Match the lighting, color palette, and artistic style of the existing background
4. Maintain visual continuity - the result should look like the new element was always part of the scene
5. Preserve the overall composition and atmosphere of the background

The new element should appear as if it naturally belongs in this environment, with no visible seams or artificial boundaries. Focus on creating a harmonious composition where the new addition enhances rather than disrupts the existing scene.`;
}

/**
 * Generate a stitching-specific prompt for better seamless integration
 */
export function generateStitchingPrompt(basePrompt: string): string {
	return `${basePrompt}

CRITICAL REQUIREMENTS:
- The new element must blend seamlessly with the surrounding environment
- Match the exact lighting conditions, shadows, and highlights of the background  
- Use the same color temperature and saturation as the existing scene
- Ensure the artistic style remains consistent throughout
- Create natural transitions at all edges - no hard boundaries or visible seams
- The result should appear as a single, cohesive image

Pay special attention to how light falls on the new element and how it casts shadows. The integration should be so seamless that it's impossible to tell where the original background ends and the new element begins.`;
}
