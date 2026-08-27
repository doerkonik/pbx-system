import { Module } from '@nestjs/common';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';

/**
 * System/infra monitoring (Module 11). No entities — reads host stats (os/fs),
 * Redis live-state, and AMI/ARI health on demand. Redis + TelephonyService come
 * from their global modules.
 */
@Module({
  controllers: [SystemController],
  providers: [SystemService],
  exports: [SystemService],
})
export class SystemModule {}
