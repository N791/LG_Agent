import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Counter, register } from 'prom-client';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

const requests =
  (register.getSingleMetric('lg_http_requests_total') as Counter | undefined) ??
  new Counter({
    name: 'lg_http_requests_total',
    help: 'HTTP requests grouped by stable route, method and response status.',
    labelNames: ['method', 'route', 'status'] as const,
  });

@Injectable()
export class HttpReleaseMetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<{
      method?: string;
      baseUrl?: string;
      route?: { path?: string };
    }>();
    const response = http.getResponse<{ statusCode: number }>();
    const method = request.method ?? 'UNKNOWN';
    const route = `${request.baseUrl ?? ''}${request.route?.path ?? 'unmatched'}`;

    return next.handle().pipe(
      tap({
        next: () => {
          requests.inc({ method, route, status: String(response.statusCode) });
        },
        error: (error: unknown) => {
          const status = error instanceof HttpException ? error.getStatus() : 500;
          requests.inc({ method, route, status: String(status) });
        },
      }),
    );
  }
}
