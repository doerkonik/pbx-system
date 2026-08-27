import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

// No class-level admin guard: both roles may reach the controller and the
// service applies scoping / admin-only checks per endpoint.
@Roles(UserRole.ADMIN, UserRole.AGENT)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('agents')
  agents(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getAgents(user);
  }

  @Get('queues')
  queues(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getQueues(user);
  }

  @Get('calls')
  calls(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getCalls(user);
  }

  @Get('parked')
  parked() {
    return this.service.getParked();
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getSummary(user);
  }
}
