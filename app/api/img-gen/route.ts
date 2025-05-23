import { generateStyledPrompt } from "@/lib/prompt-style";
import { NextResponse } from "next/server";
import OpenAI from "openai";

// Server-side API key fetch from env
const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
	try {
		const { prompt, style } = await request.json();

		// Customize prompt based on style
		let enhancedPrompt = generateStyledPrompt(style, prompt);

		const response = await openai.images.generate({
			model: "gpt-image-1",
			prompt: enhancedPrompt,
			n: 1,
			size: "1024x1024",
			quality: "high",
			moderation: "low",
			background: "opaque",
			output_format: "png",
		});

		console.log("response", response);

		if (response.data && response.data[0].url) {
			return NextResponse.json({ imageUrl: response.data[0].url });
		} else if (response.data && response.data[0].b64_json) {
			return NextResponse.json({
				imageUrl: `data:image/png;base64,${response.data[0].b64_json}`,
			});
		} else {
			return NextResponse.json(
				{ error: "No image URL returned" },
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error("Error generating image:", error);
		return NextResponse.json(
			{ error: "Failed to generate image" },
			{ status: 500 }
		);
	}
}
