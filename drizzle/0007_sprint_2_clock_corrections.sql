CREATE TABLE "clock_event_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clock_event_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"original_effective_at" timestamp with time zone NOT NULL,
	"corrected_effective_at" timestamp with time zone NOT NULL,
	"corrected_by_user_id" uuid NOT NULL,
	"corrected_at" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	CONSTRAINT "clock_event_corrections_revision_check" CHECK ("clock_event_corrections"."revision" > 0),
	CONSTRAINT "clock_event_corrections_reason_check" CHECK (length(trim("clock_event_corrections"."reason")) > 0)
);
--> statement-breakpoint
ALTER TABLE "clock_event_corrections" ADD CONSTRAINT "clock_event_corrections_clock_event_id_clock_events_id_fk" FOREIGN KEY ("clock_event_id") REFERENCES "public"."clock_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clock_event_corrections" ADD CONSTRAINT "clock_event_corrections_corrected_by_user_id_users_id_fk" FOREIGN KEY ("corrected_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clock_event_corrections_revision_uidx" ON "clock_event_corrections" USING btree ("clock_event_id","revision");