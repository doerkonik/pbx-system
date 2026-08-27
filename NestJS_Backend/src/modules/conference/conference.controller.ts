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
import { ConferenceService } from './conference.service';
import {
  AddParticipantDto,
  CreateConferenceDto,
  LockConferenceDto,
  MuteParticipantDto,
  UpdateConferenceDto,
} from './dto/conference.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { PaginationDto } from '../../common/dto/pagination.dto';

/**
 * Conference room management. CRUD is admin-only (class-level). Bringing an
 * extension into a room is available to agents too (method-level override).
 */
@Roles(UserRole.ADMIN)
@Controller('conference')
export class ConferenceController {
  constructor(private readonly service: ConferenceService) {}

  @Post()
  create(@Body() dto: CreateConferenceDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConferenceDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.remove(id);
  }

  // --- Live participant control ------------------------------------------

  /** Agents and admins may bring an extension into a room. */
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  @Post(':id/participants')
  addParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddParticipantDto,
  ) {
    return this.service.addParticipant(id, dto.extension);
  }

  @Get(':id/participants')
  listParticipants(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listParticipants(id);
  }

  @Delete(':id/participants/:channelId')
  @HttpCode(204)
  async removeParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('channelId') channelId: string,
  ) {
    await this.service.removeParticipant(id, channelId);
  }

  /** Mute/unmute a participant (admin + supervisor moderation). */
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Post(':id/participants/:channelId/mute')
  @HttpCode(200)
  muteParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('channelId') channelId: string,
    @Body() dto: MuteParticipantDto,
  ) {
    return this.service.muteParticipant(id, channelId, dto.mute);
  }

  /** Lock/unlock the room against new joins. */
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Post(':id/lock')
  @HttpCode(200)
  lock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LockConferenceDto,
  ) {
    return this.service.setLock(id, dto.locked);
  }
}
