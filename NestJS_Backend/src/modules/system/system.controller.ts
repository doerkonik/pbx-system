import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { SystemService } from './system.service';
import { PingDto } from './dto/ping.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

@Controller('system')
export class SystemController {
  constructor(private readonly service: SystemService) {}

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Get('status')
  status(@Query('diskPath') diskPath?: string) {
    return this.service.serverStatus(diskPath || '/');
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Get('telephony')
  telephony() {
    return this.service.telephonyStatus();
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Get('channels')
  channels() {
    return this.service.activeChannels();
  }

  /** Networking diagnostic — admin only. */
  @Roles(UserRole.ADMIN)
  @Post('ping')
  @HttpCode(200)
  ping(@Body() dto: PingDto) {
    return this.service.ping(dto.host);
  }
}
