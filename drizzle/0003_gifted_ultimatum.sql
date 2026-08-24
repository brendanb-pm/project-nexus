ALTER TABLE "certifications" ADD COLUMN "predecessor_id" uuid;--> statement-breakpoint
ALTER TABLE "certifications" ADD COLUMN "verified_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "certifications" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "credentials" ADD COLUMN "identifier" text;--> statement-breakpoint
ALTER TABLE "credentials" ADD COLUMN "predecessor_id" uuid;--> statement-breakpoint
ALTER TABLE "credentials" ADD COLUMN "verified_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "credentials" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "certifications_employee_type_idx" ON "certifications" USING btree ("employee_id","type","expires_on");--> statement-breakpoint
CREATE INDEX "credentials_employee_type_idx" ON "credentials" USING btree ("employee_id","type","expires_on");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_user_uidx" ON "employees" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_status_check" CHECK ("certifications"."status" in ('active', 'expired', 'suspended', 'revoked', 'pending_verification'));--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_date_order_check" CHECK ("certifications"."expires_on" is null or "certifications"."expires_on" >= "certifications"."issued_on");--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_status_check" CHECK ("credentials"."status" in ('active', 'expired', 'suspended', 'revoked', 'pending_verification'));--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_date_order_check" CHECK ("credentials"."expires_on" is null or "credentials"."expires_on" >= "credentials"."issued_on");