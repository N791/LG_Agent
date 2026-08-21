import { Module } from '@nestjs/common';
import { MobileController } from './mobile.controller';
import { MobileReadModelService } from './mobile-read-model.service';

@Module({
  controllers: [MobileController],
  providers: [MobileReadModelService],
  exports: [MobileReadModelService],
})
export class MobileModule {}
