import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { AgentSessionsService } from './agent-sessions.service';
import {
  AgentLoginDto,
  SessionHistoryQueryDto,
} from './dto/agent-session.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

@Roles(UserRole.ADMIN, UserRole.AGENT)
@Controller('agent-sessions')
export class AgentSessionsController {
  constructor(private readonly service: AgentSessionsService) {}

  @Post('login')
  @HttpCode(200)
  login(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AgentLoginDto,
  ) {
    return this.service.login(user, dto);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@CurrentUser() user: AuthenticatedUser) {
    return this.service.logout(user);
  }

  @Get('current')
  current(@CurrentUser() user: AuthenticatedUser) {
    return this.service.current(user);
  }

  @Get('history')
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SessionHistoryQueryDto,
  ) {
    return this.service.history(user, query);
  }
}
