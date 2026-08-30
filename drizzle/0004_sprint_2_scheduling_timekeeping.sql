ALTER TABLE "shifts" ADD COLUMN "timezone" text NOT NULL;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_time_order_check" CHECK ("shifts"."scheduled_end" > "shifts"."scheduled_start");--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_staffing_check" CHECK ("shifts"."staffing_requirement" between 1 and 100);--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_status_check" CHECK ("shifts"."status" in ('DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED'));