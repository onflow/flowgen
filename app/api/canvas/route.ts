import { NextResponse } from "next/server";
import { getPixels, purchasePixel } from "../../lib/canvas-db";

export async function GET() {
  try {
    const pixels = getPixels();
    return NextResponse.json(pixels);
  } catch (error) {
    console.error("GET Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pixels" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { x, y, owner, image, price } = await request.json();

    if (!x || !y || !owner || !image || !price) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const pixel = purchasePixel(x, y, owner, image, price);
    return NextResponse.json(pixel);
  } catch (error) {
    console.error("POST Error:", error);
    return NextResponse.json(
      { error: "Failed to purchase pixel" },
      { status: 500 }
    );
  }
}
