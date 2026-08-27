import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { CallControlService } from './call-control.service';
import {
  ChannelDto,
  ChannelIdDto,
  OriginateDto,
  ParkDto,
  PickupDto,
  TransferDto,
} from './dto/call-control.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

@Roles(UserRole.ADMIN, UserRole.AGENT)
@Controller('call-control')
export class CallControlController {
  constructor(private readonly service: CallControlService) {}

  @Post('originate')
  @HttpCode(200)
  originate(@CurrentUser() user: AuthenticatedUser, @Body() dto: OriginateDto) {
    return this.service.originate(user, dto);
  }

  @Post('answer')
  @HttpCode(200)
  answer(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChannelIdDto) {
    return this.service.answer(user, dto);
  }

  @Post('hangup')
  @HttpCode(200)
  hangup(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChannelDto) {
    return this.service.hangup(user, dto);
  }

  @Post('hold')
  @HttpCode(200)
  hold(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChannelIdDto) {
    return this.service.hold(user, dto);
  }

  @Post('unhold')
  @HttpCode(200)
  unhold(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChannelIdDto) {
    return this.service.unhold(user, dto);
  }

  @Post('transfer')
  @HttpCode(200)
  transfer(@CurrentUser() user: AuthenticatedUser, @Body() dto: TransferDto) {
    return this.service.transfer(user, dto);
  }

  @Post('park')
  @HttpCode(200)
  park(@CurrentUser() user: AuthenticatedUser, @Body() dto: ParkDto) {
    return this.service.park(user, dto);
  }

  @Post('pickup')
  @HttpCode(200)
  pickup(@CurrentUser() user: AuthenticatedUser, @Body() dto: PickupDto) {
    return this.service.pickup(user, dto.targetExtension);
  }

  @Post('record/start')
  @HttpCode(200)
  startRecording(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChannelDto,
  ) {
    return this.service.startRecording(user, dto);
  }

  @Post('record/stop')
  @HttpCode(200)
  stopRecording(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChannelDto,
  ) {
    return this.service.stopRecording(user, dto);
  }

  @Post('record/pause')
  @HttpCode(200)
  pauseRecording(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChannelDto,
  ) {
    return this.service.pauseRecording(user, dto);
  }

  @Post('record/resume')
  @HttpCode(200)
  resumeRecording(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChannelDto,
  ) {
    return this.service.resumeRecording(user, dto);
  }

  @Get('parked')
  parked() {
    return this.service.listParked();
  }
}
