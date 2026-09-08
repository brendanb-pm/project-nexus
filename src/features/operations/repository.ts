import type {
  OperationalScorecards,
  OperationsExceptionPage,
} from "./contracts";

export type OperationsScope = {
  organizationId: string;
  organizationWide: boolean;
  branchIds: readonly string[];
  clientIds: readonly string[];
  siteIds: readonly string[];
};

export interface OperationsRepository {
  listExceptions(
    scope: OperationsScope,
    now: string,
    limit: number,
  ): Promise<OperationsExceptionPage>;
  listScorecards(
    scope: OperationsScope,
    window: OperationalScorecards["window"],
  ): Promise<OperationalScorecards>;
}
