import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Extension, User } from '../../database/entities';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { UserRole } from '../../common/enums';
import {
  PaginatedResult,
  PaginationDto,
  paginate,
} from '../../common/dto/pagination.dto';
import { PasswordPolicyService } from '../security/password-policy.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Extension)
    private readonly extensions: Repository<Extension>,
    private readonly passwordPolicy: PasswordPolicyService,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    if (dto.role === UserRole.AGENT && !dto.extension) {
      throw new BadRequestException('Agents must be assigned an extension');
    }
    if (dto.extension) {
      const ext = await this.extensions.findOne({
        where: { extensionNumber: dto.extension },
      });
      if (!ext) {
        throw new BadRequestException(
          `Extension ${dto.extension} does not exist; create it first`,
        );
      }
      const taken = await this.users.findOne({
        where: { extension: dto.extension },
      });
      if (taken) {
        throw new BadRequestException(
          `Extension ${dto.extension} is already assigned to another user`,
        );
      }
    }

    this.passwordPolicy.assertValid(dto.password);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.users.create({
      username: dto.username,
      passwordHash,
      role: dto.role,
      email: dto.email ?? null,
      fullName: dto.fullName ?? null,
      extension: dto.extension ?? null,
    });
    return this.users.save(user);
  }

  async findAll(query: PaginationDto): Promise<PaginatedResult<User>> {
    const { page, limit, search } = query;
    const [data, total] = await this.users.findAndCount({
      where: search
        ? [
            { username: ILike(`%${search}%`) },
            { fullName: ILike(`%${search}%`) },
          ]
        : {},
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return paginate(data, total, page, limit);
  }

  async findOne(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (dto.extension && dto.extension !== user.extension) {
      const taken = await this.users.findOne({
        where: { extension: dto.extension },
      });
      if (taken && taken.id !== id) {
        throw new BadRequestException('Extension already assigned');
      }
    }

    const patch: Partial<User> = {
      username: dto.username ?? user.username,
      email: dto.email ?? user.email,
      fullName: dto.fullName ?? user.fullName,
      role: dto.role ?? user.role,
      extension: dto.extension ?? user.extension,
      isActive: dto.isActive ?? user.isActive,
    };
    if (dto.password) {
      this.passwordPolicy.assertValid(dto.password);
      patch.passwordHash = await bcrypt.hash(dto.password, 10);
      patch.refreshTokenHash = null;
    }
    await this.users.update(id, patch);
    return this.findOne(id);
  }

  async resetPassword(id: string, newPassword: string): Promise<void> {
    await this.findOne(id);
    this.passwordPolicy.assertValid(newPassword);
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.users.update(id, { passwordHash, refreshTokenHash: null });
  }

  async remove(id: string): Promise<void> {
    const res = await this.users.delete(id);
    if (!res.affected) throw new NotFoundException('User not found');
  }
}
