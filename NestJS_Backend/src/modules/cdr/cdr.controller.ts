import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { CdrService } from './cdr.service';
import { QueryCdrDto } from './dto/cdr-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

@Roles(UserRole.ADMIN)
@Controller('cdr')
export class CdrController {
  constructor(private readonly service: CdrService) {}

  @Get()
  findAll(@Query() query: QueryCdrDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
}
