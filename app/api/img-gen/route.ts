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
    let enhancedPrompt = prompt;
    if (style === "Pixel Art") {
      enhancedPrompt = `A pixel art style image of: ${prompt}. 64x64 pixels, vibrant colors.`;
    } else if (style === "Abstract") {
      enhancedPrompt = `An abstract art representation of: ${prompt}. Bold colors and shapes.`;
    } else if (style === "Cyberpunk") {
      enhancedPrompt = `A cyberpunk style image of: ${prompt}. Neon colors, futuristic, digital.`;
    } else if (style === "Minimalist") {
      enhancedPrompt = `A minimalist style image of: ${prompt}. Clean lines, minimal details, elegant.`;
    } else {
      enhancedPrompt = `A photorealistic image of: ${prompt}. Detailed and lifelike.`;
    }

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: enhancedPrompt,
      n: 1,
      size: "1024x1024",
    });

    if (response.data && response.data[0].url) {
      return NextResponse.json({ imageUrl: response.data[0].url });
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
