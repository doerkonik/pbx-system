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
import { SkillsService } from './skills.service';
import {
  AssignAgentSkillDto,
  CreateSkillDto,
  SetQueueSkillDto,
  UpdateSkillDto,
} from './dto/skill.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

@Controller()
export class SkillsController {
  constructor(private readonly service: SkillsService) {}

  /* --- Skills catalogue (admin) --- */

  @Roles(UserRole.ADMIN)
  @Post('skills')
  createSkill(@Body() dto: CreateSkillDto) {
    return this.service.createSkill(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Get('skills')
  listSkills() {
    return this.service.listSkills();
  }

  @Roles(UserRole.ADMIN)
  @Patch('skills/:id')
  updateSkill(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSkillDto,
  ) {
    return this.service.updateSkill(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete('skills/:id')
  @HttpCode(204)
  async removeSkill(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.removeSkill(id);
  }

  /* --- Agent skill assignments (admin + supervisor) --- */

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Post('agent-skills')
  assignAgentSkill(@Body() dto: AssignAgentSkillDto) {
    return this.service.assignAgentSkill(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Get('agent-skills')
  listAgentSkills(@Query('extension') extension?: string) {
    return this.service.listAgentSkills(extension);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Delete('agent-skills/:id')
  @HttpCode(204)
  async removeAgentSkill(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.removeAgentSkill(id);
  }

  /* --- Queue skill requirements (admin) --- */

  @Roles(UserRole.ADMIN)
  @Post('queue-skills')
  setQueueSkill(@Body() dto: SetQueueSkillDto) {
    return this.service.setQueueSkill(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Get('queue-skills')
  listQueueSkills(@Query('queueName') queueName?: string) {
    return this.service.listQueueSkills(queueName);
  }

  @Roles(UserRole.ADMIN)
  @Delete('queue-skills/:id')
  @HttpCode(204)
  async removeQueueSkill(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.removeQueueSkill(id);
  }

  /* --- Routing plan (admin + supervisor) --- */

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Get('queue-skills/:queueName/preview')
  preview(@Param('queueName') queueName: string) {
    return this.service.computeMembership(queueName);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Post('queue-skills/:queueName/apply')
  @HttpCode(200)
  apply(@Param('queueName') queueName: string) {
    return this.service.applyRouting(queueName);
  }
}
