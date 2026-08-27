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
import { InboundRoutesService } from './inbound-routes.service';
import {
  CreateInboundRouteDto,
  UpdateInboundRouteDto,
} from './dto/inbound-route.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

@Roles(UserRole.ADMIN)
@Controller('inbound-routes')
export class InboundRoutesController {
  constructor(private readonly service: InboundRoutesService) {}

  @Post()
  create(@Body() dto: CreateInboundRouteDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  /**
   * Simulate routing for a DID + optional caller id — returns the resolved
   * terminal destination and the hop trail. Handy for testing business-hours
   * and holiday config from the UI.
   */
  @Get('resolve')
  resolve(@Query('did') did?: string, @Query('cid') cid?: string) {
    return this.service.resolve(did ?? null, cid ?? null);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInboundRouteDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.remove(id);
  }
}
