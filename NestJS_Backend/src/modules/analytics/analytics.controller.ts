import { Controller, Get, Query } from '@nestjs/common';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { AnalyticsService } from './analytics.service';
import {
  AgentUtilizationDto,
  AnalyticsRangeDto,
  WaitDistributionDto,
} from './dto/analytics-query.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('wait-distribution')
  @Roles(UserRole.ADMIN)
  waitDistribution(@Query() query: WaitDistributionDto) {
    return this.service.waitDistribution(query);
  }

  @Get('answer-rates')
  @Roles(UserRole.ADMIN)
  answerRates(@Query() query: AnalyticsRangeDto) {
    return this.service.answerRates(query);
  }

  @Get('peak-hours')
  @Roles(UserRole.ADMIN)
  peakHours(@Query() query: AnalyticsRangeDto) {
    return this.service.peakHours(query);
  }

  /** Agent utilization. Agents are forced to their own id. */
  @Get('agent-utilization')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  agentUtilization(
    @Query() query: AgentUtilizationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.agentUtilization(query, user);
  }
}
