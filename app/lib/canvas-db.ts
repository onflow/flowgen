import db from "./db";

export type Pixel = {
  id: number;
  x: number;
  y: number;
  owner: string | null;
  image: string | null;
  price: number;
  created_at: Date;
};

export function getPixels() {
  return db.prepare("SELECT * FROM pixels").all() as Pixel[];
}

export function purchasePixel(
  x: number,
  y: number,
  owner: string,
  image: string,
  price: number
) {
  try {
    // Use UPSERT (INSERT OR REPLACE) syntax
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO pixels (x, y, owner, image, price, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      RETURNING *
    `);

    const result = stmt.get(x, y, owner, image, price) as Pixel;
    return result;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
}

export function getCurrentPrice() {
  const soldCount = db
    .prepare("SELECT COUNT(*) as count FROM pixels")
    .get().count;
  const basePrice = 10;
  return basePrice + soldCount * 0.1;
}

export function isPixelAvailable(x: number, y: number) {
  return !db.prepare("SELECT 1 FROM pixels WHERE x = ? AND y = ?").get(x, y);
}

export function getPixelsByOwner(owner: string) {
  return db
    .prepare("SELECT * FROM pixels WHERE owner = ?")
    .all(owner) as Pixel[];
}
