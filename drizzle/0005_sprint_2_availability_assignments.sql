ALTER TABLE "shift_assignments" ADD COLUMN "availability_status" text DEFAULT 'UNKNOWN' NOT NULL;--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD COLUMN "warnings" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "availability_employee_start_idx" ON "availability" USING btree ("employee_id","starts_at");--> statement-breakpoint
CREATE INDEX "shift_assignments_employee_idx" ON "shift_assignments" USING btree ("employee_id","status");--> statement-breakpoint
ALTER TABLE "availability" ADD CONSTRAINT "availability_time_order_check" CHECK ("availability"."ends_at" > "availability"."starts_at");--> statement-breakpoint
ALTER TABLE "availability" ADD CONSTRAINT "availability_status_check" CHECK ("availability"."status" in ('AVAILABLE', 'UNAVAILABLE'));--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_status_check" CHECK ("shift_assignments"."status" in ('assigned', 'confirmed', 'cancelled'));--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_availability_check" CHECK ("shift_assignments"."availability_status" in ('AVAILABLE', 'UNAVAILABLE', 'UNKNOWN'));