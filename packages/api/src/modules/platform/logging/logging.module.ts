import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        level: process.env['NODE_ENV'] !== 'production' ? 'debug' : 'info',
        transport: process.env['NODE_ENV'] !== 'production' ? { target: 'pino-pretty' } : undefined,
        autoLogging: true,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        genReqId: (req) => req.id || req.headers['x-request-id'] || crypto.randomUUID(),
      },
    }),
  ],
})
export class LoggingModule {}
