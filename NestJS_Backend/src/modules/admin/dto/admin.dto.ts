import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';

/** Bulk import: supply either parsed `rows` or raw `csv` text. */
export class ImportDto {
  @IsOptional()
  @IsString()
  csv?: string;

  @IsOptional()
  @IsArray()
  rows?: Record<string, any>[];
}

/** Restore body — a backup snapshot ({ version, createdAt, tables }). */
export class RestoreDto {
  @IsObject()
  tables: Record<string, any[]>;
}
