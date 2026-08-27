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
import { BlacklistService } from './blacklist.service';
import {
  CheckBlacklistDto,
  CreateBlacklistDto,
  UpdateBlacklistDto,
} from './dto/blacklist.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Roles(UserRole.ADMIN)
@Controller('blacklist')
export class BlacklistController {
  constructor(private readonly service: BlacklistService) {}

  @Post()
  create(@Body() dto: CreateBlacklistDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }

  /** Live check whether a number is blocked in a given direction. */
  @Get('check')
  check(@Query() query: CheckBlacklistDto) {
    return this.service.check(query.number, query.direction);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBlacklistDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.remove(id);
  }
}
