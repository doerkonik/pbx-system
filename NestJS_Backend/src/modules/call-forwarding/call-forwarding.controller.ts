import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
} from '@nestjs/common';
import { CallForwardingService } from './call-forwarding.service';
import { SetCallForwardingDto } from './dto/call-forwarding.dto';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';

/**
 * Call forwarding management. Deliberately NO class-level admin guard — both
 * admins and agents can reach it. The service enforces that agents may only
 * manage their own extension.
 */
@Controller('call-forwarding')
export class CallForwardingController {
  constructor(private readonly service: CallForwardingService) {}

  @Get(':extensionNumber')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('extensionNumber') extensionNumber: string,
  ) {
    return this.service.get(user, extensionNumber);
  }

  @Put(':extensionNumber')
  set(
    @CurrentUser() user: AuthenticatedUser,
    @Param('extensionNumber') extensionNumber: string,
    @Body() dto: SetCallForwardingDto,
  ) {
    return this.service.set(user, extensionNumber, dto);
  }

  @Delete(':extensionNumber')
  @HttpCode(204)
  async clear(
    @CurrentUser() user: AuthenticatedUser,
    @Param('extensionNumber') extensionNumber: string,
  ) {
    await this.service.clear(user, extensionNumber);
  }
}
