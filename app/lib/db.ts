import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.join(process.cwd(), "canvas.db"));

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS pixels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    owner TEXT,
    image TEXT,
    price REAL NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(x, y)
  );
`);

export default db;
