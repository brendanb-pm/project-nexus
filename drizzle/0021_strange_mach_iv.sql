ALTER TABLE "reporting_drafts" ALTER COLUMN "client_draft_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reporting_drafts" ALTER COLUMN "submission_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reporting_drafts" ALTER COLUMN "last_save_key" DROP NOT NULL;--> statement-breakpoint
UPDATE "reporting_drafts"
SET "client_draft_key" = NULL, "submission_key" = NULL, "last_save_key" = NULL
WHERE "disposition" <> 'ACTIVE';--> statement-breakpoint
ALTER TABLE "reporting_drafts" ADD CONSTRAINT "reporting_drafts_active_keys_check" CHECK ("reporting_drafts"."disposition" <> 'ACTIVE' or ("reporting_drafts"."client_draft_key" is not null and "reporting_drafts"."submission_key" is not null and "reporting_drafts"."last_save_key" is not null));
