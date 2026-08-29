ALTER TABLE "clock_events" ADD COLUMN "effective_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "clock_events" ADD COLUMN "recorded_by_user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "clock_events" ADD COLUMN "exception_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "clock_events" ADD CONSTRAINT "clock_events_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clock_events_assignment_time_idx" ON "clock_events" USING btree ("shift_assignment_id","occurred_at");--> statement-breakpoint
ALTER TABLE "clock_events" ADD CONSTRAINT "clock_events_type_check" CHECK ("clock_events"."event_type" in ('CLOCK_IN', 'CLOCK_OUT'));--> statement-breakpoint
ALTER TABLE "clock_events" ADD CONSTRAINT "clock_events_verification_check" CHECK ("clock_events"."verification_status" in ('NORMAL', 'EXCEPTION_REQUIRED'));