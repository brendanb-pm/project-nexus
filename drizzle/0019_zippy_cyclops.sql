CREATE TABLE "reporting_exception_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporting_exception_id" uuid NOT NULL,
	"previous_state" text,
	"next_state" text NOT NULL,
	"reason" text NOT NULL,
	"assignee_user_id" uuid,
	"actor_user_id" uuid,
	"actor_kind" text DEFAULT 'SYSTEM' NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reporting_exception_events_actor_kind_check" CHECK ("reporting_exception_events"."actor_kind" in ('SYSTEM', 'USER'))
);
--> statement-breakpoint
CREATE TABLE "reporting_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"shift_assignment_id" uuid NOT NULL,
	"triggering_activity_entry_id" uuid,
	"obligation_key" text NOT NULL,
	"obligation_type" text NOT NULL,
	"classification" text NOT NULL,
	"state" text DEFAULT 'OPEN' NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"effective_shift_end_at" timestamp with time zone NOT NULL,
	"first_detected_at" timestamp with time zone NOT NULL,
	"corrected_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"assignee_user_id" uuid,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reporting_exceptions_obligation_type_check" CHECK ("reporting_exceptions"."obligation_type" in ('EOSR', 'ACTIVITY_ENTRY', 'INCIDENT_REPORT')),
	CONSTRAINT "reporting_exceptions_classification_check" CHECK ("reporting_exceptions"."classification" in ('LATE', 'MISSING')),
	CONSTRAINT "reporting_exceptions_state_check" CHECK ("reporting_exceptions"."state" in ('OPEN', 'ACKNOWLEDGED', 'CORRECTION_REQUESTED', 'CORRECTED_PENDING_REVIEW', 'RESOLVED', 'ESCALATED', 'WAIVED')),
	CONSTRAINT "reporting_exceptions_revision_check" CHECK ("reporting_exceptions"."revision" >= 0)
);
--> statement-breakpoint
ALTER TABLE "reporting_exception_events" ADD CONSTRAINT "reporting_exception_events_reporting_exception_id_reporting_exceptions_id_fk" FOREIGN KEY ("reporting_exception_id") REFERENCES "public"."reporting_exceptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reporting_exception_events" ADD CONSTRAINT "reporting_exception_events_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reporting_exception_events" ADD CONSTRAINT "reporting_exception_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reporting_exceptions" ADD CONSTRAINT "reporting_exceptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reporting_exceptions" ADD CONSTRAINT "reporting_exceptions_shift_assignment_id_shift_assignments_id_fk" FOREIGN KEY ("shift_assignment_id") REFERENCES "public"."shift_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reporting_exceptions" ADD CONSTRAINT "reporting_exceptions_triggering_activity_entry_id_activity_entries_id_fk" FOREIGN KEY ("triggering_activity_entry_id") REFERENCES "public"."activity_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reporting_exceptions" ADD CONSTRAINT "reporting_exceptions_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reporting_exception_events_exception_time_idx" ON "reporting_exception_events" USING btree ("reporting_exception_id","occurred_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "reporting_exceptions_obligation_key_uidx" ON "reporting_exceptions" USING btree ("obligation_key");--> statement-breakpoint
CREATE INDEX "reporting_exceptions_org_state_due_idx" ON "reporting_exceptions" USING btree ("organization_id","state","due_at","id");--> statement-breakpoint
CREATE INDEX "reporting_exceptions_assignment_idx" ON "reporting_exceptions" USING btree ("shift_assignment_id","id");