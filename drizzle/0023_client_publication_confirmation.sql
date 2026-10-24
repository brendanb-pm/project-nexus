ALTER TABLE "client_report_drafts" ADD COLUMN "reviewed_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "client_report_drafts" ADD COLUMN "source_fingerprint" text;--> statement-breakpoint
ALTER TABLE "client_report_publications" ADD COLUMN "confirmed_draft_revision" integer;--> statement-breakpoint
ALTER TABLE "client_report_publications" ADD COLUMN "source_fingerprint" text;--> statement-breakpoint
ALTER TABLE "client_report_publications" ADD COLUMN "snapshot_hash" text;