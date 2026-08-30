CREATE TABLE "time_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"time_record_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"approved_by_user_id" uuid NOT NULL,
	"approved_at" timestamp with time zone NOT NULL,
	"audit_event_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "time_records" ADD COLUMN "seconds_worked" integer;--> statement-breakpoint
ALTER TABLE "time_records" ADD COLUMN "pairs" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "time_records" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "time_records" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "time_approvals" ADD CONSTRAINT "time_approvals_time_record_id_time_records_id_fk" FOREIGN KEY ("time_record_id") REFERENCES "public"."time_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_approvals" ADD CONSTRAINT "time_approvals_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_approvals" ADD CONSTRAINT "time_approvals_audit_event_id_audit_events_id_fk" FOREIGN KEY ("audit_event_id") REFERENCES "public"."audit_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "time_approvals_record_revision_uidx" ON "time_approvals" USING btree ("time_record_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "time_records_assignment_uidx" ON "time_records" USING btree ("shift_assignment_id");--> statement-breakpoint
ALTER TABLE "time_records" ADD CONSTRAINT "time_records_seconds_check" CHECK ("time_records"."seconds_worked" is null or "time_records"."seconds_worked" >= 0);--> statement-breakpoint
ALTER TABLE "time_records" ADD CONSTRAINT "time_records_revision_check" CHECK ("time_records"."revision" >= 0);