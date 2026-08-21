import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get<string>('NODE_ENV') === 'production';
        return {
          pinoHttp: {
            level: isProduction ? 'info' : 'debug',
            transport: isProduction ? undefined : { target: 'pino-pretty' },
            autoLogging: true,
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            genReqId: (req) => req.id || req.headers['x-request-id'] || crypto.randomUUID(),
          },
        };
      },
    }),
  ],
})
export class LoggingModule {}
