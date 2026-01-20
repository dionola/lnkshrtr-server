import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ZodError } from 'zod';

export class AppError extends HttpException {
  constructor(status: number, public readonly code: string, message: string) {
    super({ code, message }, status);
  }
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: exception.issues[0]?.message ?? 'Validation failed' } });
      return;
    }

    if (exception instanceof AppError) {
      const body = exception.getResponse() as { code: string; message: string };
      res.status(exception.getStatus()).json({ error: body });
      return;
    }

    if (exception instanceof HttpException) {
      res.status(exception.getStatus()).json({ error: { code: 'HTTP_ERROR', message: exception.message } });
      return;
    }

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
}
