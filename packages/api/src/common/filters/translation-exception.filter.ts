import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Response } from 'express';
import { I18nContext } from 'nestjs-i18n';

@Catch(HttpException)
export class TranslationExceptionFilter implements ExceptionFilter {
  async catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const responseBody = exception.getResponse() as string | Record<string, unknown>;

    const i18n = I18nContext.current();
    if (i18n) {
      if (typeof responseBody === 'string') {
        try {
          const translated = await i18n.t(responseBody);
          response.status(status).json({
            statusCode: status,
            message: translated,
          });
          return;
        } catch (_e) {
          // ignore
        }
      } else if (typeof responseBody === 'object' && 'message' in responseBody) {
        if (typeof responseBody.message === 'string') {
          try {
            // Check if it's a translation key
            const args = ('args' in responseBody ? responseBody.args : undefined) as
              Record<string, unknown> | undefined;
            const translated = await i18n.t(responseBody.message, { args });
            // If the translation resolves to the same key or an object, it means it's not a valid key,
            // but nestjs-i18n will return the key itself if not found.
            if (translated !== responseBody.message) {
              responseBody.message = translated;
            }
            if ('args' in responseBody) {
              delete responseBody.args;
            }
          } catch (_e) {
            // ignore
          }
        } else if (Array.isArray(responseBody.message)) {
          // For validation errors, handled by I18nValidationExceptionFilter normally, but just in case
        }
      }
    }

    response.status(status).json(responseBody);
  }
}
