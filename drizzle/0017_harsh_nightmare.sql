ALTER TABLE "asset_checkout_events" ADD COLUMN "previous_employee_id" uuid;--> statement-breakpoint
ALTER TABLE "asset_checkout_events" ADD COLUMN "previous_site_id" uuid;--> statement-breakpoint
ALTER TABLE "asset_checkout_events" ADD COLUMN "reason" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_checkout_events" ADD CONSTRAINT "asset_checkout_events_previous_employee_id_employees_id_fk" FOREIGN KEY ("previous_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_checkout_events" ADD CONSTRAINT "asset_checkout_events_previous_site_id_sites_id_fk" FOREIGN KEY ("previous_site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;