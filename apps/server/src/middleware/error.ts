import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Error as MongooseError } from 'mongoose';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';
import { logger } from '../config/logger';
import { isProd } from '../config/env';

/** 404 handler for unmatched routes. */
export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/** Global error handler — converts any thrown error into a consistent JSON body. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  let statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
  let message = 'Internal server error';
  let code: string | undefined;
  let errors: Record<string, string[]> | undefined;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
    errors = err.errors;
  } else if (err instanceof ZodError) {
    statusCode = StatusCodes.BAD_REQUEST;
    message = 'Validation failed';
    errors = err.flatten().fieldErrors as Record<string, string[]>;
  } else if (err instanceof MongooseError.ValidationError) {
    statusCode = StatusCodes.BAD_REQUEST;
    message = 'Validation failed';
    errors = Object.fromEntries(
      Object.entries(err.errors).map(([k, v]) => [k, [v.message]]),
    );
  } else if (err instanceof MongooseError.CastError) {
    statusCode = StatusCodes.BAD_REQUEST;
    message = `Invalid ${err.path}`;
  } else if ((err as { code?: number })?.code === 11000) {
    statusCode = StatusCodes.CONFLICT;
    const keyValue = (err as { keyValue?: Record<string, unknown> }).keyValue ?? {};
    const key = Object.keys(keyValue)[0] ?? 'field';
    message = `${key} already exists`;
  } else if (err instanceof Error) {
    message = err.message || message;
  }

  if (statusCode >= 500) {
    logger.error({ err }, 'Unhandled error');
  } else {
    logger.warn({ msg: message, statusCode }, 'Request error');
  }

  res.status(statusCode).json({
    success: false,
    message,
    code,
    errors,
    ...(isProd ? {} : { stack: err instanceof Error ? err.stack : undefined }),
  });
}
