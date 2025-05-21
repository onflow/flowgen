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
		ipfsImageCID: text("ipfs_image_cid"), // Stores the IPFS CID for the image
		imageMediaType: text("image_media_type"), // Stores the media type like 'image/png'
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

// If you plan to have other tables, you can define them here as well.
// For example:
// export const users = pgTable('users', { ... });

export const eventPollingStatus = pgTable("event_polling_status", {
	id: serial("id").primaryKey(),
	eventName: text("event_name").unique().notNull(),
	lastPolledBlock: integer("last_polled_block").notNull().default(0),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at")
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});
