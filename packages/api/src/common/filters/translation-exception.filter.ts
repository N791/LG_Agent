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
        if (typeof responseBody['message'] === 'string') {
          try {
            // Retrieve args if they were attached to the response body
            const args = ('args' in responseBody ? responseBody['args'] : undefined) as
              Record<string, unknown> | undefined;
            const translated = await i18n.t(responseBody['message'], { args });

            // Only update if translation succeeded (different from key)
            if (translated !== responseBody['message']) {
              responseBody['message'] = translated;
            }
            // Remove args from final response to keep it clean
            delete responseBody['args'];
          } catch (_e) {
            // Ignore translation errors
          }
        } else if (Array.isArray(responseBody['message'])) {
          // For validation errors, handled by I18nValidationExceptionFilter normally, but just in case
        }
      }
    }

    response.status(status).json(responseBody);
  }
}
