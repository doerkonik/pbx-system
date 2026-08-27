import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { Request, Response } from 'express';

/**
 * Single funnel for every unhandled error so nothing leaks a stack trace to the
 * client and every failure is logged with structured context. No silent failures.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'InternalServerError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        message = (r.message as string) ?? exception.message;
        error = (r.error as string) ?? exception.name;
      }
    } else if (exception instanceof QueryFailedError) {
      // Map common Postgres integrity errors to clean 409/400 responses.
      const pgErr = exception as QueryFailedError & { code?: string };
      if (pgErr.code === '23505') {
        status = HttpStatus.CONFLICT;
        message = 'A record with these unique values already exists';
        error = 'Conflict';
      } else if (pgErr.code === '23503') {
        status = HttpStatus.BAD_REQUEST;
        message = 'Referenced record does not exist or is still in use';
        error = 'BadRequest';
      } else {
        message = 'Database error';
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const body = {
      statusCode: status,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} -> ${status}: ${message}`);
    }

    response.status(status).json(body);
  }
}
