CREATE TABLE "event_polling_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_name" text NOT NULL,
	"last_polled_block" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_polling_status_event_name_unique" UNIQUE("event_name")
);
--> statement-breakpoint
CREATE TABLE "pixels" (
	"id" serial PRIMARY KEY NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"is_taken" boolean DEFAULT false NOT NULL,
	"owner_id" text,
	"nft_id" text,
	"ipfs_image_cid" text,
	"image_media_type" text,
	"prompt" text,
	"style" text,
	"price" numeric(19, 4),
	"is_listed" boolean DEFAULT false NOT NULL,
	"listing_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pixels_nft_id_unique" UNIQUE("nft_id"),
	CONSTRAINT "pixels_listing_id_unique" UNIQUE("listing_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "unique_coordinates_idx" ON "pixels" USING btree ("x","y");