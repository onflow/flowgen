CREATE TABLE "flow_event_tracker" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"last_processed_block_height" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "flow_event_tracker_event_type_unique" UNIQUE("event_type")
);
