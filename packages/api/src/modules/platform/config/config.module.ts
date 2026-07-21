import { Global, Module } from '@nestjs/common';
import { ConfigCryptoService } from './config-crypto.service';
import { SystemConfigService } from './system-config.service';
import { SystemConfigController } from './config.controller';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [NestConfigModule],
  controllers: [SystemConfigController],
  providers: [ConfigCryptoService, SystemConfigService],
  exports: [SystemConfigService],
})
export class SystemConfigModule {}
