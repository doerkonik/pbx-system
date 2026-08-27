import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { BackupService } from './backup.service';
import { BulkImportService } from './bulk-import.service';
import { ImportDto, RestoreDto } from './dto/admin.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly backup: BackupService,
    private readonly bulkImport: BulkImportService,
  ) {}

  /* ------------------------------ Bulk import -------------------------- */

  @Post('import/extensions')
  @HttpCode(200)
  importExtensions(@Body() dto: ImportDto) {
    return this.bulkImport.importExtensions(dto);
  }

  @Post('import/users')
  @HttpCode(200)
  importUsers(@Body() dto: ImportDto) {
    return this.bulkImport.importUsers(dto);
  }

  /* -------------------------------- Backup ----------------------------- */

  @Post('backup')
  @HttpCode(200)
  createBackup() {
    return this.backup.create('manual', new Date().toISOString());
  }

  @Get('backup')
  listBackups() {
    return this.backup.list();
  }

  @Get('backup/:id/download')
  download(@Param('id', ParseUUIDPipe) id: string) {
    return this.backup.read(id);
  }

  @Post('backup/restore')
  @HttpCode(200)
  restore(@Body() dto: RestoreDto) {
    return this.backup.restore(dto);
  }
}
