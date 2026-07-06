import { StatusCodes } from 'http-status-codes';

/**
 * Operational error with an HTTP status code. Thrown anywhere in the app and
 * translated into a consistent JSON response by the global error handler.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly errors?: Record<string, string[]>;
  public readonly isOperational = true;

  constructor(
    statusCode: number,
    message: string,
    options?: { code?: string; errors?: Record<string, string[]> },
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = options?.code;
    this.errors = options?.errors;
    Object.setPrototypeOf(this, ApiError.prototype);
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(msg = 'Bad request', errors?: Record<string, string[]>) {
    return new ApiError(StatusCodes.BAD_REQUEST, msg, { errors });
  }
  static unauthorized(msg = 'Unauthorized') {
    return new ApiError(StatusCodes.UNAUTHORIZED, msg);
  }
  static forbidden(msg = 'Forbidden') {
    return new ApiError(StatusCodes.FORBIDDEN, msg);
  }
  static notFound(msg = 'Not found') {
    return new ApiError(StatusCodes.NOT_FOUND, msg);
  }
  static conflict(msg = 'Conflict') {
    return new ApiError(StatusCodes.CONFLICT, msg);
  }
  static tooMany(msg = 'Too many requests') {
    return new ApiError(StatusCodes.TOO_MANY_REQUESTS, msg);
  }
  static internal(msg = 'Internal server error') {
    return new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, msg);
  }
}
