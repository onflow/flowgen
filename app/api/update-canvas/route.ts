import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import OpenAI from "openai";
import axios from "axios";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface PixelData {
  prompt: string;
  timestamp: number;
  position: { x: number; y: number };
  pixelUrl?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, style, x, y } = await req.json();

    if (!prompt || x === undefined || y === undefined) {
      return NextResponse.json(
        { success: false, error: "Prompt, x, and y coordinates are required" },
        { status: 400 }
      );
    }

    console.log("Processing placement request:", { prompt, style, x, y });

    const timestamp = Date.now();
    const publicCanvasPath = path.join(process.cwd(), "public", "canvas");
    const pixelsMetadataPath = path.join(
      process.cwd(),
      "public",
      "pixels-metadata.json"
    );

    // Ensure directories exist
    if (!fs.existsSync(publicCanvasPath)) {
      fs.mkdirSync(publicCanvasPath, { recursive: true });
    }

    // Canvas dimensions and cell calculation
    const cellSize = 64;
    const gridSize = 16;
    const canvasWidth = gridSize * cellSize;
    const canvasHeight = gridSize * cellSize;

    // Calculate cell position
    const cellX = x * cellSize;
    const cellY = y * cellSize;

    // File paths
    const canvasFilePath = path.join(
      publicCanvasPath,
      `canvas-${timestamp}.png`
    );
    const currentCanvasPath = path.join(publicCanvasPath, "current-canvas.png");
    const pixelFilePath = path.join(
      publicCanvasPath,
      `pixel-${x}-${y}-${timestamp}.png`
    );

    // Initialize metadata
    let pixelsData: Record<string, PixelData> = {};
    if (fs.existsSync(pixelsMetadataPath)) {
      const metadataContent = await fs.promises.readFile(
        pixelsMetadataPath,
        "utf8"
      );
      pixelsData = JSON.parse(metadataContent);
    }

    // Create initial canvas if it doesn't exist
    if (
      !fs.existsSync(currentCanvasPath) ||
      req.nextUrl.searchParams.get("reset") === "true"
    ) {
      console.log("Creating initial canvas...");

      try {
        // Start with a simpler, less detailed landscape background
        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt: `Create a highly detailed realistic landscape ${style} art style image of a plain with few trees and no other objects. Use a rich color palette with good definition. The image should be beautiful and immersive with clear details, but still function well as a background for other elements. Ensure the landscape has excellent definition while maintaining the distinct pixel art aesthetic.`,
          n: 1,
          size: "1024x1024",
        });

        if (response?.data?.[0]?.url) {
          // Download the landscape
          const imageResponse = await axios.get(response.data[0].url, {
            responseType: "arraybuffer",
          });

          // Save the raw landscape
          await fs.promises.writeFile(
            currentCanvasPath,
            Buffer.from(imageResponse.data)
          );

          // Add grid overlay
          await sharp(currentCanvasPath)
            .composite([
              {
                input: Buffer.from(`
                <svg width="${canvasWidth}" height="${canvasHeight}">
                  <defs>
                    <pattern id="grid" width="${cellSize}" height="${cellSize}" patternUnits="userSpaceOnUse">
                      <rect width="${cellSize}" height="${cellSize}" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1"/>
                    </pattern>
                  </defs>
                  <rect width="${canvasWidth}" height="${canvasHeight}" fill="url(#grid)" fill-opacity="0.8"/>
                </svg>
              `),
                blend: "over",
              },
            ])
            .toFile(currentCanvasPath + ".tmp");

          fs.renameSync(currentCanvasPath + ".tmp", currentCanvasPath);
          console.log("Created initial canvas with DALL-E");

          // Clear metadata if resetting
          if (req.nextUrl.searchParams.get("reset") === "true") {
            pixelsData = {};
            await fs.promises.writeFile(
              pixelsMetadataPath,
              JSON.stringify(pixelsData, null, 2)
            );
          }
        }
      } catch (error) {
        console.error("Failed to create initial canvas:", error);
        // Fallback to a simple grid
        await createGridCanvas(
          canvasWidth,
          canvasHeight,
          gridSize,
          cellSize
        ).toFile(currentCanvasPath);
      }
    }

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: `Create a ${style} art style ${prompt} with transparent background. ONLY the ${prompt} itself should be visible - no UI elements, no color palettes, no thumbnails, no multiple versions. Just a single isolated ${prompt} centered in the image.`,
      n: 1,
      size: "1024x1024",
    });

    if (!response?.data?.[0]?.url) {
      throw new Error("Failed to generate image");
    }

    console.log("Downloading generated image...");
    const imageResponse = await axios.get(response.data[0].url, {
      responseType: "arraybuffer",
    });

    // Save the raw pixel image
    const rawPixelPath = path.join(publicCanvasPath, `raw-${timestamp}.png`);
    await fs.promises.writeFile(rawPixelPath, Buffer.from(imageResponse.data));

    console.log("Extracting main object from image...");
    await sharp(rawPixelPath)
      .extract({
        left: Math.floor(1024 * 0.25),
        top: Math.floor(1024 * 0.25),
        width: Math.floor(1024 * 0.5),
        height: Math.floor(1024 * 0.5),
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
      .then(({ data, info }) => {
        const { width, height, channels } = info;

        const cornerSamples = [
          // Top-left
          { r: data[0], g: data[1], b: data[2] },
          // Top-right
          {
            r: data[(width - 1) * channels],
            g: data[(width - 1) * channels + 1],
            b: data[(width - 1) * channels + 2],
          },
          // Bottom-left
          {
            r: data[(height - 1) * width * channels],
            g: data[(height - 1) * width * channels + 1],
            b: data[(height - 1) * width * channels + 2],
          },
          // Bottom-right
          {
            r: data[(height - 1) * width * channels + (width - 1) * channels],
            g: data[
              (height - 1) * width * channels + (width - 1) * channels + 1
            ],
            b: data[
              (height - 1) * width * channels + (width - 1) * channels + 2
            ],
          },
        ];

        // Find the most common corner color (simplified approach)
        const bgColor = cornerSamples[0]; // Use first corner as reference

        for (let i = 0; i < width * height; i++) {
          const r = data[i * channels];
          const g = data[i * channels + 1];
          const b = data[i * channels + 2];

          // Very aggressive background detection - remove ALL light colors, grids, and patterns
          const isBackground =
            // Color is close to the sampled background color
            (Math.abs(r - bgColor.r) < 30 &&
              Math.abs(g - bgColor.g) < 30 &&
              Math.abs(b - bgColor.b) < 30) ||
            // Very light colors (definitely background)
            (r > 240 && g > 240 && b > 240);

          if (isBackground) {
            // Make pixel transparent
            data[i * channels + 3] = 0;
          } else {
            // Ensure object pixels are fully opaque
            data[i * channels + 3] = 255;
          }
        }

        return sharp(data, {
          raw: { width, height, channels },
        })
          .resize(cellSize - 10, cellSize - 10, {
            fit: "inside",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toFile(pixelFilePath);
      });

    // Place it on the canvas
    console.log("Placing image on canvas...");
    await sharp(currentCanvasPath)
      .composite([
        {
          input: pixelFilePath,
          top: cellY,
          left: cellX,
        },
      ])
      .toFile(canvasFilePath);

    // Update current canvas
    fs.copyFileSync(canvasFilePath, currentCanvasPath);

    // Update metadata
    pixelsData[`${x}-${y}`] = {
      prompt,
      timestamp,
      position: { x, y },
      pixelUrl: `/canvas/pixel-${x}-${y}-${timestamp}.png`,
    };

    await fs.promises.writeFile(
      pixelsMetadataPath,
      JSON.stringify(pixelsData, null, 2)
    );

    console.log("Pixel successfully placed");
    return NextResponse.json({
      success: true,
      canvasUrl: `/canvas/canvas-${timestamp}.png`,
      pixelUrl: `/canvas/pixel-${x}-${y}-${timestamp}.png`,
      coordinates: { x, y },
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

// Helper function to create a grid canvas
function createGridCanvas(
  width: number,
  height: number,
  gridSize: number,
  cellSize: number
): sharp.Sharp {
  // Create a visible grid background
  return sharp({
    create: {
      width: width,
      height: height,
      channels: 4,
      background: { r: 240, g: 240, b: 245, alpha: 1 },
    },
  }).composite([
    {
      input: Buffer.from(`
      <svg width="${width}" height="${height}">
        <defs>
          <pattern id="grid" width="${cellSize}" height="${cellSize}" patternUnits="userSpaceOnUse">
            <rect width="${cellSize}" height="${cellSize}" fill="none" stroke="#c0c0d0" stroke-width="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)"/>
      </svg>
    `),
      top: 0,
      left: 0,
    },
  ]);
}
