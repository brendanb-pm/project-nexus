CREATE TABLE "reporting_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"owner_employee_id" uuid NOT NULL,
	"shift_assignment_id" uuid NOT NULL,
	"family" text NOT NULL,
	"client_draft_key" text NOT NULL,
	"submission_key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"last_save_key" text NOT NULL,
	"disposition" text DEFAULT 'ACTIVE' NOT NULL,
	"canonical_record_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"disposed_at" timestamp with time zone,
	CONSTRAINT "reporting_drafts_family_check" CHECK ("reporting_drafts"."family" in ('SHIFT_ACTIVITY', 'SECURITY_INCIDENT', 'SHIFT_CLOSEOUT')),
	CONSTRAINT "reporting_drafts_disposition_check" CHECK ("reporting_drafts"."disposition" in ('ACTIVE', 'SUBMITTED', 'DISCARDED', 'EXPIRED')),
	CONSTRAINT "reporting_drafts_revision_check" CHECK ("reporting_drafts"."revision" >= 1),
	CONSTRAINT "reporting_drafts_payload_bound_check" CHECK (octet_length("reporting_drafts"."payload"::text) <= 65536)
);
--> statement-breakpoint
ALTER TABLE "reporting_drafts" ADD CONSTRAINT "reporting_drafts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reporting_drafts" ADD CONSTRAINT "reporting_drafts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reporting_drafts" ADD CONSTRAINT "reporting_drafts_owner_employee_id_employees_id_fk" FOREIGN KEY ("owner_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reporting_drafts" ADD CONSTRAINT "reporting_drafts_shift_assignment_id_shift_assignments_id_fk" FOREIGN KEY ("shift_assignment_id") REFERENCES "public"."shift_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reporting_drafts_active_owner_family_uidx" ON "reporting_drafts" USING btree ("organization_id","owner_user_id","shift_assignment_id","family") WHERE "reporting_drafts"."disposition" = 'ACTIVE';--> statement-breakpoint
CREATE UNIQUE INDEX "reporting_drafts_owner_client_key_uidx" ON "reporting_drafts" USING btree ("organization_id","owner_user_id","client_draft_key");--> statement-breakpoint
CREATE INDEX "reporting_drafts_owner_assignment_idx" ON "reporting_drafts" USING btree ("organization_id","owner_user_id","shift_assignment_id","disposition");--> statement-breakpoint
CREATE INDEX "reporting_drafts_expiry_idx" ON "reporting_drafts" USING btree ("expires_at","id");