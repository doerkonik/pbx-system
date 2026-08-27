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
import { OutboundRoutesService } from './outbound-routes.service';
import {
  CreateOutboundRouteDto,
  UpdateOutboundRouteDto,
} from './dto/outbound-route.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Roles(UserRole.ADMIN)
@Controller('outbound-routes')
export class OutboundRoutesController {
  constructor(private readonly service: OutboundRoutesService) {}

  @Post()
  create(@Body() dto: CreateOutboundRouteDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }

  /** Admin testing: which route would handle a dialed number. */
  @Get('resolve')
  resolve(@Query('number') number: string) {
    return this.service.resolve(number);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOutboundRouteDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.remove(id);
  }
}
