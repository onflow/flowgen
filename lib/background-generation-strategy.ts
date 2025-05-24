// Background Generation Strategy for Flowgen
// Using cumulative prompt approach with modern image models

export interface PixelPurchase {
	x: number;
	y: number;
	prompt: string;
	style: string;
	timestamp: number;
}

export interface BackgroundGenerationStrategy {
	model: "flux" | "sd3" | "dalle3";
	maxTokens: number;
	promptStrategy: "full" | "smart" | "hierarchical";
}

// Token limits for different models
export const MODEL_LIMITS = {
	flux: {
		clipTokens: 77,
		t5Tokens: 512,
		effectiveTokens: 500, // Safe limit
	},
	sd3: {
		clipTokens: 77,
		t5Tokens: 512,
		effectiveTokens: 500,
	},
	dalle3: {
		// Estimated based on usage patterns
		effectiveTokens: 1000,
	},
};

/**
 * Smart Prompt Building Strategy
 * Instead of concatenating everything, we'll use a hierarchical approach
 */
export class SmartPromptBuilder {
	private purchases: PixelPurchase[] = [];
	private modelLimits: { effectiveTokens: number };

	constructor(model: keyof typeof MODEL_LIMITS = "flux") {
		this.modelLimits = MODEL_LIMITS[model];
	}

	/**
	 * Add a new pixel purchase to the scene
	 */
	addPurchase(purchase: PixelPurchase) {
		this.purchases.push(purchase);
	}

	/**
	 * Build an optimized prompt that fits within token limits
	 */
	buildPrompt(): string {
		// Sort purchases by proximity to create regional descriptions
		const regions = this.groupPurchasesByRegion();

		// Build base scene description
		let basePrompt = this.buildBaseSceneDescription();

		// Add regional descriptions with smart summarization
		let regionalPrompts = this.buildRegionalDescriptions(regions);

		// Combine with token awareness
		return this.combineWithTokenLimit(basePrompt, regionalPrompts);
	}

	/**
	 * Group purchases into 3x3 regions for better organization
	 */
	private groupPurchasesByRegion(): Map<string, PixelPurchase[]> {
		const regions = new Map<string, PixelPurchase[]>();

		this.purchases.forEach((purchase) => {
			// Divide 30x30 grid into 3x3 regions (10x10 each)
			const regionX = Math.floor(purchase.x / 10);
			const regionY = Math.floor(purchase.y / 10);
			const regionKey = `${regionX},${regionY}`;

			if (!regions.has(regionKey)) {
				regions.set(regionKey, []);
			}
			regions.get(regionKey)!.push(purchase);
		});

		return regions;
	}

	/**
	 * Create a base scene description
	 */
	private buildBaseSceneDescription(): string {
		// Analyze all purchases to determine dominant style and theme
		const styles = this.purchases.map((p) => p.style);
		const dominantStyle = this.getMostCommon(styles);

		return `A cohesive ${dominantStyle} style scene with multiple elements arranged in a grid pattern. `;
	}

	/**
	 * Build smart regional descriptions that summarize similar items
	 */
	private buildRegionalDescriptions(
		regions: Map<string, PixelPurchase[]>
	): string[] {
		const descriptions: string[] = [];

		regions.forEach((purchases, regionKey) => {
			const [rx, ry] = regionKey.split(",").map(Number);
			const position = this.getPositionDescription(rx, ry);

			// Group similar prompts in the region
			const groupedPrompts = this.groupSimilarPrompts(purchases);

			// Create a concise description for this region
			const regionDesc = `In the ${position}: ${this.summarizePrompts(
				groupedPrompts
			)}`;
			descriptions.push(regionDesc);
		});

		return descriptions;
	}

