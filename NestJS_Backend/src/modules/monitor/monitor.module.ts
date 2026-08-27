import { Module } from '@nestjs/common';
import { RealtimeModule } from '../../realtime/realtime.module';
import { ChannelStateService } from './channel-state.service';
import { MonitorEventListener } from './monitor-event.listener';
import { MonitorController } from './monitor.controller';

/**
 * FOP2-style live monitoring: event listener + in-memory channel-state tracker
 * (bridge → connectedTo) that broadcasts named diffs to the admin/supervisor
 * WebSocket room, plus a snapshot endpoint for initial paint. Imports
 * RealtimeModule for the EventsGateway; RedisService is global.
 */
@Module({
  imports: [RealtimeModule],
  controllers: [MonitorController],
  providers: [ChannelStateService, MonitorEventListener],
  exports: [ChannelStateService],
})
export class MonitorModule {}
