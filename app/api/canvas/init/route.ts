import { NextResponse } from "next/server";
import db from "../../../lib/db";

export async function POST(request: Request) {
  try {
    const { pixels } = await request.json();

    // Clear existing data
    db.prepare("DELETE FROM pixels").run();

    // Insert new pixels
    const insert = db.prepare(
      "INSERT INTO pixels (id, x, y, owner, image, price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    pixels.forEach((pixel: any) => {
      insert.run(
        pixel.id,
        pixel.x,
        pixel.y,
        pixel.owner,
        pixel.image,
        pixel.price,
        pixel.created_at
      );
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to initialize canvas" },
      { status: 500 }
    );
  }
}
