import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { MohClass, MohFile } from '../../database/entities';
import {
  CreateMohClassDto,
  RegisterMohFileDto,
  UpdateMohClassDto,
} from './dto/moh.dto';
import { assertSafeAsteriskId } from '../../common/utils/asterisk-sanitize';
import {
  PaginatedResult,
  PaginationDto,
  paginate,
} from '../../common/dto/pagination.dto';

/**
 * Manages Music-on-Hold class and file metadata (the `moh_classes` / `moh_files`
 * rows Asterisk reads). NOTE: the actual audio upload/placement onto VM1's shared
 * MoH directory is an ops step documented in asterisk_configuration.md — this
 * service only owns the class/file metadata, not the bytes on disk.
 */
@Injectable()
export class MohService {
  private readonly logger = new Logger(MohService.name);

  constructor(
    @InjectRepository(MohClass)
    private readonly classRepo: Repository<MohClass>,
    @InjectRepository(MohFile)
    private readonly fileRepo: Repository<MohFile>,
  ) {}

  async create(dto: CreateMohClassDto): Promise<MohClass> {
    const name = assertSafeAsteriskId(dto.name, 'name');

    const existing = await this.classRepo.findOne({ where: { name } });
    if (existing) {
      throw new ConflictException(`MoH class ${name} already exists`);
    }

    const entity = this.classRepo.create({
      name,
      mode: dto.mode ?? 'files',
      directory: dto.directory,
      format: dto.format ?? 'wav',
    });
    const saved = await this.classRepo.save(entity);
    this.logger.log(`MoH class ${name} created`);
    return saved;
  }

  async findAll(query: PaginationDto): Promise<PaginatedResult<MohClass>> {
    const { page, limit, search } = query;
    const [data, total] = await this.classRepo.findAndCount({
      where: search ? { name: ILike(`%${search}%`) } : {},
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return paginate(data, total, page, limit);
  }

  /** Returns the class together with its registered files. */
  async findOne(id: string): Promise<MohClass> {
    const cls = await this.classRepo.findOne({
      where: { id },
      relations: { files: true },
      order: { files: { createdAt: 'ASC' } },
    });
    if (!cls) throw new NotFoundException('MoH class not found');
    return cls;
  }

  async update(id: string, dto: UpdateMohClassDto): Promise<MohClass> {
    const cls = await this.classRepo.findOne({ where: { id } });
    if (!cls) throw new NotFoundException('MoH class not found');

    if (dto.name !== undefined) {
      const name = assertSafeAsteriskId(dto.name, 'name');
      if (name !== cls.name) {
        const clash = await this.classRepo.findOne({ where: { name } });
        if (clash) {
          throw new ConflictException(`MoH class ${name} already exists`);
        }
      }
      cls.name = name;
    }
    if (dto.mode !== undefined) cls.mode = dto.mode;
    if (dto.directory !== undefined) cls.directory = dto.directory;
    if (dto.format !== undefined) cls.format = dto.format;

    const saved = await this.classRepo.save(cls);
    this.logger.log(`MoH class ${saved.name} updated`);
    return saved;
  }

  async remove(id: string): Promise<void> {
    const cls = await this.classRepo.findOne({ where: { id } });
    if (!cls) throw new NotFoundException('MoH class not found');
    // moh_files rows cascade-delete via the FK (onDelete: 'CASCADE').
    await this.classRepo.delete(id);
    this.logger.log(`MoH class ${cls.name} deleted`);
  }

  /**
   * Registers a file that already exists on VM1's shared MoH directory. We store
   * metadata only; the audio must be placed on disk out-of-band (see
   * asterisk_configuration.md).
   */
  async addFile(classId: string, dto: RegisterMohFileDto): Promise<MohFile> {
    const cls = await this.classRepo.findOne({ where: { id: classId } });
    if (!cls) throw new NotFoundException('MoH class not found');

    const duplicate = await this.fileRepo.findOne({
      where: { mohClassId: classId, fileName: dto.fileName },
    });
    if (duplicate) {
      throw new ConflictException(
        `File ${dto.fileName} is already registered on this class`,
      );
    }

    const file = this.fileRepo.create({
      mohClassId: classId,
      fileName: dto.fileName,
      filePath: dto.filePath,
    });
    const saved = await this.fileRepo.save(file);
    this.logger.log(`MoH file ${dto.fileName} registered on class ${cls.name}`);
    return saved;
  }

  async removeFile(classId: string, fileId: string): Promise<void> {
    const file = await this.fileRepo.findOne({
      where: { id: fileId, mohClassId: classId },
    });
    if (!file) {
      throw new NotFoundException('MoH file not found on this class');
    }
    await this.fileRepo.delete(fileId);
    this.logger.log(`MoH file ${file.fileName} removed from class ${classId}`);
  }
}
