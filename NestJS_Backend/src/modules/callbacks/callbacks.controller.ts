import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CallbacksService } from './callbacks.service';
import {
  CreateQueueCallbackDto,
  ListQueueCallbackQueryDto,
} from './dto/callback.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CallbackStatus, UserRole } from '../../common/enums';

@Controller('callbacks')
export class CallbacksController {
  constructor(private readonly service: CallbacksService) {}

  /** Any authenticated staff can queue a callback (e.g. on a caller request). */
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.AGENT)
  @Post()
  create(@Body() dto: CreateQueueCallbackDto) {
    return this.service.create(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Get()
  findAll(@Query() query: ListQueueCallbackQueryDto) {
    return this.service.findAll(query);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.AGENT)
  @Post(':id/dial')
  @HttpCode(200)
  dial(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.dial(id);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.AGENT)
  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.setStatus(id, CallbackStatus.CANCELLED);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.remove(id);
  }
}
