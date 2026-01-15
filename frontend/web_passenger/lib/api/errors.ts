export class ApiError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.details = details
  }
}

export class AuthRequiredError extends ApiError {
  constructor(details?: unknown) {
    super("Authentication required", 401, details)
    this.name = "AuthRequiredError"
  }
}

export class ForbiddenError extends ApiError {
  constructor(details?: unknown) {
    super("Forbidden", 403, details)
    this.name = "ForbiddenError"
  }
}

export class NetworkError extends ApiError {
  constructor() {
    super("Network error", 0)
    this.name = "NetworkError"
  }
}
