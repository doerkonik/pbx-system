import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { QueuesService } from './queues.service';
import {
  AddQueueMemberDto,
  CreateQueueDto,
  UpdateQueueDto,
} from './dto/queue.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Roles(UserRole.ADMIN)
@Controller('queues')
export class QueuesController {
  constructor(private readonly service: QueuesService) {}

  @Post()
  create(@Body() dto: CreateQueueDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }

  @Get(':name')
  findOne(@Param('name') name: string) {
    return this.service.findOne(name);
  }

  @Patch(':name')
  update(@Param('name') name: string, @Body() dto: UpdateQueueDto) {
    return this.service.update(name, dto);
  }

  @Delete(':name')
  @HttpCode(204)
  async remove(@Param('name') name: string) {
    await this.service.remove(name);
  }

  // --- Live snapshot -------------------------------------------------------

  @Get(':name/live')
  getLive(@Param('name') name: string) {
    return this.service.getLive(name);
  }

  // --- Member management ---------------------------------------------------

  @Get(':name/members')
  listMembers(@Param('name') name: string) {
    return this.service.listMembers(name);
  }

  @Post(':name/members')
  addMember(@Param('name') name: string, @Body() dto: AddQueueMemberDto) {
    return this.service.addMember(name, dto);
  }

  @Delete(':name/members/:extension')
  @HttpCode(204)
  async removeMember(
    @Param('name') name: string,
    @Param('extension') extension: string,
  ) {
    await this.service.removeMember(name, extension);
  }
}
