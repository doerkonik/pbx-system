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
import { QaService } from './qa.service';
import {
  CreateCallNoteDto,
  CreateEvaluationDto,
  CreateQaFormDto,
  SubmitScoresDto,
  UpdateQaFormDto,
} from './dto/qa.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

@Controller('qa')
export class QaController {
  constructor(private readonly service: QaService) {}

  /* ------------------------------ Forms (admin) ----------------------- */

  @Roles(UserRole.ADMIN)
  @Post('forms')
  createForm(@Body() dto: CreateQaFormDto) {
    return this.service.createForm(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Get('forms')
  listForms(@Query('activeOnly') activeOnly?: string) {
    return this.service.listForms(activeOnly === 'true');
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Get('forms/:id')
  getForm(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getForm(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch('forms/:id')
  updateForm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQaFormDto,
  ) {
    return this.service.updateForm(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete('forms/:id')
  @HttpCode(204)
  async removeForm(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.removeForm(id);
  }

  /* --------------------------- Evaluations ---------------------------- */

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Post('evaluations')
  createEvaluation(
    @Body() dto: CreateEvaluationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createEvaluation(dto, user);
  }

  /** Staff see all (filterable); agents see their own. */
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.AGENT)
  @Get('evaluations')
  listEvaluations(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('evaluatorId') evaluatorId?: string,
    @Query('agentExtension') agentExtension?: string,
  ) {
    return this.service.listEvaluations(user, { status, evaluatorId, agentExtension });
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.AGENT)
  @Get('evaluations/:id')
  getEvaluation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getEvaluation(id, user);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Post('evaluations/:id/scores')
  @HttpCode(200)
  submitScores(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitScoresDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.submitScores(id, user, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Post('evaluations/:id/complete')
  @HttpCode(200)
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.complete(id, user);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.AGENT)
  @Post('evaluations/:id/dispute')
  @HttpCode(200)
  dispute(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.dispute(id, user);
  }

  /* ---------------------- Coaching notes / tagging -------------------- */

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Post('calls/:uniqueid/notes')
  addNote(
    @Param('uniqueid') uniqueid: string,
    @Body() dto: CreateCallNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.addNote(uniqueid, user, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Get('calls/:uniqueid/notes')
  listNotes(@Param('uniqueid') uniqueid: string) {
    return this.service.listNotes(uniqueid);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Delete('notes/:id')
  @HttpCode(204)
  async removeNote(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.service.removeNote(id, user);
  }
}
