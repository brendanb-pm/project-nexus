CREATE TABLE "client_report_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"scope_key" text NOT NULL,
	"site_ids" jsonb NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"executive_summary" text DEFAULT '' NOT NULL,
	"completion_summary" text DEFAULT '' NOT NULL,
	"follow_ups" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"selected_sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_report_drafts_period_check" CHECK ("client_report_drafts"."period_end" > "client_report_drafts"."period_start"),
	CONSTRAINT "client_report_drafts_revision_check" CHECK ("client_report_drafts"."revision" >= 0),
	CONSTRAINT "client_report_drafts_sites_check" CHECK (case when jsonb_typeof("client_report_drafts"."site_ids") = 'array' then jsonb_array_length("client_report_drafts"."site_ids") > 0 else false end),
	CONSTRAINT "client_report_drafts_sources_check" CHECK (jsonb_typeof("client_report_drafts"."selected_sources") = 'array'),
	CONSTRAINT "client_report_drafts_followups_check" CHECK (jsonb_typeof("client_report_drafts"."follow_ups") = 'array')
);
--> statement-breakpoint
CREATE TABLE "client_report_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"site_ids" jsonb NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"version" integer NOT NULL,
	"supersedes_id" uuid,
	"confirmation_key" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"published_by_user_id" uuid NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_report_publications_version_check" CHECK ("client_report_publications"."version" > 0),
	CONSTRAINT "client_report_publications_period_check" CHECK ("client_report_publications"."period_end" > "client_report_publications"."period_start"),
	CONSTRAINT "client_report_publications_sites_check" CHECK (case when jsonb_typeof("client_report_publications"."site_ids") = 'array' then jsonb_array_length("client_report_publications"."site_ids") > 0 else false end),
	CONSTRAINT "client_report_publications_snapshot_check" CHECK (jsonb_typeof("client_report_publications"."snapshot") = 'object')
);
--> statement-breakpoint
ALTER TABLE "client_report_drafts" ADD CONSTRAINT "client_report_drafts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_report_drafts" ADD CONSTRAINT "client_report_drafts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_report_drafts" ADD CONSTRAINT "client_report_drafts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_report_drafts" ADD CONSTRAINT "client_report_drafts_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_report_publications" ADD CONSTRAINT "client_report_publications_draft_id_client_report_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."client_report_drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_report_publications" ADD CONSTRAINT "client_report_publications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_report_publications" ADD CONSTRAINT "client_report_publications_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_report_publications" ADD CONSTRAINT "client_report_publications_supersedes_id_client_report_publications_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."client_report_publications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_report_publications" ADD CONSTRAINT "client_report_publications_published_by_user_id_users_id_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_report_drafts_scope_uidx" ON "client_report_drafts" USING btree ("organization_id","client_id","scope_key","period_start","period_end");--> statement-breakpoint
CREATE INDEX "client_report_drafts_org_client_idx" ON "client_report_drafts" USING btree ("organization_id","client_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "client_report_publications_draft_version_uidx" ON "client_report_publications" USING btree ("draft_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "client_report_publications_draft_key_uidx" ON "client_report_publications" USING btree ("draft_id","confirmation_key");--> statement-breakpoint
CREATE UNIQUE INDEX "client_report_publications_supersedes_uidx" ON "client_report_publications" USING btree ("supersedes_id");--> statement-breakpoint
CREATE INDEX "client_report_publications_org_client_idx" ON "client_report_publications" USING btree ("organization_id","client_id","published_at","id");
--> statement-breakpoint
-- Published client snapshots are immutable. Corrections insert a new version.
CREATE FUNCTION reject_client_report_publication_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'published client reports are immutable';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER client_report_publications_immutable
BEFORE UPDATE OR DELETE ON client_report_publications
FOR EACH ROW EXECUTE FUNCTION reject_client_report_publication_mutation();
