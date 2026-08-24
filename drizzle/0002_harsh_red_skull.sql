DROP INDEX "posts_site_idx";--> statement-breakpoint
DROP INDEX "sites_client_idx";--> statement-breakpoint
ALTER TABLE "client_contacts" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
CREATE INDEX "contracts_client_start_idx" ON "contracts" USING btree ("client_id","starts_on");--> statement-breakpoint
CREATE INDEX "posts_site_name_idx" ON "posts" USING btree ("site_id","name","id");--> statement-breakpoint
CREATE INDEX "sites_client_name_idx" ON "sites" USING btree ("client_id","name","id");--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_status_check" CHECK ("client_contacts"."status" in ('active', 'inactive'));--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_status_check" CHECK ("contracts"."status" in ('draft', 'active', 'expired', 'terminated'));--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_date_order_check" CHECK ("contracts"."ends_on" is null or "contracts"."ends_on" >= "contracts"."starts_on");