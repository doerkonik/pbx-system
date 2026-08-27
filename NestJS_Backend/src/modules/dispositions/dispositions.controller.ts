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
import { DispositionsService } from './dispositions.service';
import {
  CreateDispositionCodeDto,
  ListDispositionsQueryDto,
  SubmitDispositionDto,
  UpdateDispositionCodeDto,
} from './dto/disposition.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

@Controller()
export class DispositionsController {
  constructor(private readonly service: DispositionsService) {}

  /* --- Disposition codes (taxonomy) --- */

  @Roles(UserRole.ADMIN)
  @Post('disposition-codes')
  createCode(@Body() dto: CreateDispositionCodeDto) {
    return this.service.createCode(dto);
  }

  /** Agents list active codes to pick an outcome; admins see everything. */
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.AGENT)
  @Get('disposition-codes')
  findCodes(
    @CurrentUser() user: AuthenticatedUser,
    @Query('activeOnly') activeOnly?: string,
  ) {
    const agentView = user.role === UserRole.AGENT;
    return this.service.findCodes(agentView || activeOnly === 'true');
  }

  @Roles(UserRole.ADMIN)
  @Patch('disposition-codes/:id')
  updateCode(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDispositionCodeDto,
  ) {
    return this.service.updateCode(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete('disposition-codes/:id')
  @HttpCode(204)
  async removeCode(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.removeCode(id);
  }

  /* --- Per-call disposition submission --- */

  @Roles(UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN)
  @Post('calls/:uniqueid/disposition')
  submit(
    @Param('uniqueid') uniqueid: string,
    @Body() dto: SubmitDispositionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.submit(uniqueid, user.sub, user.extension, dto);
  }

  /** Supervisor/admin disposition log. */
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Get('dispositions')
  findSubmitted(@Query() query: ListDispositionsQueryDto) {
    return this.service.findSubmitted(query);
  }
}
