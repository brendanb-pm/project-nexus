ALTER TABLE "activity_entries" ADD COLUMN "submission_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_entries_assignment_submission_uidx" ON "activity_entries" USING btree ("shift_assignment_id","submission_key");--> statement-breakpoint
CREATE INDEX "activity_entries_assignment_occurred_idx" ON "activity_entries" USING btree ("shift_assignment_id","occurred_at");