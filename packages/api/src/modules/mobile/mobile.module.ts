import { Module } from '@nestjs/common';
import { MobileController } from './mobile.controller';
import { MobileLifecycleController } from './mobile-lifecycle.controller';
import { MobileReadModelService } from './mobile-read-model.service';
import { MobileSessionService } from './mobile-session.service';

@Module({
  controllers: [MobileController, MobileLifecycleController],
  providers: [MobileReadModelService, MobileSessionService],
  exports: [MobileReadModelService, MobileSessionService],
})
export class MobileModule {}