	/**
	 * Combine prompts while respecting token limits
	 */
	private combineWithTokenLimit(base: string, regional: string[]): string {
		let combined = base;
		let tokenCount = this.estimateTokens(base);

		// Add regional descriptions in order of importance
		// Prioritize regions with more purchases
		const sortedRegional = regional.sort((a, b) => b.length - a.length);

		for (const desc of sortedRegional) {
			const descTokens = this.estimateTokens(desc);
			if (tokenCount + descTokens < this.modelLimits.effectiveTokens - 50) {
				// Leave buffer
				combined += desc + " ";
				tokenCount += descTokens;
			} else {
				// We've hit the limit, add a summary
				combined += "Additional elements throughout the scene. ";
				break;
			}
		}

		return combined.trim();
	}

	/**
	 * Estimate token count (rough approximation)
	 * Real implementation would use actual tokenizer
	 */
	private estimateTokens(text: string): number {
		// Rough estimate: 1 token ≈ 4 characters
		return Math.ceil(text.length / 4);
	}

	private getMostCommon<T>(arr: T[]): T {
		const counts = new Map<T, number>();
		arr.forEach((item) => {
			counts.set(item, (counts.get(item) || 0) + 1);
		});

		let maxCount = 0;
		let mostCommon = arr[0];
		counts.forEach((count, item) => {
			if (count > maxCount) {
				maxCount = count;
				mostCommon = item;
			}
		});

		return mostCommon;
	}

	private getPositionDescription(rx: number, ry: number): string {
		const positions = [
			["top-left", "top-center", "top-right"],
			["middle-left", "center", "middle-right"],
			["bottom-left", "bottom-center", "bottom-right"],
		];
		return positions[ry]?.[rx] || "center";
	}

	private groupSimilarPrompts(purchases: PixelPurchase[]): Map<string, number> {
		const groups = new Map<string, number>();

		purchases.forEach((p) => {
			// Extract main subject from prompt (simplified)
			const subject = p.prompt.toLowerCase().split(" ").slice(0, 3).join(" ");
			groups.set(subject, (groups.get(subject) || 0) + 1);
		});

		return groups;
	}

	private summarizePrompts(grouped: Map<string, number>): string {
		const parts: string[] = [];

		grouped.forEach((count, subject) => {
			if (count > 1) {
				parts.push(`${count} ${subject}s`);
			} else {
				parts.push(subject);
			}
		});

		return parts.join(", ");
	}
}

/**
 * Alternative: Hierarchical Prompt Strategy
 * Uses a main prompt + style modifiers
 */
export class HierarchicalPromptBuilder {
	private sceneElements: string[] = [];
	private styleModifiers: string[] = [];
	private spatialMap: Map<string, string[]> = new Map();

	buildPrompt(): string {
		// Main scene description (short)
		const mainScene =
			"A vibrant digital artwork composed of many small elements. ";

		// Style consistency
		const style = `Consistent ${this.getUnifiedStyle()} style throughout. `;

		// Spatial organization (compressed)
		const spatial = this.buildCompressedSpatialDescription();

		// Quality modifiers
		const quality = "High detail, cohesive composition, professional quality.";

		return mainScene + style + spatial + quality;
	}

	private getUnifiedStyle(): string {
		// Analyze and return dominant style
		return "pixel art"; // Simplified
	}

	private buildCompressedSpatialDescription(): string {
		// Build a very compressed spatial description
		return "Elements distributed across the canvas in a grid pattern. ";
	}
}

/**
 * Recommended approach for Flowgen
 */
export function createBackgroundGenerationStrategy(): BackgroundGenerationStrategy {
	return {
		model: "flux", // Best balance of quality and capability
		maxTokens: 500,
		promptStrategy: "smart", // Use the SmartPromptBuilder
	};
}

// Example usage
export function generateBackgroundPrompt(purchases: PixelPurchase[]): string {
	const builder = new SmartPromptBuilder("flux");

	purchases.forEach((purchase) => {
		builder.addPurchase(purchase);
	});

	return builder.buildPrompt();
}
