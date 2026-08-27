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
import { MohService } from './moh.service';
import {
  CreateMohClassDto,
  RegisterMohFileDto,
  UpdateMohClassDto,
} from './dto/moh.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { PaginationDto } from '../../common/dto/pagination.dto';

/** Music-on-Hold class + file metadata management — admin only. */
@Roles(UserRole.ADMIN)
@Controller('moh')
export class MohController {
  constructor(private readonly service: MohService) {}

  @Post()
  create(@Body() dto: CreateMohClassDto) {
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
    @Body() dto: UpdateMohClassDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.remove(id);
  }

  @Post(':id/files')
  addFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterMohFileDto,
  ) {
    return this.service.addFile(id, dto);
  }

  @Delete(':classId/files/:fileId')
  @HttpCode(204)
  async removeFile(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    await this.service.removeFile(classId, fileId);
  }
}
