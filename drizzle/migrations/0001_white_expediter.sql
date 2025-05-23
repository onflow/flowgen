CREATE TABLE "background_update_locks" (
	"lock_key" text PRIMARY KEY NOT NULL,
	"acquired_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"holder_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL,
	"event_type" text NOT NULL,
	"pixel_id" integer NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	"error_message" text,
	"metadata" text,
	CONSTRAINT "processed_events_transaction_id_unique" UNIQUE("transaction_id")
);
