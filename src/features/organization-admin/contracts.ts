export const organizationStatuses = ["active", "inactive"] as const;
export type OrganizationStatus = (typeof organizationStatuses)[number];

export type OrganizationSummary = {
  name: string;
  status: OrganizationStatus;
  updatedAt: string;
};

export type BranchSummary = {
  id: string;
  name: string;
  timezone: string;
  status: OrganizationStatus;
  updatedAt: string;
};

export type BranchCursor = {
  name: string;
  id: string;
};

export type BranchPage = {
  items: readonly BranchSummary[];
  nextCursor?: BranchCursor;
};

export type UpdateOrganizationInput = {
  name: unknown;
  status: unknown;
  expectedUpdatedAt: unknown;
};

export type CreateBranchInput = {
  name: unknown;
  timezone: unknown;
  status: unknown;
};

export type UpdateBranchInput = CreateBranchInput & {
  branchId: unknown;
  expectedUpdatedAt: unknown;
};

export type OrganizationAdminPageState =
  | { kind: "loading" }
  | { kind: "permission-denied"; message: string }
  | { kind: "error"; message: string; retryable: boolean }
  | {
      kind: "ready";
      organization: OrganizationSummary;
      branches: BranchPage;
      notice?: {
        kind: "validation" | "success" | "error";
        message: string;
        fieldErrors?: Readonly<Record<string, readonly string[]>>;
      };
    };
