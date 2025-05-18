import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";
import * as dotenv from "dotenv";

dotenv.config({
	path: [".env.development.local", ".env.local", ".env"],
});

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL environment variable is not set");
}
const sql = neon(process.env.DATABASE_URL!);

// The 'schema' object can be passed to drizzle if you have multiple schema files
// or want to keep it explicit. For a single schema.ts, it's often optional
// but good practice for clarity and future expansion.
export const db = drizzle(sql, { schema });
