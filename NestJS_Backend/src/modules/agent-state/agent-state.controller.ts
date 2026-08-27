import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { AgentStateService } from './agent-state.service';
import { SetAcwDto, SetDndDto } from './dto/agent-state.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

@Roles(UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN)
@Controller('agent-state')
export class AgentStateController {
  constructor(private readonly service: AgentStateService) {}

  @Get()
  getState(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getState(user);
  }

  @Post('dnd')
  @HttpCode(200)
  setDnd(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetDndDto) {
    return this.service.setDnd(user, dto);
  }

  @Post('acw')
  @HttpCode(200)
  setAcw(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetAcwDto) {
    return this.service.setAcw(user, dto);
  }
}
