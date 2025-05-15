import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config({
	path: ".env.local", // Ensure drizzle-kit loads .env.local
});

export default {
	schema: "./db/schema.ts",
	out: "./drizzle/migrations", // Directory to store migration files
	dialect: "postgresql", // Specify PostgreSQL dialect
	dbCredentials: {
		url: process.env.DATABASE_URL!, // Use 'url' for the connection string
	},
	verbose: true,
	strict: true,
} satisfies Config;
