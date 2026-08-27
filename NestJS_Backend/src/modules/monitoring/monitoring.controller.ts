import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import {
  CreateSlaThresholdDto,
  SpyDto,
  UpdateSlaThresholdDto,
} from './dto/monitoring.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly service: MonitoringService) {}

  /* --- Listen / whisper / barge (supervisor + admin) --- */

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Post('spy')
  @HttpCode(200)
  spy(@CurrentUser() user: AuthenticatedUser, @Body() dto: SpyDto) {
    return this.service.spy(user, dto);
  }

  /* --- Live wallboard + alerts (supervisor + admin) --- */

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Get('wallboard')
  wallboard() {
    return this.service.wallboard();
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Get('alerts')
  alerts(@Query('openOnly') openOnly?: string) {
    return this.service.listAlerts(openOnly === 'true');
  }

  /* --- SLA thresholds (admin) --- */

  @Roles(UserRole.ADMIN)
  @Post('sla-thresholds')
  createThreshold(@Body() dto: CreateSlaThresholdDto) {
    return this.service.createThreshold(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Get('sla-thresholds')
  listThresholds() {
    return this.service.listThresholds();
  }

  @Roles(UserRole.ADMIN)
  @Patch('sla-thresholds/:id')
  updateThreshold(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSlaThresholdDto,
  ) {
    return this.service.updateThreshold(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete('sla-thresholds/:id')
  @HttpCode(204)
  async removeThreshold(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.removeThreshold(id);
  }
}
