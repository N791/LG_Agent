import { Module } from '@nestjs/common';
import { DataLifecyclePolicyProvider } from './data-lifecycle.policy';
import { DataLifecycleService } from './data-lifecycle.service';

@Module({
  providers: [DataLifecyclePolicyProvider, DataLifecycleService],
  exports: [DataLifecyclePolicyProvider, DataLifecycleService],
})
export class DataLifecycleModule {}
