import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { BackupService } from './backup.service';
import { BulkImportService } from './bulk-import.service';
import { BackupRecord } from '../../database/entities';
import { ExtensionsModule } from '../extensions/extensions.module';
import { UsersModule } from '../users/users.module';

/**
 * Backup & system admin (Module 13). Config backup/restore + scheduled dumps,
 * plus CSV/JSON bulk import that reuses ExtensionsService / UsersService.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([BackupRecord]),
    ExtensionsModule,
    UsersModule,
  ],
  controllers: [AdminController],
  providers: [BackupService, BulkImportService],
  exports: [BackupService],
})
export class AdminModule {}
