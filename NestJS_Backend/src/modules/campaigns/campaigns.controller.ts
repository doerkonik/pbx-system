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
import { CampaignsService } from './campaigns.service';
import {
  AddContactsDto,
  ContactOutcomeDto,
  CreateCampaignDto,
  SetCampaignStatusDto,
  UpdateCampaignDto,
} from './dto/campaign.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly service: CampaignsService) {}

  /* --- Config (admin / supervisor) --- */

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Post()
  create(@Body() dto: CreateCampaignDto) {
    return this.service.create(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Get(':id/stats')
  stats(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.stats(id);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.service.update(id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Post(':id/status')
  @HttpCode(200)
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCampaignStatusDto,
  ) {
    return this.service.setStatus(id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Post(':id/contacts')
  addContacts(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddContactsDto,
  ) {
    return this.service.addContacts(id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.remove(id);
  }

  /* --- Agent preview flow --- */

  @Roles(UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN)
  @Get(':id/next')
  next(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.nextForAgent(id, user);
  }

  @Roles(UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN)
  @Post('contacts/:contactId/dial')
  @HttpCode(200)
  dial(
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.dial(contactId, user);
  }

  @Roles(UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN)
  @Post('contacts/:contactId/outcome')
  @HttpCode(200)
  outcome(
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ContactOutcomeDto,
  ) {
    return this.service.outcome(contactId, user, dto);
  }
}
