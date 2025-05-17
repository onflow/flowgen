CREATE TABLE "flow_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"transaction_id" text NOT NULL,
	"block_id" text NOT NULL,
	"block_height" integer NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"event_index" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "unique_event_idx" ON "flow_events" USING btree ("transaction_id","event_index");