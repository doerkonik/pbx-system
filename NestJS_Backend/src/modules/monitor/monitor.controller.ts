import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ChannelStateService } from './channel-state.service';
import { HangupChannelDto } from './dto/monitor.dto';
import { TelephonyService } from '../../telephony/telephony.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

/**
 * Live-monitor REST surface. The grid fetches a one-time snapshot for its
 * initial paint, then applies WebSocket diffs. Supervisor actions:
 *  - spy/whisper/barge → POST /monitoring/spy (admin + supervisor)
 *  - force-hangup      → POST /monitor/hangup (admin + supervisor, below)
 */
@Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
@Controller('monitor')
export class MonitorController {
  constructor(
    private readonly channelState: ChannelStateService,
    private readonly telephony: TelephonyService,
  ) {}

  /** Full live-channel snapshot; subsequent changes arrive as WS diffs. */
  @Get('channels')
  channels() {
    return this.channelState.snapshot();
  }

  /** Supervisor force-hangup of any live channel (admin + supervisor). */
  @Post('hangup')
  @HttpCode(200)
  async hangup(@Body() dto: HangupChannelDto): Promise<{ status: 'ok' }> {
    await this.telephony.hangupCall(dto.channel);
    return { status: 'ok' };
  }
}
