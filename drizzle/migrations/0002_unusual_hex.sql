CREATE TABLE "event_polling_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_name" text NOT NULL,
	"last_polled_block" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_polling_status_event_name_unique" UNIQUE("event_name")
);
