CREATE TABLE "coverage_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"required_count" integer NOT NULL,
	"weekdays" jsonb NOT NULL,
	"local_start_time" text NOT NULL,
	"local_end_time" text NOT NULL,
	"effective_start" date NOT NULL,
	"effective_end" date,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coverage_requirements_count_check" CHECK ("coverage_requirements"."required_count" between 1 and 100),
	CONSTRAINT "coverage_requirements_effective_order_check" CHECK ("coverage_requirements"."effective_end" is null or "coverage_requirements"."effective_end" >= "coverage_requirements"."effective_start")
);
--> statement-breakpoint
ALTER TABLE "coverage_requirements" ADD CONSTRAINT "coverage_requirements_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coverage_requirements_post_effective_idx" ON "coverage_requirements" USING btree ("post_id","effective_start","effective_end");