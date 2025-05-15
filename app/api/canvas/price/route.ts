import { NextResponse } from "next/server";
import { getCurrentPrice } from "../../../lib/canvas-db";

export async function GET() {
  try {
    const price = getCurrentPrice();
    return NextResponse.json(price);
  } catch (error) {
    return NextResponse.json({ error: "Failed to get price" }, { status: 500 });
  }
}
