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
import { BreaksService } from './breaks.service';
import {
  BreakHistoryQueryDto,
  CreateBreakReasonDto,
  EndBreakDto,
  StartBreakDto,
  UpdateBreakReasonDto,
} from './dto/break.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

@Roles(UserRole.ADMIN, UserRole.AGENT)
@Controller('breaks')
export class BreaksController {
  constructor(private readonly service: BreaksService) {}

  // ---- Agent break actions -------------------------------------------------
  @Post('start')
  @HttpCode(200)
  start(@CurrentUser() user: AuthenticatedUser, @Body() dto: StartBreakDto) {
    return this.service.start(user, dto);
  }

  @Post('end')
  @HttpCode(200)
  end(@CurrentUser() user: AuthenticatedUser, @Body() dto: EndBreakDto) {
    return this.service.end(user, dto);
  }

  @Get('current')
  current(@CurrentUser() user: AuthenticatedUser) {
    return this.service.current(user);
  }

  @Get('history')
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BreakHistoryQueryDto,
  ) {
    return this.service.history(user, query);
  }

  // ---- Break reasons -------------------------------------------------------
  /** Active reasons agents can pick (admin + agent). */
  @Get('reasons')
  reasons() {
    return this.service.reasons();
  }

  /** All reasons incl. inactive — admin management table. */
  @Roles(UserRole.ADMIN)
  @Get('reasons/all')
  listReasons() {
    return this.service.listReasons();
  }

  @Roles(UserRole.ADMIN)
  @Post('reasons')
  createReason(@Body() dto: CreateBreakReasonDto) {
    return this.service.createReason(dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch('reasons/:id')
  updateReason(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBreakReasonDto,
  ) {
    return this.service.updateReason(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete('reasons/:id')
  @HttpCode(204)
  async removeReason(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.removeReason(id);
  }
}
