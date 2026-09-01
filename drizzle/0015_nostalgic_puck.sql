CREATE TABLE "end_of_shift_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_assignment_id" uuid NOT NULL,
	"submitted_by_user_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"unresolved_issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"equipment_access_status" text DEFAULT '' NOT NULL,
	"follow_up_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"unusual_conditions" text DEFAULT '' NOT NULL,
	"submission_key" text NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"acknowledged_by_user_id" uuid,
	"acknowledged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eosr_passdown_dismissals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"end_of_shift_report_id" uuid NOT NULL,
	"incoming_assignment_id" uuid NOT NULL,
	"dismissed_by_user_id" uuid NOT NULL,
	"dismissed_at" timestamp with time zone NOT NULL,
	"reopened_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "end_of_shift_reports" ADD CONSTRAINT "end_of_shift_reports_shift_assignment_id_shift_assignments_id_fk" FOREIGN KEY ("shift_assignment_id") REFERENCES "public"."shift_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "end_of_shift_reports" ADD CONSTRAINT "end_of_shift_reports_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "end_of_shift_reports" ADD CONSTRAINT "end_of_shift_reports_acknowledged_by_user_id_users_id_fk" FOREIGN KEY ("acknowledged_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eosr_passdown_dismissals" ADD CONSTRAINT "eosr_passdown_dismissals_end_of_shift_report_id_end_of_shift_reports_id_fk" FOREIGN KEY ("end_of_shift_report_id") REFERENCES "public"."end_of_shift_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eosr_passdown_dismissals" ADD CONSTRAINT "eosr_passdown_dismissals_incoming_assignment_id_shift_assignments_id_fk" FOREIGN KEY ("incoming_assignment_id") REFERENCES "public"."shift_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eosr_passdown_dismissals" ADD CONSTRAINT "eosr_passdown_dismissals_dismissed_by_user_id_users_id_fk" FOREIGN KEY ("dismissed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "eosr_assignment_submission_uidx" ON "end_of_shift_reports" USING btree ("shift_assignment_id","submission_key");--> statement-breakpoint
CREATE UNIQUE INDEX "eosr_assignment_uidx" ON "end_of_shift_reports" USING btree ("shift_assignment_id");--> statement-breakpoint
CREATE INDEX "eosr_submitted_at_idx" ON "end_of_shift_reports" USING btree ("submitted_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "eosr_passdown_dismissal_user_assignment_uidx" ON "eosr_passdown_dismissals" USING btree ("end_of_shift_report_id","incoming_assignment_id","dismissed_by_user_id");--> statement-breakpoint
CREATE INDEX "eosr_passdown_incoming_assignment_idx" ON "eosr_passdown_dismissals" USING btree ("incoming_assignment_id");