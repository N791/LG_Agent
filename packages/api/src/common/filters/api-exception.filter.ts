import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { I18nContext } from 'nestjs-i18n';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal Server Error' };
    const body = (typeof raw === 'string' ? { message: raw } : raw) as Record<string, unknown>;
    const rawMessage = body['message'];
    let message = 'Request failed';
    if (typeof rawMessage === 'string') {
      message = rawMessage;
    } else if (Array.isArray(rawMessage)) {
      const firstMessage: unknown = rawMessage[0];
      if (typeof firstMessage === 'string') message = firstMessage;
    }
    const translated = await this.translate(message, body);
    const traceHeader = request.headers['x-trace-id'];

    response.status(status).json({
      code: status,
      ...(typeof body['code'] === 'string' && { errorCode: body['code'] }),
      message: translated,
      ...(Array.isArray(rawMessage) && { details: rawMessage }),
      ...(body['error'] !== undefined && { details: body['error'] }),
      ...(typeof traceHeader === 'string' && { traceId: traceHeader }),
    });
  }

  private async translate(message: string, body: Record<string, unknown>): Promise<string> {
    const i18n = I18nContext.current();
    if (!i18n) return message;
    try {
      const args = body['args'] as Record<string, unknown> | undefined;
      return await i18n.t(message, { args });
    } catch {
      return message;
    }
  }
}
