export class AuthenticationRequiredError extends Error {
  readonly code = "AUTHENTICATION_REQUIRED";

  constructor() {
    super("Authentication is required.");
  }
}

export class PermissionDeniedError extends Error {
  readonly code = "PERMISSION_DENIED";

  constructor() {
    super("You do not have permission to perform this action.");
  }
}

export class ResourceNotFoundError extends Error {
  readonly code = "NOT_FOUND";

  constructor(resource: string) {
    super(`${resource} was not found.`);
  }
}

export class ValidationError extends Error {
  readonly code = "VALIDATION_ERROR";

  constructor(
    readonly fieldErrors: Readonly<Record<string, readonly string[]>>,
  ) {
    super("Check the highlighted fields and try again.");
  }
}

export class StaleUpdateError extends Error {
  readonly code = "STALE_UPDATE";

  constructor() {
    super("This record changed after it was loaded. Refresh and try again.");
  }
}

export class DuplicateResourceError extends Error {
  readonly code = "DUPLICATE_RESOURCE";

  constructor(message: string) {
    super(message);
  }
}

export class InvariantViolationError extends Error {
  readonly code = "INVARIANT_VIOLATION";

  constructor(message: string) {
    super(message);
  }
}
