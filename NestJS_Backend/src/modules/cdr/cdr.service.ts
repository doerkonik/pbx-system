import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Cdr, Recording } from '../../database/entities';
import { CallDirection } from '../../common/enums';
import {
  PaginatedResult,
  paginate,
} from '../../common/dto/pagination.dto';
import { QueryCdrDto } from './dto/cdr-query.dto';
import { applyDirectionFilter, deriveDirection } from './cdr-direction.util';

export interface CdrRow extends Cdr {
  direction: CallDirection;
}

export interface CdrDetail extends CdrRow {
  recording: {
    id: string;
    downloadUrl: string;
    streamUrl: string;
  } | null;
}

/**
 * Read-only search over the CDR table Asterisk writes via cdr_pgsql. The backend
 * never mutates these rows; it filters, paginates and annotates each with a
 * derived call direction, and links any matching recording on detail lookups.
 */
@Injectable()
export class CdrService {
  private readonly logger = new Logger(CdrService.name);

  constructor(
    @InjectRepository(Cdr)
    private readonly cdrRepo: Repository<Cdr>,
    @InjectRepository(Recording)
    private readonly recordingRepo: Repository<Recording>,
  ) {}

  async findAll(query: QueryCdrDto): Promise<PaginatedResult<CdrRow>> {
    const {
      page,
      limit,
      search,
      src,
      dst,
      disposition,
      direction,
      from,
      to,
      minDuration,
      maxDuration,
    } = query;

    const qb = this.cdrRepo.createQueryBuilder('r');

    if (src) qb.andWhere('r.src = :src', { src });
    if (dst) qb.andWhere('r.dst = :dst', { dst });
    if (disposition) {
      qb.andWhere('r.disposition = :disposition', { disposition });
    }
    if (from) qb.andWhere('r.calldate >= :from', { from: new Date(from) });
    if (to) qb.andWhere('r.calldate <= :to', { to: new Date(to) });
    if (minDuration !== undefined) {
      qb.andWhere('r.duration >= :minDuration', { minDuration });
    }
    if (maxDuration !== undefined) {
      qb.andWhere('r.duration <= :maxDuration', { maxDuration });
    }
    if (search) {
      qb.andWhere(
        '(r.src ILIKE :s OR r.dst ILIKE :s OR r.clid ILIKE :s OR r.uniqueid ILIKE :s)',
        { s: `%${search}%` },
      );
    }
    if (direction) {
      applyDirectionFilter(qb, direction);
    }

    const [rows, total] = await qb
      .orderBy('r.calldate', 'DESC')
      .addOrderBy('r.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const data = rows.map((r) => this.annotate(r));
    return paginate(data, total, page, limit);
  }

  async findOne(id: number): Promise<CdrDetail> {
    const cdr = await this.cdrRepo.findOne({ where: { id } });
    if (!cdr) throw new NotFoundException('CDR record not found');

    const recording = await this.findRecordingFor(cdr);
    return {
      ...this.annotate(cdr),
      recording: recording
        ? {
            id: recording.id,
            downloadUrl: `/recordings/${recording.id}/download`,
            streamUrl: `/recordings/${recording.id}/stream`,
          }
        : null,
    };
  }

  private annotate(cdr: Cdr): CdrRow {
    return { ...cdr, direction: deriveDirection(cdr) };
  }

  /** Match a recording by shared uniqueid/linkedid call identifiers. */
  private async findRecordingFor(cdr: Cdr): Promise<Recording | null> {
    const ids = [cdr.uniqueid, cdr.linkedid].filter(
      (v): v is string => !!v,
    );
    if (ids.length === 0) return null;

    const recording = await this.recordingRepo.findOne({
      where: [{ uniqueid: In(ids) }, { linkedid: In(ids) }],
      order: { createdAt: 'DESC' },
    });
    return recording ?? null;
  }
}
