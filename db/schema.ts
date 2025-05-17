// This is where your Drizzle schema will be defined.
// We will define the 'pixels' table here in the next step.

import {
	pgTable,
	serial,
	integer,
	boolean,
	text,
	numeric,
	timestamp,
	uniqueIndex,
	jsonb,
} from "drizzle-orm/pg-core";

export const pixels = pgTable(
	"pixels",
	{
		id: serial("id").primaryKey(),
		x: integer("x").notNull(),
		y: integer("y").notNull(),
		isTaken: boolean("is_taken").notNull().default(false),
		ownerId: text("owner_id"), // User ID of the owner
		nftId: text("nft_id").unique(), // Would be the NFT ID on Flow / unique ID for the pixel in Web2
		imageURL: text("image_url"),
		prompt: text("prompt"),
		style: text("style"),
		// For marketplace features
		price: numeric("price", { precision: 19, scale: 4 }), // Example: Supports up to 19 digits, 4 after decimal
		isListed: boolean("is_listed").notNull().default(false),
		listingId: text("listing_id").unique(), // Unique if a pixel can only have one active listing

		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at")
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => {
		return [
			// Ensures that no two pixels can have the same x and y coordinates
			uniqueIndex("unique_coordinates_idx").on(table.x, table.y),
		];
	}
);

export const flowEventTracker = pgTable("flow_event_tracker", {
	id: serial("id").primaryKey(),
	eventType: text("event_type").notNull().unique(),
	lastProcessedBlockHeight: integer("last_processed_block_height").notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const flowEvents = pgTable(
	"flow_events",
	{
		id: serial("id").primaryKey(),
		eventType: text("event_type").notNull(),
		transactionId: text("transaction_id").notNull(),
		blockId: text("block_id").notNull(),
		blockHeight: integer("block_height").notNull(),
		blockTimestamp: timestamp("block_timestamp").notNull(),
		eventIndex: integer("event_index").notNull(),
		payload: jsonb("payload").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("unique_event_idx").on(table.transactionId, table.eventIndex),
	]
);

// If you plan to have other tables, you can define them here as well.
// For example:
// export const users = pgTable('users', { ... });
