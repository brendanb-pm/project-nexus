CREATE TABLE "credential_definitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "key" text NOT NULL,
  "display_name" text NOT NULL,
  "category" text NOT NULL,
  "jurisdiction_kind" text NOT NULL,
  "jurisdiction_code" text,
  "jurisdiction_timezone" text,
  "issuing_guidance" text,
  "expiration_required" boolean DEFAULT false NOT NULL,
  "verification_required" boolean DEFAULT true NOT NULL,
  "warning_days" jsonb DEFAULT '[60,30,14,7]'::jsonb NOT NULL,
  "effective_start" date NOT NULL,
  "effective_end" date,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "credential_definitions_category_check" CHECK ("category" in ('credential', 'certification')),
  CONSTRAINT "credential_definitions_jurisdiction_check" CHECK ("jurisdiction_kind" in ('organization', 'national', 'state_province', 'local')),
  CONSTRAINT "credential_definitions_effective_dates_check" CHECK ("effective_end" is null or "effective_end" >= "effective_start")
);
CREATE UNIQUE INDEX "credential_definitions_org_key_uidx" ON "credential_definitions" ("organization_id", "key");
CREATE INDEX "credential_definitions_org_active_idx" ON "credential_definitions" ("organization_id", "active", "effective_start");

CREATE TABLE "employee_credentials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "employee_id" uuid NOT NULL REFERENCES "employees"("id"),
  "credential_definition_id" uuid NOT NULL REFERENCES "credential_definitions"("id"),
  "identifier" text,
  "issuer" text NOT NULL,
  "issued_on" date NOT NULL,
  "expires_on" date,
  "state" text NOT NULL,
  "evidence_reference" text,
  "predecessor_id" uuid,
  "superseded_by_id" uuid,
  "legacy_kind" text,
  "legacy_record_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "employee_credentials_state_check" CHECK ("state" in ('pending_verification', 'verified', 'expired', 'suspended', 'revoked', 'superseded')),
  CONSTRAINT "employee_credentials_date_order_check" CHECK ("expires_on" is null or "expires_on" >= "issued_on")
);
CREATE INDEX "employee_credentials_org_employee_definition_idx" ON "employee_credentials" ("organization_id", "employee_id", "credential_definition_id", "expires_on");
CREATE UNIQUE INDEX "employee_credentials_legacy_uidx" ON "employee_credentials" ("legacy_kind", "legacy_record_id");

CREATE TABLE "employee_credential_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_credential_id" uuid NOT NULL REFERENCES "employee_credentials"("id"),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "verifier_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "result" text NOT NULL,
  "method" text,
  "reason" text,
  "evidence_reference" text,
  "verified_at" timestamp with time zone NOT NULL
);
CREATE INDEX "employee_credential_verifications_credential_idx" ON "employee_credential_verifications" ("employee_credential_id", "verified_at");

CREATE TABLE "post_credential_requirements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "post_id" uuid NOT NULL REFERENCES "posts"("id"),
  "credential_definition_id" uuid NOT NULL REFERENCES "credential_definitions"("id"),
  "severity" text DEFAULT 'required' NOT NULL,
  "effective_start" date NOT NULL,
  "effective_end" date,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "post_credential_requirements_severity_check" CHECK ("severity" in ('required', 'informational')),
  CONSTRAINT "post_credential_requirements_effective_dates_check" CHECK ("effective_end" is null or "effective_end" >= "effective_start")
);
CREATE UNIQUE INDEX "post_credential_requirements_effective_uidx" ON "post_credential_requirements" ("post_id", "credential_definition_id", "effective_start");
CREATE INDEX "post_credential_requirements_post_effective_idx" ON "post_credential_requirements" ("post_id", "effective_start");

-- Deterministic one-time reconciliation.  Legacy rows are retained intact.
WITH legacy_types AS (
  SELECT e.organization_id, lower(trim(c.type)) AS key, min(c.type) AS display_name,
         'credential'::text AS category, min(c.issued_on) AS effective_start
  FROM credentials c JOIN employees e ON e.id = c.employee_id
  WHERE trim(c.type) <> '' GROUP BY e.organization_id, lower(trim(c.type))
  UNION ALL
  SELECT e.organization_id, lower(trim(c.type)), min(c.type), 'certification'::text, min(c.issued_on)
  FROM certifications c JOIN employees e ON e.id = c.employee_id
  WHERE trim(c.type) <> '' GROUP BY e.organization_id, lower(trim(c.type))
)
INSERT INTO credential_definitions (organization_id, key, display_name, category, jurisdiction_kind, effective_start)
SELECT organization_id, category || ':' || key, display_name, category, 'organization', effective_start
FROM legacy_types
ON CONFLICT (organization_id, key) DO NOTHING;

INSERT INTO employee_credentials (organization_id, employee_id, credential_definition_id, identifier, issuer, issued_on, expires_on, state, evidence_reference, legacy_kind, legacy_record_id, created_at, updated_at)
SELECT e.organization_id, c.employee_id, d.id, c.identifier, c.issuing_authority, c.issued_on, c.expires_on,
       CASE WHEN c.status = 'active' THEN 'verified' ELSE c.status END, c.document_reference, 'credential', c.id, c.created_at, c.updated_at
FROM credentials c JOIN employees e ON e.id = c.employee_id
JOIN credential_definitions d ON d.organization_id = e.organization_id AND d.key = 'credential:' || lower(trim(c.type))
ON CONFLICT (legacy_kind, legacy_record_id) DO NOTHING;

INSERT INTO employee_credentials (organization_id, employee_id, credential_definition_id, issuer, issued_on, expires_on, state, evidence_reference, legacy_kind, legacy_record_id, created_at, updated_at)
SELECT e.organization_id, c.employee_id, d.id, c.issuing_authority, c.issued_on, c.expires_on,
       CASE WHEN c.status = 'active' THEN 'verified' ELSE c.status END, c.document_reference, 'certification', c.id, c.created_at, c.updated_at
FROM certifications c JOIN employees e ON e.id = c.employee_id
JOIN credential_definitions d ON d.organization_id = e.organization_id AND d.key = 'certification:' || lower(trim(c.type))
ON CONFLICT (legacy_kind, legacy_record_id) DO NOTHING;

INSERT INTO employee_credential_verifications (employee_credential_id, organization_id, verifier_user_id, result, method, evidence_reference, verified_at)
SELECT ec.id, ec.organization_id, c.verified_by_user_id, 'verified', 'legacy-reconciliation', c.document_reference, c.verified_at
FROM employee_credentials ec JOIN credentials c ON ec.legacy_kind = 'credential' AND ec.legacy_record_id = c.id
WHERE c.verified_by_user_id IS NOT NULL AND c.verified_at IS NOT NULL;
INSERT INTO employee_credential_verifications (employee_credential_id, organization_id, verifier_user_id, result, method, evidence_reference, verified_at)
SELECT ec.id, ec.organization_id, c.verified_by_user_id, 'verified', 'legacy-reconciliation', c.document_reference, c.verified_at
FROM employee_credentials ec JOIN certifications c ON ec.legacy_kind = 'certification' AND ec.legacy_record_id = c.id
WHERE c.verified_by_user_id IS NOT NULL AND c.verified_at IS NOT NULL;
