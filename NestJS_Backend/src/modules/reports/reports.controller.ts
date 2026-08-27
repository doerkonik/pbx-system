import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { RollupService } from '../../scheduler/rollup.service';
import { ReportsService } from './reports.service';
import {
  AgentReportQueryDto,
  QueueReportQueryDto,
  RollupRunDto,
  SummaryQueryDto,
} from './dto/report-query.dto';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly service: ReportsService,
    private readonly rollup: RollupService,
  ) {}

  /** Manual/backfill rollup for a specific date. Admin only. */
  @Post('rollup/run')
  @Roles(UserRole.ADMIN)
  @HttpCode(202)
  async runRollup(@Body() dto: RollupRunDto) {
    await this.rollup.rollupForDate(dto.date);
    return { status: 'ok', date: dto.date };
  }

  /** Agent stats over a range. Agents are forced to their own id. */
  @Get('agents')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  agents(
    @Query() query: AgentReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.agentReport(query, user);
  }

  @Get('agents/export')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  async agentsExport(
    @Query() query: AgentReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const csv = await this.service.agentReportCsv(query, user);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="agent-report.csv"',
    );
    res.send(csv);
  }

  @Get('queues')
  @Roles(UserRole.ADMIN)
  queues(@Query() query: QueueReportQueryDto) {
    return this.service.queueReport(query);
  }

  @Get('queues/export')
  @Roles(UserRole.ADMIN)
  async queuesExport(
    @Query() query: QueueReportQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.service.queueReportCsv(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="queue-report.csv"',
    );
    res.send(csv);
  }

  @Get('summary')
  @Roles(UserRole.ADMIN)
  summary(@Query() query: SummaryQueryDto) {
    return this.service.summary(query);
  }
}
