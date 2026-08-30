ALTER TABLE "incident_reports" ADD COLUMN "reported_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "incident_reports" ADD COLUMN "submission_key" text;--> statement-breakpoint
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_reported_by_user_id_users_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "incident_reports_assignment_submission_key_uidx" ON "incident_reports" USING btree ("shift_assignment_id","submission_key");