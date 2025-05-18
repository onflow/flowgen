import { NextResponse } from "next/server";
import OpenAI from "openai";
import sharp from "sharp"; // For image processing
import axios from "axios";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const {
      existingPixels,
      canvasWidth,
      canvasHeight,
      newPixel, // The new pixel being added
    } = await request.json();

    // 1. Generate a description of the current canvas state
    let canvasDescription = "A pixel art canvas containing:";

    // Group pixels by theme/area
    existingPixels.forEach(
      (pixel: { prompt?: string; x: number; y: number }) => {
        if (pixel.prompt) {
          canvasDescription += ` ${pixel.prompt} at position (${pixel.x},${pixel.y}),`;
        }
      }
    );

    // 2. Create a prompt that asks for a cohesive expansion
    const enhancedPrompt = `
      Create a complete cohesive pixel art image with dimensions ${canvasWidth}x${canvasHeight} pixels.

      The canvas currently contains: ${canvasDescription}

      A new element is being added: "${newPixel.prompt}" at position (${newPixel.x},${newPixel.y}).

      Generate a beautiful, cohesive pixel art scene that incorporates all these elements
      in their respective positions, but fills the entire canvas with a harmonious background
      and connects all elements together in an artistic way.

      The final image should look like a single, intentionally designed artwork where all
      elements belong together naturally.
    `;

    console.log("Generating cohesive canvas with prompt:", enhancedPrompt);

    // 3. Generate the cohesive image
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: enhancedPrompt,
      n: 1,
      size: "1024x1024",
    });

    if (!response.data || !response.data[0].url) {
      throw new Error("No image URL returned");
    }

    // Return the cohesive canvas image
    return NextResponse.json({
      imageUrl: response.data[0].url,
      prompt: enhancedPrompt, // Include prompt for debugging
    });
  } catch (error) {
    console.error("Error generating cohesive canvas:", error);
    return NextResponse.json(
      { error: "Failed to generate cohesive canvas" },
      { status: 500 }
    );
  }
}
