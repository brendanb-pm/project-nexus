import { sql, type SQLWrapper } from "drizzle-orm";

// JavaScript Date/ISO transport values have millisecond precision, while
// PostgreSQL's now() default can retain microseconds. Normalize only the
// optimistic version comparison; the persisted timestamp remains unchanged.
export function matchesUpdatedAt(
  column: SQLWrapper,
  expectedUpdatedAt: string,
) {
  return sql`date_trunc('milliseconds', ${column}) = ${new Date(expectedUpdatedAt)}`;
}
