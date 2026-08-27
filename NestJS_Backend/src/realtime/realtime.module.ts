import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventsGateway } from './events.gateway';
import { RedisSubscriberService } from './redis-subscriber.service';

/** WebSocket gateway + the Redis->WS bridge. */
@Module({
  imports: [JwtModule.register({})],
  providers: [EventsGateway, RedisSubscriberService],
  exports: [EventsGateway],
})
export class RealtimeModule {}
