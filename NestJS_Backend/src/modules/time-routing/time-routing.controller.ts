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
} from '@nestjs/common';
import { TimeRoutingService } from './time-routing.service';
import {
  CreateHolidayDto,
  CreateTimeConditionDto,
  CreateTimeGroupDto,
  UpdateHolidayDto,
  UpdateTimeConditionDto,
  UpdateTimeGroupDto,
} from './dto/time-routing.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

@Roles(UserRole.ADMIN)
@Controller()
export class TimeRoutingController {
  constructor(private readonly service: TimeRoutingService) {}

  /* --- Time groups --- */
  @Post('time-groups')
  createGroup(@Body() dto: CreateTimeGroupDto) {
    return this.service.createGroup(dto);
  }

  @Get('time-groups')
  findGroups() {
    return this.service.findGroups();
  }

  @Get('time-groups/:id')
  findGroup(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findGroup(id);
  }

  @Patch('time-groups/:id')
  updateGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimeGroupDto,
  ) {
    return this.service.updateGroup(id, dto);
  }

  @Delete('time-groups/:id')
  @HttpCode(204)
  async removeGroup(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.removeGroup(id);
  }

  /* --- Time conditions --- */
  @Post('time-conditions')
  createCondition(@Body() dto: CreateTimeConditionDto) {
    return this.service.createCondition(dto);
  }

  @Get('time-conditions')
  findConditions() {
    return this.service.findConditions();
  }

  @Get('time-conditions/:id')
  findCondition(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findCondition(id);
  }

  @Patch('time-conditions/:id')
  updateCondition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimeConditionDto,
  ) {
    return this.service.updateCondition(id, dto);
  }

  @Delete('time-conditions/:id')
  @HttpCode(204)
  async removeCondition(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.removeCondition(id);
  }

  /* --- Holidays --- */
  @Post('holidays')
  createHoliday(@Body() dto: CreateHolidayDto) {
    return this.service.createHoliday(dto);
  }

  @Get('holidays')
  findHolidays() {
    return this.service.findHolidays();
  }

  @Get('holidays/:id')
  findHoliday(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findHoliday(id);
  }

  @Patch('holidays/:id')
  updateHoliday(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHolidayDto,
  ) {
    return this.service.updateHoliday(id, dto);
  }

  @Delete('holidays/:id')
  @HttpCode(204)
  async removeHoliday(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.removeHoliday(id);
  }
}
